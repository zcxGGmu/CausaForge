import { createWorkflowCaptureDiffTool } from "./workflow-capture-diff"
import { createWorkflowCompleteTool } from "./workflow-complete"
import { createWorkflowRecordArtifactTool } from "./workflow-record-artifact"
import { createWorkflowReturnToPhaseTool } from "./workflow-return-to-phase"
import { createWorkflowRunVerificationTool } from "./workflow-run-verification"
import { createWorkflowStartTool } from "./workflow-start"
import { createWorkflowStatusTool } from "./workflow-status"
import { createWorkflowTransitionTool } from "./workflow-transition"
import { createWorkflowValidateArtifactTool } from "./workflow-validate-artifact"
import type { WorkflowToolDeps, WorkflowTools } from "./types"

export function createWorkflowTools(deps: WorkflowToolDeps): WorkflowTools {
  return {
    workflow_start: createWorkflowStartTool(deps),
    workflow_status: createWorkflowStatusTool(deps),
    workflow_record_artifact: createWorkflowRecordArtifactTool(deps),
    workflow_validate_artifact: createWorkflowValidateArtifactTool(),
    workflow_capture_diff: createWorkflowCaptureDiffTool(deps),
    workflow_run_verification: createWorkflowRunVerificationTool(deps),
    workflow_transition: createWorkflowTransitionTool(deps),
    workflow_return_to_phase: createWorkflowReturnToPhaseTool(deps),
    workflow_complete: createWorkflowCompleteTool(deps),
  }
}

export type * from "./types"
