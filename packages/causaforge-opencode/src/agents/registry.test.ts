import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { WORKFLOW_AGENT_IDS } from "@causaforge/core"
import { parseWorkflowConfig } from "../config/schema"
import { createWorkflowOpenCodeContext } from "../context"
import { createWorkflowAgents } from "./registry"

describe("workflow agent registry", () => {
  test("registers only normalized workflow agents in canonical order", () => {
    const agents = createWorkflowAgents(testContext())

    expect(Object.keys(agents)).toEqual([...WORKFLOW_AGENT_IDS])
    expect(agents["patch-builder"].mode).toBe("subagent")
    expect(agents["workflow-orchestrator"].mode).toBe("primary")
  })

  test("includes role boundaries and workflow artifact instructions in every prompt", () => {
    const agents = createWorkflowAgents(testContext())

    for (const agent of Object.values(agents)) {
      expect(agent.prompt).toContain("Current responsibility")
      expect(agent.prompt).toContain("Prohibited")
      expect(agent.prompt).toContain("Allowed artifact kind")
      expect(agent.prompt).toContain("Request state transitions through workflow_transition")
      expect(agent.prompt).toContain("Do not edit workflow.json directly")
    }
  })

  test("applies model overrides by normalized agent ID", () => {
    const agents = createWorkflowAgents(testContext({
      agents: {
        "patch-builder": {
          model: "gpt-5.6-terra",
          variant: "code-heavy",
          reasoningEffort: "high",
        },
      },
    }))

    expect(agents["patch-builder"]).toMatchObject({
      model: "gpt-5.6-terra",
      variant: "code-heavy",
      reasoningEffort: "high",
    })
    expect(agents["patch-reviewer"].model).toBeUndefined()
  })

  test("injects the fixed blueprint corpus data source into every prompt when present", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-agent-context-"))
    try {
      await fs.mkdir(path.join(project, ".CausaForge", "blueprint"), { recursive: true })
      await fs.writeFile(path.join(project, ".CausaForge", "blueprint", "root-cause-notes.md"), "notes\n")

      const agents = createWorkflowAgents(createWorkflowOpenCodeContext({ cwd: project }))

      for (const agent of Object.values(agents)) {
        expect(agent.prompt).toContain("Blueprint corpus:")
        expect(agent.prompt).toContain(`Path: ${path.join(project, ".CausaForge", "blueprint")}`)
        expect(agent.prompt).toContain("Read this corpus on demand")
      }
    } finally {
      await fs.rm(project, { recursive: true, force: true })
    }
  })

  test("omits blueprint corpus prompt instructions when the fixed path is absent", () => {
    const agents = createWorkflowAgents(testContext())

    for (const agent of Object.values(agents)) {
      expect(agent.prompt).not.toContain("Blueprint corpus:")
    }
  })

  test("injects verification source selection skill guidance into build and verify handoffs", () => {
    const agents = createWorkflowAgents(testContext())

    for (const agentId of ["workflow-orchestrator", "patch-builder", "regression-verifier"] as const) {
      expect(agents[agentId].prompt).toContain("causaforge-verification-source-selection")
      expect(agents[agentId].prompt).toContain("workflow_prepare_verification_source")
      expect(agents[agentId].prompt).toContain("workflow_run_verification")
      expect(agents[agentId].prompt).toContain("official")
      expect(agents[agentId].prompt).toContain("user")
    }
    expect(agents["patch-reviewer"].prompt).not.toContain("causaforge-verification-source-selection")
  })
})

function testContext(configInput: unknown = {}) {
  return {
    cwd: "/tmp/project",
    config: parseWorkflowConfig(configInput),
    blueprintCorpus: null,
  }
}
