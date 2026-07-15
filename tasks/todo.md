# CausaForge 当前执行计划

## Stage 4：严格零旧产品标识清理

- [x] 运行严格扫描并确认旧标识仍存在于 package、目录名、文档、测试、证据和发布脚本中
- [x] 记录纠偏教训：不允许在 archive、证据、兼容别名或包名中保留旧标识
- [x] 将 root package、bin、build、tsconfig 收敛为 CausaForge-only
- [x] 删除旧适配器、旧平台包、旧发行文档、旧测试快照和旧证据文本
- [x] 将保留源码和文档改成 CausaForge-only 命名
- [x] 运行严格扫描、核心测试、typecheck、build、diff check 和生产入口证据
- [x] 创建 Stage 4 中文阶段提交

### Stage 4 Review

- Root package 只保留 `causaforge` / `causaforge-agent` 命令和两个 CausaForge workspace。
- 已删除旧适配器、旧平台包、旧发布脚本、旧多语言文档、旧证据目录和旧测试快照。
- 最终严格扫描覆盖内容与路径：产品标识 0 命中，旧角色与旧功能标识 0 命中。
- 验证通过：88 个核心测试、root 与 package typecheck、build、`git diff --check`。
- 入口证据通过：QA helper self-check 与生产 PluginModule surface probe 均已记录。

## 后续 TODO

- [ ] 为未来非 OpenCode adapter 增加独立 package 模板和独立 QA 证据规范
- [ ] 把 evidence renderer 扩展成审查友好的 Markdown 汇总

## Stage 5：真实 OpenCode 工作流验证

- [x] 复现并定位 `opencode debug config` 加载当前插件超时问题
- [x] 修复真实工具链中 building 阶段无法识别单一活跃 workflow 的权限根因
- [x] 在隔离 XDG 环境下验证 OpenCode 能加载 CausaForge 插件
- [x] 执行完整 workflow 工具链：start → root-cause → plan → build diff → verify → review → delivery → complete
- [x] 运行核心自动化测试、typecheck、build、严格标识扫描和 diff check
- [x] 写入 `.causaforge/evidence/<slug>/` 证据并创建中文阶段提交

### Stage 5 Review

- OpenCode 1.17.13 能在隔离 XDG 环境中加载 `dist/index.js`，配置面注入 7 个规范化 workflow agents。
- OpenCode server API 验证通过：`/global/health` 正常，`/config` 包含 workflow agents，`/experimental/tool/ids` 暴露 8 个 workflow tools，真实 DB session 计数保持不变。
- 完整生产工具链通过：生成 root-cause、patch-plan、patch-candidate、verification、review、delivery 和最终 completed workflow。
- 发现并修复实际问题：building 阶段写代码前未绑定 builder session 时，工具权限钩子无法识别当前 workflow；现在单一活跃 workflow 下会安全回退，并仍按 approved plan 限制写入路径。
- 验证通过：新增回归测试、全量测试、typecheck、build、严格旧标识扫描和 diff check。

## Stage 6：项目身份更名为 CausaForge

- [x] 扫描旧项目身份命中，确认代码、路径、文档、证据和包名范围
- [x] 将 root package、workspace、package scope、CLI bin、插件 id 统一更名为 CausaForge / causaforge
- [x] 将源码 import、测试命令白名单、构建脚本、tsconfig 和 package metadata 改为新的目录与包名
- [x] 将文档、任务记录、AGENTS 规则和 refactor 资料改为 CausaForge 命名
- [x] 将证据根目录迁移为 `.causaforge/evidence`，并清理证据内容中的旧项目名
- [x] 运行全量测试、typecheck、build、OpenCode 生产入口验证、严格旧项目名扫描和 diff check
- [x] 写入 `.causaforge/evidence/<slug>/` 证据并创建中文阶段提交

### Stage 6 Review

- 项目展示名统一为 CausaForge Agent，包名统一为 `causaforge-agent`，CLI 统一为 `causaforge` / `causaforge-agent`。
- Workspace 目录和包 scope 统一为 `packages/causaforge-core`、`packages/causaforge-opencode`、`@causaforge/core`、`@causaforge/opencode-adapter`。
- OpenCode 插件 id 更新为 `causaforge-agent`，生产入口 default export 与 `createPluginModule()` 均返回新 id。
- 证据根目录迁移到 `.causaforge/evidence`，历史证据内容和路径均已清理旧项目名。
- 构建脚本现在会先清理 `dist`，避免旧生成物残留，并生成 root `dist/index.d.ts` 类型入口。
- 验证通过：89 个测试、typecheck、build、生产入口 probe、OpenCode debug config、OpenCode serve API、diff check、旧项目名扫描和旧上游品牌扫描。

## Stage 7：README 架构图与流程图完善

- [x] 补充 README 文档结构，突出 CausaForge 的核心定位和图示入口
- [x] 生成架构图 SVG/PNG，展示 OpenCode adapter、core 协议和 evidence store 的关系
- [x] 生成工作流流程图 SVG/PNG，展示 Root Cause 到 Delivering 的阶段门禁
- [x] 将图表嵌入 README 并补充简短解释
- [x] 运行文档相关验证、图像渲染验证和严格标识扫描
- [x] 创建中文阶段提交


### Stage 7 Review

- README 新增项目定位、架构图、核心流程图和工作流门禁说明。
- 图表产物写入 `docs/diagrams/`，同时保留 SVG 源文件和 PNG 渲染文件，便于 GitHub README 直接展示。
- 架构图展示 OpenCode adapter、Core 协议层、Evidence Store 和产品仓库之间的职责边界。
- 流程图展示 Root Cause → Planning → Building → Verifying → Reviewing → Delivering 的阶段推进、证据落盘和失败回修路径。
- 验证通过：SVG XML 校验、CairoSVG PNG 渲染、README 链接检查、89 个测试、`git diff --check` 和严格旧标识扫描。

## Stage 8：迁移到独立 CausaForge 仓库

- [x] 从 `codex/workflow-core-refactor` 的 HEAD 快照导入完整受版本控制内容
- [x] 将 package repository、bugs、homepage 指向独立远程 `zcxGGmu/CausaForge`
- [x] 运行安装、测试、类型检查、构建、严格标识扫描和 diff check
- [x] 创建独立仓库中文初始提交
- [ ] 推送 `main` 到远程 origin


### Stage 8 Review

- 已从 `codex/workflow-core-refactor` 的 `482a694` 快照导入 207 个受版本控制文件到独立仓库 `/Users/zq/Desktop/ai-projs/posp/CausaForge`。
- 新仓库保留 CausaForge-only 结构，并将 repository、bugs、homepage 与 author 指向独立远程 owner。
- 验证通过：`bun install --ignore-scripts`、89 个测试、typecheck、build、生产入口 probe、package metadata probe、`git diff --check` 和严格身份扫描。
- 本阶段不保留源仓库 Git 历史，目标是形成独立仓库的干净初始提交。
