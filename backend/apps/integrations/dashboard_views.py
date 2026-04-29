from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q
from apps.projects.models import Project
from apps.requirements.models import Requirement
from apps.bugs.models import Bug
from apps.iterations.models import Iteration


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 需求状态分布
        req_status = (
            Requirement.objects.filter(is_archived=False)
            .values('status')
            .annotate(count=Count('id'))
        )

        # 各项目概览（open_bugs 通过 requirements__bugs 路径）
        project_req = (
            Project.objects.annotate(
                total_reqs=Count('requirements', distinct=True),
                open_bugs=Count(
                    'requirements__bugs',
                    filter=Q(requirements__bugs__status='open'),
                    distinct=True,
                ),
            ).values('id', 'name', 'status', 'total_reqs', 'open_bugs')
        )

        # 缺陷统计
        bug_priority = (
            Bug.objects.filter(status__in=['open', 'in_progress'])
            .values('priority')
            .annotate(count=Count('id'))
        )

        # 进行中迭代
        active_iterations = Iteration.objects.filter(status='active').select_related('project')
        iter_data = []
        for it in active_iterations:
            total = it.requirements.filter(is_archived=False).count()
            completed = it.requirements.filter(status='completed', is_archived=False).count()
            iter_data.append({
                'id': it.id,
                'name': it.name,
                'project_name': it.project.name,
                'total': total,
                'completed': completed,
                'rate': round(completed / total * 100, 1) if total else 0,
            })

        return Response({
            'requirement_status_distribution': list(req_status),
            'project_overview': list(project_req),
            'bug_priority_distribution': list(bug_priority),
            'active_iterations': iter_data,
            'summary': {
                'total_projects': Project.objects.count(),
                'total_requirements': Requirement.objects.filter(is_archived=False).count(),
                'open_bugs': Bug.objects.filter(status='open').count(),
                'active_iterations': len(iter_data),
            },
        })
