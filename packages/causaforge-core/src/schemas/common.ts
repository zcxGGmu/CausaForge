import { z } from "zod"

export const NonEmptyStringSchema = z.string().min(1)

export const ArtifactBaseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  workflowId: NonEmptyStringSchema,
  artifactId: NonEmptyStringSchema,
  createdAt: z.string().datetime(),
})

export type ArtifactBase = z.infer<typeof ArtifactBaseSchema>
