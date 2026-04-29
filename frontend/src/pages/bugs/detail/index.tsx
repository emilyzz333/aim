import { useState, useEffect, useRef } from 'react';
import { Tabs, Tag, Spin, message, List, Avatar, Input, Select, DatePicker } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import request from '@/services/request';

const PRIORITY_OPTIONS = [
  { value: 'blocker', label: '阻断', color: 'red' },
  { value: 'critical', label: '严重', color: 'red' },
  { value: 'major', label: '主要', color: 'orange' },
  { value: 'minor', label: '次要', color: 'gold' },
  { value: 'trivial', label: '轻微', color: 'default' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: '待处理', color: 'blue' },
  { value: 'in_progress', label: '处理中', color: 'cyan' },
  { value: 'resolved', label: '已解决', color: 'green' },
  { value: 'closed', label: '已关闭', color: 'default' },
  { value: 'rejected', label: '已拒绝', color: 'red' },
];

const TYPE_OPTIONS = [
  { value: 'online', label: '线上缺陷' },
  { value: 'function', label: '功能缺陷' },
  { value: 'requirement', label: '需求缺陷' },
  { value: 'design', label: '设计缺陷' },
  { value: 'ux', label: '用户体验' },
  { value: 'suggestion', label: '建议' },
];

const SOURCE_OPTIONS = [
  { value: 'test', label: '测试发现' },
  { value: 'tech', label: '技术发现' },
  { value: 'business', label: '业务反馈' },
  { value: 'user', label: '用户反馈' },
];

const ENV_OPTIONS = [
  { value: 't', label: 'T环境' },
  { value: 'pre', label: 'Pre环境' },
  { value: 'prod', label: '线上环境' },
];

const getOpt = (opts: { value: string; label: string; color?: string }[], v: string) =>
  opts.find((o) => o.value === v) || { label: v, color: 'default' };

interface BugDetailProps {
  bugId: number;
  onClose?: () => void;
}

// 通用 inline 字段
const InlineField = ({
  label, displayValue, editNode, disabled,
}: {
  label: string;
  displayValue: React.ReactNode;
  editNode?: (done: () => void) => React.ReactNode;
  disabled?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const done = () => setEditing(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 3 }}>{label}</div>
      {editing && editNode ? (
        <div>{editNode(done)}</div>
      ) : (
        <div
          onClick={() => !disabled && setEditing(true)}
          style={{
            fontSize: 13, color: '#262626', cursor: disabled ? 'default' : 'pointer',
            padding: '2px 6px', marginLeft: -6, borderRadius: 4, minHeight: 22,
          }}
          onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {displayValue || <span style={{ color: '#bbb' }}>点击编辑</span>}
        </div>
      )}
    </div>
  );
};

const InlineSelect = ({ value, options, onSave, done }: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
  done: () => void;
}) => {
  const [open, setOpen] = useState(true);
  const didSave = useRef(false);
  return (
    <Select
      autoFocus
      open={open}
      size="small"
      defaultValue={value}
      style={{ width: '100%' }}
      options={options}
      onChange={async (v) => {
        didSave.current = true;
        setOpen(false);
        await onSave(v);
        done();
      }}
      onDropdownVisibleChange={(visible) => {
        if (!visible && !didSave.current) done();
      }}
    />
  );
};

const BugDetail = ({ bugId }: BugDetailProps) => {
  const [bug, setBug] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState('');

  const fetchDetail = async () => {
    try {
      const res = await request.get(`/bugs/${bugId}/`);
      setBug(res.data);
      setTitleVal(res.data.title);
      setDescVal(res.data.description || '');
    } catch {
      message.error('获取缺陷详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    request.get('/users/').then((r: any) => {
      const d = r.data.results || r.data;
      setUsers(Array.isArray(d) ? d : []);
    }).catch(() => {});
    request.get('/requirements/').then((r: any) => {
      const d = r.data.results || r.data;
      setRequirements(Array.isArray(d) ? d : []);
    }).catch(() => {});
  }, [bugId]);

  const patch = async (fields: Record<string, any>) => {
    try {
      const res = await request.patch(`/bugs/${bugId}/`, fields);
      setBug(res.data);
      setTitleVal(res.data.title);
      setDescVal(res.data.description || '');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '保存失败');
      throw e;
    }
  };

  if (loading) return <Spin style={{ display: 'block', marginTop: 60 }} />;
  if (!bug) return <div>缺陷不存在</div>;

  const statusInfo = getOpt(STATUS_OPTIONS, bug.status);
  const priorityInfo = getOpt(PRIORITY_OPTIONS, bug.priority);
  const userOptions = users.map((u) => ({ value: u.id, label: u.username }));
  const reqOptions = requirements.map((r) => ({ value: r.id, label: r.name }));

  const tabItems = [
    {
      key: 'info',
      label: '详细信息',
      children: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 12, color: '#595959', fontWeight: 500 }}>缺陷描述</div>
          {editingDesc ? (
            <Input.TextArea
              autoFocus
              rows={4}
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              onBlur={async () => {
                setEditingDesc(false);
                if (descVal !== bug.description) await patch({ description: descVal });
              }}
              style={{ marginBottom: 16 }}
            />
          ) : (
            <div
              onClick={() => setEditingDesc(true)}
              style={{
                marginBottom: 16, padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                color: bug.description ? '#262626' : '#bbb', minHeight: 36, whiteSpace: 'pre-wrap',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {bug.description || '点击添加描述...'}
            </div>
          )}

          <div style={{ marginBottom: 8, color: '#595959', fontWeight: 500 }}>复现步骤</div>
          <div
            onClick={() => {}}
            style={{ color: bug.steps_to_reproduce ? '#262626' : '#bbb', whiteSpace: 'pre-wrap', padding: '6px 8px' }}
          >
            {bug.steps_to_reproduce || '-'}
          </div>
        </div>
      ),
    },
    {
      key: 'changelogs',
      label: '变更历史',
      children: (
        <List
          style={{ padding: '8px 0' }}
          dataSource={[]}
          locale={{ emptyText: '暂无变更记录' }}
          renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar style={{ background: '#1890ff' }}>{item.changed_by_name?.[0]}</Avatar>}
                title={
                  <span>
                    <strong>{item.changed_by_name}</strong>{' 修改了 '}
                    <Tag>{item.field}</Tag>
                    <span style={{ color: '#999', fontSize: 12 }}>{item.changed_at?.slice(0, 16)}</span>
                  </span>
                }
                description={
                  item.old_value && item.new_value
                    ? `${item.old_value} → ${item.new_value}`
                    : item.new_value || '-'
                }
              />
            </List.Item>
          )}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%' }}>
      {/* 左侧主内容 */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 24, overflowY: 'auto' }}>
        {/* 可编辑标题 */}
        {editingTitle ? (
          <Input
            autoFocus
            style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={async () => {
              setEditingTitle(false);
              if (titleVal.trim() && titleVal !== bug.title) await patch({ title: titleVal.trim() });
            }}
            onPressEnter={async () => {
              setEditingTitle(false);
              if (titleVal.trim() && titleVal !== bug.title) await patch({ title: titleVal.trim() });
            }}
          />
        ) : (
          <div
            onClick={() => setEditingTitle(true)}
            style={{
              fontSize: 16, fontWeight: 600, marginBottom: 4, cursor: 'pointer',
              padding: '2px 6px', marginLeft: -6, borderRadius: 4,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {bug.title}
            <EditOutlined style={{ fontSize: 12, color: '#bbb', marginLeft: 6 }} />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#888' }}>{bug.bug_id}</span>
        </div>
        <Tabs items={tabItems} size="small" />
      </div>

      {/* 右侧基础信息侧边栏 */}
      <div style={{
        width: 230, minWidth: 230, borderLeft: '1px solid #f0f0f0',
        paddingLeft: 20, overflowY: 'auto',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#262626', marginBottom: 16 }}>基础信息</div>

        <InlineField
          label="状态"
          displayValue={<Tag color={statusInfo.color} style={{ margin: 0 }}>{statusInfo.label}</Tag>}
          editNode={(done) => (
            <InlineSelect value={bug.status} options={STATUS_OPTIONS} done={done} onSave={async (v) => { await patch({ status: v }); }} />
          )}
        />

        <InlineField
          label="优先级"
          displayValue={<Tag color={priorityInfo.color} style={{ margin: 0 }}>{priorityInfo.label}</Tag>}
          editNode={(done) => (
            <InlineSelect value={bug.priority} options={PRIORITY_OPTIONS} done={done} onSave={async (v) => { await patch({ priority: v }); }} />
          )}
        />

        <InlineField
          label="缺陷类型"
          displayValue={getOpt(TYPE_OPTIONS, bug.type).label || '-'}
          editNode={(done) => (
            <InlineSelect value={bug.type} options={TYPE_OPTIONS} done={done} onSave={async (v) => { await patch({ type: v }); }} />
          )}
        />

        <InlineField
          label="来源"
          displayValue={getOpt(SOURCE_OPTIONS, bug.source).label || '-'}
          editNode={(done) => (
            <InlineSelect value={bug.source} options={SOURCE_OPTIONS} done={done} onSave={async (v) => { await patch({ source: v }); }} />
          )}
        />

        <InlineField
          label="环境"
          displayValue={getOpt(ENV_OPTIONS, bug.env).label || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineSelect value={bug.env} options={ENV_OPTIONS} done={done} onSave={async (v) => { await patch({ env: v }); }} />
          )}
        />

        <InlineField
          label="负责人"
          displayValue={bug.assignee_name || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineSelect value={bug.assignee} options={userOptions} done={done} onSave={async (v) => { await patch({ assignee: v }); }} />
          )}
        />

        <InlineField label="报告人" displayValue={bug.reporter_name || '-'} disabled />

        <InlineField
          label="关联需求"
          displayValue={bug.requirement_name || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineSelect value={bug.requirement} options={reqOptions} done={done} onSave={async (v) => { await patch({ requirement: v }); }} />
          )}
        />

        <InlineField
          label="归属团队"
          displayValue={bug.group || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <Input
              autoFocus
              size="small"
              defaultValue={bug.group || ''}
              onBlur={async (e) => { await patch({ group: e.target.value }); done(); }}
              onPressEnter={async (e) => { await patch({ group: (e.target as HTMLInputElement).value }); done(); }}
            />
          )}
        />

        <InlineField label="创建时间" displayValue={bug.created_at?.slice(0, 10) || '-'} disabled />
        <InlineField label="更新时间" displayValue={bug.updated_at?.slice(0, 10) || '-'} disabled />
      </div>
    </div>
  );
};

export default BugDetail;
