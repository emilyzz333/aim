from django.contrib.auth import authenticate
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .models import User, Team, Notification
from .serializers import UserSerializer, TeamSerializer
from .permissions import IsAdminOrAbove


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
            })
        return Response({'message': '用户名或密码错误'}, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'message': 'refresh token 不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({'message': 'token 无效或已过期'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': '登出成功'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class QwAuthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        import os
        corp_id = os.environ.get('QW_CORP_ID', 'your_corp_id')
        agent_id = os.environ.get('QW_AGENT_ID', 'your_agent_id')
        redirect_uri = request.build_absolute_uri('/api/auth/qw/callback/')
        auth_url = (
            f'https://open.weixin.qq.com/connect/oauth2/authorize'
            f'?appid={corp_id}&redirect_uri={redirect_uri}'
            f'&response_type=code&scope=snsapi_userinfo'
            f'&agentid={agent_id}#wechat_redirect'
        )
        return Response({'auth_url': auth_url})


class QwCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.GET.get('code')
        if not code:
            return Response({'message': '缺少授权码'}, status=status.HTTP_400_BAD_REQUEST)
        # 实际项目中在此调用企微 API 换取用户信息
        # qw_user_info = fetch_qw_user_info(code)
        return Response({'code': code, 'message': '企微授权码接收成功，请配置企微 CorpID 完成集成'})


class QwLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        qw_userid = request.data.get('qw_userid')
        if not qw_userid:
            return Response({'message': '缺少企微用户ID'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(qw_userid=qw_userid)
        except User.DoesNotExist:
            return Response({'message': '用户不存在，请先绑定账号'}, status=status.HTTP_404_NOT_FOUND)
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class QwUserInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'qw_userid': user.qw_userid,
            'qw_openid': user.qw_openid,
            'qw_department': user.qw_department,
            'qw_avatar': user.qw_avatar,
        })


class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.all()
        role = request.query_params.get('role')
        if role:
            users = users.filter(role=role)
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        if not request.user.is_admin_or_above:
            return Response({'message': '权限不足'}, status=status.HTTP_403_FORBIDDEN)
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            password = request.data.get('password')
            if password:
                user.set_password(password)
                user.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        user = self.get_object(pk)
        if not user:
            return Response({'message': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserSerializer(user).data)

    def put(self, request, pk):
        if not request.user.is_admin_or_above:
            return Response({'message': '权限不足'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object(pk)
        if not user:
            return Response({'message': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not request.user.is_admin_or_above:
            return Response({'message': '权限不足'}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object(pk)
        if not user:
            return Response({'message': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Team.objects.prefetch_related('members').select_related('created_by').all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminOrAbove()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'], url_path='add-member')
    def add_member(self, request, pk=None):
        team = self.get_object()
        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(pk=user_id)
            team.members.add(user)
            return Response({'message': f'{user.username} 已加入团队'})
        except User.DoesNotExist:
            return Response({'message': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='remove-member')
    def remove_member(self, request, pk=None):
        team = self.get_object()
        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(pk=user_id)
            team.members.remove(user)
            return Response({'message': f'{user.username} 已移出团队'})
        except User.DoesNotExist:
            return Response({'message': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)


class WorkloadStatsView(APIView):
    """工作量统计：按用户聚合需求数和缺陷数"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        req_filter = Q()
        bug_filter = Q()
        if start_date:
            req_filter &= Q(created_at__gte=start_date)
            bug_filter &= Q(created_at__gte=start_date)
        if end_date:
            req_filter &= Q(created_at__lte=end_date)
            bug_filter &= Q(created_at__lte=end_date)

        users = User.objects.annotate(
            requirement_count=Count('dev_requirements', filter=req_filter, distinct=True),
            bug_count=Count('assigned_bugs', filter=bug_filter, distinct=True),
        ).values('id', 'username', 'role', 'requirement_count', 'bug_count')

        return Response(list(users))


class NotificationListView(APIView):
    """站内通知 API"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(recipient=request.user)
        unread_only = request.query_params.get('unread')
        if unread_only == 'true':
            notifications = notifications.filter(is_read=False)
        data = notifications.values(
            'id', 'notification_type', 'title', 'content',
            'is_read', 'target_type', 'target_id', 'created_at',
        )
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'results': list(data), 'unread_count': unread_count})

    def post(self, request):
        """标记所有通知为已读"""
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'message': '全部已读'})


class NotificationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        """标记单条通知为已读"""
        try:
            notif = Notification.objects.get(pk=pk, recipient=request.user)
            notif.is_read = True
            notif.save(update_fields=['is_read'])
            return Response({'message': '已标记已读'})
        except Notification.DoesNotExist:
            return Response({'message': '通知不存在'}, status=status.HTTP_404_NOT_FOUND)
