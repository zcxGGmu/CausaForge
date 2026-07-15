import fs from "node:fs/promises"
import path from "node:path"
import { getWorkflowDir } from "@causaforge/core"
import { parseChangedFilesFromDiff } from "./diff"
import type { WorkflowCaptureDiffInput, WorkflowCaptureDiffOutput, WorkflowTool, WorkflowToolDeps } from "./types"

export function createWorkflowCaptureDiffTool(deps: WorkflowToolDeps): WorkflowTool<WorkflowCaptureDiffInput, WorkflowCaptureDiffOutput> {
  return {
    name: "workflow_capture_diff",
    description: "Capture the current git binary diff through the injected git runner.",
    async execute(input) {
      const result = await deps.git.run(["diff", "--binary", "--no-ext-diff"])
      if (result.exitCode !== 0) throw new Error(`Git diff failed: ${result.stderr}`)
      if (result.stdout.trim().length === 0) throw new Error("No diff captured")

      const changedFiles = parseChangedFilesFromDiff(result.stdout)
      const patchPath = path.join(getWorkflowDir(deps.cwd, input.workflowId), "implementation", "patch.diff")
      await fs.mkdir(path.dirname(patchPath), { recursive: true })
      await fs.writeFile(patchPath, result.stdout)
      return { patchPath, changedFiles }
    },
  }
}
