import { describe, expect, test } from "bun:test"
import {
  renderDeliveryMarkdown,
  renderPatchPlanMarkdown,
  renderReviewMarkdown,
  renderRootCauseMarkdown,
  renderVerificationMarkdown,
} from "./index"

const base = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  createdAt: "2026-07-13T00:00:00.000Z",
}

const rootCause = {
  ...base,
  artifactId: "root-cause-001",
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
  ...base,
  artifactId: "patch-plan-001",
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
  risks: ["Unexpected legacy inputs may require follow-up coverage."],
  status: "approved" as const,
}

const verification = {
  ...base,
  artifactId: "verification-001",
  patchCandidateArtifactId: "patch-candidate-001",
  commands: [{ command: "bun test src/migrate.test.ts", exitCode: 0 }],
  checks: [{ name: "migration unit tests", required: true, status: "pass" as const, evidence: "12 tests passed." }],
  criteria: [{ criterionId: "criterion-001", status: "pass" as const, evidence: "Field preserved." }],
  omissions: [],
  residualRisks: [],
  status: "pass" as const,
}

const review = {
  ...base,
  artifactId: "review-001",
  patchCandidateArtifactId: "patch-candidate-001",
  verificationArtifactId: verification.artifactId,
  reviewerSessionId: "session-reviewer-001",
  findings: [],
  rootCauseEliminated: true,
  withinApprovedScope: true,
  verificationSufficient: true,
  status: "pass" as const,
}

const delivery = {
  ...base,
  artifactId: "delivery-001",
  rootCauseArtifactId: rootCause.artifactId,
  patchPlanArtifactId: patchPlan.artifactId,
  patchCandidateArtifactId: "patch-candidate-001",
  verificationArtifactId: verification.artifactId,
  reviewArtifactId: review.artifactId,
  fixSummary: "The migration now preserves the legacy field.",
  verificationSummary: "Migration tests pass.",
  reviewSummary: "Independent review found no blocking issues.",
  residualRisks: [],
  handoffInstructions: ["Apply delivery/patch.diff."],
  patchPath: "delivery/patch.diff",
  status: "complete" as const,
}

describe("workflow artifact markdown renderers", () => {
  test("renders artifact IDs, status, and core summaries", () => {
    expect(renderRootCauseMarkdown(rootCause)).toContain("root-cause-001")
    expect(renderRootCauseMarkdown(rootCause)).toContain("confirmed")
    expect(renderRootCauseMarkdown(rootCause)).toContain("migration drops the field")

    expect(renderPatchPlanMarkdown(patchPlan)).toContain("patch-plan-001")
    expect(renderPatchPlanMarkdown(patchPlan)).toContain("approved")
    expect(renderPatchPlanMarkdown(patchPlan)).toContain("src/migrate.ts")

    expect(renderVerificationMarkdown(verification)).toContain("verification-001")
    expect(renderVerificationMarkdown(verification)).toContain("pass")
    expect(renderVerificationMarkdown(verification)).toContain("bun test src/migrate.test.ts")

    expect(renderReviewMarkdown(review)).toContain("review-001")
    expect(renderReviewMarkdown(review)).toContain("session-reviewer-001")
    expect(renderReviewMarkdown(review)).toContain("pass")

    expect(renderDeliveryMarkdown(delivery)).toContain("delivery-001")
    expect(renderDeliveryMarkdown(delivery)).toContain("The migration now preserves the legacy field.")
    expect(renderDeliveryMarkdown(delivery)).toContain("complete")
  })

  test("rejects invalid artifact input before rendering", () => {
    expect(() => renderRootCauseMarkdown({ ...rootCause, status: "draft" })).toThrow()
    expect(() => renderPatchPlanMarkdown({ ...patchPlan, fileChanges: [] })).toThrow()
    expect(() => renderVerificationMarkdown({ ...verification, checks: [] })).toThrow()
    expect(() => renderReviewMarkdown({ ...review, rootCauseEliminated: false })).toThrow()
    expect(() => renderDeliveryMarkdown({ ...delivery, rootCauseArtifactId: "" })).toThrow()
  })
})
