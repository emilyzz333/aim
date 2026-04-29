## ADDED Requirements

### Requirement: JWT 用户登录
系统 SHALL 支持用户名 + 密码登录，成功后返回 Access Token（有效期 15 分钟）和 Refresh Token（有效期 7 天）。

#### Scenario: 登录成功
- **WHEN** 用户提交正确的用户名和密码至 `POST /api/auth/login`
- **THEN** 系统返回 HTTP 200，响应体包含 `access` 和 `refresh` 两个 JWT 字段

#### Scenario: 登录失败（密码错误）
- **WHEN** 用户提交错误密码
- **THEN** 系统返回 HTTP 401，响应体包含错误描述，不返回任何 Token

### Requirement: JWT Token 刷新
系统 SHALL 支持通过 Refresh Token 换取新的 Access Token，无需重新登录。

#### Scenario: Token 刷新成功
- **WHEN** 前端携带有效 Refresh Token 请求 `POST /api/auth/token/refresh`
- **THEN** 系统返回新的 Access Token

#### Scenario: Refresh Token 过期
- **WHEN** 前端携带已过期的 Refresh Token 请求刷新
- **THEN** 系统返回 HTTP 401，前端跳转至登录页

### Requirement: 企业微信 SSO 登录
系统 SHALL 支持企业微信扫码授权登录，获取企业微信用户信息后与本地 User 账号绑定，返回 JWT。完整企微认证接口包含：授权链接生成、code 换取用户信息（callback）、企微用户直接登录、获取企微用户详情。

#### Scenario: 企业微信授权成功
- **WHEN** 用户完成企业微信扫码，系统通过 `GET /api/auth/qw/callback` 接收授权码
- **THEN** 系统换取用户信息，绑定/创建本地账号，返回 JWT，前端完成登录跳转

#### Scenario: 企微用户直接登录
- **WHEN** 前端携带企微 code 请求 `POST /api/auth/qw/login`
- **THEN** 系统验证 code，返回 JWT 和用户信息（含企微字段 qw_userid、qw_department、qw_avatar）

#### Scenario: 获取企微用户信息
- **WHEN** 已登录用户请求 `GET /api/auth/qw/userinfo`
- **THEN** 系统返回当前用户绑定的企微信息（qw_userid、qw_openid、qw_department、qw_avatar）

#### Scenario: 企业微信授权失败
- **WHEN** 企业微信返回错误码或授权被拒绝
- **THEN** 系统返回 HTTP 400，前端提示登录失败

### Requirement: 基于角色的权限控制（RBAC）
系统 SHALL 基于用户角色（产品经理、开发人员、测试人员、项目经理、管理员、超级管理员）控制 API 访问权限，未授权操作返回 HTTP 403。

#### Scenario: 管理员访问用户管理接口
- **WHEN** 角色为管理员的用户请求 `GET /api/users`
- **THEN** 系统返回 HTTP 200 和用户列表

#### Scenario: 普通用户访问用户管理接口
- **WHEN** 角色为开发人员的用户请求 `DELETE /api/users/:id`
- **THEN** 系统返回 HTTP 403

### Requirement: 用户登出
系统 SHALL 支持用户主动登出，使 Refresh Token 失效。

#### Scenario: 登出成功
- **WHEN** 用户请求 `POST /api/auth/logout` 并携带 Refresh Token
- **THEN** 系统将该 Refresh Token 加入黑名单，返回 HTTP 200

### Requirement: 用户角色体系
系统 SHALL 支持以下角色，`ROLE_CHOICES` 扩展后包含9个角色：

| 角色值 | 显示名 |
|--------|--------|
| `product_manager` | 产品经理 |
| `developer` | 开发人员 |
| `tester` | 测试人员 |
| `project_manager` | 项目经理 |
| `product_tl` | 产品TL |
| `developer_tl` | 开发TL |
| `tester_tl` | 测试TL |
| `admin` | 管理员 |
| `super_admin` | 超级管理员 |

#### Scenario: 新角色可在人员管理中选择
- **WHEN** 管理员在人员管理页为用户设置角色
- **THEN** 角色下拉列表包含"产品TL"、"开发TL"、"测试TL"三个新选项

#### Scenario: /auth/me/ 正确返回新角色
- **WHEN** 角色为 `product_tl` 的用户调用 `/auth/me/`
- **THEN** 响应体中 `role` 为 `"product_tl"`，`role_display` 为 `"产品TL"`

#### Scenario: 现有用户数据不受影响
- **WHEN** 执行角色扩展迁移后
- **THEN** 现有用户 `role` 字段值不变，`is_admin_or_above` 和 `is_super_admin` 属性逻辑不变
