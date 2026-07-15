import { z } from "zod"
import { ArtifactBaseSchema, NonEmptyStringSchema } from "./common"

export const PlanDeviationSchema = z.object({
  description: NonEmptyStringSchema,
  approved: z.boolean(),
})

export const PatchCandidateArtifactSchema = ArtifactBaseSchema.extend({
  patchPlanArtifactId: NonEmptyStringSchema,
  modifiedFiles: z.array(NonEmptyStringSchema).min(1),
  patchPath: NonEmptyStringSchema,
  patchSummary: NonEmptyStringSchema,
  planDeviations: z.array(PlanDeviationSchema),
  implementationNotes: z.array(NonEmptyStringSchema).min(1),
  status: z.literal("ready_for_verification"),
}).superRefine((artifact, context) => {
  for (const [index, deviation] of artifact.planDeviations.entries()) {
    if (!deviation.approved) {
      context.addIssue({
        code: "custom",
        path: ["planDeviations", index, "approved"],
        message: "Every plan deviation must be approved before verification.",
      })
    }
  }
})

export type PlanDeviation = z.infer<typeof PlanDeviationSchema>
export type PatchCandidateArtifact = z.infer<typeof PatchCandidateArtifactSchema>
