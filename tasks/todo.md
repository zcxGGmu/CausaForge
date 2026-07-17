# CausaForge 当前执行计划

## Stage 16：blocked 恢复路径与 builder session 记录修正

- [x] 确认 `blocked` phase 可以恢复到 root cause、planning、building、verifying
- [x] 确认进入 building / verifying 时都会绑定当前 builder session
- [x] 运行 `bun run build` 并保存验证证据
- [x] 记录 Stage 16 review

### Stage 16 Review

- `blocked` transition matrix 已允许恢复到 `root_cause`、`planning`、`building`、`verifying`，仍禁止恢复到 reviewing、delivering、completed 或 blocked 自身。
- `buildNextState` 现在在进入 `building` 与 `verifying` 时都记录当前请求 session 为 `builderSessionId`，避免 building 阶段缺少可信 builder session。
- 相邻测试首次运行暴露旧断言仍将 `blocked` 当终态；已同步更新 transition matrix 测试，并新增 entering building 的 builder session 回归测试。
- 验证证据写入 `.causaforge/evidence/20260718-transition-recovery-build/`：`bun run build`、相邻 core 测试、全量测试、typecheck、严格旧身份扫描和 `git diff --check` 均通过。

## Stage 15：多轮迭代次数上限图示纠偏

- [x] 将 `max_iterations` guard 补入多轮 Agent 迭代 SVG/PNG 图，明确超限会在 runner 执行前拒绝
- [x] 同步更新 README 与 README.zh-CN 的多轮迭代说明，避免用户误以为没有迭代上限
- [x] 增加 `MAX_ITERATIONS_EXCEEDED` 回归测试，证明超限不会执行验证命令
- [x] 运行图示渲染/视觉 QA、README 链接、相关测试、typecheck、build、diff check 和严格扫描
- [x] 写入 `.causaforge/evidence/20260717-iteration-cap-diagram/` 证据并创建中文阶段提交

### Stage 15 Review

- 多轮 Agent 迭代图已新增 `iteration > max_iterations` guard，位置在 `workflow_run_verification` 下方，表达超限会在 runner 执行前拒绝。
- README 与 README.zh-CN 已同步说明 `workflow_run_verification` 会先执行 `max_iterations` 上限 guard，再运行本地或 SSH runner。
- 新增 workflow tools 回归测试，覆盖默认上限 5 下第 6 轮触发 `MAX_ITERATIONS_EXCEEDED`，并断言不会调用 command runner。
- 验证证据写入 `.causaforge/evidence/20260717-iteration-cap-diagram/`：视觉 QA、README 链接、SVG/XML、PNG 渲染、96 个测试、typecheck、build、diff check 和严格扫描均通过。

## Stage 14：README 多轮 Agent 迭代架构图

- [x] 新增多轮 agent 迭代闭环 SVG/PNG 图，展示 builder、verification runner、failure evidence、回修和 review gate
- [x] 将图嵌入 README 与 README.zh-CN，并补充简短架构说明
- [x] 渲染 PNG 并进行视觉 QA，确认文字、箭头和节点没有重叠或裁切
- [x] 运行 README 链接检查、SVG/XML 校验、测试、typecheck、build、diff check 和严格旧标识扫描
- [x] 写入 `.causaforge/evidence/20260717-iterative-agent-loop-diagram/` 证据并创建中文阶段提交

### Stage 14 Review

- 新增 `docs/diagrams/causaforge-iterative-agent-loop.svg` 与 PNG，展示 patch production path、受控 verification runner、failure evidence、evidence store、return_to_phase(building) 和 review/delivery gate。
- README 与 README.zh-CN 在 Workflow 表后新增多轮 Agent 迭代小节，帮助用户和开发者理解失败验证如何回到 building 并保留每轮证据。
- 图示已通过 XML 校验、PNG 渲染和人工视觉 QA；未发现文字重叠、箭头穿过文本或裁切。
- 验证证据写入 `.causaforge/evidence/20260717-iterative-agent-loop-diagram/`：README 链接、SVG/XML、PNG 渲染、95 个测试、typecheck、build、diff check 和严格旧标识扫描均通过。

## Stage 13：多轮 Agent 迭代验证闭环

- [x] 定义 core 层迭代验证协议：test manifest、verification run、iteration attempt schema 与版本化 artifact paths
- [x] 以 TDD 增加 schema/store 测试，确保每轮失败和成功验证证据不会被覆盖
- [x] 在 OpenCode adapter 增加受控 `workflow_run_verification` tool，支持本地 runner 执行 manifest 命令并写入 iteration 证据
- [x] 将 tool surface、权限 hook、agent prompt 和 markdown/evidence renderer 接入多轮验证闭环
- [x] 增加集成测试覆盖“一轮失败后回 building，第二轮通过后进入 review”的流程
- [x] 更新 README / ROADMAP，说明当前支持的多轮迭代范围与 SSH runner 的安全边界
- [x] 运行相关包测试、typecheck、build、严格旧标识扫描、`git diff --check`，并写入 `.causaforge/evidence/20260717-iterative-verification/`

### Stage 13 Review

- Core 新增 `TestSuiteManifest` 与 `VerificationRunArtifact` 协议，并将 verification run 按 `.workflow/<workflowId>/iterations/<000N>/verification-run.json` 持久化，同时维护 `verification/latest-run.json`。
- OpenCode adapter 新增 `workflow_run_verification`，通过配置化 local/SSH runner 和允许命令前缀执行受控 manifest，记录每轮 stdout/stderr 日志并同步生成现有 transition gate 可读取的 `verification.json`。
- 多轮闭环已由集成测试覆盖：第一轮 verification fail 阻止 review，workflow 返回 building；第二轮 verification pass 后进入 independent review，并保留两轮 run history。
- README / README.zh-CN / ROADMAP 已更新为九个 workflow tools，并说明 verification runner、SSH runner 与迭代上限配置。
- 验证证据写入 `.causaforge/evidence/20260717-iterative-verification/`：95 个测试、typecheck、build、diff check 和严格旧标识扫描均通过。

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

## Stage 12：项目级社区贡献风格 Skill

- [x] 初始化 `skills/repository-contribution-style/`，生成规范的 `SKILL.md` 与 `agents/openai.yaml`
- [x] 定义本地贡献文档、GitHub 社区文件、提交工具链和近期合并历史的发现顺序
- [x] 定义 commit message、PR title、PR body 和来源说明的生成契约与证据优先级
- [x] 加入缺少 GitHub CLI、私有仓库权限、模板缺失和规则冲突时的停止与降级条件
- [x] 运行 frontmatter 校验，以及正向触发、负向触发和完整流程场景测试
- [x] 运行全量测试、typecheck、build、严格标识扫描和 `git diff --check`
- [x] 将验证证据写入 `.causaforge/evidence/20260716-repository-contribution-style-skill/` 并创建中文阶段提交

### Stage 12 Review

- 新增项目级 `repository-contribution-style` Skill，可根据目标仓库的贡献指南、PR 模板、commit/release 配置和近期维护者实践生成 commit 与 PR 文案。
- 工作流会先绑定目标仓库与 artifact-specific diff scope；commit 默认读取 staged diff，PR 使用目标 remote-qualified base 或已验证 base SHA，避免混入无关 checkout/工作区改动。
- GitHub ref、path、模板和 PR 内容统一视为不可信数据，动态值采用结构化参数或 URI 编码，不执行仓库内容中的命令、凭据请求或提示覆盖指令。
- 场景测试覆盖 3 个正向触发、2 个负向触发、CausaForge 真实流程、Kubernetes 模板抓取、7 类变更发现/降级路径、多模板冲突和恶意 ref/path/prompt injection。
- 独立审查发现的命令注入、目标绑定、diff scope、优先级和历史样本过滤问题均已修复；最终复审无 findings。
- 验证证据写入 `.causaforge/evidence/20260716-repository-contribution-style-skill/`：skill validator、89 个测试、typecheck、build、占位符/旧标识扫描、diff check、场景测试和最终审查均通过。

## Stage 9：README 首屏与项目叙事优化

- [x] 深读当前项目事实源：README、ROADMAP、package metadata、agent/tool registry、core guard 和 evidence store
- [x] 参考用户指定 README 的结构手法，提炼可复用的首屏、安装、Highlights 和深层说明模式
- [x] 重写 README：突出项目定位、TL;DR、安装/本地验证、Agent 使用提示、功能矩阵、架构图、工作流门禁和目录边界
- [x] 保持事实准确：不虚构 npm 发布状态、用户评价、社区入口、多语言文档或未实现功能
- [x] 运行 README 链接/图片检查、旧标识扫描、测试、typecheck、build 和 diff check
- [x] 将验证证据写入 `.causaforge/evidence/20260715-readme-optimization/` 并创建中文阶段提交

### Stage 9 Review

- README 已重构为 GitHub 首屏型文档：callout、居中标题、badge、架构图、TL;DR、Agent 使用提示、Highlights、工作流、Agent/Tool 表、配置说明和非目标。
- 参考用户指定 README 的结构方法，但没有保留外部仓库品牌、用户评价、社区入口、包管理器安装器、多语言文档或未实现的多 harness 运行时声明。
- 文档事实来自当前项目源码和元数据：`package.json`、`ROADMAP.md`、core phase/guard/artifact store、OpenCode agent/tool/hook surface。
- 验证证据写入 `.causaforge/evidence/20260715-readme-optimization/`：README 链接、package fact check、claim scan、旧标识扫描、89 个测试、typecheck、build 和 diff check。

## Stage 10：README 架构图视觉重叠修复

- [x] 复现 README 第一张架构图文字与节点重叠问题，并保存修复前图像证据
- [x] 定位 SVG 布局根因：顶部节点侵入 layer header / subtitle 区域
- [x] 调整架构图 SVG 节点、箭头和标签坐标，重新渲染 PNG
- [x] 人工查看修复后 PNG，确认标题、说明、节点和连线标签不再重叠
- [x] 记录 README 视觉 QA 教训，运行图像/文档验证和 diff check
- [x] 写入 `.causaforge/evidence/20260716-readme-architecture-visual-fix/` 证据并创建中文阶段提交

### Stage 10 Review

- 已确认 README 第一张架构图原问题：Adapter/Core layer 说明与顶部节点视觉重叠，尤其 Core Layer 与 State Machine 区域。
- 根因是 SVG 顶部节点 y 坐标过高，侵入 layer header/subtitle 区域；旧 QA 只验证渲染成功，没有人工视觉检查。
- 已将 Adapter/Core 节点下移并同步调整箭头与标签，重新渲染 `docs/diagrams/causaforge-architecture.png`。
- 已把 README 图示视觉检查要求补充进 `tasks/lessons.md`，并保存 before/after PNG、手工视觉检查、SVG/XML、链接、扫描、测试、typecheck、build 和 diff check 证据。

## Stage 11：中英文 README 与语言切换

- [x] 保持 `README.md` 作为 GitHub 默认英文主页
- [x] 在英文 README 顶部添加 `English / 简体中文` 语言切换入口
- [x] 新建 `README.zh-CN.md`，完整提供中文 README 内容并保留事实、链接、图示和命令一致性
- [x] 在中文 README 顶部添加返回英文主页的语言切换入口
- [x] 验证两份 README 的本地链接、语言切换互链、旧标识扫描、测试、typecheck、build 和 diff check
- [x] 写入 `.causaforge/evidence/20260716-bilingual-readme/` 证据并创建中文阶段提交

### Stage 11 Review

- `README.md` 保持为默认英文主页，并在顶部提供 `English` 当前态与 `简体中文` 切换按钮。
- 新增 `README.zh-CN.md` 作为完整简体中文 README，顶部提供返回英文主页的语言切换按钮。
- 两份 README 保持相同事实边界、安装命令、图示、工具/Agent 表、配置说明、Roadmap 和非目标声明。
- 验证证据写入 `.causaforge/evidence/20260716-bilingual-readme/`：本地链接、语言切换、旧标识扫描、89 个测试、typecheck、build 和 diff check。

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
- [x] 推送 `main` 到远程 origin


### Stage 8 Review

- 已从 `codex/workflow-core-refactor` 的 `482a694` 快照导入 207 个受版本控制文件到独立仓库 `/Users/zq/Desktop/ai-projs/posp/CausaForge`。
- 新仓库保留 CausaForge-only 结构，并将 repository、bugs、homepage 与 author 指向独立远程 owner。
- 验证通过：`bun install --ignore-scripts`、89 个测试、typecheck、build、生产入口 probe、package metadata probe、`git diff --check` 和严格身份扫描。
- 本阶段不保留源仓库 Git 历史，目标是形成独立仓库的干净初始提交。
- `main` 已推送到远程 `git@github.com:zcxGGmu/CausaForge.git`，并建立 upstream 跟踪。
