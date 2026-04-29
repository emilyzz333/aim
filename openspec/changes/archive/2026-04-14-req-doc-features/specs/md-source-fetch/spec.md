## ADDED Requirements

### Requirement: 文件上传解析为 MD
系统 SHALL 支持用户上传 PDF、Word（.docx）、MD 文件，后端解析内容并存入对应 AiUnderstanding 记录（raw_content），同时异步触发 AI 理解生成任务。

#### Scenario: 上传 MD 文件
- **WHEN** 用户上传 .md 文件至 `POST /api/requirements/{id}/fetch-md/`，字段 `source_type=upload_file`，`understand_type=req_md`
- **THEN** 系统读取文件内容直接存入 `AiUnderstanding.raw_content`，文件保存至 MEDIA_ROOT 对应目录，返回 AiUnderstanding 记录 ID 和 status=pending，异步触发 AI 理解生成

#### Scenario: 上传 PDF 文件（文本型）
- **WHEN** 用户上传包含可提取文本的 PDF 文件
- **THEN** 后端使用 pdfplumber 提取所有页面文本，拼接后存入 `raw_content`，触发 AI 理解生成

#### Scenario: 上传 Word 文件
- **WHEN** 用户上传 .docx 文件
- **THEN** 后端使用 python-docx 提取段落和表格内容，转换为 Markdown 格式，存入 `raw_content`，触发 AI 理解生成

#### Scenario: 不支持的文件类型
- **WHEN** 用户上传非 PDF/DOCX/MD 格式文件
- **THEN** 系统返回 HTTP 400，提示支持的文件类型

### Requirement: URL 内容抓取为 MD
系统 SHALL 支持用户输入 URL，后端抓取页面内容并转换为 Markdown，存入 AiUnderstanding 记录。

#### Scenario: 抓取普通 URL 内容
- **WHEN** 用户提交 `POST /api/requirements/{id}/fetch-md/`，字段 `source_type=url_fetch`，`source_ref=https://example.com/prd`
- **THEN** 后端 GET 该 URL（30s 超时），HTML 转 Markdown，存入 `raw_content`，返回 AiUnderstanding ID，异步触发 AI 生成

#### Scenario: URL 不可达或需要登录
- **WHEN** 抓取的 URL 返回 4xx/5xx 或超时
- **THEN** 系统创建 AiUnderstanding 记录，status 设为 `failed`，error_msg 写入错误原因，HTTP 响应返回 202 并附带 error 说明

### Requirement: GitLab 文件拉取为 MD
系统 SHALL 支持通过已配置的 ProjectGitLabConfig，拉取指定 GitLab 仓库文件内容，存入 tech_md 类型的 AiUnderstanding 记录。

#### Scenario: 成功拉取 GitLab MD 文件
- **WHEN** 用户提交 `POST /api/requirements/{id}/fetch-md/`，字段 `source_type=gitlab_pull`，`understand_type=tech_md`，`gitlab_path=docs/tech-spec.md`，`gitlab_branch=main`
- **THEN** 后端使用 ProjectGitLabConfig 的 access_token 调用 GitLab API 获取文件内容，存入 `raw_content`，commit_id 写入 `Requirement.tech_md_gitlab_commitid`，返回 AiUnderstanding ID

#### Scenario: GitLab 文件不存在或无权限
- **WHEN** GitLab API 返回 404 或 403
- **THEN** AiUnderstanding status=failed，error_msg 写入具体错误，HTTP 响应返回 202 附带错误说明

### Requirement: 手动重新拉取 MD
系统 SHALL 支持用户在已有来源配置下，不重新上传/输入，直接重新触发拉取并生成新的 AiUnderstanding 记录。

#### Scenario: 重新拉取（同来源）
- **WHEN** 用户点击"重新拉取"，系统读取 Requirement 上的 source_type 和 source_ref 重新执行拉取
- **THEN** 新建一条 AiUnderstanding 记录（不覆盖旧记录），异步触发内容拉取和 AI 生成
