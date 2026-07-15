# CausaForge OpenCode Adapter

- 本包只负责 OpenCode runtime 适配：Agent 注册、Tool 定义、Hook 组装和会话上下文映射。
- 工作流事实源必须来自 `@causaforge/core` 的 state、artifact store 和 guard，不能信任模型自报身份或阶段。
- 新增 Hook 或 Tool 时必须添加相邻测试，并记录生产入口证据。
