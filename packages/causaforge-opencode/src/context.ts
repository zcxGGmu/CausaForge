import { parseWorkflowConfig, type WorkflowOpenCodeConfig } from "./config/schema"
import { discoverBlueprintCorpus, type BlueprintCorpusMetadata } from "./blueprint-corpus"

export interface WorkflowOpenCodeContextInput {
  cwd: string
  config?: unknown
}

export interface WorkflowOpenCodeContext {
  cwd: string
  config: WorkflowOpenCodeConfig
  blueprintCorpus: BlueprintCorpusMetadata | null
}

export function createWorkflowOpenCodeContext(input: WorkflowOpenCodeContextInput): WorkflowOpenCodeContext {
  return {
    cwd: input.cwd,
    config: parseWorkflowConfig(input.config ?? {}),
    blueprintCorpus: discoverBlueprintCorpus(input.cwd),
  }
}
