import fs from "node:fs"
import path from "node:path"

export const DEFAULT_BLUEPRINT_CORPUS_RELATIVE_PATH = ".CausaForge/blueprint"

export interface BlueprintCorpusMetadata {
  relativePath: string
  rootPath: string
}

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

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}
