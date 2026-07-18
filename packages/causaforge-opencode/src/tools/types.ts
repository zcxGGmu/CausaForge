import type {
  ArtifactKind,
  TransitionRequest,
  WorkflowAgentId,
  WorkflowArtifactChain,
  WorkflowArtifactStore,
  WorkflowPhase,
  WorkflowState,
  TestSuiteManifest,
} from "@causaforge/core"
import type { WorkflowOpenCodeConfig } from "../config/schema"

export interface WorkflowGitResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface WorkflowGitRunner {
  run(args: string[]): Promise<WorkflowGitResult>
}

export interface WorkflowCommandRunnerRequest {
  argv: string[]
  cwd: string
  timeoutMs?: number
}

export interface WorkflowCommandRunner {
  run(request: WorkflowCommandRunnerRequest): Promise<WorkflowGitResult>
}

export interface WorkflowToolDeps {
  cwd: string
  config: WorkflowOpenCodeConfig
  store: WorkflowArtifactStore
  git: WorkflowGitRunner
  commandRunner: WorkflowCommandRunner
}

export interface WorkflowTool<Input, Output> {
  name: WorkflowToolName
  description: string
  execute(input: Input): Promise<Output>
}

export type WorkflowToolName =
  | "workflow_start"
  | "workflow_status"
  | "workflow_import_root_cause_blueprint"
  | "workflow_record_artifact"
  | "workflow_validate_artifact"
  | "workflow_capture_diff"
  | "workflow_run_verification"
  | "workflow_transition"
  | "workflow_return_to_phase"
  | "workflow_complete"

export interface WorkflowStartInput {
  workflowId: string
  entryMode: "problem-description" | "root-cause-import"
  rootCauseArtifactId?: string
  gitRoot?: string
  productRoot?: string
  now?: string
}

export interface WorkflowStatusInput {
  workflowId?: string
}

export interface WorkflowStatusOutput {
  workflowId: string
  phase: WorkflowPhase
  status: WorkflowState["status"]
  missing: ArtifactKind[]
}

export interface WorkflowImportRootCauseBlueprintInput {
  sourceDir: string
  workflowId?: string
  start?: boolean
  gitRoot?: string
  productRoot?: string
  now?: string
}

export interface WorkflowImportRootCauseBlueprintOutput {
  ok: true
  workflowId: string
  rootCauseArtifactId: string
  phase: WorkflowPhase | null
  artifactPath: string
  markdownPath: string
  sourceArchivePath: string
}

export interface WorkflowRecordArtifactInput {
  workflowId: string
  agentId: WorkflowAgentId
  artifactKind: ArtifactKind
  artifact: unknown
}

export interface WorkflowRecordArtifactOutput {
  artifactPath: string
  markdownPath: string | null
}

export interface WorkflowValidateArtifactInput {
  artifactKind: ArtifactKind
  artifact: unknown
}

export type WorkflowValidateArtifactOutput =
  | { ok: true; artifactId: string; workflowId: string }
  | { ok: false; error: string }

export interface WorkflowCaptureDiffInput {
  workflowId: string
}

export interface WorkflowCaptureDiffOutput {
  patchPath: string
  changedFiles: string[]
}

export interface WorkflowRunVerificationInput {
  workflowId: string
  patchCandidateArtifactId: string
  iteration: number
  manifest: TestSuiteManifest
  now?: string
}

export interface WorkflowRunVerificationOutput {
  workflowId: string
  iteration: number
  status: "pass" | "fail" | "infra_error"
  verificationRunArtifactId: string
  verificationArtifactId: string
  verificationRunPath: string
  verificationArtifactPath: string
}

export interface WorkflowTransitionInput extends Omit<TransitionRequest, "workflowId"> {
  workflowId: string
  artifacts?: WorkflowArtifactChain
  allowPlanDeviation?: boolean
  implementationPatchContent?: string
  deliveryPatchContent?: string
  now?: string
}

export type WorkflowTransitionOutput = WorkflowState

export interface WorkflowReturnToPhaseInput {
  workflowId: string
  targetPhase: WorkflowPhase
  requestedByAgent: WorkflowAgentId
  sessionId: string
  now?: string
}

export interface WorkflowCompleteInput {
  workflowId: string
  requestedByAgent: WorkflowAgentId
  sessionId: string
  artifacts?: WorkflowArtifactChain
  implementationPatchContent?: string
  deliveryPatchContent?: string
  now?: string
}

export interface WorkflowTools {
  workflow_start: WorkflowTool<WorkflowStartInput, WorkflowState>
  workflow_status: WorkflowTool<WorkflowStatusInput, WorkflowStatusOutput>
  workflow_import_root_cause_blueprint: WorkflowTool<WorkflowImportRootCauseBlueprintInput, WorkflowImportRootCauseBlueprintOutput>
  workflow_record_artifact: WorkflowTool<WorkflowRecordArtifactInput, WorkflowRecordArtifactOutput>
  workflow_validate_artifact: WorkflowTool<WorkflowValidateArtifactInput, WorkflowValidateArtifactOutput>
  workflow_capture_diff: WorkflowTool<WorkflowCaptureDiffInput, WorkflowCaptureDiffOutput>
  workflow_run_verification: WorkflowTool<WorkflowRunVerificationInput, WorkflowRunVerificationOutput>
  workflow_transition: WorkflowTool<WorkflowTransitionInput, WorkflowTransitionOutput>
  workflow_return_to_phase: WorkflowTool<WorkflowReturnToPhaseInput, WorkflowTransitionOutput>
  workflow_complete: WorkflowTool<WorkflowCompleteInput, WorkflowTransitionOutput>
}
