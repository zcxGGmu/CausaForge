# CausaForge Agent 工作规则

## 默认工作流

- 非琐碎任务先在 `tasks/todo.md` 写出可勾选计划，再实施。
- 每完成一个清晰阶段，立即运行验证并创建中文 Git commit。
- 任何用户纠正都要同步到 `tasks/lessons.md`，防止同类问题重复发生。
- 修改 OpenCode 插件入口或 workflow guard 后，必须留下可复核的 harness 或等效生产入口证据。

## 代码边界

- 核心状态机、权限、产物协议放在 `packages/causaforge-core/`。
- OpenCode 适配、Agent 注册、Tool 注册和 Hook 组装放在 `packages/causaforge-opencode/`。
- 新功能默认保持最小实现；不新增兼容别名、旧命名空间或历史发布面。

## 验证要求

- 提交前至少运行相关包测试、类型检查、严格旧标识扫描和 `git diff --check`。
- 证据写入 `.causaforge/evidence/<YYYYMMDD>-<slug>/`。
- 不能用“应该可用”代替命令输出；证据先于完成声明。
