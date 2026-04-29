from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FunctionCaseViewSet, TestPlanViewSet

router = DefaultRouter()
router.register('', FunctionCaseViewSet, basename='testcase')
router.register('plans', TestPlanViewSet, basename='testplan')

urlpatterns = [
    path('', include(router.urls)),
]
