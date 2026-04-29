import json
import base64
import os
import logging
import requests as http_requests
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings

from .models import GitLabConfig, ProjectGitLabConfig
from apps.users.models import User
from apps.projects.models import Project
from apps.requirements.models import Requirement
from apps.tests.models import FunctionCase

_ai_logger = logging.getLogger('ai_service')


# ─────────────────────────────
# AI 服务层（统一封装）
# ─────────────────────────────

class AIService:
    """统一 AI 调用层，支持 DeepSeek / Claude API"""

    @staticmethod
    def _call_deepseek(prompt: str, system: str = '') -> str:
        api_key = getattr(settings, 'DEEPSEEK_API_KEY', '')
        if not api_key:
            return None
        payload = {
            'model': 'deepseek-chat',
            'messages': [
                {'role': 'system', 'content': system or '你是一个专业的软件研发助手。'},
                {'role': 'user', 'content': prompt},
            ],
        }
        resp = http_requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json=payload,
            timeout=180,
        )
        resp.raise_for_status()
        return resp.json()['choices'][0]['message']['content']

    @staticmethod
    def _get_claude_configs():
        """获取所有可用的 Claude API 配置"""
        configs = []
        anthropic_configs = getattr(settings, 'ANTHROPIC_CONFIGS', [])
        if anthropic_configs:
            for cfg in anthropic_configs:
                if cfg.get('auth_token'):
                    configs.append({
                        'name': cfg.get('name', 'Unnamed'),
                        'base_url': cfg.get('base_url', 'https://api.anthropic.com'),
                        'auth_token': cfg['auth_token'],
                    })
        if not configs:
            auth_token = getattr(settings, 'ANTHROPIC_AUTH_TOKEN', '') or getattr(settings, 'CLAUDE_API_KEY', '')
            if auth_token:
                configs.append({
                    'name': 'Default',
                    'base_url': getattr(settings, 'ANTHROPIC_BASE_URL', '') or 'https://api.anthropic.com',
                    'auth_token': auth_token,
                })
        return configs

    @classmethod
    def _call_claude_api(cls, payload: dict, tag: str = 'Claude',
                         extra_headers: dict = None, timeout: int = 180) -> dict:
        """
        公共底层：轮询所有 Claude API 配置发送请求，返回原始 resp_json。
        失败时 raise 最后一个异常。
        """
        configs = cls._get_claude_configs()
        if not configs:
            _ai_logger.error('[%s] 无可用 Claude API 配置', tag)
            return None

        _ai_logger.info('[%s] 开始调用 | configs=%d', tag, len(configs))

        headers_base = {
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        }
        if extra_headers:
            headers_base.update(extra_headers)

        last_error = None
        for config in configs:
            endpoint = f'{config["base_url"].rstrip("/")}/v1/messages'
            _ai_logger.info('[%s] 尝试 API=%s | endpoint=%s', tag, config['name'], endpoint)
            headers = {**headers_base, 'x-api-key': config['auth_token']}
            try:
                resp = http_requests.post(
                    endpoint, headers=headers, json=payload, timeout=timeout,
                )
                elapsed = resp.elapsed.total_seconds() if hasattr(resp, 'elapsed') else -1
                _ai_logger.info('[%s] API=%s | HTTP=%d | %.1fs', tag, config['name'], resp.status_code, elapsed)
                resp.raise_for_status()
                resp_json = resp.json()
                return resp_json
            except Exception as e:
                _ai_logger.error('[%s] API=%s 失败: %s', tag, config['name'], e)
                last_error = e
                continue

        _ai_logger.error('[%s] 所有 API 配置均失败', tag)
        if last_error:
            raise last_error
        return None

    @classmethod
    def _extract_text_from_response(cls, resp_json: dict) -> str:
        """从 Claude / OpenAI 兼容响应中提取文本（公共方法）"""
        if not resp_json:
            return ''
        # Anthropic 格式: content 数组中 type=text 的块
        if 'content' in resp_json and isinstance(resp_json['content'], list):
            parts = []
            for block in resp_json['content']:
                if isinstance(block, dict) and block.get('type') == 'text':
                    parts.append(block.get('text', ''))
            if parts:
                return '\n'.join(parts)
            # 有些代理返回的 content 直接是字符串列表
            if resp_json['content'] and isinstance(resp_json['content'][0], str):
                return resp_json['content'][0]
        # OpenAI 兼容格式: choices[0].message.content
        if 'choices' in resp_json and resp_json['choices']:
            choice = resp_json['choices'][0]
            msg = choice.get('message', {})
            content = msg.get('content', '')
            if content:
                return content
        return ''

    # ─── 保留旧名称做兼容 ───
    _extract_vision_text = _extract_text_from_response

    @classmethod
    def _compress_image(cls, raw: bytes, max_kb: int = 50) -> bytes:
        """压缩图片到指定大小以内，返回 JPEG 字节"""
        if len(raw) <= max_kb * 1024:
            return raw
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(raw))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        quality = 85
        scale = 0.9
        for _ in range(8):
            buf = io.BytesIO()
            w, h = img.size
            img_resized = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            img_resized.save(buf, format='JPEG', quality=quality)
            if buf.tell() <= max_kb * 1024:
                return buf.getvalue()
            scale *= 0.85
            quality = max(quality - 10, 50)
        buf = io.BytesIO()
        img.resize((int(w * 0.4), int(h * 0.4)), Image.LANCZOS).save(buf, format='JPEG', quality=50)
        return buf.getvalue()

    # ─── Claude 纯文本调用 ───

    @classmethod
    def _call_claude(cls, prompt: str, system: str = '') -> str:
        """纯文本调用 Claude，基于公共底层 _call_claude_api。"""
        payload = {
            'model': 'claude-sonnet-4-6',
            'max_tokens': 8192,
            'system': system or '你是一个专业的软件研发助手。',
            'messages': [{'role': 'user', 'content': prompt}],
        }
        _ai_logger.info('[Claude] prompt=%d 字符', len(prompt))
        resp_json = cls._call_claude_api(payload, tag='Claude')
        result = cls._extract_text_from_response(resp_json)
        if result:
            _ai_logger.info('[Claude] 成功 | 响应=%d 字符', len(result))
        return result or None

    # ─── Claude Vision（多图+文本）───

    @classmethod
    def complete_with_images(cls, prompt: str, image_paths: list, system: str = '') -> str:
        """多图+文本调用 Claude Vision，基于公共底层 _call_claude_api。"""
        import uuid, time

        configs = cls._get_claude_configs()
        if not configs:
            _ai_logger.error('[Vision] 无可用 Claude API 配置')
            return '[Claude API Key 未配置，无法执行多模态 AI 识别]'

        valid_paths = [p for p in image_paths if p and os.path.exists(p)]
        missing = [p for p in image_paths if p and not os.path.exists(p)]
        _ai_logger.info('[Vision] 传入=%d | 有效=%d | 缺失=%s',
                        len(image_paths), len(valid_paths), missing or '无')

        for i, path in enumerate(valid_paths, 1):
            size_kb = os.path.getsize(path) / 1024
            _ai_logger.info('[Vision] 图片%d: %s | %.1fKB', i, os.path.basename(path), size_kb)

        content = []
        truncated = False
        if len(valid_paths) > 20:
            valid_paths = valid_paths[:20]
            truncated = True
            _ai_logger.warning('[Vision] 图片数超过20张，已截断至前20张')

        for path in valid_paths:
            with open(path, 'rb') as f:
                raw = f.read()
            raw = cls._compress_image(raw, max_kb=50)
            data = base64.standard_b64encode(raw).decode('utf-8')
            content.append({
                'type': 'image',
                'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': data},
            })

        request_id = f"{uuid.uuid4().hex[:8]}_{int(time.time())}"
        text = prompt
        if truncated:
            text += '\n\n（注：部分图片已省略，仅分析前20张）'
        text += f'\n\n[请求ID: {request_id}]'
        content.append({'type': 'text', 'text': text})

        payload = {
            'model': 'claude-sonnet-4-6',
            'max_tokens': 4096,
            'system': system or '你是一个专业的软件研发助手。',
            'messages': [{'role': 'user', 'content': content}],
        }

        _ai_logger.info('[Vision] 请求ID=%s | 图片=%d | prompt=%d',
                        request_id, len(content) - 1, len(text))

        try:
            resp_json = cls._call_claude_api(
                payload, tag='Vision',
                extra_headers={
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'X-Request-ID': request_id,
                },
            )
        except Exception as e:
            _ai_logger.error('[Vision] 调用失败: %s', e)
            return f'[Claude API 调用失败: {e}]'

        if resp_json is None:
            return '[Claude API 未配置]'

        result = cls._extract_text_from_response(resp_json)
        if not result:
            _ai_logger.warning('[Vision] 响应为空 | raw前300: %s', str(resp_json)[:300])
            return '[Claude API 调用失败: 响应为空]'

        _ai_logger.info('[Vision] 成功 | 响应=%d 字符', len(result))
        if request_id not in result:
            _ai_logger.warning('[Vision] 响应中未包含请求ID，可能是缓存结果')
        result = result.replace(f'[请求ID: {request_id}]', '').strip()
        return result

    # ─── Prompt 模板 ───
    SYSTEM_PROMPTS = {
        'req_md': (
            '你是一个资深产品经理，擅长从需求文档和UI截图中提取关键业务逻辑、用户故事和验收标准。'
            '请用结构化的 Markdown 格式输出：功能概述、核心业务流程、边界条件、验收标准。'
        ),
        'ui_design': (
            '你是一个资深 UI/UX 分析师，擅长从设计稿截图中识别界面结构、交互流程和组件规格。'
            '请用结构化的 Markdown 格式输出：页面布局描述、核心交互流程、关键组件清单、设计细节备注。'
        ),
        'tech_md': (
            '你是一个资深软件架构师，擅长从技术方案文档中提取架构决策、接口设计和实现要点。'
            '请用结构化的 Markdown 格式输出：技术方案概述、核心模块设计、接口定义、风险与注意事项。'
        ),
    }

    @classmethod
    def complete_with_mcp(cls, prompt: str, tools: list = None, system: str = '') -> str:
        """调用 Claude API + MCP tool，基于公共底层 _call_claude_api。"""
        payload = {
            'model': 'claude-sonnet-4-6',
            'max_tokens': 8192,
            'system': system or '你是一个专业的软件研发助手。',
            'messages': [{'role': 'user', 'content': prompt}],
        }
        if tools:
            payload['tools'] = tools

        try:
            resp_json = cls._call_claude_api(payload, tag='MCP', timeout=180)
        except Exception as e:
            _ai_logger.error('[MCP] 所有 API 均失败: %s', e)
            return f'[Claude MCP 调用失败: {e}]'

        if resp_json is None:
            return '[Claude API 未配置]'

        # MCP 响应可能包含多个 content block（text + tool_use + tool_result）
        result = cls._extract_text_from_response(resp_json)
        if result:
            return result
        # 如果没有 text block，返回完整 JSON 供调用方解析
        return json.dumps(resp_json.get('content', []), ensure_ascii=False)

    @classmethod
    def complete(cls, prompt: str, system: str = '') -> str:
        """优先 DeepSeek，无 key 则尝试 Claude，均无则返回 mock"""
        import logging
        logger = logging.getLogger('ai_service.complete')
        try:
            result = cls._call_deepseek(prompt, system)
            if result:
                logger.info('[complete] DeepSeek 调用成功')
                return result
        except Exception as e:
            logger.warning('[complete] DeepSeek 调用失败: %s', e)
        try:
            result = cls._call_claude(prompt, system)
            if result:
                logger.info('[complete] Claude 调用成功')
                return result
        except Exception as e:
            logger.error('[complete] Claude 调用失败: %s', e)
        # 降级 mock
        snippet = prompt[:100]
        configs = cls._get_claude_configs()
        logger.error('[complete] 所有 AI 服务均不可用，降级 mock。Claude configs=%d', len(configs))
        return (
            '[AI 服务未配置 API Key，此处为模拟响应]\n\n'
            f'针对输入：{snippet}...\n\n'
            '建议配置 settings.DEEPSEEK_API_KEY 或 settings.CLAUDE_API_KEY 以启用真实 AI。'
        )


# ─────────────────────────────
# AI 需求分析接口
# ─────────────────────────────

class AIRequirementAnalysisView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        requirement_id = request.data.get('requirement_id')
        description = request.data.get('description', '')

        if requirement_id:
            try:
                req = Requirement.objects.get(id=requirement_id)
                description = req.name + '\n\n' + (req.description or '')
            except Requirement.DoesNotExist:
                return Response({'detail': '需求不存在'}, status=status.HTTP_404_NOT_FOUND)

        if not description:
            return Response({'detail': '请提供需求描述'}, status=status.HTTP_400_BAD_REQUEST)

        system = '你是一个资深产品经理，擅长需求分析和拆解。'
        prompt = (
            '请对以下需求进行分析，输出：\n'
            '1. 需求摘要（2-3句话）\n'
            '2. 关键功能点列表（5-10条）\n'
            '3. 潜在风险点（3-5条）\n'
            '4. 建议拆解的子需求（3-8条，每条一句话）\n\n'
            '需求内容：\n' + description
        )

        analysis = AIService.complete(prompt, system)
        return Response({'analysis': analysis})


# ─────────────────────────────
# AI 测试用例生成接口
# ─────────────────────────────

class AITestCaseGenerationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        requirement_id = request.data.get('requirement_id')
        if not requirement_id:
            return Response({'detail': '请提供 requirement_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            req = Requirement.objects.get(id=requirement_id)
        except Requirement.DoesNotExist:
            return Response({'detail': '需求不存在'}, status=status.HTTP_404_NOT_FOUND)

        system = '你是一个资深测试工程师，擅长编写全面的测试用例。'
        prompt = (
            '请为以下需求生成测试用例，以 JSON 数组格式输出，每条用例包含：\n'
            '- name: 用例名称\n'
            '- precondition: 前置条件\n'
            '- steps: 测试步骤（字符串数组）\n'
            '- expected: 预期结果\n\n'
            '需求名称：' + req.name + '\n'
            '需求描述：' + (req.description or '无') + '\n\n'
            '请生成 5-10 个测试用例，涵盖正常流程、边界值和异常情况。输出纯 JSON，不要包含其他文字。'
        )

        raw = AIService.complete(prompt, system)

        # 尝试从响应中提取 JSON
        test_cases = []
        try:
            start = raw.find('[')
            end = raw.rfind(']') + 1
            if start != -1 and end > start:
                test_cases = json.loads(raw[start:end])
        except Exception:
            pass

        # 若解析成功，可选择自动写入数据库
        created_ids = []
        if test_cases and request.data.get('auto_create', False):
            for idx, tc in enumerate(test_cases):
                case_id = f'AI-{req.id}-{idx + 1:03d}'
                steps_val = tc.get('steps', '')
                if isinstance(steps_val, list):
                    steps_val = '\n'.join(steps_val)
                case = FunctionCase.objects.create(
                    case_id=case_id,
                    project=req.project,
                    requirement=req,
                    title=tc.get('name', '未命名'),
                    steps=steps_val,
                    expected_result=tc.get('expected', ''),
                    source='ai',
                    created_by=request.user,
                )
                created_ids.append(case.id)

        return Response({
            'test_cases': test_cases,
            'raw': raw,
            'created_ids': created_ids,
        })


# ─────────────────────────────
# AI 代码生成接口
# ─────────────────────────────

class AICodeGenerationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        description = request.data.get('description', '')
        technical_spec = request.data.get('technical_spec', '')
        language = request.data.get('language', 'Python')

        if not description:
            return Response({'detail': '请提供功能描述'}, status=status.HTTP_400_BAD_REQUEST)

        system = '你是一个资深 ' + language + ' 工程师，编写高质量、可维护的代码。'
        tech_section = ('技术方案：\n' + technical_spec + '\n\n') if technical_spec else ''
        prompt = (
            '请根据以下需求生成 ' + language + ' 代码：\n\n'
            '功能描述：\n' + description + '\n\n'
            + tech_section +
            '要求：\n'
            '- 代码结构清晰，含必要注释\n'
            '- 遵循最佳实践\n'
            '- 包含基本的错误处理\n'
            '- 直接输出代码，不需要解释'
        )

        code = AIService.complete(prompt, system)
        return Response({'code': code, 'language': language})


# ─────────────────────────────
# AI 对话接口（需求助手）
# ─────────────────────────────

class AIChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_message = request.data.get('message', '').strip()
        requirement_id = request.data.get('requirement_id')
        inject_context = request.data.get('inject_context', False)
        images = request.FILES.getlist('images')

        if not user_message and not images:
            return Response({'detail': '消息不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        system = (
            '你是一个专业的产品研发助手，擅长需求分析、测试用例设计、流程优化等。'
            '请用简洁、专业的中文回答用户的问题。'
        )

        # 注入需求上下文
        context_prefix = ''
        if inject_context and requirement_id:
            try:
                from apps.requirements.models import Requirement as Req
                req = Req.objects.get(id=requirement_id)
                context_prefix = (
                    f'[当前需求上下文]\n'
                    f'需求名称：{req.name}\n'
                    f'需求描述：{req.description or "暂无"}\n\n'
                    f'[用户问题]\n'
                )
            except Exception:
                pass

        prompt = context_prefix + (user_message or '请结合我上传的截图进行分析。')

        if images:
            import tempfile, os
            tmp_paths = []
            try:
                for img in images:
                    suffix = os.path.splitext(img.name)[1] or '.png'
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                        for chunk in img.chunks():
                            tmp.write(chunk)
                        tmp_paths.append(tmp.name)
                reply = AIService.complete_with_images(prompt, tmp_paths, system)
            finally:
                for p in tmp_paths:
                    try:
                        os.unlink(p)
                    except Exception:
                        pass
        else:
            reply = AIService.complete(prompt, system)

        return Response({'reply': reply})


# ─────────────────────────────
# 项目级 GitLab 配置
# ─────────────────────────────

class ProjectGitLabConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            config = ProjectGitLabConfig.objects.get(project_id=project_id)
            return Response({
                'project_id': project_id,
                'repo_url': config.repo_url,
                'api_url': config.api_url,
                'has_token': bool(config.access_token),
                'updated_at': config.updated_at,
            })
        except ProjectGitLabConfig.DoesNotExist:
            return Response({'detail': '未配置'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': '项目不存在'}, status=status.HTTP_404_NOT_FOUND)

        repo_url = request.data.get('repo_url', '').strip()
        access_token = request.data.get('access_token', '').strip()
        api_url = request.data.get('api_url', 'https://gitlab.com/api/v4/').strip()

        if not repo_url or not access_token:
            return Response({'detail': 'repo_url 和 access_token 为必填项'}, status=status.HTTP_400_BAD_REQUEST)

        ProjectGitLabConfig.objects.update_or_create(
            project=project,
            defaults={
                'repo_url': repo_url,
                'access_token': access_token,
                'api_url': api_url,
                'created_by': request.user,
            },
        )
        return Response({'message': 'GitLab 配置已保存', 'project_id': project_id})

    def delete(self, request, project_id):
        ProjectGitLabConfig.objects.filter(project_id=project_id).delete()
        return Response({'message': '已删除'})


# ─────────────────────────────
# 用户级 GitLab 配置
# ─────────────────────────────

class GitLabConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            config = GitLabConfig.objects.get(user=request.user)
            return Response({
                'api_url': config.api_url,
                'has_token': bool(config.private_token),
                'updated_at': config.updated_at,
            })
        except GitLabConfig.DoesNotExist:
            return Response({'detail': '未配置'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        private_token = request.data.get('private_token', '').strip()
        api_url = request.data.get('api_url', 'https://gitlab.com/api/v4/').strip()
        if not private_token:
            return Response({'detail': 'private_token 为必填项'}, status=status.HTTP_400_BAD_REQUEST)

        GitLabConfig.objects.update_or_create(
            user=request.user,
            defaults={'private_token': private_token, 'api_url': api_url},
        )
        return Response({'message': 'GitLab 配置已保存'})


# ─────────────────────────────
# TAPD 集成
# ─────────────────────────────

def _tapd_headers():
    """返回 TAPD 认证请求头，优先级：PAT > Basic Auth"""
    pat = getattr(settings, 'TAPD_PAT', '')
    if pat:
        return {'Authorization': f'Bearer {pat}'}
    username = getattr(settings, 'TAPD_USERNAME', '')
    api_token = getattr(settings, 'TAPD_API_TOKEN', '')
    if username and api_token:
        import base64
        creds = base64.b64encode(f'{username}:{api_token}'.encode()).decode()
        return {'Authorization': f'Basic {creds}'}
    return {}


class TAPDAuthView(APIView):
    """TAPD 配置状态查询（配置在 settings.py 中）"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pat = getattr(settings, 'TAPD_PAT', '')
        basic_configured = bool(
            getattr(settings, 'TAPD_USERNAME', '') and
            getattr(settings, 'TAPD_API_TOKEN', '')
        )
        oauth_configured = bool(
            getattr(settings, 'TAPD_APP_ID', '') and
            getattr(settings, 'TAPD_APP_SECRET', '')
        )
        return Response({
            'pat_configured': bool(pat),
            'basic_auth_configured': basic_configured,
            'oauth_configured': oauth_configured,
            'auth_type': 'pat' if pat else ('basic' if basic_configured else ('oauth' if oauth_configured else None)),
        })


class TAPDProjectsView(APIView):
    """返回 settings.py 中配置的 workspace，前端直接使用，无需动态拉取项目列表"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pat = getattr(settings, 'TAPD_PAT', '')
        if not pat:
            return Response({'detail': '请先在 settings.py 中配置 TAPD_PAT'}, status=status.HTTP_400_BAD_REQUEST)

        workspace_id = getattr(settings, 'TAPD_WORKSPACE_ID', '')
        if not workspace_id:
            return Response({'detail': '请在 settings.py 中配置 TAPD_WORKSPACE_ID'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'projects': [{'id': workspace_id, 'name': f'Workspace {workspace_id}'}]})


class TAPDRequirementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id:
            return Response({'detail': 'workspace_id 为必填参数'}, status=status.HTTP_400_BAD_REQUEST)

        pat = getattr(settings, 'TAPD_PAT', '')
        if not pat:
            return Response({'detail': '请先在 settings.py 中配置 TAPD_PAT'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            import requests
            resp = requests.get(
                'https://api.tapd.cn/stories',
                params={'workspace_id': workspace_id},
                headers=_tapd_headers(),
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get('status') == 1:
                requirements = []
                for item in data.get('data', []):
                    story = item.get('Story', {})
                    requirements.append({
                        'id': story.get('id'),
                        'name': story.get('name'),
                        'description': story.get('description', ''),
                        'priority': story.get('priority', ''),
                        'status': story.get('status', ''),
                    })
                return Response({'requirements': requirements})
            else:
                return Response({'detail': f'TAPD API 错误: {data.get("info")}'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({'detail': f'调用 TAPD API 失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TAPDIterationsView(APIView):
    """拉取 TAPD 迭代列表"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_id = request.query_params.get('workspace_id') or getattr(settings, 'TAPD_WORKSPACE_ID', '')
        if not workspace_id:
            return Response({'detail': 'workspace_id 为必填参数'}, status=status.HTTP_400_BAD_REQUEST)

        headers = _tapd_headers()
        if not headers:
            return Response({'detail': '请先在 settings.py 中配置 TAPD_PAT'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            import requests
            resp = requests.get(
                'https://api.tapd.cn/iterations',
                params={'workspace_id': workspace_id, 'limit': 100,
                        'fields': 'id,name,status,begin_date,enddate'},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get('status') == 1:
                iterations = []
                for item in data.get('data', []):
                    iteration = item.get('Iteration', {})
                    iterations.append({
                        'id': iteration.get('id'),
                        'name': iteration.get('name'),
                        'status': iteration.get('status', ''),
                        'begin_date': iteration.get('begin_date', ''),
                        'end_date': iteration.get('enddate', ''),
                    })
                return Response({'iterations': iterations})
            else:
                return Response({'detail': f'TAPD API 错误: {data.get("info")}'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({'detail': f'调用 TAPD API 失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TAPDCustomFieldsView(APIView):
    """查询 TAPD Story 自定义字段配置"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_id = request.query_params.get('workspace_id') or getattr(settings, 'TAPD_WORKSPACE_ID', '')
        if not workspace_id:
            return Response({'detail': 'workspace_id 为必填参数'}, status=status.HTTP_400_BAD_REQUEST)

        headers = _tapd_headers()
        if not headers:
            return Response({'detail': '请先在 settings.py 中配置 TAPD_PAT'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            import requests
            resp = requests.get(
                'https://api.tapd.cn/stories/custom_fields_settings',
                params={'workspace_id': workspace_id},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get('status') == 1:
                fields = []
                for item in data.get('data', []):
                    config = item.get('CustomFieldConfig', {})
                    fields.append({
                        'custom_field': config.get('custom_field', ''),
                        'name': config.get('name', ''),
                        'type': config.get('type', ''),
                        'enabled': config.get('enabled', ''),
                        'options': config.get('options', ''),
                    })
                return Response({'custom_fields': fields})
            else:
                return Response({'detail': f'TAPD API 错误: {data.get("info")}'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({'detail': f'调用 TAPD API 失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TAPDIterationSyncView(APIView):
    """将 TAPD 迭代同步到本地项目"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        project_id = request.data.get('project_id')
        tapd_iteration_ids = request.data.get('tapd_iteration_ids', [])

        if not project_id:
            return Response({'detail': 'project_id 为必填项'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': '项目不存在'}, status=status.HTTP_404_NOT_FOUND)

        headers = _tapd_headers()
        if not headers:
            return Response({'detail': '请先在 settings.py 中配置 TAPD_PAT'}, status=status.HTTP_400_BAD_REQUEST)

        workspace_id = getattr(settings, 'TAPD_WORKSPACE_ID', '')

        import requests as req_lib
        from apps.iterations.models import Iteration
        from datetime import date

        # 若未指定 ID，则拉取全部迭代
        if tapd_iteration_ids:
            params_list = [{'workspace_id': workspace_id, 'id': iid} for iid in tapd_iteration_ids]
        else:
            params_list = [{'workspace_id': workspace_id, 'limit': 100, 'fields': 'id,name,status,begin_date,enddate'}]

        status_map = {
            'open': 'planning', 'in_progress': 'in_progress', 'done': 'completed',
            '未开始': 'planning', '进行中': 'in_progress', '已完成': 'completed',
        }

        created, updated, errors = 0, 0, []

        def _sync_iteration(iteration_data):
            nonlocal created, updated
            tapd_id = str(iteration_data.get('id', ''))
            if not tapd_id:
                return

            name = iteration_data.get('name', '').strip() or f'TAPD 迭代 {tapd_id}'
            raw_status = iteration_data.get('status', '')
            mapped_status = status_map.get(raw_status, 'planning')

            begin_str = iteration_data.get('begin_date', '') or ''
            end_str = iteration_data.get('enddate', '') or ''

            try:
                start_date = date.fromisoformat(begin_str) if begin_str else date.today()
            except ValueError:
                start_date = date.today()
            try:
                end_date = date.fromisoformat(end_str) if end_str else date.today()
            except ValueError:
                end_date = date.today()

            defaults = {
                'name': name,
                'start_date': start_date,
                'end_date': end_date,
                'status': mapped_status,
            }

            obj, is_created = Iteration.objects.update_or_create(
                project=project,
                name=name,
                defaults=defaults,
            )
            if is_created:
                obj.created_by = request.user
                obj.save(update_fields=['created_by'])
                nonlocal created
                created += 1
            else:
                nonlocal updated
                updated += 1

        try:
            for params in params_list:
                resp = req_lib.get(
                    'https://api.tapd.cn/iterations',
                    params=params,
                    headers=headers,
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get('status') != 1:
                    errors.append(f'TAPD API 错误: {data.get("info")}')
                    continue

                for item in data.get('data', []):
                    try:
                        _sync_iteration(item.get('Iteration', {}))
                    except Exception as e:
                        errors.append(str(e))

        except Exception as e:
            return Response({'detail': f'调用 TAPD API 失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'message': f'同步完成：新建 {created} 条，更新 {updated} 条',
            'created': created,
            'updated': updated,
            'errors': errors,
        })


class TAPDBatchSyncView(APIView):
    """TAPD 批量同步预览 API"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        time_range = request.data.get('time_range', {})
        data_types = request.data.get('data_types', ['iteration', 'requirement'])
        preview_only = request.data.get('preview_only', True)

        start_date = time_range.get('start')
        end_date = time_range.get('end')

        if not start_date or not end_date:
            return Response({'detail': '时间范围为必填项'}, status=status.HTTP_400_BAD_REQUEST)

        headers = _tapd_headers()
        if not headers:
            return Response({'detail': '请先在 settings.py 中配置 TAPD_PAT'}, status=status.HTTP_400_BAD_REQUEST)

        workspace_id = getattr(settings, 'TAPD_WORKSPACE_ID', '')
        if not workspace_id:
            return Response({'detail': '请在 settings.py 中配置 TAPD_WORKSPACE_ID'}, status=status.HTTP_400_BAD_REQUEST)

        import requests as req_lib

        result = {'iterations': [], 'unassigned': []}

        try:
            # 1. 拉取迭代
            if 'iteration' in data_types:
                resp = req_lib.get(
                    'https://api.tapd.cn/iterations',
                    params={'workspace_id': workspace_id, 'limit': 100,
                            'fields': 'id,name,status,begin_date,enddate,created,modified'},
                    headers=headers,
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get('status') == 1:
                    for item in data.get('data', []):
                        iteration = item.get('Iteration', {})
                        begin_date = iteration.get('begin_date', '')
                        end_date_iter = iteration.get('enddate', '')
                        modified = iteration.get('modified', '')

                        # 筛选：时间范围有交集 或 更新时间在范围内
                        in_range = False
                        if begin_date and end_date_iter:
                            if begin_date <= end_date and end_date_iter >= start_date:
                                in_range = True
                        if modified and start_date <= modified <= end_date:
                            in_range = True

                        if in_range:
                            result['iterations'].append({
                                'tapd_id': iteration.get('id'),
                                'name': iteration.get('name', ''),
                                'status': iteration.get('status', ''),
                                'begin_date': begin_date,
                                'end_date': end_date_iter,
                                'created': iteration.get('created', ''),
                                'modified': modified,
                                'requirements': [],
                                'tasks': [],
                                'bugs': [],
                            })

            # 2. 拉取需求/任务/缺陷
            if 'requirement' in data_types:
                # 拉取需求 (stories)
                resp = req_lib.get(
                    'https://api.tapd.cn/stories',
                    params={'workspace_id': workspace_id, 'limit': 1000,
                            'fields': 'id,name,status,priority,iteration_id,created,modified'},
                    headers=headers,
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get('status') == 1:
                    for item in data.get('data', []):
                        story = item.get('Story', {})
                        created = story.get('created', '')
                        modified = story.get('modified', '')

                        # 筛选：创建时间或更新时间在范围内
                        if (created and start_date <= created <= end_date) or \
                           (modified and start_date <= modified <= end_date):
                            req_data = {
                                'tapd_id': story.get('id'),
                                'name': story.get('name', ''),
                                'type': 'product',
                                'status': story.get('status', ''),
                                'priority': story.get('priority', ''),
                                'created': created,
                                'modified': modified,
                            }

                            # 关联到迭代
                            iteration_id = story.get('iteration_id', '')
                            if iteration_id:
                                found = False
                                for it in result['iterations']:
                                    if str(it['tapd_id']) == str(iteration_id):
                                        it['requirements'].append(req_data)
                                        found = True
                                        break
                                if not found:
                                    result['unassigned'].append(req_data)
                            else:
                                result['unassigned'].append(req_data)

                # 拉取任务 (tasks)
                resp = req_lib.get(
                    'https://api.tapd.cn/tasks',
                    params={'workspace_id': workspace_id, 'limit': 1000,
                            'fields': 'id,name,status,priority,iteration_id,created,modified'},
                    headers=headers,
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get('status') == 1:
                    for item in data.get('data', []):
                        task = item.get('Task', {})
                        created = task.get('created', '')
                        modified = task.get('modified', '')

                        if (created and start_date <= created <= end_date) or \
                           (modified and start_date <= modified <= end_date):
                            task_data = {
                                'tapd_id': task.get('id'),
                                'name': task.get('name', ''),
                                'type': 'task',
                                'status': task.get('status', ''),
                                'priority': task.get('priority', ''),
                                'created': created,
                                'modified': modified,
                            }

                            iteration_id = task.get('iteration_id', '')
                            if iteration_id:
                                found = False
                                for it in result['iterations']:
                                    if str(it['tapd_id']) == str(iteration_id):
                                        it['tasks'].append(task_data)
                                        found = True
                                        break
                                if not found:
                                    result['unassigned'].append(task_data)
                            else:
                                result['unassigned'].append(task_data)

                # 拉取缺陷 (bugs)
                resp = req_lib.get(
                    'https://api.tapd.cn/bugs',
                    params={'workspace_id': workspace_id, 'limit': 1000,
                            'fields': 'id,title,status,priority,iteration_id,created,modified'},
                    headers=headers,
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get('status') == 1:
                    for item in data.get('data', []):
                        bug = item.get('Bug', {})
                        created = bug.get('created', '')
                        modified = bug.get('modified', '')

                        if (created and start_date <= created <= end_date) or \
                           (modified and start_date <= modified <= end_date):
                            bug_data = {
                                'tapd_id': bug.get('id'),
                                'name': bug.get('title', ''),
                                'type': 'bug',
                                'status': bug.get('status', ''),
                                'priority': bug.get('priority', ''),
                                'created': created,
                                'modified': modified,
                            }

                            iteration_id = bug.get('iteration_id', '')
                            if iteration_id:
                                found = False
                                for it in result['iterations']:
                                    if str(it['tapd_id']) == str(iteration_id):
                                        it['bugs'].append(bug_data)
                                        found = True
                                        break
                                if not found:
                                    result['unassigned'].append(bug_data)
                            else:
                                result['unassigned'].append(bug_data)

            return Response(result)

        except Exception as e:
            return Response({'detail': f'调用 TAPD API 失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TAPDSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        project_id = request.data.get('project_id')
        tapd_story_ids = request.data.get('tapd_requirement_ids', [])

        if not project_id:
            return Response({'detail': 'project_id 为必填项'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': '项目不存在'}, status=status.HTTP_404_NOT_FOUND)

        username = getattr(settings, 'TAPD_USERNAME', '')
        api_token = getattr(settings, 'TAPD_API_TOKEN', '')
        pat = getattr(settings, 'TAPD_PAT', '')

        if not (pat or (username and api_token)):
            return Response({'detail': '请先在 settings.py 中配置 TAPD_PAT'}, status=status.HTTP_400_BAD_REQUEST)

        import requests as req_lib
        from requests.auth import HTTPBasicAuth

        def _get_auth_kwargs():
            if pat:
                return {'headers': _tapd_headers()}
            return {'auth': HTTPBasicAuth(username, api_token)}

        created, updated = 0, 0
        errors = []

        for story_id in tapd_story_ids:
            try:
                resp = req_lib.get(
                    f'https://api.tapd.cn/stories/{story_id}',
                    **_get_auth_kwargs(),
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get('status') != 1:
                    errors.append(f'{story_id}: {data.get("info")}')
                    continue

                story = data['data']['Story']

                priority_map = {'High': 'high', 'Medium': 'medium', 'Low': 'low', '高': 'high', '中': 'medium', '低': 'low'}
                priority = priority_map.get(story.get('priority', ''), 'medium')

                defaults = {
                    'requirement_id': f'TAPD-{story_id}',
                    'name': story.get('name', ''),
                    'description': story.get('description', ''),
                    'priority': priority,
                    'project': project,
                    'created_by': request.user,
                }

                obj, is_created = Requirement.objects.update_or_create(
                    source='tapd',
                    source_id=str(story_id),
                    defaults=defaults,
                )

                if is_created:
                    created += 1
                else:
                    updated += 1

            except Exception as e:
                errors.append(f'{story_id}: {str(e)}')

        return Response({
            'message': f'同步完成：新建 {created} 条，更新 {updated} 条',
            'created': created,
            'updated': updated,
            'errors': errors,
        })


class SystemConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 检查是否配置了 Claude API
        configs = AIService._get_claude_configs()
        claude_configured = len(configs) > 0

        return Response({
            'ai_generation_timeout': getattr(settings, 'AI_GENERATION_TIMEOUT', 180),
            'deepseek_configured': bool(getattr(settings, 'DEEPSEEK_API_KEY', '')),
            'claude_configured': claude_configured,
        })


class ConfluenceConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base_url = getattr(settings, 'CONFLUENCE_BASE_URL', '')
        username = getattr(settings, 'CONFLUENCE_USERNAME', '')
        return Response({
            'base_url': base_url,
            'username': username,
            'has_password': bool(getattr(settings, 'CONFLUENCE_PASSWORD', '')),
            'configured': bool(base_url and username and getattr(settings, 'CONFLUENCE_PASSWORD', '')),
        })

    def post(self, request):
        # 测试 Confluence 连接
        base_url = getattr(settings, 'CONFLUENCE_BASE_URL', '')
        username = getattr(settings, 'CONFLUENCE_USERNAME', '')
        password = getattr(settings, 'CONFLUENCE_PASSWORD', '')

        if not all([base_url, username, password]):
            return Response({'detail': 'Confluence 未配置，请在 settings.py 中配置 CONFLUENCE_BASE_URL/USERNAME/PASSWORD'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            resp = http_requests.get(
                f'{base_url.rstrip("/")}/rest/api/content?limit=1',
                auth=(username, password),
                timeout=15,
                headers={'Accept': 'application/json'},
            )
            resp.raise_for_status()
            return Response({'message': 'Confluence 连接成功', 'status': 'ok'})
        except http_requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 401:
                return Response({'detail': '认证失败，请检查用户名和密码'}, status=status.HTTP_401_UNAUTHORIZED)
            return Response({'detail': f'连接失败：{e}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': f'连接失败：{e}'}, status=status.HTTP_400_BAD_REQUEST)


class FigmaConfigView(APIView):
    """Figma 集成配置查看与 Token 验证"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """返回 Figma 配置状态"""
        from apps.integrations.figma_service import get_figma_config_status
        config = get_figma_config_status()
        return Response(config)

    def post(self, request):
        """测试 Figma Token 有效性（调用 GET /v1/me）"""
        from apps.integrations.figma_service import verify_figma_token
        result = verify_figma_token()
        if result['valid']:
            return Response({
                'message': f'Figma Token 验证成功，用户：{result["user"]}（{result["email"]}）',
                'status': 'ok',
                'user': result['user'],
                'email': result['email'],
            })
        else:
            return Response(
                {'detail': f'Figma Token 验证失败：{result["error"]}'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ConfluencePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """实时预览 Confluence 页面内容"""
        url = request.data.get('url', '')
        if not url:
            return Response({'detail': '缺少 url 参数'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from apps.tasks.tasks.md_tasks import _fetch_url_content
            content = _fetch_url_content(url)
            return Response({'content': content})
        except Exception as e:
            return Response({'detail': f'获取失败：{e}'}, status=status.HTTP_400_BAD_REQUEST)
