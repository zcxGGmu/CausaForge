import { WORKFLOW_AGENT_IDS, type WorkflowAgentId } from "@causaforge/core"
import type { BlueprintCorpusMetadata } from "../blueprint-corpus"
import type { WorkflowOpenCodeContext } from "../context"
import { createDeliveryCoordinatorAgent } from "./delivery-coordinator"
import { createPatchBuilderAgent } from "./patch-builder"
import { createPatchPlannerAgent } from "./patch-planner"
import { createPatchReviewerAgent } from "./patch-reviewer"
import { createRegressionVerifierAgent } from "./regression-verifier"
import { createRootCauseAnalystAgent } from "./root-cause-analyst"
import type { WorkflowAgentDefinition, WorkflowAgentFactory, WorkflowAgentRegistry } from "./types"
import { createWorkflowOrchestratorAgent } from "./workflow-orchestrator"

const AGENT_FACTORIES: Readonly<Record<WorkflowAgentId, WorkflowAgentFactory>> = {
  "workflow-orchestrator": createWorkflowOrchestratorAgent,
  "root-cause-analyst": createRootCauseAnalystAgent,
  "patch-planner": createPatchPlannerAgent,
  "patch-builder": createPatchBuilderAgent,
  "regression-verifier": createRegressionVerifierAgent,
  "patch-reviewer": createPatchReviewerAgent,
  "delivery-coordinator": createDeliveryCoordinatorAgent,
}

export function createWorkflowAgents(context: WorkflowOpenCodeContext): WorkflowAgentRegistry {
  return Object.fromEntries(
    WORKFLOW_AGENT_IDS.map((agentId) => [
      agentId,
      applyAgentOverride(addBlueprintCorpusInstructions(AGENT_FACTORIES[agentId](context), context), context),
    ]),
  ) as WorkflowAgentRegistry
}

function addBlueprintCorpusInstructions(
  agent: WorkflowAgentDefinition,
  context: WorkflowOpenCodeContext,
): WorkflowAgentDefinition {
  if (!context.blueprintCorpus) return agent
  return {
    ...agent,
    prompt: `${agent.prompt}\n\n${renderBlueprintCorpusInstructions(context.blueprintCorpus)}`,
  }
}

function renderBlueprintCorpusInstructions(corpus: BlueprintCorpusMetadata): string {
  return [
    "Blueprint corpus:",
    `- Path: ${corpus.rootPath}`,
    `- Relative path: ${corpus.relativePath}`,
    "- Read this corpus on demand when root-cause, planning, implementation, verification, review, or delivery work needs Agent3 analysis material.",
    "- Do not copy the whole corpus into workflow artifacts; cite the specific files or facts used.",
  ].join("\n")
}

function applyAgentOverride(agent: WorkflowAgentDefinition, context: WorkflowOpenCodeContext): WorkflowAgentDefinition {
  const override = context.config.agents[agent.id]
  if (!override) return agent
  return {
    ...agent,
    ...override,
  }
}
