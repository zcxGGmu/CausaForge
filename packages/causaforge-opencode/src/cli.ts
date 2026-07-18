#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createWorkflowArtifactStore } from "@causaforge/core"
import { parseWorkflowConfig } from "./config/schema"
import { createWorkflowTools } from "./tools"
import type { WorkflowImportRootCauseBlueprintInput } from "./tools"

interface ImportRootCauseArgs extends WorkflowImportRootCauseBlueprintInput {
  cwd: string
}

export async function main(argv = process.argv): Promise<number> {
  const command = argv[2]
  try {
    if (!command || command === "--help" || command === "-h") {
      console.log(renderHelp())
      return 0
    }
    if (command === "--version" || command === "-v") {
      console.log(await readPackageVersion())
      return 0
    }
    if (command !== "import-root-cause") {
      console.error(`Unknown command: ${command}`)
      console.error(renderHelp())
      return 1
    }

    const input = parseImportRootCauseArgs(argv.slice(3))
    const store = createWorkflowArtifactStore(input.cwd)
    const tools = createWorkflowTools({
      cwd: input.cwd,
      config: parseWorkflowConfig({}),
      store,
      git: {
        async run() {
          return { exitCode: 1, stdout: "", stderr: "CLI import-root-cause does not run git commands." }
        },
      },
      commandRunner: {
        async run() {
          return { exitCode: 1, stdout: "", stderr: "CLI import-root-cause does not run verification commands." }
        },
      },
    })

    const result = await tools.workflow_import_root_cause_blueprint.execute(input)
    console.log(JSON.stringify(result, null, 2))
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

function parseImportRootCauseArgs(args: string[]): ImportRootCauseArgs {
  const parsed: Partial<ImportRootCauseArgs> = {
    cwd: process.cwd(),
    start: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    switch (arg) {
      case "--source":
        parsed.sourceDir = path.resolve(readFlagValue(args, ++index, arg))
        break
      case "--workflow-id":
        parsed.workflowId = readFlagValue(args, ++index, arg)
        break
      case "--cwd":
        parsed.cwd = path.resolve(readFlagValue(args, ++index, arg))
        break
      case "--git-root":
        parsed.gitRoot = path.resolve(readFlagValue(args, ++index, arg))
        break
      case "--product-root":
        parsed.productRoot = path.resolve(readFlagValue(args, ++index, arg))
        break
      case "--now":
        parsed.now = readFlagValue(args, ++index, arg)
        break
      case "--start":
        parsed.start = true
        break
      case "--no-start":
        parsed.start = false
        break
      default:
        throw new Error(`Unknown import-root-cause option: ${arg}`)
    }
  }

  if (!parsed.sourceDir) {
    throw new Error("Missing required option: --source <root-cause-blueprint-folder>")
  }

  return {
    ...parsed,
    cwd: path.resolve(parsed.cwd ?? process.cwd()),
    sourceDir: parsed.sourceDir,
  } as ImportRootCauseArgs
}

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index]
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`)
  return value
}

async function readPackageVersion(): Promise<string> {
  const candidates = [
    new URL("../package.json", import.meta.url),
    new URL("../../../package.json", import.meta.url),
  ]
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(await fs.readFile(candidate, "utf8")) as { version?: string }
      if (pkg.version) return pkg.version
    } catch {
      continue
    }
  }
  return "development"
}

function renderHelp(): string {
  return [
    "CausaForge Agent",
    "",
    "Commands:",
    "  import-root-cause --source <folder> [--workflow-id <id>] [--start]",
    "",
    "Options:",
    "  --cwd <dir>            Project directory that receives .workflow artifacts",
    "  --source <folder>      RootCauseBlueprint directory with manifest.json",
    "  --workflow-id <id>     Optional workflow id; defaults to wf-<blueprintId>",
    "  --start                Start workflow in root-cause-import mode (default)",
    "  --no-start             Import artifact without creating workflow state",
    "  --git-root <dir>       Optional product git root stored on workflow state",
    "  --product-root <dir>   Optional product root stored on workflow state",
    "  --now <iso-date>       Optional deterministic timestamp",
  ].join("\n")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv))
}
