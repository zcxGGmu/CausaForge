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

export const RepositoryPreparationSchema = z
  .object({
    softwareName: NonEmptyStringSchema,
    repositoryUrl: NonEmptyStringSchema,
    commitHash: NonEmptyStringSchema,
    metadataPath: NonEmptyStringSchema,
    status: z.enum(["pending", "ready"]),
    mode: z.enum(["manual", "opencode"]).optional(),
    checkoutPath: NonEmptyStringSchema.optional(),
    preparedAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((preparation, context) => {
    if (preparation.status === "ready") {
      if (!preparation.mode) {
        context.addIssue({ code: "custom", path: ["mode"], message: "Ready repository preparation requires a mode." })
      }
      if (!preparation.preparedAt) {
        context.addIssue({ code: "custom", path: ["preparedAt"], message: "Ready repository preparation requires preparedAt." })
      }
    }
    if (preparation.status === "pending" && (preparation.mode || preparation.checkoutPath || preparation.preparedAt)) {
      context.addIssue({ code: "custom", path: ["status"], message: "Pending repository preparation cannot include ready-only fields." })
    }
  })

export const WorkflowStateSchema = z.object({
  schemaVersion: z.literal("1.0"),
  workflowId: NonEmptyStringSchema,
  phase: z.enum(WORKFLOW_PHASES),
  status: z.enum(["active", "completed", "blocked"]),
  entryMode: z.enum(["problem-description", "root-cause-artifact"]),
  artifactRefs: WorkflowArtifactRefsSchema,
  repositoryPreparations: z.array(RepositoryPreparationSchema).optional(),
  builderSessionId: NonEmptyStringSchema.nullable(),
  gitRoot: NonEmptyStringSchema.nullable().optional(),
  productRoot: NonEmptyStringSchema.nullable().optional(),
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
export type RepositoryPreparation = z.infer<typeof RepositoryPreparationSchema>
