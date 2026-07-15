import { describe, expect, test } from "bun:test"
import { evaluateTransitionGuard } from "./transition-guard"
import type { WorkflowState } from "../schemas"
import type { WorkflowPhase } from "../types"

const timestamp = "2026-07-13T00:00:00.000Z"
const nextTimestamp = "2026-07-13T00:05:00.000Z"

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
    {
      path: "src/migrate.ts",
      change: "Carry the legacy value into the normalized configuration.",
      rootCauseLinks: ["criterion-001"],
    },
  ],
  nonGoals: ["Redesign the configuration format."],
  verificationPlan: ["Run the migration unit tests."],
  risks: [],
  status: "approved" as const,
}

const patchCandidate = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "patch-candidate-001",
  createdAt: timestamp,
  patchPlanArtifactId: patchPlan.artifactId,
  modifiedFiles: ["src/migrate.ts"],
  patchPath: "implementation/patch.diff",
  patchSummary: "Preserve the migrated field.",
  planDeviations: [],
  implementationNotes: ["Copied the legacy value through normalization."],
  status: "ready_for_verification" as const,
}

const passingVerification = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "verification-001",
  createdAt: timestamp,
  patchCandidateArtifactId: patchCandidate.artifactId,
  commands: [{ command: "bun test src/migrate.test.ts", exitCode: 0 }],
  checks: [{ name: "migration unit tests", required: true, status: "pass" as const, evidence: "12 tests passed." }],
  criteria: [{ criterionId: "criterion-001", status: "pass" as const, evidence: "Field preserved." }],
  omissions: [],
  residualRisks: [],
  status: "pass" as const,
}

const review = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "review-001",
  createdAt: timestamp,
  patchCandidateArtifactId: patchCandidate.artifactId,
  verificationArtifactId: passingVerification.artifactId,
  reviewerSessionId: "session-reviewer-001",
  findings: [],
  rootCauseEliminated: true,
  withinApprovedScope: true,
  verificationSufficient: true,
  status: "pass" as const,
}

const delivery = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "delivery-001",
  createdAt: timestamp,
  rootCauseArtifactId: rootCause.artifactId,
  patchPlanArtifactId: patchPlan.artifactId,
  patchCandidateArtifactId: patchCandidate.artifactId,
  verificationArtifactId: passingVerification.artifactId,
  reviewArtifactId: review.artifactId,
  fixSummary: "The migration now preserves the legacy field.",
  verificationSummary: "Migration tests pass.",
  reviewSummary: "Independent review found no blocking issues.",
  residualRisks: [],
  handoffInstructions: ["Apply delivery/patch.diff."],
  patchPath: "delivery/patch.diff",
  status: "complete" as const,
}

describe("workflow transition guard", () => {
  test("rejects root cause to planning without a root cause artifact", () => {
    const result = evaluateTransitionGuard({
      state: stateIn("root_cause"),
      request: request("root_cause", "planning"),
      artifacts: {},
      now: nextTimestamp,
    })

    expect(result).toMatchObject({ ok: false, error: { code: "MISSING_ARTIFACT" } })
  })

  test("rejects patch plans that reference the wrong root cause artifact", () => {
    const result = evaluateTransitionGuard({
      state: stateIn("planning", { rootCauseArtifactId: rootCause.artifactId }),
      request: request("planning", "building"),
      artifacts: {
        rootCause,
        patchPlan: { ...patchPlan, rootCauseArtifactId: "root-cause-other" },
      },
      now: nextTimestamp,
    })

    expect(result).toMatchObject({ ok: false, error: { code: "ARTIFACT_REFERENCE_MISMATCH" } })
  })

  test("rejects modified files outside the approved plan when deviations are disabled", () => {
    const result = evaluateTransitionGuard({
      state: stateIn("building", {
        rootCauseArtifactId: rootCause.artifactId,
        patchPlanArtifactId: patchPlan.artifactId,
      }),
      request: request("building", "verifying", "session-builder-001"),
      artifacts: {
        rootCause,
        patchPlan,
        patchCandidate: { ...patchCandidate, modifiedFiles: ["src/migrate.ts", "src/extra.ts"] },
      },
      allowPlanDeviation: false,
      now: nextTimestamp,
    })

    expect(result).toMatchObject({ ok: false, error: { code: "PLAN_SCOPE_VIOLATION" } })
  })

  test("rejects reviewer sessions that match the builder session", () => {
    const result = evaluateTransitionGuard({
      state: stateIn(
        "verifying",
        {
          rootCauseArtifactId: rootCause.artifactId,
          patchPlanArtifactId: patchPlan.artifactId,
          patchCandidateArtifactId: patchCandidate.artifactId,
          verificationArtifactId: passingVerification.artifactId,
        },
        "session-same",
      ),
      request: request("verifying", "reviewing", "session-same"),
      artifacts: { rootCause, patchPlan, patchCandidate, verification: passingVerification },
      now: nextTimestamp,
    })

    expect(result).toMatchObject({ ok: false, error: { code: "SESSION_INDEPENDENCE_VIOLATION" } })
  })

  test("rejects reviewing when verification did not pass", () => {
    const result = evaluateTransitionGuard({
      state: stateIn(
        "verifying",
        {
          rootCauseArtifactId: rootCause.artifactId,
          patchPlanArtifactId: patchPlan.artifactId,
          patchCandidateArtifactId: patchCandidate.artifactId,
          verificationArtifactId: "verification-failed-001",
        },
        "session-builder-001",
      ),
      request: request("verifying", "reviewing", "session-reviewer-001"),
      artifacts: {
        rootCause,
        patchPlan,
        patchCandidate,
        verification: {
          ...passingVerification,
          artifactId: "verification-failed-001",
          commands: [{ command: "bun test src/migrate.test.ts", exitCode: 1 }],
          checks: [{ name: "migration unit tests", required: true, status: "fail" as const, evidence: "1 failed." }],
          criteria: [{ criterionId: "criterion-001", status: "fail" as const, evidence: "Field absent." }],
          status: "fail" as const,
        },
      },
      now: nextTimestamp,
    })

    expect(result).toMatchObject({ ok: false, error: { code: "VERIFICATION_FAILED" } })
  })

  test("rejects completion when delivery patch content differs from implementation patch content", () => {
    const result = evaluateTransitionGuard({
      state: stateIn("delivering", {
        rootCauseArtifactId: rootCause.artifactId,
        patchPlanArtifactId: patchPlan.artifactId,
        patchCandidateArtifactId: patchCandidate.artifactId,
        verificationArtifactId: passingVerification.artifactId,
        reviewArtifactId: review.artifactId,
        deliveryArtifactId: delivery.artifactId,
      }),
      request: request("delivering", "completed", "session-delivery-001"),
      artifacts: { rootCause, patchPlan, patchCandidate, verification: passingVerification, review, delivery },
      implementationPatchContent: "diff --git a/src/migrate.ts b/src/migrate.ts",
      deliveryPatchContent: "diff --git a/src/other.ts b/src/other.ts",
      now: nextTimestamp,
    })

    expect(result).toMatchObject({ ok: false, error: { code: "DELIVERY_INCOMPLETE" } })
  })

  test("rejects completion when patch contents are missing", () => {
    const result = evaluateTransitionGuard({
      state: stateIn("delivering", {
        rootCauseArtifactId: rootCause.artifactId,
        patchPlanArtifactId: patchPlan.artifactId,
        patchCandidateArtifactId: patchCandidate.artifactId,
        verificationArtifactId: passingVerification.artifactId,
        reviewArtifactId: review.artifactId,
        deliveryArtifactId: delivery.artifactId,
      }),
      request: request("delivering", "completed", "session-delivery-001"),
      artifacts: { rootCause, patchPlan, patchCandidate, verification: passingVerification, review, delivery },
      now: nextTimestamp,
    })

    expect(result).toMatchObject({ ok: false, error: { code: "DELIVERY_INCOMPLETE" } })
  })

  test("returns the next workflow state when completion gates pass", () => {
    const result = evaluateTransitionGuard({
      state: stateIn("delivering", {
        rootCauseArtifactId: rootCause.artifactId,
        patchPlanArtifactId: patchPlan.artifactId,
        patchCandidateArtifactId: patchCandidate.artifactId,
        verificationArtifactId: passingVerification.artifactId,
        reviewArtifactId: review.artifactId,
        deliveryArtifactId: delivery.artifactId,
      }),
      request: request("delivering", "completed", "session-delivery-001"),
      artifacts: { rootCause, patchPlan, patchCandidate, verification: passingVerification, review, delivery },
      implementationPatchContent: "diff --git a/src/migrate.ts b/src/migrate.ts",
      deliveryPatchContent: "diff --git a/src/migrate.ts b/src/migrate.ts",
      now: nextTimestamp,
    })

    expect(result).toMatchObject({
      ok: true,
      nextState: {
        phase: "completed",
        status: "completed",
        completedAt: nextTimestamp,
        updatedAt: nextTimestamp,
      },
    })
  })
})

function stateIn(
  phase: WorkflowPhase,
  artifactRefs: WorkflowState["artifactRefs"] = {},
  builderSessionId: string | null = null,
): WorkflowState {
  return {
    schemaVersion: "1.0",
    workflowId: "wf-001",
    phase,
    status: "active",
    entryMode: "problem-description",
    artifactRefs,
    builderSessionId,
    reviewerSessionId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  }
}

function request(expectedPhase: WorkflowPhase, targetPhase: WorkflowPhase, sessionId = "session-001") {
  return {
    workflowId: "wf-001",
    expectedPhase,
    targetPhase,
    requestedByAgent: "workflow-orchestrator" as const,
    sessionId,
  }
}
