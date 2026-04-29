## Context

当前平台后端基于 Django + MySQL，前端 React + Ant Design。需求管理模块（`apps/requirements`）中：
- `Requirement` 模型有 `requirement_md`/`technical_md`/`figma_url` 字段，命名与前端迭代列表中的 `req_md`/`tech_md` 不一致，导致数据对不上
- `AIService` 只支持纯文本调用（DeepSeek/Claude），无多模态能力
- 后端无异步任务基础设施（无 Celery/Redis），所有操作均同步执行
- 后端无文件存储配置（无 MEDIA_ROOT），无法接收文件上传
- 无统一的"AI理解"存储层，AI 分析结果无法持久化、无法多次生成比较

## Goals / Non-Goals

**Goals:**
- 统一字段命名：`req_md`/`tech_md`/`ui_design_web`，并新增扩展字段
- 建立 `AiUnderstanding` 模型，作为 AI 多维理解的统一存储层
- 建立独立的 `apps.tasks` Celery app，不绑定业务模块
- 建立文件上传基础设施（`MEDIA_ROOT`、静态目录、文件处理工具）
- 数据迁移：字段重命名不丢数据

**Non-Goals:**
- 不实现具体的 MD 拉取/上传逻辑（属于 Change B）
- 不实现前端 Drawer 等交互（属于 Change B）
- 不实现 Confluence、TAPD 链接解析（TODO）
- 不实现 WebSocket 实时推送（先用轮询）

## Decisions

### D1：字段重命名策略 — 数据库层直接重命名 vs 新增字段并迁移数据

选择**数据库层直接重命名**（`RenameField` migration）。

原因：字段语义完全对应，数据无需转换，迁移简单安全。新增字段走独立 migration。

### D2：AiUnderstanding 独立表 vs JSON 字段挂在 Requirement 上

选择**独立表**。

原因：每个需求可能有多条理解记录（多来源、多次生成），需要独立查询、排序、状态追踪、用户选择。JSON 字段无法支持这些查询和状态机。

```
AiUnderstanding
├── id
├── requirement       FK → Requirement (on_delete=CASCADE)
├── understand_type   CharField: 'req_md' | 'ui_design' | 'tech_md'
├── source_type       CharField: 'manual_edit' | 'upload_file' | 'upload_image'
│                                'url_fetch' | 'gitlab_pull' | 'ai_generate'
├── source_ref        TextField: 文件路径 / URL / gitlab path 等描述
├── raw_content       TextField: 原始提取文本（MD文本、URL抓取内容等）
├── ai_understanding  TextField: AI 生成的理解文本（Markdown）
├── status            CharField: 'pending' | 'processing' | 'done' | 'failed'
├── error_msg         TextField: 失败原因（nullable）
├── is_selected       BooleanField: 是否为当前选中的最优理解
├── input_assets      M2M → AiInputAsset: 参与本次生成的素材批次
├── created_by        FK → User
├── created_at        DateTimeField (auto)
└── updated_at        DateTimeField (auto)
```

### D2b：AiInputAsset — 素材批次管理

引入独立的 `AiInputAsset` 表，将"素材积累"与"AI理解生成"解耦。

**核心决策：一次上传 = 一个批次 = 一条记录**

原因：用户对"一批次上传的图片+说明"有天然的认知聚合（"这批是登录页截图"），按批次管理比按单张图片管理认知负担低得多。用户选择时以批次为粒度，而不是逐张勾选。

```
AiInputAsset
├── id
├── requirement       FK → Requirement (on_delete=CASCADE)
├── understand_type   CharField: 'req_md' | 'ui_design' | 'tech_md'
├── batch_desc        CharField: 批次说明（用户填写，如"登录页+个人中心设计稿"）
├── file_paths        JSONField: 图片/文件路径列表（[] 表示纯文字批次）
├── text_content      TextField: 本次附带的文字说明（nullable）
├── created_by        FK → User
├── created_at        DateTimeField (auto)
└── updated_at        DateTimeField (auto)
```

**file_paths 为空 vs 非空区分素材类型：**
- `file_paths=[]` + `text_content` 有值 → 纯文字说明批次
- `file_paths=[...]` → 图片批次（可附带 text_content）

不加 `asset_type` 字段，用 `file_paths` 是否为空隐式区分，减少冗余字段。

### D3：Celery 独立 app 还是配置在 project_management 下

选择**独立 `apps.tasks` app**。

原因：异步任务会跨多个业务模块（需求拉取、AI生成、未来的定时任务、通知任务），放在单一业务 app 内会产生循环依赖。独立 app 作为基础设施层，各业务 app 只需 import task 函数。

```
apps/tasks/
├── __init__.py
├── celery.py         # Celery app 实例（在 project_management/celery.py 引用）
└── tasks/
    ├── __init__.py
    ├── md_tasks.py   # MD 拉取相关任务（Change B 填充）
    └── ai_tasks.py   # AI 理解生成任务（Change B 填充）
```

### D4：Celery Broker — Redis vs RabbitMQ

选择 **Redis**。

原因：项目规模适中，Redis 同时可作为 Django cache backend，一个服务两用。RabbitMQ 运维成本更高，当前阶段不必要。

### D5：文件存储路径策略

```
MEDIA_ROOT = BASE_DIR / 'static' / 'uploads'
路径规则: uploads/req_{requirement_id}_{type}_{yyyymmdd_hhmmss}/
类型映射:
  req_md   → req_{id}_req_{ts}/
  ui_design→ req_{id}_ui_{ts}/
  tech_md  → req_{id}_tech_{ts}/
```

文件通过 Django `FileSystemStorage` 或直接 `os` 操作写入，先不引入第三方存储库，保持简单。后续迁移 OSS 只需改 storage backend。

### D6：is_selected 唯一性约束

同一 `(requirement, understand_type)` 组合下，最多一条 `is_selected=True`。

通过应用层保证（选中新记录时，先将同组的其他记录 `is_selected=False`），不加数据库唯一约束（避免迁移复杂度）。

## Risks / Trade-offs

- **字段重命名 BREAKING** → 前端所有引用旧字段名的地方需同步修改，需在同一 PR 内完成，不能分批上线
- **Celery 依赖 Redis** → 本地开发需启动 Redis 服务；在 `settings.py` 中提供 `CELERY_TASK_ALWAYS_EAGER=True` 的 fallback，无 Redis 时同步执行，不阻塞开发
- **文件存储在本地** → 服务重启/迁移不影响数据库，但文件可能丢失；`static/uploads/` 需加入 `.gitignore`，但路径写入数据库，迁移 OSS 时需批量更新 `source_ref`

## Migration Plan

1. 创建 migration：`RenameField` requirement_md→req_md, technical_md→tech_md, figma_url→ui_design_web
2. 创建 migration：新增所有扩展字段（req_md_source, tech_md_gitlab_path 等）
3. 创建 migration：新建 AiUnderstanding 表和 AiInputAsset 表（含 M2M 中间表）
4. 更新 serializer/views 中的字段引用
5. 前端同步更新字段名引用
6. 本地跑 `makemigrations` + `migrate` 验证无冲突

回滚：字段重命名可反向 migration，但需同步回滚前端代码。

## Open Questions

- Redis 在部署环境的地址配置（开发/生产分离），暂用 `settings.py` 中 `CELERY_BROKER_URL = 'redis://127.0.0.1:6379/0'`，后续通过环境变量覆盖
- `static/uploads/` 是否需要加 URL 路由供前端直接访问原始文件（如预览上传的图片）？Change B 实现时确认
