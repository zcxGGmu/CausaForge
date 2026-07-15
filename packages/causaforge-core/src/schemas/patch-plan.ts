import { z } from "zod"
import { ArtifactBaseSchema, NonEmptyStringSchema } from "./common"

export const PlannedFileChangeSchema = z.object({
  path: NonEmptyStringSchema,
  change: NonEmptyStringSchema,
  rootCauseLinks: z.array(NonEmptyStringSchema).min(1),
})

export const PatchPlanArtifactSchema = ArtifactBaseSchema.extend({
  rootCauseArtifactId: NonEmptyStringSchema,
  objectives: z.array(NonEmptyStringSchema).min(1),
  fileChanges: z.array(PlannedFileChangeSchema).min(1),
  nonGoals: z.array(NonEmptyStringSchema),
  verificationPlan: z.array(NonEmptyStringSchema).min(1),
  risks: z.array(NonEmptyStringSchema),
  status: z.literal("approved"),
})

export type PlannedFileChange = z.infer<typeof PlannedFileChangeSchema>
export type PatchPlanArtifact = z.infer<typeof PatchPlanArtifactSchema>
