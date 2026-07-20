import { describe, expect, test } from "bun:test"
import { WORKFLOW_AGENT_IDS, createWorkflowArtifactStore } from "@causaforge/core"
import { createWorkflowPlugin } from "./plugin"

const workflowToolNames = [
  "workflow_start",
  "workflow_status",
  "workflow_prepare_repository",
  "workflow_import_root_cause_blueprint",
  "workflow_record_artifact",
  "workflow_validate_artifact",
  "workflow_capture_diff",
  "workflow_run_verification",
  "workflow_transition",
  "workflow_return_to_phase",
  "workflow_complete",
]

const hookNames = ["phaseContext", "toolPermission", "evidenceRecorder", "compactionState", "stopGate"]

describe("workflow OpenCode plugin adapter", () => {
  test("assembles only the normalized workflow surface", async () => {
    const plugin = createWorkflowPlugin(await deps())

    expect(Object.keys(plugin.agents)).toEqual([...WORKFLOW_AGENT_IDS])
    expect(Object.keys(plugin.tools)).toEqual(workflowToolNames)
    expect(Object.keys(plugin.hooks)).toEqual(hookNames)
  })

  test("default plugin surface only exposes workflow primitives", async () => {
    const plugin = createWorkflowPlugin(await deps())

    expect(Object.keys(plugin)).toEqual(["config", "agents", "tools", "hooks"])
    expect(Object.keys(plugin.agents)).toEqual([...WORKFLOW_AGENT_IDS])
    expect(Object.keys(plugin.tools)).toEqual(workflowToolNames)
    expect(Object.keys(plugin.hooks)).toEqual(hookNames)
  })
})

async function deps() {
  return {
    cwd: await makeTempDir(),
    store: createWorkflowArtifactStore(await makeTempDir()),
    git: {
      async run() {
        return { exitCode: 0, stdout: "", stderr: "" }
      },
    },
    commandRunner: {
      async run() {
        return { exitCode: 0, stdout: "", stderr: "" }
      },
    },
  }
}

async function makeTempDir(): Promise<string> {
  const fs = await import("node:fs/promises")
  const os = await import("node:os")
  const path = await import("node:path")
  return fs.mkdtemp(path.join(os.tmpdir(), "workflow-plugin-"))
}
