from django.urls import path, include
from rest_framework.routers import DefaultRouter, SimpleRouter
from .views import RequirementViewSet, AiInputAssetViewSet, AiUnderstandingViewSet

# Use SimpleRouter for sub-resources to avoid api-root conflict
sub_router = SimpleRouter()
sub_router.register('ai-input-assets', AiInputAssetViewSet, basename='ai-input-asset')
sub_router.register('ai-understandings', AiUnderstandingViewSet, basename='ai-understanding')

requirement_router = DefaultRouter()
requirement_router.register('', RequirementViewSet, basename='requirement')

urlpatterns = [
    # Sub-resource routes must come first to avoid being captured by requirement detail pk pattern
    path('', include(sub_router.urls)),
    path('', include(requirement_router.urls)),
]
