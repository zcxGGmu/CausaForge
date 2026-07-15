import type { WorkflowAgentDefinition } from "./types"
import { buildWorkflowAgentPrompt } from "./types"
import type { WorkflowOpenCodeContext } from "../context"

export function createWorkflowOrchestratorAgent(_context: WorkflowOpenCodeContext): WorkflowAgentDefinition {
  return {
    id: "workflow-orchestrator",
    mode: "primary",
    name: "Workflow Orchestrator",
    description: "Coordinates the workflow lifecycle and delegates phase-specific work.",
    allowedArtifactKind: null,
    prompt: buildWorkflowAgentPrompt({
      responsibility: "Own intake, phase coordination, handoffs, and final user-facing workflow status.",
      prohibited: [
        "Do not write phase artifacts directly.",
        "Do not bypass required verification, review, or delivery gates.",
        "Do not rename workflow roles or use legacy role aliases.",
      ],
      allowedArtifactKind: null,
      transitionGuidance: "Request transitions only after the responsible phase agent has recorded the required artifact.",
      notes: ["Delegate specialized work to the normalized workflow subagents."],
    }),
  }
}
