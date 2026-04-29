from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('requirements', '0004_requirement_story_id_alter_requirement_req_type'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # --- 字段重命名 ---
        migrations.RenameField(
            model_name='requirement',
            old_name='requirement_md',
            new_name='req_md',
        ),
        migrations.RenameField(
            model_name='requirement',
            old_name='technical_md',
            new_name='tech_md',
        ),
        migrations.RenameField(
            model_name='requirement',
            old_name='figma_url',
            new_name='ui_design_web',
        ),
        # --- 新增字段 ---
        migrations.AddField(
            model_name='requirement',
            name='ui_design_app',
            field=models.URLField(blank=True, null=True, verbose_name='UI设计稿App链接'),
        ),
        migrations.AddField(
            model_name='requirement',
            name='req_md_source',
            field=models.CharField(blank=True, help_text='manual/upload/url/gitlab', max_length=20, null=True, verbose_name='需求MD来源'),
        ),
        migrations.AddField(
            model_name='requirement',
            name='req_md_source_url',
            field=models.TextField(blank=True, null=True, verbose_name='需求MD来源URL'),
        ),
        migrations.AddField(
            model_name='requirement',
            name='tech_md_source',
            field=models.CharField(blank=True, help_text='manual/upload/url/gitlab', max_length=20, null=True, verbose_name='技术MD来源'),
        ),
        migrations.AddField(
            model_name='requirement',
            name='tech_md_source_url',
            field=models.TextField(blank=True, null=True, verbose_name='技术MD来源URL'),
        ),
        migrations.AddField(
            model_name='requirement',
            name='tech_md_gitlab_path',
            field=models.CharField(blank=True, max_length=500, null=True, verbose_name='技术MD GitLab路径'),
        ),
        migrations.AddField(
            model_name='requirement',
            name='tech_md_gitlab_branch',
            field=models.CharField(blank=True, max_length=200, null=True, verbose_name='技术MD GitLab分支'),
        ),
        migrations.AddField(
            model_name='requirement',
            name='tech_md_gitlab_commitid',
            field=models.CharField(blank=True, max_length=100, null=True, verbose_name='技术MD GitLab CommitID'),
        ),
        migrations.AddField(
            model_name='requirement',
            name='req_understanding',
            field=models.TextField(blank=True, null=True, verbose_name='最优AI需求理解'),
        ),
        # --- 新增 AiInputAsset 表 ---
        migrations.CreateModel(
            name='AiInputAsset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('understand_type', models.CharField(choices=[('req_md', '需求理解'), ('ui_design', 'UI设计稿'), ('tech_md', '技术方案')], max_length=20, verbose_name='理解类型')),
                ('batch_desc', models.CharField(blank=True, max_length=200, null=True, verbose_name='批次说明')),
                ('file_paths', models.JSONField(blank=True, default=list, verbose_name='图片/文件路径列表')),
                ('text_content', models.TextField(blank=True, null=True, verbose_name='文字说明')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_input_assets', to=settings.AUTH_USER_MODEL, verbose_name='创建人')),
                ('requirement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_input_assets', to='requirements.requirement', verbose_name='所属需求')),
            ],
            options={
                'verbose_name': 'AI素材批次',
                'verbose_name_plural': 'AI素材批次',
                'ordering': ['-created_at'],
            },
        ),
        # --- 新增 AiUnderstanding 表 ---
        migrations.CreateModel(
            name='AiUnderstanding',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('understand_type', models.CharField(choices=[('req_md', '需求理解'), ('ui_design', 'UI设计稿'), ('tech_md', '技术方案')], max_length=20, verbose_name='理解类型')),
                ('source_type', models.CharField(choices=[('manual_edit', '手动编辑'), ('upload_file', '文件上传'), ('upload_image', '图片批次'), ('url_fetch', 'URL抓取'), ('gitlab_pull', 'GitLab拉取'), ('ai_generate', 'AI生成')], max_length=20, verbose_name='来源类型')),
                ('source_ref', models.TextField(blank=True, null=True, verbose_name='来源描述（文件路径/URL/GitLab路径）')),
                ('raw_content', models.TextField(blank=True, null=True, verbose_name='原始提取内容')),
                ('ai_understanding', models.TextField(blank=True, null=True, verbose_name='AI理解文本')),
                ('status', models.CharField(choices=[('pending', '待处理'), ('processing', '处理中'), ('done', '已完成'), ('failed', '失败')], default='pending', max_length=20, verbose_name='状态')),
                ('error_msg', models.TextField(blank=True, null=True, verbose_name='失败原因')),
                ('is_selected', models.BooleanField(default=False, verbose_name='是否为最优理解')),
                ('note', models.CharField(blank=True, max_length=200, null=True, verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_understandings', to=settings.AUTH_USER_MODEL, verbose_name='创建人')),
                ('input_assets', models.ManyToManyField(blank=True, related_name='ai_understandings', to='requirements.aiinputasset', verbose_name='关联素材批次')),
                ('requirement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_understandings', to='requirements.requirement', verbose_name='所属需求')),
            ],
            options={
                'verbose_name': 'AI理解记录',
                'verbose_name_plural': 'AI理解记录',
                'ordering': ['-created_at'],
            },
        ),
    ]
