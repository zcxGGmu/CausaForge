import { describe, expect, test } from "bun:test"
import {
  assertTransition,
  canTransition,
  RootCauseArtifactSchema,
  validateVerificationAgainstRootCause,
  VerificationCheckSchema,
  WorkflowTransitionError,
  type RootCauseArtifact,
  type VerificationCheck,
  type WorkflowPhase,
} from "@causaforge/core"

const from: WorkflowPhase = "intake"
const to: WorkflowPhase = "planning"

describe("causaforge-core package API", () => {
  test("exposes matching runtime and type declarations from the package root", () => {
    expect(canTransition(from, to)).toBe(true)
    expect(assertTransition(from, to)).toBeUndefined()
    expect(new WorkflowTransitionError(from, "completed")).toMatchObject({
      code: "INVALID_TRANSITION",
      from,
      to: "completed",
    })
  })

  test("exposes artifact schemas and inferred types from the package root", () => {
    const artifact: RootCauseArtifact = {
      schemaVersion: "1.0",
      workflowId: "wf-001",
      artifactId: "root-cause-001",
      createdAt: "2026-07-13T00:00:00.000Z",
      problemSummary: "A field is lost during migration.",
      reproductionEvidence: ["Run the migration test."],
      observedBehavior: "The migrated field is absent.",
      expectedBehavior: "The migrated field is preserved.",
      rootCauseSummary: "Normalization drops the field.",
      causalChain: ["The migration reads the field.", "Normalization omits the field."],
      affectedLocations: ["src/migrate.ts"],
      constraints: [],
      verificationCriteria: [
        { criterionId: "criterion-001", description: "The field remains present.", required: true },
      ],
      status: "confirmed",
    }

    expect(RootCauseArtifactSchema.parse(artifact)).toEqual(artifact)

    const requiredCheck: VerificationCheck = {
      name: "migration unit tests",
      required: true,
      status: "pass",
      evidence: "12 tests passed.",
    }
    expect(VerificationCheckSchema.parse(requiredCheck)).toEqual(requiredCheck)
    expect(typeof validateVerificationAgainstRootCause).toBe("function")
  })
})
