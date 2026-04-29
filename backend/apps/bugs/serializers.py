from rest_framework import serializers
from .models import Bug


class BugSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.username', read_only=True)
    reporter_name = serializers.CharField(source='reporter.username', read_only=True)
    requirement_name = serializers.CharField(source='requirement.name', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = Bug
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
