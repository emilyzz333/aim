from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from .models import Bug
from .serializers import BugSerializer
from apps.requirements.models import ChangeLog
from apps.integrations.webhook import notify_bug_assigned


class BugViewSet(viewsets.ModelViewSet):
    serializer_class = BugSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Bug.objects.all()
        for field in ['status', 'priority', 'type', 'group', 'source', 'assignee', 'reporter', 'requirement']:
            val = self.request.query_params.get(field)
            if val:
                qs = qs.filter(**{field: val})
        return qs.select_related('requirement', 'assignee', 'reporter')

    def perform_create(self, serializer):
        bug_id = self.request.data.get('bug_id', '').strip()
        if not bug_id:
            last = Bug.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            bug_id = f'BUG-{next_num:04d}'
        bug = serializer.save(reporter=self.request.user, bug_id=bug_id)
        # 若创建时已分配，发送通知
        if bug.assignee:
            try:
                notify_bug_assigned(
                    bug,
                    assignee_name=bug.assignee.get_full_name() or bug.assignee.username,
                    reporter_name=self.request.user.get_full_name() or self.request.user.username,
                )
            except Exception:
                pass

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        old_status = instance.status
        old_assignee_id = instance.assignee_id
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        # 状态变更写入 ChangeLog
        new_status = serializer.data.get('status')
        if new_status and old_status != new_status:
            ChangeLog.objects.create(
                target_type='bug',
                target_id=instance.id,
                field='status',
                old_value=old_status,
                new_value=new_status,
                changed_by=request.user,
            )
        # 分配人变更时发送 Webhook 通知
        new_assignee_id = instance.assignee_id
        if new_assignee_id and new_assignee_id != old_assignee_id:
            try:
                notify_bug_assigned(
                    instance,
                    assignee_name=instance.assignee.get_full_name() or instance.assignee.username,
                    reporter_name=request.user.get_full_name() or request.user.username,
                )
            except Exception:
                pass
        return Response(serializer.data)
