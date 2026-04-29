---
name: AI-M 平台概览与实现现状
description: 平台定位、需求全生命周期四大阶段、当前实现进度、AI 对接机制
type: project
---

## 平台定位

**AI-M 平台**是一个集成需求项目管理、测试管理、AI提效和度量的综合性平台，整体围绕对需求全生命周期的管理，紧密结合与融入当前的AI技术进行提效。

---

## 需求全生命周期四大阶段

### 1. 需求阶段
- 需求创建/拉取
- 需求 PRD/UI 设计稿获取
- 需求评审
- 需求解析/缺陷预判（AI 提效）

### 2. 技术/开发阶段
- 技术方案（AI 提效）
- 技术开发（AI 提效）
- 提测

### 3. 测试阶段
- 自动测试计划（AI 提效）
- AI 测试用例生成（AI 提效）
- 测试用例选取（AI 提效）
- 测试用例执行（AI 提效）
  - AI 自动化 API 测试
  - AI 自动化 UI 测试
  - 手工测试
- 测试缺陷记录
- 测试结果（AI 提效）
- 测试报告生成（AI 提效）

### 4. 度量阶段
- 质量度量（AI 提效）
- 团队度量（AI 提效）
- 其他度量指标

---

## 当前实现现状（需求阶段）

### 需求创建/拉取
- ✅ 本平台自建：迭代 / 需求 / 任务 / 缺陷
- ✅ TAPD 对接：数据同步 / 展示

### 需求 PRD/UI 设计稿内容获取
- ✅ Confluence 对接
- ✅ Figma 对接
- ✅ 文件上传与内容解析
  - PDF 内容提取（文本 + 图片）
  - DOCX 内容提取（文本 + 图片）
  - Markdown 文件解析
  - 图片嵌在占位符位置（`[图片N]`）
- ✅ 文件夹上传
- ✅ AI 对话保存

### 需求解析 - AI 解析/AI 理解
- ✅ 每次链接/上传文件/AI 对话保存 → 对应一个 `AiInputAsset` 批次
- ✅ 批次展示在需求理解 tab 页的文件列表
- ✅ 一次 `AiInputAsset` 支持多次 AI 解析/理解
- ✅ 点击 AI 解析/理解 → 左右对比展示原始内容与 AI 解析/理解结果（方便比对）

---

## AiInputAsset 内容提取机制

### 处理流程
1. **保存链接/文件**：创建 `AiInputAsset` 记录
2. **内容提取**：
   - **链接**：调用 API 获取内容（Confluence / Figma / 普通 URL）
   - **PDF**：提取文本 + 图片，图片保存到 `file_paths.images`，文本中插入 `[图片N]` 占位符
   - **DOCX**：提取文本 + 图片，同上
   - **Markdown**：解析文本，提取嵌入图片
3. **存储**：
   - `text_content`：原始文本内容（含 `[图片N]` 占位符）
   - `file_paths`：`{'source_files': [...], 'images': [...]}`

---

## AiUnderstanding AI 解析机制

### AI 解析（Parse）

**目标**：将多张图片进行 LLM 图片识别，组合成结构化结果

**处理流程**：
1. 读取关联的 `AiInputAsset` 批次
2. `parsed_content` → 纯文本 + 图片占位符
3. 对每张图片调用 Vision LLM 进行识别，生成ai_understanding_result.`image_descriptions` → 图片描述结构化存储（JSON 格式，每张图片的识别结果）
4. 文本parsed_content和图片识别结果image_descriptions，组装到`parsed_content_with_images` → 组装后的展示内容（<sub>📷...</sub> 替换占位符），存储到 `AiUnderstanding` 记录，parsed_content_with_images支持页面上进行人为编辑
5. 后续 AI 理解的 prompt 里说明 <sub>📷...</sub> 是低权重辅助内容

**前端展示方式**：
前端展示和编辑都使用parsed_content_with_images字段

### AI 理解（Understanding）

**目标**：从解析结果中提取结构化的需求语义

**输入**：`parsed_content_with_images`

**输出**：
- `ai_understanding`：AI 理解文本（Markdown）
- `ai_understanding_result`：结构化 JSON（features / acceptance_criteria / constraints 等）

---

## AI 对接机制

### 多代理商轮询

**配置位置**：`settings.py` 或 `settings.local.json`

**机制**：
- 配置多个 Claude API 代理商（不同的 `base_url` + `api_key`）
- 请求时按顺序轮询，失败自动切换下一个代理商
- 提高可用性和请求成功率

**Why**：
- 单一代理商可能有限流、故障等问题
- 轮询机制保证服务稳定性
- 降低单点故障风险

**How to apply**：
- 新增 AI 功能时，统一使用 `AIService` 类（已封装轮询逻辑）
- 不要直接调用单个代理商 API
- 配置文件中维护代理商列表

---

## 技术栈

### 后端
- Django 4.2 + DRF
- Celery（异步任务：文档解析、AI 调用）
- MySQL（数据库名：`m_platform`）

### 前端
- React 18 + Ant Design 5 + Vite 5
- React Router v6

### AI 集成
- Claude API（多代理商轮询）
- Vision LLM（图片识别）
- DeepSeek API（备选）

### 第三方集成
- TAPD（需求同步）
- Confluence（文档获取）
- Figma（设计稿获取）
- 企微 Webhook（通知推送）
- GitLab（技术方案拉取）

---

## 工作目录结构

```
d:\gdSDDpmo\
├── backend/          # Django 后端
├── frontend/         # React 前端
├── spec/             # 设计文档、过程记录
├── openspec/         # OpenSpec 提案和归档
└── .claude/          # Claude Code 配置和记忆
    └── memory/       # 项目级记忆
```
