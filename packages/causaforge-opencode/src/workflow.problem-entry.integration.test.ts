import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { getWorkflowDir } from "@causaforge/core"
import {
  createHarness,
  finalTimestamp,
  makeArtifactChain,
  nextTimestamp,
  timestamp,
} from "./workflow.integration-fixtures"

describe("workflow problem-description entry integration", () => {
  test("drives a complete problem-description workflow through delivery", async () => {
    const { baseDir, plugin, store } = await createHarness()
    const { rootCause, patchPlan, patchCandidate, verification, review, delivery } = makeArtifactChain()

    const started = await plugin.tools.workflow_start.execute({
      workflowId: "wf-001",
      entryMode: "problem-description",
      now: timestamp,
    })
    expect(started.phase).toBe("root_cause")

    await plugin.tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "root-cause-analyst",
      artifactKind: "root-cause",
      artifact: rootCause,
    })
    await plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "root_cause",
      targetPhase: "planning",
      requestedByAgent: "root-cause-analyst",
      sessionId: "session-root-cause-001",
      now: nextTimestamp,
    })

    await plugin.tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "patch-planner",
      artifactKind: "patch-plan",
      artifact: patchPlan,
    })
    await plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "planning",
      targetPhase: "building",
      requestedByAgent: "patch-planner",
      sessionId: "session-planner-001",
      now: nextTimestamp,
    })

    const diff = await plugin.tools.workflow_capture_diff.execute({ workflowId: "wf-001" })
    expect(diff.changedFiles).toEqual(["src/migrate.ts"])
    await plugin.tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "patch-builder",
      artifactKind: "patch-candidate",
      artifact: patchCandidate,
    })
    await plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "building",
      targetPhase: "verifying",
      requestedByAgent: "patch-builder",
      sessionId: "session-builder-001",
      now: nextTimestamp,
    })

    await plugin.tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "regression-verifier",
      artifactKind: "verification",
      artifact: verification,
    })
    await plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "verifying",
      targetPhase: "reviewing",
      requestedByAgent: "regression-verifier",
      sessionId: "session-reviewer-001",
      now: nextTimestamp,
    })

    await plugin.tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "patch-reviewer",
      artifactKind: "review",
      artifact: review,
    })
    await plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "reviewing",
      targetPhase: "delivering",
      requestedByAgent: "patch-reviewer",
      sessionId: "session-reviewer-001",
      now: nextTimestamp,
    })

    await plugin.tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "delivery-coordinator",
      artifactKind: "delivery",
      artifact: delivery,
    })
    const workflowDir = getWorkflowDir(baseDir, "wf-001")
    await fs.mkdir(path.join(workflowDir, "delivery"), { recursive: true })
    await fs.writeFile(path.join(workflowDir, "delivery", "patch.diff"), await fs.readFile(path.join(workflowDir, "implementation", "patch.diff"), "utf8"))
    const completed = await plugin.tools.workflow_complete.execute({
      workflowId: "wf-001",
      requestedByAgent: "delivery-coordinator",
      sessionId: "session-delivery-001",
      now: finalTimestamp,
    })

    expect(completed).toMatchObject({
      phase: "completed",
      status: "completed",
      completedAt: finalTimestamp,
      artifactRefs: {
        rootCauseArtifactId: "root-cause-001",
        patchPlanArtifactId: "patch-plan-001",
        patchCandidateArtifactId: "patch-candidate-001",
        verificationArtifactId: "verification-001",
        reviewArtifactId: "review-001",
        deliveryArtifactId: "delivery-001",
      },
      builderSessionId: "session-builder-001",
      reviewerSessionId: "session-reviewer-001",
    })
    const storedDelivery = await store.readArtifact<typeof delivery>("wf-001", "delivery")
    expect(storedDelivery).toEqual(delivery)
  })
})
