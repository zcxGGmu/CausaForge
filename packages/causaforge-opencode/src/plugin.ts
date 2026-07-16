import type { WorkflowArtifactStore } from "@causaforge/core"
import { createWorkflowAgents } from "./agents/registry"
import type { WorkflowAgentRegistry } from "./agents/types"
import { parseWorkflowConfig, type WorkflowOpenCodeConfig } from "./config/schema"
import { createWorkflowOpenCodeContext } from "./context"
import {
  createCompactionSnapshot,
  createPhaseContext,
  evaluateStopGate,
  evaluateToolPermission,
  recordCommandEvidence,
  restoreCompactionState,
} from "./hooks"
import { createWorkflowTools, type WorkflowCommandRunner, type WorkflowGitRunner, type WorkflowTools } from "./tools"

export interface WorkflowPluginDeps {
  cwd: string
  config?: unknown
  store: WorkflowArtifactStore
  git: WorkflowGitRunner
  commandRunner: WorkflowCommandRunner
}

export interface WorkflowPluginHooks {
  phaseContext: typeof createPhaseContext
  toolPermission: typeof evaluateToolPermission
  evidenceRecorder: typeof recordCommandEvidence
  compactionState: {
    create: typeof createCompactionSnapshot
    restore: typeof restoreCompactionState
  }
  stopGate: typeof evaluateStopGate
}

export interface WorkflowPlugin {
  config: WorkflowOpenCodeConfig
  agents: WorkflowAgentRegistry
  tools: WorkflowTools
  hooks: WorkflowPluginHooks
}

export function createWorkflowPlugin(deps: WorkflowPluginDeps): WorkflowPlugin {
  const config = parseWorkflowConfig(deps.config ?? {})
  const context = createWorkflowOpenCodeContext({ cwd: deps.cwd, config })
  return {
    config,
    agents: createWorkflowAgents(context),
    tools: createWorkflowTools({
      cwd: deps.cwd,
      config,
      store: deps.store,
      git: deps.git,
      commandRunner: deps.commandRunner,
    }),
    hooks: {
      phaseContext: createPhaseContext,
      toolPermission: evaluateToolPermission,
      evidenceRecorder: recordCommandEvidence,
      compactionState: {
        create: createCompactionSnapshot,
        restore: restoreCompactionState,
      },
      stopGate: evaluateStopGate,
    },
  }
}
