import fs from "node:fs/promises"
import path from "node:path"
import type { RepositoryPreparation } from "@causaforge/core"
import type {
  WorkflowPrepareRepositoryInput,
  WorkflowPrepareRepositoryOutput,
  WorkflowTool,
  WorkflowToolDeps,
} from "./types"

export function createWorkflowPrepareRepositoryTool(
  deps: WorkflowToolDeps,
): WorkflowTool<WorkflowPrepareRepositoryInput, WorkflowPrepareRepositoryOutput> {
  return {
    name: "workflow_prepare_repository",
    description: "Prompt for and record source repository preparation required by Agent3 blueprint metadata.",
    async execute(input) {
      const state = await deps.store.readWorkflow(input.workflowId)
      const preparations = state.repositoryPreparations ?? []
      if (preparations.length === 0) return { status: "not_required", repositories: [] }

      if (!input.mode) {
        return {
          status: "decision_required",
          repositories: preparations,
          options: ["manual", "opencode"],
          message: renderDecisionMessage(preparations),
        }
      }

      const target = selectPreparation(preparations, input.softwareName)
      const now = input.now ?? new Date().toISOString()
      const updatedPreparation = input.mode === "manual"
        ? markManualPreparation(target, input.checkoutPath, now)
        : await prepareWithOpenCode(deps, target, now)
      const nextPreparations = preparations.map((preparation) =>
        preparation.softwareName === updatedPreparation.softwareName ? updatedPreparation : preparation
      )

      await deps.store.writeWorkflow({
        ...state,
        repositoryPreparations: nextPreparations,
        updatedAt: now,
      })

      return {
        status: nextPreparations.every((preparation) => preparation.status === "ready") ? "ready" : "decision_required",
        repositories: nextPreparations,
        ...(!nextPreparations.every((preparation) => preparation.status === "ready")
          ? {
              options: ["manual", "opencode"] as ["manual", "opencode"],
              message: renderDecisionMessage(nextPreparations.filter((preparation) => preparation.status === "pending")),
            }
          : {}),
      } as WorkflowPrepareRepositoryOutput
    },
  }
}

function renderDecisionMessage(preparations: RepositoryPreparation[]): string {
  const lines = preparations.map((preparation) =>
    `${preparation.softwareName}: ${preparation.repositoryUrl} @ ${preparation.commitHash}`
  )
  return [
    "Repository preparation is required before continuing the CausaForge workflow.",
    ...lines,
    "Choose manual if the user will prepare the checkout, or opencode if OpenCode should clone and checkout the commit.",
  ].join("\n")
}

function selectPreparation(
  preparations: RepositoryPreparation[],
  softwareName: string | undefined,
): RepositoryPreparation {
  const pending = preparations.filter((preparation) => preparation.status === "pending")
  if (pending.length === 0) throw new Error("REPOSITORY_PREPARATION_ALREADY_READY")
  if (softwareName) {
    const found = pending.find((preparation) => preparation.softwareName === softwareName)
    if (!found) throw new Error(`REPOSITORY_PREPARATION_NOT_FOUND: ${softwareName}`)
    return found
  }
  if (pending.length > 1) throw new Error("MULTIPLE_REPOSITORY_PREPARATIONS: specify softwareName")
  return pending[0]
}

function markManualPreparation(
  preparation: RepositoryPreparation,
  checkoutPath: string | undefined,
  preparedAt: string,
): RepositoryPreparation {
  return {
    ...preparation,
    status: "ready",
    mode: "manual",
    ...(checkoutPath ? { checkoutPath } : {}),
    preparedAt,
  }
}

async function prepareWithOpenCode(
  deps: WorkflowToolDeps,
  preparation: RepositoryPreparation,
  preparedAt: string,
): Promise<RepositoryPreparation> {
  const checkoutPath = path.join(deps.cwd, ".CausaForge", "repositories", preparation.softwareName)
  await fs.mkdir(path.dirname(checkoutPath), { recursive: true })

  if (await directoryExists(checkoutPath)) {
    await runGitOrThrow(deps, ["-C", checkoutPath, "fetch", "--all"], "git fetch failed")
  } else {
    await runGitOrThrow(deps, ["clone", preparation.repositoryUrl, checkoutPath], "git clone failed")
  }
  await runGitOrThrow(deps, ["-C", checkoutPath, "checkout", preparation.commitHash], "git checkout failed")

  return {
    ...preparation,
    status: "ready",
    mode: "opencode",
    checkoutPath,
    preparedAt,
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    return (await fs.lstat(dirPath)).isDirectory()
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false
    throw error
  }
}

async function runGitOrThrow(deps: WorkflowToolDeps, args: string[], message: string): Promise<void> {
  const result = await deps.git.run(args)
  if (result.exitCode !== 0) {
    throw new Error(`REPOSITORY_PREPARATION_FAILED: ${message}: ${result.stderr || result.stdout}`)
  }
}
