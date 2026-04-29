from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView, LogoutView, MeView,
    QwAuthView, QwCallbackView, QwLoginView, QwUserInfoView,
    UserListView, UserDetailView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('qw/auth/', QwAuthView.as_view(), name='qw_auth'),
    path('qw/callback/', QwCallbackView.as_view(), name='qw_callback'),
    path('qw/login/', QwLoginView.as_view(), name='qw_login'),
    path('qw/userinfo/', QwUserInfoView.as_view(), name='qw_userinfo'),
]
