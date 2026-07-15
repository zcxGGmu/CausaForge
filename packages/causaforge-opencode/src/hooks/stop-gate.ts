import type { ArtifactKind, WorkflowState } from "@causaforge/core"

export interface StopGateInput {
  state: WorkflowState
  missing: ArtifactKind[]
}

export type StopGateResult =
  | { allowed: true }
  | { allowed: false; workflowId: string; phase: WorkflowState["phase"]; missing: ArtifactKind[]; message: string }

export function evaluateStopGate(input: StopGateInput): StopGateResult {
  if (input.state.status === "completed" && input.state.phase === "completed") return { allowed: true }

  return {
    allowed: false,
    workflowId: input.state.workflowId,
    phase: input.state.phase,
    missing: [...input.missing],
    message: `Workflow ${input.state.workflowId} is still in ${input.state.phase}; missing gates: ${input.missing.join(", ") || "none"}.`,
  }
}
