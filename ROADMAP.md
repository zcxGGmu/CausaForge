# CausaForge Roadmap

## 当前目标

- 保持一个精简、可审计的 OpenCode-first patch workflow。
- 让核心状态机与 OpenCode adapter 清晰分层，方便后续接入其他 harness。
- 清除旧产品标识、旧发布面和历史兼容壳，避免项目结构与原始来源雷同。

## 已完成

- 建立 `@causaforge/core`：workflow phase、artifact schema、permission guard、transition guard。
- 建立 `@causaforge/opencode-adapter`：七个规范化 workflow agents、八个确定性 workflow tools、生产 Hook 组装。
- 将 root package 收敛为 CausaForge-only：只保留核心 workspace、最小 CLI、最小构建脚本。

## 下一步

- 增加更贴近真实会话的 OpenCode harness 自动化验证。
- 为未来非 OpenCode adapter 预留独立 package 模板。
- 扩展 evidence report renderer，使验证摘要可直接用于代码审查。

## TODO

- 后续新增 adapter 时，每个 adapter 必须有独立测试、独立证据目录和独立发布边界。
