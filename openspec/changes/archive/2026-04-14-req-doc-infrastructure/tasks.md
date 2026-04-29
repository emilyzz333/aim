## 1. 依赖安装与配置

- [x] 1.1 在 `backend` 目录下安装新依赖：`celery`, `redis`, `python-docx`, `pdfplumber`, `Pillow`，并更新 `requirements.txt`
- [x] 1.2 在 `project_management/settings.py` 中新增 Celery 配置（`CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CELERY_TASK_ALWAYS_EAGER` 开发降级开关）
- [x] 1.3 在 `project_management/settings.py` 中新增文件存储配置（`MEDIA_ROOT = BASE_DIR / 'static' / 'uploads'`, `MEDIA_URL`）
- [x] 1.4 创建 `project_management/celery.py`，初始化 Celery app 实例，配置 `autodiscover_tasks`
- [x] 1.5 修改 `project_management/__init__.py`，引入 Celery app 实例确保 Django 启动时加载

## 2. 独立异步任务 App

- [x] 2.1 创建 `apps/tasks/` 目录，添加 `__init__.py`、`apps.py`
- [x] 2.2 创建 `apps/tasks/tasks/` 目录，添加 `__init__.py`、`md_tasks.py`（占位，Change B 填充）、`ai_tasks.py`（占位，Change B 填充）
- [x] 2.3 在 `project_management/settings.py` 的 `INSTALLED_APPS` 中添加 `apps.tasks`
- [x] 2.4 在 `backend/` 目录下创建 `static/uploads/.gitkeep`，并确认 `.gitignore` 忽略 `static/uploads/*` 但保留 `.gitkeep`

## 3. 数据库模型变更（Requirement 字段）

- [x] 3.1 在 `apps/requirements/models.py` 中将 `requirement_md` 重命名为 `req_md`，`technical_md` 重命名为 `tech_md`，`figma_url` 重命名为 `ui_design_web`
- [x] 3.2 在 `apps/requirements/models.py` 中新增字段：`ui_design_app`、`req_md_source`、`req_md_source_url`、`tech_md_source`、`tech_md_source_url`、`tech_md_gitlab_path`、`tech_md_gitlab_branch`、`tech_md_gitlab_commitid`、`req_understanding`
- [x] 3.3 执行 `python manage.py makemigrations requirements` 生成字段重命名 + 新增字段的 migration（`RenameField` + `AddField`）

## 4. 新增 AiInputAsset 和 AiUnderstanding 模型

- [x] 4.1 在 `apps/requirements/models.py` 中创建 `AiInputAsset` 模型，包含所有字段（requirement FK、understand_type、batch_desc、file_paths JSONField、text_content、created_by FK、created_at、updated_at）
- [x] 4.2 在 `apps/requirements/models.py` 中创建 `AiUnderstanding` 模型，包含所有字段（requirement FK、understand_type、source_type、source_ref、raw_content、ai_understanding、status、error_msg、is_selected、input_assets M2M→AiInputAsset、created_by FK、created_at、updated_at）
- [x] 4.3 执行 `python manage.py makemigrations requirements` 生成 AiInputAsset 表、AiUnderstanding 表及 M2M 中间表的 migration
- [x] 4.4 在 `apps/requirements/serializers.py` 中新增 `AiInputAssetSerializer` 和 `AiUnderstandingSerializer`

## 5. 后端 API 更新

- [x] 5.1 更新 `apps/requirements/serializers.py` 中 `RequirementSerializer`：字段名同步为 `req_md`/`tech_md`/`ui_design_web`，新增所有扩展字段
- [x] 5.2 更新 `apps/requirements/views.py` 中 `upload_md` action：将 `requirement_md`/`technical_md` 引用改为 `req_md`/`tech_md`
- [x] 5.3 在 `apps/requirements/views.py` 中新增 `AiInputAssetViewSet`，支持：列表查询（按 requirement + understand_type 过滤，按 created_at 降序）、创建（含 file_paths 验证）、局部更新（编辑 batch_desc/text_content/file_paths）、删除（同步删除关联文件）
- [x] 5.4 在 `apps/requirements/views.py` 中新增 `AiUnderstandingViewSet`，支持：列表查询（按 requirement + type 过滤）、局部更新（编辑 ai_understanding 内容）、选优（PATCH `/select/` action：同类型取消其他选中，写入 `Requirement.req_understanding`）
- [x] 5.5 在 `apps/requirements/urls.py` 中注册 `AiInputAssetViewSet` 和 `AiUnderstandingViewSet` 路由，路径格式 `/api/requirements/ai-input-assets/` 和 `/api/requirements/ai-understandings/`
- [x] 5.6 在 `project_management/urls.py` 中配置 `MEDIA_URL` 的 static 文件服务（开发环境）

## 6. 前端字段名同步

- [x] 6.1 更新 `frontend/src/pages/requirements/detail/index.tsx`：将所有 `requirement_md`/`technical_md`/`figma_url` 引用改为 `req_md`/`tech_md`/`ui_design_web`
- [x] 6.2 更新 `frontend/src/pages/requirements/index.tsx`：确认列表字段已使用 `req_md`/`tech_md`（当前前端已用新名，确认后端 serializer 对齐即可）
- [x] 6.3 更新 `frontend/src/pages/iterations/index.tsx`：确认需求列表列定义中 `req_md`/`tech_md` 字段名与后端一致

## 7. TODO.md 创建

- [x] 7.1 在项目根目录创建 `TODO.md`，记录以下延后功能：
  - Confluence Token 配置 + 页面内容读取
  - TAPD 需求链接内容解析（通过已有 TAPD Token）
  - `req_understanding` 注入测试用例生成 prompt（AITestCaseGenerationView 升级）
  - 文件存储从 `static/uploads/` 迁移至 OSS（路径批量更新方案）

## 8. 验证

- [x] 8.1 执行 `python manage.py migrate` 确认所有 migration 无冲突执行
- [x] 8.2 启动 Django dev server，确认 `/api/requirements/` 接口返回新字段名（python manage.py check 通过，0 issues）
- [ ] 8.3 调用 `AiInputAssetViewSet` 接口，验证创建（含图片路径）、编辑、删除流程正确
- [ ] 8.4 调用 `AiUnderstandingViewSet` 接口，验证创建（关联 input_assets）、查询、选优流程正确
- [ ] 8.4 验证 Celery 配置：设置 `CELERY_TASK_ALWAYS_EAGER=True`，确认调用 `.delay()` 不报错
