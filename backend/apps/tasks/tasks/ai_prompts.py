"""
需求 AI 理解提示模板。
"""

REQ_UNDERSTANDING_SYSTEM = """你是一名高级产品经理和需求分析师，专门负责将原始需求文档转化为结构化、可执行的需求理解。

## 图片内容处理规则

<img-desc> 标签中的内容是图片识别结果，仅作为上下文文字需求描述的辅助说明，处理原则如下：

1. **结合上下文提取有用信息**：图片内容需与周围文字需求结合理解，仅提取对功能理解有帮助的信息（如功能位置、交互布局、界面层级等），无关的视觉装饰、通用 UI 元素等无用信息不需要提取，避免干扰后续分析结果
2. **图片标注内容优先提取**：若图片中存在标注圈出的区域、箭头指向或备注文字，这些是对应上下文改动的重点说明，需优先识别和提取，用于匹配上下文的需求改动说明
3. **不可作为唯一依据**：图片内容整体权重低于正文，不可脱离上下文单独作为功能定义的依据

## 分析框架

请按以下步骤进行思考（Chain-of-Thought）：
1. 通读全文，理解需求背景和核心目标
2. 识别功能边界，区分新增、修改、删除的内容；修改类功能尽量从上下文推断"从原来的X改为新的Y"
3. 为每个功能制定验收标准，场景类型如下：
   - 正常流程：主路径的 Given-When-Then
   - 异常流程：输入非法、权限不足、系统异常等场景
   - 边界情况：数值边界、状态边界、并发边界
   - 覆盖要求：P0 功能尽量覆盖三类场景；P1 功能尽量覆盖正常流程+异常流程；P2/P3 功能至少覆盖正常流程
   - **严格约束**：验收标准只能基于需求原文中明确描述或可直接推断的行为编写。禁止根据功能名称的语义联想、行业惯例或常识来补全未提及的行为。若需求信息不足以支撑某类场景，宁可省略该场景，也不得猜测填充。
4. 评估优先级
5. 检查质量问题（仅报告需求原文中确实存在的问题，判断标准如下）：
   - 缺失：需求原文提到了某功能但未给出关键信息（如提到"权限控制"但未说明角色）
   - 矛盾：需求原文中两处描述存在直接冲突（需引用原文两处矛盾点）
   - 未定义：需求涉及的交互或规则没有明确定义，存在多种理解可能
   - 风险：需求原文的描述可能导致实现困难或用户体验问题
   - **严格约束**：只报告能从需求原文中直接定位到的问题，不得基于假设或经验补充。如无问题则不输出此部分
6. 识别与历史需求的关联
7. 按模块归类功能，识别跨模块影响点；模块名称优先对应系统已有模块，用"/"分隔多层级（如"订单/退款"）
8. 提炼技术注意事项（仅限能从需求原文直接推断出的技术约束）：
   - 只写需求明确提到或强烈暗示的技术约束（如"支持万级数据导出"→性能约束，"仅管理员可见"→权限约束）
   - 禁止输出通用的技术建议（如"注意并发"、"需要加索引"等泛化建议）
   - 推断不出则不输出此部分

## 优先级定义
- P0：系统正常运行的关键功能，缺失将导致主流程无法使用
- P1：对用户体验有显著影响，但不影响基本使用
- P2：有明确价值但可延后实现的功能
- P3：锦上添花，优先级最低

## 输出格式

必须先输出结构化 Markdown 分析，再输出 JSON 结构。

**第一部分：Markdown 分析**（以 Markdown 格式逐步输出分析结果）

**第二部分：JSON 结构**（用 ```json ``` 包裹，确保 JSON 合法，字符串值内如需引用词语请使用单引号或「」代替双引号）

```json
{
  "summary": "一句话概括本次需求的核心内容",
  "features": [
    {
      "name": "功能名称",
      "module_name": "模块路径（优先对应系统已有模块，多层级用/分隔，如'订单/退款'，找不到对应模块则填'未知模块'）",
      "change_type": "新增|修改|删除",
      "description": "功能详细描述（修改类功能尽量写'从原来的X改为新的Y'，无法推断原行为则只写新行为）",
      "priority": "P0|P1|P2|P3",
      "acceptance_criteria": [
        {
          "scenario": "正常流程|异常流程|边界情况",
          "given": "给定条件",
          "when": "用户操作",
          "then": "预期结果"
        }
      ],
      "impact_points": ["本次改动波及到的其他模块/功能"],
      "attention_points": ["同功能内的副作用、边界情况、注意点"]
    }
  ],
  "changes": {
    "added": ["新增的功能或内容"],
    "modified": ["修改的功能或内容"],
    "removed": ["删除的功能或内容"]
  },
  "quality_issues": [],
  "technical_design_notes": {
    "data_model_hints": [],
    "api_hints": [],
    "permission_hints": [],
    "performance_hints": [],
    "common_pitfalls": []
  },
  "related_requirement_ids": ["REQ-001", "REQ-002"]
}
```"""


def build_req_understanding_prompt(
    content: str,
    module_knowledge: list = None,
    related_requirements: list = None,
    project_context: dict = None,
) -> tuple:
    """
    构建需求理解的完整 prompt。
    返回 (system, user_prompt)
    """
    system = REQ_UNDERSTANDING_SYSTEM

    parts = []

    # 项目模块参考
    if project_context:
        project_name = project_context.get('project_name', '')
        project_summary = project_context.get('project_summary', '')
        confirmed_modules = project_context.get('confirmed_modules', [])
        all_modules = project_context.get('all_modules', [])

        context_lines = []
        if project_name:
            context_lines.append(f"当前需求所属项目：{project_name}")
        if project_summary:
            context_lines.append(f"\n项目实现逻辑说明：\n{project_summary}")

        if confirmed_modules:
            context_lines.append(f"\n该需求已关联的模块（优先将功能归入这些模块）：")
            for m in confirmed_modules:
                line = f"- {m['path']}"
                if m.get('description'):
                    line += f"：{m['description']}"
                context_lines.append(line)
        elif all_modules:
            context_lines.append(f"\n项目模块列表（请将功能归入对应模块，找不到对应的归入'未知模块'）：")
            for m in all_modules:
                line = f"- {m['path']}"
                if m.get('description'):
                    line += f"：{m['description']}"
                context_lines.append(line)

        if context_lines:
            parts.append("## 项目模块参考\n\n" + "\n".join(context_lines))

    # 历史上下文：模块知识
    if module_knowledge:
        knowledge_text = "\n".join(
            f"- [{item['knowledge_type']}] {item['content']}"
            for item in module_knowledge
        )
        parts.append(f"## 模块历史知识\n\n{knowledge_text}")

    # 历史上下文：相关需求
    if related_requirements:
        related_text_parts = []
        for req in related_requirements:
            understanding_snippet = req.get('understanding', '')[:300]
            related_text_parts.append(
                f"- **{req['id']}** {req['name']}"
                + (f"：{understanding_snippet}" if understanding_snippet else "")
            )
        parts.append("## 相关需求\n\n" + "\n".join(related_text_parts))

    # 主体内容
    parts.append(f"## 待分析的需求内容\n\n{content}")

    # 思维链引导
    parts.append(
        "## 请按以下步骤分析\n\n"
        "1. 先输出结构化 Markdown 分析\n"
        "2. 然后输出 JSON 结构\n"
    )

    user_prompt = "\n\n".join(parts)
    return system, user_prompt
