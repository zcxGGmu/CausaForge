import { describe, expect, test } from "bun:test"
import { WORKFLOW_AGENT_IDS } from "@causaforge/core"
import { parseWorkflowConfig } from "../config/schema"
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
})

function testContext(configInput: unknown = {}) {
  return {
    cwd: "/tmp/project",
    config: parseWorkflowConfig(configInput),
  }
}
