from django.urls import path
from .views import (
    TAPDAuthView, TAPDProjectsView, TAPDRequirementsView, TAPDSyncView,
    TAPDIterationsView, TAPDIterationSyncView, TAPDCustomFieldsView,
    AIRequirementAnalysisView, AITestCaseGenerationView, AICodeGenerationView,
    AIChatView,
    ProjectGitLabConfigView, GitLabConfigView,
    SystemConfigView, ConfluenceConfigView, ConfluencePreviewView,
    FigmaConfigView,
)
from .tapd_batch_sync import TAPDBatchSyncView, TAPDExecuteSyncView

urlpatterns = [
    # TAPD
    path('tapd/auth/', TAPDAuthView.as_view(), name='tapd-auth'),
    path('tapd/projects/', TAPDProjectsView.as_view(), name='tapd-projects'),
    path('tapd/requirements/', TAPDRequirementsView.as_view(), name='tapd-requirements'),
    path('tapd/iterations/', TAPDIterationsView.as_view(), name='tapd-iterations'),
    path('tapd/iterations/sync/', TAPDIterationSyncView.as_view(), name='tapd-iterations-sync'),
    path('tapd/custom-fields/', TAPDCustomFieldsView.as_view(), name='tapd-custom-fields'),
    path('tapd/batch-sync/', TAPDBatchSyncView.as_view(), name='tapd-batch-sync'),
    path('tapd/execute-sync/', TAPDExecuteSyncView.as_view(), name='tapd-execute-sync'),
    path('tapd/sync/', TAPDSyncView.as_view(), name='tapd-sync'),

    # AI
    path('ai/requirement-analysis/', AIRequirementAnalysisView.as_view(), name='ai-requirement-analysis'),
    path('ai/test-case-generation/', AITestCaseGenerationView.as_view(), name='ai-test-case-generation'),
    path('ai/code-generation/', AICodeGenerationView.as_view(), name='ai-code-generation'),
    path('ai/chat/', AIChatView.as_view(), name='ai-chat'),

    # GitLab
    path('gitlab/config/', GitLabConfigView.as_view(), name='gitlab-config'),
    path('gitlab/project/<int:project_id>/', ProjectGitLabConfigView.as_view(), name='gitlab-project-config'),

    # System config
    path('system-config/', SystemConfigView.as_view(), name='system-config'),

    # Confluence
    path('confluence/config/', ConfluenceConfigView.as_view(), name='confluence-config'),
    path('confluence/preview/', ConfluencePreviewView.as_view(), name='confluence-preview'),

    # Figma
    path('figma/config/', FigmaConfigView.as_view(), name='figma-config'),
    path('figma/config/test/', FigmaConfigView.as_view(), name='figma-config-test'),
]
