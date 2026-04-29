import os
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from .models import Requirement, SubRequirement, ChangeLog, AiInputAsset, AiUnderstanding, VALID_TRANSITIONS, TAG_CHOICES
from .serializers import (
    RequirementSerializer, SubRequirementSerializer, ChangeLogSerializer,
    AiInputAssetSerializer, AiUnderstandingSerializer,
    ParsedContentSerializer, AiUnderstandingReviewSerializer, DownstreamConsumptionSerializer,
)
from apps.integrations.webhook import notify_requirement_status_changed, notify_requirement_blocked

logger = logging.getLogger(__name__)


class RequirementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = RequirementSerializer

    def get_queryset(self):
        qs = Requirement.objects.all()
        # 默认不返回已归档
        include_archived = self.request.query_params.get('include_archived') == 'true'
        if not include_archived:
            qs = qs.filter(is_archived=False)
        # 多维筛选
        for field in ['iteration', 'project', 'module', 'status', 'priority', 'req_type', 'created_by']:
            val = self.request.query_params.get(field)
            if val:
                qs = qs.filter(**{f'{field}': val})
        # 负责人筛选（product_owner / dev_owner / test_owner）
        assignee = self.request.query_params.get('assignee')
        if assignee:
            qs = qs.filter(product_owner=assignee) | qs.filter(dev_owner=assignee) | qs.filter(test_owner=assignee)
        # 关键词搜索
        keyword = self.request.query_params.get('keyword')
        if keyword:
            qs = qs.filter(name__icontains=keyword) | qs.filter(description__icontains=keyword)
        # 排序支持，默认按更新时间降序
        ALLOWED_ORDERING = {'updated_at', '-updated_at', 'created_at', '-created_at', 'priority', '-priority'}
        ordering = self.request.query_params.get('ordering', '-updated_at')
        if ordering not in ALLOWED_ORDERING:
            ordering = '-updated_at'
        qs = qs.order_by(ordering)
        return qs.select_related('project', 'iteration', 'module', 'created_by', 'product_owner', 'dev_owner', 'test_owner')

    def perform_create(self, serializer):
        req_id = self.request.data.get('requirement_id', '').strip()
        if not req_id:
            from apps.requirements.models import Requirement
            last = Requirement.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            req_id = f'REQ-{next_num:04d}'
        serializer.save(created_by=self.request.user, requirement_id=req_id)

    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, pk=None):
        requirement = self.get_object()
        target_status = request.data.get('status')
        reject_reason = request.data.get('reject_reason', '').strip()

        if not target_status:
            return Response({'message': '目标状态不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        if not requirement.can_transition_to(target_status):
            return Response(
                {'message': f'不允许从"{requirement.get_status_display()}"流转到"{target_status}"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 驳回（待测试→开发中）必须填写原因
        is_rejection = (requirement.status == 'pending_test' and target_status == 'in_development')
        if is_rejection and not reject_reason:
            return Response({'message': '驳回原因不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            old_status = requirement.status
            requirement.status = target_status
            requirement.save(update_fields=['status', 'updated_at'])

            # 写入 status 变更记录
            ChangeLog.objects.create(
                target_type='requirement',
                target_id=requirement.id,
                field='status',
                old_value=old_status,
                new_value=target_status,
                changed_by=request.user,
            )
            # 驳回时额外写入 reject_reason 记录
            if is_rejection:
                ChangeLog.objects.create(
                    target_type='requirement',
                    target_id=requirement.id,
                    field='reject_reason',
                    old_value=None,
                    new_value=reject_reason,
                    changed_by=request.user,
                )

        # 异步发送企微通知（不阻塞响应）
        try:
            notify_requirement_status_changed(
                requirement, old_status, target_status,
                request.user.get_full_name() or request.user.username,
            )
        except Exception:
            pass

        # 状态流转自动拉取钩子（非阻塞，失败不影响流转）
        try:
            from apps.tasks.tasks.md_tasks import pull_req_md, pull_tech_md
            if old_status == 'pending_review' and target_status == 'pending_tech_review':
                if requirement.req_md_source and (requirement.req_md_source_url or requirement.req_md_source == 'gitlab'):
                    pull_req_md.delay(requirement.id)
            elif old_status == 'pending_tech_review' and target_status == 'pending_development':
                if requirement.tech_md_source:
                    pull_tech_md.delay(requirement.id)
        except Exception:
            pass

        return Response(RequirementSerializer(requirement).data)

    @action(detail=True, methods=['post'], url_path='confirm-modules')
    def confirm_modules(self, request, pk=None):
        """确认需求关联的模块（M2M）"""
        requirement = self.get_object()
        module_ids = request.data.get('module_ids', [])

        if not isinstance(module_ids, list):
            return Response({'message': 'module_ids 必须是数组'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.projects.models import Module
        modules = Module.objects.filter(id__in=module_ids, project=requirement.project)
        if modules.count() != len(module_ids):
            return Response({'message': '部分模块 ID 无效或不属于该项目'}, status=status.HTTP_400_BAD_REQUEST)

        requirement.modules.set(modules)
        return Response({
            'message': '模块确认成功',
            'modules': [{'id': m.id, 'name': m.name} for m in modules]
        })

    @action(detail=True, methods=['post'], url_path='upload-md')
    def upload_md(self, request, pk=None):
        requirement = self.get_object()
        md_type = request.data.get('type', 'req')  # 'req' or 'tech'
        content = request.data.get('content', '')
        if md_type == 'tech':
            requirement.tech_md = content
            requirement.save(update_fields=['tech_md', 'updated_at'])
        else:
            requirement.req_md = content
            requirement.save(update_fields=['req_md', 'updated_at'])
        return Response({'message': 'MD文档保存成功'})

    @action(detail=True, methods=['post'], url_path='block')
    def block(self, request, pk=None):
        requirement = self.get_object()
        if requirement.status != 'in_development':
            return Response({'message': '仅开发中状态可标记阻塞'}, status=status.HTTP_400_BAD_REQUEST)
        is_blocked = request.data.get('is_blocked', True)
        block_reason = request.data.get('block_reason', '').strip()
        old_val = requirement.is_blocked
        requirement.is_blocked = is_blocked
        requirement.block_reason = block_reason if is_blocked else None
        requirement.save(update_fields=['is_blocked', 'block_reason', 'updated_at'])
        ChangeLog.objects.create(
            target_type='requirement',
            target_id=requirement.id,
            field='is_blocked',
            old_value=str(old_val),
            new_value=str(is_blocked),
            changed_by=request.user,
        )
        # 发送企微通知
        if is_blocked:
            try:
                notify_requirement_blocked(
                    requirement,
                    block_reason,
                    request.user.get_full_name() or request.user.username,
                )
            except Exception:
                pass
        return Response(RequirementSerializer(requirement).data)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        requirement = self.get_object()
        if requirement.status != 'completed':
            return Response({'message': '仅已完成状态的需求可归档'}, status=status.HTTP_400_BAD_REQUEST)
        requirement.is_archived = True
        requirement.save(update_fields=['is_archived', 'updated_at'])
        return Response({'message': '需求已归档'})

    @action(detail=True, methods=['get'], url_path='changelog')
    def changelog(self, request, pk=None):
        requirement = self.get_object()
        logs = ChangeLog.objects.filter(target_type='requirement', target_id=requirement.id)
        return Response(ChangeLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['get', 'post'], url_path='sub-requirements')
    def sub_requirements(self, request, pk=None):
        requirement = self.get_object()
        if request.method == 'GET':
            subs = SubRequirement.objects.filter(requirement=requirement)
            return Response(SubRequirementSerializer(subs, many=True).data)
        serializer = SubRequirementSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(requirement=requirement)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='tag-choices')
    def tag_choices(self, request):
        return Response(TAG_CHOICES)

    @action(detail=True, methods=['post'], url_path='fetch-md')
    def fetch_md(self, request, pk=None):
        """从 URL / 文件上传 / GitLab / Figma 拉取内容，创建 AiInputAsset 记录"""
        from apps.tasks.tasks.document_parsers import (
            parse_pdf, parse_docx, parse_markdown_file,
            save_images_and_build_text, save_images_from_markdown,
        )
        import tempfile, uuid as uuid_lib

        requirement = self.get_object()
        source_type = request.data.get('source_type', '')
        understand_type = request.data.get('understand_type', '')
        source_ref = request.data.get('source_ref', '')
        uploaded_file = request.FILES.get('file')

        if understand_type not in ('req_md', 'ui_design', 'ui_design_web', 'ui_design_app', 'tech_md'):
            return Response({'detail': 'understand_type 无效'}, status=status.HTTP_400_BAD_REQUEST)

        text_content = ''
        batch_desc = ''
        source_files = []
        image_paths = []

        # 图片保存目录
        save_dir = os.path.join(
            settings.MEDIA_ROOT, 'requirements', str(requirement.id), understand_type, 'images'
        )

        if source_type == 'upload_file' and uploaded_file:
            batch_desc = uploaded_file.name
            # 保存原始文件
            source_files = save_uploaded_files(requirement.id, understand_type, [uploaded_file])
            uploaded_file.seek(0)
            ext = os.path.splitext(uploaded_file.name)[1].lower()

            if ext == '.pdf':
                # 写入临时文件供 PyMuPDF 使用
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                    tmp.write(uploaded_file.read())
                    tmp_path = tmp.name
                try:
                    result = parse_pdf(tmp_path)
                finally:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
                text_content, image_paths, _ = save_images_and_build_text(
                    result['text'], result['images'], save_dir
                )
            elif ext in ('.docx', '.doc'):
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    tmp.write(uploaded_file.read())
                    tmp_path = tmp.name
                try:
                    result = parse_docx(tmp_path)
                finally:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
                text_content, image_paths, _ = save_images_and_build_text(
                    result['text'], result['images'], save_dir
                )
            elif ext in ('.md', '.markdown', '.txt'):
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    tmp.write(uploaded_file.read())
                    tmp_path = tmp.name
                try:
                    result = parse_markdown_file(tmp_path)
                finally:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
                text_content, image_paths, _ = save_images_from_markdown(
                    result['text'], result['images'], save_dir
                )
            else:
                uploaded_file.seek(0)
                text_content = uploaded_file.read().decode('utf-8', errors='replace')

        elif source_type == 'url_fetch' and source_ref:
            # 先创建记录（text_content 为空），再异步抓取内容
            batch_desc = source_ref
            asset = AiInputAsset.objects.create(
                requirement=requirement,
                understand_type=understand_type,
                source_type=source_type,
                batch_desc=batch_desc[:200] if batch_desc else '',
                file_paths={'source_files': [], 'images': []},
                text_content=None,
                created_by=request.user,
            )
            from apps.tasks.tasks.md_tasks import fetch_asset_content
            fetch_asset_content.delay(asset.id)
            return Response(AiInputAssetSerializer(asset).data, status=status.HTTP_201_CREATED)

        elif source_type == 'screenshot_input':
            # 多条目截图输入：前端传来 images[] 图片文件 + text_content 文字描述（含[图片N]占位符）
            from django.utils.timezone import localtime, now
            images = request.FILES.getlist('images')
            raw_text = request.data.get('text_content', '') or ''
            if not images and not raw_text.strip():
                return Response({'detail': '请至少提供截图或文字描述'}, status=status.HTTP_400_BAD_REQUEST)
            batch_desc = f'截图输入_{localtime(now()).strftime("%Y%m%d_%H%M%S")}'
            if images:
                image_paths = save_uploaded_files(requirement.id, understand_type, images)
            text_content = raw_text or None

        elif source_type == 'gitlab_pull':
            file_path = request.data.get('gitlab_path', '')
            branch = request.data.get('gitlab_branch', 'main')
            try:
                from apps.tasks.tasks.md_tasks import _fetch_gitlab_content
                content, commit_id = _fetch_gitlab_content(requirement, file_path, branch)
                if understand_type == 'tech_md':
                    requirement.tech_md_gitlab_path = file_path
                    requirement.tech_md_gitlab_branch = branch
                    requirement.tech_md_gitlab_commitid = commit_id
                    requirement.save(update_fields=['tech_md_gitlab_path', 'tech_md_gitlab_branch', 'tech_md_gitlab_commitid', 'updated_at'])
                batch_desc = f'{file_path}@{branch}#{commit_id}'
                text_content = content
            except Exception as e:
                return Response({'detail': f'GitLab 拉取失败：{e}'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'detail': 'source_type 无效或缺少必要参数'}, status=status.HTTP_400_BAD_REQUEST)

        asset = AiInputAsset.objects.create(
            requirement=requirement,
            understand_type=understand_type,
            source_type=source_type,
            batch_desc=batch_desc[:200] if batch_desc else '',
            file_paths={'source_files': source_files, 'images': image_paths},
            text_content=text_content or None,
            created_by=request.user,
        )
        return Response(AiInputAssetSerializer(asset).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='save-conversation')
    def save_conversation(self, request, pk=None):
        """保存 AI 对话结果为 AiInputAsset 素材"""
        from datetime import datetime
        requirement = self.get_object()
        understand_type = request.data.get('understand_type', '') or request.POST.get('understand_type', '')
        conversation_history = request.data.get('conversation_history', '') or request.POST.get('conversation_history', '')
        images = request.FILES.getlist('images')

        if understand_type not in ('req_md', 'ui_design', 'ui_design_web', 'ui_design_app', 'tech_md'):
            return Response({'detail': 'understand_type 无效'}, status=status.HTTP_400_BAD_REQUEST)

        # 保存截图，并在对话历史中插入占位符
        image_paths = []
        if images:
            image_paths = save_uploaded_files(requirement.id, understand_type, images)

        # 对话历史中 [图片N] 占位符已由前端生成，图片按顺序对应 image_paths
        from django.utils.timezone import localtime, now
        batch_desc = f'AI对话_{localtime(now()).strftime("%Y%m%d_%H%M%S")}'

        asset = AiInputAsset.objects.create(
            requirement=requirement,
            understand_type=understand_type,
            source_type='ai_conversation',
            batch_desc=batch_desc,
            file_paths={'source_files': [], 'images': image_paths},
            text_content=conversation_history or None,
            created_by=request.user,
        )
        return Response(AiInputAssetSerializer(asset).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='trigger-generate')
    def trigger_generate(self, request, pk=None):
        """手动触发 AI 理解生成（针对 pending 状态的记录）"""
        from apps.tasks.tasks.ai_tasks import generate_ai_understanding
        understanding_id = request.data.get('understanding_id')
        if not understanding_id:
            return Response({'detail': 'understanding_id 必填'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            understanding = AiUnderstanding.objects.get(id=understanding_id, requirement_id=pk)
        except AiUnderstanding.DoesNotExist:
            return Response({'detail': '记录不存在'}, status=status.HTTP_404_NOT_FOUND)
        if understanding.status not in ('pending', 'failed'):
            return Response({'detail': '只有待生成或失败状态才能触发'}, status=status.HTTP_400_BAD_REQUEST)
        understanding.status = 'pending'
        understanding.error_msg = None
        understanding.save(update_fields=['status', 'error_msg', 'updated_at'])
        generate_ai_understanding.delay(understanding.id)
        return Response(AiUnderstandingSerializer(understanding).data)


import os
from utils.file_storage import save_uploaded_files, delete_stored_files


# Deprecated: use utils.file_storage.save_uploaded_files instead
def _save_uploaded_files(requirement_id, understand_type, files):
    """保存上传文件（兼容旧调用，实际调用统一工具）"""
    return save_uploaded_files(requirement_id, understand_type, files)



class AiInputAssetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AiInputAssetSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = AiInputAsset.objects.all()
        req_id = self.request.query_params.get('requirement')
        understand_type = self.request.query_params.get('type')
        if req_id:
            qs = qs.filter(requirement_id=req_id)
        if understand_type:
            qs = qs.filter(understand_type=understand_type)
        return qs.select_related('created_by').prefetch_related('ai_understandings').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """支持多图文件上传"""
        images = request.FILES.getlist('images')
        requirement_id = request.data.get('requirement')
        understand_type = request.data.get('understand_type', '')
        file_paths = []
        if images:
            if len(images) > 10:
                return Response({'detail': '每批次最多上传10张图片'}, status=status.HTTP_400_BAD_REQUEST)
            file_paths = _save_uploaded_files(requirement_id, understand_type, images)

        data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
        data['file_paths'] = file_paths
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """支持替换图片"""
        instance = self.get_object()
        images = request.FILES.getlist('images')
        data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
        if images:
            # 删除旧文件
            delete_stored_files(instance.file_paths)
            data['file_paths'] = _save_uploaded_files(instance.requirement_id, instance.understand_type, images)
        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def perform_destroy(self, instance):
        # 级联删除关联的 AiUnderstanding 记录
        instance.ai_understandings.all().delete()
        delete_stored_files(instance.file_paths)
        instance.delete()

    @action(detail=True, methods=['patch'], url_path='select')
    def select(self, request, pk=None):
        """选为最优素材：同类型其他记录取消选中"""
        instance = self.get_object()
        with transaction.atomic():
            AiInputAsset.objects.filter(
                requirement=instance.requirement,
                understand_type=instance.understand_type,
                is_selected=True,
            ).exclude(id=instance.id).update(is_selected=False)
            instance.is_selected = True
            instance.save(update_fields=['is_selected', 'updated_at'])
        return Response(AiInputAssetSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='refetch')
    def refetch(self, request, pk=None):
        """重新解析/抓取内容，支持 upload_file 和 url_fetch"""
        from apps.tasks.tasks.document_parsers import (
            parse_url, parse_pdf, parse_docx, parse_markdown_file,
            save_images_from_markdown, save_images_and_build_text,
        )
        instance = self.get_object()
        save_dir = os.path.join(
            settings.MEDIA_ROOT, 'requirements', str(instance.requirement_id),
            instance.understand_type, 'images'
        )

        try:
            if instance.source_type == 'upload_file':
                from utils.file_storage import resolve_file_path
                fp = instance.file_paths if isinstance(instance.file_paths, dict) else {}
                source_files = fp.get('source_files', [])
                if not source_files:
                    return Response({'detail': '未找到原始上传文件'}, status=status.HTTP_400_BAD_REQUEST)
                file_path = resolve_file_path(source_files[0])
                if not os.path.exists(file_path):
                    return Response({'detail': f'原始文件不存在：{source_files[0]}'}, status=status.HTTP_400_BAD_REQUEST)
                ext = os.path.splitext(file_path)[1].lower()
                if ext == '.pdf':
                    result = parse_pdf(file_path)
                    text_content, image_paths, _ = save_images_and_build_text(result['text'], result['images'], save_dir)
                elif ext in ('.docx', '.doc'):
                    result = parse_docx(file_path)
                    text_content, image_paths, _ = save_images_and_build_text(result['text'], result['images'], save_dir)
                elif ext in ('.md', '.markdown', '.txt'):
                    result = parse_markdown_file(file_path)
                    text_content, image_paths, _ = save_images_from_markdown(result['text'], result['images'], save_dir)
                else:
                    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                        text_content = f.read()
                    image_paths = []
                instance.text_content = text_content
                instance.file_paths = {'source_files': source_files, 'images': image_paths}
                instance.save(update_fields=['text_content', 'file_paths', 'updated_at'])
                return Response(AiInputAssetSerializer(instance).data)

            elif instance.source_type == 'url_fetch':
                from apps.integrations.figma_service import is_figma_url, fetch_figma_content
                url = instance.batch_desc or ''
                if not url:
                    return Response({'detail': '来源 URL 为空'}, status=status.HTTP_400_BAD_REQUEST)
                if is_figma_url(url):
                    result = fetch_figma_content(url, str(instance.requirement_id), instance.understand_type)
                else:
                    result = parse_url(url)
                text_content, image_paths, _ = save_images_from_markdown(result['text'], result['images'], save_dir)
                instance.text_content = text_content
                instance.file_paths = {'source_files': [], 'images': image_paths}
                instance.save(update_fields=['text_content', 'file_paths', 'updated_at'])
                return Response(AiInputAssetSerializer(instance).data)

            else:
                return Response({'detail': f'不支持的来源类型：{instance.source_type}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': f'解析失败：{e}'}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['post'], url_path='trigger-parse')
    def trigger_parse(self, request, pk=None):
        """对该素材批次创建新 AiUnderstanding 并触发解析任务"""
        from apps.tasks.tasks.ai_tasks import parse_document_task
        instance = self.get_object()
        understanding = AiUnderstanding.objects.create(
            requirement=instance.requirement,
            understand_type=instance.understand_type,
            source_type='',  # deprecated field, keep empty
            parse_status='pending',
            status='pending',
            created_by=request.user,
        )
        understanding.input_assets.add(instance)
        parse_document_task.delay(understanding.id)
        return Response(AiInputAssetSerializer(instance).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='trigger-generate')
    def trigger_generate(self, request, pk=None):
        """对该素材批次创建新 AiUnderstanding 并直接触发理解生成（跳过解析）"""
        from apps.tasks.tasks.ai_tasks import generate_ai_understanding
        instance = self.get_object()
        understanding = AiUnderstanding.objects.create(
            requirement=instance.requirement,
            understand_type=instance.understand_type,
            source_type='',  # deprecated field, keep empty
            parse_status='done',
            status='pending',
            created_by=request.user,
        )
        understanding.input_assets.add(instance)
        generate_ai_understanding.delay(understanding.id)
        return Response(AiInputAssetSerializer(instance).data, status=status.HTTP_201_CREATED)


class AiUnderstandingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AiUnderstandingSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = AiUnderstanding.objects.all()
        req_id = self.request.query_params.get('requirement')
        understand_type = self.request.query_params.get('type')
        if req_id:
            qs = qs.filter(requirement_id=req_id)
        if understand_type:
            qs = qs.filter(understand_type=understand_type)
        return qs.select_related('created_by', 'requirement').prefetch_related('input_assets').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['patch'], url_path='select')
    def select(self, request, pk=None):
        """选为最优理解：同类型其他记录取消选中，并写入 Requirement.req_understanding"""
        instance = self.get_object()
        with transaction.atomic():
            # 取消同类型其他记录
            AiUnderstanding.objects.filter(
                requirement=instance.requirement,
                understand_type=instance.understand_type,
                is_selected=True,
            ).exclude(id=instance.id).update(is_selected=False)
            instance.is_selected = True
            instance.save(update_fields=['is_selected', 'updated_at'])
            # 写入 Requirement.req_understanding（仅 req_md 类型）
            if instance.understand_type == 'req_md':
                instance.requirement.req_understanding = instance.ai_understanding
                instance.requirement.save(update_fields=['req_understanding', 'updated_at'])
        return Response(AiUnderstandingSerializer(instance).data)

    @action(detail=True, methods=['patch'], url_path='deselect')
    def deselect(self, request, pk=None):
        """取消选中"""
        instance = self.get_object()
        instance.is_selected = False
        instance.save(update_fields=['is_selected', 'updated_at'])
        return Response(AiUnderstandingSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='refetch')
    def refetch(self, request, pk=None):
        """重新抓取 URL 内容，更新关联 AiInputAsset.text_content"""
        from apps.tasks.tasks.document_parsers import parse_url, save_images_from_markdown
        from apps.integrations.figma_service import is_figma_url, fetch_figma_content
        instance = self.get_object()
        if instance.source_type != 'url_fetch':
            return Response({'detail': '只有 URL 来源的记录才能重新抓取'}, status=status.HTTP_400_BAD_REQUEST)

        asset = instance.input_assets.filter(source_type='url_fetch').order_by('-created_at').first()
        url = (asset.batch_desc if asset else None) or instance.source_ref
        if not url:
            return Response({'detail': '来源 URL 为空'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if is_figma_url(url):
                result = fetch_figma_content(url, str(instance.requirement_id), instance.understand_type)
            else:
                result = parse_url(url)
            save_dir = os.path.join(
                settings.MEDIA_ROOT, 'requirements', str(instance.requirement_id),
                instance.understand_type, 'images'
            )
            text_content, image_paths, _ = save_images_from_markdown(
                result['text'], result['images'], save_dir
            )
            if asset:
                asset.text_content = text_content
                asset.file_paths = {'source_files': [], 'images': image_paths}
                asset.save(update_fields=['text_content', 'file_paths', 'updated_at'])
            return Response({'text_content': text_content})
        except Exception as e:
            return Response({'detail': f'抓取失败：{e}'}, status=status.HTTP_400_BAD_REQUEST)

    # ─── 解析审核端点 ─────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='trigger-parse')
    def trigger_parse(self, request, pk=None):
        """手动触发文档解析任务"""
        from apps.tasks.tasks.ai_tasks import parse_document_task
        instance = self.get_object()
        instance.parse_status = 'pending'
        instance.parse_error_msg = ''
        instance.save(update_fields=['parse_status', 'parse_error_msg'])
        parse_document_task.delay(instance.id)
        return Response({'detail': '解析任务已触发'})

    @action(detail=True, methods=['post'], url_path='trigger-generate')
    def trigger_generate(self, request, pk=None):
        """手动触发 AI 理解生成任务"""
        from apps.tasks.tasks.ai_tasks import generate_structured_ai_understanding
        instance = self.get_object()
        instance.status = 'pending'
        instance.error_msg = ''
        instance.save(update_fields=['status', 'error_msg'])
        generate_structured_ai_understanding.delay(instance.id)
        return Response({'detail': '理解生成任务已触发'})

    @action(detail=True, methods=['get'], url_path='parse-review')
    def parse_review(self, request, pk=None):
        """获取解析内容供审核"""
        instance = self.get_object()
        return Response(ParsedContentSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='parse-review/approve')
    def parse_review_approve(self, request, pk=None):
        """批准解析内容，触发 AI 理解任务"""
        instance = self.get_object()
        if instance.parse_status != 'done':
            return Response({'detail': '解析尚未完成'}, status=status.HTTP_400_BAD_REQUEST)
        instance.parse_reviewed = True
        instance.parse_reviewed_by = request.user
        instance.parse_reviewed_at = timezone.now()
        instance.save(update_fields=['parse_reviewed', 'parse_reviewed_by', 'parse_reviewed_at', 'updated_at'])
        # 触发 AI 理解任务
        from apps.tasks.tasks.ai_tasks import generate_structured_ai_understanding
        generate_structured_ai_understanding.delay(instance.id)
        return Response(ParsedContentSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='parse-review/reject')
    def parse_review_reject(self, request, pk=None):
        """拒绝解析内容，重置状态以便重新解析"""
        instance = self.get_object()
        instance.parse_status = 'pending'
        instance.parse_reviewed = False
        instance.parse_error_msg = request.data.get('reason', '')
        instance.save(update_fields=['parse_status', 'parse_reviewed', 'parse_error_msg', 'updated_at'])
        # 触发重新解析
        from apps.tasks.tasks.ai_tasks import parse_document_task
        parse_document_task.delay(instance.id)
        return Response(ParsedContentSerializer(instance).data)

    # ─── AI 理解审核端点 ──────────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='understanding-review')
    def understanding_review(self, request, pk=None):
        """获取 AI 理解供审核"""
        instance = self.get_object()
        return Response(AiUnderstandingReviewSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='understanding-review/approve')
    def understanding_review_approve(self, request, pk=None):
        """批准 AI 理解"""
        instance = self.get_object()
        if instance.status != 'done':
            return Response({'detail': 'AI 理解尚未完成'}, status=status.HTTP_400_BAD_REQUEST)
        instance.ai_reviewed = True
        instance.ai_reviewed_by = request.user
        instance.ai_reviewed_at = timezone.now()
        instance.save(update_fields=['ai_reviewed', 'ai_reviewed_by', 'ai_reviewed_at', 'updated_at'])
        return Response(AiUnderstandingReviewSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='understanding-review/reject')
    def understanding_review_reject(self, request, pk=None):
        """拒绝 AI 理解，触发重新生成"""
        instance = self.get_object()
        instance.status = 'pending'
        instance.ai_reviewed = False
        instance.error_msg = request.data.get('reason', '')
        instance.save(update_fields=['status', 'ai_reviewed', 'error_msg', 'updated_at'])
        from apps.tasks.tasks.ai_tasks import generate_structured_ai_understanding
        generate_structured_ai_understanding.delay(instance.id)
        return Response(AiUnderstandingReviewSerializer(instance).data)

    # ─── 下游消费端点 ─────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='understanding')
    def downstream_understanding(self, request, pk=None):
        """供下游 AI 代理消费的结构化理解（需已审核）"""
        instance = self.get_object()
        if not instance.ai_reviewed:
            return Response({'detail': 'AI 理解尚未审核批准'}, status=status.HTTP_403_FORBIDDEN)
        fmt = request.query_params.get('format', 'full')
        if fmt == 'minimal':
            data = {
                'features': (instance.ai_understanding_result or {}).get('features', []),
                'acceptance_criteria': (instance.ai_understanding_result or {}).get('acceptance_criteria', []),
            }
            return Response(data)
        return Response(DownstreamConsumptionSerializer(instance).data)
