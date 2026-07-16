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

const DEFAULT_LOCAL_ALLOWED_COMMANDS = [
  ["bun", "test"],
  ["bun", "run", "typecheck"],
  ["bun", "run", "build"],
  ["git", "diff", "--check"],
]

const DEFAULT_VERIFICATION_CONFIG = {
  max_iterations: 5,
  runners: [
    {
      id: "local",
      type: "local" as const,
      cwd: ".",
      allowedCommands: DEFAULT_LOCAL_ALLOWED_COMMANDS,
    },
  ],
}

const VerificationAllowedCommandSchema = z.array(z.string().min(1)).min(1)

const VerificationLocalRunnerConfigSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("local"),
    cwd: z.string().min(1).default("."),
    allowedCommands: z.array(VerificationAllowedCommandSchema).min(1).default(DEFAULT_LOCAL_ALLOWED_COMMANDS),
  })
  .strict()

const VerificationSshRunnerConfigSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("ssh"),
    host: z.string().min(1),
    cwd: z.string().min(1),
    allowedCommands: z.array(VerificationAllowedCommandSchema).min(1),
  })
  .strict()

const VerificationRunnerConfigSchema = z.discriminatedUnion("type", [
  VerificationLocalRunnerConfigSchema,
  VerificationSshRunnerConfigSchema,
])

const WorkflowVerificationConfigSchema = z
  .object({
    max_iterations: z.number().int().positive().max(50).default(5),
    runners: z.array(VerificationRunnerConfigSchema).min(1).default(DEFAULT_VERIFICATION_CONFIG.runners),
  })
  .strict()
  .default(DEFAULT_VERIFICATION_CONFIG)

export const WorkflowOpenCodeConfigSchema = z
  .object({
    artifact_dir: z.string().min(1).default(".workflow"),
    require_independent_review: z.boolean().default(true),
    require_clean_worktree: z.boolean().default(true),
    allow_plan_deviation: z.boolean().default(false),
    auto_continue_after_compaction: z.boolean().default(true),
    agents: WorkflowAgentsConfigSchema,
    verification: WorkflowVerificationConfigSchema,
  })
  .strict()

export type WorkflowAgentOverride = z.infer<typeof WorkflowAgentOverrideSchema>
export type WorkflowVerificationRunnerConfig = z.infer<typeof VerificationRunnerConfigSchema>
export type WorkflowOpenCodeConfig = z.infer<typeof WorkflowOpenCodeConfigSchema>

export function parseWorkflowConfig(input: unknown): WorkflowOpenCodeConfig {
  return WorkflowOpenCodeConfigSchema.parse(input)
}
