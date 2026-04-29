import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Select, Button, message, Tag, Spin } from 'antd';
import { BugOutlined } from '@ant-design/icons';
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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 3 }}>{label}</div>
    {children}
  </div>
);

const BugNewPage = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('major');
  const [status, setStatus] = useState('open');
  const [bugType, setBugType] = useState('function');
  const [source, setSource] = useState('test');
  const [env, setEnv] = useState<string | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
  const [requirementId, setRequirementId] = useState<number | undefined>(undefined);

  const [users, setUsers] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      request.get('/users/'),
      request.get('/requirements/'),
    ]).then(([u, r]) => {
      setUsers(Array.isArray(u.data.results || u.data) ? (u.data.results || u.data) : []);
      setRequirements(Array.isArray(r.data.results || r.data) ? (r.data.results || r.data) : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) { message.warning('请输入缺陷标题'); return; }
    setSubmitting(true);
    try {
      const res = await request.post('/bugs/', {
        title: title.trim(),
        description,
        priority,
        status,
        type: bugType,
        source,
        env: env || null,
        assignee: assigneeId,
        requirement: requirementId,
      });
      navigate(`/bugs/${res.data.id}`, { replace: true });
    } catch (e: any) {
      message.error(e.response?.data?.detail || '创建失败');
      setSubmitting(false);
    }
  };

  const selectStyle = { width: '100%', fontSize: 13 };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff' }}>
      {/* 主体 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左侧 */}
        <div style={{ flex: 1, minWidth: 0, padding: '24px 24px 0 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* 类型标识 */}
          <div style={{ marginBottom: 6 }}>
            <Tag color="red" style={{ margin: 0, fontSize: 13 }}>
              <BugOutlined style={{ marginRight: 4 }} />缺陷
            </Tag>
          </div>
          <Input
            placeholder="输入缺陷标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            bordered={false}
            style={{ fontSize: 20, fontWeight: 600, padding: '0 0 8px 0', marginBottom: 8 }}
          />
          <div style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 20 }} />
          <Input.TextArea
            placeholder="添加描述..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            bordered={false}
            autoSize={{ minRows: 10 }}
            style={{ fontSize: 14, color: '#262626', padding: 0 }}
          />

          {/* 底部操作区 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 0', borderTop: '1px solid #f0f0f0', marginTop: 'auto',
          }}>
            <Button type="primary" loading={submitting} onClick={handleCreate}
              style={{ height: 40, fontSize: 15, padding: '0 28px' }}>
              创建
            </Button>
            <Button onClick={() => window.close()}
              style={{ height: 40, fontSize: 15, padding: '0 28px' }}>
              取消
            </Button>
          </div>
        </div>

        {/* 右侧属性 */}
        <div style={{
          width: 280, minWidth: 280, borderLeft: '1px solid #f0f0f0',
          padding: '20px 16px', overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#262626', marginBottom: 16 }}>基础信息</div>

          <Field label="状态">
            <Select value={status} onChange={setStatus} size="small" style={selectStyle}>
              {STATUS_OPTIONS.map(o => (
                <Select.Option key={o.value} value={o.value}>
                  <Tag color={o.color} style={{ margin: 0 }}>{o.label}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Field>

          <Field label="优先级">
            <Select value={priority} onChange={setPriority} size="small" style={selectStyle}>
              {PRIORITY_OPTIONS.map(o => (
                <Select.Option key={o.value} value={o.value}>
                  <Tag color={o.color} style={{ margin: 0 }}>{o.label}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Field>

          <Field label="缺陷类型">
            <Select value={bugType} onChange={setBugType} size="small" style={selectStyle}>
              {TYPE_OPTIONS.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
            </Select>
          </Field>

          <Field label="来源">
            <Select value={source} onChange={setSource} size="small" style={selectStyle}>
              {SOURCE_OPTIONS.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
            </Select>
          </Field>

          <Field label="环境">
            <Select value={env} onChange={setEnv} size="small" style={selectStyle} placeholder="-" allowClear>
              {ENV_OPTIONS.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
            </Select>
          </Field>

          <Field label="负责人">
            <Select value={assigneeId} onChange={setAssigneeId} size="small" style={selectStyle} placeholder="-" allowClear showSearch optionFilterProp="children">
              {users.map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          </Field>

          <Field label="关联需求">
            <Select value={requirementId} onChange={setRequirementId} size="small" style={selectStyle} placeholder="-" allowClear showSearch optionFilterProp="children">
              {requirements.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
};

export default BugNewPage;
