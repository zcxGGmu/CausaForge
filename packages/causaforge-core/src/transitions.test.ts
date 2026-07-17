import { describe, expect, test } from "bun:test"
import { WORKFLOW_PHASES } from "./phases"
import { assertTransition, canTransition, WorkflowTransitionError } from "./transitions"
import type { WorkflowPhase } from "./types"

const ALLOWED_EDGES = new Set<string>([
  "intake->root_cause",
  "intake->planning",
  "intake->blocked",
  "root_cause->planning",
  "root_cause->blocked",
  "planning->root_cause",
  "planning->building",
  "planning->blocked",
  "building->planning",
  "building->verifying",
  "building->blocked",
  "verifying->building",
  "verifying->reviewing",
  "verifying->blocked",
  "reviewing->building",
  "reviewing->verifying",
  "reviewing->delivering",
  "reviewing->blocked",
  "delivering->reviewing",
  "delivering->completed",
  "delivering->blocked",
  "blocked->root_cause",
  "blocked->planning",
  "blocked->building",
  "blocked->verifying",
])

function edge(from: WorkflowPhase, to: WorkflowPhase): string {
  return `${from}->${to}`
}

describe("workflow transitions", () => {
  test("matches the complete allowed transition matrix", () => {
    for (const from of WORKFLOW_PHASES) {
      for (const to of WORKFLOW_PHASES) {
        expect(canTransition(from, to), edge(from, to)).toBe(ALLOWED_EDGES.has(edge(from, to)))
      }
    }
  })

  test("keeps completed terminal while blocked can recover to active phases", () => {
    for (const to of WORKFLOW_PHASES) {
      expect(canTransition("completed", to), edge("completed", to)).toBe(false)
    }

    expect(canTransition("blocked", "root_cause")).toBe(true)
    expect(canTransition("blocked", "planning")).toBe(true)
    expect(canTransition("blocked", "building")).toBe(true)
    expect(canTransition("blocked", "verifying")).toBe(true)
    expect(canTransition("blocked", "reviewing")).toBe(false)
    expect(canTransition("blocked", "delivering")).toBe(false)
    expect(canTransition("blocked", "completed")).toBe(false)
    expect(canTransition("blocked", "blocked")).toBe(false)
  })

  test("allows imported root cause reports to enter planning structurally", () => {
    expect(canTransition("intake", "planning")).toBe(true)
  })

  test("requires review failures to return through building", () => {
    expect(canTransition("reviewing", "building")).toBe(true)
    expect(canTransition("building", "reviewing")).toBe(false)
  })

  test("throws a structured error for invalid transitions", () => {
    expect(() => assertTransition("planning", "verifying")).toThrow(WorkflowTransitionError)

    try {
      assertTransition("planning", "verifying")
      throw new Error("expected assertTransition to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowTransitionError)
      expect(error).toMatchObject({
        code: "INVALID_TRANSITION",
        from: "planning",
        to: "verifying",
      })
    }
  })

  test("accepts allowed transitions without returning a value", () => {
    expect(assertTransition("intake", "root_cause")).toBeUndefined()
  })
})
