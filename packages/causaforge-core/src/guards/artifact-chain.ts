import type {
  DeliveryArtifact,
  PatchCandidateArtifact,
  PatchPlanArtifact,
  ReviewArtifact,
  RootCauseArtifact,
  VerificationArtifact,
  WorkflowArtifactRefs,
} from "../schemas"

export interface WorkflowArtifactChain {
  rootCause?: RootCauseArtifact
  patchPlan?: PatchPlanArtifact
  patchCandidate?: PatchCandidateArtifact
  verification?: VerificationArtifact
  review?: ReviewArtifact
  delivery?: DeliveryArtifact
}

export function collectArtifactRefs(artifacts: WorkflowArtifactChain): WorkflowArtifactRefs {
  return {
    ...(artifacts.rootCause ? { rootCauseArtifactId: artifacts.rootCause.artifactId } : {}),
    ...(artifacts.patchPlan ? { patchPlanArtifactId: artifacts.patchPlan.artifactId } : {}),
    ...(artifacts.patchCandidate ? { patchCandidateArtifactId: artifacts.patchCandidate.artifactId } : {}),
    ...(artifacts.verification ? { verificationArtifactId: artifacts.verification.artifactId } : {}),
    ...(artifacts.review ? { reviewArtifactId: artifacts.review.artifactId } : {}),
    ...(artifacts.delivery ? { deliveryArtifactId: artifacts.delivery.artifactId } : {}),
  }
}

export function getArtifactWorkflowPairs(artifacts: WorkflowArtifactChain): Array<[string, string]> {
  return [
    ...(artifacts.rootCause ? [["root-cause", artifacts.rootCause.workflowId] as [string, string]] : []),
    ...(artifacts.patchPlan ? [["patch-plan", artifacts.patchPlan.workflowId] as [string, string]] : []),
    ...(artifacts.patchCandidate ? [["patch-candidate", artifacts.patchCandidate.workflowId] as [string, string]] : []),
    ...(artifacts.verification ? [["verification", artifacts.verification.workflowId] as [string, string]] : []),
    ...(artifacts.review ? [["review", artifacts.review.workflowId] as [string, string]] : []),
    ...(artifacts.delivery ? [["delivery", artifacts.delivery.workflowId] as [string, string]] : []),
  ]
}
