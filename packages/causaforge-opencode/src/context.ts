import { parseWorkflowConfig, type WorkflowOpenCodeConfig } from "./config/schema"

export interface WorkflowOpenCodeContextInput {
  cwd: string
  config?: unknown
}

export interface WorkflowOpenCodeContext {
  cwd: string
  config: WorkflowOpenCodeConfig
}

export function createWorkflowOpenCodeContext(input: WorkflowOpenCodeContextInput): WorkflowOpenCodeContext {
  return {
    cwd: input.cwd,
    config: parseWorkflowConfig(input.config ?? {}),
  }
}
