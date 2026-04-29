from rest_framework import serializers
from .models import Iteration
from apps.projects.models import Project


class IterationSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=False, allow_null=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    # 进度统计（任务 4.3）
    total_requirements = serializers.SerializerMethodField()
    completed_requirements = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()

    class Meta:
        model = Iteration
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_total_requirements(self, obj):
        return obj.requirements.filter(is_archived=False).count()

    def get_completed_requirements(self, obj):
        return obj.requirements.filter(status='completed', is_archived=False).count()

    def get_completion_rate(self, obj):
        total = self.get_total_requirements(obj)
        if total == 0:
            return 0
        return round(self.get_completed_requirements(obj) / total * 100, 1)
