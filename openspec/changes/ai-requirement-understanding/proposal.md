## 为什么

需求以不一致的格式到达（PDF、Markdown、截图、混合内容），包含嵌入图片和不完整的历史上下文。下游 AI 代理（技术设计、测试生成、缺陷预测）需要结构化、丰富的需求数据才能有效运作。如果没有标准化的 AI 理解层，每个下游代理都必须冗余地解析文档、识别图片和获取上下文，导致解释不一致和计算浪费。

## 变更内容

- 添加两阶段需求处理：文档解析 → AI 理解
- 实现多格式文档解析（PDF、DOCX、Markdown、URL、GitLab、AI 对话）
- 在解析阶段添加可配置的图片识别（Vision LLM）
- 生成包含功能、验收标准、质量问题的结构化 AI 理解
- 使用历史上下文（模块知识 + 相关需求）丰富理解
- 在解析后和 AI 理解后添加人工审核关卡
- 为技术设计、测试生成和其他 AI 代理提供下游消费 API
- 通过配置支持不同解析策略的 A/B 测试

## 能力

### 新增能力
- `document-parsing`：从多种文档格式中提取文本、表格和图片；可选使用 Vision LLM 识别图片
- `ai-understanding`：生成包含功能、验收标准、变更、质量问题和历史上下文丰富的结构化需求理解
- `human-review-workflow`：在解析和理解阶段启用人工审核和批准，并跟踪状态
- `downstream-consumption`：为下游 AI 代理提供结构化 API 以消费已批准的需求理解

### 修改的能力
<!-- 没有在需求层面修改现有能力 -->

## 影响

**后端模型**：
- `apps/requirements/models.py`：扩展 `AiUnderstanding` 添加解析字段（parse_status、parsed_content、parsed_content_with_images、parse_reviewed）
- `apps/projects/models.py`：扩展 `Module` 添加知识积累；新增 `ModuleKnowledge` 和 `RequirementRelation` 模型

**后端任务**：
- `apps/tasks/tasks/ai_tasks.py`：新增 `parse_document_task()` 用于文档解析；修改 `generate_ai_understanding()` 使用解析后的内容
- `apps/tasks/tasks/ai_prompts.py`：新增需求理解的提示模板，包含 CoT、Given-When-Then 格式、质量检测

**后端 API**：
- 新增解析审核、重新解析触发、理解批准、下游消费的端点

**配置**：
- `settings.py`：添加 `AI_UNDERSTANDING_CONFIG` 用于图片识别策略、下游代理设置

**依赖**：
- PyMuPDF (fitz) 用于 PDF 解析
- python-docx 用于 DOCX 解析
- Pillow 用于图片处理
- Vision LLM API（DeepSeek/Claude）用于图片识别
