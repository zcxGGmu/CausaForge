import { canTransition } from "../transitions"
import type { WorkflowError, WorkflowErrorCode } from "../errors"
import {
  validateVerificationAgainstRootCause,
  WorkflowStateSchema,
  type WorkflowState,
} from "../schemas"
import type { WorkflowAgentId, WorkflowPhase } from "../types"
import { collectArtifactRefs, getArtifactWorkflowPairs, type WorkflowArtifactChain } from "./artifact-chain"
import { findOutOfScopeFiles } from "./scope-guard"
import { isIndependentReviewSession } from "./session-guard"

export interface TransitionRequest {
  workflowId: string
  expectedPhase: WorkflowPhase
  targetPhase: WorkflowPhase
  requestedByAgent: WorkflowAgentId
  sessionId: string
}

export interface TransitionGuardInput {
  state: WorkflowState
  request: TransitionRequest
  artifacts?: WorkflowArtifactChain
  allowPlanDeviation?: boolean
  implementationPatchContent?: string
  deliveryPatchContent?: string
  now?: string
}

export type TransitionGuardResult =
  | { ok: true; nextState: WorkflowState }
  | { ok: false; error: WorkflowError }

export function evaluateTransitionGuard(input: TransitionGuardInput): TransitionGuardResult {
  const artifacts = input.artifacts ?? {}
  const baseError = validateBaseTransition(input)
  if (baseError) return fail(baseError)

  const workflowOwnershipError = validateArtifactWorkflowIds(input.state, input.request.workflowId, artifacts)
  if (workflowOwnershipError) return fail(workflowOwnershipError)

  const gateError = validatePhaseGate(input, artifacts)
  if (gateError) return fail(gateError)

  return {
    ok: true,
    nextState: buildNextState(input, artifacts),
  }
}

function validateBaseTransition(input: TransitionGuardInput): WorkflowError | null {
  const { state, request } = input
  if (state.workflowId !== request.workflowId) {
    return createError(state, "transition", "INVALID_TRANSITION", "Use the workflow state that matches the requested workflow ID.")
  }
  if (state.phase !== request.expectedPhase) {
    return createError(state, "transition", "INVALID_TRANSITION", "Reload workflow state before requesting the transition.")
  }
  if (!canTransition(request.expectedPhase, request.targetPhase)) {
    return createError(state, "transition", "INVALID_TRANSITION", "Request a transition allowed by the workflow lifecycle.")
  }
  return null
}

function validateArtifactWorkflowIds(
  state: WorkflowState,
  workflowId: string,
  artifacts: WorkflowArtifactChain,
): WorkflowError | null {
  for (const [artifactKind, artifactWorkflowId] of getArtifactWorkflowPairs(artifacts)) {
    if (artifactWorkflowId !== workflowId) {
      return createError(
        state,
        "artifact-chain",
        "INVALID_ARTIFACT",
        `Use a ${artifactKind} artifact that belongs to workflow ${workflowId}.`,
      )
    }
  }
  return null
}

function validatePhaseGate(input: TransitionGuardInput, artifacts: WorkflowArtifactChain): WorkflowError | null {
  const { state, request } = input
  const transition = `${request.expectedPhase}->${request.targetPhase}`

  if (transition === "root_cause->planning" && !artifacts.rootCause) {
    return createError(state, "root-cause-gate", "MISSING_ARTIFACT", "Record a confirmed root cause artifact before planning.")
  }

  if (transition === "planning->building") {
    const rootCause = artifacts.rootCause
    const patchPlan = artifacts.patchPlan
    if (!rootCause || !patchPlan) return requireArtifacts(state, artifacts, ["rootCause", "patchPlan"])
    if (patchPlan.rootCauseArtifactId !== rootCause.artifactId) {
      return createError(state, "patch-plan-gate", "ARTIFACT_REFERENCE_MISMATCH", "Patch plan must reference the active root cause artifact.")
    }
  }

  if (transition === "building->verifying") {
    const patchPlan = artifacts.patchPlan
    const patchCandidate = artifacts.patchCandidate
    if (!patchPlan || !patchCandidate) return requireArtifacts(state, artifacts, ["patchPlan", "patchCandidate"])
    if (patchCandidate.patchPlanArtifactId !== patchPlan.artifactId) {
      return createError(state, "scope-gate", "ARTIFACT_REFERENCE_MISMATCH", "Patch candidate must reference the active patch plan artifact.")
    }
    const outOfScopeFiles = findOutOfScopeFiles(patchPlan, patchCandidate, {
      allowPlanDeviation: input.allowPlanDeviation,
    })
    if (outOfScopeFiles.length > 0) {
      return createError(state, "scope-gate", "PLAN_SCOPE_VIOLATION", `Remove unapproved file changes: ${outOfScopeFiles.join(", ")}.`)
    }
  }

  if (transition === "verifying->reviewing") {
    const rootCause = artifacts.rootCause
    const patchCandidate = artifacts.patchCandidate
    const verification = artifacts.verification
    if (!rootCause || !patchCandidate || !verification) {
      return requireArtifacts(state, artifacts, ["rootCause", "patchCandidate", "verification"])
    }
    if (verification.patchCandidateArtifactId !== patchCandidate.artifactId) {
      return createError(state, "verification-gate", "ARTIFACT_REFERENCE_MISMATCH", "Verification must reference the active patch candidate.")
    }
    if (verification.status !== "pass") {
      return createError(state, "verification-gate", "VERIFICATION_FAILED", "Fix the patch and rerun verification before review.")
    }
    try {
      validateVerificationAgainstRootCause(rootCause, verification)
    } catch {
      return createError(state, "verification-gate", "VERIFICATION_FAILED", "Verification must satisfy every required root cause criterion.")
    }
    if (!isIndependentReviewSession(state.builderSessionId, request.sessionId)) {
      return createError(
        state,
        "session-gate",
        "SESSION_INDEPENDENCE_VIOLATION",
        "Use an independent reviewer session that differs from the builder session.",
      )
    }
  }

  if (transition === "reviewing->delivering") {
    const patchCandidate = artifacts.patchCandidate
    const verification = artifacts.verification
    const review = artifacts.review
    if (!patchCandidate || !verification || !review) {
      return requireArtifacts(state, artifacts, ["patchCandidate", "verification", "review"])
    }
    if (review.patchCandidateArtifactId !== patchCandidate.artifactId || review.verificationArtifactId !== verification.artifactId) {
      return createError(state, "review-gate", "ARTIFACT_REFERENCE_MISMATCH", "Review must reference the active patch candidate and verification.")
    }
    if (review.status !== "pass") {
      return createError(state, "review-gate", "REVIEW_BLOCKED", "Resolve blocking review findings before delivery.")
    }
  }

  if (transition === "delivering->completed") {
    const rootCause = artifacts.rootCause
    const patchPlan = artifacts.patchPlan
    const patchCandidate = artifacts.patchCandidate
    const verification = artifacts.verification
    const review = artifacts.review
    const delivery = artifacts.delivery
    if (!rootCause || !patchPlan || !patchCandidate || !verification || !review || !delivery) {
      return requireArtifacts(state, artifacts, ["rootCause", "patchPlan", "patchCandidate", "verification", "review", "delivery"])
    }
    if (delivery.status !== "complete") {
      return createError(state, "delivery-gate", "DELIVERY_INCOMPLETE", "Complete the delivery package before closing the workflow.")
    }
    if (
      delivery.rootCauseArtifactId !== rootCause.artifactId ||
      delivery.patchPlanArtifactId !== patchPlan.artifactId ||
      delivery.patchCandidateArtifactId !== patchCandidate.artifactId ||
      delivery.verificationArtifactId !== verification.artifactId ||
      delivery.reviewArtifactId !== review.artifactId
    ) {
      return createError(state, "delivery-gate", "ARTIFACT_REFERENCE_MISMATCH", "Delivery must reference the active artifact chain.")
    }
    if (input.implementationPatchContent === undefined || input.deliveryPatchContent === undefined) {
      return createError(state, "delivery-gate", "DELIVERY_INCOMPLETE", "Delivery and implementation patch contents are required before closing the workflow.")
    }
    if (input.implementationPatchContent !== input.deliveryPatchContent) {
      return createError(state, "delivery-gate", "DELIVERY_INCOMPLETE", "Delivery patch content must match the implementation patch content.")
    }
  }

  return null
}

function requireArtifacts(
  state: WorkflowState,
  artifacts: WorkflowArtifactChain,
  requiredKeys: Array<keyof WorkflowArtifactChain>,
): WorkflowError | null {
  const missing = requiredKeys.find((key) => artifacts[key] === undefined)
  if (!missing) return null
  return createError(state, "artifact-chain", "MISSING_ARTIFACT", `Record the required ${String(missing)} artifact before transitioning.`)
}

function buildNextState(input: TransitionGuardInput, artifacts: WorkflowArtifactChain): WorkflowState {
  const now = input.now ?? new Date().toISOString()
  const targetPhase = input.request.targetPhase
  const nextState = {
    ...input.state,
    phase: targetPhase,
    status: targetPhase === "completed" ? "completed" as const : targetPhase === "blocked" ? "blocked" as const : "active" as const,
    artifactRefs: {
      ...input.state.artifactRefs,
      ...collectArtifactRefs(artifacts),
    },
    builderSessionId: targetPhase === "building" ? input.request.sessionId
                    : targetPhase === "verifying" ? input.request.sessionId
                    : input.state.builderSessionId,
    reviewerSessionId: targetPhase === "reviewing" ? input.request.sessionId : input.state.reviewerSessionId,
    updatedAt: now,
    completedAt: targetPhase === "completed" ? now : null,
  }
  return WorkflowStateSchema.parse(nextState)
}

function fail(error: WorkflowError): TransitionGuardResult {
  return { ok: false, error }
}

function createError(
  state: WorkflowState,
  operation: string,
  code: WorkflowErrorCode,
  remediation: string,
): WorkflowError {
  return {
    workflowId: state.workflowId,
    phase: state.phase,
    operation,
    code,
    remediation,
    artifactPath: null,
  }
}
