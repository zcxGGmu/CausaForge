import type { ArtifactKind, WorkflowAgentId, WorkflowPhase } from "@causaforge/core"

export interface WorkflowPhaseContext {
  workflowId: string
  currentPhase: WorkflowPhase
  agentRole: WorkflowAgentId
  allowedArtifacts: ArtifactKind[]
  allowedCapabilities: string[]
  exitConditions: string[]
}

export function createPhaseContext(context: WorkflowPhaseContext): WorkflowPhaseContext {
  return {
    workflowId: context.workflowId,
    currentPhase: context.currentPhase,
    agentRole: context.agentRole,
    allowedArtifacts: [...context.allowedArtifacts],
    allowedCapabilities: [...context.allowedCapabilities],
    exitConditions: [...context.exitConditions],
  }
}

export function renderPhaseContext(context: WorkflowPhaseContext): string {
  return [
    `workflowId: ${context.workflowId}`,
    `currentPhase: ${context.currentPhase}`,
    `agentRole: ${context.agentRole}`,
    `allowedArtifacts: ${context.allowedArtifacts.join(", ") || "none"}`,
    `allowedCapabilities: ${context.allowedCapabilities.join(", ") || "none"}`,
    `exitConditions: ${context.exitConditions.join("; ") || "none"}`,
  ].join("\n")
}
