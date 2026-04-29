from rest_framework import serializers
from .models import FunctionCase, TestPlan
from apps.projects.models import Project


class FunctionCaseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    requirement_name = serializers.CharField(source='requirement.name', read_only=True)
    module_name = serializers.CharField(source='module.name', read_only=True)
    plat_display = serializers.CharField(source='get_plat_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    reviewed_display = serializers.CharField(source='get_reviewed_display', read_only=True)

    class Meta:
        model = FunctionCase
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class TestPlanSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    total_cases = serializers.SerializerMethodField()
    passed_cases = serializers.SerializerMethodField()
    failed_cases = serializers.SerializerMethodField()
    pass_rate = serializers.SerializerMethodField()

    class Meta:
        model = TestPlan
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_total_cases(self, obj):
        return obj.cases.filter(is_delete=False).count()

    def get_passed_cases(self, obj):
        return obj.cases.filter(status='passed', is_delete=False).count()

    def get_failed_cases(self, obj):
        return obj.cases.filter(status='failed', is_delete=False).count()

    def get_pass_rate(self, obj):
        total = self.get_total_cases(obj)
        if total == 0:
            return 0
        return round(self.get_passed_cases(obj) / total * 100, 1)
