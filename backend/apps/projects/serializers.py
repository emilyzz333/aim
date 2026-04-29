from rest_framework import serializers
from .models import Project, Module


class ModuleSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ['id', 'project', 'parent', 'name', 'description', 'order', 'children', 'created_at', 'updated_at']

    def get_children(self, obj):
        children = obj.children.all()
        return ModuleSerializer(children, many=True).data


class ProjectSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    tech_lead_name = serializers.CharField(source='tech_lead.username', read_only=True)
    test_lead_name = serializers.CharField(source='test_lead.username', read_only=True)

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']
