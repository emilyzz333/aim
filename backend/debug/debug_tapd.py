#!/usr/bin/env python
"""TAPD API 调试脚本"""
import os, sys, django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aim.settings')
django.setup()

import requests
from django.conf import settings


def _get_tapd_headers():
    """返回 TAPD 认证请求头，优先级：PAT > Basic Auth"""
    import base64
    pat = getattr(settings, 'TAPD_PAT', '')
    if pat:
        return {'Authorization': f'Bearer {pat}'}
    username = getattr(settings, 'TAPD_USERNAME', '')
    api_token = getattr(settings, 'TAPD_API_TOKEN', '')
    if username and api_token:
        creds = base64.b64encode(f'{username}:{api_token}'.encode()).decode()
        return {'Authorization': f'Basic {creds}'}
    return {}


def test_tapd_auth():
    print("=" * 60)
    print("测试 TAPD 认证配置")
    print("=" * 60)

    pat = getattr(settings, 'TAPD_PAT', '')
    username = getattr(settings, 'TAPD_USERNAME', '')
    api_token = getattr(settings, 'TAPD_API_TOKEN', '')
    workspace_id = getattr(settings, 'TAPD_WORKSPACE_ID', '')

    print(f"TAPD_PAT: {'[OK]' if pat else '[X]'}")
    print(f"TAPD_USERNAME: {'[OK]' if username else '[X]'} ({username or 'N/A'})")
    print(f"TAPD_API_TOKEN: {'[OK]' if api_token else '[X]'}")
    print(f"TAPD_WORKSPACE_ID: {'[OK] ' + workspace_id if workspace_id else '[X] 未配置'}")

    return bool(pat or (username and api_token))


def test_tapd_workspace():
    print("\n" + "=" * 60)
    print("测试 TAPD Workspace 配置")
    print("=" * 60)

    workspace_id = getattr(settings, 'TAPD_WORKSPACE_ID', '')
    if not workspace_id:
        print("[X] 未配置 TAPD_WORKSPACE_ID")
        return None

    print(f"[OK] workspace_id: {workspace_id}")
    return workspace_id


def test_tapd_iterations(workspace_id):
    print("\n" + "=" * 60)
    print(f"测试获取 TAPD 迭代列表 (workspace_id={workspace_id})")
    print("=" * 60)

    headers = _get_tapd_headers()
    if not headers:
        print("[X] 未配置认证信息")
        return None

    try:
        resp = requests.get(
            'https://api.tapd.cn/iterations',
            params={'workspace_id': workspace_id, 'limit': 10,
                    'fields': 'id,name,status,begin_date,enddate'},
            headers=headers,
            timeout=10,
        )
        print(f"响应状态码: {resp.status_code}")
        resp.raise_for_status()
        data = resp.json()

        if data.get('status') == 1:
            items = data.get('data', [])
            print(f"[OK] 成功获取 {len(items)} 条迭代:")
            for item in items:
                it = item.get('Iteration', {})
                print(f"  [{it.get('id')}] {it.get('name', '')[:50]}")
                print(f"       status={it.get('status')} {it.get('begin_date','')} ~ {it.get('enddate','')}")
            return items
        else:
            print(f"[X] TAPD API 错误: {data.get('info')}")
            return None

    except requests.exceptions.HTTPError as e:
        print(f"[X] HTTP 错误: {e}")
        print(f"响应内容: {e.response.text[:300] if hasattr(e, 'response') else 'N/A'}")
        return None
    except Exception as e:
        print(f"[X] 调用失败: {str(e)}")
        return None


def test_tapd_requirements(workspace_id):
    print("\n" + "=" * 60)
    print(f"测试获取 TAPD 需求列表 (workspace_id={workspace_id})")
    print("=" * 60)

    headers = _get_tapd_headers()
    if not headers:
        print("[X] 未配置认证信息")
        return None

    try:
        resp = requests.get(
            'https://api.tapd.cn/stories',
            params={'workspace_id': workspace_id, 'limit': 10,
                    'fields': 'id,name,status,priority'},
            headers=headers,
            timeout=10,
        )
        print(f"响应状态码: {resp.status_code}")
        resp.raise_for_status()
        data = resp.json()

        if data.get('status') == 1:
            items = data.get('data', [])
            print(f"[OK] 成功获取 {len(items)} 条需求:")
            for item in items:
                story = item.get('Story', {})
                print(f"  [{story.get('id')}] {story.get('name', '')[:50]}")
                print(f"       status={story.get('status')} priority={story.get('priority')}")
            return items
        else:
            print(f"[X] TAPD API 错误: {data.get('info')}")
            return None

    except requests.exceptions.HTTPError as e:
        print(f"[X] HTTP 错误: {e}")
        print(f"响应内容: {e.response.text[:300] if hasattr(e, 'response') else 'N/A'}")
        return None
    except Exception as e:
        print(f"[X] 调用失败: {str(e)}")
        return None


def test_tapd_sync(workspace_id, project_id):
    print("\n" + "=" * 60)
    print(f"测试 TAPD 需求同步 (workspace_id={workspace_id}, project_id={project_id})")
    print("=" * 60)

    from apps.requirements.models import Requirement, Project

    try:
        project = Project.objects.get(id=project_id)
        print(f"目标项目: [{project.id}] {project.name}")
    except Project.DoesNotExist:
        print(f"[X] 项目 ID {project_id} 不存在")
        return None

    headers = _get_tapd_headers()
    if not headers:
        print("[X] 未配置认证信息")
        return None

    try:
        resp = requests.get(
            'https://api.tapd.cn/stories',
            params={'workspace_id': workspace_id, 'fields': 'id,name,description,priority,status'},
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get('status') != 1:
            print(f"[X] TAPD API 错误: {data.get('info')}")
            return None

        stories = [item.get('Story', {}) for item in data.get('data', [])]
        print(f"从 TAPD 获取到 {len(stories)} 条需求（模拟同步，不写入数据库）")

        priority_map = {'High': 'high', 'Medium': 'medium', 'Low': 'low',
                        '高': 'high', '中': 'medium', '低': 'low'}
        created = updated = 0

        for story in stories:
            story_id = story.get('id')
            exists = Requirement.objects.filter(story_id=str(story_id)).exists()
            if exists:
                print(f"  ~ [{story_id}] {story.get('name', '')[:40]} (已存在)")
                updated += 1
            else:
                print(f"  + [{story_id}] {story.get('name', '')[:40]} (新建)")
                created += 1

        print(f"\n同步预览: 新建 {created} 条，更新 {updated} 条")
        return {'created': created, 'updated': updated}

    except Exception as e:
        print(f"[X] 同步失败: {str(e)}")
        return None


def main():
    print("\n" + "=" * 60)
    print("TAPD API 调试工具")
    print("=" * 60)

    if not test_tapd_auth():
        print("\n请先在 settings.py 中配置 TAPD_PAT 或 TAPD_USERNAME+TAPD_API_TOKEN")
        return

    workspace_id = test_tapd_workspace()
    if not workspace_id:
        print("\n请在 settings.py 中配置 TAPD_WORKSPACE_ID")
        return

    test_tapd_iterations(workspace_id)
    test_tapd_requirements(workspace_id)

    print("\n" + "=" * 60)
    print("提示：如需测试同步功能，请手动调用:")
    print(f"  test_tapd_sync(workspace_id='{workspace_id}', project_id=YOUR_PROJECT_ID)")
    print("=" * 60)


if __name__ == '__main__':
    main()
