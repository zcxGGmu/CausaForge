import { z } from "zod"
import { WORKFLOW_PHASES } from "../phases"
import { NonEmptyStringSchema } from "./common"

export const WorkflowArtifactRefsSchema = z
  .object({
    rootCauseArtifactId: NonEmptyStringSchema.nullable().optional(),
    patchPlanArtifactId: NonEmptyStringSchema.nullable().optional(),
    patchCandidateArtifactId: NonEmptyStringSchema.nullable().optional(),
    verificationArtifactId: NonEmptyStringSchema.nullable().optional(),
    reviewArtifactId: NonEmptyStringSchema.nullable().optional(),
    deliveryArtifactId: NonEmptyStringSchema.nullable().optional(),
  })
  .strict()

export const WorkflowStateSchema = z.object({
  schemaVersion: z.literal("1.0"),
  workflowId: NonEmptyStringSchema,
  phase: z.enum(WORKFLOW_PHASES),
  status: z.enum(["active", "completed", "blocked"]),
  entryMode: z.enum(["problem-description", "root-cause-artifact"]),
  artifactRefs: WorkflowArtifactRefsSchema,
  builderSessionId: NonEmptyStringSchema.nullable(),
  reviewerSessionId: NonEmptyStringSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
}).superRefine((state, context) => {
  const createdAt = Date.parse(state.createdAt)
  const updatedAt = Date.parse(state.updatedAt)
  if (createdAt > updatedAt) {
    context.addIssue({
      code: "custom",
      path: ["updatedAt"],
      message: "Workflow updatedAt cannot precede createdAt.",
    })
  }
  if (state.completedAt !== null && updatedAt > Date.parse(state.completedAt)) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "Workflow completedAt cannot precede updatedAt.",
    })
  }

  if (state.status === "completed") {
    if (state.phase !== "completed") {
      context.addIssue({ code: "custom", path: ["phase"], message: "Completed workflow must be in completed phase." })
    }
    if (state.completedAt === null) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Completed workflow requires a completion timestamp.",
      })
    }
    return
  }

  if (state.status === "blocked") {
    if (state.phase !== "blocked") {
      context.addIssue({ code: "custom", path: ["phase"], message: "Blocked workflow must be in blocked phase." })
    }
    if (state.completedAt !== null) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Blocked workflow cannot have a completion timestamp.",
      })
    }
    return
  }

  if (state.phase === "completed" || state.phase === "blocked") {
    context.addIssue({ code: "custom", path: ["phase"], message: "Active workflow cannot be in a terminal phase." })
  }
  if (state.completedAt !== null) {
    context.addIssue({
      code: "custom",
      path: ["completedAt"],
      message: "Active workflow cannot have a completion timestamp.",
    })
  }
})

export type WorkflowState = z.infer<typeof WorkflowStateSchema>
export type WorkflowArtifactRefs = z.infer<typeof WorkflowArtifactRefsSchema>
