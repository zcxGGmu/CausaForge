import path from "node:path"

export const ARTIFACT_ROOT_DIR = ".workflow"

export const ARTIFACT_KIND_PATHS = {
  "root-cause": ["root-cause", "root-cause.json"],
  "patch-plan": ["planning", "patch-plan.json"],
  "patch-candidate": ["implementation", "patch-candidate.json"],
  verification: ["verification", "verification.json"],
  review: ["review", "review.json"],
  delivery: ["delivery", "delivery-package.json"],
} as const

export type ArtifactKind = keyof typeof ARTIFACT_KIND_PATHS

export function assertSafeWorkflowId(workflowId: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(workflowId)) {
    throw new Error(`Invalid workflow ID: ${workflowId}`)
  }
}

export function getWorkflowDir(baseDir: string, workflowId: string): string {
  assertSafeWorkflowId(workflowId)
  return path.join(baseDir, ARTIFACT_ROOT_DIR, workflowId)
}

export function getWorkflowStatePath(baseDir: string, workflowId: string): string {
  return path.join(getWorkflowDir(baseDir, workflowId), "workflow.json")
}

export function getArtifactPath(baseDir: string, workflowId: string, kind: ArtifactKind): string {
  return path.join(getWorkflowDir(baseDir, workflowId), ...ARTIFACT_KIND_PATHS[kind])
}
