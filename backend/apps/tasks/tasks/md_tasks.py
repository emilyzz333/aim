from aim.celery import app
from django.conf import settings as django_settings
import re


def _fetch_url_content(url: str) -> str:
    """抓取 URL 内容并转为纯文本，自动识别 Confluence 链接"""
    # 检查是否为 Confluence URL，优先使用 REST API 获取
    confluence_content = _try_fetch_confluence(url)
    if confluence_content is not None:
        return confluence_content

    import requests as http_requests
    try:
        import html2text
        resp = http_requests.get(url, timeout=30, headers={'User-Agent': 'Mozilla/5.0'})
        resp.raise_for_status()
        h = html2text.HTML2Text()
        h.ignore_links = False
        return h.handle(resp.text)
    except ImportError:
        resp = http_requests.get(url, timeout=30, headers={'User-Agent': 'Mozilla/5.0'})
        resp.raise_for_status()
        return resp.text[:50000]


def _try_fetch_confluence(url: str):
    """尝试通过 Confluence REST API 获取页面内容，非 Confluence 链接返回 None"""
    import logging
    logger = logging.getLogger(__name__)

    base_url = getattr(django_settings, 'CONFLUENCE_BASE_URL', '')
    username = getattr(django_settings, 'CONFLUENCE_USERNAME', '')
    password = getattr(django_settings, 'CONFLUENCE_PASSWORD', '')

    if not base_url or not username or not password:
        return None

    # 从 URL 中提取 pageId
    page_id = _extract_confluence_page_id(url, base_url)
    if not page_id:
        return None

    try:
        return _fetch_confluence_content(base_url, username, password, page_id)
    except Exception as e:
        logger.error(f'Confluence API 失败 (url={url}): {e}')
        # 不降级，直接返回错误信息让调用方知道
        raise


from typing import Optional


def _extract_confluence_page_id(url: str, base_url: str) -> Optional[str]:
    """从 Confluence URL 中提取 pageId"""
    # 匹配 ?pageId=123456 参数
    m = re.search(r'[?&]pageId=(\d+)', url)
    if m:
        return m.group(1)
    # 匹配 /pages/viewpage.action?pageId=123456
    m = re.search(r'/pages/viewpage\.action\?pageId=(\d+)', url)
    if m:
        return m.group(1)
    # 匹配 /display/SPACE/Page+Title 格式 — 需要先通过 API 查找
    # 暂不支持，仅支持 pageId 格式
    return None


def _fetch_confluence_content(base_url: str, username: str, password: str, page_id: str) -> str:
    """通过 Confluence session 登录后获取页面内容"""
    import requests as http_requests

    session = http_requests.Session()
    login_url = base_url.rstrip('/') + '/dologin.action'
    session.post(login_url, data={
        'os_username': username,
        'os_password': password,
        'login': 'Log In',
    }, timeout=15, allow_redirects=True)

    api_url = f'{base_url.rstrip("/")}/rest/api/content/{page_id}?expand=body.storage,title'
    resp = session.get(api_url, timeout=30, headers={'Accept': 'application/json'})
    resp.raise_for_status()
    data = resp.json()

    title = data.get('title', '')
    html_body = data.get('body', {}).get('storage', {}).get('value', '')

    # 将 HTML 转为 Markdown
    try:
        import html2text
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.body_width = 0
        body_text = h.handle(html_body)
    except ImportError:
        # 简单去标签
        body_text = re.sub(r'<[^>]+>', '', html_body)

    return f'# {title}\n\n{body_text}'


def _fetch_gitlab_content(requirement, file_path: str, branch: str) -> tuple:
    """通过 GitLab API 拉取文件内容，返回 (content, commitid)"""
    import requests as http_requests
    import base64
    from apps.integrations.models import ProjectGitLabConfig

    try:
        config = ProjectGitLabConfig.objects.get(project=requirement.project)
    except ProjectGitLabConfig.DoesNotExist:
        raise ValueError(f'项目 {requirement.project_id} 未配置 GitLab')

    base_url = config.gitlab_config.base_url.rstrip('/')
    token = config.gitlab_config.private_token
    repo = config.gitlab_repo_id

    encoded_path = file_path.replace('/', '%2F')
    url = f'{base_url}/api/v4/projects/{repo}/repository/files/{encoded_path}?ref={branch or "main"}'
    resp = http_requests.get(
        url,
        headers={'PRIVATE-TOKEN': token},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    content = base64.b64decode(data['content']).decode('utf-8')
    commit_id = data.get('last_commit_id', '')
    return content, commit_id


@app.task(bind=True, max_retries=3, soft_time_limit=55, time_limit=60)
def pull_req_md(self, requirement_id):
    """拉取需求 MD 内容（URL fetch），创建 AiInputAsset 记录"""
    from apps.requirements.models import Requirement, AiInputAsset
    from apps.tasks.tasks.document_parsers import parse_url, save_images_from_markdown
    from django.contrib.auth import get_user_model
    import os
    from django.conf import settings

    try:
        req = Requirement.objects.get(id=requirement_id)
    except Requirement.DoesNotExist:
        return

    source_url = req.req_md_source_url
    if not source_url:
        return

    User = get_user_model()
    system_user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not system_user:
        return

    try:
        result = parse_url(source_url)
        save_dir = os.path.join(settings.MEDIA_ROOT, 'requirements', str(req.id), 'req_md', 'images')
        text_content, image_paths, _ = save_images_from_markdown(result['text'], result['images'], save_dir)
        AiInputAsset.objects.create(
            requirement=req,
            understand_type='req_md',
            source_type='url_fetch',
            batch_desc=source_url,
            file_paths={'source_files': [], 'images': image_paths},
            text_content=text_content or None,
            created_by=system_user,
        )
    except Exception as exc:
        raise self.retry(exc=exc, countdown=15)


@app.task(bind=True, max_retries=3, soft_time_limit=55, time_limit=60)
def pull_tech_md(self, requirement_id):
    """拉取技术 MD 内容（URL fetch / GitLab pull），创建 AiInputAsset 记录"""
    from apps.requirements.models import Requirement, AiInputAsset
    from apps.tasks.tasks.document_parsers import parse_url, save_images_from_markdown
    from django.contrib.auth import get_user_model
    import os
    from django.conf import settings

    try:
        req = Requirement.objects.get(id=requirement_id)
    except Requirement.DoesNotExist:
        return

    source_type = req.tech_md_source
    User = get_user_model()
    system_user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not system_user:
        return

    save_dir = os.path.join(settings.MEDIA_ROOT, 'requirements', str(req.id), 'tech_md', 'images')

    try:
        if source_type == 'gitlab' and req.tech_md_gitlab_path:
            content, commit_id = _fetch_gitlab_content(
                req, req.tech_md_gitlab_path, req.tech_md_gitlab_branch or 'main',
            )
            req.tech_md_gitlab_commitid = commit_id
            req.save(update_fields=['tech_md_gitlab_commitid', 'updated_at'])
            batch_desc = f'{req.tech_md_gitlab_path}@{req.tech_md_gitlab_branch}#{commit_id}'
            AiInputAsset.objects.create(
                requirement=req,
                understand_type='tech_md',
                source_type='gitlab_pull',
                batch_desc=batch_desc,
                file_paths={'source_files': [], 'images': []},
                text_content=content or None,
                created_by=system_user,
            )
        elif source_type == 'url' and req.tech_md_source_url:
            result = parse_url(req.tech_md_source_url)
            text_content, image_paths, _ = save_images_from_markdown(result['text'], result['images'], save_dir)
            AiInputAsset.objects.create(
                requirement=req,
                understand_type='tech_md',
                source_type='url_fetch',
                batch_desc=req.tech_md_source_url,
                file_paths={'source_files': [], 'images': image_paths},
                text_content=text_content or None,
                created_by=system_user,
            )
    except Exception as exc:
        raise self.retry(exc=exc, countdown=15)


@app.task(bind=True, max_retries=2, soft_time_limit=120, time_limit=130)
def fetch_asset_content(self, asset_id):
    """异步抓取 AiInputAsset 的原始内容（URL/Figma）并更新记录"""
    import os
    import logging
    from django.conf import settings
    from apps.requirements.models import AiInputAsset
    from apps.tasks.tasks.document_parsers import (
        parse_url, save_images_from_markdown, save_images_and_build_text,
    )
    from apps.integrations.figma_service import is_figma_url, fetch_figma_content

    logger = logging.getLogger(__name__)

    try:
        asset = AiInputAsset.objects.get(id=asset_id)
    except AiInputAsset.DoesNotExist:
        return

    url = asset.batch_desc or ''
    if not url:
        return

    save_dir = os.path.join(
        settings.MEDIA_ROOT, 'requirements', str(asset.requirement_id),
        asset.understand_type, 'images'
    )

    try:
        if is_figma_url(url):
            result = fetch_figma_content(
                url,
                requirement_id=str(asset.requirement_id),
                understand_type=asset.understand_type,
            )
            if result['text'] or result['images']:
                text_content, image_paths, _ = save_images_and_build_text(
                    result['text'], result['images'], save_dir
                )
            else:
                text_content = ''
                image_paths = []
        else:
            result = parse_url(url)
            text_content, image_paths, _ = save_images_from_markdown(
                result['text'], result['images'], save_dir
            )

        asset.text_content = text_content or None
        fp = asset.file_paths if isinstance(asset.file_paths, dict) else {}
        asset.file_paths = {'source_files': fp.get('source_files', []), 'images': image_paths}
        asset.save(update_fields=['text_content', 'file_paths', 'updated_at'])
        logger.info('[fetch_asset_content] asset=%d OK, text_len=%d', asset_id, len(text_content or ''))
    except Exception as exc:
        logger.error('[fetch_asset_content] asset=%d FAIL: %s', asset_id, exc)
        raise self.retry(exc=exc, countdown=10)