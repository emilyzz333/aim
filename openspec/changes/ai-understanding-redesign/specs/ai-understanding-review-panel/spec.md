## ADDED Requirements

### Requirement: 概览卡片展示
审核面板顶部 SHALL 展示概览卡片，包含需求 summary 一句话概括、功能总数、质量问题数量统计。

#### Scenario: 有 AI 理解结果时展示概览
- **WHEN** AI 理解状态为 done
- **THEN** 展示 summary 文本、功能数量、质量问题数量

#### Scenario: AI 理解未完成时
- **WHEN** AI 理解状态为 pending 或 processing
- **THEN** 概览卡片显示对应状态提示，不展示统计数字

### Requirement: 功能列表 Tab 按模块分组展示
功能列表 Tab SHALL 按 `module_name` 字段将功能分组，模块名作为 section header，支持 `/` 分隔的多层级路径展示。

#### Scenario: 核心功能默认展开
- **WHEN** 功能列表 Tab 加载完成
- **THEN** importance 为"核心"的功能卡片默认展开，其余默认折叠

#### Scenario: 功能卡片展开内容
- **WHEN** 用户展开一个功能卡片
- **THEN** 展示 description、acceptance_criteria（按 scenario 分类，✅正常/❌异常/⚠️边界图标）、impact_points、attention_points

#### Scenario: 功能卡片折叠状态
- **WHEN** 功能卡片处于折叠状态
- **THEN** 仅展示功能名称、change_type tag、importance tag、moscow tag

### Requirement: 变更汇总 Tab
变更汇总 Tab SHALL 展示 changes.added、changes.modified、changes.removed 三个分组列表。

#### Scenario: 展示变更列表
- **WHEN** 用户切换到变更汇总 Tab
- **THEN** 分三列展示新增/修改/删除内容，空列表不展示对应分组

### Requirement: 质量问题 Tab
质量问题 Tab SHALL 展示 quality_issues 列表，每条显示 type、severity、feature_name（若有）、description、suggestion。

#### Scenario: 有质量问题时展示
- **WHEN** quality_issues 数组非空
- **THEN** 每条问题展示 type tag、severity tag、关联功能名（若有）、描述和建议

#### Scenario: 无质量问题时
- **WHEN** quality_issues 为空数组
- **THEN** 展示"未发现质量问题"提示

### Requirement: 技术注意事项 Tab
技术注意事项 Tab SHALL 按 technical_design_notes 的五个分类（数据模型/接口设计/权限角色/性能并发/常见坑点）分组展示，空分类自动隐藏。

#### Scenario: 展示非空分类
- **WHEN** 用户切换到技术注意事项 Tab
- **THEN** 仅展示有内容的分类，每条 hint 作为独立列表项

#### Scenario: 全部为空时
- **WHEN** technical_design_notes 所有分类均为空数组
- **THEN** 展示"暂无技术注意事项"提示

### Requirement: 模块确认交互
审核面板 SHALL 展示 AI 匹配的建议模块列表，用户可调整后点击确认，保存到 requirement.modules。

#### Scenario: 展示 AI 建议模块
- **WHEN** AI 理解完成且 requirement.modules 为空
- **THEN** 展示 AI 从 features[].module_name 推断的模块列表，标注"AI 建议"

#### Scenario: 用户确认模块
- **WHEN** 用户点击"确认模块"按钮
- **THEN** 调用模块确认接口，将选中模块保存到 requirement.modules，按钮变为"已确认"状态

#### Scenario: 已有关联模块时
- **WHEN** requirement.modules 已有数据
- **THEN** 展示已确认的模块列表，提供"重新确认"入口
