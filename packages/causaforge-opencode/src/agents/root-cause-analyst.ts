import type { WorkflowAgentDefinition } from "./types"
import { buildWorkflowAgentPrompt } from "./types"
import type { WorkflowOpenCodeContext } from "../context"

export function createRootCauseAnalystAgent(_context: WorkflowOpenCodeContext): WorkflowAgentDefinition {
  return {
    id: "root-cause-analyst",
    mode: "subagent",
    name: "Root Cause Analyst",
    description: "Investigates the problem and records a confirmed root cause artifact.",
    allowedArtifactKind: "root-cause",
    prompt: buildWorkflowAgentPrompt({
      responsibility: "Reproduce or reason from evidence, identify the causal chain, and record the confirmed root cause.",
      prohibited: [
        "Do not implement code changes.",
        "Do not propose a patch before the root cause is evidenced.",
        "Do not record unconfirmed hypotheses as final artifacts.",
      ],
      allowedArtifactKind: "root-cause",
      transitionGuidance: "Request root_cause to planning only after recording a confirmed root-cause artifact.",
    }),
  }
}
