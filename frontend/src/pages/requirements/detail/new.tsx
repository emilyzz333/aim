import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Input, Select, Button, message, Tag, Spin,
} from 'antd';
import request from '@/services/request';

const STATUS_OPTIONS = [
  { value: 'pending_review', label: '待评审', color: 'blue' },
  { value: 'pending_tech_review', label: '待技评', color: 'purple' },
  { value: 'pending_development', label: '待开发', color: 'orange' },
  { value: 'in_development', label: '开发中', color: 'cyan' },
  { value: 'pending_test', label: '待测试', color: 'green' },
  { value: 'completed', label: '已完成', color: 'success' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '紧急', color: 'red' },
  { value: 'high', label: '高', color: 'orange' },
  { value: 'medium', label: '中', color: 'blue' },
  { value: 'low', label: '低', color: 'default' },
];

// 右侧 inline 表单行
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 3 }}>{label}</div>
    {children}
  </div>
);

const RequirementNewPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initType = searchParams.get('type') || 'product';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reqType, setReqType] = useState(initType);
  const [status, setStatus] = useState('pending_review');
  const [priority, setPriority] = useState('medium');
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [iterationId, setIterationId] = useState<number | undefined>(undefined);
  const [productOwner, setProductOwner] = useState<number | undefined>(undefined);
  const [devOwner, setDevOwner] = useState<number | undefined>(undefined);
  const [testOwner, setTestOwner] = useState<number | undefined>(undefined);
  const [developer, setDeveloper] = useState<number[]>([]);
  const [tester, setTester] = useState<number[]>([]);

  const [projects, setProjects] = useState<any[]>([]);
  const [iterations, setIterations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      request.get('/projects/'),
      request.get('/iterations/'),
      request.get('/users/'),
    ]).then(([p, i, u]) => {
      setProjects(Array.isArray(p.data.results || p.data) ? (p.data.results || p.data) : []);
      setIterations(Array.isArray(i.data.results || i.data) ? (i.data.results || i.data) : []);
      setUsers(Array.isArray(u.data.results || u.data) ? (u.data.results || u.data) : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) { message.warning('请输入标题'); return; }
    if (!projectId) { message.warning('请选择所属项目'); return; }
    setSubmitting(true);
    try {
      const res = await request.post('/requirements/', {
        name: name.trim(),
        description,
        req_type: reqType,
        status,
        priority,
        project: projectId,
        iteration: iterationId,
        product_owner: productOwner,
        dev_owner: devOwner,
        test_owner: testOwner,
        developer,
        tester,
      });
      navigate(`/requirements/${res.data.id}`, { replace: true });
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

  const statusInfo = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  const priorityInfo = PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[2];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff' }}>
      {/* 主体内容 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左侧 */}
        <div style={{ flex: 1, minWidth: 0, padding: '24px 24px 0 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* 类型标识 */}
          <div style={{ marginBottom: 6 }}>
            <Tag color={reqType === 'task' ? 'purple' : 'blue'} style={{ margin: 0, fontSize: 13 }}>
              {reqType === 'task' ? '任务' : '需求'}
            </Tag>
          </div>
          {/* 标题 */}
          <Input
            placeholder="输入标题"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            bordered={false}
            style={{ fontSize: 20, fontWeight: 600, padding: '0 0 8px 0', marginBottom: 8 }}
          />
          <div style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 20 }} />

          {/* 描述 */}
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

          <Field label="需求类型">
            <Select value={reqType} onChange={setReqType} size="small" style={selectStyle}>
              <Select.Option value="product">产品需求</Select.Option>
              <Select.Option value="task">任务</Select.Option>
            </Select>
          </Field>

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

          <Field label={<span>所属项目 <span style={{ color: '#f5222d' }}>*</span></span> as any}>
            <Select
              value={projectId}
              onChange={setProjectId}
              size="small"
              style={selectStyle}
              placeholder="请选择项目"
              showSearch
              optionFilterProp="children"
            >
              {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Field>

          <Field label="迭代">
            <Select
              value={iterationId}
              onChange={setIterationId}
              size="small"
              style={selectStyle}
              placeholder="-"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {iterations.map(i => <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>)}
            </Select>
          </Field>

          <Field label="处理人（产品）">
            <Select value={productOwner} onChange={setProductOwner} size="small" style={selectStyle} placeholder="-" allowClear showSearch optionFilterProp="children">
              {users.map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          </Field>

          <Field label="开发负责人">
            <Select value={devOwner} onChange={setDevOwner} size="small" style={selectStyle} placeholder="-" allowClear showSearch optionFilterProp="children">
              {users.map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          </Field>

          <Field label="测试负责人">
            <Select value={testOwner} onChange={setTestOwner} size="small" style={selectStyle} placeholder="-" allowClear showSearch optionFilterProp="children">
              {users.map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          </Field>

          <Field label="开发人员">
            <Select mode="multiple" value={developer} onChange={setDeveloper} size="small" style={selectStyle} placeholder="-" showSearch optionFilterProp="children">
              {users.map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          </Field>

          <Field label="测试人员">
            <Select mode="multiple" value={tester} onChange={setTester} size="small" style={selectStyle} placeholder="-" showSearch optionFilterProp="children">
              {users.map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
};

export default RequirementNewPage;
