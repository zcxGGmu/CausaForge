import { WORKFLOW_AGENT_IDS, type WorkflowAgentId } from "@causaforge/core"
import { z } from "zod"

const WorkflowAgentOverrideSchema = z
  .object({
    model: z.string().min(1).optional(),
    variant: z.string().min(1).optional(),
    reasoningEffort: z.enum(["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]).optional(),
  })
  .strict()

const WorkflowAgentsConfigSchema = z
  .object(
    Object.fromEntries(WORKFLOW_AGENT_IDS.map((agentId) => [agentId, WorkflowAgentOverrideSchema.optional()])) as Record<
      WorkflowAgentId,
      z.ZodOptional<typeof WorkflowAgentOverrideSchema>
    >,
  )
  .strict()
  .default({})

export const WorkflowOpenCodeConfigSchema = z
  .object({
    artifact_dir: z.string().min(1).default(".workflow"),
    require_independent_review: z.boolean().default(true),
    require_clean_worktree: z.boolean().default(true),
    allow_plan_deviation: z.boolean().default(false),
    auto_continue_after_compaction: z.boolean().default(true),
    agents: WorkflowAgentsConfigSchema,
  })
  .strict()

export type WorkflowAgentOverride = z.infer<typeof WorkflowAgentOverrideSchema>
export type WorkflowOpenCodeConfig = z.infer<typeof WorkflowOpenCodeConfigSchema>

export function parseWorkflowConfig(input: unknown): WorkflowOpenCodeConfig {
  return WorkflowOpenCodeConfigSchema.parse(input)
}
