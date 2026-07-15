import fs from "node:fs/promises"
import path from "node:path"
import {
  type ArtifactKind,
  evaluateTransitionGuard,
  getWorkflowDir,
  type DeliveryArtifact,
  type PatchCandidateArtifact,
  type PatchPlanArtifact,
  type ReviewArtifact,
  type RootCauseArtifact,
  type VerificationArtifact,
  type WorkflowArtifactChain,
  type WorkflowArtifactStore,
} from "@causaforge/core"
import type { WorkflowTool, WorkflowToolDeps, WorkflowTransitionInput, WorkflowTransitionOutput } from "./types"

export function createWorkflowTransitionTool(deps: WorkflowToolDeps): WorkflowTool<WorkflowTransitionInput, WorkflowTransitionOutput> {
  return {
    name: "workflow_transition",
    description: "Evaluate workflow transition gates and persist the next state.",
    async execute(input) {
      const state = await deps.store.readWorkflow(input.workflowId)
      const artifacts = await readStoredArtifactChain(deps.store, input.workflowId)
      const implementationPatchContent = await readPatchContent(deps.cwd, input.workflowId, artifacts.patchCandidate?.patchPath)
      const deliveryPatchContent = await readPatchContent(deps.cwd, input.workflowId, artifacts.delivery?.patchPath)
      const result = evaluateTransitionGuard({
        state,
        request: {
          workflowId: input.workflowId,
          expectedPhase: input.expectedPhase,
          targetPhase: input.targetPhase,
          requestedByAgent: input.requestedByAgent,
          sessionId: input.sessionId,
        },
        artifacts,
        allowPlanDeviation: input.allowPlanDeviation ?? deps.config.allow_plan_deviation,
        implementationPatchContent,
        deliveryPatchContent,
        now: input.now,
      })
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.remediation}`)
      await deps.store.writeWorkflow(result.nextState)
      return result.nextState
    },
  }
}

async function readStoredArtifactChain(
  store: WorkflowArtifactStore,
  workflowId: string,
): Promise<WorkflowArtifactChain> {
  return {
    rootCause: await readArtifactIfPresent<RootCauseArtifact>(store, workflowId, "root-cause"),
    patchPlan: await readArtifactIfPresent<PatchPlanArtifact>(store, workflowId, "patch-plan"),
    patchCandidate: await readArtifactIfPresent<PatchCandidateArtifact>(store, workflowId, "patch-candidate"),
    verification: await readArtifactIfPresent<VerificationArtifact>(store, workflowId, "verification"),
    review: await readArtifactIfPresent<ReviewArtifact>(store, workflowId, "review"),
    delivery: await readArtifactIfPresent<DeliveryArtifact>(store, workflowId, "delivery"),
  }
}

async function readArtifactIfPresent<T>(
  store: WorkflowArtifactStore,
  workflowId: string,
  kind: ArtifactKind,
): Promise<T | undefined> {
  try {
    return await store.readArtifact<T>(workflowId, kind)
  } catch {
    return undefined
  }
}

async function readPatchContent(
  baseDir: string,
  workflowId: string,
  artifactPath: PatchCandidateArtifact["patchPath"] | DeliveryArtifact["patchPath"] | undefined,
): Promise<string | undefined> {
  const filePath = resolveWorkflowRelativePath(baseDir, workflowId, artifactPath)
  if (!filePath) return undefined

  try {
    return await fs.readFile(filePath, "utf8")
  } catch {
    return undefined
  }
}

function resolveWorkflowRelativePath(
  baseDir: string,
  workflowId: string,
  relativePath: string | undefined,
): string | null {
  if (!relativePath || path.isAbsolute(relativePath)) return null
  const workflowDir = getWorkflowDir(baseDir, workflowId)
  const resolved = path.resolve(workflowDir, relativePath)
  const relative = path.relative(workflowDir, resolved)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null
  return resolved
}
