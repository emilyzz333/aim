from rest_framework import serializers
from django.conf import settings
from .models import Requirement, SubRequirement, ChangeLog, AiInputAsset, AiUnderstanding
from apps.users.models import User
from apps.projects.models import Project, Module, ModuleKnowledge, RequirementRelation


class AiInputAssetSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    understandings = serializers.SerializerMethodField()

    def get_understandings(self, obj):
        """返回关联的 AiUnderstanding 完整摘要，最优优先，其余按更新时间倒序"""
        qs = obj.ai_understandings.all().order_by('-is_selected', '-updated_at')
        return [
            {
                'id': u.id,
                'status': u.status,
                'status_display': u.get_status_display(),
                'parse_status': u.parse_status,
                'parse_status_display': u.get_parse_status_display(),
                'is_selected': u.is_selected,
                'ai_understanding': u.ai_understanding,
                'ai_understanding_result': u.ai_understanding_result,
                'ai_quality_issues': u.ai_quality_issues,
                'suggested_modules': u.suggested_modules,
                'parsed_content': u.parsed_content,
                'parsed_content_with_images': u.parsed_content_with_images,
                'parse_reviewed': u.parse_reviewed,
                'ai_reviewed': u.ai_reviewed,
                'error_msg': u.error_msg,
                'parse_error_msg': u.parse_error_msg,
                'note': u.note,
                'updated_at': u.updated_at.isoformat() if u.updated_at else None,
            }
            for u in qs
        ]

    class Meta:
        model = AiInputAsset
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class AiUnderstandingSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    understand_type_display = serializers.CharField(source='get_understand_type_display', read_only=True)
    input_assets_count = serializers.IntegerField(source='input_assets.count', read_only=True)
    input_assets_detail = AiInputAssetSerializer(source='input_assets', many=True, read_only=True)
    asset_batch_desc = serializers.SerializerMethodField()

    def get_asset_batch_desc(self, obj):
        asset = obj.input_assets.order_by('-created_at').first()
        return asset.batch_desc if asset else (obj.source_ref or '')

    class Meta:
        model = AiUnderstanding
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class SubRequirementSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.username', read_only=True)

    class Meta:
        model = SubRequirement
        fields = '__all__'
        read_only_fields = ['requirement']


class ChangeLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.username', read_only=True)

    class Meta:
        model = ChangeLog
        fields = '__all__'


class RequirementSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, default='')
    iteration_name = serializers.CharField(source='iteration.name', read_only=True)
    module_name = serializers.CharField(source='module.name', read_only=True)
    product_owner_name = serializers.CharField(source='product_owner.username', read_only=True)
    dev_owner_name = serializers.CharField(source='dev_owner.username', read_only=True)
    test_owner_name = serializers.CharField(source='test_owner.username', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    requirement_id = serializers.CharField(required=False, allow_blank=True)
    test_plan_count = serializers.SerializerMethodField()
    test_case_count = serializers.SerializerMethodField()
    developer_names = serializers.SerializerMethodField()
    tester_names = serializers.SerializerMethodField()
    req_md_source_type = serializers.SerializerMethodField()
    tech_md_source_type = serializers.SerializerMethodField()
    ui_design_web_source_type = serializers.SerializerMethodField()
    ui_design_app_source_type = serializers.SerializerMethodField()
    tapd_url = serializers.SerializerMethodField()
    tapd_short_id = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    parent_requirement_id = serializers.CharField(source='parent.requirement_id', read_only=True, default=None)
    children_requirements = serializers.SerializerMethodField()

    class Meta:
        model = Requirement
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_test_plan_count(self, obj):
        return obj.test_plans.count()

    def get_test_case_count(self, obj):
        return obj.test_cases.count()

    def get_developer_names(self, obj):
        if not obj.developer:
            return []
        users = User.objects.filter(id__in=obj.developer).values('id', 'username')
        return list(users)

    def get_tester_names(self, obj):
        if not obj.tester:
            return []
        users = User.objects.filter(id__in=obj.tester).values('id', 'username')
        return list(users)

    def _get_latest_source_type(self, obj, understand_type):
        ai = obj.ai_input_assets.filter(understand_type=understand_type).order_by('-created_at').first()
        if ai:
            return ai.source_type
        # Fallback: check AiUnderstanding records (for data created before AiInputAsset existed)
        understanding = obj.ai_understandings.filter(understand_type=understand_type).order_by('-created_at').first()
        if understanding:
            return understanding.source_type
        return None

    def get_req_md_source_type(self, obj):
        return self._get_latest_source_type(obj, 'req_md')

    def get_tech_md_source_type(self, obj):
        return self._get_latest_source_type(obj, 'tech_md')

    def get_ui_design_web_source_type(self, obj):
        # Check ui_design_web first, fallback to generic ui_design
        result = self._get_latest_source_type(obj, 'ui_design_web')
        if not result:
            result = self._get_latest_source_type(obj, 'ui_design')
        return result

    def get_ui_design_app_source_type(self, obj):
        result = self._get_latest_source_type(obj, 'ui_design_app')
        return result

    def get_tapd_url(self, obj):
        if obj.source != 'tapd' or not obj.source_id:
            return None
        workspace_id = getattr(settings, 'TAPD_WORKSPACE_ID', '')
        if not workspace_id:
            return None
        if obj.req_type == 'task':
            return f'https://www.tapd.cn/{workspace_id}/prong/tasks/view/{obj.source_id}'
        return f'https://www.tapd.cn/{workspace_id}/prong/stories/view/{obj.source_id}'

    def get_tapd_short_id(self, obj):
        if obj.source != 'tapd' or not obj.source_id:
            return None
        workspace_id = getattr(settings, 'TAPD_WORKSPACE_ID', '')
        if not workspace_id:
            return None
        sid = obj.source_id
        idx = sid.find(workspace_id)
        if idx >= 0:
            return sid[idx + len(workspace_id):].lstrip('0') or '0'
        return sid

    def get_children_requirements(self, obj):
        children = obj.children.all().values(
            'id', 'requirement_id', 'name', 'status', 'priority'
        )
        return list(children)


# ─── 解析审核序列化器 ─────────────────────────────────────────────────────────

class ParsedContentSerializer(serializers.ModelSerializer):
    parse_status_display = serializers.CharField(source='get_parse_status_display', read_only=True)
    parse_reviewed_by_name = serializers.CharField(source='parse_reviewed_by.username', read_only=True)

    class Meta:
        model = AiUnderstanding
        fields = [
            'id', 'requirement', 'understand_type', 'source_type', 'source_ref',
            'parse_status', 'parse_status_display', 'parse_error_msg',
            'parsed_content', 'parsed_content_with_images',
            'parse_reviewed', 'parse_reviewed_by', 'parse_reviewed_by_name', 'parse_reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['parse_reviewed_by', 'parse_reviewed_at', 'created_at', 'updated_at']


# ─── AI 理解审核序列化器 ──────────────────────────────────────────────────────

class AiUnderstandingReviewSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    ai_reviewed_by_name = serializers.CharField(source='ai_reviewed_by.username', read_only=True)

    class Meta:
        model = AiUnderstanding
        fields = [
            'id', 'requirement', 'understand_type', 'source_type',
            'status', 'status_display', 'error_msg',
            'ai_understanding', 'ai_understanding_result', 'ai_quality_issues',
            'ai_reviewed', 'ai_reviewed_by', 'ai_reviewed_by_name', 'ai_reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['ai_reviewed_by', 'ai_reviewed_at', 'created_at', 'updated_at']


# ─── 下游消费序列化器 ─────────────────────────────────────────────────────────

class ModuleKnowledgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleKnowledge
        fields = ['id', 'knowledge_type', 'content', 'created_at']


class RequirementRelationSerializer(serializers.ModelSerializer):
    to_requirement_id = serializers.CharField(source='to_requirement.requirement_id', read_only=True)
    to_requirement_name = serializers.CharField(source='to_requirement.name', read_only=True)

    class Meta:
        model = RequirementRelation
        fields = ['id', 'to_requirement', 'to_requirement_id', 'to_requirement_name',
                  'relation_type', 'confidence', 'created_by_ai', 'created_at']


class DownstreamConsumptionSerializer(serializers.ModelSerializer):
    """供下游 AI 代理消费的完整理解序列化器"""
    module_context = serializers.SerializerMethodField()
    related_requirements = serializers.SerializerMethodField()
    reviewer_name = serializers.CharField(source='ai_reviewed_by.username', read_only=True)

    class Meta:
        model = AiUnderstanding
        fields = [
            'id', 'requirement_id',
            'ai_understanding_result', 'ai_quality_issues',
            'ai_reviewed', 'reviewer_name', 'ai_reviewed_at',
            'module_context', 'related_requirements',
            'updated_at',
        ]

    def get_module_context(self, obj):
        module = obj.requirement.module
        if not module:
            return []
        qs = ModuleKnowledge.objects.filter(module=module).order_by('-created_at')[:10]
        return ModuleKnowledgeSerializer(qs, many=True).data

    def get_related_requirements(self, obj):
        qs = RequirementRelation.objects.filter(
            from_requirement=obj.requirement
        ).select_related('to_requirement').order_by('-confidence')[:10]
        return RequirementRelationSerializer(qs, many=True).data
