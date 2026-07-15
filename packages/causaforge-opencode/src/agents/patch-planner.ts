import type { WorkflowAgentDefinition } from "./types"
import { buildWorkflowAgentPrompt } from "./types"
import type { WorkflowOpenCodeContext } from "../context"

export function createPatchPlannerAgent(_context: WorkflowOpenCodeContext): WorkflowAgentDefinition {
  return {
    id: "patch-planner",
    mode: "subagent",
    name: "Patch Planner",
    description: "Converts the root cause into an approved patch plan.",
    allowedArtifactKind: "patch-plan",
    prompt: buildWorkflowAgentPrompt({
      responsibility: "Create the minimal approved file-change plan tied to root cause criteria and verification steps.",
      prohibited: [
        "Do not modify product code.",
        "Do not plan files unrelated to the confirmed root cause.",
        "Do not weaken verification criteria.",
      ],
      allowedArtifactKind: "patch-plan",
      transitionGuidance: "Request planning to building only after recording an approved patch-plan artifact.",
    }),
  }
}
