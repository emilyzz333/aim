from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('requirements', '0013_aiinputasset_file_paths_default_dict'),
    ]

    operations = [
        migrations.AddField(
            model_name='aiinputasset',
            name='is_selected',
            field=models.BooleanField(default=False, verbose_name='是否选中'),
        ),
    ]
