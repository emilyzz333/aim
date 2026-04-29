---
name: AI Understanding 设计边界与全生命周期背景
description: 需求 AI 解析与 AI 理解的职责边界定义，以及平台全生命周期管理背景
type: project
---

## 平台背景

本平台是一个集成需求项目管理、测试管理、AI提效和度量的综合性平台，整体围绕对需求全生命周期的管理，紧密结合与融入当前的AI技术进行提效。

### 需求全生命周期阶段

1. **需求阶段**：需求创建/拉取、需求prd/UI设计稿获取、需求评审、需求解析/缺陷预判-AI提效
2. **技术/开发阶段**：技术方案-AI提效、技术开发-AI提效、提测
3. **测试阶段**：自动测试计划-AI提效、AI测试用例生成-AI提效、测试用例选取-AI提效、测试用例执行-AI提效-AI自动化API测试/AI自动化UI测试/手工测试、测试缺陷记录、测试结果-AI提效、测试报告生成-AI提效
4. **度量阶段**：质量度量-AI提效、团队度量-AI提效 等

**关键**：需求 AI Understanding 是整个 AI 提效链的起点，它的输出质量直接影响技术方案生成、测试用例生成、缺陷预判等后续所有 AI 提效环节。

---

## 数据模型

### AiInputAsset（素材批次）

**职责**：存储一次上传/拉取/AI对话的原始素材

**字段**：
- `understand_type`：`req_md` / `ui_design` / `ui_design_web` / `ui_design_app` / `tech_md`
- `source_type`：`upload_file` / `url_fetch` / `ai_conversation`
- `batch_desc`：批次说明（文件名 / URL / 对话时间戳）
- `file_paths`：JSON `{'source_files': [...], 'images': [...]}`
- `text_content`：原始文本内容（含 `[图片N]` 占位符）
- `is_selected`：是否选为最优素材

**来源类型**：
- `upload_file`：PDF / docx / md / txt 文件上传，解析后提取文本+图片
- `url_fetch`：普通 URL 或 Figma URL，异步抓取内容
- `ai_conversation`：AI 对话历史 + 截图，前端生成占位符

### AiUnderstanding（AI 理解记录）

**职责**：持有解析和理解两阶段的状态和结果

**字段**：
- `input_assets`：M2M 关联多个 `AiInputAsset`
- `parse_status`：`pending` / `processing` / `done` / `failed`（解析阶段）
- `parsed_content`：解析内容（文本+表格）
- `parsed_content_with_images`：解析内容（含图片识别）
- `parse_reviewed`：解析已审核
- `status`：`pending` / `processing` / `done` / `failed`（理解阶段）
- `ai_understanding`：AI 理解文本
- `ai_understanding_result`：AI 理解结构化结果（JSON）
- `ai_reviewed`：AI 理解已审核
- `is_selected`：是否为最优理解

**DEPRECATED 字段**（已废弃，统一从 `input_assets` 读取）：
- `source_type` / `source_ref` / `raw_content`

---

## AI 解析 vs AI 理解的边界

### AI 解析（Parse）

**目标**：把多模态原始素材（文本 + 图片）→ 统一的、完整的、结构化的文本描述

**输入**：一批 `AiInputAsset`（通过 M2M 关联到 `AiUnderstanding`）

**处理流程**（Celery 任务 `parse_document_task`）：
1. 读取所有关联 `AiInputAsset` 的 `text_content`（已含 `[图片N]` 占位符）
2. 对所有图片调用 Vision LLM，得到图片描述
3. 把图片描述替换回文本中的占位符位置
4. **可选**：调用 LLM 对"文本+图片描述"做初步结构化整理（如：合并重复信息、提取关键段落、统一格式）

**输出**：
- `parsed_content`：纯文本（不含图片识别）
- `parsed_content_with_images`：纯文本（含图片识别结果）

**特点**：
- 信息无损转换，不做语义理解和提取
- 输出是"完整的原始需求描述"，人类可读
- 可以人工审核：检查图片识别是否准确、文本是否完整

---

### AI 理解（Understanding）

**目标**：从 `parsed_content_with_images` 中提取结构化的需求语义，生成后续流程可直接使用的数据

**输入**：`parsed_content_with_images`（AI 解析的输出）

**处理流程**（Celery 任务 `generate_structured_ai_understanding`）：调用 LLM 做深度语义分析，提取：
- **功能列表**（features）：每个功能的名称、描述、优先级
- **验收标准**（acceptance_criteria）：每个功能的可测试条件
- **技术约束**（constraints）：性能要求、兼容性、安全要求
- **UI 交互规则**（如果有 UI 设计稿）
- **数据模型**（如果涉及）
- **质量问题**（缺失、矛盾、未定义、风险）

**输出**：
- `ai_understanding`：AI 理解文本（Markdown）
- `ai_understanding_result`：JSON 结构化数据

**特点**：
- 语义提取和结构化，有信息筛选和归纳
- 输出是机器可读的结构化数据，直接供后续 AI 提效使用
- 可以人工审核：检查功能是否遗漏、验收标准是否合理

---

## 完整数据流

```
[AiInputAsset] (upload_file / url_fetch / ai_conversation)
  ↓ 
  ↓ POST /ai-input-assets/{id}/trigger-parse/
  ↓ 或 POST /requirements/{id}/fetch-md/ (自动创建 Asset + Understanding)
  ↓
[AiUnderstanding] 创建，parse_status: pending
  ↓
  ↓ Celery: parse_document_task
  ↓
[AiUnderstanding] parse_status: processing → done
  ↓ parsed_content / parsed_content_with_images 已生成
  ↓
  ↓ GET /ai-understandings/{id}/parse-review/ (人工审核解析结果)
  ↓ POST /ai-understandings/{id}/parse-review/approve/
  ↓
  ↓ 自动触发 Celery: generate_structured_ai_understanding
  ↓
[AiUnderstanding] status: pending → processing → done
  ↓ ai_understanding / ai_understanding_result 已生成
  ↓
  ↓ GET /ai-understandings/{id}/understanding-review/ (人工审核 AI 理解)
  ↓ POST /ai-understandings/{id}/understanding-review/approve/
  ↓
[AiUnderstanding] ai_reviewed: True
  ↓
  ↓ PATCH /ai-understandings/{id}/select/ (选为最优理解)
  ↓
[Requirement] req_understanding 字段更新（仅 req_md 类型）
  ↓
  ↓ 下游 AI 代理消费
  ↓
GET /ai-understandings/{id}/understanding/?format=minimal
  → 返回 features + acceptance_criteria（需 ai_reviewed=True）
```

---

## 两阶段审核机制

### 解析审核（Parse Review）

**端点**：
- `GET /ai-understandings/{id}/parse-review/` - 获取解析内容
- `POST /ai-understandings/{id}/parse-review/approve/` - 批准，触发 AI 理解任务
- `POST /ai-understandings/{id}/parse-review/reject/` - 拒绝，重置状态并重新解析

**审核内容**：
- 图片识别是否准确
- 文本是否完整
- 表格是否正确提取

### AI 理解审核（Understanding Review）

**端点**：
- `GET /ai-understandings/{id}/understanding-review/` - 获取 AI 理解
- `POST /ai-understandings/{id}/understanding-review/approve/` - 批准
- `POST /ai-understandings/{id}/understanding-review/reject/` - 拒绝，触发重新生成

**审核内容**：
- 功能是否遗漏
- 验收标准是否合理
- 技术约束是否准确
- 质量问题是否识别

---

## 扩展到其他类型

- **UI 设计稿**：解析 = Vision LLM 识别界面元素；理解 = 提取交互规则和组件列表
- **技术方案**：解析 = 提取文本；理解 = 提取架构决策、技术栈、接口定义

---

## Why: 为什么这样设计

**Why**：需求 AI Understanding 是后续所有 AI 提效的基石，必须保证质量。分两阶段审核（解析审核 + 理解审核）可以：
1. 在信息转换阶段就发现图片识别错误、文本缺失等问题
2. 在语义提取阶段发现功能遗漏、验收标准不合理等问题
3. 避免"垃圾进垃圾出"，保证后续 AI 提效的输入质量

**How to apply**：
- 设计新的 AI 提效功能时，优先考虑是否需要"解析 + 理解"两阶段
- 解析阶段关注信息完整性，理解阶段关注语义准确性
- 两阶段都需要人工审核机制
- `AiInputAsset` 可独立触发解析/理解，支持多次尝试和版本对比
- 下游消费必须检查 `ai_reviewed=True`，确保质量
