## Why

需求 AI 理解（AI Understanding）是平台后续所有 AI 提效环节的基石——技术方案生成、测试用例生成、缺陷预判等均依赖其输出质量。当前实现存在 JSON 结构嵌套过深（platforms→modules→features）、验收标准缺少场景分类、技术注意事项为自由文本、模块匹配依赖单一 FK 字段等问题，导致输出准确性和下游可用性不足。

## What Changes

- **JSON 输出结构重设计**：从嵌套 `platforms[].modules[].features[]` 改为 flat `features[]`，每条功能含 `module_name` 路径字段；`acceptance_criteria` 增加 `scenario` 字段区分正常/异常/边界场景；`technical_design_notes` 从自由文本改为结构化分类（data_model/api/permission/performance/pitfalls）；`quality_issues` 增加 `feature_name` 关联字段
- **模块关联升级**：`Requirement.module`（FK）→ `Requirement.modules`（ManyToMany），支持需求关联多个模块；AI 理解优先使用已关联模块，否则从项目完整模块树中 AI 匹配，用户可在审核面板确认并保存
- **项目上下文增强**：`Project` 新增 `summary` 字段，存储项目级实现逻辑说明；AI 理解 prompt 注入完整模块树（路径 + 描述 + ModuleKnowledge）
- **System Prompt 升级**：补充 `<img-desc>` 标签处理规则（低权重 + 标注内容优先）；引导 AI 按场景覆盖验收标准；明确技术注意事项的边界（需求隐含约束，非技术方案）；修改类功能引导写"从X改为Y"
- **前端审核面板完整重设计**：概览卡片 + 5 个 Tab（功能列表/变更汇总/质量问题/技术注意/原始输出）；功能列表按 module_name 分组，核心功能默认展开；模块确认交互

## Capabilities

### New Capabilities

- `ai-understanding-review-panel`: 完整重设计的 AI 理解审核面板，含概览卡片、功能列表（按模块分组折叠）、变更汇总、质量问题、技术注意事项五个 Tab，以及模块确认交互

### Modified Capabilities

- `requirement-lifecycle`: Requirement.module FK → modules M2M；Project 新增 summary 字段；AI 理解 JSON 输出结构变更；prompt 构建逻辑升级

## Impact

- **后端模型**：`Requirement`（module FK → modules M2M，需数据库迁移）、`Project`（新增 summary 字段）
- **后端任务**：`ai_tasks.py` generate_structured_ai_understanding、_update_module_knowledge、_extract_json_from_response
- **后端 Prompt**：`ai_prompts.py` REQ_UNDERSTANDING_SYSTEM、build_req_understanding_prompt
- **后端 API**：新增模块确认接口（保存用户确认的模块到 requirement.modules）
- **前端组件**：`AiUnderstandingReviewPanel.tsx` 完整重写
- **数据库迁移**：requirement_modules 中间表，原 module FK 数据迁移到 M2M
