import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { createWorkflowArtifactStore, getArtifactPath, getWorkflowDir } from "@causaforge/core"
import { parseWorkflowConfig } from "../config/schema"
import { createWorkflowTools } from "./index"

const timestamp = "2026-07-13T00:00:00.000Z"

const rootCause = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "root-cause-001",
  createdAt: timestamp,
  problemSummary: "Build fails after configuration migration.",
  reproductionEvidence: ["Run bun test and observe the failing migration test."],
  observedBehavior: "The migrated configuration omits the required field.",
  expectedBehavior: "The migrated configuration preserves the required field.",
  rootCauseSummary: "The migration drops the field during normalization.",
  causalChain: ["Migration reads the legacy value.", "Normalization discards the value."],
  affectedLocations: ["src/migrate.ts"],
  constraints: ["Preserve backward compatibility."],
  verificationCriteria: [
    { criterionId: "criterion-001", description: "The migrated field is preserved.", required: true },
  ],
  status: "confirmed" as const,
}

const patchPlan = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "patch-plan-001",
  createdAt: timestamp,
  rootCauseArtifactId: rootCause.artifactId,
  objectives: ["Preserve the migrated field."],
  fileChanges: [
    { path: "src/migrate.ts", change: "Carry the legacy value forward.", rootCauseLinks: ["criterion-001"] },
  ],
  nonGoals: [],
  verificationPlan: ["Run migration tests."],
  risks: [],
  status: "approved" as const,
}

describe("workflow tools", () => {
  test("registers the deterministic workflow tool surface", async () => {
    const { tools } = await makeTools()

    expect(Object.keys(tools)).toEqual([
      "workflow_start",
      "workflow_status",
      "workflow_record_artifact",
      "workflow_validate_artifact",
      "workflow_capture_diff",
      "workflow_transition",
      "workflow_return_to_phase",
      "workflow_complete",
    ])
  })

  test("starts a workflow and reports status", async () => {
    const { tools } = await makeTools()

    await tools.workflow_start.execute({
      workflowId: "wf-001",
      entryMode: "problem-description",
      now: timestamp,
    })

    const status = await tools.workflow_status.execute({ workflowId: "wf-001" })

    expect(status).toMatchObject({ workflowId: "wf-001", phase: "root_cause", missing: ["root-cause"] })
  })

  test("records artifacts only when the agent owns that artifact kind", async () => {
    const { baseDir, tools } = await makeTools()
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    await expect(tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "patch-planner",
      artifactKind: "patch-candidate",
      artifact: patchPlan,
    })).rejects.toThrow("UNAUTHORIZED_AGENT")

    const result = await tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "root-cause-analyst",
      artifactKind: "root-cause",
      artifact: rootCause,
    })

    expect(result).toMatchObject({ artifactPath: getArtifactPath(baseDir, "wf-001", "root-cause") })
    expect(result.markdownPath).toBe(path.join(getWorkflowDir(baseDir, "wf-001"), "root-cause", "root-cause.md"))
    expect(await fs.readFile(result.markdownPath!, "utf8")).toContain("root-cause-001")
  })

  test("rejects path traversal workflow IDs", async () => {
    const { tools } = await makeTools()

    await expect(tools.workflow_start.execute({
      workflowId: "../escape",
      entryMode: "problem-description",
      now: timestamp,
    })).rejects.toThrow("Invalid workflow ID")
  })

  test("captures git diff through the injected runner", async () => {
    const { baseDir, gitCalls, tools } = await makeTools({
      gitResult: {
        exitCode: 0,
        stdout: "diff --git a/src/migrate.ts b/src/migrate.ts\nindex 111..222 100644\n",
        stderr: "",
      },
    })
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    const result = await tools.workflow_capture_diff.execute({ workflowId: "wf-001" })

    expect(gitCalls).toEqual([["diff", "--binary", "--no-ext-diff"]])
    expect(result.changedFiles).toEqual(["src/migrate.ts"])
    expect(await fs.readFile(path.join(getWorkflowDir(baseDir, "wf-001"), "implementation", "patch.diff"), "utf8"))
      .toContain("diff --git")
  })


  test("return to phase rejects terminal or forward targets", async () => {
    const { tools } = await makeTools()
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    await expect(tools.workflow_return_to_phase.execute({
      workflowId: "wf-001",
      targetPhase: "blocked",
      requestedByAgent: "workflow-orchestrator",
      sessionId: "session-001",
      now: timestamp,
    })).rejects.toThrow("workflow_return_to_phase requires an earlier non-terminal phase")
  })

  test("fails capture when git fails or diff is empty", async () => {
    const failed = await makeTools({ gitResult: { exitCode: 1, stdout: "", stderr: "fatal" } })
    await expect(failed.tools.workflow_capture_diff.execute({ workflowId: "wf-001" })).rejects.toThrow("Git diff failed")

    const empty = await makeTools({ gitResult: { exitCode: 0, stdout: "", stderr: "" } })
    await expect(empty.tools.workflow_capture_diff.execute({ workflowId: "wf-001" })).rejects.toThrow("No diff captured")
  })
})

async function makeTools(options: { gitResult?: { exitCode: number; stdout: string; stderr: string } } = {}) {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-opencode-tools-"))
  const store = createWorkflowArtifactStore(baseDir)
  const gitCalls: string[][] = []
  const tools = createWorkflowTools({
    cwd: baseDir,
    config: parseWorkflowConfig({}),
    store,
    git: {
      async run(args: string[]) {
        gitCalls.push(args)
        return options.gitResult ?? { exitCode: 0, stdout: "", stderr: "" }
      },
    },
  })
  return { baseDir, gitCalls, store, tools }
}
