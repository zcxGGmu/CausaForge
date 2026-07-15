import fs from "node:fs/promises"
import { canWriteArtifact } from "@causaforge/core"
import { renderArtifactMarkdown } from "./markdown"
import type { WorkflowRecordArtifactInput, WorkflowRecordArtifactOutput, WorkflowTool, WorkflowToolDeps } from "./types"

export function createWorkflowRecordArtifactTool(
  deps: WorkflowToolDeps,
): WorkflowTool<WorkflowRecordArtifactInput, WorkflowRecordArtifactOutput> {
  return {
    name: "workflow_record_artifact",
    description: "Record a workflow artifact owned by the calling agent.",
    async execute(input) {
      if (!canWriteArtifact(input.agentId, input.artifactKind)) {
        throw new Error(`UNAUTHORIZED_AGENT: ${input.agentId} cannot write ${input.artifactKind}`)
      }
      const artifactPath = await deps.store.writeArtifact(input.workflowId, input.artifactKind, input.artifact)
      const markdown = renderArtifactMarkdown(input.artifactKind, input.artifact)
      if (markdown === null) return { artifactPath, markdownPath: null }

      const markdownPath = artifactPath.replace(/\.json$/, ".md")
      await fs.writeFile(markdownPath, `${markdown}\n`)
      return { artifactPath, markdownPath }
    },
  }
}
