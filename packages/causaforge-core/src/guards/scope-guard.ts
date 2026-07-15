import type { PatchCandidateArtifact, PatchPlanArtifact } from "../schemas"

export interface ScopeGuardOptions {
  allowPlanDeviation?: boolean
}

export function findOutOfScopeFiles(
  patchPlan: PatchPlanArtifact,
  patchCandidate: PatchCandidateArtifact,
  options: ScopeGuardOptions = {},
): string[] {
  if (options.allowPlanDeviation) return []

  const approvedPaths = new Set(patchPlan.fileChanges.map((change) => change.path))
  return patchCandidate.modifiedFiles.filter((filePath) => !approvedPaths.has(filePath))
}

export function isWithinApprovedScope(
  patchPlan: PatchPlanArtifact,
  patchCandidate: PatchCandidateArtifact,
  options: ScopeGuardOptions = {},
): boolean {
  return findOutOfScopeFiles(patchPlan, patchCandidate, options).length === 0
}
