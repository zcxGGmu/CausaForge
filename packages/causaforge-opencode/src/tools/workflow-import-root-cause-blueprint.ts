import fs from "node:fs/promises"
import path from "node:path"
import { getWorkflowDir, type RootCauseArtifact, type VerificationCriterion, type WorkflowState } from "@causaforge/core"
import { z } from "zod"
import { renderArtifactMarkdown } from "./markdown"
import type {
  WorkflowImportRootCauseBlueprintInput,
  WorkflowImportRootCauseBlueprintOutput,
  WorkflowTool,
  WorkflowToolDeps,
} from "./types"
import { createWorkflowStartTool } from "./workflow-start"

const NonEmptyStringSchema = z.string().min(1)
const BlueprintCriterionSchema = z.object({
  criterionId: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  required: z.boolean().default(true),
})
const BlueprintManifestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  blueprintId: NonEmptyStringSchema,
  workflowId: NonEmptyStringSchema.optional(),
  problemSummary: NonEmptyStringSchema,
  reproductionEvidence: z.array(NonEmptyStringSchema).optional(),
  evidenceFiles: z.array(NonEmptyStringSchema).optional(),
  observedBehavior: NonEmptyStringSchema,
  expectedBehavior: NonEmptyStringSchema,
  rootCauseSummary: NonEmptyStringSchema,
  causalChain: z.array(NonEmptyStringSchema).optional(),
  affectedLocations: z.array(NonEmptyStringSchema).optional(),
  candidateFiles: z.array(NonEmptyStringSchema).optional(),
  constraints: z.array(NonEmptyStringSchema).optional(),
  verificationCriteria: z.array(BlueprintCriterionSchema).optional(),
  requiredTests: z.array(NonEmptyStringSchema).optional(),
}).passthrough()

type BlueprintManifest = z.infer<typeof BlueprintManifestSchema>

export function createWorkflowImportRootCauseBlueprintTool(
  deps: WorkflowToolDeps,
): WorkflowTool<WorkflowImportRootCauseBlueprintInput, WorkflowImportRootCauseBlueprintOutput> {
  return {
    name: "workflow_import_root_cause_blueprint",
    description: "Import an external RootCauseBlueprint directory as a CausaForge root-cause artifact.",
    async execute(input) {
      const sourceDir = path.resolve(deps.cwd, input.sourceDir)
      await assertDirectory(sourceDir, "BLUEPRINT_SOURCE_NOT_FOUND")
      const manifest = await readBlueprintManifest(sourceDir)
      const workflowId = input.workflowId ?? manifest.workflowId ?? deriveWorkflowId(manifest.blueprintId)
      const now = input.now ?? new Date().toISOString()
      const evidenceFiles = validateRelativePathList(manifest.evidenceFiles ?? [], "evidenceFiles")
      const candidateFiles = validateRelativePathList(manifest.candidateFiles ?? [], "candidateFiles")

      await assertReferencedFiles(sourceDir, [...evidenceFiles, ...candidateFiles])

      const rootCause = createRootCauseArtifact({
        manifest,
        workflowId,
        now,
        evidenceFiles,
        candidateFiles,
      })
      const archivePath = path.join(getWorkflowDir(deps.cwd, workflowId), "root-cause", "source")
      await archiveBlueprintSource(sourceDir, archivePath)
      const artifactPath = await deps.store.writeArtifact(workflowId, "root-cause", rootCause)
      const markdownPath = artifactPath.replace(/\.json$/, ".md")
      await fs.writeFile(markdownPath, `${renderArtifactMarkdown("root-cause", rootCause)}\n`)

      let state: WorkflowState | null = null
      if (input.start !== false) {
        state = await createWorkflowStartTool(deps).execute({
          workflowId,
          entryMode: "root-cause-import",
          rootCauseArtifactId: rootCause.artifactId,
          gitRoot: input.gitRoot,
          productRoot: input.productRoot,
          now,
        })
      }

      return {
        ok: true,
        workflowId,
        rootCauseArtifactId: rootCause.artifactId,
        phase: state?.phase ?? null,
        artifactPath,
        markdownPath,
        sourceArchivePath: archivePath,
      }
    },
  }
}

async function readBlueprintManifest(sourceDir: string): Promise<BlueprintManifest> {
  const manifestPath = path.join(sourceDir, "manifest.json")
  let raw: string
  try {
    raw = await fs.readFile(manifestPath, "utf8")
  } catch (error) {
    if (isMissingPathError(error)) throw new Error("BLUEPRINT_MANIFEST_NOT_FOUND: manifest.json is required")
    throw error
  }

  try {
    return BlueprintManifestSchema.parse(JSON.parse(raw))
  } catch (error) {
    throw new Error(`BLUEPRINT_MANIFEST_INVALID: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function createRootCauseArtifact(input: {
  manifest: BlueprintManifest
  workflowId: string
  now: string
  evidenceFiles: string[]
  candidateFiles: string[]
}): RootCauseArtifact {
  const reproductionEvidence = [
    ...(input.manifest.reproductionEvidence ?? []),
    ...input.evidenceFiles.map((filePath) => `Evidence file: ${filePath}`),
  ]
  if (reproductionEvidence.length === 0) {
    throw new Error("BLUEPRINT_MANIFEST_INCOMPLETE: reproductionEvidence or evidenceFiles is required")
  }

  const affectedLocations = input.manifest.affectedLocations?.length
    ? input.manifest.affectedLocations
    : input.candidateFiles.map(toAffectedLocation)
  if (affectedLocations.length === 0) {
    throw new Error("BLUEPRINT_MANIFEST_INCOMPLETE: affectedLocations or candidateFiles is required")
  }

  return {
    schemaVersion: "1.0",
    workflowId: input.workflowId,
    artifactId: input.manifest.blueprintId,
    createdAt: input.now,
    problemSummary: input.manifest.problemSummary,
    reproductionEvidence,
    observedBehavior: input.manifest.observedBehavior,
    expectedBehavior: input.manifest.expectedBehavior,
    rootCauseSummary: input.manifest.rootCauseSummary,
    causalChain: input.manifest.causalChain?.length ? input.manifest.causalChain : [input.manifest.rootCauseSummary],
    affectedLocations,
    constraints: input.manifest.constraints ?? [],
    verificationCriteria: createVerificationCriteria(input.manifest),
    sourceBlueprint: {
      blueprintId: input.manifest.blueprintId,
      manifestPath: "manifest.json",
      sourceArchivePath: "root-cause/source",
      evidenceFiles: input.evidenceFiles,
      candidateFiles: input.candidateFiles,
    },
    status: "confirmed",
  }
}

function createVerificationCriteria(manifest: BlueprintManifest): VerificationCriterion[] {
  if (manifest.verificationCriteria?.length) return manifest.verificationCriteria

  if (!manifest.requiredTests?.length) {
    throw new Error("BLUEPRINT_MANIFEST_INCOMPLETE: verificationCriteria or requiredTests is required")
  }

  return manifest.requiredTests.map((description, index) => ({
    criterionId: `test-${String(index + 1).padStart(3, "0")}`,
    description,
    required: true,
  }))
}

function validateRelativePathList(paths: string[], fieldName: string): string[] {
  return paths.map((filePath) => validateRelativePath(filePath, fieldName))
}

function validateRelativePath(filePath: string, fieldName: string): string {
  const normalized = filePath.replace(/\\/g, "/")
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`UNSAFE_BLUEPRINT_PATH: ${fieldName} contains unsafe path ${filePath}`)
  }
  return normalized
}

async function assertReferencedFiles(sourceDir: string, filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    const resolved = path.resolve(sourceDir, ...filePath.split("/"))
    if (!isInsideDirectory(sourceDir, resolved)) {
      throw new Error(`UNSAFE_BLUEPRINT_PATH: ${filePath}`)
    }
    const stat = await fs.lstat(resolved).catch((error) => {
      if (isMissingPathError(error)) throw new Error(`BLUEPRINT_FILE_NOT_FOUND: ${filePath}`)
      throw error
    })
    if (!stat.isFile()) throw new Error(`BLUEPRINT_FILE_NOT_FOUND: ${filePath}`)
  }
}

async function archiveBlueprintSource(sourceDir: string, archivePath: string): Promise<void> {
  const sourceRoot = path.resolve(sourceDir)
  const archiveRoot = path.resolve(archivePath)
  if (isInsideDirectory(sourceRoot, archiveRoot)) {
    throw new Error("UNSAFE_BLUEPRINT_PATH: archive target cannot be inside source directory")
  }
  await fs.rm(archiveRoot, { recursive: true, force: true })
  await copyDirectory(sourceRoot, archiveRoot)
}

async function copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
  const stat = await fs.lstat(sourcePath)
  if (stat.isSymbolicLink()) throw new Error(`UNSAFE_BLUEPRINT_PATH: symlink is not allowed ${sourcePath}`)
  if (stat.isDirectory()) {
    await fs.mkdir(targetPath, { recursive: true })
    const entries = await fs.readdir(sourcePath, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      await copyDirectory(path.join(sourcePath, entry.name), path.join(targetPath, entry.name))
    }
    return
  }
  if (!stat.isFile()) throw new Error(`UNSAFE_BLUEPRINT_PATH: unsupported file type ${sourcePath}`)
  await fs.copyFile(sourcePath, targetPath)
}

async function assertDirectory(dirPath: string, errorCode: string): Promise<void> {
  const stat = await fs.lstat(dirPath).catch((error) => {
    if (isMissingPathError(error)) throw new Error(`${errorCode}: ${dirPath}`)
    throw error
  })
  if (!stat.isDirectory()) throw new Error(`${errorCode}: ${dirPath}`)
}

function deriveWorkflowId(blueprintId: string): string {
  const slug = blueprintId.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
  if (!slug) throw new Error(`Invalid workflow ID: ${blueprintId}`)
  return `wf-${slug}`
}

function toAffectedLocation(filePath: string): string {
  return filePath.startsWith("files/") ? filePath.slice("files/".length) : filePath
}

function isInsideDirectory(parentDir: string, childPath: string): boolean {
  const relative = path.relative(path.resolve(parentDir), path.resolve(childPath))
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}
