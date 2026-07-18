import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { createPluginModule } from "./opencode-plugin-module"

const timestamp = "2026-07-15T00:00:00.000Z"

const rootCause = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "root-cause-001",
  createdAt: timestamp,
  problemSummary: "Migration drops a required field.",
  reproductionEvidence: ["Run the migration regression test."],
  observedBehavior: "The required field is absent.",
  expectedBehavior: "The required field is preserved.",
  rootCauseSummary: "Normalization omits the migrated field.",
  causalChain: ["Migration reads the field.", "Normalization omits the field."],
  affectedLocations: ["src/migrate.ts"],
  constraints: ["Keep the patch scoped to migration normalization."],
  verificationCriteria: [
    { criterionId: "criterion-001", description: "The field is preserved.", required: true },
  ],
  status: "confirmed" as const,
}

const patchPlan = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "patch-plan-001",
  createdAt: timestamp,
  rootCauseArtifactId: rootCause.artifactId,
  objectives: ["Preserve the required field."],
  fileChanges: [
    { path: "src/migrate.ts", change: "Copy the field into normalized output.", rootCauseLinks: ["criterion-001"] },
  ],
  nonGoals: [],
  verificationPlan: ["Run the migration regression test."],
  risks: [],
  status: "approved" as const,
}

describe("OpenCode plugin module hooks", () => {
  test("uses the single active workflow for building-phase tool permission fallback", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-plugin-module-"))
    try {
      const hooks = await createHooks(project)
      await callTool(hooks, "workflow_start", { workflowId: "wf-001", entryMode: "problem-description", now: timestamp })
      await callTool(hooks, "workflow_record_artifact", {
        workflowId: "wf-001",
        agentId: "root-cause-analyst",
        artifactKind: "root-cause",
        artifact: rootCause,
      })
      await callTool(hooks, "workflow_transition", {
        workflowId: "wf-001",
        expectedPhase: "root_cause",
        targetPhase: "planning",
        requestedByAgent: "root-cause-analyst",
        sessionId: "session-root-cause-001",
        now: timestamp,
      })
      await callTool(hooks, "workflow_record_artifact", {
        workflowId: "wf-001",
        agentId: "patch-planner",
        artifactKind: "patch-plan",
        artifact: patchPlan,
      })
      await callTool(hooks, "workflow_transition", {
        workflowId: "wf-001",
        expectedPhase: "planning",
        targetPhase: "building",
        requestedByAgent: "patch-planner",
        sessionId: "session-planner-001",
        now: timestamp,
      })

      await expect(hooks["tool.execute.before"]!(
        { tool: "edit", sessionID: "session-builder-001", callID: "call-allowed" },
        { args: { path: "src/migrate.ts" } },
      )).resolves.toBeUndefined()

      await expect(hooks["tool.execute.before"]!(
        { tool: "edit", sessionID: "session-builder-001", callID: "call-string-args" },
        { args: JSON.stringify({ path: "src/migrate.ts" }) },
      )).resolves.toBeUndefined()

      await expect(hooks["tool.execute.before"]!(
        { tool: "edit", sessionID: "session-builder-001", callID: "call-rejected" },
        { args: { path: "src/extra.ts" } },
      )).rejects.toThrow("PLAN_SCOPE_VIOLATION")
    } finally {
      await fs.rm(project, { recursive: true, force: true })
    }
  })

  test("uses workflow productRoot for product write permission paths", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-plugin-module-"))
    try {
      const productRoot = path.join(project, "product")
      const hooks = await createHooks(project)
      await enterBuilding(hooks, { productRoot })

      await expect(hooks["tool.execute.before"]!(
        { tool: "edit", sessionID: "session-builder-001", callID: "call-product-root" },
        { args: { path: path.join(productRoot, "src", "migrate.ts") } },
      )).resolves.toBeUndefined()
    } finally {
      await fs.rm(project, { recursive: true, force: true })
    }
  })

  test("allows tool execution when permission hook input shape fails", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-plugin-module-"))
    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = ((message?: unknown) => {
      warnings.push(String(message))
    }) as typeof console.warn
    try {
      const hooks = await createHooks(project)

      await expect(hooks["tool.execute.before"]!(
        { tool: "edit", sessionID: "session-missing-workflow", callID: "call-engine-error" },
        undefined as never,
      )).resolves.toBeUndefined()

      expect(warnings[0]).toContain("[CausaForge] Permission engine error for edit, allowing:")
    } finally {
      console.warn = originalWarn
      await fs.rm(project, { recursive: true, force: true })
    }
  })
})

async function createHooks(project: string) {
  return createPluginModule().server({
    directory: project,
    worktree: project,
    project: {},
    client: {},
    serverUrl: new URL("http://127.0.0.1:4096"),
    experimental_workspace: { register() {} },
    $: {},
  } as never)
}

async function enterBuilding(
  hooks: Awaited<ReturnType<typeof createHooks>>,
  roots: { productRoot?: string } = {},
) {
  await callTool(hooks, "workflow_start", {
    workflowId: "wf-001",
    entryMode: "problem-description",
    now: timestamp,
    ...roots,
  })
  await callTool(hooks, "workflow_record_artifact", {
    workflowId: "wf-001",
    agentId: "root-cause-analyst",
    artifactKind: "root-cause",
    artifact: rootCause,
  })
  await callTool(hooks, "workflow_transition", {
    workflowId: "wf-001",
    expectedPhase: "root_cause",
    targetPhase: "planning",
    requestedByAgent: "root-cause-analyst",
    sessionId: "session-root-cause-001",
    now: timestamp,
  })
  await callTool(hooks, "workflow_record_artifact", {
    workflowId: "wf-001",
    agentId: "patch-planner",
    artifactKind: "patch-plan",
    artifact: patchPlan,
  })
  await callTool(hooks, "workflow_transition", {
    workflowId: "wf-001",
    expectedPhase: "planning",
    targetPhase: "building",
    requestedByAgent: "patch-planner",
    sessionId: "session-planner-001",
    now: timestamp,
  })
}

async function callTool(hooks: Awaited<ReturnType<typeof createHooks>>, name: string, input: unknown) {
  const tool = hooks.tool?.[name]
  if (!tool) throw new Error(`Missing tool: ${name}`)
  const result = await tool.execute({ input } as never, {
    sessionID: "session-test-001",
    messageID: "message-test-001",
    agent: "workflow-orchestrator",
    directory: "",
    worktree: "",
    abort: new AbortController().signal,
    metadata() {},
    ask() {
      throw new Error("ask not expected")
    },
  })
  return JSON.parse(typeof result === "string" ? result : result.output)
}
