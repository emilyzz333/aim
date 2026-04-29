## Why

需求 PRD 和 UI 设计稿存放在 Figma 上，平台目前无法直接获取这些内容，导致需求全生命周期的 AI 提效链路缺少数据来源。Figma 集成是后续技术方案生成、测试用例自动生成、AI 自动化测试等所有 AI 提效能力的前提和根基。

## What Changes

- **新增** `AiInputAsset.source_type` 枚举值：`figma_rest`（Figma REST API）、`figma_mcp`（Figma MCP）
- **新增** `_fetch_figma_content_rest()` 函数：调用 Figma REST API，提取文本节点内容和图片，下载图片到本地/OSS，返回带 `[图片N]` 占位符的文本
- **新增** `_fetch_figma_content_mcp()` 函数：通过 Figma MCP Server 读取文件内容，直接进行 AI 解析（不经过本地存储）
- **新增** `settings.py` 配置项 `FIGMA_FETCH_MODE`：值为 `rest`（默认）、`mcp` 或 `rest_mcp`，控制数据拉取和 AI 处理方式
- **新增** `fetch_md` 接口对 `figma_rest` / `figma_mcp` 来源类型的处理分支，根据 `FIGMA_FETCH_MODE` 自动路由
- **新增** `parse_document_task` 和 `generate_structured_ai_understanding` 中对 Figma MCP 模式的支持：检测到 `figma_mcp` 或 `rest_mcp` 模式时，调用 Claude API + Figma MCP tool 实时读取
- **新增** `FigmaConfigView`：查看 Figma Token 配置状态、过期时间、当前对接模式，测试连通性
- **新增** `settings.py` 配置项：`FIGMA_API_TOKEN`、`FIGMA_TOKEN_EXPIRES_AT`、`FIGMA_FETCH_MODE`
- **修改** 前端需求详情页：粘贴链接时识别 Figma 域名，自动触发 Figma 同步流程

## Capabilities

### New Capabilities

- `figma-content-fetch`：从 Figma 文件链接提取文本内容和图片，存入 AiInputAsset，供后续 AI 解析流程消费
- `figma-config`：管理 Figma API Token 配置（settings.py），提供连通性检测接口

### Modified Capabilities

- `third-party-integrations`：新增 Figma 作为第三方集成来源，AiInputAsset.source_type 扩展支持 `figma_rest` / `figma_mcp`

## Impact

- **后端**：`apps/requirements/models.py`（source_type 枚举扩展）、`apps/requirements/views.py`（fetch_md 新分支）、`apps/tasks/tasks/md_tasks.py` 或新建 `apps/integrations/figma_service.py`（Figma API 封装）、`apps/integrations/views.py`（FigmaConfigView）、`apps/integrations/urls.py`（新增路由）、`project_management/settings.py`（新增配置项）
- **前端**：需求详情页链接输入组件（Figma 链接识别逻辑）
- **依赖**：`requests` 库（已有）、Figma REST API（需用户提供 Personal Access Token）
- **存储**：图片下载遵循现有 `FILE_UPLOAD_TO_OSS` 开关，调试阶段存本地，生产环境存 OSS
