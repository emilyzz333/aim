## 1. 数据库模型

- [x] 1.1 向 AiUnderstanding 模型添加解析字段（parse_status、parsed_content、parsed_content_with_images、parse_error_msg、parse_reviewed、parse_reviewed_by、parse_reviewed_at、ai_quality_issues）
- [x] 1.2 扩展 Module 模型，添加 status、created_by_ai、git_repo_url、git_code_path 字段
- [x] 1.3 创建 ModuleKnowledge 模型，包含 module FK、knowledge_type、content、source_requirement FK、created_at
- [x] 1.4 创建 RequirementRelation 模型，包含 from_requirement FK、to_requirement FK、relation_type、confidence、created_by_ai
- [x] 1.5 对所有模型更改运行 makemigrations 和 migrate

## 2. 文档解析实现

- [x] 2.1 在 requirements.txt 中安装依赖（PyMuPDF、python-docx、Pillow）
- [x] 2.2 在 ai_tasks.py 中创建 parse_document_task()，包含格式检测逻辑
- [x] 2.3 实现 PDF 解析（使用 PyMuPDF 提取文本、表格、图片）
- [x] 2.4 实现 DOCX 解析（使用 python-docx 提取文本、表格、图片）
- [x] 2.5 实现 Markdown 解析（提取文本、表格，下载图片 URL）
- [x] 2.6 实现 URL 解析（获取 HTML，转换为 Markdown，提取图片）
- [x] 2.7 实现 GitLab issue 解析（通过 API 获取，提取描述和附件）
- [x] 2.8 实现 AI 对话解析（从记录中提取需求详情）
- [x] 2.9 添加使用 Vision LLM 的图片识别逻辑（批量最多 15 张图片）
- [x] 2.10 将结果存储在 parsed_content 和 parsed_content_with_images 字段
- [x] 2.11 更新 parse_status 并使用 parse_error_msg 处理错误

## 3. AI 理解实现

- [x] 3.1 在 ai_prompts.py 中创建 REQ_MD_SYSTEM 提示，包含 CoT、Given-When-Then 格式
- [x] 3.2 添加模块知识获取逻辑以获取积累的模式
- [x] 3.3 添加相关需求获取逻辑（同一模块、最近的）
- [x] 3.4 修改 generate_ai_understanding() 以使用可配置的内容字段
- [x] 3.5 将模块知识和相关需求注入提示上下文
- [x] 3.6 解析 AI 响应并提取结构化输出（features、changes、acceptance_criteria、quality_issues）
- [x] 3.7 将质量问题存储在 ai_quality_issues JSONField 中
- [x] 3.8 为 AI 推荐的关系创建 RequirementRelation 记录
- [x] 3.9 使用此需求的见解更新 ModuleKnowledge

## 4. 配置

- [x] 4.1 将 AI_UNDERSTANDING_CONFIG 添加到 settings.py，包含图片识别设置
- [x] 4.2 添加 downstream_agents 配置部分
- [ ] 4.3 创建配置验证逻辑

## 5. API 端点 - 解析审核

- [x] 5.1 创建 GET /api/requirements/{id}/parse-review/ 端点以获取解析内容
- [x] 5.2 创建 POST /api/requirements/{id}/parse-review/approve/ 端点
- [x] 5.3 创建 POST /api/requirements/{id}/parse-review/reject/ 端点，包含重新解析触发
- [x] 5.4 添加权限检查（IsAdminOrAbove 或指定审核员）

## 6. API 端点 - 理解审核

- [x] 6.1 创建 GET /api/requirements/{id}/understanding-review/ 端点以获取 AI 理解
- [x] 6.2 创建 POST /api/requirements/{id}/understanding-review/approve/ 端点
- [x] 6.3 创建 POST /api/requirements/{id}/understanding-review/reject/ 端点，包含重新生成触发
- [x] 6.4 添加理解审核的权限检查

## 7. API 端点 - 下游消费

- [x] 7.1 为下游代理创建 GET /api/requirements/{id}/understanding/ 端点
- [x] 7.2 添加验证以拒绝未批准的理解（ai_reviewed=False 返回 403）
- [x] 7.3 在响应中包含 module_context 和 related_requirements
- [ ] 7.4 创建 GET /api/requirements/understanding/batch/ 端点用于多个 ID
- [ ] 7.5 添加过滤支持（importance、moscow、quality_issues）
- [ ] 7.6 为下游代理添加认证（API 密钥或 JWT）
- [ ] 7.7 添加消费日志用于分析

## 8. 序列化器

- [x] 8.1 创建 ParsedContentSerializer，包含两个内容字段
- [x] 8.2 创建 AiUnderstandingReviewSerializer，包含结构化输出和质量问题
- [x] 8.3 创建 DownstreamConsumptionSerializer，包含完整上下文
- [x] 8.4 创建 ModuleKnowledgeSerializer
- [x] 8.5 创建 RequirementRelationSerializer

## 9. 前端 - 需求详情页

- [ ] 9.1 向需求详情页添加两标签布局（解析内容 / AI 理解）
- [x] 9.2 创建 ParsedContentTab 组件，显示 parsed_content 和 parsed_content_with_images
- [x] 9.3 添加解析审核的批准/拒绝按钮，使用 Apple 设计风格
- [x] 9.4 创建 AiUnderstandingTab 组件，显示功能、验收标准、变更
- [x] 9.5 使用颜色编码徽章突出显示质量问题（缺失/矛盾/未定义/风险）
- [x] 9.6 添加理解审核的批准/拒绝按钮
- [x] 9.7 显示审核状态指示器（待审核/已批准）及审核员信息
- [x] 9.8 添加重新解析和重新生成操作按钮

## 10. 前端 - 审核工作流 UI

- [ ] 10.1 在导航中创建待审核通知徽章
- [ ] 10.2 添加待审核列表页面，包含过滤器（解析/理解）
- [ ] 10.3 实现审核模态框，包含并排比较（如适用）
- [ ] 10.4 添加拒绝原因输入字段
- [ ] 10.5 显示审核历史时间线

## 11. Celery 任务集成

- [ ] 11.1 更新需求创建流程以触发 parse_document_task
- [ ] 11.2 在解析批准后链接 parse_document_task → generate_ai_understanding
- [ ] 11.3 在前端添加任务状态轮询
- [ ] 11.4 使用重试逻辑处理任务失败

## 12. 测试与验证

- [ ] 12.1 测试 PDF 解析（文本、表格和图片）
- [ ] 12.2 测试 DOCX 解析（格式化内容）
- [ ] 12.3 测试 Markdown 解析（图片 URL）
- [ ] 12.4 测试 URL 和 GitLab 解析
- [ ] 12.5 测试使用 Vision LLM 的图片识别（批量处理）
- [ ] 12.6 测试带模块知识注入的 AI 理解
- [ ] 12.7 测试质量问题检测
- [ ] 12.8 测试所有 4 种配置组合（enable_image_recognition × use_content_field）
- [ ] 12.9 测试人工审核工作流（批准/拒绝流程）
- [ ] 12.10 测试带认证的下游消费 API
- [ ] 12.11 验证所有新 UI 组件符合 Apple 设计系统

## 13. 文档

- [ ] 13.1 在 API 文档中记录 API 端点
- [ ] 13.2 记录配置选项和推荐设置
- [ ] 13.3 创建审核工作流的用户指南
- [ ] 13.4 为 AI 代理开发者记录下游消费 API
- [ ] 13.5 为复杂解析逻辑添加内联代码注释
