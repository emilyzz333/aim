from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserListView, UserDetailView, TeamViewSet, WorkloadStatsView, NotificationListView, NotificationDetailView

router = DefaultRouter()
router.register('teams', TeamViewSet, basename='team')

urlpatterns = [
    path('', UserListView.as_view(), name='user-list'),
    path('<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('workload/', WorkloadStatsView.as_view(), name='workload-stats'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('', include(router.urls)),
]
