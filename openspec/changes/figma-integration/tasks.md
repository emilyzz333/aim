## 1. 后端配置

- [x] 1.1 在 `settings.py` 新增 `FIGMA_API_TOKEN`、`FIGMA_TOKEN_EXPIRES_AT`、`FIGMA_FETCH_MODE` 配置项（含注释说明，默认 `FIGMA_FETCH_MODE='rest'`，可选值 `'rest'` | `'mcp'` | `'rest_mcp'`）
- [x] 1.2 在 `AiInputAsset.SOURCE_TYPE_CHOICES` 新增 `figma_rest` 和 `figma_mcp` 枚举值
- [x] 1.3 执行数据库迁移 `makemigrations && migrate`

## 2. Figma REST API 封装

- [x] 2.1 新建 `apps/integrations/figma_service.py`，实现 `_parse_figma_url(url)` 函数：从链接解析 `file_id` 和 `node_id`
- [x] 2.2 实现 `_get_figma_nodes(file_id, node_id=None)` 函数：调用 `GET /v1/files/{file_id}`，返回节点树（支持按 node_id 过滤子树）
- [x] 2.3 实现 `_extract_text_and_image_nodes(nodes)` 函数：递归遍历节点树，收集所有 TEXT 节点和含 IMAGE fill 的节点，按 `absoluteBoundingBox.y` 升序排序
- [x] 2.4 实现 `_fetch_image_urls(file_id, node_ids)` 函数：批量调用 `GET /v1/images/{file_id}?ids=...` 获取图片导出 URL
- [x] 2.5 实现 `_download_and_save_images(image_urls, save_dir)` 函数：下载图片到本地/OSS（遵循 `FILE_UPLOAD_TO_OSS` 开关），单张失败不中断，标记 `[图片N-下载失败]`
- [x] 2.6 实现 `_fetch_figma_content_rest(url)` 函数：串联以上步骤，返回 `{ text: str, images: list }` 结构，与现有 `parse_url` 返回格式一致
- [x] 2.7 实现 Token 过期前置检查：调用前对比 `FIGMA_TOKEN_EXPIRES_AT` 与当前日期，过期抛出明确异常

## 3. Figma MCP 模式封装

- [x] 3.1 在 `parse_document_task` 中新增 Figma MCP 模式分支：检测到 `source_type='figma_mcp'` 或 `(source_type='figma_rest' 且 FIGMA_FETCH_MODE='rest_mcp')`
- [x] 3.2 从 `AiInputAsset.batch_desc` 取出 Figma URL
- [x] 3.3 调用 `AIService._call_claude()`，通过 `tools` 参数传入 Figma MCP 配置，让 Claude 直接读取 Figma 内容并输出解析结果
- [x] 3.4 将 Claude 返回结果写入 `AiUnderstanding.parsed_content`，`parse_status` 设为 `done`
- [x] 3.5 在 `generate_structured_ai_understanding` 中同样新增 MCP 模式分支，调用 Claude + MCP 生成 AI 理解结果
- [x] 3.6 实现顶层 `fetch_figma_content(url)` 函数：`rest` 或 `rest_mcp` 模式调用 `_fetch_figma_content_rest`，`mcp` 模式仅返回 `{ text: '', images: [] }`（内容在解析阶段由 Claude 获取）

## 4. fetch_md 接口扩展

- [x] 3.1 在 `apps/requirements/views.py` 的 `fetch_md` 方法中新增 `figma_rest` 来源分支
- [x] 3.2 调用 `fetch_figma_content(source_ref)`，结果经 `save_images_and_build_text` 处理后存入 `AiInputAsset`
- [x] 3.3 统一错误处理：Token 过期/未配置/无效分别返回对应中文提示

## 4. fetch_md 接口扩展

- [x] 4.1 在 `apps/requirements/views.py` 的 `fetch_md` 方法中新增 Figma 链接识别分支（检测 `figma.com` 域名）
- [x] 4.2 调用 `fetch_figma_content(source_ref)`（自动根据 `FIGMA_FETCH_MODE` 路由），结果经 `save_images_and_build_text` 处理后存入 `AiInputAsset`
- [x] 4.3 根据当前模式设置 `source_type`：`rest` 或 `rest_mcp` 模式 → `figma_rest`，`mcp` 模式 → `figma_mcp`
- [x] 4.4 统一错误处理：Token 过期/未配置/无效分别返回对应中文提示

## 5. FigmaConfigView

- [x] 5.1 在 `apps/integrations/views.py` 新增 `FigmaConfigView`：`GET` 返回配置状态（`configured`、`token_expires_at`、`expires_in_days`、`expired`、`mode`）
- [x] 5.2 新增 `POST /test/` action：调用 Figma API `GET /v1/me` 验证 Token 有效性
- [x] 5.3 在 `apps/integrations/urls.py` 注册路由 `/api/integrations/figma/config/` 和 `/api/integrations/figma/config/test/`

## 6. 前端：链接来源识别

- [x] 6.1 找到需求详情页链接输入组件，增加 Figma 链接识别逻辑：检测 `figma.com` 域名，自动触发 Figma 同步
- [x] 6.2 Figma 链接提交时显示"正在从 Figma 拉取内容…"加载状态，完成后提示"拉取成功，共提取 X 张图片"
- [x] 6.3 Token 过期/未配置错误时，前端展示明确提示（不使用通用错误 toast）

## 7. 联调验证

- [ ] 7.1 使用真实 Figma 文件链接测试 REST 模式：文本提取是否完整、顺序是否正确
- [ ] 7.2 测试含图片的 Figma 文件，验证图片下载和占位符插入是否正确（REST 模式）
- [ ] 7.3 测试带 `node-id` 的 Figma 链接，验证局部提取是否生效
- [ ] 7.4 测试 Token 过期、未配置、无效三种错误场景的前端提示
- [ ] 7.5 验证提取的 AiInputAsset 能正常触发 `trigger-parse` 流程并完成 AI 解析
- [ ] 7.6 切换 `FIGMA_FETCH_MODE='mcp'`，测试 MCP 模式是否正常工作（如已实现）
