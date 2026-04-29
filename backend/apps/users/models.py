from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    ROLE_CHOICES = [
        ('product_manager', '产品经理'),
        ('developer', '开发人员'),
        ('tester', '测试人员'),
        ('project_manager', '项目经理'),
        ('product_tl', '产品TL'),
        ('developer_tl', '开发TL'),
        ('tester_tl', '测试TL'),
        ('admin', '管理员'),
        ('super_admin', '超级管理员'),
    ]
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='developer', verbose_name='角色')
    display_name = models.CharField(max_length=100, blank=True, null=True, verbose_name='中文姓名')
    qw_userid = models.CharField(max_length=100, blank=True, null=True, verbose_name='企微用户ID')
    qw_openid = models.CharField(max_length=100, blank=True, null=True, verbose_name='企微开放ID')
    qw_username = models.CharField(max_length=100, blank=True, null=True, verbose_name='企微中文名')
    qw_department = models.CharField(max_length=200, blank=True, null=True, verbose_name='企微部门')
    qw_avatar = models.URLField(blank=True, null=True, verbose_name='企微头像')
    team = models.ForeignKey(
        'Team', on_delete=models.SET_NULL, blank=True, null=True,
        related_name='team_members', verbose_name='所属团队',
    )
    leader = models.ForeignKey(
        'self', on_delete=models.SET_NULL, blank=True, null=True,
        related_name='subordinates', verbose_name='直属上级',
    )

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'

    def __str__(self):
        return f'{self.display_name or self.username} ({self.get_role_display()})'

    @property
    def is_admin_or_above(self):
        return self.role in ('admin', 'super_admin')

    @property
    def is_super_admin(self):
        return self.role == 'super_admin'


class Team(models.Model):
    name = models.CharField(max_length=100, verbose_name='团队名称')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, blank=True, null=True, related_name='children', verbose_name='上级团队')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    members = models.ManyToManyField(User, blank=True, related_name='teams', verbose_name='成员')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_teams', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '团队'
        verbose_name_plural = '团队'

    def __str__(self):
        if self.parent:
            return f'{self.parent.name} / {self.name}'
        return self.name


class Notification(models.Model):
    TYPE_CHOICES = [
        ('requirement_status', '需求状态变更'),
        ('bug_assigned', '缺陷分配'),
        ('mention', '@提及'),
        ('system', '系统通知'),
    ]
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', verbose_name='接收人')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notifications', verbose_name='发送人')
    notification_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='system', verbose_name='通知类型')
    title = models.CharField(max_length=200, verbose_name='标题')
    content = models.TextField(verbose_name='内容')
    is_read = models.BooleanField(default=False, verbose_name='是否已读')
    target_type = models.CharField(max_length=50, blank=True, null=True, verbose_name='关联对象类型')
    target_id = models.IntegerField(blank=True, null=True, verbose_name='关联对象ID')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '通知'
        verbose_name_plural = '通知'
        ordering = ['-created_at']
