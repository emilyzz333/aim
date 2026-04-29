from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('requirements', '0012_aiunderstanding_ai_quality_issues_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='aiinputasset',
            name='file_paths',
            field=models.JSONField(blank=True, default=dict, verbose_name='文件路径（source_files原始文件/images图片）'),
        ),
    ]
