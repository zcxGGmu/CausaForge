import type { WORKFLOW_AGENT_IDS, WORKFLOW_PHASES } from "./phases"

export type WorkflowAgentId = (typeof WORKFLOW_AGENT_IDS)[number]
export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number]
