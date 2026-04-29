---
name: 关键架构决策
description: 前端路由、通知轮询、AI 服务封装、企微通知等核心架构设计
type: project
---

## 前端路由设计

**技术选型**：React Router v6

**关键决策**：
- 使用 `useNavigate` / `useLocation` hooks（替代 UMI 3 的 `history` 对象）
- 详情页（需求/缺陷）**不包在 PrivateLayout 内**
- 支持新 tab 打开详情页（独立路由）

**Why**：
- 详情页需要独立访问，方便分享链接和多窗口对比
- PrivateLayout 包含侧边栏和头部，详情页不需要这些元素

**How to apply**：
- 新增详情页时，在 `App.tsx` 中直接注册路由，不要嵌套在 `PrivateLayout` 下
- 列表页使用 `<Link to={`/requirements/${id}`}>` 或 `window.open()` 打开详情页

---

## 通知轮询机制

**实现位置**：`frontend/src/layouts/index.tsx`

**机制**：
```javascript
setInterval(fetchNotifications, 60000)  // 每 60 秒请求一次
```

**API 端点**：`GET /api/users/notifications/`

**Why**：
- 当前是 intentional 设计，用于实时更新通知中心
- 简单可靠，无需 WebSocket 基础设施

**已知问题**：
- 频繁请求后端（每分钟一次）
- TODO.md 中已记录：建议后续替换为 WebSocket

**How to apply**：
- 如果用户反馈频率过高，可调整为 120000（2 分钟）
- 长期方案：实现 WebSocket 推送，移除轮询

---

## AI 服务封装

**实现位置**：`backend/apps/integrations/views.py` - `AIService` 类

**核心功能**：
- 统一封装 DeepSeek / Claude API 调用
- 多代理商轮询（配置在 `settings.py`）
- 未配置 API key 时返回 mock 数据（不阻塞开发）

**方法**：
- `_call_deepseek(prompt, **kwargs)` - 调用 DeepSeek API
- `_call_claude(prompt, **kwargs)` - 调用 Claude API（支持多代理商轮询）
- `complete(prompt, provider='auto', **kwargs)` - 统一入口

**Why**：
- 统一 AI 调用接口，方便切换模型
- 轮询机制提高可用性
- Mock 模式支持无 API key 开发

**How to apply**：
- 新增 AI 功能时，统一使用 `AIService` 类
- 不要直接调用 `requests.post()` 到 AI API
- 配置文件中维护代理商列表：
  ```python
  CLAUDE_PROVIDERS = [
      {'base_url': '...', 'api_key': '...'},
      {'base_url': '...', 'api_key': '...'},
  ]
  ```

---

## 企微通知机制

**实现位置**：`backend/apps/integrations/webhook.py`

**核心函数**：
- `send_qw_webhook(content, msg_type='text')` - 发送企微群机器人消息
- `notify_requirement_status_changed()` - 需求状态变更通知
- `notify_bug_assigned()` - 缺陷分配通知
- `notify_requirement_blocked()` - 需求阻塞通知

**配置**：
- `settings.QW_WEBHOOK_URL` - 企微群机器人 Webhook URL

**Why**：
- 关键事件及时通知团队
- 减少信息遗漏和延迟

**How to apply**：
- 新增通知场景时，在 `webhook.py` 中添加对应函数
- 在业务逻辑中调用，使用 `try-except` 包裹（失败不阻塞主流程）
- 示例：
  ```python
  try:
      notify_requirement_status_changed(req, old_status, new_status, user_name)
  except Exception:
      pass  # 通知失败不影响业务
  ```

---

## Markdown 文档管理

**字段设计**：
- `Requirement.req_md` - 需求 Markdown
- `Requirement.tech_md` - 技术方案 Markdown
- `req_md_source` / `tech_md_source` - 来源类型（`manual` / `upload` / `url` / `gitlab`）
- `req_md_source_url` / `tech_md_source_url` - 来源 URL

**上传端点**：
- `POST /requirements/{id}/upload-md/` - 上传 MD 内容
- 参数：`type`（`'req'` / `'tech'`）、`content`

**Why**：
- 需求和技术方案需要版本化管理
- 支持多种来源（手动编辑、文件上传、URL 拉取、GitLab 同步）

**How to apply**：
- 前端编辑器保存时，调用 `upload-md` 端点
- 使用 `type` 参数区分需求 MD 和技术 MD（不要用 `'requirement'` / `'technical'`）

---

## GitLab 集成

**模型**：`ProjectGitLabConfig`（项目级配置）

**字段**：
- `project` - OneToOne 关联到 `Project`
- `repo_url` - GitLab 仓库 URL
- `access_token` - 访问令牌
- `api_url` - GitLab API 地址

**用途**：
- 拉取技术方案 Markdown（`tech_md`）
- 记录 commit ID 和 branch（`tech_md_gitlab_commitid` / `tech_md_gitlab_branch`）

**Why**：
- 技术方案通常在代码仓库中维护
- 自动同步避免手动复制粘贴

**How to apply**：
- 每个项目配置一次 GitLab 信息
- 需求流转到"待开发"时，自动触发 `pull_tech_md` Celery 任务

---

## 数据库设计原则

### JSON 字段使用场景
- 多值字段：`tags`、`developer`、`tester`、`gitlab_branch`、`commit_id`
- 动态字段：`custom_fields`、`ai_understanding_result`
- 文件路径：`file_paths`（`{'source_files': [...], 'images': [...]}`）

### 外键设计
- 单一负责人：ForeignKey（`product_owner`、`dev_owner`、`test_owner`）
- 多人协作：JSONField 存 ID 列表（`developer`、`tester`）

**Why**：
- JSON 字段灵活，适合动态数据
- 外键保证数据完整性，支持级联操作

**How to apply**：
- 需要关联查询的字段用 ForeignKey
- 纯展示的多值字段用 JSONField
- 避免过度使用 JSON（查询性能差）
