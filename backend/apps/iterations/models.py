from django.db import models
from apps.users.models import User, Team
from apps.projects.models import Project

SOURCE_CHOICES = [
    ('sys', '本系统创建'),
    ('tapd', 'TAPD'),
    ('jira', 'Jira'),
]

class Iteration(models.Model):
    name = models.CharField(max_length=200, verbose_name='迭代名称')

    # 来源平台相关字段
    source = models.CharField(max_length=50, default='sys', choices=SOURCE_CHOICES, verbose_name='来源')
    source_id = models.CharField(max_length=200, null=True, blank=True, verbose_name='来源平台ID', help_text='TAPD Iteration ID / Jira Sprint ID 等')
    source_created_at = models.DateTimeField(null=True, blank=True, verbose_name='来源平台创建时间')
    source_updated_at = models.DateTimeField(null=True, blank=True, verbose_name='来源平台更新时间')

    project = models.ForeignKey(Project, on_delete=models.SET_NULL, blank=True, null=True, related_name='iterations', verbose_name='所属项目')
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, blank=True, null=True, related_name='iterations', verbose_name='所属团队')
    start_date = models.DateField(verbose_name='开始日期')
    end_date = models.DateField(verbose_name='结束日期')
    status = models.CharField(max_length=50, default='planning', verbose_name='状态')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_iterations', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '迭代'
        verbose_name_plural = '迭代'
        unique_together = [['source', 'source_id']]

    def __str__(self):
        prefix = self.team.name if self.team else (self.project.name if self.project else '未分配')
        return f'{prefix} - {self.name}'
