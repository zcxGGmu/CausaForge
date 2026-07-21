import type { ArtifactKind } from "./artifacts"
import type { WorkflowAgentId } from "./types"

const PRODUCT_CODE_AGENTS = new Set<WorkflowAgentId>(["patch-builder"])

const ARTIFACT_WRITERS: Readonly<Record<ArtifactKind, WorkflowAgentId>> = {
  "root-cause": "root-cause-analyst",
  "patch-plan": "patch-planner",
  "patch-candidate": "patch-builder",
  "verification-source": "regression-verifier",
  verification: "regression-verifier",
  review: "patch-reviewer",
  delivery: "delivery-coordinator",
}

export function canModifyProductCode(agentId: WorkflowAgentId): boolean {
  return PRODUCT_CODE_AGENTS.has(agentId)
}

export function canWriteArtifact(agentId: WorkflowAgentId, artifactKind: ArtifactKind): boolean {
  return ARTIFACT_WRITERS[artifactKind] === agentId
}

export function getArtifactWriter(artifactKind: ArtifactKind): WorkflowAgentId {
  return ARTIFACT_WRITERS[artifactKind]
}
