export const WORKFLOW_AGENT_IDS = [
  "workflow-orchestrator",
  "root-cause-analyst",
  "patch-planner",
  "patch-builder",
  "regression-verifier",
  "patch-reviewer",
  "delivery-coordinator",
] as const

export const WORKFLOW_PHASES = [
  "intake",
  "root_cause",
  "planning",
  "building",
  "verifying",
  "reviewing",
  "delivering",
  "completed",
  "blocked",
] as const
