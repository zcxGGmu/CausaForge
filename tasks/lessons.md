# 项目执行教训

## 阶段提交纪律

- 用户要求所有非琐碎实施采用阶段化提交：每完成一个计划 Task 或明确阶段，立即提交一次。
- Commit message 使用中文，标题说明阶段成果，正文详细记录改动内容、设计原因和验证证据。
- 不等待多个阶段完成后合并提交；进入下一阶段前先确认当前阶段测试、审查和提交均已完成。
- 该规则必须在新 Codex 会话中自动执行，无需用户再次提醒。

## QA 证据完整性

- 不能把“真实 harness 能加载插件”泛化成“计划要求的全部 Hook、Tool、Gate 已验证”。
- 每个 QA Task 必须逐条对照计划文件中的验收项，缺一项就补证据或补实现，不能只写笼统总结。
- 当 `opencode debug config` 不展示某类表面（例如 plugin tool definitions）时，需要明确记录限制，并用生产入口 Hook/Tool 调用或其他真实 harness 证据补足。
- 隔离 OpenCode QA 时，项目插件配置应写入 `XDG_CONFIG_HOME/opencode/opencode.json`；`debug config` 会把本地插件路径规范化成 `file://...`，断言时必须同时接受原始绝对路径和 file URL。

## 可信事实源与完成审计

- 权限、Scope、Session 和 Transition Guard 不能从模型可控 Tool 参数读取 Agent、Phase、Session ID、批准路径、Artifact Chain 或 Patch 内容；这些事实必须由 Harness 调用上下文、持久化 WorkflowState、经 Schema 校验的 Artifact Store 和真实 Git/File 读取派生。
- 路径权限比较前必须统一斜杠、解析 `.` / `..`、处理绝对路径与项目边界；缺少目标路径或存在多个无法完整解析的目标时应默认拒绝写操作。
- Bash 只读白名单也必须校验可信 Agent/Phase 配对；基于前缀的命令判断必须先拒绝 NUL、引号、反斜杠和 Shell 控制符，避免参数转义绕过。
- 状态文件保护必须以 canonical artifactRoot 和安全 workflow ID 为边界，不能仅按 `workflow.json` 文件名全局拒绝，否则会误伤获批产品文件。
- 工具名前缀不能替代能力语义：`lsp_rename` 会应用 workspace edit，必须从只读 LSP 放行面中排除。
- 生产 Tool Guard 不得在缺少可信上下文时 `return null` 跳过检查；应构造最小请求并让权限 Guard fail-closed。
- 生产 Hook 可以从模型 tool args 读取目标路径和命令文本，但不得读取 Agent/Phase/批准路径；这些必须来自 WorkflowState 和已校验 Artifact Store。
- Workflow Transition / Complete 不得从模型 tool args 读取 Artifact Chain 或 Patch 内容；应从 Artifact Store 读 artifact，并从 workflow 目录内的存储路径读取真实 patch 文件。缺失真实 patch 文件必须拒绝 completed，而不是跳过一致性检查。
- 全量测试通过只证明现有断言成立，不能证明测试覆盖了可信事实源或绕过路径。最终完成审计必须主动构造“模型自报身份、伪造 Session、遗漏 Patch、任意 Artifact ID”等反例。
- 实施计划明确指定的真实 Harness 命令不能用直接调用生产对象替代。若要求 `opencode run --format json` 和对应 SSE 事件，就必须实际运行并保存证据；无法执行时任务保持未完成。

## 去雷同化标准

- 仅删除运行时旧表面不等于完成去雷同化；如果目录、包名、import scope、README 首屏和 AGENTS.md 仍像原项目，用户会合理认为只是换壳。
- 去雷同化应优先处理“审查者第一眼能看到”的结构：物理包目录、私有 package scope、root workspace、CLI/README/ROADMAP 和活跃 adapter 入口。
- 用户已明确纠正：旧产品标识不允许以任何形式继续存在，不能用 `refactor/legacy-*`、历史证据、兼容别名、包名或测试快照保留。
- 严格零旧标识扫描必须覆盖源码、文档、测试、脚本、证据、package 元数据和目录名；发现旧标识后优先删除旧兼容面，而不是继续解释兼容原因。

## README 视觉 QA

- 用户指出 README 第一张架构图存在文字与图形重叠；以后只做链接检查、SVG XML 校验、PNG 渲染成功和构建测试不够。
- 修改或重排 README 图示后，必须人工查看渲染后的 PNG/README 首屏截图，确认标题、说明、标签、箭头和节点没有重叠、裁切或越界。
- 对图示类文档变更，QA summary 必须明确记录“视觉检查通过”或列出无法视觉确认的原因。
- 用户指出多轮 Agent 迭代图漏掉 `max_iterations` 上限；以后架构/流程图必须覆盖关键 guard、配置默认值和失败分支，不能只画主 happy path 与普通失败回修路径。
