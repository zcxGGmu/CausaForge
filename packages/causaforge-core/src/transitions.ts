import type { WorkflowPhase } from "./types"

function transitionSet(...phases: WorkflowPhase[]): ReadonlySet<WorkflowPhase> {
  return new Set(phases)
}

const ALLOWED_TRANSITIONS: Readonly<Record<WorkflowPhase, ReadonlySet<WorkflowPhase>>> = Object.freeze({
  intake: transitionSet("root_cause", "planning", "blocked"),
  root_cause: transitionSet("planning", "blocked"),
  planning: transitionSet("root_cause", "building", "blocked"),
  building: transitionSet("planning", "verifying", "blocked"),
  verifying: transitionSet("building", "reviewing", "blocked"),
  reviewing: transitionSet("building", "verifying", "delivering", "blocked"),
  delivering: transitionSet("reviewing", "completed", "blocked"),
  completed: transitionSet(),
  blocked: transitionSet(),
})

export class WorkflowTransitionError extends Error {
  readonly code = "INVALID_TRANSITION" as const

  constructor(
    readonly from: WorkflowPhase,
    readonly to: WorkflowPhase,
  ) {
    super(`INVALID_TRANSITION: ${from} -> ${to}`)
    this.name = "WorkflowTransitionError"
  }
}

export function canTransition(from: WorkflowPhase, to: WorkflowPhase): boolean {
  return ALLOWED_TRANSITIONS[from].has(to)
}

export function assertTransition(from: WorkflowPhase, to: WorkflowPhase): void {
  if (!canTransition(from, to)) {
    throw new WorkflowTransitionError(from, to)
  }
}
