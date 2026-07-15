import { WORKFLOW_PHASES } from "@causaforge/core"
import type { WorkflowReturnToPhaseInput, WorkflowTool, WorkflowToolDeps, WorkflowTransitionOutput } from "./types"
import { createWorkflowTransitionTool } from "./workflow-transition"

export function createWorkflowReturnToPhaseTool(deps: WorkflowToolDeps): WorkflowTool<WorkflowReturnToPhaseInput, WorkflowTransitionOutput> {
  const transitionTool = createWorkflowTransitionTool(deps)
  return {
    name: "workflow_return_to_phase",
    description: "Return to an allowed earlier workflow phase.",
    async execute(input) {
      const state = await deps.store.readWorkflow(input.workflowId)
      if (!isEarlierNonTerminalPhase(state.phase, input.targetPhase)) {
        throw new Error("workflow_return_to_phase requires an earlier non-terminal phase")
      }
      return transitionTool.execute({
        workflowId: input.workflowId,
        expectedPhase: state.phase,
        targetPhase: input.targetPhase,
        requestedByAgent: input.requestedByAgent,
        sessionId: input.sessionId,
        now: input.now,
      })
    },
  }
}

function isEarlierNonTerminalPhase(currentPhase: (typeof WORKFLOW_PHASES)[number], targetPhase: (typeof WORKFLOW_PHASES)[number]): boolean {
  if (targetPhase === "completed" || targetPhase === "blocked") return false
  return WORKFLOW_PHASES.indexOf(targetPhase) < WORKFLOW_PHASES.indexOf(currentPhase)
}
