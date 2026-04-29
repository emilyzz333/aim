## ADDED Requirements

### Requirement: Celery 异步任务基础设施
系统 SHALL 提供独立的 `apps.tasks` app 作为异步任务基础设施，基于 Celery + Redis，不绑定任何具体业务模块，所有需要异步执行的任务（MD拉取、AI理解生成、定时任务、通知等）均在此 app 内注册。

#### Scenario: Celery worker 正常启动
- **WHEN** 在后端目录执行 `celery -A project_management worker -l info`
- **THEN** Worker 成功连接 Redis broker，输出任务注册列表，等待任务

#### Scenario: 无 Redis 时开发模式降级
- **WHEN** `CELERY_TASK_ALWAYS_EAGER=True` 配置存在（开发环境无 Redis 时）
- **THEN** Celery 任务以同步方式在当前进程中执行，不依赖 broker，不阻塞开发

#### Scenario: 业务模块调用异步任务
- **WHEN** `apps.requirements` 的 view 调用 `from apps.tasks.tasks.ai_tasks import generate_ai_understanding`，执行 `.delay()`
- **THEN** 任务进入 Redis 队列，view 立即返回，不等待任务完成

### Requirement: 文件上传基础设施
系统 SHALL 提供文件上传存储基础设施，支持 PDF/Word/MD/图片文件上传并保存到 `MEDIA_ROOT` 目录下，按规则命名子目录。

#### Scenario: 文件保存路径规则
- **WHEN** 系统接收文件上传，关联需求 ID=42，类型为 req_md，时间为 20260409_143000
- **THEN** 文件保存至 `{MEDIA_ROOT}/req_42_req_20260409_143000/` 目录下，保留原始文件名

#### Scenario: 多文件同时上传
- **WHEN** 用户在单次请求中上传多张图片（images[] 字段）
- **THEN** 所有图片保存至同一时间戳目录，系统返回各文件的相对路径列表
