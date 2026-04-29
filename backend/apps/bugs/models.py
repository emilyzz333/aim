from django.db import models
from apps.users.models import User
from apps.requirements.models import Requirement
from apps.iterations.models import Iteration
from apps.projects.models import Project, Module

class Bug(models.Model):
    PRIORITY_CHOICES = [
        ('blocker', '阻断'),
        ('critical', '严重'),
        ('major', '主要'),
        ('minor', '次要'),
        ('trivial', '轻微'),
    ]
    STATUS_CHOICES = [
        ('open', '待处理'),
        ('in_progress', '处理中'),
        ('resolved', '已解决'),
        ('done', '已完成'),
        ('closed', '已关闭'),
        ('rejected', '已拒绝'),
        ('suspended', '挂起'),
    ]
    ENV_CHOICES = [
        ('t', 'T环境'),
        ('pre', 'Pre环境'),
        ('prod', '线上环境'),
    ]
    TYPE_CHOICES = [
        ('online', '线上缺陷'),
        ('function', '功能缺陷'),
        ('requirement', '需求缺陷'),
        ('design', '设计缺陷'),
        ('ux', '用户体验'),
        ('suggestion', '建议'),
    ]
    SOURCE_CHOICES = [
        ('test', '测试发现'),
        ('tech', '技术发现'),
        ('business', '业务反馈'),
        ('user', '用户反馈'),
    ]

    bug_id = models.CharField(max_length=100, unique=True, blank=True, verbose_name='缺陷编号')
    source_id = models.CharField(max_length=100, blank=True, null=True, unique=True, verbose_name='来源平台ID')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, blank=True, null=True, related_name='bugs', verbose_name='所属项目')
    iteration = models.ForeignKey(Iteration, on_delete=models.SET_NULL, blank=True, null=True, related_name='bugs', verbose_name='所属迭代')
    requirement = models.ForeignKey(Requirement, on_delete=models.SET_NULL, blank=True, null=True, related_name='bugs', verbose_name='关联需求')
    module = models.ForeignKey(Module, on_delete=models.SET_NULL, blank=True, null=True, related_name='bugs', verbose_name='关联模块')
    title = models.CharField(max_length=200, verbose_name='缺陷标题')
    description = models.TextField(verbose_name='缺陷描述')
    priority = models.CharField(max_length=50, choices=PRIORITY_CHOICES, default='major', verbose_name='优先级')
    severity = models.CharField(max_length=50, blank=True, null=True, verbose_name='严重程度')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='open', verbose_name='状态')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='assigned_bugs', verbose_name='负责人')
    reporter = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True, related_name='reported_bugs', verbose_name='报告人')
    env = models.CharField(max_length=20, choices=ENV_CHOICES, blank=True, null=True, verbose_name='发现环境')
    type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='function', verbose_name='缺陷类型')
    group = models.CharField(max_length=100, blank=True, null=True, verbose_name='归属团队')
    source = models.CharField(max_length=50, choices=SOURCE_CHOICES, default='test', verbose_name='缺陷来源')
    source_created_at = models.DateTimeField(null=True, blank=True, verbose_name='来源平台创建时间')
    source_updated_at = models.DateTimeField(null=True, blank=True, verbose_name='来源平台更新时间')

    # ── 扩展字段 ──
    creator = models.CharField(max_length=200, blank=True, null=True, verbose_name='创建人')
    current_owner = models.CharField(max_length=500, blank=True, null=True, verbose_name='当前处理人')
    cc = models.CharField(max_length=500, blank=True, null=True, verbose_name='抄送人')
    de = models.CharField(max_length=500, blank=True, null=True, verbose_name='开发人员')
    te = models.CharField(max_length=500, blank=True, null=True, verbose_name='测试人员')
    fixer = models.CharField(max_length=200, blank=True, null=True, verbose_name='修复人')
    module_name = models.CharField(max_length=200, blank=True, null=True, verbose_name='模块名称')
    release_id = models.CharField(max_length=200, blank=True, null=True, verbose_name='发布计划ID')
    origin_phase = models.CharField(max_length=200, blank=True, null=True, verbose_name='发现阶段')
    bug_source = models.CharField(max_length=200, blank=True, null=True, verbose_name='缺陷根源')
    resolution = models.CharField(max_length=200, blank=True, null=True, verbose_name='解决方法')
    bug_category = models.CharField(max_length=200, blank=True, null=True, verbose_name='缺陷分类')
    os = models.CharField(max_length=200, blank=True, null=True, verbose_name='操作系统')
    platform = models.CharField(max_length=200, blank=True, null=True, verbose_name='软件平台')
    browser = models.CharField(max_length=200, blank=True, null=True, verbose_name='浏览器')
    label = models.CharField(max_length=500, blank=True, null=True, verbose_name='标签')
    flows = models.TextField(blank=True, null=True, verbose_name='流转记录')
    resolved_at = models.DateTimeField(blank=True, null=True, verbose_name='解决时间')
    closed_at = models.DateTimeField(blank=True, null=True, verbose_name='关闭时间')
    rejected_at = models.DateTimeField(blank=True, null=True, verbose_name='拒绝时间')
    in_progress_at = models.DateTimeField(blank=True, null=True, verbose_name='开始处理时间')
    effort = models.CharField(max_length=100, blank=True, null=True, verbose_name='预估工时')
    effort_completed = models.CharField(max_length=100, blank=True, null=True, verbose_name='完成工时')
    effort_exceed = models.CharField(max_length=100, blank=True, null=True, verbose_name='超出工时')
    effort_remain = models.CharField(max_length=100, blank=True, null=True, verbose_name='剩余工时')
    custom_fields = models.JSONField(default=dict, blank=True, verbose_name='自定义字段')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '缺陷'
        verbose_name_plural = '缺陷'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.bug_id} - {self.title}'
