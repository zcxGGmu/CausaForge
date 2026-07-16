import { z } from "zod"
import { ArtifactBaseSchema, NonEmptyStringSchema } from "./common"

export const VerificationCommandSchema = z.object({
  commandId: NonEmptyStringSchema,
  argv: z.array(NonEmptyStringSchema).min(1),
  required: z.boolean(),
  timeoutSeconds: z.number().int().positive().max(86_400),
})

export const TestSuiteManifestSchema = z.object({
  suiteId: NonEmptyStringSchema,
  source: z.enum(["user", "official", "project"]),
  runnerId: NonEmptyStringSchema,
  commands: z.array(VerificationCommandSchema).min(1),
})

export const VerificationRunCommandResultSchema = z.object({
  commandId: NonEmptyStringSchema,
  argv: z.array(NonEmptyStringSchema).min(1),
  required: z.boolean(),
  exitCode: z.number().int(),
  status: z.enum(["pass", "fail", "skipped"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  stdoutPath: NonEmptyStringSchema,
  stderrPath: NonEmptyStringSchema,
})

export const VerificationRunnerRefSchema = z.object({
  runnerId: NonEmptyStringSchema,
  type: z.enum(["local", "ssh"]),
  target: NonEmptyStringSchema,
})

export const VerificationRunArtifactSchema = ArtifactBaseSchema.extend({
  iteration: z.number().int().positive(),
  patchCandidateArtifactId: NonEmptyStringSchema,
  runner: VerificationRunnerRefSchema,
  manifest: TestSuiteManifestSchema,
  commands: z.array(VerificationRunCommandResultSchema).min(1),
  failureSignature: NonEmptyStringSchema.nullable(),
  status: z.enum(["pass", "fail", "infra_error"]),
}).superRefine((artifact, context) => {
  if (artifact.status !== "pass") return

  for (const [index, command] of artifact.commands.entries()) {
    if (command.required && (command.exitCode !== 0 || command.status !== "pass")) {
      context.addIssue({
        code: "custom",
        path: ["commands", index, "status"],
        message: "Passing verification runs require every required command to pass.",
      })
    }
  }
})

export type VerificationCommand = z.infer<typeof VerificationCommandSchema>
export type TestSuiteManifest = z.infer<typeof TestSuiteManifestSchema>
export type VerificationRunCommandResult = z.infer<typeof VerificationRunCommandResultSchema>
export type VerificationRunnerRef = z.infer<typeof VerificationRunnerRefSchema>
export type VerificationRunArtifact = z.infer<typeof VerificationRunArtifactSchema>
