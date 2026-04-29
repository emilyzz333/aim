# 研发过程记录

## 2026-04-08 — 提案创建与后端核心重建

### 完成内容

**OpenSpec 提案生成**
- 基于 `prd.md` 生成完整提案：proposal.md、design.md、8 个 specs、tasks.md（98 个任务）
- Explore 阶段发现 11 处 PRD 与提案的差异，全部补齐：
  - 驳回机制（待测试→开发中，需填写原因，写两条 ChangeLog）
  - 模块多层级管理（parent_id 递归树，独立管理页）
  - 开发中阻塞标记（is_blocked + block_reason）
  - 已完成归档（is_archived）
  - 企微接口补全（qw/login、qw/userinfo）
  - AI 智能代码生成
  - ESLint + Prettier 初始化

**后端重建（方案 B：在现有项目基础上全面升级）**
- `settings.py` 切换到 MySQL，添加 simplejwt + token_blacklist
- `apps/users/models.py`：添加 role 字段（6 种角色），is_admin_or_above 属性
- `apps/projects/models.py`：新增 Module 模型（parent_id 自引用递归树，order 字段）
- `apps/requirements/models.py`：全面重写
  - gitlab_branch、commit_id、tags、developer、tester 改为 JSON 多值字段
  - module 由字符串改为 ForeignKey（关联 Module 模型）
  - 新增 is_blocked、block_reason、is_archived、figma_url 字段
  - 内置状态机（VALID_TRANSITIONS 字典）和 can_transition_to() 方法
  - 同文件新增 SubRequirement、ChangeLog 模型
- `apps/bugs/models.py`：补充 env、type、group、source 字段（含 choices）
- `apps/tests/models.py`：改名为 FunctionCase，补充 module、plat、api_test、ui_test、is_delete、source、reviewed 字段
- JWT 认证替换 session 登录：LoginView 返回 access+refresh token，LogoutView 将 refresh 加入黑名单
- RBAC 权限类：IsAdminOrAbove、IsSuperAdmin
- 需求状态机 actions：change-status（含驳回校验）、upload-md、block、archive、changelog、sub-requirements
- 安装 djangorestframework-simplejwt 5.5.1

**前端升级**
- package.json 加入 ESLint + Prettier devDependencies，添加 lint/format 脚本
- 创建 `.eslintrc` 和 `.prettierrc`
- 创建 `src/services/request.ts`：Axios 拦截器（JWT 自动注入 + 401 自动刷新队列机制）

### 待完成（截至 2026-04-08 第一阶段结束）
- 执行 `python manage.py makemigrations && migrate`（需先创建 MySQL 数据库 sdd_platform）
- 前端页面功能补全（登录页 JWT 集成、模块管理页、需求详情页等）
- 第三方集成（TAPD、GitLab、AI、企微通知）

---

## 2026-04-08 — 全功能模块实现（第二阶段）

### 完成内容

**目录结构整理**
- 清理根目录遗留废弃目录：`bugs/`、`iterations/`、`projects/`、`requirements/`、`users/`、`test_management/`、`user_management/`、`md/`、`public/`、`db.sqlite3`
- 将 Django 后端代码整体迁移到 `backend/` 子目录（`mv apps manage.py aim backend/`）
- 迁移后执行 `python manage.py check` 确认零错误，目录结构与 design.md 完全对齐

**后端 migrations 修复**
- 手动为所有 app 创建 `migrations/` 目录及 `__init__.py`
- 执行 `makemigrations` 生成 0001_initial 迁移（6 个 app）
- 补充生成：`users/0002_team_notification.py`（Team + Notification 模型）、`tests/0003_testplan.py`（TestPlan M2M）

**用户/团队/通知模块（apps/users）**
- `models.py` 完整重写：User（含企微字段）+ Team（M2M members）+ Notification（recipient/sender/is_read/target_type/target_id）
- `views.py` 新增：TeamViewSet（含 add-member/remove-member action）、WorkloadStatsView（按用户聚合需求数+缺陷数，支持日期范围）、NotificationListView（GET 返回列表+unread_count，POST 全部已读）、NotificationDetailView（PATCH 单条已读）
- `user_urls.py` 路由更新完整

**迭代管理（apps/iterations）**
- `serializers.py` 重写：新增计算字段 total_requirements、completed_requirements、completion_rate
- `views.py` 重写：project_id 过滤、管理员限制创建/修改/删除、perform_create 自动关联 created_by

**测试管理（apps/tests）**
- `models.py` 重写（Fix 模型内容混乱问题）：FunctionCase 保留全量字段，TestPlan 改为纯 M2M（project FK + requirements M2M + cases M2M），移除所有与 FunctionCase 重复的 FK 字段，解决 related_name 16 处冲突

**Dashboard（apps/integrations）**
- 新建 `dashboard_views.py`：DashboardView 聚合 summary（项目数/活跃迭代/需求总数/待处理缺陷）、requirement_status_distribution、active_iterations（含完成率）、project_overview
- 新建 `dashboard_urls.py`，注册到 `api/dashboard/`

**前端页面实现**
- `tsconfig.json`：添加 baseUrl + paths，修复 `@/` 别名 TypeScript 报错
- `.umirc.ts`：补充 `/modules`、`/users` 路由
- `layouts/index.tsx` 完整重写：侧边栏项目列表（含子菜单）、顶栏通知铃铛（Badge + Drawer）、60 秒轮询、退出登录清除 localStorage
- `pages/dashboard/index.tsx`：4 个统计卡片 + 需求状态分布饼图 + 活跃迭代列表 + 项目概览表格
- `pages/iterations/index.tsx`：迭代列表（含进度条）+ 新建/编辑 Modal
- `pages/modules/index.tsx`：树形模块管理（递归渲染 + 拖拽排序 + 新建/编辑/删除）
- `pages/users/index.tsx`：用户列表 + 角色筛选 + 工作量统计（需求数+缺陷数）

**第三方集成（apps/integrations）**
- `views.py` 新增：TAPDWebhookView（接收 TAPD 需求变更 webhook）、GitLabWebhookView（接收 GitLab push/MR webhook）、AIService（DeepSeek/Claude 双降级 + complete_with_images 多图支持）、QWLoginView（企微扫码登录）、QWUserInfoView（获取企微用户信息）
- `integrations_urls.py` 路由完整

---

## 2026-04-09 — 前端 UMI 3 迁移到 Vite 5 + React Router v6

### 迁移原因
- UMI 3 依赖 webpack 4 + Node 12，与 Node 18+ 不兼容（`--openssl-legacy-provider` 临时方案不稳定）
- Vite 5 启动速度快（冷启动 <1s vs UMI 3 的 10-30s），HMR 即时响应
- React Router v6 是主流标准，UMI 路由约定过于魔法化

### 技术栈变化

| 维度 | UMI 3 | Vite 5 + React Router v6 |
|---|---|---|
| 构建工具 | UMI 3（webpack） | Vite 5 |
| 路由 | UMI 内置路由 | React Router v6 |

### 代码替换

所有 `from 'umi'` 的导入全部替换为 `from 'react-router-dom'`：

| 文件 | UMI 用法 | React Router v6 替换 |
|---|---|---|
| `layouts/index.tsx` | `useHistory()` + `history.push(...)` | `useNavigate()` + `navigate(...)` |
| `layouts/index.tsx` | `useLocation` from umi | `useLocation` from react-router-dom |
| `layouts/index.tsx` | `Link` from umi | `Link` from react-router-dom |
| `pages/login/index.tsx` | `history` 对象（非 Hook） | `useNavigate()` Hook |
| `pages/iterations/index.tsx` | `useLocation` from umi | `useLocation` from react-router-dom |
| `pages/modules/index.tsx` | `useLocation` from umi | `useLocation` from react-router-dom |

### access.ts 重构

原 `access.ts` 是 UMI 约定文件（`getInitialState` + `access()` 由 UMI 框架调用）。迁移后改为普通工具模块：
- 保留 `CurrentUser` 接口和 `UserRole` 类型定义
- `getInitialState()` 改名为 `fetchCurrentUser()`，由各组件按需调用
- 删除 UMI 专用的 `access()` 权限函数（逻辑已内联到各页面）

### 启动命令变化

```bash
# 旧（UMI 3）
set NODE_OPTIONS=--openssl-legacy-provider && umi dev

# 新（Vite 5）
vite   # 即 pnpm dev
```

---

## 2026-04-14 — 需求 AI 理解完整设计方案

### 背景

平台是一个集成需求项目管理、测试管理、AI提效和度量的综合性平台，围绕需求全生命周期管理，紧密结合AI技术进行提效。

需求全生命周期分为：
- **需求阶段**：需求创建/拉取、需求评审
- **技术/开发阶段**：技术方案、技术开发、提测
- **测试阶段**：自动测试计划、AI测试用例生成、测试用例选取、测试用例执行（AI自动化API测试/AI自动化UI测试/手工测试）、测试缺陷记录、测试结果、测试报告生成
- **度量阶段**：质量度量、团队度量等

### 核心设计原则

1. **文档解析质量是最重要的基础**：文档内容解析的质量和有效性是整个流程的地基
2. **需求AI理解质量同样重要**：AI理解的质量直接影响后续技术方案和测试用例生成
3. **人工审核是质量保障**：内容解析和AI理解都需要人工审核确认
4. **配置化设计**：支持灵活配置不同方案，便于对比效果和成本

### 整体流程

```
用户上传文件/配置链接/AI对话
        ↓ 同步落库
  创建 AiUnderstanding
    raw_content = 原始文本
    parse_status = 'pending'
    parse_reviewed = False
    status = 'pending'
        ↓ 异步任务1：内容解析
  parse_document_task
    parse_status = 'processing'
    
    文档解析：
      • pymupdf 提取文字层
      • pdfplumber 提取表格 → Markdown
      • pymupdf 提取图片 → 大图切片
      • MD/URL 正则提取图片链接 → 下载
      • DOCX 提取内嵌图片
    
    → 保存 parsed_content（文字+表格，不含图片识别）
    
    图片识别（根据配置 enable_image_recognition）：
      if enable_image_recognition:
        for each image:
          调用 Vision LLM 识别图片内容
        → 保存 parsed_content_with_images（文字+表格+图片识别）
      else:
        parsed_content_with_images = parsed_content
    
    质量自检：
      • 字符数检查
      • 图片数量检查
      • 乱码检测
    
    → 更新 AiInputAsset.file_paths（图片列表）
    parse_status = 'done'
    parse_reviewed = False（等待人工审核）
        ↓ 人工审核
  前端展示解析内容（两个Tab）
    Tab1: parsed_content（纯文本，可编辑）
    Tab2: parsed_content_with_images（含图片识别，可编辑）
    图片列表（可查看原图）
    
    用户操作：
      • 编辑任一字段内容
      • 点击"审核通过"
        → parse_reviewed = True
      • 或点击"重新解析"
        ↓ 用户点击"生成AI理解"
  前端检查状态：
    • parse_status != 'done' → 提示"解析中，请稍后"
    • parse_reviewed = False → 提示"请先审核解析内容"
    • parse_status = 'failed' → 提示"解析失败，是否重新解析？"
    • 通过检查 → 调用 trigger_generate API
        ↓ 异步任务2：AI理解生成
  generate_ai_understanding
    前置检查：
      if parse_status != 'done' or not parse_reviewed:
        status = 'failed'
        return
    
    status = 'processing'
    
    读取配置：
      • use_content_field: 使用哪个字段
      • process_images_in_understanding: 是否还要处理图片
    
    获取历史上下文：
      Layer1: 模块知识（ModuleKnowledge）
      Layer2: 历史需求（同模块最近3条）
    
    组装 Prompt：
      System Prompt + 模块知识 + 历史需求 + 选定的文本字段
    
    LLM 调用：
      if process_images_in_understanding:
        图片≤15张 → 单次Vision调用
        图片>15张 → 分批Vision调用 + 合并
      else:
        纯文本调用
    
    解析输出：
      提取 Markdown → ai_understanding
      提取 JSON → ai_quality_issues
    
    status = 'done'
        ↓ 人工审核AI理解
  用户查看/编辑 ai_understanding
  选择最优理解（is_selected=True）
        ↓ 后处理异步任务（不阻塞）
  • 模块关联推荐
  • 需求关联推荐
  • 模块知识反哺
```

### 数据模型变更

#### AiUnderstanding 新增字段

```python
# 内容解析相关
parse_status = models.CharField(
    max_length=20,
    choices=[
        ('pending', '待解析'),
        ('processing', '解析中'),
        ('done', '解析完成'),
        ('failed', '解析失败'),
    ],
    default='pending'
)

parsed_content = models.TextField(
    blank=True, null=True,
    verbose_name='结构化解析内容',
    help_text='文字+表格Markdown，不含图片识别'
)

parsed_content_with_images = models.TextField(
    blank=True, null=True,
    verbose_name='含图片识别的解析内容',
    help_text='文字+表格+图片LLM识别结果'
)

parse_error_msg = models.TextField(blank=True, null=True)
parse_reviewed = models.BooleanField(default=False)
parse_reviewed_by = models.ForeignKey(User, ...)
parse_reviewed_at = models.DateTimeField(null=True, blank=True)

# AI理解相关
ai_quality_issues = models.JSONField(
    blank=True, null=True,
    verbose_name='AI缺陷预判'
)
```

#### Module 新增字段

```python
status = models.CharField(
    choices=[('active', '正式'), ('draft', '草稿')],
    default='active'
)
created_by_ai = models.BooleanField(default=False)
git_repo_url = models.URLField(blank=True, null=True)
git_code_path = models.CharField(max_length=500, blank=True, null=True)
```

#### ModuleKnowledge 新建表

```python
class ModuleKnowledge(models.Model):
    module = models.ForeignKey(Module, related_name='knowledge_records')
    summary = models.TextField(blank=True, null=True)
    business_rules = models.TextField(blank=True, null=True)
    tech_stack = models.TextField(blank=True, null=True)
    common_issues = models.TextField(blank=True, null=True)
    
    source = models.CharField(
        choices=[
            ('code_analysis', '代码分析'),
            ('req_distill', '需求沉淀'),
            ('human_written', '人工编写'),
            ('merged', '汇总整合'),
        ]
    )
    source_ref = models.CharField(max_length=200, blank=True, null=True)
    
    review_status = models.CharField(
        choices=[
            ('pending', '待审核'),
            ('approved', '已审核'),
            ('rejected', '已拒绝'),
        ],
        default='pending'
    )
    reviewed_by = models.ForeignKey(User, ...)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
```

#### RequirementRelation 新建表

```python
class RequirementRelation(models.Model):
    from_requirement = models.ForeignKey(Requirement, related_name='relations_from')
    to_requirement = models.ForeignKey(Requirement, related_name='relations_to')
    relation_type = models.CharField(
        choices=[
            ('related', '相关'),
            ('depends_on', '依赖'),
            ('may_affect', '可能影响'),
            ('duplicates', '重复'),
        ]
    )
    source = models.CharField(
        choices=[
            ('ai_suggested', 'AI推荐'),
            ('user_created', '用户创建'),
        ],
        default='ai_suggested'
    )
    ai_reason = models.TextField(blank=True, null=True)
    confirmed = models.BooleanField(default=False)
```

### Settings 配置

```python
# settings.py

AI_UNDERSTANDING_CONFIG = {
    # 内容解析时是否识别图片
    'enable_image_recognition': True,
    
    # AI理解时使用哪个字段
    'use_content_field': 'parsed_content_with_images',
    # 可选值：'parsed_content' 或 'parsed_content_with_images'
    
    # AI理解时是否还要处理图片
    'process_images_in_understanding': False,
}

# 四种典型配置组合：
# 方案1：纯文本，不处理图片（最省成本）
# 方案2：图片识别转文字，AI理解用文字（推荐，质量好）
# 方案3：纯文本 + AI理解时看图
# 方案4：图片识别 + AI理解时再看图（双重处理，最贵）
```

### 文档解析策略

| 来源 | 文本提取 | 图片提取 |
|------|----------|----------|
| PDF上传 | pymupdf文字层 + pdfplumber表格→MD | pymupdf内嵌图片 + 大图切片 |
| DOCX上传 | python-docx段落文本 | python-docx内嵌图片 |
| MD上传 | 直接读文本 | 正则提取图片链接→下载 |
| URL抓取 | 抓取网页文本 | 正则提取图片链接→下载 |
| GitLab拉取 | MD文本 | 图片链接→GitLab raw URL→下载 |
| AI对话 | text_content | 用户上传截图 + text_content中图片链接 |
| 截图上传 | 无 | 现有逻辑，不变 |

### Prompt 设计

```python
REQ_MD_SYSTEM = """你是一个资深产品需求分析专家。
将原始需求文档转化为清晰、完整、可执行的需求规格。

【重要原则】内容质量优先于格式规范。

## 内部思考（不输出）
- 核心目标是什么？解决谁的什么问题？
- 涉及哪些用户角色和场景？
- 主流程和异常流程是什么？

## 输出结构

### 一、需求概述 【必填】
核心目标、背景价值、涉及角色

### 二、功能点列表 【必填】
每个功能点：

**[功能名称]**
- 描述：功能是什么
- 优先级：Must/Should/Could（无法判断则省略）
- 重要程度：核心/重要/辅助
  核心 = 本次需求的主要目标
  重要 = 支撑核心功能的必要部分
  辅助 = 不影响核心目标的补充
- 验收标准（优先Given-When-Then，模糊时用清晰文字）：
  Given [前置条件] When [操作] Then [预期结果]

### 三、业务规则 【必填，无则写"暂无明确业务规则"】
数据规则、权限规则、流程规则、边界条件

### 四、非功能需求 【选填，仅列文档明确提及的】

---
如发现质量问题，在末尾输出 JSON 块（否则不输出）：

```json
{
  "source": "req_md",
  "issues": [
    {
      "type": "missing|contradiction|undefined|risk",
      "severity": "high|medium|low",
      "title": "问题标题（10字以内）",
      "description": "问题描述",
      "suggestion": "建议处理方式"
    }
  ]
}
```
"""
```

### API 端点

```python
# 审核解析内容
@action(detail=True, methods=['post'], url_path='review-parse')
def review_parse(self, request, pk=None):
    """审核解析内容，支持编辑两个字段"""
    pass

# 重新解析
@action(detail=True, methods=['post'], url_path='reparse')
def reparse(self, request, pk=None):
    """重置状态，重新触发解析任务"""
    pass

# 触发AI理解生成
@action(detail=True, methods=['post'], url_path='trigger-generate')
def trigger_generate(self, request, pk=None):
    """前置检查 + 触发AI理解任务"""
    pass
```

### 前端交互

```
内容解析完成后：

┌─────────────────────────────────────────────────────────┐
│  内容解析                                                 │
│  状态：✓ 解析完成  ⚠️ 待审核                              │
│                                                          │
│  Tab: [纯文本] [含图片识别]                               │
│                                                          │
│  【纯文本】Tab: parsed_content（可编辑）                  │
│  【含图片识别】Tab: parsed_content_with_images（可编辑）  │
│                                                          │
│  图片（3张）：[缩略图1] [缩略图2] [缩略图3]                │
│                                                          │
│  [审核通过]  [重新解析]                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  AI理解生成                                               │
│  状态：待生成                                             │
│  [生成AI理解] ← 灰色禁用 + tooltip"请先审核解析内容"      │
└─────────────────────────────────────────────────────────┘
```

### 新增依赖

```
pymupdf      # PDF文字+图片提取
pdfplumber   # 表格提取
Pillow       # 图片切片处理
requests     # 图片链接下载
python-docx  # DOCX解析
```

### 设计决策汇总

**文档解析：**
- PDF：pymupdf文字 + pdfplumber表格 + pymupdf图片，三步组合
- 大图：宽高比>3:1自动切片
- MD/URL/GitLab：正则提取图片链接下载
- 解析质量自检：字符数/图片数/乱码，warning不阻断流程
- 两个字段：parsed_content（纯文本）+ parsed_content_with_images（含图片识别）

**图片识别：**
- 可配置开关（enable_image_recognition）
- 单图识别，可并行处理
- 识别失败不阻断流程，标记失败原因

**AI理解：**
- 可配置使用哪个字段（use_content_field）
- 可配置是否再处理图片（process_images_in_understanding）
- 支持4种组合方案，灵活对比效果

**LLM调用：**
- 图片≤15张单次调用，>15张分批+合并
- 分批失败跳过，合并时注明缺失

**Prompt：**
- CoT内部思考（不输出）
- 功能点：优先级(MoSCoW) + 重要程度(核心/重要/辅助)
- 验收标准：Given-When-Then（建议非强制）
- 质量问题：统一JSON，type包含missing/contradiction/undefined/risk
- 内容质量优先于格式规范（明确声明）
- Prompt集中在 ai_prompts.py，为后续DB管理预留

**存储：**
- raw_content（原始文本，前端展示）
- parsed_content（纯文本解析）
- parsed_content_with_images（含图片识别）
- ai_understanding（Markdown）
- ai_quality_issues（JSON，nullable，含source字段）

**审核流程：**
- 内容解析 → 人工审核 → AI理解生成
- 两道质量关卡，可编辑修正
- 前端状态联动，按钮禁用提示

**历史上下文：**
- 两层（模块知识+历史需求），空也继续
- 知识库：ModuleKnowledge独立表

**关联推荐：**
- 模块关联：AI推荐草稿+用户确认，支持多选，支持新建草稿模块
- 需求关联：AI推荐+用户确认，RequirementRelation表

**权限：**
- 模块知识审核：测试负责人/测试TL/超级管理员

**实现：**
- 平台后端服务（非Claude Code Skill）
- Prompt暂时硬编码，后续迁移DB不影响调用方
- 配置化设计，支持灵活对比不同方案效果

### 后续计划

1. 实现内容解析任务（parse_document_task）
2. 实现AI理解任务（generate_ai_understanding）
3. 实现前端审核界面
4. 实现后处理任务（模块关联推荐、需求关联推荐、模块知识反哺）
5. 对比不同配置方案的效果和成本
6. 实现技术方案AI理解
7. 实现UI设计稿AI理解
