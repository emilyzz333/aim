## MODIFIED Requirements

### Requirement: Requirement 模块关联
Requirement 模型 SHALL 支持多模块关联（ManyToMany），替代原单一 module FK。

#### Scenario: 关联多个模块
- **WHEN** 需求跨多个模块（如订单+财务）
- **THEN** requirement.modules 可存储多个 Module 记录

#### Scenario: 原有单模块数据迁移
- **WHEN** 执行数据迁移脚本
- **THEN** 原 module FK 非空的记录自动写入 modules M2M 中间表

## ADDED Requirements

### Requirement: Project summary 字段
Project 模型 SHALL 新增 summary 文本字段，存储项目级实现逻辑说明，用于 AI 理解 prompt 上下文注入。

#### Scenario: summary 注入 AI prompt
- **WHEN** 执行 generate_structured_ai_understanding 任务
- **THEN** 若 project.summary 非空，将其注入 prompt 的项目上下文部分

### Requirement: AI 理解 JSON 输出结构
AI 理解任务 SHALL 输出 flat features[] 结构，每条功能含 module_name 路径字段。

#### Scenario: features 按模块路径标注
- **WHEN** AI 输出 JSON
- **THEN** 每个 feature 含 module_name 字段（如"订单/退款"），不嵌套 platforms

#### Scenario: acceptance_criteria 场景分类
- **WHEN** AI 输出验收标准
- **THEN** 每条 acceptance_criteria 含 scenario 字段（正常流程/异常流程/边界情况）

#### Scenario: technical_design_notes 结构化
- **WHEN** AI 输出技术注意事项
- **THEN** 输出包含 data_model_hints/api_hints/permission_hints/performance_hints/common_pitfalls 五个数组字段

### Requirement: 模块确认 API
系统 SHALL 提供模块确认接口，接收用户确认的模块 ID 列表，保存到 requirement.modules。

#### Scenario: 保存确认模块
- **WHEN** POST /requirements/{id}/confirm-modules/ 携带 module_ids 列表
- **THEN** 清空并重写 requirement.modules，返回更新后的模块列表

#### Scenario: AiUnderstanding 存储建议模块
- **WHEN** AI 理解任务完成
- **THEN** 将 features[].module_name 去重后存入 AiUnderstanding.suggested_modules 字段
