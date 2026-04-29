## ADDED Requirements

### Requirement: 列表列 Tag 来源类型展示
系统 SHALL 将 req_md/tech_md/ui_design 列的 Tag 从纯"已有/无"升级为展示来源类型，Tag 为可点击态（带颜色），有最优AI理解时附加 ★ 标记。

#### Scenario: 展示来源类型 Tag
- **WHEN** 需求的 req_md 来源为 PDF 上传
- **THEN** 列显示蓝色可点击 Tag"PDF ▶"；若该类型已有 is_selected=True 的 AiUnderstanding，则显示"PDF ▶ ★"

#### Scenario: 多来源时展示多个 Tag
- **WHEN** 需求的 req_md 有多条来源记录（如先上传 PDF 后又拉取 GitLab）
- **THEN** 列显示多个 Tag，每个 Tag 对应一种来源类型，均可独立点击

#### Scenario: 无内容时展示"无"
- **WHEN** 需求的 req_md 为空且无任何来源记录
- **THEN** 列显示灰色"无"Tag，不可点击

### Requirement: 列表列 Tag 点击展开内容预览 Drawer
系统 SHALL 在迭代页需求列表和需求列表页中，点击来源 Tag 后展开右侧 Drawer，Drawer 仅展示**原始内容预览**，不包含 AI 理解管理功能。

#### Scenario: Drawer 首行布局
- **WHEN** 任意来源 Tag 被点击，Drawer 展开
- **THEN** Drawer 首行左侧显示"内容预览"，右侧显示"查看AI理解 ↗"按钮；内容区展示对应原始内容

#### Scenario: 点击"查看AI理解"按钮跳转详情页
- **WHEN** 用户点击 Drawer 首行的"查看AI理解 ↗"按钮
- **THEN** 系统跳转至需求详情页并定位到对应 Tab：
  - req_md Drawer → 详情页"需求理解" Tab
  - tech_md Drawer → 详情页"技术方案" Tab
  - ui_design Drawer → 详情页"UI设计稿" Tab

#### Scenario: PDF/文件内容预览
- **WHEN** 来源类型为文件上传（PDF/Word/MD），Drawer 展开
- **THEN** 展示文件解析后的 Markdown 文本渲染内容

#### Scenario: 链接类内容预览
- **WHEN** 来源类型为 URL/TAPD 链接，Drawer 展开
- **THEN** 展示链接地址 + [打开链接] 按钮，若已抓取内容则展示抓取的文本预览

#### Scenario: GitLab 文件内容预览
- **WHEN** 来源类型为 GitLab 拉取，Drawer 展开
- **THEN** 展示文件路径、分支、commit_id 信息，以及拉取的 Markdown 内容渲染

#### Scenario: 图片批次内容预览
- **WHEN** 来源类型为截图上传（AiInputAsset 批次），Drawer 展开
- **THEN** 以图片缩略图网格展示图片，附带文字说明；多批次时默认展示"最优理解关联的批次"，若无最优理解则展示最近更新的批次；其他批次可通过切换选项查看

#### Scenario: 点击"无" Tag 不响应
- **WHEN** 用户点击灰色"无"Tag
- **THEN** 不展开 Drawer，无响应

### Requirement: 列表 MD 列状态视觉升级（含 AI 理解标记）
系统 SHALL 在来源 Tag 上通过 ★ 标记区分是否已有最优 AI 理解。

#### Scenario: 有已选中 AI 理解的状态
- **WHEN** 需求的该类型有 is_selected=True 的 AiUnderstanding 记录
- **THEN** 对应来源 Tag 右侧显示 ★ 符号

#### Scenario: 有内容但无最优 AI 理解
- **WHEN** 需求有来源内容但无 is_selected=True 的 AiUnderstanding 记录
- **THEN** Tag 正常显示来源类型，无 ★ 标记
