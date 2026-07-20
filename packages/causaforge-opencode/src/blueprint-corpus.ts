import fs from "node:fs"
import path from "node:path"
import { z } from "zod"

export const DEFAULT_BLUEPRINT_CORPUS_RELATIVE_PATH = ".CausaForge/blueprint"

export interface BlueprintCorpusMetadata {
  relativePath: string
  rootPath: string
}

export interface BlueprintSoftwareRepositoryMetadata {
  softwareName: string
  repositoryUrl: string
  commitHash: string
  metadataPath: string
  relativeMetadataPath: string
}

const SoftwareRepositoryMetadataSchema = z.object({
  repository_url: z.string().min(1),
  commit_hash: z.string().min(1),
}).passthrough()

export function discoverBlueprintCorpus(cwd: string): BlueprintCorpusMetadata | null {
  const rootPath = path.resolve(cwd, ...DEFAULT_BLUEPRINT_CORPUS_RELATIVE_PATH.split("/"))

  let stat: fs.Stats
  try {
    stat = fs.lstatSync(rootPath)
  } catch (error) {
    if (isMissingPathError(error)) return null
    throw error
  }

  if (!stat.isDirectory()) return null

  return {
    relativePath: DEFAULT_BLUEPRINT_CORPUS_RELATIVE_PATH,
    rootPath,
  }
}

export function discoverBlueprintSoftwareRepositories(cwd: string): BlueprintSoftwareRepositoryMetadata[] {
  const corpus = discoverBlueprintCorpus(cwd)
  if (!corpus) return []

  return fs.readdirSync(corpus.rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSoftwareRepositoryMetadata(cwd, corpus.rootPath, entry.name))
    .filter((metadata): metadata is BlueprintSoftwareRepositoryMetadata => metadata !== null)
    .sort((a, b) => a.softwareName.localeCompare(b.softwareName))
}

function readSoftwareRepositoryMetadata(
  cwd: string,
  corpusRootPath: string,
  softwareName: string,
): BlueprintSoftwareRepositoryMetadata | null {
  const metadataPath = path.join(corpusRootPath, softwareName, "metadata.json")
  let raw: string
  try {
    raw = fs.readFileSync(metadataPath, "utf8")
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(`BLUEPRINT_SOFTWARE_METADATA_MISSING: ${metadataPath}`)
    }
    throw error
  }

  try {
    const parsed = SoftwareRepositoryMetadataSchema.parse(JSON.parse(raw))
    return {
      softwareName,
      repositoryUrl: parsed.repository_url,
      commitHash: parsed.commit_hash,
      metadataPath,
      relativeMetadataPath: normalizeRelativePath(path.relative(cwd, metadataPath)),
    }
  } catch (error) {
    throw new Error(`BLUEPRINT_SOFTWARE_METADATA_INVALID: ${metadataPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/")
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}
