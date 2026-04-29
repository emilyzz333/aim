"""
Figma REST API 封装模块。

提供从 Figma 文件链接提取文本和图片的功能，供 fetch_md 接口调用。
支持三种模式（由 settings.FIGMA_FETCH_MODE 控制）：
  - rest：REST API 拉取数据 → 存入 AiInputAsset → 本地 AI 处理
  - mcp：仅存 Figma URL → 由 Claude + MCP 实时读取并处理
  - rest_mcp：REST API 拉取并存档 → AI 处理由 Claude + MCP 实时完成
"""

import logging
import os
import re
import uuid
import datetime
from typing import Optional
from urllib.parse import urlparse, parse_qs, unquote

import requests as http_requests
from django.conf import settings as django_settings

logger = logging.getLogger(__name__)


# ─── 异常定义 ─────────────────────────────────────────────────────────────────

class FigmaError(Exception):
    """Figma 集成通用异常"""
    pass


class FigmaTokenNotConfiguredError(FigmaError):
    """Figma Token 未配置"""
    def __init__(self):
        super().__init__('Figma API Token 未配置，请在 settings.py 中设置 FIGMA_API_TOKEN')


class FigmaTokenExpiredError(FigmaError):
    """Figma Token 已过期"""
    def __init__(self, expires_at: str):
        super().__init__(f'Figma API Token 已过期（过期日期：{expires_at}），请更新 settings.py 中的 FIGMA_API_TOKEN')


class FigmaTokenInvalidError(FigmaError):
    """Figma Token 无效"""
    def __init__(self):
        super().__init__('Figma API Token 无效，请检查 settings.py 中的 FIGMA_API_TOKEN 是否正确')


class FigmaAPIError(FigmaError):
    """Figma API 调用失败"""
    pass


# ─── Token 检查 ───────────────────────────────────────────────────────────────

def _check_token():
    """
    前置检查 Figma Token 配置和过期状态。
    - Token 未配置 → 抛出 FigmaTokenNotConfiguredError
    - Token 已过期 → 抛出 FigmaTokenExpiredError
    - 正常 → 返回 Token 字符串
    """
    token = getattr(django_settings, 'FIGMA_API_TOKEN', '')
    if not token:
        raise FigmaTokenNotConfiguredError()

    expires_at = getattr(django_settings, 'FIGMA_TOKEN_EXPIRES_AT', '')
    if expires_at:
        try:
            expire_date = datetime.datetime.strptime(expires_at, '%Y-%m-%d').date()
            if expire_date <= datetime.date.today():
                raise FigmaTokenExpiredError(expires_at)
        except ValueError:
            logger.warning('FIGMA_TOKEN_EXPIRES_AT 格式不正确（应为 YYYY-MM-DD）：%s', expires_at)

    return token


def _get_headers():
    """获取 Figma API 请求头"""
    token = _check_token()
    return {'X-FIGMA-TOKEN': token}


# ─── URL 解析 ─────────────────────────────────────────────────────────────────

def _parse_figma_url(url: str) -> dict:
    """
    从 Figma 链接解析 file_id 和 node_id。

    支持的链接格式：
    - https://www.figma.com/file/{file_id}/{file_name}?node-id={node_id}
    - https://www.figma.com/design/{file_id}/{file_name}?node-id={node_id}
    - https://www.figma.com/proto/{file_id}/{file_name}?node-id={node_id}
    - https://www.figma.com/board/{file_id}/{file_name}?node-id={node_id}

    返回: { 'file_id': str, 'node_id': str | None }
    """
    parsed = urlparse(url)
    path_parts = [p for p in parsed.path.split('/') if p]

    # 路径格式：/file/{file_id}/... 或 /design/{file_id}/...
    valid_prefixes = ('file', 'design', 'proto', 'board')

    if len(path_parts) < 2 or path_parts[0] not in valid_prefixes:
        raise FigmaError(f'无法解析 Figma 链接，不支持的链接格式：{url}')

    file_id = path_parts[1]

    # 解析 node-id 查询参数
    query_params = parse_qs(parsed.query)
    node_id = query_params.get('node-id', [None])[0]

    # Figma URL 中 node-id 格式为 "1-2"，API 中需要转换为 "1:2"
    if node_id:
        node_id = unquote(node_id).replace('-', ':')

    return {'file_id': file_id, 'node_id': node_id}


def is_figma_url(url: str) -> bool:
    """判断 URL 是否为 Figma 链接"""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        return parsed.hostname in ('www.figma.com', 'figma.com')
    except Exception:
        return False


# ─── Figma REST API 调用 ──────────────────────────────────────────────────────

def _get_figma_nodes(file_id: str, node_id: str = None) -> dict:
    """
    调用 Figma REST API 获取文件节点树。

    GET /v1/files/{file_id}
    如果指定 node_id，使用 ids 参数获取指定节点子树。

    返回: Figma API 响应中的节点数据
    """
    headers = _get_headers()

    if node_id:
        # 使用 /v1/files/{file_id}/nodes?ids={node_id} 获取指定节点
        api_url = f'https://api.figma.com/v1/files/{file_id}/nodes'
        params = {'ids': node_id}
    else:
        api_url = f'https://api.figma.com/v1/files/{file_id}'
        params = {}

    try:
        logger.info('[Figma API] GET %s params=%s', api_url, params)
        resp = http_requests.get(api_url, headers=headers, params=params, timeout=60)
    except http_requests.exceptions.Timeout:
        raise FigmaAPIError('Figma API 请求超时，请检查网络连接或稍后重试')
    except http_requests.exceptions.ConnectionError:
        raise FigmaAPIError('无法连接到 Figma API，请检查网络连接')

    if resp.status_code == 403:
        raise FigmaTokenInvalidError()
    if resp.status_code == 404:
        raise FigmaAPIError(f'Figma 文件不存在或无权访问（file_id={file_id}）')
    if resp.status_code != 200:
        raise FigmaAPIError(f'Figma API 返回错误（HTTP {resp.status_code}）：{resp.text[:200]}')

    data = resp.json()

    if node_id:
        # /nodes 接口返回 { nodes: { "node_id": { document: {...} } } }
        nodes = data.get('nodes', {})
        if not nodes:
            raise FigmaAPIError(f'未找到指定节点（node_id={node_id}）')
        # 取第一个（也是唯一的）节点
        node_data = list(nodes.values())[0]
        return node_data.get('document', {})
    else:
        # 完整文件返回 { document: { children: [...] } }
        return data.get('document', {})


# ─── 节点遍历与提取 ──────────────────────────────────────────────────────────

def _extract_text_and_image_nodes(node: dict) -> list:
    """
    递归遍历 Figma 节点树，收集所有 TEXT 节点和含 IMAGE fill 的节点。
    按 absoluteBoundingBox.y 升序排序，保证输出顺序与画布视觉顺序一致。

    返回: [
        { 'type': 'text', 'content': str, 'y': float },
        { 'type': 'image', 'node_id': str, 'y': float },
        ...
    ]
    """
    results = []
    _collect_nodes(node, results)

    # 按 y 坐标升序排序，y 相同时按 x 排序
    results.sort(key=lambda n: (n.get('y', 0), n.get('x', 0)))
    return results


def _collect_nodes(node: dict, results: list):
    """递归收集 TEXT 和 IMAGE 节点"""
    node_type = node.get('type', '')
    bbox = node.get('absoluteBoundingBox', {})
    y = bbox.get('y', 0)
    x = bbox.get('x', 0)

    # TEXT 节点：提取文本内容
    if node_type == 'TEXT':
        characters = node.get('characters', '').strip()
        if characters:
            results.append({
                'type': 'text',
                'content': characters,
                'y': y,
                'x': x,
            })

    # 含 IMAGE fill 的节点：标记为图片
    fills = node.get('fills', [])
    has_image_fill = any(
        fill.get('type') == 'IMAGE' and fill.get('visible', True)
        for fill in fills
    )
    if has_image_fill and node.get('id'):
        results.append({
            'type': 'image',
            'node_id': node.get('id'),
            'y': y,
            'x': x,
        })

    # 递归子节点
    for child in node.get('children', []):
        _collect_nodes(child, results)


# ─── 图片 URL 获取 ───────────────────────────────────────────────────────────

def _fetch_image_urls(file_id: str, node_ids: list) -> dict:
    """
    批量调用 Figma Images API 获取图片导出 URL。

    GET /v1/images/{file_id}?ids={id1,id2,...}&format=png&scale=2

    返回: { 'node_id': 'https://cdn.figma.com/...' , ... }

    注意：返回的 CDN URL 有时效性，必须在获取后立即下载。
    """
    if not node_ids:
        return {}

    headers = _get_headers()

    # Figma API 对 ids 参数有长度限制，分批请求（每批最多 50 个）
    batch_size = 50
    all_urls = {}

    for i in range(0, len(node_ids), batch_size):
        batch = node_ids[i:i + batch_size]
        ids_str = ','.join(batch)
        api_url = f'https://api.figma.com/v1/images/{file_id}'
        params = {
            'ids': ids_str,
            'format': 'png',
            'scale': 2,
        }

        logger.info('[Figma Images] 请求导出 URL，批次 %d/%d，节点数 %d，ids=%s',
                     i // batch_size + 1, (len(node_ids) + batch_size - 1) // batch_size,
                     len(batch), ids_str[:200])

        try:
            resp = http_requests.get(api_url, headers=headers, params=params, timeout=60)
        except http_requests.exceptions.Timeout:
            logger.warning('[Figma Images] 请求超时（批次 %d/%d）', i // batch_size + 1, (len(node_ids) + batch_size - 1) // batch_size)
            continue
        except http_requests.exceptions.ConnectionError as e:
            logger.warning('[Figma Images] 连接失败（批次 %d/%d）：%s', i // batch_size + 1, (len(node_ids) + batch_size - 1) // batch_size, str(e)[:200])
            continue

        logger.info('[Figma Images] 响应 HTTP %d，body 前200字符：%s', resp.status_code, resp.text[:200])

        if resp.status_code == 403:
            raise FigmaTokenInvalidError()
        if resp.status_code != 200:
            logger.warning('[Figma Images] API 返回错误（HTTP %d）：%s', resp.status_code, resp.text[:200])
            continue

        data = resp.json()
        images = data.get('images', {})
        # 记录每个节点的 CDN URL（null 表示导出失败）
        for nid, cdn in images.items():
            logger.info('[Figma Images] node_id=%s → cdn_url=%s', nid, (cdn[:120] + '...') if cdn and len(cdn) > 120 else cdn)
        all_urls.update(images)

    logger.info('[Figma Images] 共获取 %d 个导出 URL（其中 %d 个为 null）',
                len(all_urls), sum(1 for v in all_urls.values() if not v))
    return all_urls


# ─── 图片下载与保存 ──────────────────────────────────────────────────────────

def _download_and_save_images(image_urls: dict, requirement_id: str, understand_type: str) -> dict:
    """
    下载 Figma 图片到本地或 OSS（遵循 FILE_UPLOAD_TO_OSS 开关）。
    单张失败不中断，标记 [图片N-下载失败]。

    image_urls: { 'node_id': 'https://cdn.figma.com/...' }
    返回: { 'node_id': { 'path': str, 'success': bool } }
    """
    results = {}
    use_oss = getattr(django_settings, 'FILE_UPLOAD_TO_OSS', False)

    # 创建本地保存目录
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    type_map = {'req_md': 'req', 'ui_design': 'ui', 'ui_design_web': 'ui_web', 'ui_design_app': 'ui_app', 'tech_md': 'tech'}
    short = type_map.get(understand_type, understand_type)
    dir_rel = f'req_{requirement_id}_figma_{short}_{ts}'

    if not use_oss:
        dir_abs = django_settings.MEDIA_ROOT / dir_rel
        dir_abs.mkdir(parents=True, exist_ok=True)

    for node_id, cdn_url in image_urls.items():
        if not cdn_url:
            logger.warning('[Figma Download] node_id=%s CDN URL 为空，跳过', node_id)
            results[node_id] = {'path': '', 'success': False}
            continue

        try:
            logger.info('[Figma Download] 下载图片 node_id=%s, url=%s', node_id, cdn_url[:120])
            resp = http_requests.get(cdn_url, timeout=30)
            resp.raise_for_status()
            img_bytes = resp.content
            logger.info('[Figma Download] 下载成功 node_id=%s, size=%d bytes, content_type=%s',
                        node_id, len(img_bytes), resp.headers.get('Content-Type', 'unknown'))

            filename = f'figma_{node_id.replace(":", "_")}_{uuid.uuid4().hex[:8]}.png'

            if use_oss:
                oss_url = getattr(django_settings, 'OSS_UPLOAD_URL', '')
                if not oss_url:
                    raise ValueError('OSS_UPLOAD_URL 未配置')
                oss_resp = http_requests.post(
                    oss_url,
                    files={'file': (filename, img_bytes, 'image/png')},
                    timeout=60,
                )
                oss_resp.raise_for_status()
                data = oss_resp.json()
                file_addr = data.get('result', {}).get('fileAddr')
                if not file_addr:
                    raise ValueError(f'OSS 上传失败，返回数据异常: {data}')
                results[node_id] = {'path': file_addr, 'success': True}
                logger.info('[Figma Download] OSS 上传成功 node_id=%s, path=%s', node_id, file_addr[:100])
            else:
                filepath = django_settings.MEDIA_ROOT / dir_rel / filename
                with open(filepath, 'wb') as f:
                    f.write(img_bytes)
                results[node_id] = {'path': str(os.path.join(dir_rel, filename)), 'success': True}
                logger.info('[Figma Download] 本地保存成功 node_id=%s, path=%s', node_id, filepath)

        except Exception as e:
            logger.warning('[Figma Download] 图片下载/保存失败 node_id=%s：%s', node_id, str(e))
            results[node_id] = {'path': '', 'success': False}

    return results


# ─── REST 模式完整流程 ───────────────────────────────────────────────────────

def _fetch_figma_content_rest(url: str, requirement_id: str = '', understand_type: str = 'req_md') -> dict:
    """
    REST 模式：串联所有步骤，从 Figma 链接提取文本和图片。

    1. 解析 URL → file_id, node_id
    2. 检查 Token
    3. 获取节点树
    4. 提取 TEXT 和 IMAGE 节点，按 y 坐标排序
    5. 批量获取图片导出 URL
    6. 下载图片到本地/OSS
    7. 拼接文本（含 [图片N] 占位符）

    返回: { 'text': str, 'images': list[bytes] }
    与 parse_url() 返回格式一致，可直接传给 save_images_and_build_text()。
    """
    # 1. 解析 URL
    parsed = _parse_figma_url(url)
    file_id = parsed['file_id']
    node_id = parsed.get('node_id')

    logger.info('[Figma] ① 解析链接 file_id=%s, node_id=%s, url=%s', file_id, node_id, url)

    # 2. Token 检查（由 _get_headers 内部完成）
    # 3. 获取节点树
    root_node = _get_figma_nodes(file_id, node_id)
    logger.info('[Figma] ② 获取节点树成功，根节点 type=%s, name=%s, children=%d',
                root_node.get('type'), root_node.get('name', ''),
                len(root_node.get('children', [])))

    # 4. 提取 TEXT 和 IMAGE 节点
    extracted = _extract_text_and_image_nodes(root_node)

    text_count = sum(1 for n in extracted if n['type'] == 'text')
    image_nodes = [n for n in extracted if n['type'] == 'image']
    logger.info('[Figma] ③ 提取到 %d 个文本节点、%d 个图片节点', text_count, len(image_nodes))
    for i, node in enumerate(image_nodes):
        logger.info('[Figma]    图片节点[%d]: node_id=%s, y=%.1f', i, node['node_id'], node.get('y', 0))

    # 5. 获取图片导出 URL
    image_node_ids = [n['node_id'] for n in image_nodes]
    image_cdn_urls = _fetch_image_urls(file_id, image_node_ids) if image_node_ids else {}
    logger.info('[Figma] ④ 图片导出 URL 获取完成，请求 %d 个，返回 %d 个', len(image_node_ids), len(image_cdn_urls))
    for nid, cdn in image_cdn_urls.items():
        logger.info('[Figma]    CDN URL: node_id=%s, url=%s', nid, (cdn[:120] + '...') if cdn and len(cdn) > 120 else cdn)

    # 6. 下载图片
    downloaded = _download_and_save_images(image_cdn_urls, requirement_id, understand_type) if image_cdn_urls else {}
    success_count = sum(1 for v in downloaded.values() if v.get('success'))
    fail_count = len(downloaded) - success_count
    logger.info('[Figma] ⑤ 图片下载完成，成功 %d 张，失败 %d 张', success_count, fail_count)
    for nid, dl in downloaded.items():
        logger.info('[Figma]    下载结果: node_id=%s, success=%s, path=%s', nid, dl.get('success'), dl.get('path', '')[:100])

    # 7. 拼接文本，插入 [图片N] 占位符
    text_parts = []
    images_bytes = []
    img_index = 1

    for item in extracted:
        if item['type'] == 'text':
            text_parts.append(item['content'])
        elif item['type'] == 'image':
            node_id_key = item['node_id']
            dl_result = downloaded.get(node_id_key, {})
            if dl_result.get('success'):
                text_parts.append(f'[图片{img_index}]')
                # 读取已下载图片的字节数据
                img_path = dl_result['path']
                try:
                    from utils.file_storage import is_remote_url, resolve_file_path
                    if is_remote_url(img_path):
                        # OSS 模式：重新下载到内存
                        resp = http_requests.get(img_path, timeout=30)
                        resp.raise_for_status()
                        images_bytes.append(resp.content)
                    else:
                        # 本地模式：直接读取文件
                        abs_path = resolve_file_path(img_path)
                        with open(abs_path, 'rb') as f:
                            images_bytes.append(f.read())
                except Exception as e:
                    logger.warning('读取已下载图片失败（%s）：%s', img_path, str(e))
                    images_bytes.append(b'')
            else:
                text_parts.append(f'[图片{img_index}-下载失败]')
                images_bytes.append(b'')
            img_index += 1

    final_text = '\n\n'.join(text_parts)
    logger.info('[Figma] ⑥ 拼接完成，文本长度 %d，图片 %d 张（含 %d 张下载失败）',
                len(final_text), len(images_bytes),
                sum(1 for b in images_bytes if not b))

    return {'text': final_text, 'images': images_bytes}


# ─── 顶层入口函数 ────────────────────────────────────────────────────────────

def fetch_figma_content(url: str, requirement_id: str = '', understand_type: str = 'req_md') -> dict:
    """
    Figma 内容获取入口。根据 FIGMA_FETCH_MODE 路由到不同模式：

    - rest：调用 REST API 拉取文本+图片，返回完整数据
    - mcp：仅返回空数据（内容在解析阶段由 Claude + MCP 获取）
    - rest_mcp：调用 REST API 拉取并存档，返回完整数据（AI 处理时会由 Claude + MCP 实时读取）

    返回: { 'text': str, 'images': list[bytes] }
    """
    mode = getattr(django_settings, 'FIGMA_FETCH_MODE', 'rest')

    if mode in ('rest', 'rest_mcp'):
        return _fetch_figma_content_rest(url, requirement_id, understand_type)
    elif mode == 'mcp':
        # MCP 模式：也执行 REST 拉取，将数据落库到 AiInputAsset（调试阶段可查看拉取数据）
        # AI 解析阶段仍由 Claude + MCP 完成
        logger.info('Figma MCP 模式：执行 REST 数据拉取（调试用），AI 解析将在后续阶段由 Claude + MCP 完成')
        return _fetch_figma_content_rest(url, requirement_id, understand_type)
    else:
        raise FigmaError(f'不支持的 FIGMA_FETCH_MODE：{mode}，可选值为 rest / mcp / rest_mcp')


def verify_figma_token() -> dict:
    """
    验证 Figma Token 有效性，调用 GET /v1/me。

    返回: { 'valid': bool, 'user': str, 'email': str, 'error': str }
    """
    try:
        headers = _get_headers()
    except FigmaError as e:
        return {'valid': False, 'user': '', 'email': '', 'error': str(e)}

    try:
        resp = http_requests.get('https://api.figma.com/v1/me', headers=headers, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            return {
                'valid': True,
                'user': data.get('handle', ''),
                'email': data.get('email', ''),
                'error': '',
            }
        elif resp.status_code == 403:
            return {'valid': False, 'user': '', 'email': '', 'error': 'Token 无效或已失效'}
        else:
            return {'valid': False, 'user': '', 'email': '', 'error': f'API 返回异常（HTTP {resp.status_code}）'}
    except Exception as e:
        return {'valid': False, 'user': '', 'email': '', 'error': f'连接失败：{str(e)}'}


def get_figma_config_status() -> dict:
    """
    获取 Figma 配置状态。

    返回: {
        'configured': bool,
        'token_expires_at': str,
        'expires_in_days': int | None,
        'expired': bool,
        'mode': str,
    }
    """
    token = getattr(django_settings, 'FIGMA_API_TOKEN', '')
    expires_at = getattr(django_settings, 'FIGMA_TOKEN_EXPIRES_AT', '')
    mode = getattr(django_settings, 'FIGMA_FETCH_MODE', 'rest')

    configured = bool(token)
    expired = False
    expires_in_days = None

    if expires_at:
        try:
            expire_date = datetime.datetime.strptime(expires_at, '%Y-%m-%d').date()
            delta = expire_date - datetime.date.today()
            expires_in_days = delta.days
            expired = expires_in_days <= 0
        except ValueError:
            pass

    return {
        'configured': configured,
        'token_expires_at': expires_at,
        'expires_in_days': expires_in_days,
        'expired': expired,
        'mode': mode,
    }
