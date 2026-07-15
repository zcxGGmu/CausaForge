import type { WorkflowState } from "@causaforge/core"
import type { WorkflowStartInput, WorkflowTool, WorkflowToolDeps } from "./types"

export function createWorkflowStartTool(deps: WorkflowToolDeps): WorkflowTool<WorkflowStartInput, WorkflowState> {
  return {
    name: "workflow_start",
    description: "Create a workflow state record.",
    async execute(input) {
      const now = input.now ?? new Date().toISOString()
      const rootCauseImported = input.entryMode === "root-cause-import" && input.rootCauseArtifactId !== undefined
      const state: WorkflowState = {
        schemaVersion: "1.0",
        workflowId: input.workflowId,
        phase: input.entryMode === "root-cause-import" ? (rootCauseImported ? "planning" : "intake") : "root_cause",
        status: "active",
        entryMode: input.entryMode === "root-cause-import" ? "root-cause-artifact" : "problem-description",
        artifactRefs: input.rootCauseArtifactId ? { rootCauseArtifactId: input.rootCauseArtifactId } : {},
        builderSessionId: null,
        reviewerSessionId: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      }
      await deps.store.initializeWorkflow(state)
      return state
    },
  }
}
