import fs from "node:fs/promises"
import path from "node:path"
import {
  formatIteration,
  getWorkflowDir,
  TestSuiteManifestSchema,
  VerificationRunArtifactSchema,
  type PatchCandidateArtifact,
  type RootCauseArtifact,
  type TestSuiteManifest,
  type VerificationArtifact,
  type VerificationCommand,
  type VerificationRunArtifact,
  type VerificationRunCommandResult,
} from "@causaforge/core"
import { z } from "zod"
import type { WorkflowVerificationRunnerConfig } from "../config/schema"
import type {
  WorkflowCommandRunnerRequest,
  WorkflowRunVerificationInput,
  WorkflowRunVerificationOutput,
  WorkflowTool,
  WorkflowToolDeps,
} from "./types"

const WorkflowRunVerificationInputSchema = z.object({
  workflowId: z.string().min(1),
  patchCandidateArtifactId: z.string().min(1),
  iteration: z.number().int().positive(),
  manifest: TestSuiteManifestSchema,
  now: z.string().datetime().optional(),
})

export function createWorkflowRunVerificationTool(
  deps: WorkflowToolDeps,
): WorkflowTool<WorkflowRunVerificationInput, WorkflowRunVerificationOutput> {
  return {
    name: "workflow_run_verification",
    description: "Run a controlled verification manifest and preserve per-iteration evidence.",
    async execute(input) {
      const parsed = WorkflowRunVerificationInputSchema.parse(input)
      if (parsed.iteration > deps.config.verification.max_iterations) {
        throw new Error(`MAX_ITERATIONS_EXCEEDED: ${parsed.iteration} > ${deps.config.verification.max_iterations}`)
      }

      const rootCause = await deps.store.readArtifact<RootCauseArtifact>(parsed.workflowId, "root-cause")
      const patchCandidate = await deps.store.readArtifact<PatchCandidateArtifact>(parsed.workflowId, "patch-candidate")
      if (patchCandidate.artifactId !== parsed.patchCandidateArtifactId) {
        throw new Error("PATCH_CANDIDATE_MISMATCH: verification must target the active patch candidate")
      }

      const runner = getRunner(deps.config.verification.runners, parsed.manifest.runnerId)
      const commandResults = await runManifestCommands(deps, parsed.workflowId, parsed.iteration, runner, parsed.manifest, parsed.now)
      const status = commandResults.every((command) => !command.required || command.status === "pass") ? "pass" : "fail"
      const now = parsed.now ?? new Date().toISOString()
      const verificationRun = VerificationRunArtifactSchema.parse({
        schemaVersion: "1.0",
        workflowId: parsed.workflowId,
        artifactId: `verification-run-${formatIteration(parsed.iteration)}`,
        createdAt: now,
        iteration: parsed.iteration,
        patchCandidateArtifactId: patchCandidate.artifactId,
        runner: {
          runnerId: runner.id,
          type: runner.type,
          target: runner.type === "local" ? `local:${runner.cwd}` : `ssh:${runner.host}:${runner.cwd}`,
        },
        manifest: parsed.manifest,
        commands: commandResults,
        failureSignature: status === "pass" ? null : buildFailureSignature(commandResults),
        status,
      } satisfies VerificationRunArtifact)
      const verificationRunPath = await deps.store.writeVerificationRun(parsed.workflowId, verificationRun)

      const verification = buildVerificationArtifact(rootCause, patchCandidate, verificationRun, now)
      const verificationArtifactPath = await deps.store.writeArtifact(parsed.workflowId, "verification", verification)

      return {
        workflowId: parsed.workflowId,
        iteration: parsed.iteration,
        status,
        verificationRunArtifactId: verificationRun.artifactId,
        verificationArtifactId: verification.artifactId,
        verificationRunPath,
        verificationArtifactPath,
      }
    },
  }
}

async function runManifestCommands(
  deps: WorkflowToolDeps,
  workflowId: string,
  iteration: number,
  runner: WorkflowVerificationRunnerConfig,
  manifest: TestSuiteManifest,
  now: string | undefined,
): Promise<VerificationRunCommandResult[]> {
  const results: VerificationRunCommandResult[] = []
  for (const command of manifest.commands) {
    assertAllowedCommand(runner, command)
    const request = createCommandRunnerRequest(deps.cwd, runner, command)
    const startedAt = now ?? new Date().toISOString()
    const result = await deps.commandRunner.run(request)
    const completedAt = now ?? new Date().toISOString()
    const stdoutPath = await writeCommandLog(deps.cwd, workflowId, iteration, command.commandId, "stdout", result.stdout)
    const stderrPath = await writeCommandLog(deps.cwd, workflowId, iteration, command.commandId, "stderr", result.stderr)

    results.push({
      commandId: command.commandId,
      argv: command.argv,
      required: command.required,
      exitCode: result.exitCode,
      status: result.exitCode === 0 ? "pass" : "fail",
      startedAt,
      completedAt,
      stdoutPath,
      stderrPath,
    })
  }
  return results
}

function getRunner(runners: WorkflowVerificationRunnerConfig[], runnerId: string): WorkflowVerificationRunnerConfig {
  const runner = runners.find((candidate) => candidate.id === runnerId)
  if (!runner) throw new Error(`UNKNOWN_VERIFICATION_RUNNER: ${runnerId}`)
  return runner
}

function assertAllowedCommand(runner: WorkflowVerificationRunnerConfig, command: VerificationCommand): void {
  if (runner.allowedCommands.some((allowedPrefix) => matchesPrefix(command.argv, allowedPrefix))) return
  throw new Error(`VERIFICATION_COMMAND_NOT_ALLOWED: ${command.argv.join(" ")}`)
}

function matchesPrefix(argv: string[], prefix: string[]): boolean {
  if (prefix.length > argv.length) return false
  return prefix.every((part, index) => argv[index] === part)
}

function createCommandRunnerRequest(
  projectRoot: string,
  runner: WorkflowVerificationRunnerConfig,
  command: VerificationCommand,
): WorkflowCommandRunnerRequest {
  const timeoutMs = command.timeoutSeconds * 1000
  if (runner.type === "local") {
    return {
      argv: command.argv,
      cwd: resolveProjectRelativeCwd(projectRoot, runner.cwd),
      timeoutMs,
    }
  }

  return {
    argv: ["ssh", runner.host, `cd ${quoteShellArg(runner.cwd)} && ${command.argv.map(quoteShellArg).join(" ")}`],
    cwd: projectRoot,
    timeoutMs,
  }
}

function resolveProjectRelativeCwd(projectRoot: string, runnerCwd: string): string {
  const resolved = path.resolve(projectRoot, runnerCwd)
  const relative = path.relative(projectRoot, resolved)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("VERIFICATION_RUNNER_CWD_OUTSIDE_PROJECT")
  }
  return resolved
}

async function writeCommandLog(
  projectRoot: string,
  workflowId: string,
  iteration: number,
  commandId: string,
  stream: "stdout" | "stderr",
  content: string,
): Promise<string> {
  const safeCommandId = toSafeFileToken(commandId)
  const relativePath = path.join("iterations", formatIteration(iteration), "logs", `${safeCommandId}.${stream}.txt`)
  const fullPath = path.join(getWorkflowDir(projectRoot, workflowId), relativePath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content)
  return relativePath
}

function toSafeFileToken(value: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`UNSAFE_COMMAND_ID: ${value}`)
  }
  return value
}

function buildFailureSignature(commands: VerificationRunCommandResult[]): string {
  return commands
    .filter((command) => command.required && command.status !== "pass")
    .map((command) => `${command.commandId}:${command.exitCode}`)
    .join("|") || "no-required-command-failure"
}

function buildVerificationArtifact(
  rootCause: RootCauseArtifact,
  patchCandidate: PatchCandidateArtifact,
  verificationRun: VerificationRunArtifact,
  now: string,
): VerificationArtifact {
  const status = verificationRun.status === "pass" ? "pass" : "fail"
  return {
    schemaVersion: "1.0",
    workflowId: verificationRun.workflowId,
    artifactId: `verification-${formatIteration(verificationRun.iteration)}`,
    createdAt: now,
    patchCandidateArtifactId: patchCandidate.artifactId,
    commands: verificationRun.commands.map((command) => ({
      command: command.argv.join(" "),
      exitCode: command.exitCode,
    })),
    checks: verificationRun.commands.map((command) => ({
      name: command.commandId,
      required: command.required,
      status: command.status,
      evidence: `${command.stdoutPath}; ${command.stderrPath}`,
    })),
    criteria: rootCause.verificationCriteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      status: status === "pass" ? "pass" : criterion.required ? "fail" : "skipped",
      evidence: `Verification run ${verificationRun.artifactId} status: ${status}.`,
    })),
    omissions: [],
    residualRisks: status === "pass" ? [] : [`Failure signature: ${verificationRun.failureSignature ?? "unknown"}`],
    status,
  }
}

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
