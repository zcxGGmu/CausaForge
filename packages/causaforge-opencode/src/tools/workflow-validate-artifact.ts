import { parseArtifact } from "@causaforge/core"
import type { WorkflowTool, WorkflowValidateArtifactInput, WorkflowValidateArtifactOutput } from "./types"

export function createWorkflowValidateArtifactTool(): WorkflowTool<WorkflowValidateArtifactInput, WorkflowValidateArtifactOutput> {
  return {
    name: "workflow_validate_artifact",
    description: "Validate a workflow artifact without writing it.",
    async execute(input) {
      try {
        const artifact = parseArtifact(input.artifactKind, input.artifact)
        return { ok: true, artifactId: artifact.artifactId, workflowId: artifact.workflowId }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
