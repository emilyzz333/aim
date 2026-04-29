import os
import datetime
import tempfile
import logging
from pathlib import Path

import requests as http_requests
from django.conf import settings as django_settings

logger = logging.getLogger(__name__)


def save_uploaded_files(requirement_id, understand_type, files):
    """
    统一文件保存入口。
    根据 settings.FILE_UPLOAD_TO_OSS 决定保存到本地或上传至 OSS。
    返回路径/URL 列表。
    """
    if getattr(django_settings, 'FILE_UPLOAD_TO_OSS', False):
        return _save_to_oss(files)
    else:
        return _save_to_local(requirement_id, understand_type, files)


def _save_to_local(requirement_id, understand_type, files):
    """保存文件至本地 MEDIA_ROOT，返回相对路径列表"""
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    type_map = {'req_md': 'req', 'ui_design': 'ui', 'tech_md': 'tech'}
    short = type_map.get(understand_type, understand_type)
    dir_rel = Path(f'req_{requirement_id}_{short}_{ts}')
    dir_abs = django_settings.MEDIA_ROOT / dir_rel
    dir_abs.mkdir(parents=True, exist_ok=True)
    paths = []
    for f in files:
        dest = dir_abs / f.name
        if dest.exists():
            stem, suffix = os.path.splitext(f.name)
            dest = dir_abs / f'{stem}_{int(datetime.datetime.now().timestamp())}{suffix}'
        with open(dest, 'wb') as out:
            for chunk in f.chunks():
                out.write(chunk)
        paths.append(str(dir_rel / dest.name))
    return paths


def _save_to_oss(files):
    """上传文件至 OSS，返回 fileAddr URL 列表"""
    oss_url = getattr(django_settings, 'OSS_UPLOAD_URL', '')
    if not oss_url:
        raise ValueError('OSS_UPLOAD_URL 未配置')

    urls = []
    for f in files:
        # 读取文件内容
        content = f.read()
        resp = http_requests.post(
            oss_url,
            files={'file': (f.name, content, f.content_type or 'application/octet-stream')},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        file_addr = data.get('result', {}).get('fileAddr')
        if not file_addr:
            raise ValueError(f'OSS 上传失败，返回数据异常: {data}')
        urls.append(file_addr)
    return urls


def is_remote_url(path):
    """判断路径是否为远程 URL"""
    return isinstance(path, str) and path.startswith(('http://', 'https://'))


def resolve_file_path(rel_path):
    """
    将存储路径解析为本地绝对路径。
    如果是远程 URL，下载到临时文件并返回临时文件路径。
    """
    if is_remote_url(rel_path):
        return _download_to_temp(rel_path)
    return str(django_settings.MEDIA_ROOT / rel_path.lstrip('/').lstrip('\\'))


def _download_to_temp(url):
    """下载远程文件到临时目录，返回临时文件路径"""
    resp = http_requests.get(url, timeout=60)
    resp.raise_for_status()
    # 从 URL 推断扩展名
    ext = os.path.splitext(url.split('?')[0])[1] or '.tmp'
    fd, tmp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(resp.content)
    except Exception:
        os.close(fd)
        raise
    return tmp_path


def delete_stored_files(file_paths):
    """删除已存储的文件（仅本地文件，OSS 文件不做删除）"""
    for path in (file_paths or []):
        if is_remote_url(path):
            continue
        full_path = django_settings.MEDIA_ROOT / path
        if os.path.exists(full_path):
            os.remove(full_path)
