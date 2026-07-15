import { z } from "zod"
import { ArtifactBaseSchema, NonEmptyStringSchema } from "./common"

const DeliverySummarySchema = {
  fixSummary: NonEmptyStringSchema,
  verificationSummary: NonEmptyStringSchema,
  reviewSummary: NonEmptyStringSchema,
  residualRisks: z.array(NonEmptyStringSchema),
  handoffInstructions: z.array(NonEmptyStringSchema).min(1),
  patchPath: NonEmptyStringSchema,
}

const CompleteDeliveryArtifactSchema = ArtifactBaseSchema.extend({
  rootCauseArtifactId: NonEmptyStringSchema,
  patchPlanArtifactId: NonEmptyStringSchema,
  patchCandidateArtifactId: NonEmptyStringSchema,
  verificationArtifactId: NonEmptyStringSchema,
  reviewArtifactId: NonEmptyStringSchema,
  ...DeliverySummarySchema,
  status: z.literal("complete"),
})

const IncompleteArtifactIdSchema = NonEmptyStringSchema.nullable().optional()

const IncompleteDeliveryArtifactSchema = ArtifactBaseSchema.extend({
  rootCauseArtifactId: IncompleteArtifactIdSchema,
  patchPlanArtifactId: IncompleteArtifactIdSchema,
  patchCandidateArtifactId: IncompleteArtifactIdSchema,
  verificationArtifactId: IncompleteArtifactIdSchema,
  reviewArtifactId: IncompleteArtifactIdSchema,
  ...DeliverySummarySchema,
  status: z.literal("incomplete"),
})

export const DeliveryArtifactSchema = z.discriminatedUnion("status", [
  CompleteDeliveryArtifactSchema,
  IncompleteDeliveryArtifactSchema,
])

export type DeliveryArtifact = z.infer<typeof DeliveryArtifactSchema>
