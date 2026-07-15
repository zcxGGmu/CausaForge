export { createWorkflowOpenCodeContext } from "./context"
export { parseWorkflowConfig, WorkflowOpenCodeConfigSchema } from "./config/schema"
export type { WorkflowOpenCodeContext, WorkflowOpenCodeContextInput } from "./context"
export type { WorkflowAgentOverride, WorkflowOpenCodeConfig } from "./config/schema"
export { createWorkflowAgents } from "./agents/registry"
export type { WorkflowAgentDefinition, WorkflowAgentMode, WorkflowAgentRegistry } from "./agents/types"
export { createWorkflowTools } from "./tools"
export type { WorkflowTools, WorkflowToolDeps, WorkflowToolName } from "./tools"
export { createPhaseContext, evaluateToolPermission, renderPhaseContext } from "./hooks"
export type { ToolPermissionRequest, ToolPermissionResult, WorkflowPhaseContext } from "./hooks"
export { createCompactionSnapshot, evaluateStopGate, recordCommandEvidence, restoreCompactionState } from "./hooks"
export type { CommandEvidence, CompactionSnapshot, StopGateResult } from "./hooks"
export { createWorkflowPlugin } from "./plugin"
export type { WorkflowPlugin, WorkflowPluginDeps, WorkflowPluginHooks } from "./plugin"

import { createPluginModule } from "./opencode-plugin-module"

const pluginModule = createPluginModule()

export default pluginModule
export { createPluginModule }
export type { PluginModuleDeps } from "./opencode-plugin-module"
