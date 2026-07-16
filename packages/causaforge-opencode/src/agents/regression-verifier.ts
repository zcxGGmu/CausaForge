import type { WorkflowAgentDefinition } from "./types"
import { buildWorkflowAgentPrompt } from "./types"
import type { WorkflowOpenCodeContext } from "../context"

export function createRegressionVerifierAgent(_context: WorkflowOpenCodeContext): WorkflowAgentDefinition {
  return {
    id: "regression-verifier",
    mode: "subagent",
    name: "Regression Verifier",
    description: "Runs verification and records evidence against the root cause criteria.",
    allowedArtifactKind: "verification",
    prompt: buildWorkflowAgentPrompt({
      responsibility: "Run controlled test manifests through workflow_run_verification, then record commands, results, omissions, and residual risk.",
      prohibited: [
        "Do not modify product code.",
        "Do not mark verification pass with failed required checks.",
        "Do not omit command output or skipped checks from evidence.",
      ],
      allowedArtifactKind: "verification",
      transitionGuidance: "Request verifying to reviewing only after workflow_run_verification records a passing verification artifact.",
    }),
  }
}
