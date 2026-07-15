import type { ArtifactKind } from "@causaforge/core"
import type { WorkflowStatusInput, WorkflowStatusOutput, WorkflowTool, WorkflowToolDeps } from "./types"

export function createWorkflowStatusTool(deps: WorkflowToolDeps): WorkflowTool<WorkflowStatusInput, WorkflowStatusOutput> {
  return {
    name: "workflow_status",
    description: "Read workflow phase and missing gates.",
    async execute(input) {
      const state = await deps.store.readWorkflow(input.workflowId)
      return {
        workflowId: state.workflowId,
        phase: state.phase,
        status: state.status,
        missing: missingArtifacts(state),
      }
    },
  }
}

function missingArtifacts(state: Awaited<ReturnType<WorkflowToolDeps["store"]["readWorkflow"]>>): ArtifactKind[] {
  const refs = state.artifactRefs
  switch (state.phase) {
    case "root_cause":
      return refs.rootCauseArtifactId ? [] : ["root-cause"]
    case "planning":
      return refs.patchPlanArtifactId ? [] : ["patch-plan"]
    case "building":
      return refs.patchCandidateArtifactId ? [] : ["patch-candidate"]
    case "verifying":
      return refs.verificationArtifactId ? [] : ["verification"]
    case "reviewing":
      return refs.reviewArtifactId ? [] : ["review"]
    case "delivering":
      return refs.deliveryArtifactId ? [] : ["delivery"]
    default:
      return []
  }
}
