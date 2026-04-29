from rest_framework import serializers
from .models import User, Team


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    is_admin_or_above = serializers.BooleanField(read_only=True)
    is_super_admin = serializers.BooleanField(read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    leader_name = serializers.CharField(source='leader.display_name', read_only=True)
    leader_username = serializers.CharField(source='leader.username', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'display_name', 'role', 'role_display', 'is_admin_or_above', 'is_super_admin',
            'qw_userid', 'qw_openid', 'qw_username', 'qw_department', 'qw_avatar',
            'team', 'team_name', 'leader', 'leader_name', 'leader_username',
            'is_active', 'date_joined',
        ]
        read_only_fields = ['date_joined']


class TeamSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    member_count = serializers.SerializerMethodField()
    members = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True, required=False)

    class Meta:
        model = Team
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_member_count(self, obj):
        return obj.members.count()
