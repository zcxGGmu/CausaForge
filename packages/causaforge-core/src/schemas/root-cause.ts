import { z } from "zod"
import { ArtifactBaseSchema, NonEmptyStringSchema } from "./common"

export const VerificationCriterionSchema = z.object({
  criterionId: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  required: z.boolean(),
})

export const RootCauseArtifactSchema = ArtifactBaseSchema.extend({
  problemSummary: NonEmptyStringSchema,
  reproductionEvidence: z.array(NonEmptyStringSchema).min(1),
  observedBehavior: NonEmptyStringSchema,
  expectedBehavior: NonEmptyStringSchema,
  rootCauseSummary: NonEmptyStringSchema,
  causalChain: z.array(NonEmptyStringSchema).min(1),
  affectedLocations: z.array(NonEmptyStringSchema).min(1),
  constraints: z.array(NonEmptyStringSchema),
  verificationCriteria: z.array(VerificationCriterionSchema).min(1),
  status: z.literal("confirmed"),
})

export type VerificationCriterion = z.infer<typeof VerificationCriterionSchema>
export type RootCauseArtifact = z.infer<typeof RootCauseArtifactSchema>
