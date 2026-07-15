import type { WorkflowAgentDefinition } from "./types"
import { buildWorkflowAgentPrompt } from "./types"
import type { WorkflowOpenCodeContext } from "../context"

export function createPatchBuilderAgent(_context: WorkflowOpenCodeContext): WorkflowAgentDefinition {
  return {
    id: "patch-builder",
    mode: "subagent",
    name: "Patch Builder",
    description: "Implements the approved patch and records the patch candidate artifact.",
    allowedArtifactKind: "patch-candidate",
    prompt: buildWorkflowAgentPrompt({
      responsibility: "Modify only approved product files, keep the patch minimal, and capture implementation notes.",
      prohibited: [
        "Do not edit files outside the approved plan unless deviation is explicitly allowed and recorded.",
        "Do not skip tests that define the intended behavior.",
        "Do not self-approve the patch for review.",
      ],
      allowedArtifactKind: "patch-candidate",
      transitionGuidance: "Request building to verifying only after recording a ready_for_verification patch-candidate artifact.",
      notes: ["This is the only workflow role allowed to modify product code."],
    }),
  }
}
