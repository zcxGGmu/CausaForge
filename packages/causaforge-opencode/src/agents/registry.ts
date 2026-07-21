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

const VERIFICATION_SOURCE_SELECTION_AGENT_IDS = new Set<WorkflowAgentId>([
  "workflow-orchestrator",
  "patch-builder",
  "regression-verifier",
])

export function createWorkflowAgents(context: WorkflowOpenCodeContext): WorkflowAgentRegistry {
  return Object.fromEntries(
    WORKFLOW_AGENT_IDS.map((agentId) => [
      agentId,
      applyAgentOverride(
        addBlueprintCorpusInstructions(addVerificationSourceSelectionInstructions(AGENT_FACTORIES[agentId](context)), context),
        context,
      ),
    ]),
  ) as WorkflowAgentRegistry
}

function addVerificationSourceSelectionInstructions(agent: WorkflowAgentDefinition): WorkflowAgentDefinition {
  if (!VERIFICATION_SOURCE_SELECTION_AGENT_IDS.has(agent.id)) return agent
  return {
    ...agent,
    prompt: `${agent.prompt}\n\n${renderVerificationSourceSelectionInstructions()}`,
  }
}

function renderVerificationSourceSelectionInstructions(): string {
  return [
    "Verification source selection skill:",
    "- Automatically use $causaforge-verification-source-selection after a patch-candidate is ready and before workflow_run_verification.",
    "- Call workflow_prepare_verification_source first without mode so the user must choose official or user verification tests.",
    "- For official, ensure the current software repository is prepared, inspect its checkout, choose a concrete suitePath, then call workflow_prepare_verification_source with mode official.",
    "- For user, require a concrete testPath from the user, then call workflow_prepare_verification_source with mode user.",
    "- Pass only the manifest returned by workflow_prepare_verification_source to workflow_run_verification.",
    "- Reuse the selected source across repair iterations unless the user changes it or the active patch plan changes.",
  ].join("\n")
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
    "- Read this corpus on demand when root-cause, planning, implementation, verification, review, or delivery work needs upstream blueprint analysis material.",
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
