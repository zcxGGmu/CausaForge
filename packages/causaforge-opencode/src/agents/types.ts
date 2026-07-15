import type { ArtifactKind, WorkflowAgentId } from "@causaforge/core"
import type { WorkflowAgentOverride } from "../config/schema"
import type { WorkflowOpenCodeContext } from "../context"

export type WorkflowAgentMode = "primary" | "subagent"

export interface WorkflowAgentDefinition extends WorkflowAgentOverride {
  id: WorkflowAgentId
  mode: WorkflowAgentMode
  name: string
  description: string
  allowedArtifactKind: ArtifactKind | null
  prompt: string
}

export type WorkflowAgentRegistry = Record<WorkflowAgentId, WorkflowAgentDefinition>
export type WorkflowAgentFactory = (context: WorkflowOpenCodeContext) => WorkflowAgentDefinition

export interface WorkflowAgentPromptParts {
  responsibility: string
  prohibited: string[]
  allowedArtifactKind: ArtifactKind | null
  transitionGuidance: string
  notes?: string[]
}

export function buildWorkflowAgentPrompt(parts: WorkflowAgentPromptParts): string {
  return [
    `Current responsibility: ${parts.responsibility}`,
    ["Prohibited:", ...parts.prohibited.map((item) => `- ${item}`)].join("\n"),
    `Allowed artifact kind: ${parts.allowedArtifactKind ?? "none"}`,
    `State transitions: ${parts.transitionGuidance}`,
    "Request state transitions through workflow_transition after recording required evidence.",
    "Do not edit workflow.json directly; use workflow tools and let the store persist state.",
    ...(parts.notes && parts.notes.length > 0 ? [["Notes:", ...parts.notes.map((item) => `- ${item}`)].join("\n")] : []),
  ].join("\n\n")
}
