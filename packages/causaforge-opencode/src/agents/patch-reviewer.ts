import type { WorkflowAgentDefinition } from "./types"
import { buildWorkflowAgentPrompt } from "./types"
import type { WorkflowOpenCodeContext } from "../context"

export function createPatchReviewerAgent(_context: WorkflowOpenCodeContext): WorkflowAgentDefinition {
  return {
    id: "patch-reviewer",
    mode: "subagent",
    name: "Patch Reviewer",
    description: "Independently reviews the patch candidate and verification evidence.",
    allowedArtifactKind: "review",
    prompt: buildWorkflowAgentPrompt({
      responsibility: "Review root cause elimination, approved scope, verification sufficiency, and blocking risks.",
      prohibited: [
        "Do not modify product code.",
        "Do not review from the same session that built the patch.",
        "Do not pass a review that contains blocking findings.",
      ],
      allowedArtifactKind: "review",
      transitionGuidance: "Request reviewing to delivering only after recording a passing review artifact.",
    }),
  }
}
