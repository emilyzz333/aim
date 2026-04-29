## ADDED Requirements

### Requirement: 测试管理AI用例Tab
测试管理页面（`/test-cases`）SHALL 新增"AI用例"Tab，提供完整的 AI 测试用例生成功能，将集成中心的 AI 测试用例生成能力迁入。

#### Scenario: 进入AI用例Tab
- **WHEN** 测试人员（或管理员）进入测试管理页，点击"AI用例"Tab
- **THEN** 展示 AI 测试用例生成表单，包含：需求ID输入框、需求MD上传/输入、技术MD上传/输入、生成按钮

#### Scenario: AI生成测试用例并展示
- **WHEN** 用户填写需求ID（或MD内容）后点击"生成测试用例"
- **THEN** 调用 `/integrations/ai/test-case-generation/` 接口，生成结果以结构化用例列表展示（用例名称/前置条件/步骤/预期结果）

#### Scenario: 将AI用例保存到测试用例库
- **WHEN** 用户在AI用例结果列表中点击"保存到用例库"
- **THEN** 以 `source=ai`、`reviewed=pending` 调用 `POST /test-cases/` 保存，保存成功后在"测试用例"Tab中可见，审核状态显示"待审核"

---

### Requirement: 需求详情AI用例生成入口
需求详情页 SHALL 提供"生成AI用例"快捷按钮，一键触发 AI 生成并保存，无需跳转到测试管理页。

#### Scenario: 需求详情页生成AI用例
- **WHEN** 用户在需求详情页点击"生成AI用例"按钮
- **THEN** 调用 `/integrations/ai/test-case-generation/`（自动传入当前需求ID），生成结果弹窗展示

#### Scenario: 从需求详情保存AI用例
- **WHEN** 用户在弹窗中确认保存生成的用例
- **THEN** 以 `source=ai`、`reviewed=pending`、`requirement=<当前需求ID>`、`project=<需求所属项目ID>` 调用 `POST /test-cases/` 保存，提示"AI用例已保存，审核状态：待审核"
