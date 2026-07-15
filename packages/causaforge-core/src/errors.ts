import type { WorkflowPhase } from "./types"

export type WorkflowErrorCode =
  | "INVALID_PHASE"
  | "INVALID_TRANSITION"
  | "MISSING_ARTIFACT"
  | "INVALID_ARTIFACT"
  | "ARTIFACT_REFERENCE_MISMATCH"
  | "UNAUTHORIZED_AGENT"
  | "UNAUTHORIZED_TOOL"
  | "SESSION_INDEPENDENCE_VIOLATION"
  | "PLAN_SCOPE_VIOLATION"
  | "WORKTREE_NOT_CLEAN"
  | "VERIFICATION_FAILED"
  | "REVIEW_BLOCKED"
  | "DELIVERY_INCOMPLETE"
  | "LEGACY_CONFIGURATION_UNSUPPORTED"

export interface WorkflowError {
  workflowId: string
  phase: WorkflowPhase
  operation: string
  code: WorkflowErrorCode
  remediation: string
  artifactPath: string | null
}
