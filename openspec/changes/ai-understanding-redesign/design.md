## Context

当前 AI 理解（AI Understanding）是需求全生命周期 AI 提效链的起点，其输出质量直接影响技术方案生成、测试用例生成、缺陷预判等所有下游环节。

当前问题：
- JSON 输出嵌套 `platforms[].modules[].features[]`，下游消费复杂且与实际项目结构耦合
- `acceptance_criteria` 无场景分类，测试用例生成 AI 无法区分正常/异常/边界路径
- `technical_design_notes` 为自由文本，技术方案生成 AI 难以精准提取
- `Requirement.module` 为单 FK，一个需求只能关联一个模块，不符合实际
- System Prompt 缺少 `<img-desc>` 标签处理规则，AI 对图片辅助内容权重判断不准确
- 模块上下文注入仅传平铺名称列表，缺少描述和历史知识

## Goals / Non-Goals

**Goals:**
- 输出 flat `features[]` 结构，每条功能含 `module_name` 路径，下游按需提取
- `acceptance_criteria` 增加 `scenario` 字段，覆盖正常/异常/边界三类场景
- `technical_design_notes` 结构化为 5 个分类，下游可按类注入
- `Requirement.modules` 升级为 M2M，支持多模块关联
- `Project.summary` 新字段，注入项目级实现逻辑上下文
- System Prompt 补充图片处理规则和验收标准场景引导
- 前端审核面板完整重设计，支持模块确认交互

**Non-Goals:**
- 下游 AI 消费者（技术方案生成、测试用例生成等）的实现（后续迭代）
- `change_detail`（from/to 原行为推断）——准确率不可控，宁缺毋滥
- `scope_type` 字段（新需求/变更区分）——由测试环节人工指定，TODO 占位

## Decisions

### D1：flat features[] vs 嵌套 platforms[].modules[].features[]

**选择**：flat `features[]`，每条含 `module_name: "订单/退款"` 路径字符串。

**理由**：项目/平台信息来自数据库（`requirement.project`），不应由 AI 重复输出；flat 结构下游提取简单，前端按 `module_name` 分组渲染，`/` 分隔符支持多层级展示。

### D2：Requirement.module FK → modules M2M

**选择**：新增 `modules = ManyToManyField(Module)`，保留原 `module` FK 字段（标记 deprecated，迁移脚本将原 FK 数据写入 M2M）。

**理由**：一个需求实际可能跨多个模块（如"退款"同时涉及订单模块和财务模块）；M2M 支持 AI 匹配多个模块后用户确认。

**迁移**：`python manage.py migrate` 创建中间表，迁移脚本将 `module` FK 非空记录写入 `modules` M2M。

### D3：模块上下文注入策略

```
if requirement.modules.exists():
    # 优先使用已确认的关联模块
    注入已关联模块的 name + description + ModuleKnowledge
else:
    # 注入完整项目模块树，让 AI 匹配
    注入 project 下所有模块（name + path + description + ModuleKnowledge[:5]）
```

**理由**：已确认模块精准注入减少 token；未确认时提供完整树让 AI 自主匹配，用户在审核面板确认后保存。

### D4：acceptance_criteria 场景分类

增加 `scenario: "正常流程|异常流程|边界情况"` 字段。System Prompt 引导：核心功能必须覆盖三类，重要功能至少两类，辅助功能至少正常流程。

**理由**：测试用例生成 AI 可直接按场景分类生成，无需自行推断。

### D5：technical_design_notes 结构化

```json
{
  "data_model_hints": [],
  "api_hints": [],
  "permission_hints": [],
  "performance_hints": [],
  "common_pitfalls": []
}
```

System Prompt 明确边界：技术注意事项是"需求隐含的技术约束"，不是技术方案。

### D6：前端审核面板布局

概览卡片（summary + 统计）+ 5 Tab：
1. **功能列表**：按 `module_name` 分组，核心功能默认展开，其余折叠
2. **变更汇总**：changes.added/modified/removed 三列
3. **质量问题**：quality_issues 列表，含 feature_name 关联
4. **技术注意**：technical_design_notes 按分类展示，空分类隐藏
5. **原始输出**：ai_understanding 原始 LLM 输出

模块确认区：展示 AI 匹配的模块列表，用户可调整后点击"确认模块"保存到 `requirement.modules`。

### D7：JSON 字段与下游 AI 消费者的映射关系

每个字段的设计都服务于特定的下游消费场景（当前迭代不实现下游，但字段设计需前瞻）：

| 字段 | 主要下游消费者 | 用途 |
|------|--------------|------|
| `summary` | 技术方案生成、测试报告生成 | 快速定位需求核心，作为上下文摘要注入 |
| `features[].name` + `module_name` | 技术方案生成、测试用例生成 | 确定功能边界和模块归属 |
| `features[].change_type` | 测试用例选取、缺陷预判 | 修改类功能是高风险区，需重点回归 |
| `features[].description` | 技术方案生成、测试用例生成 | 功能详细描述，修改类尽量含"从X改为Y" |
| `features[].importance` + `moscow` | 测试用例选取、质量度量 | 按优先级决定测试覆盖深度 |
| `features[].acceptance_criteria`（含 scenario） | **AI 测试用例生成**（最主要消费者） | 直接映射为测试用例，scenario 区分正常/异常/边界 |
| `features[].impact_points` | 技术方案生成、缺陷预判 | 跨模块影响，技术方案需协调；缺陷预判的高风险信号 |
| `features[].attention_points` | **AI 测试用例生成**、缺陷预判 | 边界情况和副作用，测试用例的补充覆盖点 |
| `changes.added/modified/removed` | 测试报告生成、质量度量 | 变更汇总，测试报告的变更说明；质量度量的变更量统计 |
| `quality_issues` | 缺陷预判、质量度量 | 直接作为缺陷预判的输入；severity 分布用于质量度量 |
| `technical_design_notes.data_model_hints` | **技术方案生成** | 数据模型层约束，注入技术方案 prompt 的数据模型 section |
| `technical_design_notes.api_hints` | **技术方案生成** | 接口设计约束，注入接口设计 section |
| `technical_design_notes.permission_hints` | 技术方案生成 | 权限设计约束 |
| `technical_design_notes.performance_hints` | 技术方案生成、缺陷预判 | 性能/并发约束；并发问题是高频缺陷来源 |
| `technical_design_notes.common_pitfalls` | 技术方案生成、**技术开发提效** | 实现坑点，直接注入开发辅助 prompt |
| `related_requirement_ids` | 技术方案生成、测试用例选取 | 关联需求上下文，避免重复设计；测试时关联回归范围 |

**注入策略（当前 TODO，后续迭代实现）**：先用全量 JSON 注入跑通下游流程，稳定后按消费者 Profile 按需提取字段。

## Risks / Trade-offs

- **[风险] M2M 迁移影响现有查询** → 迁移脚本保留原 `module` FK 数据不删除，现有代码逐步切换；新代码优先读 `modules` M2M
- **[风险] flat features[] 的 module_name 由 AI 填写，可能与实际模块名不完全匹配** → 前端模块确认步骤由用户校正，确认后写入 `requirement.modules`（DB 中的真实模块）
- **[Trade-off] acceptance_criteria 增加 scenario 字段导致 prompt 输出更长** → token 成本略增，但测试用例生成质量提升显著，可接受

## Migration Plan

1. 添加 `Project.summary` 字段，运行迁移
2. 添加 `Requirement.modules` M2M 字段，运行迁移
3. 运行数据迁移脚本：将 `requirement.module` FK 非空记录写入 `requirement.modules`
4. 更新 `ai_prompts.py` 和 `ai_tasks.py`
5. 更新前端 `AiUnderstandingReviewPanel.tsx`
6. 添加模块确认 API 端点

回滚：`Project.summary` 和 `Requirement.modules` 为新增字段，删除即可回滚；原 `module` FK 保留不动。

## Open Questions

无未决问题。

> **已决策**：`AiUnderstanding.suggested_modules` 确认新增，存储 AI 从 `features[].module_name` 推断的模块建议，与用户确认后的 `requirement.modules` 区分，便于审核面板展示"AI 建议 vs 已确认"对比。
