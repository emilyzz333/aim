## ADDED Requirements

### Requirement: GitLab 集成
系统 SHALL 通过 GitLab REST API v4 支持代码仓库关联，允许在需求上绑定 GitLab 分支和 Commit ID。

#### Scenario: 关联 GitLab 项目
- **WHEN** 管理员在项目设置中配置 GitLab 仓库地址和 Access Token
- **THEN** 系统验证 Token 有效性，存储配置，返回 HTTP 200

#### Scenario: 在需求中选择 GitLab 分支
- **WHEN** 开发人员在需求详情页输入 GitLab 分支名
- **THEN** 系统存储分支名（支持多个），展示在需求详情的"关联信息"区域

### Requirement: TAPD 集成
系统 SHALL 支持通过 TAPD Open API 获取项目列表和需求数据，并将选中需求同步到本平台。

#### Scenario: 获取 TAPD 项目列表
- **WHEN** 用户请求 `GET /api/tapd/projects`
- **THEN** 系统调用 TAPD API，返回可访问的项目列表

#### Scenario: 拉取 TAPD 需求
- **WHEN** 用户选择 TAPD 项目并请求 `GET /api/tapd/requirements?project_id=<id>`
- **THEN** 系统调用 TAPD API，返回该项目下的需求列表

#### Scenario: TAPD 需求同步
- **WHEN** 用户选中需求并请求 `POST /api/tapd/sync`
- **THEN** 系统将 TAPD 需求数据映射为本地 Requirement 格式，写入数据库，返回同步成功数量

### Requirement: 企业微信认证集成
系统 SHALL 支持企业微信 OAuth2.0 扫码登录，通过企业微信开放 API 获取用户信息（userid、openid、部门、头像）并与本地账号绑定。

#### Scenario: 生成企业微信授权链接
- **WHEN** 前端请求 `GET /api/auth/qw/auth`
- **THEN** 系统返回企业微信 OAuth2.0 授权 URL，前端跳转至该 URL 进行扫码

#### Scenario: 处理企业微信回调
- **WHEN** 企业微信授权完成，回调至 `GET /api/auth/qw/callback?code=<code>`
- **THEN** 系统用 code 换取用户信息，查找或创建本地 User，返回 JWT

### Requirement: AI 模型集成
系统 SHALL 提供统一的 AI 服务层，对接 DeepSeek 和 Claude API，支持需求分析、测试用例生成和智能代码生成功能。

#### Scenario: AI 需求分析
- **WHEN** 用户提交需求描述，请求 AI 分析
- **THEN** 系统调用 AI 模型，返回需求拆解建议和技术要点

#### Scenario: AI 测试用例生成
- **WHEN** 测试人员请求根据需求 ID 生成测试用例
- **THEN** 系统调用 AI 模型，返回结构化测试用例列表（标题、步骤、预期结果），`source` 标记为"AI 生成"

#### Scenario: AI 智能代码生成
- **WHEN** 开发人员在需求详情页点击"AI 生成代码"，提交需求描述和技术方案内容
- **THEN** 系统调用 AI 模型，返回代码片段（含语言类型和说明），前端以代码块形式展示，用户可复制

#### Scenario: AI 接口不可用时降级
- **WHEN** AI 模型 API 调用超时或返回错误
- **THEN** 系统返回 HTTP 503，提示 AI 服务暂不可用，不影响其他功能正常使用
