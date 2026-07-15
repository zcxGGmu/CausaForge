import type { WorkflowAgentId, WorkflowArtifactStore, WorkflowPhase } from "@causaforge/core"

export interface CompactionSnapshot {
  workflowId: string
  phase: WorkflowPhase
  agentRole: WorkflowAgentId
}

export function createCompactionSnapshot(snapshot: CompactionSnapshot): CompactionSnapshot {
  return {
    workflowId: snapshot.workflowId,
    phase: snapshot.phase,
    agentRole: snapshot.agentRole,
  }
}

export async function restoreCompactionState(
  store: WorkflowArtifactStore,
  snapshot: CompactionSnapshot,
): Promise<CompactionSnapshot> {
  const state = await store.readWorkflow(snapshot.workflowId)
  return {
    workflowId: state.workflowId,
    phase: state.phase,
    agentRole: snapshot.agentRole,
  }
}
