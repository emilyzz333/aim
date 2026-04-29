## MODIFIED Requirements

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
