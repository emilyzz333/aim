from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Project, Module
from .serializers import ProjectSerializer, ModuleSerializer
from apps.users.permissions import IsAdminOrAbove


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        if not request.user.is_admin_or_above:
            return Response({'message': '权限不足，仅管理员可创建项目'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not request.user.is_admin_or_above:
            return Response({'message': '权限不足'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_admin_or_above:
            return Response({'message': '权限不足'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ModuleListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response({'message': '请提供 project_id'}, status=status.HTTP_400_BAD_REQUEST)
        # 只返回根节点，子节点通过 children 嵌套
        modules = Module.objects.filter(project_id=project_id, parent=None)
        return Response(ModuleSerializer(modules, many=True).data)

    def post(self, request):
        serializer = ModuleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ModuleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Module.objects.get(pk=pk)
        except Module.DoesNotExist:
            return None

    def get(self, request, pk):
        module = self.get_object(pk)
        if not module:
            return Response({'message': '模块不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ModuleSerializer(module).data)

    def put(self, request, pk):
        module = self.get_object(pk)
        if not module:
            return Response({'message': '模块不存在'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ModuleSerializer(module, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        module = self.get_object(pk)
        if not module:
            return Response({'message': '模块不存在'}, status=status.HTTP_404_NOT_FOUND)
        if module.children.exists():
            return Response({'message': '请先删除子模块'}, status=status.HTTP_400_BAD_REQUEST)
        module.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
