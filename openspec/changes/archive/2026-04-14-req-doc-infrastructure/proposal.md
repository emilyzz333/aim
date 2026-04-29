## Why

当前需求管理平台中，需求文档（req_md）和技术方案（tech_md）仅支持手动在编辑器中编写，无法从 GitLab、文件上传等外部来源获取内容；同时缺少统一的 AI 理解层来沉淀对需求、UI设计稿和技术方案的多维度理解，导致 AI 功能（测试用例生成等）只能基于简单描述而非结构化的需求理解来工作。此外，后端缺少异步任务基础设施（Celery），无法支持耗时的拉取和 AI 生成操作。

## What Changes

- **BREAKING** 重命名 `Requirement` 表字段：`requirement_md` → `req_md`，`technical_md` → `tech_md`，`figma_url` → `ui_design_web`
- `Requirement` 表新增字段：`ui_design_app`、`req_md_source`、`req_md_source_url`、`tech_md_source`、`tech_md_source_url`、`tech_md_gitlab_path`、`tech_md_gitlab_branch`、`tech_md_gitlab_commitid`、`req_understanding`
- 新增 `AiUnderstanding` 表：统一存储 AI 对需求/UI设计/技术方案的多维理解，支持多次生成、用户选优；关联 `AiInputAsset` 记录哪些素材批次参与了本次理解生成
- 新增 `AiInputAsset` 表：按批次存储用户积累的素材（图片+文字），每次上传/输入为一个批次，支持编辑替换，用户可多选批次后统一生成 AI 理解
- 新增独立异步任务 app `apps.tasks`：基于 Celery + Redis，统一管理异步任务，不绑定在单一业务 app 内
- 新增文件存储基础设施：`backend/static/uploads/` 目录 + `settings.py` 中 `MEDIA_ROOT`/`MEDIA_URL` 配置，支持 PDF/Word/MD/图片上传
- 更新所有引用旧字段名的后端 views/serializers/migrations
- 新增 `TODO.md` 记录延后实现的功能：Confluence 集成、TAPD 链接解析、req_understanding 注入测试用例生成

## Capabilities

### New Capabilities

- `ai-understanding-model`：AiUnderstanding 数据模型，关联需求，按类型（req/ui/tech）和来源（upload/url/gitlab/manual）存储 AI 理解记录，支持状态追踪（pending/processing/done/failed）和用户选优（is_selected）；通过 M2M 关联 AiInputAsset 记录哪些素材参与了生成
- `ai-input-asset`：AiInputAsset 数据模型，按批次存储用户上传的素材（图片路径列表 + 文字说明），支持增删改，是 AI 理解生成的原料管理层
- `async-task-infrastructure`：独立的 Celery 异步任务 app（`apps.tasks`），包含 broker/worker 配置、任务注册机制，后续定时任务、通知任务等均在此扩展

### Modified Capabilities

- `requirement-lifecycle`：Requirement 模型字段重命名及新增（req_md 相关来源字段、tech_md 相关来源字段、req_understanding、ui_design_app），涉及 model/serializer/migration 变更

## Impact

- **后端**：`apps/requirements/models.py`、`apps/requirements/serializers.py`、`apps/requirements/views.py`（upload-md endpoint 字段名更新）、新增 migration
- **新增**：`apps/tasks/` app（Celery 配置、task 定义）、`apps/requirements/migrations/` 新迁移文件、`backend/static/uploads/` 目录
- **配置**：`aim/settings.py`（INSTALLED_APPS、MEDIA_ROOT、CELERY 配置）、`aim/celery.py`（新增）
- **前端**：所有使用 `requirement_md`、`technical_md`、`figma_url` 字段名的地方需同步更新为新字段名
- **依赖**：新增 `celery`、`redis`（django-redis 或 redis-py）、`python-docx`、`pdfplumber`、`Pillow`（图片处理）
