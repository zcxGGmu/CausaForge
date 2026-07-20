import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { DEFAULT_BLUEPRINT_CORPUS_RELATIVE_PATH, discoverBlueprintCorpus } from "./blueprint-corpus"

describe("blueprint corpus discovery", () => {
  test("discovers the fixed Agent3 corpus at .CausaForge/blueprint", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-corpus-"))
    try {
      await fs.mkdir(path.join(project, DEFAULT_BLUEPRINT_CORPUS_RELATIVE_PATH), { recursive: true })

      expect(discoverBlueprintCorpus(project)).toEqual({
        relativePath: ".CausaForge/blueprint",
        rootPath: path.join(project, ".CausaForge", "blueprint"),
      })
    } finally {
      await fs.rm(project, { recursive: true, force: true })
    }
  })

  test("returns null when the fixed Agent3 corpus is absent", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-corpus-"))
    try {
      expect(discoverBlueprintCorpus(project)).toBeNull()
    } finally {
      await fs.rm(project, { recursive: true, force: true })
    }
  })
})
