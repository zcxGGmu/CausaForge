import { describe, expect, test } from "bun:test"
import { createHarness, makeArtifactChain, timestamp } from "./workflow.integration-fixtures"

describe("workflow root-cause-import entry integration", () => {
  test("accepts a valid imported root cause and starts directly in planning", async () => {
    const { plugin } = await createHarness()
    const { rootCause } = makeArtifactChain("wf-import-001")

    expect(await plugin.tools.workflow_validate_artifact.execute({
      artifactKind: "root-cause",
      artifact: rootCause,
    })).toEqual({ ok: true, artifactId: "root-cause-001", workflowId: "wf-import-001" })

    await plugin.tools.workflow_record_artifact.execute({
      workflowId: "wf-import-001",
      agentId: "root-cause-analyst",
      artifactKind: "root-cause",
      artifact: rootCause,
    })
    const started = await plugin.tools.workflow_start.execute({
      workflowId: "wf-import-001",
      entryMode: "root-cause-import",
      rootCauseArtifactId: rootCause.artifactId,
      now: timestamp,
    })
    const status = await plugin.tools.workflow_status.execute({ workflowId: "wf-import-001" })

    expect(started).toMatchObject({
      phase: "planning",
      entryMode: "root-cause-artifact",
      artifactRefs: { rootCauseArtifactId: rootCause.artifactId },
    })
    expect(status).toEqual({
      workflowId: "wf-import-001",
      phase: "planning",
      status: "active",
      missing: ["patch-plan"],
    })
  })

  test("keeps root-cause import in intake when the imported report is missing or invalid", async () => {
    const { plugin, store } = await createHarness()
    const { rootCause } = makeArtifactChain("wf-import-invalid")
    const invalidRootCause = { ...rootCause, rootCauseSummary: "" }

    expect(await plugin.tools.workflow_validate_artifact.execute({
      artifactKind: "root-cause",
      artifact: invalidRootCause,
    })).toMatchObject({ ok: false })

    const started = await plugin.tools.workflow_start.execute({
      workflowId: "wf-import-invalid",
      entryMode: "root-cause-import",
      now: timestamp,
    })

    expect(started).toMatchObject({
      phase: "intake",
      entryMode: "root-cause-artifact",
      artifactRefs: {},
    })
    expect(await store.readWorkflow("wf-import-invalid")).toMatchObject({ phase: "intake", artifactRefs: {} })
  })
})
