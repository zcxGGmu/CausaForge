import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { createWorkflowArtifactStore, getArtifactPath, getVerificationRunPath, getWorkflowDir } from "@causaforge/core"
import { parseWorkflowConfig } from "../config/schema"
import { createWorkflowTools } from "./index"

const timestamp = "2026-07-13T00:00:00.000Z"

const rootCause = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
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
  workflowId: "wf-001",
  artifactId: "patch-plan-001",
  createdAt: timestamp,
  rootCauseArtifactId: rootCause.artifactId,
  objectives: ["Preserve the migrated field."],
  fileChanges: [
    { path: "src/migrate.ts", change: "Carry the legacy value forward.", rootCauseLinks: ["criterion-001"] },
  ],
  nonGoals: [],
  verificationPlan: ["Run migration tests."],
  risks: [],
  status: "approved" as const,
}

const patchCandidate = {
  schemaVersion: "1.0" as const,
  workflowId: "wf-001",
  artifactId: "patch-candidate-001",
  createdAt: timestamp,
  patchPlanArtifactId: patchPlan.artifactId,
  modifiedFiles: ["src/migrate.ts"],
  patchPath: "implementation/patch.diff",
  patchSummary: "Preserve the migrated field during normalization.",
  planDeviations: [],
  implementationNotes: ["Added the field to the normalized object."],
  status: "ready_for_verification" as const,
}

const manifest = {
  suiteId: "migration-suite",
  source: "user" as const,
  runnerId: "local",
  commands: [
    {
      commandId: "migration-tests",
      argv: ["bun", "test", "src/migrate.test.ts"],
      required: true,
      timeoutSeconds: 300,
    },
  ],
}

describe("workflow tools", () => {
  test("registers the deterministic workflow tool surface", async () => {
    const { tools } = await makeTools()

    expect(Object.keys(tools)).toEqual([
      "workflow_start",
      "workflow_status",
      "workflow_prepare_repository",
      "workflow_import_root_cause_blueprint",
      "workflow_record_artifact",
      "workflow_validate_artifact",
      "workflow_capture_diff",
      "workflow_prepare_verification_source",
      "workflow_run_verification",
      "workflow_transition",
      "workflow_return_to_phase",
      "workflow_complete",
    ])
  })

  test("starts a workflow and reports status", async () => {
    const { tools } = await makeTools()

    await tools.workflow_start.execute({
      workflowId: "wf-001",
      entryMode: "problem-description",
      now: timestamp,
    })

    const status = await tools.workflow_status.execute({ workflowId: "wf-001" })

    expect(status).toMatchObject({ workflowId: "wf-001", phase: "root_cause", missing: ["root-cause"] })
  })

  test("reports the only active workflow when workflowId is omitted", async () => {
    const { tools } = await makeTools()

    await tools.workflow_start.execute({
      workflowId: "wf-001",
      entryMode: "problem-description",
      now: timestamp,
    })

    const status = await tools.workflow_status.execute({} as never)

    expect(status).toMatchObject({ workflowId: "wf-001", phase: "root_cause", missing: ["root-cause"] })
  })

  test("starts workflows with pending repository preparations from blueprint metadata", async () => {
    const { baseDir, tools } = await makeTools()
    await makeSoftwareMetadata(baseDir, "redis")

    const state = await tools.workflow_start.execute({
      workflowId: "wf-001",
      entryMode: "problem-description",
      now: timestamp,
    })

    expect(state.repositoryPreparations).toEqual([
      {
        softwareName: "redis",
        repositoryUrl: "https://github.com/redis/redis.git",
        commitHash: "4f3c2b1a",
        metadataPath: ".CausaForge/blueprint/redis/metadata.json",
        status: "pending",
      },
    ])
  })

  test("prepare repository returns a user decision request before mode is selected", async () => {
    const { baseDir, tools } = await makeTools()
    await makeSoftwareMetadata(baseDir, "redis")
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    const result = await tools.workflow_prepare_repository.execute({ workflowId: "wf-001" })

    expect(result).toMatchObject({
      status: "decision_required",
      repositories: [
        {
          softwareName: "redis",
          repositoryUrl: "https://github.com/redis/redis.git",
          commitHash: "4f3c2b1a",
        },
      ],
      options: ["manual", "opencode"],
    })
  })

  test("prepare repository records manual source preparation", async () => {
    const { baseDir, store, tools } = await makeTools()
    await makeSoftwareMetadata(baseDir, "redis")
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    const result = await tools.workflow_prepare_repository.execute({
      workflowId: "wf-001",
      softwareName: "redis",
      mode: "manual",
      checkoutPath: "vendor/redis",
      now: timestamp,
    })

    expect(result).toMatchObject({ status: "ready" })
    expect((await store.readWorkflow("wf-001")).repositoryPreparations).toEqual([
      {
        softwareName: "redis",
        repositoryUrl: "https://github.com/redis/redis.git",
        commitHash: "4f3c2b1a",
        metadataPath: ".CausaForge/blueprint/redis/metadata.json",
        status: "ready",
        mode: "manual",
        checkoutPath: "vendor/redis",
        preparedAt: timestamp,
      },
    ])
  })

  test("prepare repository lets OpenCode clone and checkout the metadata commit", async () => {
    const { baseDir, gitCalls, store, tools } = await makeTools()
    await makeSoftwareMetadata(baseDir, "redis")
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    const result = await tools.workflow_prepare_repository.execute({
      workflowId: "wf-001",
      softwareName: "redis",
      mode: "opencode",
      now: timestamp,
    })

    const checkoutPath = path.join(baseDir, ".CausaForge", "repositories", "redis")
    expect(result).toMatchObject({ status: "ready" })
    expect(gitCalls).toEqual([
      ["clone", "https://github.com/redis/redis.git", checkoutPath],
      ["-C", checkoutPath, "checkout", "4f3c2b1a"],
    ])
    expect((await store.readWorkflow("wf-001")).repositoryPreparations?.[0]).toMatchObject({
      softwareName: "redis",
      status: "ready",
      mode: "opencode",
      checkoutPath,
      preparedAt: timestamp,
    })
  })

  test("imports a RootCauseBlueprint folder, archives the source, and starts planning", async () => {
    const { baseDir, store, tools } = await makeTools()
    const sourceDir = await makeBlueprintFolder(baseDir, "bp-001")

    const result = await tools.workflow_import_root_cause_blueprint.execute({
      sourceDir,
      workflowId: "wf-bp-001",
      start: true,
      now: timestamp,
    })

    expect(result).toMatchObject({
      ok: true,
      workflowId: "wf-bp-001",
      rootCauseArtifactId: "bp-001",
      phase: "planning",
      artifactPath: getArtifactPath(baseDir, "wf-bp-001", "root-cause"),
      markdownPath: path.join(getWorkflowDir(baseDir, "wf-bp-001"), "root-cause", "root-cause.md"),
      sourceArchivePath: path.join(getWorkflowDir(baseDir, "wf-bp-001"), "root-cause", "source"),
    })
    expect(await store.readWorkflow("wf-bp-001")).toMatchObject({
      phase: "planning",
      artifactRefs: { rootCauseArtifactId: "bp-001" },
    })
    expect(await store.readArtifact("wf-bp-001", "root-cause")).toMatchObject({
      workflowId: "wf-bp-001",
      artifactId: "bp-001",
      problemSummary: "Build fails after the blueprint producer detects migration drift.",
      affectedLocations: ["src/migrate.ts"],
      verificationCriteria: [
        { criterionId: "test-001", description: "Run bun test src/migrate.test.ts", required: true },
      ],
      sourceBlueprint: {
        blueprintId: "bp-001",
        manifestPath: "manifest.json",
        sourceArchivePath: "root-cause/source",
        evidenceFiles: ["evidence/failing-test.log"],
        candidateFiles: ["files/src/migrate.ts"],
      },
    })
    expect(await fs.readFile(path.join(result.sourceArchivePath, "evidence", "failing-test.log"), "utf8"))
      .toBe("field missing\n")
    expect(await fs.readFile(result.markdownPath, "utf8")).toContain("bp-001")
  })

  test("rejects unsafe RootCauseBlueprint manifest paths before writing workflow state", async () => {
    const { store, tools } = await makeTools()
    const sourceDir = await makeBlueprintFolder(await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-blueprint-")), "bp-unsafe", {
      evidenceFiles: ["../escape.log"],
    })

    await expect(tools.workflow_import_root_cause_blueprint.execute({
      sourceDir,
      workflowId: "wf-bp-unsafe",
      start: true,
      now: timestamp,
    })).rejects.toThrow("UNSAFE_BLUEPRINT_PATH")
    await expect(store.readWorkflow("wf-bp-unsafe")).rejects.toThrow()
  })

  test("records artifacts only when the agent owns that artifact kind", async () => {
    const { baseDir, tools } = await makeTools()
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    await expect(tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "patch-planner",
      artifactKind: "patch-candidate",
      artifact: patchPlan,
    })).rejects.toThrow("UNAUTHORIZED_AGENT")

    const result = await tools.workflow_record_artifact.execute({
      workflowId: "wf-001",
      agentId: "root-cause-analyst",
      artifactKind: "root-cause",
      artifact: rootCause,
    })

    expect(result).toMatchObject({ artifactPath: getArtifactPath(baseDir, "wf-001", "root-cause") })
    expect(result.markdownPath).toBe(path.join(getWorkflowDir(baseDir, "wf-001"), "root-cause", "root-cause.md"))
    expect(await fs.readFile(result.markdownPath!, "utf8")).toContain("root-cause-001")
  })

  test("rejects path traversal workflow IDs", async () => {
    const { tools } = await makeTools()

    await expect(tools.workflow_start.execute({
      workflowId: "../escape",
      entryMode: "problem-description",
      now: timestamp,
    })).rejects.toThrow("Invalid workflow ID")
  })

  test("captures git diff through the injected runner", async () => {
    const { baseDir, gitCalls, tools } = await makeTools({
      gitResult: {
        exitCode: 0,
        stdout: "diff --git a/src/migrate.ts b/src/migrate.ts\nindex 111..222 100644\n",
        stderr: "",
      },
    })
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    const result = await tools.workflow_capture_diff.execute({ workflowId: "wf-001" })

    expect(gitCalls).toEqual([["diff", "--binary", "--no-ext-diff"]])
    expect(result.changedFiles).toEqual(["src/migrate.ts"])
    expect(await fs.readFile(path.join(getWorkflowDir(baseDir, "wf-001"), "implementation", "patch.diff"), "utf8"))
      .toContain("diff --git")
  })

  test("captures git diff from the workflow git root when it differs from cwd", async () => {
    const { baseDir, gitCalls, tools } = await makeTools({
      gitResult: {
        exitCode: 0,
        stdout: "diff --git a/src/migrate.ts b/src/migrate.ts\nindex 111..222 100644\n",
        stderr: "",
      },
    })
    const gitRoot = path.join(baseDir, "repo")
    await tools.workflow_start.execute({
      workflowId: "wf-001",
      entryMode: "problem-description",
      gitRoot,
      now: timestamp,
    } as never)

    const result = await tools.workflow_capture_diff.execute({ workflowId: "wf-001" })

    expect(gitCalls).toEqual([["-C", gitRoot, "diff", "--binary", "--no-ext-diff"]])
    expect(result.changedFiles).toEqual(["src/migrate.ts"])
  })

  test("prepare verification source asks for official or user tests before verification", async () => {
    const { tools } = await makeTools()
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    const result = await tools.workflow_prepare_verification_source.execute({ workflowId: "wf-001" })

    expect(result).toMatchObject({
      status: "decision_required",
      options: ["official", "user"],
    })
  })

  test("prepare verification source records a user-provided test path and manifest", async () => {
    const { baseDir, store, tools } = await makeTools()
    await fs.mkdir(path.join(baseDir, "src"), { recursive: true })
    await fs.writeFile(path.join(baseDir, "src", "migrate.test.ts"), "test('migration', () => {})\n")
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)

    const result = await tools.workflow_prepare_verification_source.execute({
      workflowId: "wf-001",
      mode: "user",
      testPath: "src/migrate.test.ts",
      now: timestamp,
    })

    expect(result).toMatchObject({
      status: "ready",
      artifactPath: getArtifactPath(baseDir, "wf-001", "verification-source"),
      manifest: {
        suiteId: "user-provided-suite",
        source: "user",
        runnerId: "local",
        commands: [
          {
            commandId: "user-provided-tests",
            argv: ["bun", "test", "src/migrate.test.ts"],
            required: true,
            timeoutSeconds: 300,
          },
        ],
      },
    })
    expect(await store.readArtifact("wf-001", "verification-source")).toMatchObject({
      artifactId: "verification-source-user",
      patchPlanArtifactId: patchPlan.artifactId,
      source: "user",
      user: {
        providedPath: "src/migrate.test.ts",
        normalizedPath: path.join(baseDir, "src", "migrate.test.ts"),
      },
      official: null,
      status: "ready",
    })
  })

  test("prepare verification source records official tests from a prepared repository", async () => {
    const { baseDir, store, tools } = await makeTools()
    await makeSoftwareMetadata(baseDir, "redis")
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)
    await tools.workflow_prepare_repository.execute({
      workflowId: "wf-001",
      softwareName: "redis",
      mode: "opencode",
      now: timestamp,
    })
    const suitePath = path.join(".CausaForge", "repositories", "redis", "tests", "migration.test.ts")
    await fs.mkdir(path.dirname(path.join(baseDir, suitePath)), { recursive: true })
    await fs.writeFile(path.join(baseDir, suitePath), "test('official migration', () => {})\n")

    const result = await tools.workflow_prepare_verification_source.execute({
      workflowId: "wf-001",
      mode: "official",
      suitePath,
      now: timestamp,
    })

    expect(result).toMatchObject({
      status: "ready",
      manifest: {
        suiteId: "official-test-suite",
        source: "official",
        runnerId: "local",
        commands: [
          {
            commandId: "official-tests",
            argv: ["bun", "test", suitePath],
            required: true,
            timeoutSeconds: 300,
          },
        ],
      },
    })
    expect(await store.readArtifact("wf-001", "verification-source")).toMatchObject({
      artifactId: "verification-source-official",
      source: "official",
      official: {
        repositoryUrl: "https://github.com/redis/redis.git",
        commitHash: "4f3c2b1a",
        suitePath,
      },
      user: null,
      status: "ready",
    })
  })

  test("rejects verification until a matching verification source is selected", async () => {
    const { commandCalls, store, tools } = await makeTools()
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })
    await store.writeArtifact("wf-001", "root-cause", rootCause)
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)
    await store.writeArtifact("wf-001", "patch-candidate", patchCandidate)

    await expect(tools.workflow_run_verification.execute({
      workflowId: "wf-001",
      patchCandidateArtifactId: patchCandidate.artifactId,
      iteration: 1,
      manifest,
      now: timestamp,
    })).rejects.toThrow("VERIFICATION_SOURCE_REQUIRED")
    expect(commandCalls).toEqual([])
  })

  test("rejects verification manifests that differ from the selected source manifest", async () => {
    const { baseDir, commandCalls, store, tools } = await makeTools()
    await fs.mkdir(path.join(baseDir, "src"), { recursive: true })
    await fs.writeFile(path.join(baseDir, "src", "migrate.test.ts"), "test('migration', () => {})\n")
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })
    await store.writeArtifact("wf-001", "root-cause", rootCause)
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)
    await store.writeArtifact("wf-001", "patch-candidate", patchCandidate)
    const verificationSource = await tools.workflow_prepare_verification_source.execute({
      workflowId: "wf-001",
      mode: "user",
      testPath: "src/migrate.test.ts",
      now: timestamp,
    })

    await expect(tools.workflow_run_verification.execute({
      workflowId: "wf-001",
      patchCandidateArtifactId: patchCandidate.artifactId,
      iteration: 1,
      manifest: {
        ...manifest,
        commands: [{ ...manifest.commands[0], argv: ["bun", "test", "src/other.test.ts"] }],
      },
      now: timestamp,
    })).rejects.toThrow("VERIFICATION_MANIFEST_MISMATCH")
    expect(commandCalls).toEqual([])
  })

  test("runs verification manifests and preserves iteration history", async () => {
    const { baseDir, commandCalls, store, tools } = await makeTools({
      commandResults: [
        { exitCode: 1, stdout: "field missing", stderr: "expected field" },
        { exitCode: 0, stdout: "12 tests passed", stderr: "" },
      ],
    })
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })
    await fs.mkdir(path.join(baseDir, "src"), { recursive: true })
    await fs.writeFile(path.join(baseDir, "src", "migrate.test.ts"), "test('migration', () => {})\n")
    await store.writeArtifact("wf-001", "root-cause", rootCause)
    await store.writeArtifact("wf-001", "patch-plan", patchPlan)
    await store.writeArtifact("wf-001", "patch-candidate", patchCandidate)
    const verificationSource = await tools.workflow_prepare_verification_source.execute({
      workflowId: "wf-001",
      mode: "user",
      testPath: "src/migrate.test.ts",
      now: timestamp,
    })
    expect(verificationSource.status).toBe("ready")
    if (verificationSource.status !== "ready") throw new Error("verification source should be ready")

    const failed = await tools.workflow_run_verification.execute({
      workflowId: "wf-001",
      patchCandidateArtifactId: patchCandidate.artifactId,
      iteration: 1,
      manifest: verificationSource.manifest,
      now: timestamp,
    })

    expect(failed.status).toBe("fail")
    expect(failed.verificationRunPath).toBe(getVerificationRunPath(baseDir, "wf-001", 1))
    expect(commandCalls[0]).toMatchObject({
      argv: ["bun", "test", "src/migrate.test.ts"],
      cwd: baseDir,
      timeoutMs: 300_000,
    })
    expect(await fs.readFile(path.join(getWorkflowDir(baseDir, "wf-001"), "iterations", "0001", "logs", "user-provided-tests.stdout.txt"), "utf8"))
      .toBe("field missing")
    expect((await store.readArtifact("wf-001", "verification"))).toMatchObject({ status: "fail" })

    const passed = await tools.workflow_run_verification.execute({
      workflowId: "wf-001",
      patchCandidateArtifactId: patchCandidate.artifactId,
      iteration: 2,
      manifest: verificationSource.manifest,
      now: "2026-07-13T00:05:00.000Z",
    })

    expect(passed.status).toBe("pass")
    expect(await store.listVerificationRuns("wf-001")).toHaveLength(2)
    expect(await store.readLatestVerificationRun("wf-001")).toMatchObject({ artifactId: "verification-run-0002", status: "pass" })
    expect((await store.readArtifact("wf-001", "verification"))).toMatchObject({
      artifactId: "verification-0002",
      status: "pass",
    })
  })

  test("rejects verification beyond the configured iteration limit before running commands", async () => {
    const { commandCalls, tools } = await makeTools()

    await expect(tools.workflow_run_verification.execute({
      workflowId: "wf-001",
      patchCandidateArtifactId: patchCandidate.artifactId,
      iteration: 6,
      manifest,
      now: timestamp,
    })).rejects.toThrow("MAX_ITERATIONS_EXCEEDED: 6 > 5")
    expect(commandCalls).toEqual([])
  })


  test("return to phase rejects terminal or forward targets", async () => {
    const { tools } = await makeTools()
    await tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })

    await expect(tools.workflow_return_to_phase.execute({
      workflowId: "wf-001",
      targetPhase: "blocked",
      requestedByAgent: "workflow-orchestrator",
      sessionId: "session-001",
      now: timestamp,
    })).rejects.toThrow("workflow_return_to_phase requires an earlier non-terminal phase")
  })

  test("fails capture when git fails or diff is empty", async () => {
    const failed = await makeTools({ gitResult: { exitCode: 1, stdout: "", stderr: "fatal" } })
    await failed.tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })
    await expect(failed.tools.workflow_capture_diff.execute({ workflowId: "wf-001" })).rejects.toThrow("Git diff failed")

    const empty = await makeTools({ gitResult: { exitCode: 0, stdout: "", stderr: "" } })
    await empty.tools.workflow_start.execute({ workflowId: "wf-001", entryMode: "problem-description", now: timestamp })
    await expect(empty.tools.workflow_capture_diff.execute({ workflowId: "wf-001" })).rejects.toThrow("No diff captured")
  })
})

async function makeTools(options: {
  gitResult?: { exitCode: number; stdout: string; stderr: string }
  commandResults?: Array<{ exitCode: number; stdout: string; stderr: string }>
} = {}) {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-opencode-tools-"))
  const store = createWorkflowArtifactStore(baseDir)
  const gitCalls: string[][] = []
  const commandCalls: Array<{ argv: string[]; cwd: string; timeoutMs?: number }> = []
  const tools = createWorkflowTools({
    cwd: baseDir,
    config: parseWorkflowConfig({}),
    store,
    git: {
      async run(args: string[]) {
        gitCalls.push(args)
        return options.gitResult ?? { exitCode: 0, stdout: "", stderr: "" }
      },
    },
    commandRunner: {
      async run(request) {
        commandCalls.push(request)
        return options.commandResults?.shift() ?? { exitCode: 0, stdout: "", stderr: "" }
      },
    },
  })
  return { baseDir, commandCalls, gitCalls, store, tools }
}

async function makeBlueprintFolder(
  baseDir: string,
  blueprintId: string,
  overrides: Partial<Record<"evidenceFiles" | "candidateFiles", string[]>> = {},
): Promise<string> {
  const sourceDir = path.join(baseDir, "blueprints", blueprintId)
  await fs.mkdir(path.join(sourceDir, "evidence"), { recursive: true })
  await fs.mkdir(path.join(sourceDir, "files", "src"), { recursive: true })
  await fs.writeFile(path.join(sourceDir, "evidence", "failing-test.log"), "field missing\n")
  await fs.writeFile(path.join(sourceDir, "files", "src", "migrate.ts"), "export const migrated = false\n")
  await fs.writeFile(path.join(sourceDir, "manifest.json"), `${JSON.stringify({
    schemaVersion: "1.0",
    blueprintId,
    problemSummary: "Build fails after the blueprint producer detects migration drift.",
    reproductionEvidence: ["The blueprint producer reproduced the failing migration test."],
    evidenceFiles: overrides.evidenceFiles ?? ["evidence/failing-test.log"],
    observedBehavior: "The migrated field is missing.",
    expectedBehavior: "The migrated field is preserved.",
    rootCauseSummary: "The normalization step drops the migrated field.",
    causalChain: ["Migration loads the field.", "Normalization omits the field."],
    candidateFiles: overrides.candidateFiles ?? ["files/src/migrate.ts"],
    constraints: ["Do not change unrelated migration behavior."],
    requiredTests: ["Run bun test src/migrate.test.ts"],
  }, null, 2)}\n`)
  return sourceDir
}

async function makeSoftwareMetadata(baseDir: string, softwareName: string): Promise<void> {
  const metadataDir = path.join(baseDir, ".CausaForge", "blueprint", softwareName)
  await fs.mkdir(metadataDir, { recursive: true })
  await fs.writeFile(path.join(metadataDir, "metadata.json"), `${JSON.stringify({
    repository_url: `https://github.com/${softwareName}/${softwareName}.git`,
    commit_hash: "4f3c2b1a",
  }, null, 2)}\n`)
}
