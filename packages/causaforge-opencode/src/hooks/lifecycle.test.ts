import { describe, expect, test } from "bun:test"
import { createWorkflowArtifactStore } from "@causaforge/core"
import { createCompactionSnapshot, restoreCompactionState } from "./compaction-state"
import { recordCommandEvidence } from "./evidence-recorder"
import { evaluateStopGate } from "./stop-gate"

const timestamp = "2026-07-13T00:00:00.000Z"

const activeState = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  phase: "verifying" as const,
  status: "active" as const,
  entryMode: "problem-description" as const,
  artifactRefs: { rootCauseArtifactId: "root-cause-001", patchPlanArtifactId: "patch-plan-001" },
  builderSessionId: "session-builder-001",
  reviewerSessionId: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: null,
}

const completedState = {
  ...activeState,
  phase: "completed" as const,
  status: "completed" as const,
  completedAt: timestamp,
}

describe("workflow lifecycle hooks", () => {
  test("records command results as draft evidence only", () => {
    const evidence = recordCommandEvidence({
      workflowId: "wf-001",
      command: "bun test packages/causaforge-opencode",
      exitCode: 0,
      startedAt: timestamp,
      completedAt: "2026-07-13T00:01:00.000Z",
      outputSummary: "19 tests passed.",
    })

    expect(evidence).toMatchObject({
      workflowId: "wf-001",
      status: "draft",
      verificationStatus: null,
      command: "bun test packages/causaforge-opencode",
      exitCode: 0,
    })
  })

  test("compaction snapshot stores only workflow pointer fields", () => {
    const snapshot = createCompactionSnapshot({
      workflowId: "wf-001",
      phase: "verifying",
      agentRole: "regression-verifier",
    })

    expect(Object.keys(snapshot)).toEqual(["workflowId", "phase", "agentRole"])
  })

  test("compaction restore reads phase from workflow state", async () => {
    const store = createWorkflowArtifactStore(await makeTempDir())
    await store.initializeWorkflow(activeState)

    const restored = await restoreCompactionState(store, {
      workflowId: "wf-001",
      phase: "building",
      agentRole: "regression-verifier",
    })

    expect(restored).toEqual({ workflowId: "wf-001", phase: "verifying", agentRole: "regression-verifier" })
  })

  test("stop gate rejects unfinished workflows with phase and missing gates", () => {
    expect(evaluateStopGate({ state: activeState, missing: ["verification"] })).toEqual({
      allowed: false,
      workflowId: "wf-001",
      phase: "verifying",
      missing: ["verification"],
      message: "Workflow wf-001 is still in verifying; missing gates: verification.",
    })
  })

  test("stop gate allows completed workflows", () => {
    expect(evaluateStopGate({ state: completedState, missing: [] })).toEqual({ allowed: true })
  })
})

async function makeTempDir(): Promise<string> {
  const fs = await import("node:fs/promises")
  const os = await import("node:os")
  const path = await import("node:path")
  return fs.mkdtemp(path.join(os.tmpdir(), "workflow-lifecycle-"))
}
