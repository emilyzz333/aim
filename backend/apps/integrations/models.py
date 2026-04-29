from django.db import models
from apps.users.models import User
from apps.projects.models import Project


class GitLabConfig(models.Model):
    """用户级 GitLab 令牌配置"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='gitlab_config', verbose_name='用户')
    private_token = models.CharField(max_length=100, verbose_name='GitLab私有令牌')
    api_url = models.URLField(default='https://gitlab.com/api/v4/', verbose_name='GitLab API地址')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'GitLab配置'
        verbose_name_plural = 'GitLab配置'


class ProjectGitLabConfig(models.Model):
    """项目级 GitLab 仓库配置"""
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='gitlab_config', verbose_name='项目')
    repo_url = models.URLField(verbose_name='仓库地址')
    access_token = models.CharField(max_length=200, verbose_name='Access Token')
    api_url = models.URLField(default='https://gitlab.com/api/v4/', verbose_name='GitLab API地址')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_gitlab_configs', verbose_name='创建人')

    class Meta:
        verbose_name = '项目GitLab配置'
        verbose_name_plural = '项目GitLab配置'
