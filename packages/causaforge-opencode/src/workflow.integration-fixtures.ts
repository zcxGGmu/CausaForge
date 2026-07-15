import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  getArtifactPath,
  parseArtifact,
  WorkflowStateSchema,
  type ArtifactKind,
  type WorkflowArtifactStore,
  type WorkflowState,
} from "@causaforge/core"
import { createWorkflowPlugin, type WorkflowPlugin } from "./plugin"
import type { WorkflowGitResult } from "./tools"

export const timestamp = "2026-07-13T00:00:00.000Z"
export const nextTimestamp = "2026-07-13T00:05:00.000Z"
export const finalTimestamp = "2026-07-13T00:10:00.000Z"
export const implementationPatch = "diff --git a/src/migrate.ts b/src/migrate.ts\nindex 111..222 100644\n"

export type WorkflowHarness = {
  baseDir: string
  gitCalls: string[][]
  plugin: WorkflowPlugin
  store: InMemoryWorkflowStore
}

export class InMemoryWorkflowStore implements WorkflowArtifactStore {
  readonly states = new Map<string, WorkflowState>()
  readonly artifacts = new Map<string, unknown>()

  constructor(readonly baseDir: string) {}

  async initializeWorkflow(state: WorkflowState): Promise<void> {
    const parsed = WorkflowStateSchema.parse(state)
    this.states.set(parsed.workflowId, parsed)
  }

  async listWorkflows(): Promise<WorkflowState[]> {
    return [...this.states.values()].sort((a, b) => a.workflowId.localeCompare(b.workflowId))
  }

  async readWorkflow(workflowId: string): Promise<WorkflowState> {
    const state = this.states.get(workflowId)
    if (!state) throw new Error(`Workflow not found: ${workflowId}`)
    return WorkflowStateSchema.parse(state)
  }

  async writeWorkflow(state: WorkflowState): Promise<void> {
    const parsed = WorkflowStateSchema.parse(state)
    this.states.set(parsed.workflowId, parsed)
  }

  async readArtifact<T = unknown>(workflowId: string, kind: ArtifactKind): Promise<T> {
    const artifact = this.artifacts.get(key(workflowId, kind))
    if (!artifact) throw new Error(`Artifact not found: ${workflowId}/${kind}`)
    return parseArtifact(kind, artifact) as T
  }

  async writeArtifact<T = unknown>(workflowId: string, kind: ArtifactKind, value: T): Promise<string> {
    const parsed = parseArtifact(kind, value)
    if (parsed.workflowId !== workflowId) {
      throw new Error(`Artifact ${kind} workflowId ${parsed.workflowId} does not match target workflow ${workflowId}`)
    }
    this.artifacts.set(key(workflowId, kind), parsed)
    const artifactPath = getArtifactPath(this.baseDir, workflowId, kind)
    await fs.mkdir(path.dirname(artifactPath), { recursive: true })
    return artifactPath
  }

  async artifactExists(workflowId: string, kind: ArtifactKind): Promise<boolean> {
    return this.artifacts.has(key(workflowId, kind))
  }
}

export async function createHarness(options: { gitResult?: WorkflowGitResult } = {}): Promise<WorkflowHarness> {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-opencode-integration-"))
  const store = new InMemoryWorkflowStore(baseDir)
  const gitCalls: string[][] = []
  const plugin = createWorkflowPlugin({
    cwd: baseDir,
    store,
    git: {
      async run(args) {
        gitCalls.push(args)
        return options.gitResult ?? { exitCode: 0, stdout: implementationPatch, stderr: "" }
      },
    },
  })

  return { baseDir, gitCalls, plugin, store }
}

export function makeArtifactChain(workflowId = "wf-001") {
  const rootCause = {
    schemaVersion: "1.0" as const,
    workflowId,
    artifactId: "root-cause-001",
    createdAt: timestamp,
    problemSummary: "Build fails after configuration migration.",
    reproductionEvidence: ["Run bun test and observe the failing migration test."],
    observedBehavior: "The migrated configuration omits the required field.",
    expectedBehavior: "The migrated configuration preserves the required field.",
    rootCauseSummary: "The migration drops the field during normalization.",
    causalChain: ["Migration reads the legacy value.", "Normalization discards the value."],
    affectedLocations: ["src/migrate.ts"],
    constraints: ["Preserve backward compatibility."],
    verificationCriteria: [
      { criterionId: "criterion-001", description: "The migrated field is preserved.", required: true },
    ],
    status: "confirmed" as const,
  }

  const patchPlan = {
    schemaVersion: "1.0" as const,
    workflowId,
    artifactId: "patch-plan-001",
    createdAt: timestamp,
    rootCauseArtifactId: rootCause.artifactId,
    objectives: ["Preserve the migrated field."],
    fileChanges: [
      {
        path: "src/migrate.ts",
        change: "Carry the legacy value into the normalized configuration.",
        rootCauseLinks: ["criterion-001"],
      },
    ],
    nonGoals: ["Redesign the configuration format."],
    verificationPlan: ["Run the migration unit tests."],
    risks: [],
    status: "approved" as const,
  }

  const patchCandidate = {
    schemaVersion: "1.0" as const,
    workflowId,
    artifactId: "patch-candidate-001",
    createdAt: timestamp,
    patchPlanArtifactId: patchPlan.artifactId,
    modifiedFiles: ["src/migrate.ts"],
    patchPath: "implementation/patch.diff",
    patchSummary: "Preserve the migrated field.",
    planDeviations: [],
    implementationNotes: ["Copied the legacy value through normalization."],
    status: "ready_for_verification" as const,
  }

  const verification = {
    schemaVersion: "1.0" as const,
    workflowId,
    artifactId: "verification-001",
    createdAt: timestamp,
    patchCandidateArtifactId: patchCandidate.artifactId,
    commands: [{ command: "bun test src/migrate.test.ts", exitCode: 0 }],
    checks: [{ name: "migration unit tests", required: true, status: "pass" as const, evidence: "12 tests passed." }],
    criteria: [{ criterionId: "criterion-001", status: "pass" as const, evidence: "Field preserved." }],
    omissions: [],
    residualRisks: [],
    status: "pass" as const,
  }

  const review = {
    schemaVersion: "1.0" as const,
    workflowId,
    artifactId: "review-001",
    createdAt: timestamp,
    patchCandidateArtifactId: patchCandidate.artifactId,
    verificationArtifactId: verification.artifactId,
    reviewerSessionId: "session-reviewer-001",
    findings: [],
    rootCauseEliminated: true,
    withinApprovedScope: true,
    verificationSufficient: true,
    status: "pass" as const,
  }

  const delivery = {
    schemaVersion: "1.0" as const,
    workflowId,
    artifactId: "delivery-001",
    createdAt: timestamp,
    rootCauseArtifactId: rootCause.artifactId,
    patchPlanArtifactId: patchPlan.artifactId,
    patchCandidateArtifactId: patchCandidate.artifactId,
    verificationArtifactId: verification.artifactId,
    reviewArtifactId: review.artifactId,
    fixSummary: "The migration now preserves the legacy field.",
    verificationSummary: "Migration tests pass.",
    reviewSummary: "Independent review found no blocking issues.",
    residualRisks: [],
    handoffInstructions: ["Apply delivery/patch.diff."],
    patchPath: "delivery/patch.diff",
    status: "complete" as const,
  }

  return { rootCause, patchPlan, patchCandidate, verification, review, delivery }
}

export function stateIn(phase: WorkflowState["phase"], artifactRefs: WorkflowState["artifactRefs"] = {}): WorkflowState {
  return {
    schemaVersion: "1.0",
    workflowId: "wf-001",
    phase,
    status: "active",
    entryMode: "problem-description",
    artifactRefs,
    builderSessionId: phase === "verifying" ? "session-builder-001" : null,
    reviewerSessionId: phase === "reviewing" ? "session-reviewer-001" : null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  }
}

function key(workflowId: string, kind: ArtifactKind): string {
  return `${workflowId}:${kind}`
}
