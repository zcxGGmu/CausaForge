import type { WorkflowState } from "@causaforge/core"
import { discoverBlueprintSoftwareRepositories } from "../blueprint-corpus"
import type { WorkflowStartInput, WorkflowTool, WorkflowToolDeps } from "./types"

export function createWorkflowStartTool(deps: WorkflowToolDeps): WorkflowTool<WorkflowStartInput, WorkflowState> {
  return {
    name: "workflow_start",
    description: "Create a workflow state record.",
    async execute(input) {
      const now = input.now ?? new Date().toISOString()
      const rootCauseImported = input.entryMode === "root-cause-import" && input.rootCauseArtifactId !== undefined
      const repositoryPreparations = discoverBlueprintSoftwareRepositories(deps.cwd).map((repository) => ({
        softwareName: repository.softwareName,
        repositoryUrl: repository.repositoryUrl,
        commitHash: repository.commitHash,
        metadataPath: repository.relativeMetadataPath,
        status: "pending" as const,
      }))
      const state: WorkflowState = {
        schemaVersion: "1.0",
        workflowId: input.workflowId,
        phase: input.entryMode === "root-cause-import" ? (rootCauseImported ? "planning" : "intake") : "root_cause",
        status: "active",
        entryMode: input.entryMode === "root-cause-import" ? "root-cause-artifact" : "problem-description",
        artifactRefs: input.rootCauseArtifactId ? { rootCauseArtifactId: input.rootCauseArtifactId } : {},
        ...(repositoryPreparations.length > 0 ? { repositoryPreparations } : {}),
        gitRoot: input.gitRoot ?? null,
        productRoot: input.productRoot ?? null,
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
