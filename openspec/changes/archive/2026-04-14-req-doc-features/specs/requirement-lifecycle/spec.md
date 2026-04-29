## MODIFIED Requirements

### Requirement: 需求生命周期状态流转
系统 SHALL 实现 11 个状态的流转控制，合法流转路径如下：
- 待评审 → 待技评（产品评审通过）
- 待技评 → 待开发（技评通过）
- 待开发 → 开发中（开发人员领取任务）
- 开发中 → 待测试（开发完成）
- 待测试 → 测试中（开始测试）
- 待测试 → 开发中（驳回，需填写驳回原因）
- 测试中 → 待验收（测试通过）
- 待验收 → 待上线（验收通过）
- 待上线 → 待回归（上线完成）
- 待回归 → 已完成（回归通过）
- 任意状态 → 关闭（异常关闭）

**新增：状态流转后异步触发内容拉取**

- `待评审 → 待技评`：若 `req_md_source` 不为 `manual`，异步触发 req_md 重新拉取（失败不阻塞）
- `待技评 → 待开发`：若 `tech_md_source` 不为 `manual`，异步触发 tech_md 重新拉取（失败不阻塞）

#### Scenario: 合法状态流转
- **WHEN** 用户请求 `POST /api/requirements/:id/change-status`，提交合法的目标状态
- **THEN** 系统更新需求状态，写入 ChangeLog（field=status），返回 HTTP 200

#### Scenario: 待评审→待技评时自动触发 req_md 拉取
- **WHEN** 需求从"待评审"流转至"待技评"，且 `req_md_source` 为 `url` 或 `upload` 或 `gitlab`
- **THEN** 状态流转正常完成（HTTP 200 立即返回），后台异步派发 `pull_req_md` Celery 任务，新建 AiUnderstanding 记录

#### Scenario: 状态流转时自动拉取失败
- **WHEN** Celery 任务 `pull_req_md` 执行失败（网络超时/GitLab 403等）
- **THEN** AiUnderstanding 记录 status 更新为 `failed`，error_msg 写入原因，需求状态保持"待技评"不回滚

#### Scenario: 非法状态流转
- **WHEN** 用户尝试将需求从"待评审"直接跳转至"待上线"
- **THEN** 系统返回 HTTP 400，提示非法状态流转

#### Scenario: 任意状态关闭
- **WHEN** 用户提交目标状态为"关闭"
- **THEN** 系统允许流转，更新状态并写入 ChangeLog
