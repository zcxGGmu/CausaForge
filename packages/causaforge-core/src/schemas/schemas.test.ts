import { describe, expect, test } from "bun:test"
import {
  DeliveryArtifactSchema,
  PatchCandidateArtifactSchema,
  PatchPlanArtifactSchema,
  ReviewArtifactSchema,
  RootCauseArtifactSchema,
  TestSuiteManifestSchema,
  validateVerificationAgainstRootCause,
  VerificationArtifactSchema,
  VerificationRunArtifactSchema,
  WorkflowStateSchema,
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
    { criterionId: "criterion-002", description: "Migration logs remain readable.", required: false },
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

const patchCandidate = {
  ...base,
  artifactId: "patch-candidate-001",
  patchPlanArtifactId: patchPlan.artifactId,
  modifiedFiles: ["src/migrate.ts"],
  patchPath: "implementation/patch.diff",
  patchSummary: "Preserve the legacy field during normalization.",
  planDeviations: [],
  implementationNotes: ["Added the field to the normalized object."],
  status: "ready_for_verification" as const,
}

const verification = {
  ...base,
  artifactId: "verification-001",
  patchCandidateArtifactId: patchCandidate.artifactId,
  commands: [{ command: "bun test src/migrate.test.ts", exitCode: 0 }],
  checks: [
    { name: "migration unit tests", required: true, status: "pass" as const, evidence: "12 tests passed." },
  ],
  criteria: [
    {
      criterionId: "criterion-001",
      status: "pass" as const,
      evidence: "The regression test preserves the field.",
    },
    {
      criterionId: "criterion-002",
      status: "pass" as const,
      evidence: "The migration log snapshot remains readable.",
    },
  ],
  omissions: [],
  residualRisks: [],
  status: "pass" as const,
}

const testSuiteManifest = {
  suiteId: "migration-suite",
  source: "user" as const,
  runnerId: "local",
  commands: [
    {
      commandId: "migration-tests",
      argv: ["bun", "test", "src/migrate.test.ts"],
      required: true,
      timeoutSeconds: 300,
    },
  ],
}

const verificationRun = {
  ...base,
  artifactId: "verification-run-001",
  iteration: 1,
  patchCandidateArtifactId: patchCandidate.artifactId,
  runner: { runnerId: "local", type: "local" as const, target: "local project checkout" },
  manifest: testSuiteManifest,
  commands: [
    {
      commandId: "migration-tests",
      argv: ["bun", "test", "src/migrate.test.ts"],
      required: true,
      exitCode: 0,
      status: "pass" as const,
      startedAt: base.createdAt,
      completedAt: base.createdAt,
      stdoutPath: "iterations/0001/logs/migration-tests.stdout.txt",
      stderrPath: "iterations/0001/logs/migration-tests.stderr.txt",
    },
  ],
  failureSignature: null,
  status: "pass" as const,
}

const review = {
  ...base,
  artifactId: "review-001",
  patchCandidateArtifactId: patchCandidate.artifactId,
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
  patchCandidateArtifactId: patchCandidate.artifactId,
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

describe("workflow artifact schemas", () => {
  test("accepts minimal valid workflow state and six artifacts", () => {
    const workflowState = {
      schemaVersion: "1.0",
      workflowId: base.workflowId,
      phase: "planning",
      status: "active",
      entryMode: "problem-description",
      artifactRefs: { rootCauseArtifactId: rootCause.artifactId },
      builderSessionId: null,
      reviewerSessionId: null,
      createdAt: base.createdAt,
      updatedAt: base.createdAt,
      completedAt: null,
    }

    expect(WorkflowStateSchema.safeParse(workflowState).success).toBe(true)
    expect(
      WorkflowStateSchema.safeParse({
        ...workflowState,
        repositoryPreparations: [
          {
            softwareName: "redis",
            repositoryUrl: "https://github.com/redis/redis.git",
            commitHash: "4f3c2b1a",
            metadataPath: ".CausaForge/blueprint/redis/metadata.json",
            status: "pending",
          },
        ],
      }).success,
    ).toBe(true)
    expect(
      WorkflowStateSchema.safeParse({
        ...workflowState,
        repositoryPreparations: [
          {
            softwareName: "redis",
            repositoryUrl: "https://github.com/redis/redis.git",
            commitHash: "4f3c2b1a",
            metadataPath: ".CausaForge/blueprint/redis/metadata.json",
            status: "ready",
            mode: "opencode",
            checkoutPath: ".CausaForge/repositories/redis",
            preparedAt: base.createdAt,
          },
        ],
      }).success,
    ).toBe(true)
    const workflowStateWithRoots = WorkflowStateSchema.safeParse({
      ...workflowState,
      gitRoot: "/tmp/causaforge-repo",
      productRoot: "/tmp/causaforge-repo/product",
    })
    expect(workflowStateWithRoots.success).toBe(true)
    if (workflowStateWithRoots.success) {
      expect(workflowStateWithRoots.data).toMatchObject({
        gitRoot: "/tmp/causaforge-repo",
        productRoot: "/tmp/causaforge-repo/product",
      })
    }
    expect(RootCauseArtifactSchema.safeParse(rootCause).success).toBe(true)
    expect(PatchPlanArtifactSchema.safeParse(patchPlan).success).toBe(true)
    expect(PatchCandidateArtifactSchema.safeParse(patchCandidate).success).toBe(true)
    expect(VerificationArtifactSchema.safeParse(verification).success).toBe(true)
    expect(TestSuiteManifestSchema.safeParse(testSuiteManifest).success).toBe(true)
    expect(VerificationRunArtifactSchema.safeParse(verificationRun).success).toBe(true)
    expect(ReviewArtifactSchema.safeParse(review).success).toBe(true)
    expect(DeliveryArtifactSchema.safeParse(delivery).success).toBe(true)
  })

  test("accepts inline patch content on patch candidates", () => {
    const parsed = PatchCandidateArtifactSchema.safeParse({
      ...patchCandidate,
      patchContent: "diff --git a/src/migrate.ts b/src/migrate.ts\nindex 111..222 100644\n",
    })
    const nullable = PatchCandidateArtifactSchema.safeParse({ ...patchCandidate, patchContent: null })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        patchContent: "diff --git a/src/migrate.ts b/src/migrate.ts\nindex 111..222 100644\n",
      })
    }
    expect(nullable.success).toBe(true)
    if (nullable.success) {
      expect(nullable.data).toMatchObject({ patchContent: null })
    }
  })

  test("rejects incomplete common fields and artifact references", () => {
    expect(RootCauseArtifactSchema.safeParse({ status: "confirmed" }).success).toBe(false)
    expect(PatchPlanArtifactSchema.safeParse({ ...patchPlan, rootCauseArtifactId: "" }).success).toBe(false)
    expect(RootCauseArtifactSchema.safeParse({ ...rootCause, createdAt: "not-a-datetime" }).success).toBe(false)
  })

  test("requires passing verification evidence", () => {
    expect(VerificationArtifactSchema.safeParse({ ...verification, checks: [] }).success).toBe(false)
    expect(
      VerificationArtifactSchema.safeParse({
        ...verification,
        checks: [{ ...verification.checks[0], status: "fail" }],
      }).success,
    ).toBe(false)
    expect(
      VerificationArtifactSchema.safeParse({
        ...verification,
        checks: [{ ...verification.checks[0], status: "skipped" }],
      }).success,
    ).toBe(false)
    expect(
      VerificationArtifactSchema.safeParse({
        ...verification,
        commands: [{ ...verification.commands[0], exitCode: 1 }],
      }).success,
    ).toBe(false)
  })

  test("requires passing verification runs to have successful required commands", () => {
    expect(
      VerificationRunArtifactSchema.safeParse({
        ...verificationRun,
        commands: [{ ...verificationRun.commands[0], exitCode: 1, status: "fail" }],
      }).success,
    ).toBe(false)

    expect(
      VerificationRunArtifactSchema.safeParse({
        ...verificationRun,
        manifest: { ...testSuiteManifest, commands: [] },
      }).success,
    ).toBe(false)

    expect(
      TestSuiteManifestSchema.safeParse({
        ...testSuiteManifest,
        commands: [{ ...testSuiteManifest.commands[0], argv: [] }],
      }).success,
    ).toBe(false)
  })

  test("validates verification criterion results against the root cause", () => {
    expect(validateVerificationAgainstRootCause(rootCause, verification)).toEqual(verification)

    const failedVerification = {
      ...verification,
      status: "fail" as const,
      criteria: [
        { ...verification.criteria[0], status: "fail" as const },
        { ...verification.criteria[1], status: "skipped" as const },
      ],
    }
    expect(validateVerificationAgainstRootCause(rootCause, failedVerification)).toEqual(failedVerification)

    const passingWithOptionalFailure = {
      ...verification,
      criteria: [verification.criteria[0], { ...verification.criteria[1], status: "fail" as const }],
    }
    expect(validateVerificationAgainstRootCause(rootCause, passingWithOptionalFailure)).toEqual(
      passingWithOptionalFailure,
    )

    expect(() =>
      validateVerificationAgainstRootCause(rootCause, {
        ...verification,
        criteria: [{ ...verification.criteria[0], status: "fail" }, verification.criteria[1]],
      }),
    ).toThrow("Required verification criterion must pass")
    expect(() =>
      validateVerificationAgainstRootCause(rootCause, {
        ...verification,
        criteria: [verification.criteria[0]],
      }),
    ).toThrow("Missing verification criterion result")
    expect(() =>
      validateVerificationAgainstRootCause(rootCause, {
        ...verification,
        criteria: [verification.criteria[0], verification.criteria[0]],
      }),
    ).toThrow("Duplicate verification criterion result ID")
    expect(() =>
      validateVerificationAgainstRootCause(rootCause, {
        ...verification,
        criteria: [
          verification.criteria[0],
          { ...verification.criteria[1], criterionId: "criterion-unknown" },
        ],
      }),
    ).toThrow("Unknown verification criterion ID")
    expect(() =>
      validateVerificationAgainstRootCause(rootCause, {
        ...verification,
        workflowId: "wf-other",
      }),
    ).toThrow("Verification and root cause must belong to the same workflow")
    expect(() =>
      validateVerificationAgainstRootCause(
        {
          ...rootCause,
          verificationCriteria: [rootCause.verificationCriteria[0], rootCause.verificationCriteria[0]],
        },
        verification,
      ),
    ).toThrow("Duplicate root cause criterion ID")
  })

  test("requires approved plan deviations before verification", () => {
    expect(
      PatchCandidateArtifactSchema.safeParse({
        ...patchCandidate,
        planDeviations: [{ description: "Modify an additional fixture.", approved: false }],
      }).success,
    ).toBe(false)
  })

  test("rejects passing reviews with blocking findings", () => {
    expect(
      ReviewArtifactSchema.safeParse({
        ...review,
        findings: [{ severity: "blocking", summary: "The root cause remains." }],
      }).success,
    ).toBe(false)

    for (const field of ["rootCauseEliminated", "withinApprovedScope", "verificationSufficient"] as const) {
      expect(ReviewArtifactSchema.safeParse({ ...review, [field]: false }).success).toBe(false)
    }
  })

  test("requires every upstream artifact for complete delivery", () => {
    expect(DeliveryArtifactSchema.safeParse({ ...delivery, reviewArtifactId: "" }).success).toBe(false)
    expect(
      DeliveryArtifactSchema.safeParse({
        ...delivery,
        status: "incomplete",
        rootCauseArtifactId: null,
        patchPlanArtifactId: undefined,
        patchCandidateArtifactId: null,
        verificationArtifactId: undefined,
        reviewArtifactId: null,
      }).success,
    ).toBe(true)
    expect(
      DeliveryArtifactSchema.safeParse({ ...delivery, status: "incomplete", reviewArtifactId: "" }).success,
    ).toBe(false)
  })

  test("accepts only explicit workflow artifact references", () => {
    const artifactRefs = {
      rootCauseArtifactId: rootCause.artifactId,
      patchPlanArtifactId: patchPlan.artifactId,
      patchCandidateArtifactId: patchCandidate.artifactId,
      verificationArtifactId: verification.artifactId,
      reviewArtifactId: review.artifactId,
      deliveryArtifactId: delivery.artifactId,
    }

    expect(WorkflowStateSchema.safeParse({
      schemaVersion: "1.0",
      workflowId: base.workflowId,
      phase: "planning",
      status: "active",
      entryMode: "problem-description",
      artifactRefs,
      builderSessionId: null,
      reviewerSessionId: null,
      createdAt: base.createdAt,
      updatedAt: base.createdAt,
      completedAt: null,
    }).success).toBe(true)
    expect(
      WorkflowStateSchema.safeParse({
        schemaVersion: "1.0",
        workflowId: base.workflowId,
        phase: "planning",
        status: "active",
        entryMode: "problem-description",
        artifactRefs: { ...artifactRefs, unknownArtifactId: "unexpected" },
        builderSessionId: null,
        reviewerSessionId: null,
        createdAt: base.createdAt,
        updatedAt: base.createdAt,
        completedAt: null,
      }).success,
    ).toBe(false)
  })

  test("keeps workflow terminal status, phase, and timestamps consistent", () => {
    const workflowState = {
      schemaVersion: "1.0",
      workflowId: base.workflowId,
      phase: "planning",
      status: "active",
      entryMode: "problem-description",
      artifactRefs: {},
      builderSessionId: null,
      reviewerSessionId: null,
      createdAt: base.createdAt,
      updatedAt: base.createdAt,
      completedAt: null,
    }

    expect(
      WorkflowStateSchema.safeParse({ ...workflowState, status: "completed", phase: "completed" }).success,
    ).toBe(false)
    expect(
      WorkflowStateSchema.safeParse({
        ...workflowState,
        status: "completed",
        phase: "planning",
        completedAt: base.createdAt,
      }).success,
    ).toBe(false)
    expect(
      WorkflowStateSchema.safeParse({ ...workflowState, status: "blocked", phase: "planning" }).success,
    ).toBe(false)
    expect(
      WorkflowStateSchema.safeParse({
        ...workflowState,
        status: "blocked",
        phase: "blocked",
        completedAt: base.createdAt,
      }).success,
    ).toBe(false)
    expect(
      WorkflowStateSchema.safeParse({ ...workflowState, phase: "completed" }).success,
    ).toBe(false)
    expect(WorkflowStateSchema.safeParse({ ...workflowState, completedAt: base.createdAt }).success).toBe(false)
    expect(
      WorkflowStateSchema.safeParse({
        ...workflowState,
        createdAt: "2026-07-13T00:00:01.000Z",
        updatedAt: "2026-07-13T00:00:00.000Z",
      }).success,
    ).toBe(false)
    expect(
      WorkflowStateSchema.safeParse({
        ...workflowState,
        status: "completed",
        phase: "completed",
        updatedAt: "2026-07-13T00:00:02.000Z",
        completedAt: "2026-07-13T00:00:01.000Z",
      }).success,
    ).toBe(false)

    expect(
      WorkflowStateSchema.safeParse({
        ...workflowState,
        status: "completed",
        phase: "completed",
        completedAt: base.createdAt,
      }).success,
    ).toBe(true)
    expect(WorkflowStateSchema.safeParse({ ...workflowState, status: "blocked", phase: "blocked" }).success).toBe(
      true,
    )
  })
})
