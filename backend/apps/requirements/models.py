from django.db import models
from apps.users.models import User
from apps.projects.models import Project, Module
from apps.iterations.models import Iteration

STATUS_CHOICES = [
    ('pending_review', '待评审'),
    ('pending_tech_review', '待技评'),
    ('pending_development', '待开发'),
    ('in_development', '开发中'),
    ('resolved', '已修复'),
    ('pending_test', '待测试'),
    ('in_testing', '测试中'),
    ('pending_acceptance', '待验收'),
    ('pending_release', '待上线'),
    ('pending_regression', '待回归'),
    ('completed', '已完成'),
    ('rejected', '已拒绝'),
    ('suspended', '挂起'),
    ('closed', '关闭'),
]

VALID_TRANSITIONS = {
    'pending_review': ['pending_tech_review', 'rejected', 'closed'],
    'pending_tech_review': ['pending_development', 'rejected', 'closed'],
    'pending_development': ['in_development', 'closed'],
    'in_development': ['resolved', 'pending_test', 'closed'],
    'resolved': ['pending_test', 'in_development', 'closed'],
    'pending_test': ['in_testing', 'in_development', 'closed'],  # in_development = 驳回
    'in_testing': ['pending_acceptance', 'closed'],
    'pending_acceptance': ['pending_release', 'closed'],
    'pending_release': ['pending_regression', 'closed'],
    'pending_regression': ['completed', 'closed'],
    'completed': ['closed'],
    'rejected': ['pending_review', 'closed'],
    'suspended': ['pending_review', 'in_development', 'closed'],
    'closed': [],
}

PRIORITY_CHOICES = [
    ('low', '低'),
    ('medium', '中'),
    ('high', '高'),
    ('urgent', '紧急'),
]

REQ_TYPE_CHOICES = [
    ('product', '产品需求'),
    ('technical', '技术需求'),
    ('ui', 'UI设计'),
    ('task', '任务'),
    ('bug', '缺陷'),
]

SOURCE_CHOICES = [
    ('sys', '本系统创建'),
    ('tapd', 'TAPD'),
    ('jira', 'Jira'),
]


TAG_CHOICES = [
    '需求变更',
    '临时插入',
    '设计延期',
    '提测延期',
    '提测质量差',
    'bug阻塞',
    'bug收敛差',
    '上线延期',
    '流程异常',
]


class Requirement(models.Model):
    requirement_id = models.CharField(max_length=100, unique=True, verbose_name='需求编号')
    name = models.CharField(max_length=200, verbose_name='需求名称')

    # 来源平台相关字段
    source = models.CharField(max_length=50, default='sys', choices=SOURCE_CHOICES, verbose_name='来源')
    source_id = models.CharField(max_length=200, null=True, blank=True, verbose_name='来源平台ID', help_text='TAPD Story ID / Jira Issue Key 等')
    source_created_at = models.DateTimeField(null=True, blank=True, verbose_name='来源平台创建时间')
    source_updated_at = models.DateTimeField(null=True, blank=True, verbose_name='来源平台更新时间')

    # 父子关系
    parent = models.ForeignKey('self', on_delete=models.CASCADE, blank=True, null=True, related_name='children', verbose_name='父需求')

    iteration = models.ForeignKey(Iteration, on_delete=models.SET_NULL, blank=True, null=True, related_name='requirements', verbose_name='所属迭代')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, blank=True, null=True, related_name='requirements', verbose_name='所属项目')
    module = models.ForeignKey(Module, on_delete=models.SET_NULL, blank=True, null=True, related_name='requirements', verbose_name='关联模块')
    modules = models.ManyToManyField(Module, blank=True, related_name='multi_requirements', verbose_name='关联模块（多）')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending_review', verbose_name='状态')
    priority = models.CharField(max_length=50, choices=PRIORITY_CHOICES, default='medium', verbose_name='优先级')
    req_type = models.CharField(max_length=50, choices=REQ_TYPE_CHOICES, default='product', verbose_name='需求类型')
    description = models.TextField(blank=True, null=True, verbose_name='详细描述')
    req_md = models.TextField(blank=True, null=True, verbose_name='需求MD')
    tech_md = models.TextField(blank=True, null=True, verbose_name='技术MD')
    ui_design_web = models.URLField(blank=True, null=True, verbose_name='UI设计稿Web链接')
    ui_design_app = models.URLField(blank=True, null=True, verbose_name='UI设计稿App链接')
    # MD 来源配置
    req_md_source = models.CharField(max_length=20, blank=True, null=True, verbose_name='需求MD来源',
                                     help_text='manual/upload/url/gitlab')
    req_md_source_url = models.TextField(blank=True, null=True, verbose_name='需求MD来源URL')
    tech_md_source = models.CharField(max_length=20, blank=True, null=True, verbose_name='技术MD来源',
                                      help_text='manual/upload/url/gitlab')
    tech_md_source_url = models.TextField(blank=True, null=True, verbose_name='技术MD来源URL')
    tech_md_gitlab_path = models.CharField(max_length=500, blank=True, null=True, verbose_name='技术MD GitLab路径')
    tech_md_gitlab_branch = models.CharField(max_length=200, blank=True, null=True, verbose_name='技术MD GitLab分支')
    tech_md_gitlab_commitid = models.CharField(max_length=100, blank=True, null=True, verbose_name='技术MD GitLab CommitID')
    # 最优 AI 理解（由选优操作写入）
    req_understanding = models.TextField(blank=True, null=True, verbose_name='最优AI需求理解')
    # JSON 多值字段
    gitlab_branch = models.JSONField(default=list, blank=True, verbose_name='GitLab分支')
    commit_id = models.JSONField(default=list, blank=True, verbose_name='Commit ID')
    tags = models.JSONField(default=list, blank=True, verbose_name='标签')
    # 人员（支持多人：JSON存ID列表）
    product_owner = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='product_requirements', verbose_name='产品人员')
    developer = models.JSONField(default=list, blank=True, verbose_name='开发人员')
    tester = models.JSONField(default=list, blank=True, verbose_name='测试人员')
    dev_owner = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='dev_owned_requirements', verbose_name='开发负责人')
    test_owner = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='test_owned_requirements', verbose_name='测试负责人')
    # 时间节点
    tech_review_time = models.DateTimeField(blank=True, null=True, verbose_name='技评时间')
    test_submit_time = models.DateTimeField(blank=True, null=True, verbose_name='提测时间')
    online_time = models.DateTimeField(blank=True, null=True, verbose_name='上线时间')
    actual_test_submit = models.DateTimeField(blank=True, null=True, verbose_name='实际提测时间')
    actual_online = models.DateTimeField(blank=True, null=True, verbose_name='实际上线时间')
    remarks = models.TextField(blank=True, null=True, verbose_name='备注')
    # 阻塞标记
    is_blocked = models.BooleanField(default=False, verbose_name='是否阻塞')
    block_reason = models.TextField(blank=True, null=True, verbose_name='阻塞原因')
    # 归档
    is_archived = models.BooleanField(default=False, verbose_name='是否归档')

    # ── 扩展字段 ──
    owner = models.CharField(max_length=500, blank=True, null=True, verbose_name='处理人')
    creator = models.CharField(max_length=200, blank=True, null=True, verbose_name='创建人')
    plan_begin = models.DateField(blank=True, null=True, verbose_name='预计开始')
    plan_due = models.DateField(blank=True, null=True, verbose_name='预计结束')
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name='完成时间')
    category_id = models.CharField(max_length=200, blank=True, null=True, verbose_name='需求分类ID')
    source_parent_id = models.CharField(max_length=200, blank=True, null=True, verbose_name='来源平台父需求ID')
    source_children_id = models.CharField(max_length=500, blank=True, null=True, verbose_name='来源平台子需求ID')
    effort = models.CharField(max_length=100, blank=True, null=True, verbose_name='预估工时')
    effort_completed = models.CharField(max_length=100, blank=True, null=True, verbose_name='完成工时')
    effort_remain = models.CharField(max_length=100, blank=True, null=True, verbose_name='剩余工时')
    release_id = models.CharField(max_length=200, blank=True, null=True, verbose_name='发布计划ID')
    source_category = models.CharField(max_length=200, blank=True, null=True, verbose_name='需求来源分类')
    source_type = models.CharField(max_length=200, blank=True, null=True, verbose_name='来源平台类型')
    module_name = models.CharField(max_length=200, blank=True, null=True, verbose_name='模块')
    label = models.CharField(max_length=500, blank=True, null=True, verbose_name='标签')
    progress = models.IntegerField(blank=True, null=True, verbose_name='进度')
    developer_name = models.CharField(max_length=500, blank=True, null=True, verbose_name='开发人员名')
    tester_name = models.CharField(max_length=500, blank=True, null=True, verbose_name='测试人员名')
    custom_fields = models.JSONField(default=dict, blank=True, verbose_name='自定义字段')

    # 审计
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_requirements', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '需求'
        verbose_name_plural = '需求'
        ordering = ['-created_at']
        unique_together = [['source', 'req_type', 'source_id']]

    def __str__(self):
        return f'{self.requirement_id} - {self.name}'

    def can_transition_to(self, target_status):
        return target_status in VALID_TRANSITIONS.get(self.status, [])


class AiInputAsset(models.Model):
    UNDERSTAND_TYPE_CHOICES = [
        ('req_md', '需求理解'),
        ('ui_design', 'UI设计稿'),
        ('ui_design_web', 'UI设计稿-Web'),
        ('ui_design_app', 'UI设计稿-App'),
        ('tech_md', '技术方案'),
    ]
    SOURCE_TYPE_CHOICES = [
        ('url_fetch', '链接'),
        ('upload_file', '文件'),
        ('ai_conversation', 'AI对话'),
        ('screenshot_input', '截图输入'),
    ]
    requirement = models.ForeignKey(Requirement, on_delete=models.CASCADE, related_name='ai_input_assets', verbose_name='所属需求')
    understand_type = models.CharField(max_length=20, choices=UNDERSTAND_TYPE_CHOICES, verbose_name='理解类型')
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default='upload_file', verbose_name='来源类型')
    batch_desc = models.CharField(max_length=200, blank=True, null=True, verbose_name='批次说明')
    file_paths = models.JSONField(default=dict, blank=True, verbose_name='文件路径（source_files原始文件/images图片）')
    text_content = models.TextField(blank=True, null=True, verbose_name='原始文本内容（含[图片N]占位符）')
    is_selected = models.BooleanField(default=False, verbose_name='是否选中')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_input_assets', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'AI素材批次'
        verbose_name_plural = 'AI素材批次'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.requirement.requirement_id} / {self.understand_type} / {self.batch_desc or self.id}'


class AiUnderstanding(models.Model):
    UNDERSTAND_TYPE_CHOICES = [
        ('req_md', '需求理解'),
        ('ui_design', 'UI设计稿'),
        ('ui_design_web', 'UI设计稿-Web'),
        ('ui_design_app', 'UI设计稿-App'),
        ('tech_md', '技术方案'),
    ]
    SOURCE_TYPE_CHOICES = [
        ('url_fetch', '链接'),
        ('upload_file', '文件'),
        ('ai_conversation', 'AI对话'),
    ]
    STATUS_CHOICES = [
        ('pending', '待生成'),
        ('processing', '生成中'),
        ('done', '已生成'),
        ('failed', '失败'),
    ]
    PARSE_STATUS_CHOICES = [
        ('pending', '待解析'),
        ('processing', '解析中'),
        ('done', '已解析'),
        ('failed', '解析失败'),
    ]
    requirement = models.ForeignKey(Requirement, on_delete=models.CASCADE, related_name='ai_understandings', verbose_name='所属需求')
    understand_type = models.CharField(max_length=20, choices=UNDERSTAND_TYPE_CHOICES, verbose_name='理解类型')
    # DEPRECATED: 以下字段已废弃，统一从 input_assets 读取
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, verbose_name='来源类型（已废弃）')
    source_ref = models.TextField(blank=True, null=True, verbose_name='来源描述（已废弃）')
    raw_content = models.TextField(blank=True, null=True, verbose_name='原始提取内容（已废弃）')
    # END DEPRECATED
    ai_understanding = models.TextField(blank=True, null=True, verbose_name='AI理解文本')
    ai_understanding_result = models.JSONField(blank=True, null=True, verbose_name='AI理解结构化结果')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    error_msg = models.TextField(blank=True, null=True, verbose_name='失败原因')
    is_selected = models.BooleanField(default=False, verbose_name='是否为最优理解')
    note = models.CharField(max_length=200, blank=True, null=True, verbose_name='备注')
    input_assets = models.ManyToManyField(AiInputAsset, blank=True, related_name='ai_understandings', verbose_name='关联素材批次')
    # 解析阶段字段
    parse_status = models.CharField(max_length=20, choices=PARSE_STATUS_CHOICES, default='pending', verbose_name='解析状态')
    parsed_content = models.TextField(blank=True, null=True, verbose_name='解析内容（文本+表格）')
    parsed_content_with_images = models.TextField(blank=True, null=True, verbose_name='解析内容（含图片识别）')
    parse_error_msg = models.TextField(blank=True, null=True, verbose_name='解析失败原因')
    parse_reviewed = models.BooleanField(default=False, verbose_name='解析已审核')
    parse_reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='parse_reviewed_understandings', verbose_name='解析审核人')
    parse_reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='解析审核时间')
    # AI理解审核字段
    ai_reviewed = models.BooleanField(default=False, verbose_name='AI理解已审核')
    ai_reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='ai_reviewed_understandings', verbose_name='AI理解审核人')
    ai_reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='AI理解审核时间')
    ai_quality_issues = models.JSONField(default=list, blank=True, verbose_name='AI质量问题')
    suggested_modules = models.JSONField(default=list, blank=True, verbose_name='AI建议模块')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_understandings', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'AI理解记录'
        verbose_name_plural = 'AI理解记录'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.requirement.requirement_id} / {self.understand_type} / {self.source_type}'


class SubRequirement(models.Model):
    STATUS_CHOICES = [
        ('pending', '待处理'),
        ('in_progress', '进行中'),
        ('completed', '已完成'),
    ]
    requirement = models.ForeignKey(Requirement, on_delete=models.CASCADE, related_name='sub_requirements', verbose_name='所属需求')
    name = models.CharField(max_length=200, verbose_name='子需求名称')
    description = models.TextField(blank=True, null=True, verbose_name='详细描述')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='assigned_sub_requirements', verbose_name='负责人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '子需求'
        verbose_name_plural = '子需求'

    def __str__(self):
        return f'{self.requirement.requirement_id} / {self.name}'


class ChangeLog(models.Model):
    target_type = models.CharField(max_length=50, verbose_name='目标类型')
    target_id = models.BigIntegerField(verbose_name='目标ID')
    field = models.CharField(max_length=100, verbose_name='变更字段')
    old_value = models.TextField(blank=True, null=True, verbose_name='旧值')
    new_value = models.TextField(blank=True, null=True, verbose_name='新值')
    changed_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='change_logs', verbose_name='变更人')
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name='变更时间')

    class Meta:
        verbose_name = '变更记录'
        verbose_name_plural = '变更记录'
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=['target_type', 'target_id']),
        ]

    def __str__(self):
        return f'{self.target_type}#{self.target_id} {self.field}'
