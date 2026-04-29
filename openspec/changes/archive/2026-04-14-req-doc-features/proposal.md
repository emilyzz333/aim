## Why

基础设施就位后（Change A），需要实现：需求维度文档的多来源获取能力（文件上传/URL拉取/GitLab拉取）、AI多维理解的生成与管理（多图+文本对话式输入、异步生成、用户选优）、列表和详情页的交互升级（Drawer展示、UI设计稿 Tab）、以及状态流转时自动触发内容拉取。这些功能共同构成需求文档智能化管理的完整闭环。

## What Changes

- 新增需求文档多来源获取后端 API：文件上传解析（PDF/Word/MD）、URL 内容抓取、GitLab 文件拉取
- 新增 AI 理解生成后端 API：用户从素材库选择多个批次（AiInputAsset），汇总所有图片和文字后调用 Claude Vision，异步（Celery）执行，前端轮询状态
- 新增 AIService 多模态扩展：`complete_with_images(prompt, images, description, system)` 方法
- 状态流转钩子：`待评审→待技评` 异步触发 req_md 拉取，`待技评→待开发` 异步触发 tech_md 拉取，失败不阻塞状态流转
- 前端迭代/需求列表：req_md/tech_md 列点击 → Drawer 展示（含 MDEditor 可编辑 + AI理解列表）
- 前端需求详情页：需求文档 Tab 和技术方案 Tab 升级为多来源获取 + AI理解列表；新增 UI设计稿 Tab（Web/App 链接 + Figma iframe 预览 + 截图上传识别）
- Celery 任务实现：`md_tasks.py`（MD内容拉取）、`ai_tasks.py`（AI理解生成）

## Capabilities

### New Capabilities

- `md-source-fetch`：需求/技术 MD 的多来源获取能力——文件上传（PDF/Word/MD 解析为 Markdown）、URL 抓取（HTML转MD）、GitLab 文件拉取（使用已配置的 ProjectGitLabConfig token）
- `ai-understanding-generation`：基于 Claude Vision 的 AI 多维理解生成能力——用户从素材批次库（AiInputAsset）选择多个批次，汇总所有图片+文字后异步生成，前端轮询，生成结果存入 AiUnderstanding 表并关联参与的素材批次
- `ai-input-asset-management`：素材批次管理 UI——独立的素材管理区，支持分批上传图片+文字说明，查看/编辑/删除已有批次，勾选多个批次后触发 AI 理解生成
- `ui-design-tab`：需求详情页新增 UI 设计稿 Tab，展示 Web/App 链接、Figma iframe 嵌入预览、设计稿截图上传与 AI 识别、AI理解列表
- `md-drawer-viewer`：迭代和需求列表中 req_md/tech_md 列点击 → Drawer 展示原始 MD（可编辑）+ 该类型的 AI 理解列表

### Modified Capabilities

- `requirement-lifecycle`：状态流转新增自动拉取钩子（待评审→待技评触发 req_md 拉取，待技评→待开发触发 tech_md 拉取），拉取失败不阻塞状态流转，异步执行
- `ai-understanding-model`：AI 理解生成任务的具体实现（Celery task 填充 md_tasks.py/ai_tasks.py）

## Impact

- **后端**：`apps/integrations/views.py`（AIService 新增多模态方法）、`apps/requirements/views.py`（新增文件上传/URL拉取/GitLab拉取接口、change-status 钩子）、`apps/tasks/tasks/md_tasks.py`、`apps/tasks/tasks/ai_tasks.py`、`apps/requirements/urls.py`（新增路由）
- **前端**：`pages/iterations/index.tsx`（md 列点击 Drawer）、`pages/requirements/index.tsx`（同上）、`pages/requirements/detail/index.tsx`（Tab 升级、UI设计稿 Tab、AI理解列表组件）
- **新增前端组件**：`MdSourceDrawer`（列表 Drawer）、`AiUnderstandingList`（理解列表+选优）、`AiInputAssetManager`（素材批次管理区，含上传/编辑/多选/生成）、`MdSourceInput`（多来源获取输入区）、`UiDesignTab`（UI设计稿 Tab）
- **依赖**：后端 `requests`（URL抓取）、`markdownify` 或 `html2text`（HTML转MD），前端已有 `@uiw/react-md-editor`
- **TODO（延后）**：Confluence 集成、TAPD 链接内容解析、req_understanding 注入测试用例 prompt
