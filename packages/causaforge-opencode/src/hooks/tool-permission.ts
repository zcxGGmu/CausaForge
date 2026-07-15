import path from "node:path"
import { canModifyProductCode, type WorkflowAgentId, type WorkflowPhase } from "@causaforge/core"

const WORKFLOW_TOOLS = new Set([
  "workflow_start",
  "workflow_status",
  "workflow_record_artifact",
  "workflow_validate_artifact",
  "workflow_capture_diff",
  "workflow_transition",
  "workflow_return_to_phase",
  "workflow_complete",
])
const READ_ONLY_TOOLS = new Set([
  "read",
  "grep",
  "glob",
  "question",
  "ask_user_question",
])
const READ_ONLY_LSP_TOOLS = new Set([
  "lsp_goto_definition",
  "lsp_find_references",
  "lsp_symbols",
  "lsp_diagnostics",
  "lsp_prepare_rename",
  "lsp_status",
])
const PRODUCT_WRITE_TOOLS = new Set(["edit", "write", "apply_patch", "multi_edit"])
const BASH_PHASE_BY_AGENT: Readonly<Partial<Record<WorkflowAgentId, WorkflowPhase>>> = {
  "root-cause-analyst": "root_cause",
  "patch-planner": "planning",
  "patch-builder": "building",
  "regression-verifier": "verifying",
  "patch-reviewer": "reviewing",
}
const SIMPLE_READ_COMMANDS = new Set(["grep", "ls", "cat", "head", "tail", "wc", "pwd", "which"])
const FIND_FORBIDDEN_ACTIONS = new Set([
  "-delete",
  "-exec",
  "-execdir",
  "-fls",
  "-fprint",
  "-fprint0",
  "-fprintf",
  "-ok",
  "-okdir",
])
const SHELL_UNSAFE_SYNTAX = /[\0\n\r;&|<>`'"\\]|\$\(/
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:\//
const SAFE_WORKFLOW_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export interface ToolPermissionRequest {
  toolName: string
  agentId?: WorkflowAgentId | null
  phase?: WorkflowPhase | null
  projectRoot?: string
  artifactRoot?: string
  targetPath?: string
  targetPaths?: string[]
  approvedProductPaths?: string[]
  command?: string
}

export type ToolPermissionResult =
  | { allowed: true }
  | { allowed: false; reason: "UNAUTHORIZED_TOOL" | "PLAN_SCOPE_VIOLATION" | "WORKFLOW_STATE_WRITE_FORBIDDEN" }

export function evaluateToolPermission(request: ToolPermissionRequest): ToolPermissionResult {
  if (WORKFLOW_TOOLS.has(request.toolName) || READ_ONLY_TOOLS.has(request.toolName) || READ_ONLY_LSP_TOOLS.has(request.toolName)) {
    return { allowed: true }
  }

  if (request.toolName === "bash") {
    return hasTrustedBashContext(request.agentId, request.phase) && isAllowedBashCommand(request.command)
      ? { allowed: true }
      : { allowed: false, reason: "UNAUTHORIZED_TOOL" }
  }

  if (!PRODUCT_WRITE_TOOLS.has(request.toolName)) {
    return { allowed: false, reason: "UNAUTHORIZED_TOOL" }
  }

  if (!request.agentId || request.phase !== "building" || !canModifyProductCode(request.agentId)) {
    return { allowed: false, reason: "UNAUTHORIZED_TOOL" }
  }

  const targetPaths = collectTargetPaths(request)
  const projectRoot = request.projectRoot
  if (targetPaths.length === 0 || !projectRoot || !request.approvedProductPaths?.length) {
    return { allowed: false, reason: "PLAN_SCOPE_VIOLATION" }
  }

  const canonicalTargets = targetPaths.map((targetPath) => canonicalizeProjectPath(targetPath, projectRoot))
  if (canonicalTargets.some((targetPath) => targetPath === null)) {
    return { allowed: false, reason: "PLAN_SCOPE_VIOLATION" }
  }

  const canonicalArtifactRoot = canonicalizeProjectPath(request.artifactRoot ?? ".workflow", projectRoot)
  if (canonicalArtifactRoot === null) {
    return { allowed: false, reason: "PLAN_SCOPE_VIOLATION" }
  }

  if (canonicalTargets.some((targetPath) => isWorkflowStatePath(targetPath!, canonicalArtifactRoot))) {
    return { allowed: false, reason: "WORKFLOW_STATE_WRITE_FORBIDDEN" }
  }

  const approvedPaths = request.approvedProductPaths.map((approvedPath) => (
    canonicalizeProjectPath(approvedPath, projectRoot)
  ))
  if (approvedPaths.some((approvedPath) => approvedPath === null)) {
    return { allowed: false, reason: "PLAN_SCOPE_VIOLATION" }
  }

  const approved = new Set(approvedPaths)
  for (const canonicalTarget of canonicalTargets) {
    if (!approved.has(canonicalTarget)) {
      return { allowed: false, reason: "PLAN_SCOPE_VIOLATION" }
    }
  }

  return { allowed: true }
}

function collectTargetPaths(request: ToolPermissionRequest): string[] {
  return [
    ...(request.targetPath ? [request.targetPath] : []),
    ...(request.targetPaths ?? []),
  ]
}

function hasTrustedBashContext(
  agentId: WorkflowAgentId | null | undefined,
  phase: WorkflowPhase | null | undefined,
): boolean {
  const expectedPhase = agentId === null || agentId === undefined ? undefined : BASH_PHASE_BY_AGENT[agentId]
  return expectedPhase !== undefined && expectedPhase === phase
}

function isAllowedBashCommand(command: string | undefined): boolean {
  const normalized = command?.trim()
  if (!normalized || SHELL_UNSAFE_SYNTAX.test(normalized)) return false
  const tokens = normalized.split(/\s+/)

  if (tokens[0] === "bun" && tokens[1] === "test") {
    return !tokens.some((token) => (
      token === "-u"
      || token === "--update-snapshots"
      || token === "--reporter-outfile"
      || token.startsWith("--reporter-outfile=")
    ))
  }

  if (tokens.length === 3 && tokens[0] === "bun" && tokens[1] === "run" && tokens[2] === "typecheck") {
    return true
  }

  if (
    tokens.length === 5
    && tokens[0] === "bun"
    && tokens[1] === "run"
    && tokens[2] === "--cwd"
    && isSafeRelativePath(tokens[3])
    && (tokens[4] === "test" || tokens[4] === "typecheck")
  ) {
    return true
  }

  if (tokens[0] === "git" && ["diff", "status", "show", "log"].includes(tokens[1] ?? "")) {
    return !tokens.some((token) => (
      token === "-o"
      || token.startsWith("-o")
      || token === "--output"
      || token.startsWith("--output=")
      || token === "--ext-diff"
      || token === "--textconv"
    ))
  }

  if (tokens[0] === "rg") {
    return !tokens.some((token) => (
      token === "--pre"
      || token.startsWith("--pre=")
      || token === "--hostname-bin"
      || token.startsWith("--hostname-bin=")
    ))
  }

  if (SIMPLE_READ_COMMANDS.has(tokens[0] ?? "")) return true
  if (tokens[0] === "find") return !tokens.some((token) => FIND_FORBIDDEN_ACTIONS.has(token))
  if (tokens[0] === "sed") return isAllowedSedCommand(tokens)

  return false
}

function isSafeRelativePath(targetPath: string): boolean {
  if (!/^[A-Za-z0-9._@/-]+$/.test(targetPath)) return false
  if (targetPath.startsWith("-")) return false
  if (path.posix.isAbsolute(targetPath) || WINDOWS_ABSOLUTE_PATH.test(targetPath)) return false
  return targetPath.split("/").every((segment) => segment.length > 0 && segment !== "..")
}

function isAllowedSedCommand(tokens: string[]): boolean {
  if (tokens.length < 4 || tokens[1] !== "-n") return false
  if (!/^(?:\d+|\$)(?:,(?:\d+|\$))?p$/.test(tokens[2])) return false
  return tokens.slice(3).every((token) => !token.startsWith("-"))
}

function isWorkflowStatePath(targetPath: string, artifactRoot: string): boolean {
  const pathApi = WINDOWS_ABSOLUTE_PATH.test(normalizePath(artifactRoot)) ? path.win32 : path
  const relative = pathApi.relative(artifactRoot, targetPath)
  const segments = relative.split(pathApi.sep)
  return segments.length === 2
    && SAFE_WORKFLOW_ID.test(segments[0] ?? "")
    && segments[1]?.toLowerCase() === "workflow.json"
}

function normalizePath(targetPath: string): string {
  const normalized = path.posix.normalize(targetPath.replace(/\\/g, "/"))
  return normalized === "." ? "" : normalized.replace(/^\.\//, "")
}

function canonicalizeProjectPath(targetPath: string, projectRoot: string): string | null {
  const normalizedRoot = normalizePath(projectRoot)
  const normalizedTarget = normalizePath(targetPath)
  const windowsRoot = WINDOWS_ABSOLUTE_PATH.test(normalizedRoot)

  if (!normalizedRoot || !normalizedTarget) return null
  if (!windowsRoot && !path.isAbsolute(normalizedRoot)) return null
  if (!windowsRoot && WINDOWS_ABSOLUTE_PATH.test(normalizedTarget)) return null
  if (windowsRoot && normalizedTarget.startsWith("/")) return null

  const pathApi = windowsRoot ? path.win32 : path
  const rootInput = windowsRoot ? normalizedRoot.replace(/\//g, "\\") : normalizedRoot
  const targetInput = windowsRoot ? normalizedTarget.replace(/\//g, "\\") : normalizedTarget
  const canonicalRoot = pathApi.resolve(rootInput)
  const canonicalTarget = pathApi.isAbsolute(targetInput)
    ? pathApi.resolve(targetInput)
    : pathApi.resolve(canonicalRoot, targetInput)
  const relative = pathApi.relative(canonicalRoot, canonicalTarget)

  if (relative === ".." || relative.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relative)) {
    return null
  }

  return windowsRoot ? canonicalTarget.toLowerCase() : canonicalTarget
}
