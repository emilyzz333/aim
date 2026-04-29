from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IterationViewSet

router = DefaultRouter()
router.register('', IterationViewSet, basename='iteration')

urlpatterns = [
    path('', include(router.urls)),
]
