import type { WorkflowCompleteInput, WorkflowTool, WorkflowToolDeps, WorkflowTransitionOutput } from "./types"
import { createWorkflowTransitionTool } from "./workflow-transition"

export function createWorkflowCompleteTool(deps: WorkflowToolDeps): WorkflowTool<WorkflowCompleteInput, WorkflowTransitionOutput> {
  const transitionTool = createWorkflowTransitionTool(deps)
  return {
    name: "workflow_complete",
    description: "Complete a workflow from the delivering phase.",
    async execute(input) {
      const state = await deps.store.readWorkflow(input.workflowId)
      if (state.phase !== "delivering") throw new Error("INVALID_TRANSITION: workflow_complete requires delivering phase")
      return transitionTool.execute({
        workflowId: input.workflowId,
        expectedPhase: "delivering",
        targetPhase: "completed",
        requestedByAgent: input.requestedByAgent,
        sessionId: input.sessionId,
        artifacts: input.artifacts,
        implementationPatchContent: input.implementationPatchContent,
        deliveryPatchContent: input.deliveryPatchContent,
        now: input.now,
      })
    },
  }
}
