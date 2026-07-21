import { z } from "zod"
import { ArtifactBaseSchema, NonEmptyStringSchema } from "./common"
import { TestSuiteManifestSchema } from "./iteration"

const VerificationSourceModeSchema = z.enum(["official", "user"])

const OfficialVerificationSourceSchema = z
  .object({
    repositoryUrl: NonEmptyStringSchema,
    commitHash: NonEmptyStringSchema,
    checkoutPath: NonEmptyStringSchema,
    suitePath: NonEmptyStringSchema,
  })
  .strict()

const UserVerificationSourceSchema = z
  .object({
    providedPath: NonEmptyStringSchema,
    normalizedPath: NonEmptyStringSchema,
  })
  .strict()

export const VerificationSourceArtifactSchema = ArtifactBaseSchema.extend({
  patchPlanArtifactId: NonEmptyStringSchema,
  source: VerificationSourceModeSchema,
  manifest: TestSuiteManifestSchema,
  official: OfficialVerificationSourceSchema.nullable(),
  user: UserVerificationSourceSchema.nullable(),
  status: z.literal("ready"),
}).superRefine((artifact, context) => {
  if (artifact.manifest.source !== artifact.source) {
    context.addIssue({
      code: "custom",
      path: ["manifest", "source"],
      message: "Verification manifest source must match the selected verification source.",
    })
  }

  if (artifact.source === "official") {
    if (!artifact.official || artifact.user !== null) {
      context.addIssue({
        code: "custom",
        path: ["official"],
        message: "Official verification source requires official details and no user details.",
      })
    }
    return
  }

  if (!artifact.user || artifact.official !== null) {
    context.addIssue({
      code: "custom",
      path: ["user"],
      message: "User verification source requires user details and no official details.",
    })
  }
})

export type VerificationSourceArtifact = z.infer<typeof VerificationSourceArtifactSchema>
export type VerificationSourceMode = z.infer<typeof VerificationSourceModeSchema>
