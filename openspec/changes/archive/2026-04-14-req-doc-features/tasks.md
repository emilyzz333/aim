## 1. 后端：AI 服务多模态扩展

- [x] 1.1 在 `apps/integrations/views.py` 的 `AIService` 中新增 `complete_with_images(prompt, image_paths, description, system)` 方法：读取图片文件转 base64，构造 Claude Vision 多图消息，仅走 Claude API（DeepSeek 不支持多模态，不降级）
- [x] 1.2 在 `AIService` 中新增 `complete_with_text_and_images` 的 prompt 模板：需求/UI/技术方案理解分别有不同的 system prompt

## 2. 后端：Celery 任务实现

- [x] 2.1 实现 `apps/tasks/tasks/ai_tasks.py` 中的 `generate_ai_understanding(understanding_id)` 任务：
  - 加载 AiUnderstanding 记录及关联的 input_assets，status 更新为 processing
  - 汇总所有 input_assets 的图片路径（按 created_at 升序，超过20张截断）和文字说明
  - 有图片：调 `complete_with_images`（汇总图片+拼接批次文字说明）；无图片：调 `complete`
  - 成功：`ai_understanding` 写入结果，status=done；失败：status=failed，error_msg 写入错误
- [x] 2.2 实现 `apps/tasks/tasks/md_tasks.py` 中的 `pull_req_md(requirement_id)` 任务：
  - 读取 `req_md_source` 和 `req_md_source_url`，执行对应拉取（URL fetch / gitlab pull）
  - 新建 AiUnderstanding 记录（无 input_assets），存入 raw_content，派发 `generate_ai_understanding`
- [x] 2.3 实现 `apps/tasks/tasks/md_tasks.py` 中的 `pull_tech_md(requirement_id)` 任务：
  - 读取 `tech_md_source`，执行 URL fetch 或 GitLab API 拉取（使用 ProjectGitLabConfig token）
  - GitLab 拉取时记录 commit_id 写入 `Requirement.tech_md_gitlab_commitid`
  - 新建 AiUnderstanding 记录，存入 raw_content，派发 `generate_ai_understanding`

## 3. 后端：AiInputAsset 和 AI 理解生成接口

- [x] 3.1 在 `apps/requirements/views.py` 新增 `AiInputAssetViewSet` 的完整 CRUD action：
  - `POST /api/requirements/{req_id}/ai-input-assets/`：接收 `images[]`（多文件，最多10张）、`text_content`、`batch_desc`、`understand_type`；保存图片至 MEDIA_ROOT，创建记录
  - `PATCH /api/requirements/ai-input-assets/{id}/`：支持更新 batch_desc、text_content；若携带新 images[]，则删除旧文件、保存新文件、更新 file_paths
  - `DELETE /api/requirements/ai-input-assets/{id}/`：删除记录和关联文件
  - `GET /api/requirements/{req_id}/ai-input-assets/?type=ui_design`：列表查询，按 created_at 降序
- [x] 3.2 在 `apps/requirements/views.py` 新增 `generate_understanding` action（`POST /api/requirements/{id}/generate-understanding/`），接收 `asset_ids[]`（选中的 AiInputAsset ID）、`understand_type`：
  - 新建 AiUnderstanding 记录，M2M 关联 asset_ids
  - 派发 `generate_ai_understanding.delay(understanding_id)`
  - 返回 `{id: understanding_id, status: "pending"}`
- [x] 3.3 在 `apps/requirements/views.py` 新增 `fetch_md` action（`POST /api/requirements/{id}/fetch-md/`），接收 `source_type`、`understand_type`、`source_ref`、`file`（文件上传，可选）：
  - `upload_file`：解析文件（MD 直接读、PDF 用 pdfplumber、Word 用 python-docx），raw_content 写入解析结果
  - `url_fetch`：后端 GET URL（30s 超时，html2text 转 MD），raw_content 写入
  - `gitlab_pull`：使用 ProjectGitLabConfig API 拉取文件内容，raw_content 写入
  - 各情况均新建 AiUnderstanding 记录（无 input_assets），派发 `generate_ai_understanding.delay(id)`
  - 返回 `{id: understanding_id, status: "pending"}`
- [x] 3.4 在 `apps/requirements/views.py` 的 `change_status` action 中新增自动拉取钩子：
  - `pending_review → pending_tech_review`：若 `req_md_source != 'manual'`，调 `pull_req_md.delay(requirement.id)`
  - `pending_tech_review → pending_development`：若 `tech_md_source != 'manual'`，调 `pull_tech_md.delay(requirement.id)`
  - 失败不捕获抛出（task 内部处理），不阻塞状态流转
- [x] 3.5 在 `apps/requirements/urls.py` 注册所有新 action 路由

## 4. 前端：AiInputAssetManager 和 AiUnderstandingList 组件

- [x] 4.1 新建 `frontend/src/components/AiInputAssetManager.tsx`，props：`requirementId`、`understandType`、`onGenerate`（生成完成回调，传入 understanding_id），功能：
  - 素材批次列表：展示 batch_desc、图片缩略图（最多显示3张，多余用"+N"省略）、文字说明预览、created_at/updated_at
  - 勾选逻辑：Checkbox 多选，展示已选批次数
  - 添加批次：展开内联上传区（`Upload` dragger 多图，最多10张 + 文字说明输入框 + 批次说明输入框）
  - 编辑批次：展开内联编辑面板（修改 batch_desc/text_content/替换图片）
  - 删除批次：二次确认后调 DELETE 接口
  - 底部操作栏：显示已选批次数 + "用选中批次生成AI理解"按钮（调 generate-understanding 接口，返回 understanding_id，触发 onGenerate 回调）
  - 该组件作为面板使用：由 AiUnderstandingList 内的"生成新理解"按钮点击后展开，而非独立常驻
- [x] 4.2 新建 `frontend/src/components/AiUnderstandingList.tsx`，props：`requirementId`、`understandType`，功能：
  - **最优理解区**（表格上方）：has is_selected=True 时展示该记录来源类型 badge、备注、AI理解全文、[编辑][取消选中][删除]按钮；无最优理解时显示空状态提示
  - **AI理解表格**：列包括 ★、来源类型 badge、描述/备注、状态 tag（pending/processing/done/failed）、更新时间、操作列（[选][重新生成][删]）；按 created_at 降序
  - **点击表格行**：右侧 Drawer 展开，展示来源信息（类型/批次数/时间）、备注（可编辑 Input）、原始内容区（折叠展开，按来源类型渲染：图片批次→缩略图网格+文字说明；文件/URL/GitLab→Markdown 渲染）、AI理解全文（可编辑 textarea）、[重新生成] 按钮
  - **"生成新理解"按钮**：表格右上角，点击后在表格下方展开 AiInputAssetManager 面板；生成成功后收起面板，新记录插入表格，启动轮询
  - **轮询**：status 为 pending/processing 的记录每 2s 自动刷新，超过 60 次停止并提示"生成超时，请稍后刷新重试"
- [x] 4.3 新建 `frontend/src/components/MdSourceInput.tsx`，props：`requirementId`、`understandType`、`onSubmit`（传入 understanding_id），支持来源方式切换：上传文件（PDF/DOCX/MD，单文件）/ 粘贴URL / GitLab拉取（文件路径+分支输入框）；提交触发 fetch-md 接口，返回 understanding_id 后触发 onSubmit 启动轮询

## 5. 前端：需求详情页 Tab 升级

- [x] 5.1 升级 `detail/index.tsx` 中的"需求文档"Tab 重命名为"需求理解"（key=requirement_md）：
  - 顶部新增来源获取区（折叠，点击"+ 添加来源"展开 `MdSourceInput`）
  - 下方 MDEditor 保留（手动编辑）
  - 中间新增"★ 最优理解区"（参见 AiUnderstandingList 的最优理解区说明）
  - 底部为 `AiUnderstandingList`（understandType=req_md），包含表格 + "生成新理解"按钮（展开 AiInputAssetManager 面板）
- [x] 5.2 升级"技术方案"Tab（key=technical_md）：
  - 顶部新增来源获取区（折叠，`MdSourceInput` 含 GitLab 拉取选项，显示 gitlab_path/branch/commitid 配置）
  - 下方 MDEditor + `AiUnderstandingList`（understandType=tech_md）
- [x] 5.3 新增"UI设计稿"Tab（key=ui_design）：
  - Web端链接区：InlineField 展示 ui_design_web，检测 figma.com 时显示"嵌入预览"按钮（iframe），Lanhu 只显示"打开链接"
  - App端链接区：同上，字段为 ui_design_app
  - `AiUnderstandingList`（understandType=ui_design）：最优理解区 + 表格 + "生成新理解"按钮（展开 AiInputAssetManager 面板，understandType=ui_design）

## 6. 前端：列表页 Drawer 升级

- [x] 6.1 新建 `frontend/src/components/MdSourceDrawer.tsx`，props：`requirementId`、`requirementName`、`mdType`（req_md/tech_md/ui_design）、`onClose`：
  - Drawer 宽度 720
  - **首行**：左侧固定文字"内容预览"，右侧"查看AI理解 ↗"按钮（跳转详情页对应 Tab：req_md→"需求理解"Tab、tech_md→"技术方案"Tab、ui_design→"UI设计稿"Tab）
  - **内容区（只读预览）**：按来源类型渲染——
    - PDF/MD/Word → Markdown 文本渲染
    - URL/TAPD → 链接地址 + [打开链接] 按钮 + 抓取文本预览（若有）
    - GitLab → 文件路径/分支/commitid + MD渲染
    - 截图批次 → 图片缩略图网格 + 文字说明
  - **默认展示优先级**：is_selected AiUnderstanding 关联的来源批次 > 最近更新的来源批次
  - **多批次切换**：有多条来源记录时，提供 Select/Tabs 切换其他批次查看
  - Drawer 内**不**包含 AI理解管理功能，AI理解管理入口仅为"查看AI理解 ↗"按钮
- [x] 6.2 更新 `frontend/src/pages/iterations/index.tsx` 中的 reqColumns：
  - req_md 列 render：按来源类型展示带颜色可点击 Tag（有 is_selected 记录时附加 ★），点击 Tag 展开 MdSourceDrawer（mdType=req_md）；无来源时显示灰色"无"（不可点击）
  - tech_md 列同上（mdType=tech_md）
- [x] 6.3 更新 `frontend/src/pages/requirements/index.tsx` 同上

## 7. 依赖安装

- [x] 7.1 后端：`pip install html2text markdownify requests`，更新 `requirements.txt`（requests 可能已有，确认）
- [x] 7.2 前端：确认已有依赖足够（Ant Design Upload、MDEditor 已有），无需新增

## 8. 验证

- [x] 8.1 测试文件上传（MD/PDF/DOCX）：上传后 AiUnderstanding 记录创建，Celery 任务执行，status 变为 done，ai_understanding 有内容
- [x] 8.2 测试 GitLab 拉取（需要真实 ProjectGitLabConfig 配置）：拉取成功，commitid 写入
- [x] 8.3 测试素材批次 CRUD：创建多张图片批次、纯文字批次，验证编辑替换图片、删除文件同步删除
- [x] 8.4 测试多批次汇总 AI 识别：选择 2 个批次（共 5 张图片+文字说明），生成 AiUnderstanding，Claude Vision 返回综合识别结果，input_assets M2M 关联正确
- [x] 8.5 测试选优流程：选中一条理解 → `Requirement.req_understanding` 更新 → 同类型其他记录 is_selected=False
- [x] 8.6 测试状态流转自动拉取：待评审→待技评，req_md_source=url，确认 Celery 任务被派发，状态流转不受任务失败影响
- [x] 8.7 测试前端 Drawer：迭代列表点击 req_md 列，Drawer 打开，MD 内容、素材批次管理区、AI 理解列表展示正常
- [x] 8.8 测试 UI设计稿 Tab：Figma 链接显示嵌入预览按钮，Lanhu 链接只显示打开链接，素材批次管理区正常

## 9. 后续迭代改动（2026-04-14）

### 9.1 MdSourceInput 文件/文件夹上传改进
- [x] 将"上传文件"和"上传文件夹"合并为带下拉菜单的"上传"按钮（`Dropdown` + `Menu`）
- [x] 下拉菜单包含"选择文件"（多选，原生 input[multiple]）和"选择文件夹"（webkitdirectory）两个选项
- [x] `handleFileUpload` 支持 `FileList | File[]` 批量处理
- [x] 在 `spec/TODO.md` 中记录后期拖拽上传支持（方案3）待办项

### 9.2 AiAssistantDrawer 输入区改版
- [x] 将"添加图片"按钮改为附件图标按钮（`PaperClipOutlined`），移除文案
- [x] 将附件按钮和发送按钮移入输入框内（绝对定位，右下角）
- [x] 输入框增加 `paddingRight: 80` 为按钮留出空间
- [x] 发送按钮去掉"发送"文案，仅保留图标
