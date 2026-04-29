"""TAPD 批量同步 API"""
import logging
import requests as req_lib
from datetime import datetime, date
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

from apps.iterations.models import Iteration
from apps.requirements.models import Requirement
from apps.bugs.models import Bug
from apps.users.models import User

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════

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


def _parse_date(value):
    """解析日期字符串 'YYYY-MM-DD' → date 对象，空/异常返回 None"""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value).strip())
    except (ValueError, TypeError):
        return None


def _parse_datetime(value):
    """解析时间字符串 'YYYY-MM-DD HH:MM:SS' → aware datetime 对象，空/异常返回 None"""
    if not value:
        return None
    try:
        from django.utils import timezone as dj_tz
        dt = datetime.fromisoformat(str(value).strip().replace(' ', 'T'))
        if dt.tzinfo is None:
            dt = dj_tz.make_aware(dt)
        return dt
    except (ValueError, TypeError):
        return None


def _dt_equal(a, b):
    """时区安全的 datetime 比较（处理 naive vs aware 混合情况）"""
    if a is None or b is None:
        return False
    from django.utils import timezone as dj_tz
    if a.tzinfo is None:
        a = dj_tz.make_aware(a)
    if b.tzinfo is None:
        b = dj_tz.make_aware(b)
    return a == b


def _chunk_ids(ids, size=200):
    """将 ID 列表分批，每批 size 条"""
    return [ids[i:i + size] for i in range(0, len(ids), size)]


def _batch_fetch_from_tapd(endpoint, item_key, tapd_ids, workspace_id, headers, fields):
    """
    批量请求 TAPD API，使用 id=id1,id2,... 参数。
    每批最多 200 条。
    返回 (items_list, errors_list)
    """
    items = []
    errors = []
    for chunk in _chunk_ids(tapd_ids):
        try:
            resp = req_lib.get(
                f'https://api.tapd.cn/{endpoint}',
                params={
                    'workspace_id': workspace_id,
                    'id': ','.join(chunk),
                    'fields': fields,
                    'limit': 200,
                },
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get('status') == 1:
                for item in data.get('data', []):
                    items.append(item.get(item_key, {}))
            else:
                errors.append(f'{endpoint} 批量拉取失败: status={data.get("status")}')
        except Exception as e:
            errors.append(f'{endpoint} 批量拉取异常: {str(e)}')
    return items, errors


def _match_user(name):
    """
    通过中文姓名(display_name)匹配 Django User。
    TAPD 返回的人员字段通常是中文名，如 "张三"。
    匹配不到返回 None。
    """
    if not name:
        return None
    return User.objects.filter(display_name=name.strip()).first()


def _detect_story_tester_field(workspace_id, headers):
    """通过 TAPD 自定义字段配置，检测需求(Story)的测试人员字段名"""
    try:
        resp = req_lib.get(
            'https://api.tapd.cn/stories/custom_fields_settings',
            params={'workspace_id': workspace_id},
            headers=headers,
            timeout=10,
        )
        if resp.ok:
            data = resp.json()
            if data.get('status') == 1:
                for item in data.get('data', []):
                    config = item.get('CustomFieldConfig', {})
                    name = config.get('name', '')
                    if '测试' in name or 'tester' in name.lower():
                        field_key = config.get('custom_field', '')
                        if field_key:
                            logger.info('TAPD: 检测到测试人员自定义字段 name=%s field=%s', name, field_key)
                            return field_key
    except Exception as e:
        logger.warning('TAPD: 检测自定义字段失败: %s', e)
    return None


# ═══════════════════════════════════════
# 状态 & 优先级映射表
# ═══════════════════════════════════════

# 迭代状态映射
# TAPD open = 未开始/进行中 → planning
# TAPD done = 已完成       → completed
TAPD_ITERATION_STATUS_MAP = {
    'open': 'planning',
    'done': 'completed',
}

# 需求(Story)状态映射
# TAPD status_5 (待评审)      → pending_review    (待评审)
# TAPD planning (规划中)      → pending_review    (待评审)
# TAPD status_6 (待研发)      → pending_development (待开发)
# TAPD developing (开发中)    → in_development    (开发中)
# TAPD status_12 (实现中)     → in_development    (开发中)
# TAPD status_3 (Bug修复中)   → in_development    (开发中)
# TAPD status_14 (调优中)     → in_development    (开发中)
# TAPD resolved (已实现)      → resolved          (已修复，待验证)
# TAPD status_7 (开发完成)    → pending_test      (待测试)
# TAPD for_test (待测试)      → pending_test      (待测试)
# TAPD testing (测试中)       → in_testing        (测试中)
# TAPD status_13 (性能验证)   → in_testing        (测试中)
# TAPD status_10 (T测试完成)  → pending_acceptance (待验收)
# TAPD status_8 (测试完成)    → pending_acceptance (待验收)
# TAPD status_11 (待PRE)      → pending_release   (待上线)
# TAPD status_4 (待发布)      → pending_release   (待上线)
# TAPD status_2 (已发布)      → pending_regression (待回归)
# TAPD status_15 (功能回归验证) → pending_regression (待回归)
# TAPD status_9 (已完成)      → completed         (已完成)
# TAPD done (已完成)          → completed         (已完成)
# TAPD rejected (已拒绝)      → rejected          (已拒绝)
# TAPD reject (已拒绝)        → rejected          (已拒绝)
# TAPD workflow_end (流程终止) → closed            (关闭)
# TAPD closed (已关闭)        → closed            (关闭)
# TAPD workflow_suspended (流程挂起) → suspended   (挂起)
TAPD_STORY_STATUS_MAP = {
    'status_5': 'pending_review',
    'planning': 'pending_review',
    'status_6': 'pending_development',
    'developing': 'in_development',
    'status_12': 'in_development',
    'status_3': 'in_development',
    'status_14': 'in_development',
    'resolved': 'resolved',
    'status_7': 'pending_test',
    'for_test': 'pending_test',
    'testing': 'in_testing',
    'status_13': 'in_testing',
    'status_10': 'pending_acceptance',
    'status_8': 'pending_acceptance',
    'status_11': 'pending_release',
    'status_4': 'pending_release',
    'status_2': 'pending_regression',
    'status_15': 'pending_regression',
    'status_9': 'completed',
    'done': 'completed',
    'rejected': 'rejected',
    'reject': 'rejected',
    'workflow_end': 'closed',
    'closed': 'closed',
    'workflow_suspended': 'suspended',
}

# 任务(Task)状态映射
# TAPD open        → pending_development (待开发)
# TAPD progressing → in_development      (开发中)
# TAPD done        → completed           (已完成)
TAPD_TASK_STATUS_MAP = {
    'open': 'pending_development',
    'progressing': 'in_development',
    'done': 'completed',
}

# 缺陷(Bug)状态映射
# TAPD new         → open        (待处理)
# TAPD in_progress → in_progress (处理中)
# TAPD resolved    → resolved    (已解决)
# TAPD verified    → resolved    (已解决)
# TAPD reopened    → open        (待处理)
# TAPD rejected    → rejected    (已拒绝)
# TAPD suspended   → suspended   (挂起)
# TAPD status_1    → done        (已完成)
# TAPD closed      → closed      (已关闭)
TAPD_BUG_STATUS_MAP = {
    'new': 'open',
    'in_progress': 'in_progress',
    'resolved': 'resolved',
    'verified': 'resolved',
    'reopened': 'open',
    'rejected': 'rejected',
    'suspended': 'suspended',
    'status_1': 'done',
    'closed': 'closed',
}

# 需求/任务 优先级映射
# TAPD 1 (紧急)  → urgent
# TAPD 2 (高)    → high
# TAPD 3 (中)    → medium
# TAPD 4 (低)    → low
# TAPD Nice To Have / Low → low
# TAPD High → high
# TAPD Medium → medium
TAPD_REQUIREMENT_PRIORITY_MAP = {
    '1': 'urgent',
    '2': 'high',
    '3': 'medium',
    '4': 'low',
    'Nice To Have': 'low',
    'Low': 'low',
    'Medium': 'medium',
    'High': 'high',
}

# 缺陷 优先级映射
# TAPD 1 (紧急) → blocker (阻断)
# TAPD 2 (高)   → critical (严重)
# TAPD 3 (中)   → major (主要)
# TAPD 4 (低)   → minor (次要)
TAPD_BUG_PRIORITY_MAP = {
    '1': 'blocker',
    '2': 'critical',
    '3': 'major',
    '4': 'minor',
    'urgent': 'blocker',
    'high': 'critical',
    'medium': 'major',
    'low': 'minor',
}


# ═══════════════════════════════════════
# 核心同步函数（模块级，可被定时任务/手动同步复用）
# ═══════════════════════════════════════

def sync_iterations_from_tapd(tapd_ids, workspace_id, headers, user):
    """
    批量拉取 TAPD 迭代并写入 Iteration 模型。

    TAPD 字段 → Iteration 模型字段:
      id         → source_id
      name       → name
      status     → status (映射: open→planning, done→completed)
      begin_date → start_date
      enddate    → end_date
      created    → source_created_at
      modified   → source_updated_at

    返回 {'created': N, 'updated': N, 'errors': [...]}
    """
    result = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    if not tapd_ids:
        return result

    fields = 'id,name,status,startdate,begin_date,start_date,enddate,created,modified'
    items, fetch_errors = _batch_fetch_from_tapd(
        'iterations', 'Iteration', tapd_ids, workspace_id, headers, fields
    )
    result['errors'].extend(fetch_errors)

    for iteration in items:
        try:
            iter_id = str(iteration.get('id', ''))
            begin = (iteration.get('startdate') or iteration.get('begin_date')
                     or iteration.get('start_date') or '')
            end = iteration.get('enddate', '')

            tapd_modified = _parse_datetime(iteration.get('modified', ''))
            if tapd_modified:
                existing_modified = Iteration.objects.filter(
                    source='tapd', source_id=iter_id
                ).values_list('source_updated_at', flat=True).first()
                if existing_modified and _dt_equal(existing_modified, tapd_modified):
                    result['skipped'] += 1
                    continue

            obj, created = Iteration.objects.update_or_create(
                source='tapd',
                source_id=iter_id,
                defaults={
                    'name': iteration.get('name', ''),
                    'start_date': _parse_date(begin) or date.today(),
                    'end_date': _parse_date(end) or date.today(),
                    'status': TAPD_ITERATION_STATUS_MAP.get(
                        iteration.get('status', ''), 'planning'
                    ),
                    'source_created_at': _parse_datetime(iteration.get('created', '')),
                    'source_updated_at': _parse_datetime(iteration.get('modified', '')),
                    'created_by': user,
                },
            )
            result['created' if created else 'updated'] += 1
        except Exception as e:
            result['errors'].append(f'迭代 {iteration.get("id")}: {str(e)}')

    return result


def sync_stories_from_tapd(tapd_ids, workspace_id, headers, user):
    """
    批量拉取 TAPD 需求(Story)并写入 Requirement 模型 (req_type='product')。

    TAPD 字段 → Requirement 模型字段:
      ── 基础字段 ──
      id               → source_id, requirement_id (TAPD-{id})
      name             → name
      description      → description
      status           → status (映射: planning→pending_review, developing→in_development,
                                       testing→in_testing, done→completed, closed→closed)
      priority         → priority (映射: 1→urgent, 2→high, 3→medium, 4→low)
      iteration_id     → iteration (FK, 通过 Iteration source_id 查找)
      created          → source_created_at
      modified         → source_updated_at

      ── 扩展字段 ──
      creator          → creator
      owner            → owner
      begin            → plan_begin
      due              → plan_due
      completed        → completed_at
      category_id      → category_id
      parent_id        → source_parent_id
      children_id      → source_children_id
      effort           → effort
      effort_completed → effort_completed
      remain           → effort_remain
      release_id       → release_id
      source           → source_category
      type             → source_type
      module           → module_name
      label            → label
      progress         → progress
      developer        → developer_name
      cc               → (不拉取)

    返回 {'created': N, 'updated': N, 'errors': [...]}
    """
    result = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    if not tapd_ids:
        return result

    logger = logging.getLogger('tapd_sync')

    # 检测测试人员自定义字段（TAPD Story 没有标准 te 字段）
    tester_field = _detect_story_tester_field(workspace_id, headers)

    fields = (
        'id,name,description,workspace_id,creator,created,modified,status,owner,'
        'begin,due,priority,iteration_id,category_id,parent_id,children_id,'
        'effort,effort_completed,remain,release_id,source,type,'
        'module,completed,label,progress,developer'
    )
    if tester_field:
        fields += f',{tester_field}'

    logger.info('TAPD story sync: 待同步ID数=%d, 测试人员字段=%s', len(tapd_ids), tester_field or '未检测到')

    items, fetch_errors = _batch_fetch_from_tapd(
        'stories', 'Story', tapd_ids, workspace_id, headers, fields
    )
    result['errors'].extend(fetch_errors)

    # 记录 TAPD API 返回的 ID 列表，便于排查丢失
    returned_ids = {str(s.get('id', '')) for s in items}
    missing_ids = set(tapd_ids) - returned_ids
    if missing_ids:
        logger.warning('TAPD story sync: API 未返回以下 ID（可能不存在或无权限）: %s', missing_ids)

    for story in items:
        try:
            story_id = str(story.get('id', ''))

            raw_desc = story.get('description', '')
            raw_te = story.get(tester_field, '') if tester_field else ''

            # 批量 API 有时不返回 description，用单条 API 补拉
            if not raw_desc or (tester_field and not raw_te):
                try:
                    detail_resp = req_lib.get(
                        'https://api.tapd.cn/stories/show',
                        params={'workspace_id': workspace_id, 'id': story_id},
                        headers=headers,
                        timeout=15,
                    )
                    if detail_resp.ok:
                        detail_data = detail_resp.json()
                        if detail_data.get('status') == 1:
                            detail_story = detail_data.get('data', {}).get('Story', {})
                            if not raw_desc:
                                raw_desc = detail_story.get('description', '')
                            if tester_field and not raw_te:
                                raw_te = detail_story.get(tester_field, '')
                            logger.info('TAPD story %s: 单条 API 补拉 desc=%s te=%s (field=%s), 返回字段=%s',
                                        story_id, bool(raw_desc), bool(raw_te), tester_field,
                                        list(detail_story.keys()))
                except Exception as e:
                    logger.warning('TAPD story %s: 单条 API 补拉失败: %s', story_id, e)

            tapd_modified = _parse_datetime(story.get('modified', ''))
            if tapd_modified:
                existing_modified = Requirement.objects.filter(
                    source='tapd', req_type='product', source_id=story_id
                ).values_list('source_updated_at', flat=True).first()
                if existing_modified and _dt_equal(existing_modified, tapd_modified):
                    logger.info('TAPD story %s (%s): 未变更，跳过', story_id, story.get('name', ''))
                    result['skipped'] += 1
                    continue

            # 查找迭代 FK
            iteration = None
            iter_id = story.get('iteration_id', '')
            if iter_id and str(iter_id) != '0':
                iteration = Iteration.objects.filter(
                    source='tapd', source_id=str(iter_id)
                ).first()
            logger.info('story %s (%s): TAPD iteration_id=[%s] type=%s, 本地查找=%s',
                        story_id, story.get('name', ''), iter_id, type(iter_id).__name__,
                        iteration.id if iteration else 'None(未找到)')

            obj, created = Requirement.objects.update_or_create(
                source='tapd',
                req_type='product',
                source_id=story_id,
                defaults={
                    'requirement_id': f'TAPD-{story_id}',
                    'name': story.get('name', ''),
                    'description': raw_desc or '',
                    'status': TAPD_STORY_STATUS_MAP.get(
                        story.get('status', ''), 'pending_review'
                    ),
                    'priority': TAPD_REQUIREMENT_PRIORITY_MAP.get(
                        str(story.get('priority', '')), 'medium'
                    ),
                    'iteration': iteration,
                    'source_created_at': _parse_datetime(story.get('created', '')),
                    'source_updated_at': _parse_datetime(story.get('modified', '')),
                    'created_by': user,
                    # 扩展字段
                    'creator': story.get('creator', ''),
                    'owner': story.get('owner', ''),
                    'plan_begin': _parse_date(story.get('begin', '')),
                    'plan_due': _parse_date(story.get('due', '')),
                    'completed_at': _parse_datetime(story.get('completed', '')),
                    'category_id': story.get('category_id', ''),
                    'source_parent_id': story.get('parent_id', ''),
                    'source_children_id': story.get('children_id', ''),
                    'effort': story.get('effort', ''),
                    'effort_completed': story.get('effort_completed', ''),
                    'effort_remain': story.get('remain', ''),
                    'release_id': story.get('release_id', ''),
                    'source_category': story.get('source', ''),
                    'source_type': story.get('type', ''),
                    'module_name': story.get('module', ''),
                    'label': story.get('label', ''),
                    'progress': int(story['progress']) if story.get('progress') else None,
                    'developer_name': story.get('developer', ''),
                    'tester_name': raw_te or '',
                },
            )
            logger.info('TAPD story %s (%s): %s, tester=%s',
                        story_id, story.get('name', ''), '新建' if created else '更新', raw_te or '空')
            result['created' if created else 'updated'] += 1
        except Exception as e:
            result['errors'].append(f'需求 {story.get("id")}: {str(e)}')

    return result


def sync_tasks_from_tapd(tapd_ids, workspace_id, headers, user):
    """
    批量拉取 TAPD 任务(Task)并写入 Requirement 模型 (req_type='task')。

    TAPD 字段 → Requirement 模型字段:
      ── 基础字段 ──
      id               → source_id, requirement_id (TAPD-TASK-{id})
      name             → name
      description      → description
      status           → status (映射: open→pending_development, progressing→in_development,
                                       done→completed)
      priority         → priority (映射: 1→urgent, 2→high, 3→medium, 4→low)
      iteration_id     → iteration (FK)
      created          → source_created_at
      modified         → source_updated_at

      ── 扩展字段 ──
      creator          → creator
      owner            → owner
      begin            → plan_begin
      due              → plan_due
      completed        → completed_at
      story_id         → source_parent_id (任务关联的需求ID)
      effort           → effort
      effort_completed → effort_completed
      remain           → effort_remain
      release_id       → release_id
      type             → source_type
      label            → label
      progress         → progress
      cc               → (不拉取)
      exceed           → (跳过，模型无对应字段)
      follower         → (不拉取)
      has_child        → source_children_id
      parent_id        → (存入 source_parent_id，story_id 优先)

    返回 {'created': N, 'updated': N, 'errors': [...]}
    """
    result = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    if not tapd_ids:
        return result

    fields = (
        'id,name,description,workspace_id,creator,created,modified,status,owner,'
        'begin,due,priority,iteration_id,story_id,progress,completed,'
        'effort,effort_completed,remain,label,release_id,parent_id,'
        'has_child,type'
    )
    items, fetch_errors = _batch_fetch_from_tapd(
        'tasks', 'Task', tapd_ids, workspace_id, headers, fields
    )
    result['errors'].extend(fetch_errors)

    for task in items:
        try:
            task_id = str(task.get('id', ''))

            tapd_modified = _parse_datetime(task.get('modified', ''))
            if tapd_modified:
                existing_modified = Requirement.objects.filter(
                    source='tapd', req_type='task', source_id=task_id
                ).values_list('source_updated_at', flat=True).first()
                if existing_modified and _dt_equal(existing_modified, tapd_modified):
                    result['skipped'] += 1
                    continue

            # 查找迭代 FK
            iteration = None
            iter_id = task.get('iteration_id', '')
            if iter_id:
                iteration = Iteration.objects.filter(
                    source='tapd', source_id=str(iter_id)
                ).first()

            # story_id 优先作为 source_parent_id
            source_parent = task.get('story_id', '') or task.get('parent_id', '')

            obj, created = Requirement.objects.update_or_create(
                source='tapd',
                req_type='task',
                source_id=task_id,
                defaults={
                    'requirement_id': f'TAPD-TASK-{task_id}',
                    'name': task.get('name', ''),
                    'description': task.get('description', '') or '',
                    'status': TAPD_TASK_STATUS_MAP.get(
                        task.get('status', ''), 'pending_development'
                    ),
                    'priority': TAPD_REQUIREMENT_PRIORITY_MAP.get(
                        str(task.get('priority', '')), 'medium'
                    ),
                    'iteration': iteration,
                    'source_created_at': _parse_datetime(task.get('created', '')),
                    'source_updated_at': _parse_datetime(task.get('modified', '')),
                    'created_by': user,
                    # 扩展字段
                    'creator': task.get('creator', ''),
                    'owner': task.get('owner', ''),
                    'plan_begin': _parse_date(task.get('begin', '')),
                    'plan_due': _parse_date(task.get('due', '')),
                    'completed_at': _parse_datetime(task.get('completed', '')),
                    'source_parent_id': source_parent,
                    'source_children_id': task.get('has_child', ''),
                    'effort': task.get('effort', ''),
                    'effort_completed': task.get('effort_completed', ''),
                    'effort_remain': task.get('remain', ''),
                    'release_id': task.get('release_id', ''),
                    'source_type': task.get('type', ''),
                    'label': task.get('label', ''),
                    'progress': int(task['progress']) if task.get('progress') else None,
                },
            )
            result['created' if created else 'updated'] += 1
        except Exception as e:
            result['errors'].append(f'任务 {task.get("id")}: {str(e)}')

    return result


def sync_bugs_from_tapd(tapd_ids, workspace_id, headers, user):
    """
    批量拉取 TAPD 缺陷(Bug)并写入 Bug 模型。

    TAPD 字段 → Bug 模型字段:
      ── 基础字段 ──
      id               → source_id, bug_id (TAPD-BUG-{id})
      title            → title
      description      → description
      status           → status (映射: new→open, in_progress→in_progress,
                                       resolved→resolved, closed→closed,
                                       rejected→rejected, reopened→open)
      priority         → priority (映射: 1→blocker, 2→critical, 3→major, 4→minor)
      severity         → severity
      iteration_id     → iteration (FK, 通过 Iteration source_id 查找)
      story_id         → requirement (FK, 通过 Requirement source_id 查找)
      created          → source_created_at
      modified         → source_updated_at
      creator/reporter → reporter (FK, 通过 User.display_name 匹配)
      current_owner    → assignee (FK, 通过 User.display_name 匹配)

      ── 扩展字段 ──
      creator          → creator
      current_owner    → current_owner
      cc               → cc
      de               → de
      te               → te
      fixer            → fixer
      module           → module
      release_id       → release_id
      originphase      → origin_phase
      source           → bug_source
      resolution       → resolution
      bugtype          → bug_category
      os               → os
      platform         → platform
      browser          → browser
      label            → label
      flows            → flows
      resolved         → resolved_at
      closed           → closed_at
      rejected         → rejected_at
      in_progress_time → in_progress_at
      effort           → effort
      effort_completed → effort_completed
      exceed           → effort_exceed
      remain           → effort_remain

      ── 不拉取的字段 ──
      closer, verifier, lastmodify, auditer, confirmer,
      participator, follower, testmode, testtype

    返回 {'created': N, 'updated': N, 'errors': [...]}
    """
    result = {'created': 0, 'updated': 0, 'skipped': 0, 'errors': []}
    if not tapd_ids:
        return result

    fields = (
        'id,title,description,workspace_id,creator,created,modified,status,'
        'current_owner,cc,priority,severity,module,originphase,source,resolution,'
        'resolved,closed,rejected,iteration_id,release_id,story_id,label,'
        'os,platform,browser,bugtype,de,te,fixer,'
        'flows,effort,effort_completed,exceed,remain,in_progress_time,reporter'
    )
    items, fetch_errors = _batch_fetch_from_tapd(
        'bugs', 'Bug', tapd_ids, workspace_id, headers, fields
    )
    result['errors'].extend(fetch_errors)

    for bug in items:
        try:
            bug_id_tapd = str(bug.get('id', ''))

            tapd_modified = _parse_datetime(bug.get('modified', ''))
            if tapd_modified:
                existing_modified = Bug.objects.filter(
                    source_id=bug_id_tapd
                ).values_list('source_updated_at', flat=True).first()
                if existing_modified and _dt_equal(existing_modified, tapd_modified):
                    result['skipped'] += 1
                    continue

            # 查找迭代 FK
            iteration = None
            iter_id = bug.get('iteration_id', '')
            if iter_id:
                iteration = Iteration.objects.filter(
                    source='tapd', source_id=str(iter_id)
                ).first()

            # 查找关联需求 FK (通过 story_id)
            requirement = None
            story_id = bug.get('story_id', '')
            if story_id:
                requirement = Requirement.objects.filter(
                    source='tapd', source_id=str(story_id)
                ).first()

            # 通过 display_name 匹配 reporter 和 assignee
            creator_name = bug.get('reporter', '') or bug.get('creator', '')
            reporter = _match_user(creator_name)
            owner_name = bug.get('current_owner', '')
            assignee = _match_user(owner_name)

            obj, created = Bug.objects.update_or_create(
                source_id=bug_id_tapd,
                defaults={
                    'bug_id': f'TAPD-BUG-{bug_id_tapd}',
                    'title': bug.get('title', ''),
                    'description': bug.get('description', '') or '',
                    'status': TAPD_BUG_STATUS_MAP.get(
                        bug.get('status', ''), 'open'
                    ),
                    'priority': TAPD_BUG_PRIORITY_MAP.get(
                        str(bug.get('priority', '')), 'major'
                    ),
                    'severity': bug.get('severity', ''),
                    'iteration': iteration,
                    'requirement': requirement,
                    'reporter': reporter,
                    'assignee': assignee,
                    'source_created_at': _parse_datetime(bug.get('created', '')),
                    'source_updated_at': _parse_datetime(bug.get('modified', '')),
                    # 扩展字段
                    'creator': bug.get('creator', ''),
                    'current_owner': bug.get('current_owner', ''),
                    'cc': bug.get('cc', ''),
                    'de': bug.get('de', ''),
                    'te': bug.get('te', ''),
                    'fixer': bug.get('fixer', ''),
                    'module_name': bug.get('module', ''),
                    'release_id': bug.get('release_id', ''),
                    'origin_phase': bug.get('originphase', ''),
                    'bug_source': bug.get('source', ''),
                    'resolution': bug.get('resolution', ''),
                    'bug_category': bug.get('bugtype', ''),
                    'os': bug.get('os', ''),
                    'platform': bug.get('platform', ''),
                    'browser': bug.get('browser', ''),
                    'label': bug.get('label', ''),
                    'flows': bug.get('flows', ''),
                    'resolved_at': _parse_datetime(bug.get('resolved', '')),
                    'closed_at': _parse_datetime(bug.get('closed', '')),
                    'rejected_at': _parse_datetime(bug.get('rejected', '')),
                    'in_progress_at': _parse_datetime(bug.get('in_progress_time', '')),
                    'effort': bug.get('effort', ''),
                    'effort_completed': bug.get('effort_completed', ''),
                    'effort_exceed': bug.get('exceed', ''),
                    'effort_remain': bug.get('remain', ''),
                },
            )
            result['created' if created else 'updated'] += 1
        except Exception as e:
            result['errors'].append(f'缺陷 {bug.get("id")}: {str(e)}')

    return result


# ═══════════════════════════════════════
# 级联同步辅助函数
# ═══════════════════════════════════════

def _parse_children_ids(value):
    """解析 TAPD children_id / has_child 字段，兼容 | , ; 分隔符"""
    if not value:
        return []
    ids = []
    for cid in str(value).replace('|', ',').replace(';', ',').split(','):
        cid = cid.strip()
        if cid and cid != '0':
            ids.append(cid)
    return ids


def _collect_cascade_ids(story_ids, task_ids, bug_ids, workspace_id, headers):
    """
    根据选中的需求/任务/缺陷 ID，收集需要级联同步的关联数据 ID。

    级联规则：
      需求 → 上游迭代 + 父需求 + 子需求 + 关联缺陷
      任务 → 上游迭代 + 关联需求 + 子任务 + (关联需求的)关联缺陷
      缺陷 → 上游迭代 + 关联需求

    返回 {
        'iteration_ids': [...],
        'extra_story_ids': [...],
        'extra_task_ids': [...],
        'extra_bug_ids': [],
    }
    """
    cascade_iter_ids = set()
    cascade_story_ids = set()
    cascade_task_ids = set()
    cascade_bug_ids = set()
    story_ids_for_bug_query = set()

    # ── 1) 需求级联：上游迭代 + 父需求 + 子需求 + 关联缺陷 ──
    if story_ids:
        fields = 'id,iteration_id,parent_id,children_id'
        items, _ = _batch_fetch_from_tapd(
            'stories', 'Story', story_ids, workspace_id, headers, fields
        )
        logger = logging.getLogger('tapd_sync')
        for story in items:
            sid = str(story.get('id', ''))
            iter_id = story.get('iteration_id', '')
            if iter_id and str(iter_id) != '0':
                cascade_iter_ids.add(str(iter_id))
            pid = story.get('parent_id', '')
            logger.info('TAPD story %s: parent_id=%s, children_id=%s',
                        sid, pid, story.get('children_id', ''))
            if pid and str(pid) != '0':
                cascade_story_ids.add(str(pid))
            for cid in _parse_children_ids(story.get('children_id', '')):
                cascade_story_ids.add(cid)
            story_ids_for_bug_query.add(sid)

    # ── 2) 任务级联：上游迭代 + 关联需求 + 子任务 + (关联需求的)缺陷 ──
    if task_ids:
        fields = 'id,iteration_id,story_id,has_child'
        items, _ = _batch_fetch_from_tapd(
            'tasks', 'Task', task_ids, workspace_id, headers, fields
        )
        for task in items:
            iter_id = task.get('iteration_id', '')
            if iter_id and str(iter_id) != '0':
                cascade_iter_ids.add(str(iter_id))
            sid = task.get('story_id', '')
            if sid and str(sid) != '0':
                cascade_story_ids.add(str(sid))
                story_ids_for_bug_query.add(str(sid))
            for cid in _parse_children_ids(task.get('has_child', '')):
                cascade_task_ids.add(cid)

    # ── 3) 缺陷级联：上游迭代 + 关联需求 ──
    if bug_ids:
        fields = 'id,iteration_id,story_id'
        items, _ = _batch_fetch_from_tapd(
            'bugs', 'Bug', bug_ids, workspace_id, headers, fields
        )
        for bug in items:
            iter_id = bug.get('iteration_id', '')
            if iter_id and str(iter_id) != '0':
                cascade_iter_ids.add(str(iter_id))
            sid = bug.get('story_id', '')
            if sid and str(sid) != '0':
                cascade_story_ids.add(str(sid))

    # ── 4) 反查关联缺陷（按 story_id）──
    for sid in story_ids_for_bug_query:
        try:
            resp = req_lib.get(
                'https://api.tapd.cn/bugs',
                headers=headers,
                params={
                    'workspace_id': workspace_id,
                    'story_id': sid,
                    'fields': 'id',
                    'limit': 200,
                },
                timeout=15,
            )
            if resp.ok and resp.json().get('status') == 1:
                for item in resp.json().get('data', []):
                    bug_data = item.get('Bug', item)
                    cascade_bug_ids.add(str(bug_data['id']))
        except Exception:
            pass

    cascade_story_ids -= set(story_ids or [])
    cascade_task_ids -= set(task_ids or [])
    cascade_bug_ids -= set(bug_ids or [])

    return {
        'iteration_ids': list(cascade_iter_ids),
        'extra_story_ids': list(cascade_story_ids),
        'extra_task_ids': list(cascade_task_ids),
        'extra_bug_ids': list(cascade_bug_ids),
    }


def _rebuild_parent_fk():
    """同步完成后，根据 source_parent_id 回填 Requirement.parent FK"""
    reqs_with_parent = Requirement.objects.filter(
        source='tapd',
        source_parent_id__isnull=False,
    ).exclude(source_parent_id__in=['', '0'])

    for req in reqs_with_parent:
        parent = Requirement.objects.filter(
            source='tapd', req_type='product', source_id=req.source_parent_id
        ).first()
        if parent and req.parent_id != parent.id:
            req.parent = parent
            req.save(update_fields=['parent'])


def _inherit_iteration_from_children():
    """父需求在 TAPD 中 iteration_id=0（Epic容器），同步后从子需求继承迭代"""
    parents_without_iter = Requirement.objects.filter(
        source='tapd',
        iteration__isnull=True,
        children__isnull=False,
    ).distinct()

    updated = 0
    for parent in parents_without_iter:
        child_iter_id = parent.children.exclude(
            iteration__isnull=True
        ).values_list('iteration_id', flat=True).first()
        if child_iter_id:
            parent.iteration_id = child_iter_id
            parent.save(update_fields=['iteration'])
            logger.info('父需求 %s (%s): 从子需求继承迭代 iteration_id=%s',
                        parent.source_id, parent.name, child_iter_id)
            updated += 1
    return updated


# ═══════════════════════════════════════
# 预览 API（保持轻量字段，不改动）
# ═══════════════════════════════════════

class TAPDBatchSyncView(APIView):
    """TAPD 批量同步预览 API"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        time_range = request.data.get('time_range', {})
        data_types = request.data.get('data_types', ['iteration', 'requirement'])

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

        result = {'iterations': [], 'unassigned': []}

        try:
            # 1. 拉取迭代
            if 'iteration' in data_types:
                resp = req_lib.get(
                    'https://api.tapd.cn/iterations',
                    params={'workspace_id': workspace_id, 'limit': 100,
                            'fields': 'id,name,status,startdate,begin_date,start_date,enddate,created,modified'},
                    headers=headers,
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get('status') == 1:
                    overlap_iters = []
                    modified_only_iters = []

                    for item in data.get('data', []):
                        iteration = item.get('Iteration', {})

                        begin_date_val = iteration.get('startdate') or iteration.get('begin_date') or \
                                     iteration.get('start_date') or iteration.get('begindate') or ''
                        end_date_iter = iteration.get('enddate', '')
                        modified = iteration.get('modified', '')

                        has_overlap = bool(begin_date_val and end_date_iter and
                                           begin_date_val <= end_date and end_date_iter >= start_date)
                        has_end_in_range = bool(not begin_date_val and end_date_iter and
                                                start_date <= end_date_iter <= end_date)
                        has_modified = bool(modified and start_date <= modified <= end_date)

                        if not has_overlap and not has_end_in_range and not has_modified:
                            continue

                        iter_data = {
                            'tapd_id': iteration.get('id'),
                            'name': iteration.get('name', ''),
                            'status': iteration.get('status', ''),
                            'begin_date': begin_date_val,
                            'end_date': end_date_iter,
                            'created': iteration.get('created', ''),
                            'modified': modified,
                            'requirements': [],
                            'tasks': [],
                            'bugs': [],
                        }

                        if has_overlap or has_end_in_range:
                            overlap_iters.append(iter_data)
                        else:
                            modified_only_iters.append(iter_data)

                    result['iterations'] = overlap_iters + modified_only_iters

            # 2. 拉取需求/任务
            if 'requirement' in data_types:
                self._fetch_requirements(result, workspace_id, headers, start_date, end_date)
                self._fetch_tasks(result, workspace_id, headers, start_date, end_date)

            # 3. 拉取缺陷
            if 'bug' in data_types:
                self._fetch_bugs(result, workspace_id, headers, start_date, end_date)

            # 4. 如果没有勾选迭代，但需求/任务/缺陷中有关联迭代，自动拉取这些迭代
            if 'iteration' not in data_types:
                self._fetch_missing_iterations(result, workspace_id, headers)

            return Response(result)

        except Exception as e:
            return Response({'detail': f'调用 TAPD API 失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _fetch_missing_iterations(self, result, workspace_id, headers):
        """拉取需求/任务/缺陷关联的迭代"""
        iteration_ids = set()
        for item in result['unassigned']:
            iter_id = item.get('iteration_id')
            if iter_id:
                iteration_ids.add(str(iter_id))

        if not iteration_ids:
            return

        for iter_id in iteration_ids:
            try:
                resp = req_lib.get(
                    'https://api.tapd.cn/iterations',
                    params={'workspace_id': workspace_id, 'id': iter_id,
                            'fields': 'id,name,status,startdate,enddate'},
                    headers=headers,
                    timeout=5,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get('status') == 1 and data.get('data'):
                    iteration = data['data'][0].get('Iteration', {})
                    iter_data = {
                        'tapd_id': iteration.get('id'),
                        'name': iteration.get('name', ''),
                        'status': iteration.get('status', ''),
                        'begin_date': iteration.get('startdate', ''),
                        'end_date': iteration.get('enddate', ''),
                        'created': '',
                        'modified': '',
                        'requirements': [],
                        'tasks': [],
                        'bugs': [],
                    }

                    items_to_move = [item for item in result['unassigned'] if str(item.get('iteration_id')) == iter_id]
                    for item in items_to_move:
                        item_type = item.get('type')
                        if item_type == 'requirement':
                            iter_data['requirements'].append(item)
                        elif item_type == 'task':
                            iter_data['tasks'].append(item)
                        elif item_type == 'bug':
                            iter_data['bugs'].append(item)
                        result['unassigned'].remove(item)

                    result['iterations'].append(iter_data)
            except Exception:
                continue

    def _fetch_requirements(self, result, workspace_id, headers, start_date, end_date):
        """拉取需求（分页，轻量预览字段）"""
        page_size = 200
        max_pages = 50
        empty_pages = 0
        max_empty_pages = 3

        req_fields = 'id,name,description,status,priority,iteration_id,created,modified,creator'

        for page in range(1, max_pages + 1):
            resp = req_lib.get(
                'https://api.tapd.cn/stories',
                params={
                    'workspace_id': workspace_id,
                    'limit': page_size,
                    'page': page,
                    'fields': req_fields,
                    'modified': f'>={start_date}',
                    'order': 'modified desc',
                },
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get('status') != 1:
                break

            page_data = data.get('data', [])
            if not page_data:
                break

            page_matched = False
            for item in page_data:
                story = item.get('Story', {})
                created = story.get('created', '')
                modified = story.get('modified', '')

                if (created and start_date <= created <= end_date) or \
                   (modified and start_date <= modified <= end_date):
                    page_matched = True
                    iteration_id = story.get('iteration_id', '')
                    req_data = {
                        'tapd_id': story.get('id'),
                        'name': story.get('name', ''),
                        'type': 'requirement',
                        'status': story.get('status', ''),
                        'priority': story.get('priority', ''),
                        'created': created,
                        'modified': modified,
                        'creator': story.get('creator', ''),
                        'iteration_id': iteration_id,
                    }

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

            if not page_matched:
                empty_pages += 1
                if empty_pages >= max_empty_pages:
                    break
            else:
                empty_pages = 0

            if len(page_data) < page_size:
                break

    def _fetch_tasks(self, result, workspace_id, headers, start_date, end_date):
        """拉取任务（分页，轻量预览字段）"""
        page_size = 200
        max_pages = 50
        empty_pages = 0
        max_empty_pages = 3

        task_fields = 'id,name,description,status,priority,iteration_id,story_id,created,modified,creator'

        for page in range(1, max_pages + 1):
            resp = req_lib.get(
                'https://api.tapd.cn/tasks',
                params={
                    'workspace_id': workspace_id,
                    'limit': page_size,
                    'page': page,
                    'fields': task_fields,
                    'modified': f'>={start_date}',
                    'order': 'modified desc',
                },
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get('status') != 1:
                break

            page_data = data.get('data', [])
            if not page_data:
                break

            page_matched = False
            for item in page_data:
                task = item.get('Task', {})
                created = task.get('created', '')
                modified = task.get('modified', '')

                if (created and start_date <= created <= end_date) or \
                   (modified and start_date <= modified <= end_date):
                    page_matched = True
                    iteration_id = task.get('iteration_id', '')
                    task_data = {
                        'tapd_id': task.get('id'),
                        'name': task.get('name', ''),
                        'type': 'task',
                        'status': task.get('status', ''),
                        'priority': task.get('priority', ''),
                        'created': created,
                        'modified': modified,
                        'creator': task.get('creator', ''),
                        'iteration_id': iteration_id,
                        'story_id': task.get('story_id', ''),
                    }

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

            if not page_matched:
                empty_pages += 1
                if empty_pages >= max_empty_pages:
                    break
            else:
                empty_pages = 0

            if len(page_data) < page_size:
                break

    def _fetch_bugs(self, result, workspace_id, headers, start_date, end_date):
        """拉取缺陷（分页，轻量预览字段）"""
        iteration_ids = {str(it['tapd_id']) for it in result['iterations']}

        requirement_ids = set()
        for it in result['iterations']:
            requirement_ids.update(str(r['tapd_id']) for r in it['requirements'])
            requirement_ids.update(str(t['tapd_id']) for t in it['tasks'])
        requirement_ids.update(str(r['tapd_id']) for r in result['unassigned'] if r.get('type') in ['requirement', 'task'])

        bug_fields = 'id,title,description,status,priority,severity,iteration_id,story_id,created,modified,creator,reporter'

        page_size = 200
        matched_count = 0
        prev_matched_count = 0
        max_pages = 50
        empty_pages = 0
        max_empty_pages = 5

        for page in range(1, max_pages + 1):
            resp = req_lib.get(
                'https://api.tapd.cn/bugs',
                params={'workspace_id': workspace_id, 'limit': page_size, 'page': page,
                        'fields': bug_fields,
                        'order': 'id desc'},
                headers=headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get('status') != 1:
                break

            page_data = data.get('data', [])
            if not page_data:
                break

            for item in page_data:
                bug = item.get('Bug', {})
                created = bug.get('created', '')
                modified = bug.get('modified', '')
                iteration_id = str(bug.get('iteration_id', ''))
                story_id = str(bug.get('story_id', ''))

                time_match = (created and start_date <= created <= end_date) or \
                             (modified and start_date <= modified <= end_date)
                iteration_match = iteration_id and iteration_id in iteration_ids
                requirement_match = story_id and story_id in requirement_ids

                if time_match or iteration_match or requirement_match:
                    matched_count += 1
                    bug_data = {
                        'tapd_id': bug.get('id'),
                        'name': bug.get('title', ''),
                        'type': 'bug',
                        'status': bug.get('status', ''),
                        'priority': bug.get('priority', ''),
                        'severity': bug.get('severity', ''),
                        'created': created,
                        'modified': modified,
                        'creator': bug.get('creator', ''),
                        'reporter': bug.get('reporter', ''),
                        'iteration_id': iteration_id,
                        'story_id': story_id,
                    }

                    if iteration_id:
                        found = False
                        for it in result['iterations']:
                            if str(it['tapd_id']) == iteration_id:
                                it['bugs'].append(bug_data)
                                found = True
                                break
                        if not found:
                            result['unassigned'].append(bug_data)
                    else:
                        result['unassigned'].append(bug_data)

            if matched_count == 0 or (page > 1 and matched_count == prev_matched_count):
                empty_pages += 1
                if empty_pages >= max_empty_pages:
                    break
            else:
                empty_pages = 0
            prev_matched_count = matched_count if page == 1 else matched_count


# ═══════════════════════════════════════
# 执行同步 API
# ═══════════════════════════════════════

class TAPDExecuteSyncView(APIView):
    """
    TAPD 执行同步 API。
    前端传入选中的 IDs，后端批量从 TAPD 拉取完整字段并写入对应模型。
    支持 cascade 参数开启级联同步。
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        selected_items = request.data.get('selected_items', {})
        cascade = request.data.get('cascade', False)
        iteration_ids = selected_items.get('iterations', [])
        story_ids = selected_items.get('stories', [])
        task_ids = selected_items.get('tasks', [])
        bug_ids = selected_items.get('bugs', [])

        if not any([iteration_ids, story_ids, task_ids, bug_ids]):
            return Response(
                {'detail': '请选择要同步的数据'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        headers = _tapd_headers()
        if not headers:
            return Response(
                {'detail': '请先在 settings.py 中配置 TAPD_PAT'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace_id = getattr(settings, 'TAPD_WORKSPACE_ID', '')

        try:
            # 级联收集
            cascade_info = None
            if cascade and (story_ids or task_ids or bug_ids):
                cascade_info = _collect_cascade_ids(
                    story_ids, task_ids, bug_ids, workspace_id, headers
                )
                iteration_ids = list(set(iteration_ids) | set(cascade_info['iteration_ids']))
                story_ids = list(set(story_ids) | set(cascade_info['extra_story_ids']))
                task_ids = list(set(task_ids) | set(cascade_info['extra_task_ids']))
                bug_ids = list(set(bug_ids) | set(cascade_info['extra_bug_ids']))

            # ═══ 分层同步：按 FK 依赖顺序，确保下层数据的 FK 能找到上层 ═══

            # Layer 1: 迭代（最上游，被需求/任务/缺陷依赖）
            iter_result = sync_iterations_from_tapd(
                iteration_ids, workspace_id, headers, request.user
            )

            # Layer 2: 父需求（被子需求依赖）
            # 从 story_ids 中分离出父需求（有 children_id）和子需求（有 parent_id）
            parent_story_ids = []
            child_story_ids = []
            orphan_story_ids = []

            if story_ids:
                fields = 'id,parent_id,children_id'
                items, _ = _batch_fetch_from_tapd(
                    'stories', 'Story', story_ids, workspace_id, headers, fields
                )
                for story in items:
                    sid = str(story.get('id', ''))
                    has_parent = story.get('parent_id', '') and str(story.get('parent_id', '')) != '0'
                    has_children = story.get('children_id', '') and str(story.get('children_id', '')) != '0'

                    if has_children and not has_parent:
                        parent_story_ids.append(sid)
                    elif has_parent:
                        child_story_ids.append(sid)
                    else:
                        orphan_story_ids.append(sid)

            # 先同步父需求
            parent_result = sync_stories_from_tapd(
                parent_story_ids, workspace_id, headers, request.user
            )

            # Layer 3: 子需求 + 孤立需求 + 任务
            child_result = sync_stories_from_tapd(
                child_story_ids + orphan_story_ids, workspace_id, headers, request.user
            )

            # 合并需求同步结果
            story_result = {
                'created': parent_result['created'] + child_result['created'],
                'updated': parent_result['updated'] + child_result['updated'],
                'skipped': parent_result['skipped'] + child_result['skipped'],
                'errors': parent_result['errors'] + child_result['errors'],
            }

            # Layer 4: 任务（依赖需求）
            # 分离父任务和子任务
            parent_task_ids = []
            child_task_ids = []

            if task_ids:
                fields = 'id,parent_id,has_child'
                items, _ = _batch_fetch_from_tapd(
                    'tasks', 'Task', task_ids, workspace_id, headers, fields
                )
                for task in items:
                    tid = str(task.get('id', ''))
                    has_parent = task.get('parent_id', '') and str(task.get('parent_id', '')) != '0'
                    has_children = task.get('has_child', '') and str(task.get('has_child', '')) != '0'

                    if has_children and not has_parent:
                        parent_task_ids.append(tid)
                    elif has_parent:
                        child_task_ids.append(tid)
                    else:
                        parent_task_ids.append(tid)

            parent_task_result = sync_tasks_from_tapd(
                parent_task_ids, workspace_id, headers, request.user
            )

            # Layer 5: 子任务
            child_task_result = sync_tasks_from_tapd(
                child_task_ids, workspace_id, headers, request.user
            )

            task_result = {
                'created': parent_task_result['created'] + child_task_result['created'],
                'updated': parent_task_result['updated'] + child_task_result['updated'],
                'skipped': parent_task_result['skipped'] + child_task_result['skipped'],
                'errors': parent_task_result['errors'] + child_task_result['errors'],
            }

            # Layer 6: 缺陷（依赖迭代+需求+任务，最后同步）
            bug_result = sync_bugs_from_tapd(
                bug_ids, workspace_id, headers, request.user
            )

            # 级联模式下重建父子关系（兜底，理论上分层同步后不需要）
            if cascade:
                _rebuild_parent_fk()
                _inherit_iteration_from_children()

            all_errors = (
                iter_result['errors'] + story_result['errors'] +
                task_result['errors'] + bug_result['errors']
            )

            msg_parts = []
            for label, r in [('迭代', iter_result), ('需求', story_result),
                             ('任务', task_result), ('缺陷', bug_result)]:
                part = f'{label}新建{r["created"]}更新{r["updated"]}'
                if r.get('skipped'):
                    part += f'跳过{r["skipped"]}'
                msg_parts.append(part)
            message = '同步完成：' + '，'.join(msg_parts)

            if cascade_info:
                cascade_counts = []
                if cascade_info['iteration_ids']:
                    cascade_counts.append(f'迭代{len(cascade_info["iteration_ids"])}')
                if cascade_info['extra_story_ids']:
                    cascade_counts.append(f'关联需求{len(cascade_info["extra_story_ids"])}')
                if cascade_info['extra_task_ids']:
                    cascade_counts.append(f'子任务{len(cascade_info["extra_task_ids"])}')
                if cascade_info['extra_bug_ids']:
                    cascade_counts.append(f'缺陷{len(cascade_info["extra_bug_ids"])}')
                if cascade_counts:
                    message += f'（其中级联拉取：{"、".join(cascade_counts)}）'

            return Response({
                'message': message,
                'iterations': iter_result,
                'stories': story_result,
                'tasks': task_result,
                'bugs': bug_result,
                'cascade_info': {
                    'iterations': len(cascade_info['iteration_ids']),
                    'stories': len(cascade_info['extra_story_ids']),
                    'tasks': len(cascade_info['extra_task_ids']),
                    'bugs': len(cascade_info['extra_bug_ids']),
                } if cascade_info else None,
                'errors': all_errors,
            })

        except Exception as e:
            return Response(
                {'detail': f'同步失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
