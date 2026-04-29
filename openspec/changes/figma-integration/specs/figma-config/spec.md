## ADDED Requirements

### Requirement: 查询 Figma Token 配置状态
系统 SHALL 提供接口返回当前 Figma Token 的配置状态和过期时间，供前端展示配置是否有效。

#### Scenario: Token 已配置且未过期
- **WHEN** 请求 `GET /api/integrations/figma/config/`，且 `FIGMA_API_TOKEN` 已配置、未超过 `FIGMA_TOKEN_EXPIRES_AT`
- **THEN** 返回 `{ configured: true, token_expires_at: "2026-07-01", expires_in_days: N }`

#### Scenario: Token 未配置
- **WHEN** 请求 `GET /api/integrations/figma/config/`，且 `FIGMA_API_TOKEN` 为空
- **THEN** 返回 `{ configured: false, token_expires_at: null, expires_in_days: null }`

#### Scenario: Token 已过期
- **WHEN** 请求 `GET /api/integrations/figma/config/`，且当前日期已超过 `FIGMA_TOKEN_EXPIRES_AT`
- **THEN** 返回 `{ configured: true, token_expires_at: "...", expires_in_days: 0, expired: true }`

### Requirement: 测试 Figma Token 连通性
系统 SHALL 提供接口调用 Figma API 验证当前 Token 是否有效可用。

#### Scenario: Token 有效
- **WHEN** 请求 `POST /api/integrations/figma/config/test/`，Token 调用 Figma API 返回成功
- **THEN** 返回 `{ status: "ok", message: "Figma 连接成功" }`

#### Scenario: Token 无效
- **WHEN** 请求 `POST /api/integrations/figma/config/test/`，Figma API 返回 401
- **THEN** 返回 HTTP 400，`{ detail: "Token 无效或已被撤销" }`

#### Scenario: Token 未配置时测试
- **WHEN** 请求 `POST /api/integrations/figma/config/test/`，但 `FIGMA_API_TOKEN` 为空
- **THEN** 返回 HTTP 400，`{ detail: "Figma Token 未配置" }`
