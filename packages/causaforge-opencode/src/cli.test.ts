import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { getArtifactPath, getWorkflowDir } from "@causaforge/core"

const timestamp = "2026-07-13T00:00:00.000Z"

describe("causaforge CLI", () => {
  test("imports a RootCauseBlueprint folder from the command line", async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-cli-project-"))
    const sourceDir = await makeBlueprintFolder(projectDir, "bp-cli")
    const cliPath = path.join(process.cwd(), "packages", "causaforge-opencode", "src", "cli.ts")

    const proc = Bun.spawn([
      "bun",
      cliPath,
      "import-root-cause",
      "--cwd",
      projectDir,
      "--source",
      sourceDir,
      "--workflow-id",
      "wf-cli",
      "--start",
      "--now",
      timestamp,
    ], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    expect(stderr).toBe("")
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout)).toMatchObject({
      ok: true,
      workflowId: "wf-cli",
      rootCauseArtifactId: "bp-cli",
      phase: "planning",
      artifactPath: getArtifactPath(projectDir, "wf-cli", "root-cause"),
      sourceArchivePath: path.join(getWorkflowDir(projectDir, "wf-cli"), "root-cause", "source"),
    })
  })
})

async function makeBlueprintFolder(baseDir: string, blueprintId: string): Promise<string> {
  const sourceDir = path.join(baseDir, "blueprints", blueprintId)
  await fs.mkdir(path.join(sourceDir, "evidence"), { recursive: true })
  await fs.mkdir(path.join(sourceDir, "files", "src"), { recursive: true })
  await fs.writeFile(path.join(sourceDir, "evidence", "failing-test.log"), "field missing\n")
  await fs.writeFile(path.join(sourceDir, "files", "src", "migrate.ts"), "export const migrated = false\n")
  await fs.writeFile(path.join(sourceDir, "manifest.json"), `${JSON.stringify({
    schemaVersion: "1.0",
    blueprintId,
    problemSummary: "Build fails after Agent3 detects migration drift.",
    reproductionEvidence: ["Agent3 reproduced the failing migration test."],
    evidenceFiles: ["evidence/failing-test.log"],
    observedBehavior: "The migrated field is missing.",
    expectedBehavior: "The migrated field is preserved.",
    rootCauseSummary: "The normalization step drops the migrated field.",
    causalChain: ["Migration loads the field.", "Normalization omits the field."],
    candidateFiles: ["files/src/migrate.ts"],
    constraints: ["Do not change unrelated migration behavior."],
    requiredTests: ["Run bun test src/migrate.test.ts"],
  }, null, 2)}\n`)
  return sourceDir
}
