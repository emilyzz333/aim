"""
企业微信 Webhook 通知服务
用于在需求状态变更、缺陷分配等关键事件时推送消息到企微群机器人
"""
import json
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def send_qw_webhook(content: str, msg_type: str = 'text') -> bool:
    """
    发送企业微信 Webhook 消息
    :param content: 消息内容（text 类型为纯文字，markdown 类型为 md 格式）
    :param msg_type: 'text' 或 'markdown'
    :return: 是否发送成功
    """
    webhook_url = getattr(settings, 'QW_WEBHOOK_URL', '')
    if not webhook_url:
        logger.debug('QW_WEBHOOK_URL 未配置，跳过 Webhook 通知')
        return False

    if msg_type == 'markdown':
        payload = {
            'msgtype': 'markdown',
            'markdown': {'content': content},
        }
    else:
        payload = {
            'msgtype': 'text',
            'text': {'content': content},
        }

    try:
        resp = requests.post(webhook_url, json=payload, timeout=5)
        data = resp.json()
        if data.get('errcode') == 0:
            return True
        logger.warning('企微 Webhook 返回错误: %s', data)
        return False
    except Exception as exc:
        logger.error('企微 Webhook 发送失败: %s', exc)
        return False


# ─────────────────────────────
# 业务级通知函数
# ─────────────────────────────

def notify_requirement_status_changed(requirement, old_status: str, new_status: str, changed_by_name: str):
    """需求状态变更通知"""
    STATUS_LABELS = {
        'pending_review': '待评审', 'pending_tech_review': '待技评',
        'pending_development': '待开发', 'in_development': '开发中',
        'pending_test': '待测试', 'in_test': '测试中',
        'pending_acceptance': '待验收', 'pending_release': '待上线',
        'pending_regression': '待回归', 'completed': '已完成', 'closed': '已关闭',
    }
    content = (
        f'## 需求状态变更通知\n'
        f'**需求**：[{requirement.name}]\n'
        f'**编号**：{requirement.requirement_id}\n'
        f'**状态**：{STATUS_LABELS.get(old_status, old_status)} → {STATUS_LABELS.get(new_status, new_status)}\n'
        f'**操作人**：{changed_by_name}\n'
    )
    send_qw_webhook(content, msg_type='markdown')


def notify_bug_assigned(bug, assignee_name: str, reporter_name: str):
    """缺陷分配通知"""
    content = (
        f'## 缺陷分配通知\n'
        f'**缺陷**：{bug.title}\n'
        f'**编号**：{bug.bug_id}\n'
        f'**优先级**：{bug.priority}\n'
        f'**分配给**：{assignee_name}\n'
        f'**提报人**：{reporter_name}\n'
    )
    send_qw_webhook(content, msg_type='markdown')


def notify_requirement_blocked(requirement, block_reason: str, operator_name: str):
    """需求阻塞通知"""
    content = (
        f'## 需求阻塞告警\n'
        f'**需求**：{requirement.name}\n'
        f'**编号**：{requirement.requirement_id}\n'
        f'**阻塞原因**：{block_reason}\n'
        f'**标记人**：{operator_name}\n'
    )
    send_qw_webhook(content, msg_type='markdown')
