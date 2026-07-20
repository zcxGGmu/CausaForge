import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import {
  DEFAULT_BLUEPRINT_CORPUS_RELATIVE_PATH,
  discoverBlueprintCorpus,
  discoverBlueprintSoftwareRepositories,
} from "./blueprint-corpus"

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

  test("discovers software repository metadata from software-named folders", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-corpus-"))
    try {
      const metadataDir = path.join(project, ".CausaForge", "blueprint", "redis")
      await fs.mkdir(metadataDir, { recursive: true })
      await fs.writeFile(path.join(metadataDir, "metadata.json"), `${JSON.stringify({
        repository_url: "https://github.com/redis/redis.git",
        commit_hash: "4f3c2b1a",
      }, null, 2)}\n`)

      expect(discoverBlueprintSoftwareRepositories(project)).toEqual([
        {
          softwareName: "redis",
          repositoryUrl: "https://github.com/redis/redis.git",
          commitHash: "4f3c2b1a",
          metadataPath: path.join(project, ".CausaForge", "blueprint", "redis", "metadata.json"),
          relativeMetadataPath: ".CausaForge/blueprint/redis/metadata.json",
        },
      ])
    } finally {
      await fs.rm(project, { recursive: true, force: true })
    }
  })

  test("rejects malformed software repository metadata", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-corpus-"))
    try {
      const metadataDir = path.join(project, ".CausaForge", "blueprint", "nginx")
      await fs.mkdir(metadataDir, { recursive: true })
      await fs.writeFile(path.join(metadataDir, "metadata.json"), "{\"repository_url\":\"https://github.com/nginx/nginx.git\"}\n")

      expect(() => discoverBlueprintSoftwareRepositories(project)).toThrow("BLUEPRINT_SOFTWARE_METADATA_INVALID")
    } finally {
      await fs.rm(project, { recursive: true, force: true })
    }
  })

  test("rejects software folders without repository metadata", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "causaforge-corpus-"))
    try {
      await fs.mkdir(path.join(project, ".CausaForge", "blueprint", "postgres"), { recursive: true })

      expect(() => discoverBlueprintSoftwareRepositories(project)).toThrow("BLUEPRINT_SOFTWARE_METADATA_MISSING")
    } finally {
      await fs.rm(project, { recursive: true, force: true })
    }
  })
})
