from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import FunctionCase, TestPlan
from .serializers import FunctionCaseSerializer, TestPlanSerializer


class FunctionCaseViewSet(viewsets.ModelViewSet):
    serializer_class = FunctionCaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = FunctionCase.objects.filter(is_delete=False)
        for field in ['project', 'module', 'requirement', 'status', 'plat', 'source', 'reviewed']:
            val = self.request.query_params.get(field)
            if val:
                qs = qs.filter(**{field: val})
        keyword = self.request.query_params.get('keyword')
        if keyword:
            qs = qs.filter(title__icontains=keyword)
        return qs.select_related('project', 'module', 'requirement', 'created_by')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_delete = True
        instance.save(update_fields=['is_delete'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='run-automation')
    def run_automation(self, request, pk=None):
        return Response(
            {'message': '自动化测试触发功能待后期 AI 集成实现'},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class TestPlanViewSet(viewsets.ModelViewSet):
    serializer_class = TestPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = TestPlan.objects.prefetch_related('cases', 'requirements').select_related('project', 'created_by')
        project_id = self.request.query_params.get('project_id')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'], url_path='report')
    def report(self, request, pk=None):
        """测试报告：聚合统计"""
        plan = self.get_object()
        cases = plan.cases.filter(is_delete=False)
        total = cases.count()
        passed = cases.filter(status='passed').count()
        failed = cases.filter(status='failed').count()
        blocked = cases.filter(status='blocked').count()
        skipped = cases.filter(status='skipped').count()
        bug_count = plan.requirements.aggregate(
            bugs=__import__('django.db.models', fromlist=['Count']).Count('bugs')
        ).get('bugs', 0)
        return Response({
            'plan_name': plan.name,
            'total_cases': total,
            'passed': passed,
            'failed': failed,
            'blocked': blocked,
            'skipped': skipped,
            'pass_rate': round(passed / total * 100, 1) if total else 0,
            'coverage': round(plan.requirements.count() / max(1, total) * 100, 1),
        })
