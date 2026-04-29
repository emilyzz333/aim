## Context

基于 Change A 已建立的基础设施（AiUnderstanding 模型、Celery tasks app、文件存储、字段重命名），Change B 实现所有面向用户的功能层。

后端已有：
- `AIService`（DeepSeek/Claude 文本调用）
- `ProjectGitLabConfig`（项目级 GitLab token + api_url）
- `GitLabConfig`（用户级 GitLab token）
- `apps/tasks/tasks/md_tasks.py` 和 `ai_tasks.py`（Change A 创建的占位文件）

前端已有：
- `MDEditor`（@uiw/react-md-editor）
- `Drawer`、`Upload`、`Tabs` 等 Ant Design 组件
- `request` 工具函数

## Goals / Non-Goals

**Goals:**
- 实现三种 MD 来源：文件上传（PDF/Word/MD）、URL 抓取、GitLab 拉取
- 实现 AI 多维理解生成（多图+文本输入，Claude Vision，Celery 异步）
- 实现 AI 理解列表 UI（展示、选优、编辑、重新生成）
- 实现列表页 Drawer 交互（MD内容 + AI理解）
- 实现需求详情页 Tab 升级 + 新增 UI设计稿 Tab
- 实现状态流转自动触发拉取（失败不阻塞）

**Non-Goals:**
- Confluence 集成（Token 配置、页面内容读取）
- TAPD 链接内容解析
- req_understanding 注入测试用例生成 prompt
- WebSocket 实时推送（用轮询代替）
- OSS 文件存储

## Decisions

### D1：URL 抓取的安全边界

URL 抓取由后端执行（不经前端 proxy），后端做以下限制：
- 只允许 http/https 协议
- 设置超时 30s
- 不跟随超过 3 次重定向
- 内容限制 5MB

原因：避免 SSRF，前端直接 fetch 会有跨域问题。

### D2：PDF/Word 解析策略

```
PDF  → pdfplumber 提取文本（按页拼接） + 提取嵌入图片列表（路径存 source_ref）
Word → python-docx 遍历段落和表格 → 简单 Markdown 转换
MD   → 直接读取内容
```

若 PDF 中有大量图片（设计稿型PDF），提取的文本可能很少，此时将图片路径存入 `raw_content`，由 AI 视觉识别处理。解析后的文本存入 `AiUnderstanding.raw_content`，触发 AI 理解生成任务。

### D3：多图+文本的 AI 理解调用（基于素材批次汇总）

用户选择多个 AiInputAsset 批次后，Celery 任务汇总所有批次的图片和文字：

```
input_assets = [asset1, asset2, asset3]  # 用户选中的批次

→ 汇总所有图片路径: [asset1.file_paths + asset2.file_paths + ...]
→ 汇总所有文字说明: [asset1.text_content, asset2.text_content, ...]

→ Claude Vision API:
  messages: [{
    role: "user",
    content: [
      {type: "image", source: {type: "base64", data: "..."}},  // 批次1图片1
      {type: "image", source: {type: "base64", ...}},           // 批次2图片1
      {type: "text", text: "批次说明:\n- 登录页: 重点关注跳转逻辑\n- 个人中心: 头像修改区域\n\n请综合分析..."}
    ]
  }]
```

Claude Sonnet 4.6 支持单次请求多张图片（最多20张）。跨批次汇总时若总图片数超过20张，按批次优先级截断并在 prompt 中注明"部分图片已省略"。DeepSeek 不支持多模态，多图任务强制走 Claude（不降级）。

### D3b：AiInputAsset 素材批次的 UI 交互设计

```
素材管理区（放在 AI 理解列表上方）

┌────────────────────────────────────────────────────────┐
│ 素材库  (understand_type=ui_design)     [+ 添加批次]   │
├────────────────────────────────────────────────────────┤
│ ☑ [图×3] "登录页+个人中心" · 更新 4月9日 15:30 [编辑][删]│
│          [缩略图][缩略图][缩略图]                       │
│ ☑ [文]   "重点关注跳转逻辑和空状态" · 4月9日   [编辑][删]│
│ ☐ [图×5] "旧版参考截图" · 4月8日               [编辑][删]│
├────────────────────────────────────────────────────────┤
│ 已选 2 个批次                [用选中批次生成AI理解]      │
└────────────────────────────────────────────────────────┘
```

编辑状态下展开内联编辑面板：修改 batch_desc、修改 text_content、替换图片（重新上传覆盖旧文件）。

### D4：状态流转自动拉取的触发条件

```python
if old_status == 'pending_review' and target_status == 'pending_tech_review':
    if requirement.req_md_source in ['url', 'upload', 'gitlab']:
        pull_req_md.delay(requirement.id)  # 异步，不 await

if old_status == 'pending_tech_review' and target_status == 'pending_development':
    if requirement.tech_md_source in ['url', 'gitlab']:
        pull_tech_md.delay(requirement.id)
```

`source='manual'` 时不触发（无来源可拉）。任务失败写入 `AiUnderstanding.error_msg`，不影响状态流转响应。

### D5：前端轮询 AI 生成状态

上传/触发生成后，后端立即返回 `AiUnderstanding.id`（status=pending）。

前端每 2s 轮询 `GET /api/requirements/ai-understandings/{id}/`，直到 `status` 变为 `done` 或 `failed`（最多轮询 60 次 = 2 分钟）。

不用 WebSocket，减少实现复杂度，2分钟超时在 AI 生成场景足够。

### D6：Figma iframe 预览

Figma 支持 embed URL 格式：`https://www.figma.com/embed?embed_host=xxx&url={figma_url}`。

Lanhu 有 `X-Frame-Options: DENY`，不支持 iframe，只提供"打开链接"按钮。

前端检测 URL 是否包含 `figma.com`，是则显示 iframe 预览按钮，否则只显示链接。

### D7：页面交互架构

**列表页列 Tag 展示规则：**
```
有内容时显示来源类型 Tag（可点击）：
  [PDF ▶]  [TAPD链接 ▶★]  ← ★ = 该来源对应的理解已被选为最优
  有最优理解 → 展示最优理解对应的来源 Tag（★标记）
  无最优理解 → 展示最后更新的来源 Tag
无内容时显示灰色"无"（不可点击）
```

**列表页 MdSourceDrawer（轻量，仅原始内容预览）：**
```
MdSourceDrawer (720px)
├── 首行: "内容预览"                    [查看AI理解 ↗]
│         ↑固定文字                      ↑跳转详情页对应Tab
│                                        req_md  → "需求理解" Tab
│                                        tech_md → "技术方案" Tab
│                                        ui_design→"UI设计稿" Tab
└── 内容区（只读预览，按来源类型渲染）：
    PDF/MD/Word → Markdown 文本渲染
    URL/TAPD   → 链接地址 + [打开链接] + 抓取文本预览
    GitLab     → 文件路径/分支/commitid + MD渲染
    截图批次   → 图片缩略图网格 + 文字说明
    默认展示优先级：最优理解关联来源 > 最后更新来源
```

**详情页 Tab 名称：**
```
旧: 需求文档  →  新: 需求理解
旧: 技术md   →  新: 技术方案（已有，保持）
新增: UI设计稿
```

**详情页 AI理解管理区结构（三个 Tab 共用同一套）：**
```
Tab 页（以"需求理解"为例）
│
├── ★ 最优理解区（置顶，有选中时展示内容，无选中时空状态提示）
│   ├── 来源类型 badge + 描述/备注 + 更新时间
│   ├── [查看原始内容 ▼]（折叠，点击展开对应原始内容）
│   ├── AI理解文本（全文）
│   └── [编辑] [取消选中] [删除]
│
├── 来源获取区（折叠，点击"+ 添加来源"展开）
│   └── MdSourceInput（来源方式切换：文件/URL/GitLab）
│       提交后新建 AiUnderstanding 记录并加入表格
│
└── AI理解列表（表格形式）                    [生成新理解]
    ┌────┬──────────┬───────────┬──────┬────────┬────────┐
    │ ★  │ 来源类型  │ 描述/备注  │ 状态 │更新时间│ 操作   │
    ├────┼──────────┼───────────┼──────┼────────┼────────┤
    │ ★  │ PDF      │ 初版需求   │ done │4月9日  │[选][删]│
    │    │ TAPD链接  │ 评审修订版 │ done │4月9日  │[选][删]│
    │    │ 截图×3   │ 登录页设计  │ done │4月8日  │[选][删]│
    │    │ GitLab   │ (空)       │ 生成中│4月9日 │  —     │
    └────┴──────────┴───────────┴──────┴────────┴────────┘
    点击某行 → 右侧 Drawer 展示详情：
      ├── 来源信息（类型/路径/时间）
      ├── 备注（可编辑，方案B用户可选填）
      ├── 原始内容区 [▼折叠]
      └── AI理解文本（可编辑）+ [重新生成]

生成新理解入口（[生成新理解] 按钮展开面板）：
  ├── 素材批次区（AiInputAssetManager）：勾选已有批次 或 新增批次
  └── [确认生成] → 新建 AiUnderstanding 记录，加入表格，轮询状态
```

## Risks / Trade-offs

- **Claude Vision API 速度**：多图识别可能需要 30-60s，Celery 超时设置为 120s；前端轮询超时提示用户"生成超时，请重试"
- **GitLab 拉取 token 权限**：使用 ProjectGitLabConfig 的 access_token，若 token 无权限访问目标文件，返回 403，写入 error_msg 提示用户
- **URL 抓取质量**：Lanhu 等平台有登录验证，URL 抓取会失败；引导用户改用"截图上传"方式
- **前端组件复杂度**：`AiInputAssetManager` 含上传/编辑/勾选/生成多个交互，需分拆为受控子组件避免状态混乱；`AiUnderstandingList` 在列表 Drawer 和详情页都使用，需设计好 props 接口

## Open Questions

- GitLab 拉取时，文件路径是否需要 UI 提供"文件树浏览"还是只支持手动输入路径？（暂定手动输入，后续可升级为文件树选择器）
- 跨批次汇总超过20张图片时的截断策略：按批次创建时间排序取前N个批次？还是让用户手动排序？（暂定按创建时间升序，先添加的批次优先）
