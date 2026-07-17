import type { ArtifactKind } from "@causaforge/core"
import type { WorkflowStatusInput, WorkflowStatusOutput, WorkflowTool, WorkflowToolDeps } from "./types"

export function createWorkflowStatusTool(deps: WorkflowToolDeps): WorkflowTool<WorkflowStatusInput, WorkflowStatusOutput> {
  return {
    name: "workflow_status",
    description: "Read workflow phase and missing gates.",
    async execute(input) {
      let workflowId = input.workflowId
      if (!workflowId) {
        const workflows = await deps.store.listWorkflows()
        const active = workflows.filter((w) => w.status === "active")
        if (active.length === 0) throw new Error("No active workflow found")
        if (active.length > 1) throw new Error(`Multiple active workflows (${active.length}); specify workflowId`)
        workflowId = active[0].workflowId
      }
      const state = await deps.store.readWorkflow(workflowId)
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
