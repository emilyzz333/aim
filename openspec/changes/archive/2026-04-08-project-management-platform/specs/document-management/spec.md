## ADDED Requirements

### Requirement: 文档存储与管理
系统 SHALL 支持在需求下存储和管理项目相关文档，包含需求 MD 文档（PRD、Proposal）和技术 MD 文档，以 Markdown 格式存储在数据库中。

#### Scenario: 上传需求 MD 文档
- **WHEN** 产品经理在需求详情页上传或编辑需求 MD 文档
- **THEN** 系统将 Markdown 内容存储至 `requirement_md` 字段，返回 HTTP 200

#### Scenario: 上传技术 MD 文档
- **WHEN** 开发人员在需求详情页上传或编辑技术方案 MD 文档
- **THEN** 系统将 Markdown 内容存储至 `technical_md` 字段，返回 HTTP 200

#### Scenario: 查看 MD 文档
- **WHEN** 用户在需求详情页查看文档
- **THEN** 系统返回 Markdown 内容，前端以渲染后的 HTML 形式展示

### Requirement: Figma 链接关联
系统 SHALL 支持在需求中关联 Figma 设计稿链接，存储为文本字段，在需求详情页展示可点击链接。

#### Scenario: 添加 Figma 链接
- **WHEN** 产品经理在需求详情页填写 Figma 链接
- **THEN** 系统存储链接，在详情页的"关联信息"区域展示为可点击的外链

### Requirement: 过程留档
系统 SHALL 支持将研发过程信息记录到 `spec/program.md` 和 `spec/problem.md` 文件，方便团队查阅。

#### Scenario: 访问过程文档
- **WHEN** 团队成员需要查阅研发过程记录
- **THEN** 可在项目根目录 `spec/program.md` 中找到功能研发过程记录，在 `spec/problem.md` 中找到问题与解决方案记录
