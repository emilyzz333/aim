from django.db import models
from apps.users.models import User


class Project(models.Model):
    name = models.CharField(max_length=200, verbose_name='项目名称')
    description = models.TextField(blank=True, null=True, verbose_name='项目描述')
    summary = models.TextField(blank=True, null=True, verbose_name='项目实现逻辑说明')
    tech_lead = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tech_lead_projects', verbose_name='技术负责人')
    test_lead = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='test_lead_projects', verbose_name='测试负责人')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_projects', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '项目'
        verbose_name_plural = '项目'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Module(models.Model):
    STATUS_CHOICES = [
        ('active', '正式'),
        ('draft', '草稿'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='modules', verbose_name='所属项目')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, blank=True, null=True, related_name='children', verbose_name='父模块')
    name = models.CharField(max_length=200, verbose_name='模块名称')
    description = models.TextField(blank=True, null=True, verbose_name='模块描述')
    order = models.IntegerField(default=0, verbose_name='排序')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    created_by_ai = models.BooleanField(default=False, verbose_name='由AI创建')
    git_repo_url = models.URLField(blank=True, null=True, verbose_name='Git仓库URL')
    git_code_path = models.CharField(max_length=500, blank=True, null=True, verbose_name='Git代码路径')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '模块'
        verbose_name_plural = '模块'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f'{self.project.name} / {self.name}'


class ModuleKnowledge(models.Model):
    KNOWLEDGE_TYPE_CHOICES = [
        ('pattern', '技术模式'),
        ('convention', '约定规范'),
        ('dependency', '依赖关系'),
        ('risk', '已知风险'),
        ('decision', '技术决策'),
    ]
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='knowledge_entries', verbose_name='所属模块')
    knowledge_type = models.CharField(max_length=20, choices=KNOWLEDGE_TYPE_CHOICES, verbose_name='知识类型')
    content = models.TextField(verbose_name='知识内容')
    source_requirement = models.ForeignKey(
        'requirements.Requirement', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='generated_knowledge', verbose_name='来源需求'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '模块知识'
        verbose_name_plural = '模块知识'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.module.name} / {self.knowledge_type}'


class RequirementRelation(models.Model):
    RELATION_TYPE_CHOICES = [
        ('related', '相关'),
        ('depends_on', '依赖'),
        ('conflicts', '冲突'),
        ('extends', '扩展'),
        ('replaces', '替代'),
    ]
    from_requirement = models.ForeignKey(
        'requirements.Requirement', on_delete=models.CASCADE,
        related_name='outgoing_relations', verbose_name='来源需求'
    )
    to_requirement = models.ForeignKey(
        'requirements.Requirement', on_delete=models.CASCADE,
        related_name='incoming_relations', verbose_name='目标需求'
    )
    relation_type = models.CharField(max_length=20, choices=RELATION_TYPE_CHOICES, verbose_name='关系类型')
    confidence = models.FloatField(default=1.0, verbose_name='置信度（0-1）')
    created_by_ai = models.BooleanField(default=False, verbose_name='由AI创建')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        verbose_name = '需求关联'
        verbose_name_plural = '需求关联'
        unique_together = [['from_requirement', 'to_requirement', 'relation_type']]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.from_requirement.requirement_id} → {self.to_requirement.requirement_id} ({self.relation_type})'
