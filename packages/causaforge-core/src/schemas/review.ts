import { z } from "zod"
import { ArtifactBaseSchema, NonEmptyStringSchema } from "./common"

export const ReviewFindingSchema = z.object({
  severity: z.enum(["blocking", "warning", "note"]),
  summary: NonEmptyStringSchema,
})

export const ReviewArtifactSchema = ArtifactBaseSchema.extend({
  patchCandidateArtifactId: NonEmptyStringSchema,
  verificationArtifactId: NonEmptyStringSchema,
  reviewerSessionId: NonEmptyStringSchema,
  findings: z.array(ReviewFindingSchema),
  rootCauseEliminated: z.boolean(),
  withinApprovedScope: z.boolean(),
  verificationSufficient: z.boolean(),
  status: z.enum(["pass", "fail"]),
}).superRefine((artifact, context) => {
  if (artifact.status !== "pass") return

  if (artifact.findings.some((finding) => finding.severity === "blocking")) {
    context.addIssue({
      code: "custom",
      path: ["findings"],
      message: "Passing review cannot contain blocking findings.",
    })
  }

  for (const field of ["rootCauseEliminated", "withinApprovedScope", "verificationSufficient"] as const) {
    if (!artifact[field]) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "Passing review requires every review gate to be satisfied.",
      })
    }
  }
})

export type ReviewFinding = z.infer<typeof ReviewFindingSchema>
export type ReviewArtifact = z.infer<typeof ReviewArtifactSchema>
