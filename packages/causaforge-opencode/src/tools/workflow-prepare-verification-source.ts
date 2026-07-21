import fs from "node:fs/promises"
import path from "node:path"
import {
  type PatchPlanArtifact,
  type RepositoryPreparation,
  type TestSuiteManifest,
  type VerificationSourceArtifact,
  VerificationSourceArtifactSchema,
} from "@causaforge/core"
import type {
  WorkflowPrepareVerificationSourceInput,
  WorkflowPrepareVerificationSourceOutput,
  WorkflowTool,
  WorkflowToolDeps,
} from "./types"

const DEFAULT_TIMEOUT_SECONDS = 300
const DEFAULT_RUNNER_ID = "local"

type PreparedRepositoryCheckout = RepositoryPreparation & { checkoutPath: string }

export function createWorkflowPrepareVerificationSourceTool(
  deps: WorkflowToolDeps,
): WorkflowTool<WorkflowPrepareVerificationSourceInput, WorkflowPrepareVerificationSourceOutput> {
  return {
    name: "workflow_prepare_verification_source",
    description: "Select official or user-provided verification tests before running workflow verification.",
    async execute(input) {
      const state = await deps.store.readWorkflow(input.workflowId)
      if (!input.mode) {
        return {
          status: "decision_required",
          options: ["official", "user"],
          message: [
            "Verification source selection is required before running workflow_run_verification.",
            "Choose official if OpenCode should use the current software's official test suite.",
            "Choose user if the user will provide a concrete test program path.",
          ].join("\n"),
        }
      }

      const patchPlan = await deps.store.readArtifact<PatchPlanArtifact>(input.workflowId, "patch-plan")
      const runnerId = input.runnerId ?? DEFAULT_RUNNER_ID
      assertKnownRunner(deps, runnerId)
      const now = input.now ?? new Date().toISOString()
      const artifact = input.mode === "official"
        ? await buildOfficialSourceArtifact(deps, input.workflowId, patchPlan.artifactId, input.suitePath, runnerId, now, state.repositoryPreparations ?? [])
        : await buildUserSourceArtifact(deps, input.workflowId, patchPlan.artifactId, input.testPath, runnerId, now, state.productRoot ?? deps.cwd)
      const artifactPath = await deps.store.writeArtifact(input.workflowId, "verification-source", artifact)

      return {
        status: "ready",
        artifactPath,
        manifest: artifact.manifest,
      }
    },
  }
}

async function buildOfficialSourceArtifact(
  deps: WorkflowToolDeps,
  workflowId: string,
  patchPlanArtifactId: string,
  suitePath: string,
  runnerId: string,
  createdAt: string,
  repositoryPreparations: RepositoryPreparation[],
): Promise<VerificationSourceArtifact> {
  const readyPreparations = repositoryPreparations.filter(hasPreparedCheckout)
  if (readyPreparations.length === 0) {
    throw new Error("VERIFICATION_SOURCE_REPOSITORY_REQUIRED: prepare an OpenCode or manual checkout before selecting official tests")
  }

  const resolved = await resolveExistingOfficialSuitePath(deps.cwd, suitePath, readyPreparations)
  const preparation = selectPreparationForSuite(resolved.absolutePath, readyPreparations)
  const commandPath = toCommandPath(deps.cwd, resolved.absolutePath)
  const manifest = createManifest("official-test-suite", "official", runnerId, "official-tests", commandPath)

  return VerificationSourceArtifactSchema.parse({
    schemaVersion: "1.0",
    workflowId,
    artifactId: "verification-source-official",
    createdAt,
    patchPlanArtifactId,
    source: "official",
    manifest,
    official: {
      repositoryUrl: preparation.repositoryUrl,
      commitHash: preparation.commitHash,
      checkoutPath: preparation.checkoutPath,
      suitePath: commandPath,
    },
    user: null,
    status: "ready",
  } satisfies VerificationSourceArtifact)
}

async function buildUserSourceArtifact(
  deps: WorkflowToolDeps,
  workflowId: string,
  patchPlanArtifactId: string,
  testPath: string,
  runnerId: string,
  createdAt: string,
  productRoot: string,
): Promise<VerificationSourceArtifact> {
  const absolutePath = await resolveExistingUserTestPath(deps.cwd, productRoot, testPath)
  const commandPath = toCommandPath(deps.cwd, absolutePath)
  const manifest = createManifest("user-provided-suite", "user", runnerId, "user-provided-tests", commandPath)

  return VerificationSourceArtifactSchema.parse({
    schemaVersion: "1.0",
    workflowId,
    artifactId: "verification-source-user",
    createdAt,
    patchPlanArtifactId,
    source: "user",
    manifest,
    official: null,
    user: {
      providedPath: testPath,
      normalizedPath: absolutePath,
    },
    status: "ready",
  } satisfies VerificationSourceArtifact)
}

function createManifest(
  suiteId: string,
  source: TestSuiteManifest["source"],
  runnerId: string,
  commandId: string,
  testPath: string,
): TestSuiteManifest {
  return {
    suiteId,
    source,
    runnerId,
    commands: [
      {
        commandId,
        argv: ["bun", "test", testPath],
        required: true,
        timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
      },
    ],
  }
}

async function resolveExistingOfficialSuitePath(
  projectRoot: string,
  suitePath: string,
  preparations: PreparedRepositoryCheckout[],
): Promise<{ absolutePath: string }> {
  const candidates = [
    path.resolve(projectRoot, suitePath),
    ...preparations.flatMap((preparation) =>
      preparation.checkoutPath ? [path.resolve(preparation.checkoutPath, suitePath)] : []
    ),
  ]
  for (const candidate of candidates) {
    const preparation = selectPreparationForSuiteOrNull(candidate, preparations)
    if (!preparation) continue
    if (await pathExists(candidate)) return { absolutePath: candidate }
  }
  throw new Error(`VERIFICATION_SOURCE_TEST_PATH_NOT_FOUND: ${suitePath}`)
}

async function resolveExistingUserTestPath(projectRoot: string, productRoot: string, testPath: string): Promise<string> {
  const candidates = path.isAbsolute(testPath)
    ? [path.resolve(testPath)]
    : [path.resolve(productRoot, testPath), path.resolve(projectRoot, testPath)]
  for (const candidate of candidates) {
    if (!isInsideAnyRoot(candidate, [projectRoot, productRoot])) continue
    if (isWorkflowArtifactPath(projectRoot, candidate)) continue
    if (await pathExists(candidate)) return candidate
  }
  throw new Error(`VERIFICATION_SOURCE_TEST_PATH_NOT_FOUND: ${testPath}`)
}

function selectPreparationForSuite(
  absoluteSuitePath: string,
  preparations: PreparedRepositoryCheckout[],
): PreparedRepositoryCheckout {
  const found = selectPreparationForSuiteOrNull(absoluteSuitePath, preparations)
  if (!found) throw new Error("VERIFICATION_SOURCE_OUTSIDE_PREPARED_REPOSITORY")
  return found
}

function hasPreparedCheckout(preparation: RepositoryPreparation): preparation is PreparedRepositoryCheckout {
  return preparation.status === "ready" && typeof preparation.checkoutPath === "string" && preparation.checkoutPath.length > 0
}

function selectPreparationForSuiteOrNull(
  absoluteSuitePath: string,
  preparations: PreparedRepositoryCheckout[],
): PreparedRepositoryCheckout | null {
  return preparations.find((preparation) =>
    preparation.checkoutPath ? isInsideRoot(absoluteSuitePath, preparation.checkoutPath) : false
  ) ?? null
}

function toCommandPath(projectRoot: string, absolutePath: string): string {
  if (isInsideRoot(absolutePath, projectRoot)) {
    return path.relative(projectRoot, absolutePath).split(path.sep).join("/")
  }
  return absolutePath
}

function isInsideAnyRoot(targetPath: string, roots: string[]): boolean {
  return roots.some((root) => isInsideRoot(targetPath, root))
}

function isInsideRoot(targetPath: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(targetPath))
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function isWorkflowArtifactPath(projectRoot: string, targetPath: string): boolean {
  const relative = path.relative(projectRoot, targetPath).split(path.sep).join("/")
  return relative === ".workflow" || relative.startsWith(".workflow/")
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false
    throw error
  }
}

function assertKnownRunner(deps: WorkflowToolDeps, runnerId: string): void {
  if (!deps.config.verification.runners.some((runner) => runner.id === runnerId)) {
    throw new Error(`UNKNOWN_VERIFICATION_RUNNER: ${runnerId}`)
  }
}
