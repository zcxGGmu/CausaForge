import { describe, expect, test } from "bun:test"
import { WORKFLOW_AGENT_IDS, WORKFLOW_PHASES } from "./index"

describe("workflow constants", () => {
  test("exposes only normalized workflow agents", () => {
    expect(WORKFLOW_AGENT_IDS).toEqual([
      "workflow-orchestrator",
      "root-cause-analyst",
      "patch-planner",
      "patch-builder",
      "regression-verifier",
      "patch-reviewer",
      "delivery-coordinator",
    ])
  })

  test("exposes the ordered lifecycle", () => {
    expect(WORKFLOW_PHASES).toEqual([
      "intake",
      "root_cause",
      "planning",
      "building",
      "verifying",
      "reviewing",
      "delivering",
      "completed",
      "blocked",
    ])
  })
})
