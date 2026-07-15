# CausaForge Core Workflow

CausaForge 的核心设计是六阶段证据链：Root Cause → Planning → Building → Verifying → Reviewing → Delivering。

每个阶段只允许写入自己的产物类型，状态转换由 `packages/causaforge-core` 的 guard 统一判定。OpenCode adapter 只负责把 Agent、Tool 和 Hook 映射到这套状态机，不拥有业务事实源。

## 后续扩展原则

- 新 adapter 必须新建独立 package。
- 新 adapter 只能依赖 `@causaforge/core`，不能复用 OpenCode adapter 的运行时假设。
- 新 workflow name、Agent name 和 tool name 必须遵循 CausaForge 命名体系。
