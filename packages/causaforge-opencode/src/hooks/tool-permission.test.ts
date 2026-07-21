import { describe, expect, test } from "bun:test"
import { createPhaseContext, renderPhaseContext } from "./phase-context"
import { evaluateToolPermission, type ToolPermissionRequest } from "./tool-permission"

const projectRoot = "/workspace/project"
const artifactRoot = `${projectRoot}/.workflow`

function writeRequest(overrides: Partial<ToolPermissionRequest> = {}): ToolPermissionRequest {
  return {
    toolName: "apply_patch",
    agentId: "patch-builder",
    phase: "building",
    projectRoot,
    artifactRoot,
    targetPath: "src/migrate.ts",
    approvedProductPaths: ["src/migrate.ts"],
    ...overrides,
  }
}

function bashRequest(command: string, overrides: Partial<ToolPermissionRequest> = {}): ToolPermissionRequest {
  return {
    toolName: "bash",
    agentId: "patch-planner",
    phase: "planning",
    command,
    ...overrides,
  }
}

describe("workflow phase context", () => {
  test("renders only the minimal phase context fields", () => {
    const context = createPhaseContext({
      workflowId: "wf-001",
      currentPhase: "planning",
      agentRole: "patch-planner",
      allowedArtifacts: ["patch-plan"],
      allowedCapabilities: ["read", "lsp"],
      exitConditions: ["approved patch-plan artifact recorded"],
    })

    expect(Object.keys(context)).toEqual([
      "workflowId",
      "currentPhase",
      "agentRole",
      "allowedArtifacts",
      "allowedCapabilities",
      "exitConditions",
    ])
    expect(renderPhaseContext(context)).toContain("workflowId: wf-001")
    expect(renderPhaseContext(context)).not.toContain("Current responsibility")
  })
})

describe("workflow tool permission guard", () => {
  test("rejects unknown tools by default", () => {
    expect(evaluateToolPermission({
      toolName: "delegate",
      agentId: null,
      phase: null,
    })).toEqual({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
  })

  test("allows the twelve workflow tools without write permissions", () => {
    const workflowTools = [
      "workflow_start",
      "workflow_status",
      "workflow_prepare_repository",
      "workflow_import_root_cause_blueprint",
      "workflow_record_artifact",
      "workflow_validate_artifact",
      "workflow_capture_diff",
      "workflow_prepare_verification_source",
      "workflow_run_verification",
      "workflow_transition",
      "workflow_return_to_phase",
      "workflow_complete",
    ]

    for (const toolName of workflowTools) {
      expect(evaluateToolPermission({ toolName, agentId: null, phase: null })).toEqual({ allowed: true })
    }
  })

  test("allows explicit read, question, and read-only LSP tools", () => {
    const safeTools = [
      "read",
      "grep",
      "glob",
      "question",
      "ask_user_question",
      "lsp_goto_definition",
      "lsp_find_references",
      "lsp_symbols",
      "lsp_diagnostics",
      "lsp_prepare_rename",
      "lsp_status",
    ]

    for (const toolName of safeTools) {
      expect(evaluateToolPermission({ toolName })).toEqual({ allowed: true })
    }

    expect(evaluateToolPermission({ toolName: "lsp_rename" }))
      .toEqual({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
    expect(evaluateToolPermission({ toolName: "lsp_install_decision" }))
      .toEqual({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
  })

  test("allows only the explicit read-only bash command subset", () => {
    const allowedCommands = [
      "bun test",
      "bun test packages/causaforge-opencode/src --bail",
      "bun run typecheck",
      "git diff",
      "git diff --check",
      "git status --short",
      "git show HEAD:packages/causaforge-opencode/src/hooks/tool-permission.ts",
      "git log -5 --oneline",
      "rg -n tool-permission packages/causaforge-opencode/src",
      "bun run --cwd packages/causaforge-opencode test",
      "bun run --cwd packages/causaforge-opencode typecheck",
      "grep -n tool-permission packages/causaforge-opencode/src/hooks/tool-permission.ts",
      "ls -la packages/causaforge-opencode",
      "find packages/causaforge-opencode/src -type f",
      "sed -n 1,40p packages/causaforge-opencode/src/hooks/tool-permission.ts",
      "cat packages/causaforge-opencode/package.json",
      "head -n 20 packages/causaforge-opencode/package.json",
      "tail -n 20 packages/causaforge-opencode/package.json",
      "wc -l packages/causaforge-opencode/src/hooks/tool-permission.ts",
      "pwd",
      "which bun",
    ]

    for (const command of allowedCommands) {
      expect(evaluateToolPermission(bashRequest(command))).toEqual({ allowed: true })
    }
  })

  test("allows bash only for trusted workflow agent and phase pairs", () => {
    const trustedPairs: Array<[ToolPermissionRequest["agentId"], ToolPermissionRequest["phase"]]> = [
      ["root-cause-analyst", "root_cause"],
      ["patch-planner", "planning"],
      ["patch-builder", "building"],
      ["regression-verifier", "verifying"],
      ["patch-reviewer", "reviewing"],
    ]

    for (const [agentId, phase] of trustedPairs) {
      expect(evaluateToolPermission(bashRequest("pwd", { agentId, phase }))).toEqual({ allowed: true })
    }
  })

  test("rejects bash when trusted agent or phase is missing or mismatched", () => {
    const rejectedRequests: ToolPermissionRequest[] = [
      { toolName: "bash", command: "pwd" },
      { toolName: "bash", agentId: null, phase: "planning", command: "pwd" },
      { toolName: "bash", agentId: "patch-planner", phase: null, command: "pwd" },
      { toolName: "bash", agentId: "workflow-orchestrator", command: "pwd" },
      { toolName: "bash", agentId: "delivery-coordinator", command: "pwd" },
      bashRequest("pwd", { agentId: "root-cause-analyst", phase: "planning" }),
      bashRequest("pwd", { agentId: "patch-planner", phase: "building" }),
      bashRequest("pwd", { agentId: "patch-builder", phase: "verifying" }),
      bashRequest("pwd", { agentId: "regression-verifier", phase: "reviewing" }),
      bashRequest("pwd", { agentId: "patch-reviewer", phase: "building" }),
      bashRequest("pwd", { agentId: "workflow-orchestrator", phase: "intake" }),
      bashRequest("pwd", { agentId: "delivery-coordinator", phase: "delivering" }),
    ]

    for (const request of rejectedRequests) {
      expect(evaluateToolPermission(request)).toEqual({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
    }
  })

  test("rejects bash writes, chaining, redirection, and non-whitelisted commands", () => {
    const rejectedCommands = [
      "rm -rf dist",
      "bun run build",
      "bun test && rm -rf dist",
      "bun test; git status",
      "bun test | tee test.log",
      "bun test > test.log",
      "bun test\nrm -rf dist",
      "bun test --update-snapshots",
      "git diff --output=/tmp/workflow.diff",
      "rg --pre rm pattern .",
      "bun run --cwd ../causaforge-opencode test",
      "bun run --cwd /tmp/causaforge-opencode test",
      "bun run --cwd --silent test",
      "bun run --cwd packages/causaforge-opencode build",
      "find . -exec touch marker",
      "find . -execdir touch marker",
      "find . -ok touch marker",
      "find . -okdir touch marker",
      "find . -delete",
      "find . -fprint output.txt",
      "find . -fprint0 output.txt",
      "find . -fprintf output.txt x",
      "find . -fls output.txt",
      "sed -i s/x/y/ file.ts",
      "sed -e 1p file.ts",
      "git diff \"--output=/tmp/out.diff\"",
      "rg --pre\\=touch pattern .",
      "git diff --stat\0",
      "git diff 'unterminated",
      "git diff \"unterminated",
    ]

    for (const command of rejectedCommands) {
      expect(evaluateToolPermission(bashRequest(command))).toEqual({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
    }
  })

  test("rejects verifier edit attempts", () => {
    expect(evaluateToolPermission(writeRequest({
      toolName: "edit",
      agentId: "regression-verifier",
      phase: "verifying",
    }))).toMatchObject({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
  })

  test("rejects reviewer apply_patch attempts", () => {
    expect(evaluateToolPermission(writeRequest({
      agentId: "patch-reviewer",
      phase: "reviewing",
    }))).toMatchObject({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
  })

  test("allows product writes only for a trusted builder in building", () => {
    expect(evaluateToolPermission(writeRequest())).toEqual({ allowed: true })

    expect(evaluateToolPermission(writeRequest({ agentId: null })))
      .toEqual({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
    expect(evaluateToolPermission(writeRequest({ phase: null })))
      .toEqual({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
    expect(evaluateToolPermission(writeRequest({ phase: "planning" })))
      .toEqual({ allowed: false, reason: "UNAUTHORIZED_TOOL" })
  })

  test("rejects builder modifications outside the approved plan", () => {
    expect(evaluateToolPermission(writeRequest({
      toolName: "edit",
      targetPath: "src/extra.ts",
    }))).toMatchObject({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })
  })

  test("rejects writes when the target or approved allowlist is missing", () => {
    expect(evaluateToolPermission(writeRequest({ targetPath: undefined })))
      .toEqual({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })
    expect(evaluateToolPermission(writeRequest({ approvedProductPaths: undefined })))
      .toEqual({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })
    expect(evaluateToolPermission(writeRequest({ approvedProductPaths: [] })))
      .toEqual({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })
  })

  test("rejects direct workflow state writes", () => {
    expect(evaluateToolPermission(writeRequest({
      toolName: "write",
      targetPath: ".workflow/wf-001/workflow.json",
      approvedProductPaths: [".workflow/wf-001/workflow.json"],
    }))).toMatchObject({ allowed: false, reason: "WORKFLOW_STATE_WRITE_FORBIDDEN" })
  })

  test("rejects workflow state writes after resolving parent segments", () => {
    expect(evaluateToolPermission(writeRequest({
      toolName: "write",
      targetPath: "src/../.workflow/wf-001/workflow.json",
      approvedProductPaths: [".workflow/wf-001/workflow.json"],
    }))).toMatchObject({ allowed: false, reason: "WORKFLOW_STATE_WRITE_FORBIDDEN" })
  })

  test("rejects workflow state under a custom artifact root", () => {
    expect(evaluateToolPermission(writeRequest({
      artifactRoot: `${projectRoot}/.artifacts`,
      targetPath: ".artifacts/wf-001/workflow.json",
      approvedProductPaths: [".artifacts/wf-001/workflow.json"],
    }))).toEqual({ allowed: false, reason: "WORKFLOW_STATE_WRITE_FORBIDDEN" })
  })

  test("uses the default artifact root when artifactRoot is omitted", () => {
    expect(evaluateToolPermission(writeRequest({
      artifactRoot: undefined,
      targetPath: ".workflow/wf-001/workflow.json",
      approvedProductPaths: [".workflow/wf-001/workflow.json"],
    }))).toEqual({ allowed: false, reason: "WORKFLOW_STATE_WRITE_FORBIDDEN" })
  })

  test("allows approved workflow.json files outside the canonical artifact state path", () => {
    expect(evaluateToolPermission(writeRequest({
      targetPath: "src/workflow.json",
      approvedProductPaths: ["src/workflow.json"],
    }))).toEqual({ allowed: true })

    expect(evaluateToolPermission(writeRequest({
      artifactRoot: `${projectRoot}/.artifacts`,
      targetPath: ".workflow/wf-001/workflow.json",
      approvedProductPaths: [".workflow/wf-001/workflow.json"],
    }))).toEqual({ allowed: true })

    expect(evaluateToolPermission(writeRequest({
      targetPath: ".workflow/nested/wf-001/workflow.json",
      approvedProductPaths: [".workflow/nested/wf-001/workflow.json"],
    }))).toEqual({ allowed: true })
  })

  test("rejects an artifact root outside projectRoot", () => {
    expect(evaluateToolPermission(writeRequest({
      artifactRoot: "/tmp/workflow-artifacts",
    }))).toEqual({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })
  })

  test("normalizes parent segments before comparing approved product paths", () => {
    expect(evaluateToolPermission(writeRequest({
      toolName: "edit",
      targetPath: "src/generated/../migrate.ts",
    }))).toEqual({ allowed: true })
  })

  test("normalizes Windows separators before comparing approved product paths", () => {
    expect(evaluateToolPermission(writeRequest({ targetPath: "src\\migrate.ts" }))).toEqual({ allowed: true })

    expect(evaluateToolPermission(writeRequest({
      targetPath: "src\\..\\secrets.ts",
    }))).toEqual({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })
  })

  test("rejects parent traversal and absolute paths outside the project", () => {
    expect(evaluateToolPermission(writeRequest({
      targetPath: "src/../../outside.ts",
      approvedProductPaths: ["../outside.ts"],
    }))).toEqual({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })

    expect(evaluateToolPermission(writeRequest({
      targetPath: "/tmp/outside.ts",
      approvedProductPaths: ["/tmp/outside.ts"],
    }))).toEqual({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })
  })

  test("requires every multi_edit target to be inside the approved plan", () => {
    expect(evaluateToolPermission(writeRequest({
      toolName: "multi_edit",
      targetPath: undefined,
      targetPaths: ["src/migrate.ts", "src/helper.ts"],
      approvedProductPaths: ["src/migrate.ts", "src/helper.ts"],
    }))).toEqual({ allowed: true })

    expect(evaluateToolPermission(writeRequest({
      toolName: "multi_edit",
      targetPath: undefined,
      targetPaths: ["src/migrate.ts", "src/extra.ts"],
      approvedProductPaths: ["src/migrate.ts"],
    }))).toEqual({ allowed: false, reason: "PLAN_SCOPE_VIOLATION" })
  })

  test("allows planner reads and LSP tools", () => {
    expect(evaluateToolPermission({
      toolName: "read",
      agentId: "patch-planner",
      phase: "planning",
      targetPath: "src/migrate.ts",
    })).toEqual({ allowed: true })

    expect(evaluateToolPermission({
      toolName: "lsp_goto_definition",
      agentId: "patch-planner",
      phase: "planning",
      targetPath: "src/migrate.ts",
    })).toEqual({ allowed: true })
  })
})
