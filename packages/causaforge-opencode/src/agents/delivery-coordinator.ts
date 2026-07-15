import type { WorkflowAgentDefinition } from "./types"
import { buildWorkflowAgentPrompt } from "./types"
import type { WorkflowOpenCodeContext } from "../context"

export function createDeliveryCoordinatorAgent(_context: WorkflowOpenCodeContext): WorkflowAgentDefinition {
  return {
    id: "delivery-coordinator",
    mode: "subagent",
    name: "Delivery Coordinator",
    description: "Packages final evidence and handoff instructions for completion.",
    allowedArtifactKind: "delivery",
    prompt: buildWorkflowAgentPrompt({
      responsibility: "Assemble the final delivery package, summarize fix, verification, review, residual risks, and handoff.",
      prohibited: [
        "Do not change product code.",
        "Do not alter implementation patch content during delivery.",
        "Do not complete workflows with incomplete upstream artifacts.",
      ],
      allowedArtifactKind: "delivery",
      transitionGuidance: "Request delivering to completed only after recording a complete delivery artifact.",
    }),
  }
}
