import { describe, expect, test } from "bun:test"
import { parseWorkflowConfig } from "./schema"

const normalizedAgents = [
  "workflow-orchestrator",
  "root-cause-analyst",
  "patch-planner",
  "patch-builder",
  "regression-verifier",
  "patch-reviewer",
  "delivery-coordinator",
] as const

describe("workflow OpenCode config schema", () => {
  test("applies workflow defaults", () => {
    expect(parseWorkflowConfig({})).toEqual({
      artifact_dir: ".workflow",
      require_independent_review: true,
      require_clean_worktree: true,
      allow_plan_deviation: false,
      auto_continue_after_compaction: true,
      agents: {},
    })
  })

  test("accepts only normalized workflow agent overrides", () => {
    for (const agentId of normalizedAgents) {
      expect(parseWorkflowConfig({ agents: { [agentId]: { model: "gpt-5.6-terra" } } }).agents).toEqual({
        [agentId]: { model: "gpt-5.6-terra" },
      })
    }

    expect(() => parseWorkflowConfig({ agents: { unknown: {} } })).toThrow()
  })

  test("rejects non-workflow agent configuration keys", () => {
    expect(() => parseWorkflowConfig({ agents: { "unregistered-agent": {} } })).toThrow()
  })
})
