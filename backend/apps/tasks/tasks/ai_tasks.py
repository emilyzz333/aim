import json
import logging
import os

from aim.celery import app
from utils.file_storage import resolve_file_path, is_remote_url

logger = logging.getLogger(__name__)


# ─── 文档解析任务 ─────────────────────────────────────────────────────────────

@app.task(bind=True, max_retries=2, soft_time_limit=300, time_limit=360)
def parse_document_task(self, understanding_id):
    """
    阶段一：AI 解析
    从关联的 AiInputAsset 批次读取文本内容和图片，调用 Vision LLM 识别图片并替换占位符。
    完成后将 parse_status 设为 'done'，等待人工审核。
    """
    from apps.requirements.models import AiUnderstanding
    from apps.tasks.tasks.document_parsers import recognize_images_with_vision_llm
    from django.conf import settings
    import re

    try:
        instance = AiUnderstanding.objects.prefetch_related('input_assets').get(id=understanding_id)
    except AiUnderstanding.DoesNotExist:
        return

    instance.parse_status = 'processing'
    instance.save(update_fields=['parse_status'])

    cfg = getattr(settings, 'AI_UNDERSTANDING_CONFIG', {})
    enable_image_recognition = cfg.get('enable_image_recognition', True)

    try:
        # 读取所有关联的 AiInputAsset
        assets = instance.input_assets.all()
        if not assets.exists():
            raise ValueError('没有关联的 AiInputAsset，无法执行解析')

        # 判断是否使用 Figma MCP 模式
        figma_fetch_mode = getattr(settings, 'FIGMA_FETCH_MODE', 'rest')
        use_mcp = False
        figma_url = None

        if figma_fetch_mode in ('mcp', 'rest_mcp'):
            from apps.integrations.figma_service import is_figma_url
            for asset in assets:
                url = asset.batch_desc or ''
                if asset.source_type == 'url_fetch' and is_figma_url(url):
                    use_mcp = True
                    figma_url = url
                    break

        if use_mcp and figma_url:
            # ─── Figma MCP 模式：由 Claude + MCP 实时读取并解析 ───
            _parse_with_figma_mcp(instance, figma_url)
        else:
            # ─── 常规模式：从 AiInputAsset 读取已存储数据 ───
            # 合并所有 Asset 的文本内容和图片
            combined_text_parts = []
            all_images = []
            placeholder_to_image_index = {}  # 映射 [图片N] -> all_images 的索引
            image_counter = 0

            for asset in assets:
                text = asset.text_content or ''
                file_paths = asset.file_paths or {}

                # 兼容旧格式：file_paths 可能是 list
                if isinstance(file_paths, list):
                    image_paths = []
                else:
                    image_paths = file_paths.get('images', [])

                # 记录此 asset 占位符起始值
                counter_before = image_counter

                # 重新编号占位符（避免多个 Asset 的占位符冲突）
                def replace_placeholder(match):
                    nonlocal image_counter
                    image_counter += 1
                    return f'[图片{image_counter}]'

                text = re.sub(r'\[图片\d+\]', replace_placeholder, text)
                combined_text_parts.append(text)

                # 读取图片字节，建立占位符到图片索引的映射
                # image_paths[i] 对应重编号后的 [图片(counter_before + 1 + i)]
                for img_idx, img_path in enumerate(image_paths):
                    placeholder_num = counter_before + 1 + img_idx
                    full_path = resolve_file_path(img_path)
                    if full_path and os.path.exists(full_path):
                        with open(full_path, 'rb') as f:
                            all_images.append(f.read())
                        placeholder_to_image_index[placeholder_num] = len(all_images) - 1

            combined_text = '\n\n---\n\n'.join(combined_text_parts)

            # 记录日志：检查占位符数量和图片数量
            logger.info(
                f'[AI解析] understanding_id={understanding_id}, '
                f'占位符数量={image_counter}, 实际图片数量={len(all_images)}, '
                f'映射关系={placeholder_to_image_index}'
            )

            # Vision LLM 识别图片
            image_descriptions_list = []  # 结构化存储到 ai_understanding_result
            if enable_image_recognition and all_images:
                image_descriptions = recognize_images_with_vision_llm(all_images)
                logger.info(
                    f'[AI解析] understanding_id={understanding_id}, '
                    f'识别结果数量={len(image_descriptions)}'
                )

                for placeholder_num in range(1, image_counter + 1):
                    img_idx = placeholder_to_image_index.get(placeholder_num)
                    if img_idx is None or img_idx >= len(image_descriptions):
                        continue

                    desc = image_descriptions[img_idx]
                    if desc.startswith('[Claude API 调用失败'):
                        logger.warning(
                            f'[AI解析] understanding_id={understanding_id}, '
                            f'图片{placeholder_num} 识别失败: {desc[:100]}'
                        )
                        continue

                    image_descriptions_list.append({
                        'index': placeholder_num,
                        'description': desc.strip()
                    })

            # parsed_content：纯文本 + 占位符，保持原始不替换
            parsed_content = combined_text.strip()

            # parsed_content_with_images：替换占位符为 <img-desc> 自定义标签格式
            content_with_images = parsed_content
            for img_info in image_descriptions_list:
                placeholder = f'[图片{img_info["index"]}]'
                desc = img_info["description"].strip()
                block = f'\n<img-desc index="{img_info["index"]}">\n📷 图片{img_info["index"]}识别内容（辅助参考）：\n\n{desc}\n</img-desc>\n'
                content_with_images = content_with_images.replace(placeholder, block, 1)

            # 更新 ai_understanding_result，保留原有数据，追加 image_descriptions
            result = instance.ai_understanding_result or {}
            result['image_descriptions'] = image_descriptions_list
            instance.ai_understanding_result = result

            instance.parsed_content = parsed_content
            instance.parsed_content_with_images = content_with_images
            instance.parse_status = 'done'
            instance.parse_error_msg = None
            instance.parse_reviewed = False
            instance.save(update_fields=[
                'parsed_content', 'parsed_content_with_images', 'ai_understanding_result',
                'parse_status', 'parse_error_msg', 'parse_reviewed', 'updated_at',
            ])

    except Exception as exc:
        instance.parse_status = 'failed'
        instance.parse_error_msg = str(exc)[:500]
        instance.save(update_fields=['parse_status', 'parse_error_msg', 'updated_at'])
        raise self.retry(exc=exc, countdown=15)


# ─── AI 理解任务 ──────────────────────────────────────────────────────────────

@app.task(bind=True, max_retries=3, soft_time_limit=110, time_limit=120)
def generate_ai_understanding(self, understanding_id):
    """基于 AiInputAsset 批次异步生成 AI 理解（旧流程，兼容保留）"""
    from apps.requirements.models import AiUnderstanding
    from apps.integrations.views import AIService

    try:
        instance = AiUnderstanding.objects.select_related('requirement').prefetch_related('input_assets').get(id=understanding_id)
    except AiUnderstanding.DoesNotExist:
        return

    instance.status = 'processing'
    instance.save(update_fields=['status'])

    temp_files = []

    try:
        assets = list(instance.input_assets.order_by('created_at'))
        understand_type = instance.understand_type
        system = AIService.SYSTEM_PROMPTS.get(understand_type, '')

        all_image_paths = []
        text_parts = []

        for asset in assets:
            fp = asset.file_paths or {}
            # 支持新 dict 格式 {"source_files": [...], "images": [...]} 和旧 list 格式
            if isinstance(fp, dict):
                image_files = fp.get('images', [])
            else:
                image_files = fp  # 兼容旧 list 格式

            for rel_path in image_files:
                local_path = resolve_file_path(rel_path)
                all_image_paths.append(local_path)
                if is_remote_url(rel_path):
                    temp_files.append(local_path)

            if asset.text_content:
                desc = asset.batch_desc or f'批次{asset.id}'
                text_parts.append(f'【{desc}】\n{asset.text_content}')

        # 无 assets 时不再 fallback 到 raw_content
        if not text_parts and not all_image_paths:
            instance.ai_understanding = '[无可用素材内容]'
            instance.status = 'done'
            instance.error_msg = None
            instance.save(update_fields=['ai_understanding', 'status', 'error_msg', 'updated_at'])
            return

        text_summary = '\n\n'.join(text_parts)
        prompt_parts = []
        if text_summary:
            prompt_parts.append(f'附带文字说明：\n{text_summary}')
        prompt_parts.append('请综合以上内容（图片+文字说明）进行分析理解，输出结构化 Markdown。')
        prompt = '\n\n'.join(prompt_parts)

        if all_image_paths:
            result = AIService.complete_with_images(prompt, all_image_paths, system=system)
        else:
            result = AIService.complete(prompt, system=system)

        instance.ai_understanding = result
        instance.status = 'done'
        instance.error_msg = None
        instance.save(update_fields=['ai_understanding', 'status', 'error_msg', 'updated_at'])

    except Exception as exc:
        instance.status = 'failed'
        instance.error_msg = str(exc)[:500]
        instance.save(update_fields=['status', 'error_msg', 'updated_at'])
        raise self.retry(exc=exc, countdown=10)
    finally:
        for tmp in temp_files:
            try:
                os.remove(tmp)
            except OSError:
                pass


@app.task(bind=True, max_retries=3, soft_time_limit=180, time_limit=210)
def generate_structured_ai_understanding(self, understanding_id):
    """
    阶段二：基于解析后的内容生成结构化 AI 理解。
    需在解析审核通过后（parse_reviewed=True）才调用。
    """
    from apps.requirements.models import AiUnderstanding
    from apps.projects.models import ModuleKnowledge, RequirementRelation
    from apps.integrations.views import AIService
    from apps.tasks.tasks.ai_prompts import build_req_understanding_prompt
    from django.conf import settings

    logger.info('[AI理解] id=%s ── 开始', understanding_id)

    try:
        instance = AiUnderstanding.objects.select_related(
            'requirement__module'
        ).get(id=understanding_id)
    except AiUnderstanding.DoesNotExist:
        logger.error('[AI理解] id=%s 不存在，跳过', understanding_id)
        return

    instance.status = 'processing'
    instance.save(update_fields=['status'])

    cfg = getattr(settings, 'AI_UNDERSTANDING_CONFIG', {})
    use_content_field = cfg.get('use_content_field', 'parsed_content_with_images')

    try:
        # ① 读取需求内容
        logger.info('[AI理解] id=%s ① 读取需求内容...', understanding_id)
        asset = instance.input_assets.order_by('-created_at').first()
        asset_text = (asset.text_content or '') if asset else ''
        content = getattr(instance, use_content_field, None) or instance.parsed_content or asset_text or ''
        logger.info('[AI理解] id=%s   内容长度=%d 字符', understanding_id, len(content))

        # ② 获取模块知识
        logger.info('[AI理解] id=%s ② 获取模块知识...', understanding_id)
        module = instance.requirement.module
        module_knowledge = []
        if module:
            module_knowledge = list(
                ModuleKnowledge.objects.filter(module=module)
                .order_by('-created_at')[:10]
                .values('knowledge_type', 'content')
            )
        logger.info('[AI理解] id=%s   模块知识=%d 条', understanding_id, len(module_knowledge))

        # ③ 获取相关需求
        logger.info('[AI理解] id=%s ③ 获取相关需求...', understanding_id)
        related_reqs = []
        if module:
            related_qs = instance.requirement.__class__.objects.filter(
                module=module
            ).exclude(id=instance.requirement.id).order_by('-created_at')[:5]
            for req in related_qs:
                related_reqs.append({
                    'id': req.requirement_id,
                    'name': req.name,
                    'understanding': req.req_understanding or '',
                })
        logger.info('[AI理解] id=%s   相关需求=%d 条', understanding_id, len(related_reqs))

        # ④ 构建项目模块上下文
        logger.info('[AI理解] id=%s ④ 构建项目模块上下文...', understanding_id)
        project_context = {}
        project = instance.requirement.project
        if project:
            project_context['project_name'] = project.name
            if project.summary:
                project_context['project_summary'] = project.summary

            confirmed_modules_qs = instance.requirement.modules.all()
            if confirmed_modules_qs.exists():
                confirmed_modules = []
                for m in confirmed_modules_qs:
                    path_parts = []
                    current = m
                    while current:
                        path_parts.insert(0, current.name)
                        current = current.parent
                    module_path = '/'.join(path_parts)
                    module_data = {'path': module_path, 'description': m.description or ''}
                    knowledge_items = list(
                        ModuleKnowledge.objects.filter(module=m)
                        .order_by('-created_at')[:5]
                        .values('knowledge_type', 'content')
                    )
                    if knowledge_items:
                        module_data['knowledge'] = knowledge_items
                    confirmed_modules.append(module_data)
                project_context['confirmed_modules'] = confirmed_modules
                logger.info('[AI理解] id=%s   已确认模块=%d 个', understanding_id, len(confirmed_modules))
            else:
                all_modules_qs = project.modules.filter(status='active').order_by('order', 'name')
                all_modules = []
                for m in all_modules_qs:
                    path_parts = []
                    current = m
                    while current:
                        path_parts.insert(0, current.name)
                        current = current.parent
                    module_path = '/'.join(path_parts)
                    module_data = {'path': module_path, 'description': m.description or ''}
                    knowledge_items = list(
                        ModuleKnowledge.objects.filter(module=m)
                        .order_by('-created_at')[:3]
                        .values('knowledge_type', 'content')
                    )
                    if knowledge_items:
                        module_data['knowledge'] = knowledge_items
                    all_modules.append(module_data)
                project_context['all_modules'] = all_modules
                logger.info('[AI理解] id=%s   项目模块树=%d 个', understanding_id, len(all_modules))

        # ⑤ 判断 Figma MCP 模式
        figma_fetch_mode = getattr(settings, 'FIGMA_FETCH_MODE', 'rest')
        use_mcp = False
        figma_url = None
        assets = instance.input_assets.all()
        if figma_fetch_mode in ('mcp', 'rest_mcp'):
            from apps.integrations.figma_service import is_figma_url
            for a in assets:
                url = a.batch_desc or ''
                if a.source_type == 'url_fetch' and is_figma_url(url):
                    use_mcp = True
                    figma_url = url
                    break

        # ⑥ 调用 AI API
        if use_mcp and figma_url:
            logger.info('[AI理解] id=%s ⑥ 调用 AI API (Figma MCP 模式)...', understanding_id)
            raw_result = _generate_with_figma_mcp(instance, figma_url, content, module_knowledge, related_reqs)
        else:
            logger.info('[AI理解] id=%s ⑥ 构建 prompt...', understanding_id)
            system, prompt = build_req_understanding_prompt(
                content=content,
                module_knowledge=module_knowledge,
                related_requirements=related_reqs,
                project_context=project_context,
            )
            total_len = len(system) + len(prompt)
            logger.info('[AI理解] id=%s   system=%d + prompt=%d = 总计%d 字符，调用 AI API...', understanding_id, len(system), len(prompt), total_len)
            raw_result = AIService.complete(prompt, system=system)
        logger.info('[AI理解] id=%s   AI 返回长度=%d 字符', understanding_id, len(raw_result))

        # ⑦ 解析 JSON
        logger.info('[AI理解] id=%s ⑦ 解析 JSON 结构...', understanding_id)
        structured = _extract_json_from_response(raw_result)
        features_count = len(structured.get('features', []))
        issues_count = len(structured.get('quality_issues', []))
        logger.info('[AI理解] id=%s   功能=%d 条, 质量问题=%d 条', understanding_id, features_count, issues_count)

        # ⑧ 保存结果
        quality_issues = structured.get('quality_issues', [])
        instance.ai_quality_issues = quality_issues

        features = structured.get('features', [])
        suggested_module_names = list(set(
            f.get('module_name') for f in features if f.get('module_name') and f.get('module_name') != '未知模块'
        ))
        instance.suggested_modules = suggested_module_names
        logger.info('[AI理解] id=%s   建议模块=%s', understanding_id, suggested_module_names)

        instance.ai_understanding_result = structured
        instance.ai_understanding = raw_result
        instance.status = 'done'
        instance.ai_reviewed = False
        instance.error_msg = None
        instance.save(update_fields=[
            'ai_understanding_result', 'ai_understanding', 'ai_quality_issues', 'suggested_modules',
            'status', 'ai_reviewed', 'error_msg', 'updated_at',
        ])
        logger.info('[AI理解] id=%s ⑧ 结果已保存', understanding_id)

        # ⑨ 后处理
        logger.info('[AI理解] id=%s ⑨ 更新模块知识...', understanding_id)
        _update_module_knowledge(instance, structured)
        logger.info('[AI理解] id=%s   创建需求关联...', understanding_id)
        _create_requirement_relations(instance, structured)

        logger.info('[AI理解] id=%s ── ✅ 完成', understanding_id)

    except Exception as exc:
        logger.error('[AI理解] id=%s ── ❌ 失败: %s', understanding_id, exc)
        instance.status = 'failed'
        instance.error_msg = str(exc)[:500]
        instance.save(update_fields=['status', 'error_msg', 'updated_at'])
        raise self.retry(exc=exc, countdown=10)


def _parse_with_figma_mcp(instance, figma_url: str):
    """
    Figma MCP 模式解析：调用 Claude API + Figma MCP tool，让 Claude 直接读取 Figma 内容并输出解析结果。
    """
    from apps.integrations.views import AIService
    import logging

    logger = logging.getLogger(__name__)
    logger.info('Figma MCP 模式解析：understanding_id=%s, url=%s', instance.id, figma_url)

    system = (
        '你是一个专业的产品需求分析师。你可以使用 Figma MCP 工具读取 Figma 文件内容。'
        '请读取指定 Figma 链接的完整内容，提取所有文本、表格和图片描述，'
        '以结构化 Markdown 格式输出。保持原始信息的完整性和逻辑顺序。'
    )
    prompt = (
        f'请使用 Figma MCP 工具读取以下 Figma 文件的完整内容，并以结构化 Markdown 格式输出解析结果：\n\n'
        f'Figma 链接：{figma_url}\n\n'
        f'要求：\n'
        f'1. 提取所有文本内容，保持层级结构\n'
        f'2. 对图片内容进行描述\n'
        f'3. 提取表格数据并以 Markdown 表格格式输出\n'
        f'4. 保持内容的视觉顺序（从上到下、从左到右）'
    )

    # 构建 Figma MCP tool 配置
    tools = [
        {
            'type': 'mcp',
            'server_label': 'figma',
            'server_url': 'https://figma.mcp.server',  # MCP Server URL
            'available_tools': ['read_figma_file', 'get_figma_data'],
        }
    ]

    # 通过 Claude API 调用（带 MCP tools）
    result = AIService.complete_with_mcp(prompt, tools=tools, system=system)

    instance.parsed_content = result
    instance.parsed_content_with_images = result
    instance.parse_status = 'done'
    instance.parse_error_msg = None
    instance.parse_reviewed = False
    instance.save(update_fields=[
        'parsed_content', 'parsed_content_with_images',
        'parse_status', 'parse_error_msg', 'parse_reviewed', 'updated_at',
    ])


def _generate_with_figma_mcp(instance, figma_url: str, content: str, module_knowledge: list, related_reqs: list):
    """
    Figma MCP 模式 AI 理解生成：调用 Claude API + Figma MCP tool 生成结构化 AI 理解。
    """
    from apps.integrations.views import AIService
    from apps.tasks.tasks.ai_prompts import build_req_understanding_prompt
    import logging

    logger = logging.getLogger(__name__)
    logger.info('Figma MCP 模式 AI 理解：understanding_id=%s, url=%s', instance.id, figma_url)

    system, prompt = build_req_understanding_prompt(
        content=content,
        module_knowledge=module_knowledge,
        related_requirements=related_reqs,
    )

    # 追加 Figma MCP 读取指令
    prompt += (
        f'\n\n---\n'
        f'补充：如需获取更详细的 Figma 内容，可使用 Figma MCP 工具读取：\n'
        f'Figma 链接：{figma_url}'
    )

    tools = [
        {
            'type': 'mcp',
            'server_label': 'figma',
            'server_url': 'https://figma.mcp.server',
            'available_tools': ['read_figma_file', 'get_figma_data'],
        }
    ]

    raw_result = AIService.complete_with_mcp(prompt, tools=tools, system=system)
    return raw_result


def _extract_json_from_response(raw: str) -> dict:
    """从 AI 响应中提取 JSON 结构。"""
    # 尝试提取 ```json ... ``` 块
    match = __import__('re').search(r'```json\s*([\s\S]+?)\s*```', raw)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # 直接尝试解析整体
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # 降级：返回原始文本包装
    return {'raw': raw, 'features': [], 'changes': {}, 'quality_issues': []}


def _update_module_knowledge(instance, structured: dict):
    """从 AI 理解结果中提取并更新模块知识。"""
    from apps.projects.models import ModuleKnowledge

    # 从 flat features 结构中提取
    all_features = structured.get('features', [])
    if not all_features:
        return

    # 按 module_name 分组
    module_features = {}
    for f in all_features:
        module_name = f.get('module_name', '未知模块')
        if module_name not in module_features:
            module_features[module_name] = []
        module_features[module_name].append(f)

    # 为每个模块创建知识
    for module_name, features in module_features.items():
        if module_name == '未知模块':
            continue

        # 尝试匹配数据库中的模块（简单匹配最后一级名称）
        module_name_last = module_name.split('/')[-1]
        from apps.projects.models import Module
        matched_module = Module.objects.filter(
            project=instance.requirement.project,
            name=module_name_last
        ).first()

        if not matched_module:
            continue

        # 提取核心功能模式作为模块知识
        core_features = [f for f in features if f.get('priority') == 'P0']
        if core_features:
            content = 'P0功能：' + '、'.join(f.get('name', '') for f in core_features if f.get('name'))
            ModuleKnowledge.objects.create(
                module=matched_module,
                knowledge_type='pattern',
                content=content,
                source_requirement=instance.requirement,
            )

    # 提取质量风险
    risks = [qi for qi in structured.get('quality_issues', []) if qi.get('type') == '风险']
    for risk in risks[:3]:
        # 尝试关联到具体模块
        feature_name = risk.get('feature_name')
        if feature_name:
            feature = next((f for f in all_features if f.get('name') == feature_name), None)
            if feature:
                module_name = feature.get('module_name', '')
                module_name_last = module_name.split('/')[-1]
                from apps.projects.models import Module
                matched_module = Module.objects.filter(
                    project=instance.requirement.project,
                    name=module_name_last
                ).first()
                if matched_module:
                    ModuleKnowledge.objects.create(
                        module=matched_module,
                        knowledge_type='risk',
                        content=risk.get('description', ''),
                        source_requirement=instance.requirement,
                    )


def _create_requirement_relations(instance, structured: dict):
    """基于 AI 推荐创建需求关联记录。"""
    from apps.projects.models import RequirementRelation
    related_ids = structured.get('related_requirement_ids', [])
    if not related_ids:
        return

    RequirementClass = instance.requirement.__class__
    for req_id in related_ids[:10]:
        try:
            target = RequirementClass.objects.get(requirement_id=req_id)
            RequirementRelation.objects.get_or_create(
                from_requirement=instance.requirement,
                to_requirement=target,
                relation_type='related',
                defaults={'confidence': 0.8, 'created_by_ai': True},
            )
        except RequirementClass.DoesNotExist:
            pass
