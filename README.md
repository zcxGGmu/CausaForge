# CausaForge Agent

CausaForge Agent 是一个 OpenCode-first 的补丁交付工作流插件。它把一次代码修改拆成可审计的证据链：根因、计划、候选补丁、回归验证、独立审查和最终交付。

## 项目定位

CausaForge 的核心目标不是提供一组松散的 Agent，而是把补丁交付过程固化成一个受控协议：

- **OpenCode adapter** 负责接入真实 OpenCode session、hooks、tools 和 agent surface。
- **Core package** 负责状态机、产物 schema、权限模型和转换门禁。
- **Evidence store** 负责持久化 workflow state、阶段产物、验证日志和最终交付包。

<img src="./docs/diagrams/causaforge-architecture.png" alt="CausaForge Agent architecture diagram" width="100%">

> SVG 源文件：[`docs/diagrams/causaforge-architecture.svg`](./docs/diagrams/causaforge-architecture.svg)

## 核心工作流

1. **Root Cause**：定位问题边界，输出根因产物。
2. **Planning**：把修复拆成受控文件变更计划。
3. **Building**：只按批准路径生成候选补丁。
4. **Verifying**：运行回归命令并记录证据。
5. **Reviewing**：独立审查补丁和证据链。
6. **Delivering**：确认补丁一致性后完成交付。

<img src="./docs/diagrams/causaforge-workflow.png" alt="CausaForge evidence-chain workflow diagram" width="100%">

> SVG 源文件：[`docs/diagrams/causaforge-workflow.svg`](./docs/diagrams/causaforge-workflow.svg)

## 工作流门禁

CausaForge 的阶段推进由工具和持久化产物共同约束，而不是由模型口头声明决定：

- **产物门禁**：每个阶段产物都必须通过 Zod schema 校验，并引用正确的上游 artifact。
- **权限门禁**：写操作必须匹配当前 Agent、当前阶段和计划中批准的产品路径。
- **验证门禁**：回归验证必须记录真实命令、结果和证据路径。
- **交付门禁**：最终 delivery 必须确认候选补丁、真实 patch 文件和审查结果一致。

## 目录结构

```text
packages/causaforge-core/       Harness-neutral 状态机、产物协议、权限和门禁
packages/causaforge-opencode/   OpenCode adapter、七个 workflow agents、八个 workflow tools、hook 组装
docs/diagrams/                  README 架构图与流程图的 SVG/PNG 产物
script/build.ts                最小构建脚本
bin/causaforge.js               本地 CLI wrapper
tasks/                         当前计划和执行教训
refactor/                      重构说明与后续 TODO
```

## 常用命令

```bash
bun install --ignore-scripts
bun run test
bun run typecheck
bun run build
```

## 设计原则

- **证据链优先**：状态转换只能基于已校验产物和真实文件内容。
- **权限最小化**：写操作必须匹配当前阶段、Agent 职责和批准路径。
- **表面收敛**：只保留 CausaForge 工作流必需的 package、命令和文档。
- **可扩展但不预埋复杂度**：未来 adapter 通过新 package 接入，不复用旧命名或兼容别名。
