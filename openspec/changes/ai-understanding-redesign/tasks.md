## 1. 数据库模型变更

- [x] 1.1 `Project` 模型新增 `summary = TextField(blank=True, null=True)` 字段
- [x] 1.2 `Requirement` 模型新增 `modules = ManyToManyField(Module, blank=True)` 字段
- [x] 1.3 `AiUnderstanding` 模型新增 `suggested_modules = JSONField(default=list, blank=True)` 字段
- [x] 1.4 生成并运行数据库迁移 `makemigrations && migrate`
- [x] 1.5 编写数据迁移脚本：将 `requirement.module` FK 非空记录写入 `requirement.modules` M2M

## 2. Prompt 升级（ai_prompts.py）

- [x] 2.1 System Prompt 补充 `<img-desc>` 标签处理规则（低权重 + 标注内容优先提取）
- [x] 2.2 System Prompt 更新 JSON 输出格式：flat `features[]` 含 `module_name`、`scenario` 字段、`technical_design_notes` 结构化
- [x] 2.3 System Prompt 补充验收标准场景覆盖引导（核心三类/重要两类/辅助一类）
- [x] 2.4 System Prompt 补充技术注意事项边界说明（需求隐含约束，非技术方案）
- [x] 2.5 System Prompt 补充修改类功能 description 引导（尽量写"从X改为Y"）
- [x] 2.6 `build_req_understanding_prompt` 参数 `platform_context` 重命名为 `project_context`
- [x] 2.7 prompt 中"平台模块参考"section 重命名为"项目模块参考"，注入 `project.summary`

## 3. AI 任务逻辑升级（ai_tasks.py）

- [x] 3.1 `generate_structured_ai_understanding` 中 `platform_context` 变量重命名为 `project_context`
- [x] 3.2 模块上下文构建：若 `requirement.modules` 已有数据，注入已关联模块（name+description+knowledge）；否则注入完整项目模块树
- [x] 3.3 任务完成后将 `features[].module_name` 去重写入 `AiUnderstanding.suggested_modules`
- [x] 3.4 `_update_module_knowledge` 适配 flat `features[]` 结构（去掉 platforms 遍历）
- [x] 3.5 `_extract_json_from_response` fallback 返回值改为 `features: []`（去掉 `platforms: []`）

## 4. 模块确认 API 与序列化器

- [x] 4.1 新增 `POST /requirements/{id}/confirm-modules/` 接口，接收 `module_ids` 列表
- [x] 4.2 接口逻辑：清空并重写 `requirement.modules`，返回更新后模块列表
- [x] 4.3 `AiUnderstandingSerializer` 新增 `suggested_modules` 字段输出
- [x] 4.4 `ProjectSerializer` 新增 `summary` 字段输出（前端项目编辑页可读写）
- [x] 4.5 确认 `AiInputAssetSerializer.get_understandings()` 手动 dict 中包含所有新增字段（suggested_modules 等）

## 5. 前端审核面板重设计（AiUnderstandingReviewPanel.tsx）

- [x] 5.1 新增概览卡片：展示 summary、功能总数、质量问题数量
- [x] 5.2 功能列表 Tab：按 `module_name` 分组，`/` 分隔多层级，核心功能默认展开
- [x] 5.3 功能卡片折叠/展开：折叠显示 name+tags，展开显示 description+验收标准+影响点+注意点
- [x] 5.4 验收标准按 scenario 分类展示（✅正常流程 ❌异常流程 ⚠️边界情况图标）
- [x] 5.5 变更汇总 Tab：changes.added/modified/removed 三分组列表
- [x] 5.6 质量问题 Tab：展示 type/severity/feature_name/description/suggestion
- [x] 5.7 技术注意事项 Tab：五分类展示，空分类自动隐藏
- [x] 5.8 模块确认区：展示 suggested_modules，用户可调整后调用确认接口保存
- [x] 5.9 原始输出 Tab：保留现有 MDEditor.Markdown 展示
- [x] 5.10 保留解析内容审核 Tab（parse_reviewed 流程）：解析状态、纯文本/含图片识别双子 Tab、批准/拒绝操作

## 6. 关联组件同步

- [x] 6.1 确认 `AiUnderstandingList.tsx` 中 `renderParsedContent` 与 ReviewPanel 保持一致
- [x] 6.2 `UnderstandingSummary` interface 新增 `suggested_modules` 字段
