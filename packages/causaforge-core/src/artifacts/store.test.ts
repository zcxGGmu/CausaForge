import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { createWorkflowArtifactStore, getArtifactPath, getWorkflowDir } from "./index"

const timestamp = "2026-07-13T00:00:00.000Z"

const workflowState = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  phase: "planning" as const,
  status: "active" as const,
  entryMode: "problem-description" as const,
  artifactRefs: { rootCauseArtifactId: "root-cause-001" },
  builderSessionId: null,
  reviewerSessionId: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: null,
}

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

describe("workflow artifact store", () => {
  test("keeps workflow paths inside the artifact root", async () => {
    const baseDir = await makeTempDir()

    expect(getWorkflowDir(baseDir, "wf-001")).toBe(path.join(baseDir, ".workflow", "wf-001"))
    expect(getArtifactPath(baseDir, "wf-001", "root-cause")).toBe(
      path.join(baseDir, ".workflow", "wf-001", "root-cause", "root-cause.json"),
    )
    expect(() => getWorkflowDir(baseDir, "../escape")).toThrow("Invalid workflow ID")
  })

  test("writes workflow state and validated artifacts atomically", async () => {
    const baseDir = await makeTempDir()
    const store = createWorkflowArtifactStore(baseDir)

    await store.initializeWorkflow(workflowState)
    expect(await store.readWorkflow(workflowState.workflowId)).toEqual(workflowState)

    const artifactPath = await store.writeArtifact(workflowState.workflowId, "root-cause", rootCause)
    expect(artifactPath).toBe(getArtifactPath(baseDir, workflowState.workflowId, "root-cause"))
    expect(await store.artifactExists(workflowState.workflowId, "root-cause")).toBe(true)
    const storedRootCause = await store.readArtifact<typeof rootCause>(workflowState.workflowId, "root-cause")
    expect(storedRootCause).toEqual(rootCause)

    const workflowDirEntries = await fs.readdir(path.dirname(artifactPath))
    expect(workflowDirEntries.some((entry) => entry.endsWith(".tmp"))).toBe(false)
  })

  test("lists persisted workflow states for lifecycle hooks", async () => {
    const baseDir = await makeTempDir()
    const store = createWorkflowArtifactStore(baseDir)

    await store.initializeWorkflow(workflowState)
    await store.initializeWorkflow({ ...workflowState, workflowId: "wf-002", phase: "building" })

    expect(await store.listWorkflows()).toEqual([
      workflowState,
      { ...workflowState, workflowId: "wf-002", phase: "building" },
    ])
  })

  test("rejects artifacts that do not match their schema", async () => {
    const baseDir = await makeTempDir()
    const store = createWorkflowArtifactStore(baseDir)

    await expect(store.writeArtifact(workflowState.workflowId, "root-cause", { ...rootCause, status: "draft" }))
      .rejects.toThrow()
  })

  test("rejects artifacts whose workflow ID does not match the target workflow", async () => {
    const baseDir = await makeTempDir()
    const store = createWorkflowArtifactStore(baseDir)

    await expect(store.writeArtifact(workflowState.workflowId, "root-cause", { ...rootCause, workflowId: "wf-002" }))
      .rejects.toThrow("does not match target workflow")

    const artifactPath = getArtifactPath(baseDir, workflowState.workflowId, "root-cause")
    await fs.mkdir(path.dirname(artifactPath), { recursive: true })
    await fs.writeFile(artifactPath, `${JSON.stringify({ ...rootCause, workflowId: "wf-002" }, null, 2)}\n`)

    await expect(store.readArtifact(workflowState.workflowId, "root-cause"))
      .rejects.toThrow("does not match target workflow")
  })
})

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "causaforge-core-store-"))
}
