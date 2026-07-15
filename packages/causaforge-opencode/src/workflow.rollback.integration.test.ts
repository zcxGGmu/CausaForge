import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { getWorkflowDir } from "@causaforge/core"
import {
  createHarness,
  finalTimestamp,
  implementationPatch,
  makeArtifactChain,
  nextTimestamp,
  stateIn,
} from "./workflow.integration-fixtures"

describe("workflow rollback integration", () => {
  test("returns from failed verification to building", async () => {
    const { plugin, store } = await createHarness()
    const { rootCause, patchPlan, patchCandidate, verification } = makeArtifactChain()
    const failedVerification = {
      ...verification,
      artifactId: "verification-failed-001",
      commands: [{ command: "bun test src/migrate.test.ts", exitCode: 1 }],
      checks: [{ name: "migration unit tests", required: true, status: "fail" as const, evidence: "1 failed." }],
      criteria: [{ criterionId: "criterion-001", status: "fail" as const, evidence: "Field absent." }],
      status: "fail" as const,
    }

    await store.initializeWorkflow(stateIn("verifying", {
      rootCauseArtifactId: rootCause.artifactId,
      patchPlanArtifactId: patchPlan.artifactId,
      patchCandidateArtifactId: patchCandidate.artifactId,
      verificationArtifactId: failedVerification.artifactId,
    }))
    await store.writeArtifact("wf-001", "root-cause", rootCause)
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)
    await store.writeArtifact("wf-001", "patch-candidate", patchCandidate)
    await store.writeArtifact("wf-001", "verification", failedVerification)

    await expect(plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "verifying",
      targetPhase: "reviewing",
      requestedByAgent: "regression-verifier",
      sessionId: "session-reviewer-001",
      artifacts: { rootCause, patchPlan, patchCandidate, verification: failedVerification },
      now: nextTimestamp,
    })).rejects.toThrow("VERIFICATION_FAILED")

    const returned = await plugin.tools.workflow_return_to_phase.execute({
      workflowId: "wf-001",
      targetPhase: "building",
      requestedByAgent: "regression-verifier",
      sessionId: "session-verifier-001",
      now: nextTimestamp,
    })

    expect(returned).toMatchObject({ phase: "building", status: "active" })
  })

  test("review blocking returns to building and requires a new verification pass", async () => {
    const { plugin, store } = await createHarness()
    const { rootCause, patchPlan, patchCandidate, verification, review } = makeArtifactChain()
    const blockingReview = {
      ...review,
      artifactId: "review-blocked-001",
      findings: [{ severity: "blocking" as const, summary: "The fix misses the root cause." }],
      rootCauseEliminated: false,
      status: "fail" as const,
    }
    const patchedCandidate = {
      ...patchCandidate,
      artifactId: "patch-candidate-002",
      implementationNotes: ["Reworked the patch after review."],
    }
    const rerunVerification = {
      ...verification,
      artifactId: "verification-002",
      patchCandidateArtifactId: patchedCandidate.artifactId,
      commands: [{ command: "bun test src/migrate.test.ts --rerun", exitCode: 0 }],
    }

    await store.initializeWorkflow(stateIn("reviewing", {
      rootCauseArtifactId: rootCause.artifactId,
      patchPlanArtifactId: patchPlan.artifactId,
      patchCandidateArtifactId: patchCandidate.artifactId,
      verificationArtifactId: verification.artifactId,
      reviewArtifactId: blockingReview.artifactId,
    }))
    await store.writeArtifact("wf-001", "root-cause", rootCause)
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)
    await store.writeArtifact("wf-001", "patch-candidate", patchCandidate)
    await store.writeArtifact("wf-001", "verification", verification)
    await store.writeArtifact("wf-001", "review", blockingReview)

    await expect(plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "reviewing",
      targetPhase: "delivering",
      requestedByAgent: "patch-reviewer",
      sessionId: "session-reviewer-001",
      artifacts: { rootCause, patchPlan, patchCandidate, verification, review: blockingReview },
      now: nextTimestamp,
    })).rejects.toThrow("REVIEW_BLOCKED")

    await plugin.tools.workflow_return_to_phase.execute({
      workflowId: "wf-001",
      targetPhase: "building",
      requestedByAgent: "patch-reviewer",
      sessionId: "session-reviewer-001",
      now: nextTimestamp,
    })

    await expect(plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "building",
      targetPhase: "reviewing",
      requestedByAgent: "patch-builder",
      sessionId: "session-builder-001",
      now: nextTimestamp,
    })).rejects.toThrow("INVALID_TRANSITION")

    await store.writeArtifact("wf-001", "patch-candidate", patchedCandidate)
    await plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "building",
      targetPhase: "verifying",
      requestedByAgent: "patch-builder",
      sessionId: "session-builder-002",
      artifacts: { rootCause, patchPlan, patchCandidate: patchedCandidate },
      now: nextTimestamp,
    })
    await store.writeArtifact("wf-001", "verification", rerunVerification)
    const reviewed = await plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "verifying",
      targetPhase: "reviewing",
      requestedByAgent: "regression-verifier",
      sessionId: "session-reviewer-002",
      artifacts: { rootCause, patchPlan, patchCandidate: patchedCandidate, verification: rerunVerification },
      now: finalTimestamp,
    })

    expect(reviewed).toMatchObject({
      phase: "reviewing",
      builderSessionId: "session-builder-002",
      reviewerSessionId: "session-reviewer-002",
      artifactRefs: {
        patchCandidateArtifactId: "patch-candidate-002",
        verificationArtifactId: "verification-002",
      },
    })
  })

  test("rejects completion when delivery patch differs from implementation patch", async () => {
    const { baseDir, plugin, store } = await createHarness()
    const { rootCause, patchPlan, patchCandidate, verification, review, delivery } = makeArtifactChain()

    await store.initializeWorkflow(stateIn("delivering", {
      rootCauseArtifactId: rootCause.artifactId,
      patchPlanArtifactId: patchPlan.artifactId,
      patchCandidateArtifactId: patchCandidate.artifactId,
      verificationArtifactId: verification.artifactId,
      reviewArtifactId: review.artifactId,
      deliveryArtifactId: delivery.artifactId,
    }))
    await store.writeArtifact("wf-001", "root-cause", rootCause)
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)
    await store.writeArtifact("wf-001", "patch-candidate", patchCandidate)
    await store.writeArtifact("wf-001", "verification", verification)
    await store.writeArtifact("wf-001", "review", review)
    await store.writeArtifact("wf-001", "delivery", delivery)
    const workflowDir = getWorkflowDir(baseDir, "wf-001")
    await fs.mkdir(path.join(workflowDir, "implementation"), { recursive: true })
    await fs.mkdir(path.join(workflowDir, "delivery"), { recursive: true })
    await fs.writeFile(path.join(workflowDir, "implementation", "patch.diff"), implementationPatch)
    await fs.writeFile(path.join(workflowDir, "delivery", "patch.diff"), "diff --git a/src/other.ts b/src/other.ts\n")

    await expect(plugin.tools.workflow_complete.execute({
      workflowId: "wf-001",
      requestedByAgent: "delivery-coordinator",
      sessionId: "session-delivery-001",
      artifacts: { rootCause, patchPlan, patchCandidate, verification, review, delivery },
      implementationPatchContent: implementationPatch,
      deliveryPatchContent: implementationPatch,
      now: finalTimestamp,
    })).rejects.toThrow("DELIVERY_INCOMPLETE")

    expect(await store.readWorkflow("wf-001")).toMatchObject({ phase: "delivering", status: "active" })
  })

  test("rejects completion when real patch files are missing", async () => {
    const { baseDir, plugin, store } = await createHarness()
    const { rootCause, patchPlan, patchCandidate, verification, review, delivery } = makeArtifactChain()

    await store.initializeWorkflow(stateIn("delivering", {
      rootCauseArtifactId: rootCause.artifactId,
      patchPlanArtifactId: patchPlan.artifactId,
      patchCandidateArtifactId: patchCandidate.artifactId,
      verificationArtifactId: verification.artifactId,
      reviewArtifactId: review.artifactId,
      deliveryArtifactId: delivery.artifactId,
    }))
    await store.writeArtifact("wf-001", "root-cause", rootCause)
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)
    await store.writeArtifact("wf-001", "patch-candidate", patchCandidate)
    await store.writeArtifact("wf-001", "verification", verification)
    await store.writeArtifact("wf-001", "review", review)
    await store.writeArtifact("wf-001", "delivery", delivery)
    const workflowDir = getWorkflowDir(baseDir, "wf-001")
    await fs.mkdir(path.join(workflowDir, "implementation"), { recursive: true })
    await fs.writeFile(path.join(workflowDir, "implementation", "patch.diff"), implementationPatch)

    await expect(plugin.tools.workflow_complete.execute({
      workflowId: "wf-001",
      requestedByAgent: "delivery-coordinator",
      sessionId: "session-delivery-001",
      implementationPatchContent: implementationPatch,
      deliveryPatchContent: implementationPatch,
      now: finalTimestamp,
    })).rejects.toThrow("DELIVERY_INCOMPLETE")

    expect(await store.readWorkflow("wf-001")).toMatchObject({ phase: "delivering", status: "active" })
  })

  test("rejects spoofed transition artifacts that were not recorded in the artifact store", async () => {
    const { plugin, store } = await createHarness()
    const { rootCause, patchPlan } = makeArtifactChain()

    await store.initializeWorkflow(stateIn("planning", {
      rootCauseArtifactId: rootCause.artifactId,
    }))
    await store.writeArtifact("wf-001", "root-cause", rootCause)

    await expect(plugin.tools.workflow_transition.execute({
      workflowId: "wf-001",
      expectedPhase: "planning",
      targetPhase: "building",
      requestedByAgent: "patch-planner",
      sessionId: "session-planner-001",
      artifacts: { rootCause, patchPlan },
      now: nextTimestamp,
    })).rejects.toThrow("MISSING_ARTIFACT")
  })
})
