# CausaForge Agent

<p align="center">
  <a href="./README.md"><kbd>English</kbd></a>
  <strong><kbd>简体中文</kbd></strong>
</p>

> [!NOTE]
> **OpenCode-first 的证据链补丁交付。**
>
> CausaForge Agent 不是一组松散的 prompt。它是一个确定性的工作流 harness，把一次代码修改拆成可追踪的类型化产物链：根因、补丁计划、候选补丁、验证、独立审查和最终交付。

> [!TIP]
> **给 Agent 使用者**
>
> 如果你正在使用 LLM agent，请让它先阅读本 README 和 `ROADMAP.md`，运行本地验证命令，然后把 `dist/index.js` 注册为 OpenCode plugin，再开始使用 workflow tools。

<div align="center">

<h1>CausaForge Agent</h1>

<p><strong>一个面向可审计 AI 补丁交付的 protocol-first OpenCode plugin。</strong></p>

<p>
  <a href="https://github.com/zcxGGmu/CausaForge"><img alt="repository" src="https://img.shields.io/badge/repo-CausaForge-24292f?labelColor=black&style=flat-square" /></a>
  <a href="./LICENSE.md"><img alt="license" src="https://img.shields.io/badge/license-SUL--1.0-white?labelColor=black&style=flat-square" /></a>
  <a href="./package.json"><img alt="version" src="https://img.shields.io/badge/version-4.17.0-369eff?labelColor=black&style=flat-square" /></a>
  <a href="./packages/causaforge-opencode/src/opencode-plugin-module.ts"><img alt="OpenCode plugin" src="https://img.shields.io/badge/OpenCode-plugin-c4f042?labelColor=black&style=flat-square" /></a>
  <a href="./packages/causaforge-core/src/phases.ts"><img alt="workflow phases" src="https://img.shields.io/badge/phases-9-ffcb47?labelColor=black&style=flat-square" /></a>
</p>

<p>
  <a href="#安装">安装</a> |
  <a href="#亮点">亮点</a> |
  <a href="#工作流">工作流</a> |
  <a href="#架构">架构</a> |
  <a href="#开发">开发</a>
</p>

<img src="./docs/diagrams/causaforge-architecture.png" alt="CausaForge 架构图" width="100%" />

</div>

---

## 为什么是 CausaForge

AI coding 经常失败在交付边界：模型说工作已经完成，但仓库里只有一个未验证的 diff 和一段模糊说明。CausaForge 把交付边界变成明确协议。

核心思路很简单：

1. workflow 从一个具体问题或导入的 root-cause artifact 开始。
2. 每个阶段只向 `.workflow/<workflowId>/` 写入一个类型化产物。
3. 状态转换只有在 artifact chain、phase、session、scope 和 patch 一致性检查全部通过时才会被接受。
4. OpenCode adapter 把协议暴露为 agents、tools 和 hooks；core package 保持 harness-neutral。

它适合希望 AI agent 快速推进、但不跳过资深工程师会要求的证据链的团队。

## 安装

CausaForge 目前是 source-first 的 OpenCode plugin。先本地构建，再让 OpenCode 指向生成的 plugin entry。

### TL;DR

| 目标 | 命令 | 产物 |
| :--- | :--- | :--- |
| 从源码构建 | `bun install --ignore-scripts && bun run build` | `dist/index.js`, `dist/index.d.ts`, `dist/cli.js` |
| 在项目中注册 | 将 `file://<repo>/dist/index.js` 加入 `.opencode/opencode.json` | OpenCode 加载 plugin id `causaforge-agent` |
| 提供上游蓝图分析素材 | 将 corpus 放到 `.CausaForge/blueprint` | workflow agents 按需读取 |
| 导入单个 RootCauseBlueprint manifest | `./bin/causaforge.js import-root-cause --source <folder> --start` | `.workflow/<workflowId>/root-cause/` |
| 使用前验证 | `bun run test && bun run typecheck && bun run build` | package 测试、类型安全和构建产物 |

### 源码设置

```bash
git clone https://github.com/zcxGGmu/CausaForge.git
cd CausaForge
bun install --ignore-scripts
bun run build
./bin/causaforge.js --version
```

### OpenCode 项目配置

在你要运行 workflow 的项目里创建或更新 `.opencode/opencode.json`：

```json
{
  "plugin": ["file:///absolute/path/to/CausaForge/dist/index.js"]
}
```

对于本地 checkout，可以用下面的 helper 写入项目级配置：

```bash
PLUGIN_PATH="file://$(pwd)/dist/index.js"
mkdir -p .opencode
printf '{\n  "plugin": ["%s"]\n}\n' "$PLUGIN_PATH" > .opencode/opencode.json
```

构建完成后再运行 OpenCode。插件会从编译后的 entrypoint 注册 workflow agents、workflow tools 和 hooks。

### Blueprint Corpus 交接

上游蓝图生产者可以在 CausaForge 启动前，把根因分析素材 corpus 预先放到产品项目中：

```text
<product-project>/
  .CausaForge/
    blueprint/
      redis/
        metadata.json
        ...
```

CausaForge 会从 OpenCode 项目根目录识别固定的 `.CausaForge/blueprint` 目录，并把该路径注入每个 workflow agent 的 prompt。这个 corpus 是 root-cause 分析、规划、实现、验证、审查和交付阶段按需读取的数据源。CausaForge 不会把整个 corpus 复制进 `.workflow`；agent 应只引用实际使用过的具体文件或事实。

当 `blueprint/` 下存在以软件名称命名的文件夹时，每个文件夹都必须包含 `metadata.json`，并提供 `repository_url` 和 `commit_hash`。`workflow_start` 会把这些仓库记录为 pending preflight 项；随后必须通过 `workflow_prepare_repository` 询问用户手动准备 checkout，还是由 OpenCode clone/fetch 并 checkout 到指定 commit。

### 单 Manifest 导入

上游蓝图生产者应为每个 RootCauseBlueprint 输出一个独立文件夹，并在文件夹根部提供 `manifest.json`。用户在上游工具侧选择某个蓝图后，由该工具自动调用 CausaForge：

```bash
./bin/causaforge.js import-root-cause \
  --cwd /path/to/product-project \
  --source /path/to/root-cause-blueprint-folder \
  --workflow-id wf-bp-001 \
  --start
```

CausaForge 会校验 manifest 和被引用文件，把原始目录归档到 `.workflow/<workflowId>/root-cause/source/`，写入 `.workflow/<workflowId>/root-cause/root-cause.json`，并让 workflow 从 `planning` 继续。上游蓝图生产者不应直接写 `.workflow`。

### 给 LLM Agents

把下面这段发给拥有仓库 shell 权限的 agent：

```text
阅读 README.zh-CN.md 和 ROADMAP.md。使用 `bun install --ignore-scripts` 和 `bun run build` 构建 CausaForge。使用 `bun run test`、`bun run typecheck` 和 `bun run build` 验证。然后把 `dist/index.js` 注册为 file:// OpenCode plugin。先调用 workflow_start；当 blueprint metadata 要求源码准备时调用 workflow_prepare_repository；每次 transition 前记录当前阶段所需 artifact；building 阶段捕获 implementation diff；只能在 delivering 阶段通过 workflow_complete 关闭 workflow。
```

## 跳过本文

如果你想让 agent 解释这个项目，而不是手动读完每个章节，可以使用：

```text
阅读 https://raw.githubusercontent.com/zcxGGmu/CausaForge/refs/heads/main/README.zh-CN.md 和 https://raw.githubusercontent.com/zcxGGmu/CausaForge/refs/heads/main/ROADMAP.md。说明 CausaForge 相比普通 coding agent 强制了哪些内容，然后列出验证本地 checkout 所需的最小命令。
```

## 亮点

| 表面 | 作用 | 事实源 |
| :--- | :--- | :--- |
| Evidence-chain workflow | 将补丁交付拆成 root cause、plan、implementation、verification、review 和 delivery 产物 | `packages/causaforge-core/src/phases.ts` |
| 七个 workflow agents | 提供一个 primary orchestrator，以及面向分析、计划、构建、验证、审查和交付的阶段 subagents | `packages/causaforge-opencode/src/agents/registry.ts` |
| 十二个 workflow tools | 导入 RootCauseBlueprint 文件夹、启动 workflow、准备源码仓库、选择验证来源、记录 artifact、校验 artifact、捕获 diff、执行受控验证 manifest、推进 phase、回滚 phase、报告状态并完成交付 | `packages/causaforge-opencode/src/tools/index.ts` |
| 确定性 transition guard | 当缺少必要 artifact、引用、验证、审查、session 或 patch 一致性时拒绝阶段推进 | `packages/causaforge-core/src/guards/transition-guard.ts` |
| Scope-limited write guard | 只允许 building 阶段写产品代码，并且只能写 patch plan 批准的路径 | `packages/causaforge-opencode/src/hooks/tool-permission.ts` |
| Independent review gate | 要求 reviewer session 与 builder session 不同，之后才能进入 review | `packages/causaforge-core/src/guards/session-guard.ts` |
| Harness-neutral core | 将 schemas、状态转换、权限、artifact paths 和 guards 与 OpenCode runtime 细节解耦 | `packages/causaforge-core/` |
| OpenCode adapter | 将 core protocol 映射为 OpenCode agents、tools、config hooks、tool-permission hooks、stop gates 和 compaction state | `packages/causaforge-opencode/` |

## 工作流

<img src="./docs/diagrams/causaforge-workflow.png" alt="CausaForge 证据链工作流图" width="100%" />

SVG 源文件：[`docs/diagrams/causaforge-workflow.svg`](./docs/diagrams/causaforge-workflow.svg)

### 完整执行顺序

CausaForge 的 preflight 不是独立 phase，而是 `workflow_start` 之后、正式开发前必须清掉的 workflow state 门禁。完整顺序如下：

| Step | Owner / Tool | 产物或状态 | 门禁含义 |
| :--- | :--- | :--- | :--- |
| 1. 蓝图生产者预投递 corpus | 上游蓝图生产者 | `.CausaForge/blueprint/<software>/` | CausaForge 只把 corpus 当作按需读取的数据源，不全量复制进 `.workflow` |
| 2. 启动 workflow | `workflow_start` 或 `workflow_import_root_cause_blueprint` | `.workflow/<workflowId>/workflow.json` | 问题描述入口进入 `root_cause`；导入 root cause 且 `start=true` 时进入 `planning` |
| 3. Repository preflight | `workflow_prepare_repository` | `repositoryPreparations[]` 从 `pending` 变为 `ready` | 若 `.CausaForge/blueprint/<software>/metadata.json` 提供 `repository_url` / `commit_hash`，必须询问用户选择手动 checkout 或 OpenCode clone/fetch 并 checkout 指定 commit |
| 4. 根因确认 | `root-cause-analyst` + `workflow_record_artifact` | `root-cause.json` | 必须有 confirmed root cause；如果 preflight 仍 pending，`root_cause -> planning` 会被拒绝 |
| 5. 补丁计划 | `patch-planner` + `workflow_record_artifact` | `patch-plan.json` | plan 必须引用当前 root cause；如果 preflight 仍 pending，`planning -> building` 会被拒绝 |
| 6. 构建补丁 | `patch-builder` + `workflow_capture_diff` | `patch-candidate.json` 和 implementation patch | 只能修改 patch plan 批准的产品路径，candidate 必须引用 plan |
| 7. 选择验证来源 | `regression-verifier` + `workflow_prepare_verification_source` | `verification/source.json` 和 manifest | 执行验证前必须让用户选择官方上游测试，或提供具体测试路径 |
| 8. 回归验证 | `regression-verifier` + `workflow_run_verification` | `verification.json` 和 iteration logs | 必须使用已选择来源的 manifest，并通过 root-cause criteria；失败会返回 `building` 返工 |
| 9. 独立审查 | `patch-reviewer` + `workflow_record_artifact` | `review.json` | reviewer session 必须不同于 builder session，review 必须 pass |
| 10. 交付打包 | `delivery-coordinator` + `workflow_record_artifact` | `delivery-package.json` | delivery 必须引用完整 artifact chain，且 delivery patch 与 implementation patch 一致 |
| 11. 关闭 workflow | `workflow_complete` | `completed` state | 只能从 `delivering` 进入 `completed` |

Preflight 的核心效果是：**只要源码仓库准备仍是 pending，CausaForge 就不会允许 workflow 进入真正的实现阶段。** 问题描述入口会卡在 `root_cause -> planning`，导入 root cause 入口会卡在 `planning -> building`，因此两种入口都不能绕过源码准备。

| Phase | Owner | Required artifact | 下一阶段门禁 |
| :--- | :--- | :--- | :--- |
| `intake` | `workflow-orchestrator` | 可选导入 root cause | 从问题描述或导入 root cause 开始 |
| `root_cause` | `root-cause-analyst` | `root-cause.json` | confirmed root cause 存在 |
| `planning` | `patch-planner` | `patch-plan.json` | plan 引用当前 root cause |
| `building` | `patch-builder` | `patch-candidate.json` 和捕获的 patch | candidate 引用 plan，并且只修改批准路径 |
| `verifying` | `regression-verifier` | `verification/source.json` 和 `verification.json` | 使用已选择来源的 manifest，且 verification 通过每条 root-cause criterion |
| `reviewing` | `patch-reviewer` | `review.json` | independent review 通过 |
| `delivering` | `delivery-coordinator` | `delivery-package.json` | delivery 引用完整 artifact chain，且 patch 内容一致 |
| `completed` | protocol state | 完整 artifact chain | workflow 关闭 |
| `blocked` | protocol state | 当前证据 | workflow 被有意停止 |

### 多轮 Agent 迭代

<img src="./docs/diagrams/causaforge-iterative-agent-loop.png" alt="CausaForge 多轮 Agent 迭代闭环图" width="100%" />

SVG 源文件：[`docs/diagrams/causaforge-iterative-agent-loop.svg`](./docs/diagrams/causaforge-iterative-agent-loop.svg)

回修闭环被刻意收窄：只有 `patch-builder` 能修改产品文件，`workflow_prepare_verification_source` 会先记录验证使用官方上游测试还是用户提供的测试路径，`workflow_run_verification` 会在执行配置好的本地或 SSH runner 前强制匹配已选择的 manifest 并执行 `max_iterations` 上限 guard，每一轮失败或通过的验证都会保存在 `.workflow/<workflowId>/iterations/<000N>/`。必需检查失败时会记录 failure evidence 并返回 `building`；超过配置上限的 iteration、缺失或过期的 verification source 都会在 runner 执行前被拒绝；只有通过的 verification 才能进入 independent review。

## Agent 阵容

| Agent id | Mode | 职责 |
| :--- | :--- | :--- |
| `workflow-orchestrator` | primary | 负责 intake、协调、handoff 和最终面向用户的状态 |
| `root-cause-analyst` | subagent | 调查问题并记录 confirmed root cause |
| `patch-planner` | subagent | 将 root cause 转换成最小批准文件变更计划 |
| `patch-builder` | subagent | 只修改批准的产品路径，并记录 patch candidate |
| `regression-verifier` | subagent | 选择官方或用户验证测试，执行受控 manifest，并记录针对 root-cause criteria 的命令证据 |
| `patch-reviewer` | subagent | 独立审查 patch scope、verification sufficiency 和 blocking risks |
| `delivery-coordinator` | subagent | 打包最终 delivery artifact 和 handoff summary |

## Tool Surface

| Tool | 用途 |
| :--- | :--- |
| `workflow_start` | 从问题描述或导入 root cause 创建 workflow state |
| `workflow_status` | 报告 phase、status 和缺失 artifacts |
| `workflow_prepare_repository` | 询问源码 checkout 由用户手动准备还是 OpenCode 代为准备，并记录或执行仓库准备 |
| `workflow_import_root_cause_blueprint` | 导入外部 RootCauseBlueprint 文件夹、归档源目录并进入 planning |
| `workflow_record_artifact` | 持久化阶段 artifact，并在支持时写入 Markdown rendering |
| `workflow_validate_artifact` | 用 Zod schema 校验 artifact |
| `workflow_capture_diff` | 捕获当前 Git diff 作为 implementation patch |
| `workflow_prepare_verification_source` | 询问验证应使用官方上游测试还是用户提供的测试路径，并记录已选择的 manifest |
| `workflow_run_verification` | 执行受控的本地或 SSH 验证 manifest，并保留每轮日志 |
| `workflow_transition` | 评估 transition gates 并持久化下一阶段 |
| `workflow_return_to_phase` | 当 gate 或 review 需要返工时回到早期 phase |
| `workflow_complete` | 从 `delivering` 关闭 workflow 到 `completed` |

## 架构

<img src="./docs/diagrams/causaforge-architecture.png" alt="CausaForge Agent 架构图" width="100%" />

SVG 源文件：[`docs/diagrams/causaforge-architecture.svg`](./docs/diagrams/causaforge-architecture.svg)

```text
packages/causaforge-core/
  Harness-neutral workflow phases, schemas, artifact store, permissions, and guards.

packages/causaforge-opencode/
  OpenCode plugin module, agent registry, workflow tools, lifecycle hooks, and config parser.

.workflow/<workflowId>/
  Runtime workflow state and artifacts written by the plugin inside the target project.
```

这层拆分很重要：core 拥有事实和 gate；OpenCode adapter 只把这些事实映射到 runtime surface。

## 配置

OpenCode adapter 当前会解析这些配置字段：

| 字段 | 默认值 | 当前行为 |
| :--- | :--- | :--- |
| `artifact_dir` | `.workflow` | 由 adapter config 解析；当前 core artifact root 固定为 `.workflow` |
| `require_independent_review` | `true` | 作为 policy surface 解析；当前 transition guard 无条件强制 independent review |
| `require_clean_worktree` | `true` | 作为 policy surface 解析；当前写入 gate 基于 path 和 phase |
| `allow_plan_deviation` | `false` | 传给 transition guard，用于批准路径 scope 检查 |
| `auto_continue_after_compaction` | `true` | 作为 policy surface 解析；adapter 暴露 compaction state hooks |
| `agents` | `{}` | 可选的 per-agent model、variant 和 reasoning-effort overrides |
| `verification` | local runner, max 5 iterations | 配置受控本地/SSH 验证 runner、允许的命令前缀和迭代上限 |

## 开发

```bash
bun install --ignore-scripts
bun run test
bun run typecheck
bun run build
git diff --check
```

Root package 导出 OpenCode adapter entrypoint，并把 `packages/causaforge-opencode/src/index.ts` 打包成 `dist/index.js`，同时把 RootCauseBlueprint 交接 CLI 打包成 `dist/cli.js`。

## 项目结构

```text
packages/causaforge-core/       State machine, artifact protocol, schemas, permissions, guards
packages/causaforge-opencode/   OpenCode adapter, agents, tools, hooks, config
docs/diagrams/                  README architecture and workflow diagrams
script/build.ts                 Bun build script for the plugin entrypoint and CLI
bin/causaforge.js               CLI wrapper for local build metadata and RootCauseBlueprint import
tasks/                          Execution plans, reviews, and lessons
refactor/                       Design notes for workflow layering
```

## Roadmap

当前方向记录在 [`ROADMAP.md`](./ROADMAP.md)：

- 让 CausaForge 持续聚焦可审计的 OpenCode-first patch workflow。
- 保持 harness-neutral core 与 runtime adapters 的清晰拆分。
- 增强更贴近真实 OpenCode harness 的自动化验证。
- 将 evidence rendering 扩展成 review-ready Markdown summaries。
- 未来新增 adapter 时使用独立 package，而不是兼容别名。

## CausaForge 不是什么

- 它不是通用 chat-agent bundle。
- 它不能替代测试、类型检查或代码审查。
- 本 README 不记录公开的 package-manager installer flow。
- 它目前还不是 multi-harness runtime；当前生产 adapter 是 OpenCode。

## License

CausaForge Agent 使用 [`SUL-1.0`](./LICENSE.md) 发布。
