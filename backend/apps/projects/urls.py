from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ModuleListView, ModuleDetailView

router = DefaultRouter()
router.register('', ProjectViewSet, basename='project')

urlpatterns = [
    path('modules/', ModuleListView.as_view(), name='module-list'),
    path('modules/<int:pk>/', ModuleDetailView.as_view(), name='module-detail'),
    path('', include(router.urls)),
]
