import {
  tool,
  type Config,
  type Hooks,
  type Plugin,
  type PluginInput,
  type PluginModule,
  type ToolDefinition,
} from "@opencode-ai/plugin"
import path from "node:path"
import {
  ARTIFACT_ROOT_DIR,
  type ArtifactKind,
  createWorkflowArtifactStore,
  type PatchPlanArtifact,
  type WorkflowAgentId,
  type WorkflowArtifactStore,
  type WorkflowPhase,
  type WorkflowState,
} from "@causaforge/core"
import { createWorkflowPlugin, type WorkflowPlugin } from "./plugin"
import type { ToolPermissionRequest } from "./hooks"
import type { WorkflowToolName } from "./tools"

export type PluginModuleDeps = Record<string, never>

export function createPluginModule(_overrides: Partial<PluginModuleDeps> = {}): PluginModule {
  const serverPlugin: Plugin = async (input): Promise<Hooks> => createWorkflowOpenCodeHooks(createWorkflowPluginRuntime(input))

  return {
    id: "causaforge-agent",
    server: serverPlugin,
  }
}

function createWorkflowPluginRuntime(input: PluginInput): {
  plugin: WorkflowPlugin
  store: WorkflowArtifactStore
  projectRoot: string
} {
  const store = createWorkflowArtifactStore(input.directory)
  return {
    store,
    projectRoot: input.directory,
    plugin: createWorkflowPlugin({
      cwd: input.directory,
      store,
      git: {
        async run(args) {
          return runProcess(["git", ...args], input.directory)
        },
      },
      commandRunner: {
        async run(request) {
          return runProcess(request.argv, request.cwd, request.timeoutMs)
        },
      },
    }),
  }
}

async function runProcess(argv: string[], cwd: string, timeoutMs?: number): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(argv, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  let timeout: ReturnType<typeof setTimeout> | undefined
  const exitPromise: Promise<number> = timeoutMs
    ? Promise.race([
      proc.exited,
      new Promise<number>((resolve) => {
        timeout = setTimeout(() => {
          proc.kill()
          resolve(124)
        }, timeoutMs)
      }),
    ])
    : proc.exited

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    exitPromise,
  ])
  if (timeout) clearTimeout(timeout)
  return { exitCode, stdout, stderr }
}

function createWorkflowOpenCodeHooks(runtime: {
  plugin: WorkflowPlugin
  store: WorkflowArtifactStore
  projectRoot: string
}): Hooks {
  const { plugin: workflowPlugin, store, projectRoot } = runtime
  const compactionSnapshots = new Map<string, { workflowId: string; phase: WorkflowPhase; agentRole: WorkflowAgentId }>()

  return {
    config: async (config: Config): Promise<void> => {
      config.agent = {
        ...(config.agent ?? {}),
        ...Object.fromEntries(
          Object.values(workflowPlugin.agents).map((agent) => [
            agent.id,
            {
              description: agent.description,
              mode: agent.mode,
              prompt: agent.prompt,
              ...(agent.model ? { model: agent.model } : {}),
            },
          ]),
        ),
      }
    },
    tool: createOpenCodeToolDefinitions(workflowPlugin.tools),
    event: async (input): Promise<void> => {
      if (input.event.type !== "session.idle") return
      const sessionID = getEventSessionId(input.event.properties)
      if (!sessionID) return
      const state = await findWorkflowForSession(store, sessionID)
      if (!state) return

      const result = workflowPlugin.hooks.stopGate({
        state,
        missing: getMissingArtifactsForPhase(state),
      })
      if (!result.allowed) throw new Error(`WORKFLOW_STOP_GATE_BLOCKED: ${result.message}`)
    },
    "tool.execute.before": async (input, output): Promise<void> => {
      try {
        const state = await findWorkflowForSession(store, input.sessionID) ?? await findSingleActiveWorkflow(store)
        const request = await createToolPermissionRequest(store, projectRoot, input.tool, state, asRecord(output.args))
        const result = workflowPlugin.hooks.toolPermission(request)
        if (!result.allowed) throw new Error(`WORKFLOW_TOOL_PERMISSION_DENIED: ${result.reason}`)
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith("WORKFLOW_TOOL_PERMISSION_DENIED")) {
          throw error
        }
        console.warn(`[CausaForge] Permission engine error for ${input.tool}, allowing: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
    "experimental.session.compacting": async (input, output): Promise<void> => {
      const state = await findWorkflowForSession(store, input.sessionID)
      if (!state) return
      const snapshot = workflowPlugin.hooks.compactionState.create({
        workflowId: state.workflowId,
        phase: state.phase,
        agentRole: getAgentRoleForPhase(state.phase),
      })
      compactionSnapshots.set(input.sessionID, snapshot)
      output.context.push(renderCompactionPointer(snapshot))
    },
    "experimental.compaction.autocontinue": async (input): Promise<void> => {
      const snapshot = compactionSnapshots.get(input.sessionID)
      if (!snapshot) return
      const restored = await workflowPlugin.hooks.compactionState.restore(store, snapshot)
      compactionSnapshots.set(input.sessionID, restored)
    },
  }
}

function createOpenCodeToolDefinitions(tools: WorkflowPlugin["tools"]): Record<WorkflowToolName, ToolDefinition> {
  return Object.fromEntries(
    Object.entries(tools).map(([toolName, workflowTool]) => [toolName, createOpenCodeToolDefinition(workflowTool)]),
  ) as Record<WorkflowToolName, ToolDefinition>
}

function createOpenCodeToolDefinition(workflowTool: WorkflowPlugin["tools"][WorkflowToolName]): ToolDefinition {
  return tool({
    description: workflowTool.description,
    args: {
      input: tool.schema.any().optional(),
    },
    async execute(args) {
      const result = await workflowTool.execute(args.input ?? {})
      return {
        output: JSON.stringify(result, null, 2),
      }
    },
  })
}

async function createToolPermissionRequest(
  store: WorkflowArtifactStore,
  projectRoot: string,
  toolName: string,
  state: WorkflowState | null,
  args: Record<string, unknown>,
): Promise<ToolPermissionRequest> {
  const targetPaths = collectToolTargetPaths(args)

  return {
    toolName: normalizeToolName(toolName),
    agentId: state ? getAgentRoleForPhase(state.phase) : null,
    phase: state?.phase ?? null,
    projectRoot: state?.productRoot ?? projectRoot,
    artifactRoot: path.join(state?.productRoot ?? projectRoot, ARTIFACT_ROOT_DIR),
    targetPath: targetPaths[0],
    targetPaths: targetPaths.length > 1 ? targetPaths : undefined,
    approvedProductPaths: state ? await readApprovedProductPaths(store, state) : undefined,
    command: asString(args.command ?? args.cmd),
  }
}

async function readApprovedProductPaths(
  store: WorkflowArtifactStore,
  state: WorkflowState,
): Promise<string[] | undefined> {
  const patchPlanArtifactId = state.artifactRefs.patchPlanArtifactId
  if (!patchPlanArtifactId) return undefined

  try {
    const patchPlan = await store.readArtifact<PatchPlanArtifact>(state.workflowId, "patch-plan")
    if (patchPlan.artifactId !== patchPlanArtifactId) return undefined
    return patchPlan.fileChanges.map((change) => change.path)
  } catch {
    return undefined
  }
}

async function findWorkflowForSession(store: WorkflowArtifactStore, sessionID: string): Promise<WorkflowState | null> {
  const workflows = await store.listWorkflows()
  return workflows.find((state) => state.builderSessionId === sessionID || state.reviewerSessionId === sessionID) ?? null
}

async function findSingleActiveWorkflow(store: WorkflowArtifactStore): Promise<WorkflowState | null> {
  const activeWorkflows = (await store.listWorkflows()).filter((state) => state.status === "active")
  return activeWorkflows.length === 1 ? activeWorkflows[0] : null
}

function getEventSessionId(properties: unknown): string | null {
  if (!properties || typeof properties !== "object") return null
  const props = properties as Record<string, unknown>
  const direct = asString(props.sessionID ?? props.sessionId ?? props.id)
  if (direct) return direct
  if (props.info && typeof props.info === "object") {
    return asString((props.info as Record<string, unknown>).id) ?? null
  }
  return null
}

function getMissingArtifactsForPhase(state: WorkflowState): ArtifactKind[] {
  const refs = state.artifactRefs
  const missing: ArtifactKind[] = []
  if (state.phase === "root_cause" && !refs.rootCauseArtifactId) missing.push("root-cause")
  if (state.phase === "planning" && !refs.patchPlanArtifactId) missing.push("patch-plan")
  if (state.phase === "building" && !refs.patchCandidateArtifactId) missing.push("patch-candidate")
  if (state.phase === "verifying" && !refs.verificationArtifactId) missing.push("verification")
  if (state.phase === "reviewing" && !refs.reviewArtifactId) missing.push("review")
  if (state.phase === "delivering" && !refs.deliveryArtifactId) missing.push("delivery")
  return missing
}

function getAgentRoleForPhase(phase: WorkflowPhase): WorkflowAgentId {
  if (phase === "root_cause") return "root-cause-analyst"
  if (phase === "planning") return "patch-planner"
  if (phase === "building") return "patch-builder"
  if (phase === "verifying") return "regression-verifier"
  if (phase === "reviewing") return "patch-reviewer"
  if (phase === "delivering" || phase === "completed") return "delivery-coordinator"
  return "workflow-orchestrator"
}

function renderCompactionPointer(snapshot: { workflowId: string; phase: WorkflowPhase; agentRole: WorkflowAgentId }): string {
  return [
    "<workflow-compaction-state>",
    `workflowId: ${snapshot.workflowId}`,
    `phase: ${snapshot.phase}`,
    `agentRole: ${snapshot.agentRole}`,
    "After compaction, call workflow_status before continuing phase work.",
    "</workflow-compaction-state>",
  ].join("\n")
}

function normalizeToolName(toolName: string): string {
  return toolName.replace(/^mcp_/i, "").toLowerCase()
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((item): item is string => typeof item === "string" && item.length > 0)
  return strings.length > 0 ? strings : undefined
}

function collectToolTargetPaths(args: Record<string, unknown>): string[] {
  return [
    ...[
      args.targetPath,
      args.target_path,
      args.path,
      args.filePath,
      args.file_path,
      args.file,
    ].flatMap((value) => asString(value) ? [asString(value)!] : []),
    ...(asStringArray(args.targetPaths ?? args.target_paths ?? args.paths ?? args.files) ?? []),
    ...extractEditTargetPaths(args.edits),
  ]
}

function extractEditTargetPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const targetPath = asString(record.path ?? record.filePath ?? record.file_path ?? record.file)
    return targetPath ? [targetPath] : []
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch { /* fall through */ }
  }
  return {}
}
