from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrAbove
from .models import Iteration
from .serializers import IterationSerializer


class IterationViewSet(viewsets.ModelViewSet):
    serializer_class = IterationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Iteration.objects.select_related('project', 'team', 'created_by').all()
        project_id = self.request.query_params.get('project_id')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminOrAbove()]
        return [IsAuthenticated()]
