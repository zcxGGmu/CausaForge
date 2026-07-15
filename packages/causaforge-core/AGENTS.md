# CausaForge Core

- 本包保持 harness-neutral，不导入任何具体编辑器、CLI 或插件 runtime。
- 状态转换、权限判断和 artifact schema 必须是确定性纯逻辑，方便 adapter 复用和测试。
- 新增 artifact kind 或 phase 时必须同步更新 schema、guard、renderer 和测试。
