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
      verification: {
        max_iterations: 5,
        runners: [
          {
            id: "local",
            type: "local",
            cwd: ".",
            allowedCommands: [
              ["bun", "test"],
              ["bun", "run", "typecheck"],
              ["bun", "run", "build"],
              ["git", "diff", "--check"],
            ],
          },
        ],
      },
    })
  })

  test("accepts explicit local and ssh verification runners", () => {
    expect(
      parseWorkflowConfig({
        verification: {
          max_iterations: 3,
          runners: [
            { id: "local-fast", type: "local", cwd: ".", allowedCommands: [["bun", "test"]] },
            {
              id: "remote-ci",
              type: "ssh",
              host: "ci-box",
              cwd: "/srv/project",
              allowedCommands: [["bun", "test"], ["pytest"]],
            },
          ],
        },
      }).verification,
    ).toEqual({
      max_iterations: 3,
      runners: [
        { id: "local-fast", type: "local", cwd: ".", allowedCommands: [["bun", "test"]] },
        {
          id: "remote-ci",
          type: "ssh",
          host: "ci-box",
          cwd: "/srv/project",
          allowedCommands: [["bun", "test"], ["pytest"]],
        },
      ],
    })
  })

  test("rejects ssh runners without an explicit allowed command list", () => {
    expect(() =>
      parseWorkflowConfig({
        verification: {
          runners: [{ id: "remote-ci", type: "ssh", host: "ci-box", cwd: "/srv/project" }],
        },
      }),
    ).toThrow()
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
