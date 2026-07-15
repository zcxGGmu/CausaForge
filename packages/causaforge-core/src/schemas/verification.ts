import { z } from "zod"
import { ArtifactBaseSchema, NonEmptyStringSchema } from "./common"
import { RootCauseArtifactSchema, type RootCauseArtifact } from "./root-cause"

export const ExecutedCommandSchema = z.object({
  command: NonEmptyStringSchema,
  exitCode: z.number().int(),
})

export const VerificationCheckSchema = z.object({
  name: NonEmptyStringSchema,
  required: z.boolean(),
  status: z.enum(["pass", "fail", "skipped"]),
  evidence: NonEmptyStringSchema,
})

export const VerificationCriterionResultSchema = z.object({
  criterionId: NonEmptyStringSchema,
  status: z.enum(["pass", "fail", "skipped"]),
  evidence: NonEmptyStringSchema,
})

export const VerificationArtifactSchema = ArtifactBaseSchema.extend({
  patchCandidateArtifactId: NonEmptyStringSchema,
  commands: z.array(ExecutedCommandSchema).min(1),
  checks: z.array(VerificationCheckSchema),
  criteria: z.array(VerificationCriterionResultSchema),
  omissions: z.array(NonEmptyStringSchema),
  residualRisks: z.array(NonEmptyStringSchema),
  status: z.enum(["pass", "fail"]),
}).superRefine((artifact, context) => {
  if (artifact.status !== "pass") return

  if (artifact.checks.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["checks"],
      message: "Passing verification requires at least one check.",
    })
  }

  for (const [index, command] of artifact.commands.entries()) {
    if (command.exitCode !== 0) {
      context.addIssue({
        code: "custom",
        path: ["commands", index, "exitCode"],
        message: "Passing verification requires every command to exit successfully.",
      })
    }
  }

  for (const [index, check] of artifact.checks.entries()) {
    if (check.required && check.status !== "pass") {
      context.addIssue({
        code: "custom",
        path: ["checks", index, "status"],
        message: "Every required check must pass.",
      })
    }
  }

})

export function validateVerificationAgainstRootCause(
  rootCauseInput: RootCauseArtifact,
  verificationInput: VerificationArtifact,
): VerificationArtifact {
  const rootCause = RootCauseArtifactSchema.parse(rootCauseInput)
  const verification = VerificationArtifactSchema.parse(verificationInput)
  const rootCauseCriteria = new Map<string, (typeof rootCause.verificationCriteria)[number]>()

  if (rootCause.workflowId !== verification.workflowId) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["workflowId"],
        message: "Verification and root cause must belong to the same workflow.",
      },
    ])
  }

  for (const [index, criterion] of rootCause.verificationCriteria.entries()) {
    if (rootCauseCriteria.has(criterion.criterionId)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["verificationCriteria", index, "criterionId"],
          message: "Duplicate root cause criterion ID.",
        },
      ])
    }
    rootCauseCriteria.set(criterion.criterionId, criterion)
  }

  const results = new Map<string, (typeof verification.criteria)[number]>()
  for (const [index, result] of verification.criteria.entries()) {
    if (results.has(result.criterionId)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["criteria", index, "criterionId"],
          message: "Duplicate verification criterion result ID.",
        },
      ])
    }
    if (!rootCauseCriteria.has(result.criterionId)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["criteria", index, "criterionId"],
          message: "Unknown verification criterion ID.",
        },
      ])
    }
    results.set(result.criterionId, result)
  }

  for (const criterion of rootCause.verificationCriteria) {
    const result = results.get(criterion.criterionId)
    if (!result) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["criteria"],
          message: `Missing verification criterion result: ${criterion.criterionId}.`,
        },
      ])
    }
    if (verification.status === "pass" && criterion.required && result.status !== "pass") {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["criteria", verification.criteria.indexOf(result), "status"],
          message: `Required verification criterion must pass: ${criterion.criterionId}.`,
        },
      ])
    }
  }

  return verification
}

export type ExecutedCommand = z.infer<typeof ExecutedCommandSchema>
export type VerificationCheck = z.infer<typeof VerificationCheckSchema>
export type VerificationCriterionResult = z.infer<typeof VerificationCriterionResultSchema>
export type VerificationArtifact = z.infer<typeof VerificationArtifactSchema>
