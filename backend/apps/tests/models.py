from django.db import models
from apps.users.models import User
from apps.requirements.models import Requirement
from apps.projects.models import Project, Module


class FunctionCase(models.Model):
    PLAT_CHOICES = [
        ('web', 'Web'),
        ('ios', 'iOS'),
        ('android', 'Android'),
        ('harmonyos', '鸿蒙'),
        ('server', '后端Server'),
    ]
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('passed', '通过'),
        ('failed', '失败'),
        ('blocked', '阻塞'),
        ('skipped', '跳过'),
    ]
    SOURCE_CHOICES = [
        ('manual', '新建'),
        ('import', '导入'),
        ('ai', 'AI生成'),
    ]
    REVIEWED_CHOICES = [
        ('pending', '待审核'),
        ('approved', '通过'),
        ('rejected', '不通过'),
    ]

    case_id = models.CharField(max_length=100, unique=True, verbose_name='用例编号')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='test_cases', verbose_name='所属项目')
    module = models.ForeignKey(Module, on_delete=models.SET_NULL, blank=True, null=True, related_name='test_cases', verbose_name='所属模块')
    requirement = models.ForeignKey(Requirement, on_delete=models.SET_NULL, blank=True, null=True, related_name='test_cases', verbose_name='关联需求')
    title = models.CharField(max_length=200, verbose_name='用例标题')
    steps = models.TextField(verbose_name='测试步骤')
    expected_result = models.TextField(verbose_name='预期结果')
    api_test = models.TextField(blank=True, null=True, verbose_name='关联接口自动化')
    ui_test = models.TextField(blank=True, null=True, verbose_name='关联UI自动化')
    plat = models.CharField(max_length=20, choices=PLAT_CHOICES, default='web', verbose_name='平台')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    is_delete = models.BooleanField(default=False, verbose_name='是否删除')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual', verbose_name='来源')
    remarks = models.TextField(blank=True, null=True, verbose_name='备注')
    reviewed = models.CharField(max_length=20, choices=REVIEWED_CHOICES, default='pending', verbose_name='审核状态')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_test_cases', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '测试用例'
        verbose_name_plural = '测试用例'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.case_id} - {self.title}'


class TestPlan(models.Model):
    """测试计划：关联需求和测试用例集合，跟踪执行进度"""
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('active', '执行中'),
        ('completed', '已完成'),
    ]
    name = models.CharField(max_length=200, verbose_name='计划名称')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='test_plans', verbose_name='所属项目')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    requirements = models.ManyToManyField(Requirement, blank=True, related_name='test_plans', verbose_name='关联需求')
    cases = models.ManyToManyField(FunctionCase, blank=True, related_name='test_plans', verbose_name='测试用例')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_test_plans', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '测试计划'
        verbose_name_plural = '测试计划'
        ordering = ['-created_at']

    def __str__(self):
        return self.name
