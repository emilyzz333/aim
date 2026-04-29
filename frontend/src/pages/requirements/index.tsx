import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Popconfirm,
  Space, Switch, Badge, message, Drawer,
} from 'antd';
import {
  EditOutlined, DeleteOutlined, SwapOutlined,
  FolderOutlined, PlusOutlined, ExportOutlined, RightOutlined,
} from '@ant-design/icons';
import request from '@/services/request';
import RequirementDetail from './detail';
import MdSourceDrawer from '@/components/MdSourceDrawer';

const STATUS_LIST = [
  { value: 'pending_review', label: '待评审', color: 'blue' },
  { value: 'pending_tech_review', label: '待技评', color: 'purple' },
  { value: 'pending_development', label: '待开发', color: 'orange' },
  { value: 'in_development', label: '开发中', color: 'cyan' },
  { value: 'resolved', label: '已修复', color: 'geekblue' },
  { value: 'pending_test', label: '待测试', color: 'green' },
  { value: 'in_testing', label: '测试中', color: 'lime' },
  { value: 'pending_acceptance', label: '待验收', color: 'gold' },
  { value: 'pending_release', label: '待上线', color: 'magenta' },
  { value: 'pending_regression', label: '待回归', color: 'volcano' },
  { value: 'completed', label: '已完成', color: 'success' },
  { value: 'rejected', label: '已拒绝', color: 'error' },
  { value: 'suspended', label: '挂起', color: 'warning' },
  { value: 'closed', label: '关闭', color: 'default' },
];

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  critical: { label: '紧急', color: 'red' },
  high: { label: '高', color: 'orange' },
  medium: { label: '中', color: 'blue' },
  low: { label: '低', color: 'default' },
};

// 状态流转允许的目标状态映射（前端提示用，实际由后端校验）
const NEXT_STATUS: Record<string, string[]> = {
  pending_review: ['pending_tech_review', 'closed'],
  pending_tech_review: ['pending_development', 'closed'],
  pending_development: ['in_development', 'closed'],
  in_development: ['pending_test', 'closed'],
  pending_test: ['in_development', 'in_test', 'closed'],
  in_test: ['pending_acceptance', 'closed'],
  pending_acceptance: ['pending_release', 'closed'],
  pending_release: ['pending_regression', 'closed'],
  pending_regression: ['completed', 'closed'],
  completed: ['closed'],
  closed: [],
};

const getStatusInfo = (value: string) =>
  STATUS_LIST.find((s) => s.value === value) || { label: value, color: 'default' };

const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  url_fetch: { label: '链接', color: 'orange' },
  upload_file: { label: '文件', color: 'cyan' },
  ai_conversation: { label: '对话', color: 'purple' },
  screenshot_input: { label: '截图', color: 'blue' },
  gitlab_pull: { label: 'GitLab', color: 'green' },
};

const RequirementsPage = () => {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<number>>(new Set());
  const [projects, setProjects] = useState<any[]>([]);
  const [iterations, setIterations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [ordering, setOrdering] = useState('-updated_at');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReq, setEditingReq] = useState<any>(null);
  const [statusModal, setStatusModal] = useState<{ visible: boolean; req: any | null }>({ visible: false, req: null });
  const [rejectReasonVisible, setRejectReasonVisible] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [form] = Form.useForm();

  // 快速创建
  const [quickCreate, setQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPriority, setQuickPriority] = useState('medium');
  const [quickProject, setQuickProject] = useState<number | undefined>(undefined);
  const [quickSaving, setQuickSaving] = useState(false);

  // 详情抽屉
  const [detailId, setDetailId] = useState<number | null>(null);
  const [mdDrawer, setMdDrawer] = useState<{ open: boolean; reqId: number; reqName: string; mdType: 'req_md' | 'tech_md' | 'ui_design' | 'ui_design_web' | 'ui_design_app' }>({ open: false, reqId: 0, reqName: '', mdType: 'req_md' });

  const handleQuickSave = async () => {
    if (!quickName.trim()) { message.warning('请输入需求名称'); return; }
    if (!quickProject) { message.warning('请选择项目'); return; }
    setQuickSaving(true);
    try {
      await request.post('/requirements/', {
        name: quickName.trim(),
        priority: quickPriority,
        project: quickProject,
      });
      message.success('需求已创建');
      setQuickCreate(false);
      setQuickName('');
      setQuickPriority('medium');
      fetchAll();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '创建失败');
    } finally {
      setQuickSaving(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { ...filters, ordering };
      if (showArchived) params.include_archived = 'true';
      const res = await request.get('/requirements/', { params });
      const data = res.data.results || res.data;
      const reqs = Array.isArray(data) ? data : [];

      // 按父子关系排序：父需求在前，子需求紧跟其后
      const parentMap = new Map();
      const orphans: any[] = [];
      reqs.forEach((r: any) => {
        if (r.parent) {
          if (!parentMap.has(r.parent)) parentMap.set(r.parent, []);
          parentMap.get(r.parent).push(r);
        } else {
          orphans.push(r);
        }
      });
      const sorted: any[] = [];
      orphans.forEach((parent: any) => {
        sorted.push(parent);
        const children = parentMap.get(parent.id) || [];
        sorted.push(...children);
      });
      setRequirements(sorted);
    } catch {
      message.error('获取需求列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters, showArchived, ordering]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    request.get('/projects/').then((res) => {
      const d = res.data.results || res.data;
      setProjects(Array.isArray(d) ? d : []);
    });
    request.get('/iterations/').then((res) => {
      const d = res.data.results || res.data;
      setIterations(Array.isArray(d) ? d : []);
    });
  }, []);

  const openEdit = (req: any) => { setEditingReq(req); form.setFieldsValue(req); setModalVisible(true); };

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/requirements/${id}/`);
      message.success('需求已删除');
      fetchAll();
    } catch { message.error('删除失败'); }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingReq) {
        await request.put(`/requirements/${editingReq.id}/`, values);
        message.success('需求已更新');
      } else {
        await request.post('/requirements/', values);
        message.success('需求已创建');
      }
      setModalVisible(false);
      fetchAll();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    }
  };

  const openStatusModal = (req: any) => setStatusModal({ visible: true, req });

  const handleStatusChange = async (status: string) => {
    const req = statusModal.req;
    if (status === 'in_development' && req.status === 'pending_test') {
      setTargetStatus(status);
      setRejectReasonVisible(true);
      return;
    }
    await submitStatusChange(req.id, status, '');
  };

  const submitStatusChange = async (id: number, status: string, reason: string) => {
    try {
      const body: any = { status };
      if (reason) body.reject_reason = reason;
      await request.post(`/requirements/${id}/change-status/`, body);
      message.success('状态已更新');
      setStatusModal({ visible: false, req: null });
      setRejectReasonVisible(false);
      setRejectReason('');
      fetchAll();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '状态变更失败');
    }
  };

  const handleArchive = async (req: any) => {
    try {
      await request.post(`/requirements/${req.id}/archive/`);
      message.success('需求已归档');
      fetchAll();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '归档失败');
    }
  };

  const handleTableChange = (_: any, __: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      const prefix = sorter.order === 'descend' ? '-' : '';
      setOrdering(`${prefix}${sorter.field}`);
    } else {
      setOrdering('-updated_at');
    }
  };

  const QUICK_ROW_KEY = '__quick_create__';
  const parentIds = new Set(requirements.filter(r => !r.parent).map((r: any) => r.id));

  const resetQuick = () => {
    setQuickCreate(false);
    setQuickName('');
    setQuickPriority('medium');
    setQuickProject(undefined);
  };

  const columns = [
    {
      title: '编号', dataIndex: 'requirement_id', key: 'requirement_id', width: 120,
      sorter: true, showSorterTooltip: false,
      render: (val: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        const displayId = r.tapd_short_id ? `TAPD-${r.tapd_short_id}` : val;
        if (r.tapd_url) {
          return (
            <a href={r.tapd_url} target="_blank" rel="noopener noreferrer"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              title={val} style={{ color: '#0071e3', fontSize: 12 }}>
              {displayId}
            </a>
          );
        }
        return <span style={{ fontSize: 12 }}>{displayId}</span>;
      },
    },
    {
      title: <span>名称 <span style={{ color: '#999', fontWeight: 400 }}>({requirements.length})</span></span>,
      dataIndex: 'name', key: 'name', width: 360,
      render: (name: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) {
          return (
            <Input
              autoFocus
              placeholder="请输入需求标题"
              value={quickName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickName(e.target.value)}
              onPressEnter={handleQuickSave}
            />
          );
        }
        const isChild = !!r.parent;
        const hasChildren = parentIds.has(r.id);
        const isCollapsed = collapsedParentIds.has(r.id);
        return (
          <span className="name-cell-wrap" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {hasChildren && (
              <span
                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: '#86868b', flexShrink: 0, width: 16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsedParentIds(prev => {
                    const next = new Set(prev);
                    if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                    return next;
                  });
                }}
              >
                <RightOutlined style={{ fontSize: 10, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }} />
              </span>
            )}
            {!hasChildren && isChild && (
              <span style={{ display: 'inline-block', width: 20, height: 1, background: '#d9d9d9', marginRight: 4, flexShrink: 0 }} />
            )}
            {!hasChildren && !isChild && <span style={{ width: 16, flexShrink: 0 }} />}
            <span
              style={{ cursor: 'pointer', color: '#1890ff', flex: 1, minWidth: 0 }}
              onClick={() => setDetailId(r.id)}
            >
              {r.is_blocked && <Badge status="error" title="已阻塞" style={{ marginRight: 4 }} />}
              {name}
              {r.is_archived && <Tag style={{ marginLeft: 4 }}>已归档</Tag>}
            </span>
            <ExportOutlined
              className="open-detail-btn"
              style={{ color: '#bbb', fontSize: 13, flexShrink: 0, cursor: 'pointer' }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.open(`/requirements/${r.id}`, '_blank'); }}
            />
          </span>
        );
      },
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 100,
      sorter: true, showSorterTooltip: false,
      render: (p: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) {
          return (
            <Select value={quickPriority} onChange={setQuickPriority} style={{ width: '100%' }}>
              <Select.Option value="critical">紧急</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          );
        }
        const info = PRIORITY_MAP[p] || { label: p, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '所属迭代', dataIndex: 'iteration_name', key: 'iteration_name', width: 200,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : val,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      sorter: true, showSorterTooltip: false,
      render: (s: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        const info = getStatusInfo(s);
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '需求md', dataIndex: 'req_md_source_type', key: 'req_md', width: 80,
      render: (val: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        if (val) {
          const info = SOURCE_TYPE_LABELS[val] || { label: val, color: 'default' };
          return <Tag color={info.color} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setMdDrawer({ open: true, reqId: r.id, reqName: r.name, mdType: 'req_md' }); }}>{info.label}</Tag>;
        }
        return r.req_md ? <Tag color="blue" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setMdDrawer({ open: true, reqId: r.id, reqName: r.name, mdType: 'req_md' }); }}>已有</Tag> : <Tag color="default">无</Tag>;
      },
    },
    {
      title: '技术md', dataIndex: 'tech_md_source_type', key: 'tech_md', width: 80,
      render: (val: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        if (val) {
          const info = SOURCE_TYPE_LABELS[val] || { label: val, color: 'default' };
          return <Tag color={info.color} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setMdDrawer({ open: true, reqId: r.id, reqName: r.name, mdType: 'tech_md' }); }}>{info.label}</Tag>;
        }
        return r.tech_md ? <Tag color="blue" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setMdDrawer({ open: true, reqId: r.id, reqName: r.name, mdType: 'tech_md' }); }}>已有</Tag> : <Tag color="default">无</Tag>;
      },
    },
    {
      title: 'UI-Web', dataIndex: 'ui_design_web_source_type', key: 'ui_design_web', width: 70,
      render: (val: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        if (val) {
          const info = SOURCE_TYPE_LABELS[val] || { label: val, color: 'default' };
          return <Tag color={info.color} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setMdDrawer({ open: true, reqId: r.id, reqName: r.name, mdType: 'ui_design_web' }); }}>{info.label}</Tag>;
        }
        return r.ui_design_web ? <a href={r.ui_design_web} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 12 }}>查看</a> : <Tag color="default">无</Tag>;
      },
    },
    {
      title: 'UI-App', dataIndex: 'ui_design_app_source_type', key: 'ui_design_app', width: 70,
      render: (val: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        if (val) {
          const info = SOURCE_TYPE_LABELS[val] || { label: val, color: 'default' };
          return <Tag color={info.color} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setMdDrawer({ open: true, reqId: r.id, reqName: r.name, mdType: 'ui_design_app' }); }}>{info.label}</Tag>;
        }
        return r.ui_design_app ? <a href={r.ui_design_app} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 12 }}>查看</a> : <Tag color="default">无</Tag>;
      },
    },
    {
      title: '处理人', dataIndex: 'product_owner_name', key: 'product_owner_name', width: 90,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : val,
    },
    {
      title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 110,
      sorter: true, showSorterTooltip: false,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : (val ? val.slice(0, 10) : ''),
    },
    {
      title: '操作', key: 'action', width: 130,
      render: (_: any, r: any) => {
        if (r._key === QUICK_ROW_KEY) {
          return (
            <Space size={4}>
              <Button type="primary" size="small" loading={quickSaving} onClick={handleQuickSave}>确定</Button>
              <Button size="small" onClick={resetQuick}>取消</Button>
            </Space>
          );
        }
        return (
          <Space size={4}>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            <Button size="small" icon={<SwapOutlined />} onClick={() => openStatusModal(r)} title="变更状态" />
            {r.status === 'completed' && !r.is_archived && (
              <Button size="small" icon={<FolderOutlined />} onClick={() => handleArchive(r)} title="归档" />
            )}
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // 快速创建触发行（未展开时注入）
  const QuickTriggerRow = () => (
    <tr>
      <td colSpan={14} style={{ padding: 0, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ padding: '8px 16px', background: '#fff' }}>
          <span
            style={{ cursor: 'pointer', color: '#8c8c8c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setQuickCreate(true)}
          >
            <PlusOutlined /> 快速创建
          </span>
        </div>
      </td>
    </tr>
  );

  const tableComponents = !quickCreate ? {
    body: {
      wrapper: ({ children, ...props }: any) => (
        <tbody {...props}>
          <QuickTriggerRow />
          {children}
        </tbody>
      ),
    },
  } : undefined;

  const quickRow = { _key: QUICK_ROW_KEY };
  const visibleRequirements = requirements.filter(r => !r.parent || !collapsedParentIds.has(r.parent));
  const tableData = quickCreate ? [quickRow, ...visibleRequirements] : visibleRequirements;

  return (
    <div style={{
      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
      background: '#f5f5f7',
      minHeight: '100vh',
      padding: '32px 40px',
    }}>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          placeholder="筛选项目" allowClear style={{ width: 160 }}
          onChange={(v) => setFilters((f) => ({ ...f, project: v }))}
        >
          {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
        </Select>
        <Select
          placeholder="筛选迭代" allowClear style={{ width: 160 }}
          onChange={(v) => setFilters((f) => ({ ...f, iteration_id: v }))}
        >
          {iterations.map((i) => <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>)}
        </Select>
        <Select
          placeholder="需求类型" allowClear style={{ width: 140 }}
          onChange={(v) => setFilters((f) => ({ ...f, req_type: v }))}
        >
          <Select.Option value="product">产品需求</Select.Option>
          <Select.Option value="technical">技术需求</Select.Option>
          <Select.Option value="ui">UI设计</Select.Option>
          <Select.Option value="task">任务</Select.Option>
        </Select>
        <Select
          placeholder="筛选状态" allowClear style={{ width: 130 }}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
        >
          {STATUS_LIST.map((s) => <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>)}
        </Select>
        <Select
          placeholder="筛选优先级" allowClear style={{ width: 110 }}
          onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
        >
          <Select.Option value="critical">紧急</Select.Option>
          <Select.Option value="high">高</Select.Option>
          <Select.Option value="medium">中</Select.Option>
          <Select.Option value="low">低</Select.Option>
        </Select>
        <Input.Search
          placeholder="关键词搜索" allowClear style={{ width: 200 }}
          onSearch={(v) => setFilters((f) => ({ ...f, search: v }))}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: '#595959' }}>显示归档</span>
          <Switch checked={showArchived} onChange={setShowArchived} size="small" />
        </div>
      </div>

      <style>{`
        .req-table .ant-table-thead > tr > th {
          background: #fff !important;
          color: #333 !important;
          font-weight: 600;
          border-bottom: 1px solid #f0f0f0;
          padding-top: 12px !important;
          padding-bottom: 12px !important;
        }
        .req-table .quick-create-row > td {
          padding-top: 14px !important;
          padding-bottom: 14px !important;
        }
      `}</style>

      {/* 快速创建行通过 tableComponents 注入到表头下方 */}
      <Table
        className="req-table"
        columns={columns}
        dataSource={tableData}
        rowKey={(r: any) => r._key || r.id}
        rowClassName={(r: any) => r._key === QUICK_ROW_KEY ? 'quick-create-row' : ''}
        loading={loading}
        size="small"
        rowSelection={{ type: 'checkbox' }}
        onChange={handleTableChange}
        components={tableComponents}
      />

      {/* 新建/编辑需求弹窗 */}
      <Modal
        title={editingReq ? '编辑需求' : '新建需求'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
        destroyOnHidden
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="requirement_id" label="需求编号">
            <Input placeholder="留空自动生成" />
          </Form.Item>
          <Form.Item name="name" label="需求名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="project" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select placeholder="选择项目">
              {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="iteration" label="所属迭代">
            <Select placeholder="选择迭代" allowClear>
              {iterations.map((i) => <Select.Option key={i.id} value={i.id}>{i.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              <Select.Option value="critical">紧急</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="req_type" label="需求类型" initialValue="product">
            <Select>
              <Select.Option value="product">产品需求</Select.Option>
              <Select.Option value="technical">技术需求</Select.Option>
              <Select.Option value="ui">UI设计</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="需求描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setModalVisible(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 状态变更弹窗（任务 5.11）*/}
      <Modal
        title="变更需求状态"
        open={statusModal.visible}
        onCancel={() => setStatusModal({ visible: false, req: null })}
        footer={null}
        width={500}
      >
        {statusModal.req && (
          <div>
            <div style={{ marginBottom: 16 }}>
              当前状态：
              <Tag color={getStatusInfo(statusModal.req.status).color}>
                {getStatusInfo(statusModal.req.status).label}
              </Tag>
            </div>
            <div>
              <p>可流转到：</p>
              <Space wrap>
                {(NEXT_STATUS[statusModal.req.status] || []).map((s) => {
                  const info = getStatusInfo(s);
                  return (
                    <Button
                      key={s}
                      type="default"
                      onClick={() => handleStatusChange(s)}
                    >
                      <Tag color={info.color} style={{ margin: 0 }}>{info.label}</Tag>
                    </Button>
                  );
                })}
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* 驳回原因弹窗 */}
      <Modal
        title="填写驳回原因"
        open={rejectReasonVisible}
        onOk={() => {
          if (!rejectReason.trim()) {
            message.warning('驳回原因不能为空');
            return;
          }
          submitStatusChange(statusModal.req?.id, targetStatus, rejectReason);
        }}
        onCancel={() => { setRejectReasonVisible(false); setRejectReason(''); }}
        okText="确认驳回"
        cancelText="取消"
      >
        <p>驳回原因（必填）：</p>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请说明驳回原因"
        />
      </Modal>

      {/* 需求详情抽屉 */}
      <Drawer
        open={detailId !== null}
        onClose={() => { setDetailId(null); fetchAll(); }}
        width={1200}
        title="需求详情"
        destroyOnHidden
      >
        {detailId !== null && (
          <RequirementDetail requirementId={detailId} onClose={() => { setDetailId(null); fetchAll(); }} onNavigate={(id) => setDetailId(id)} />
        )}
      </Drawer>

      <MdSourceDrawer
        requirementId={mdDrawer.reqId}
        requirementName={mdDrawer.reqName}
        mdType={mdDrawer.mdType}
        open={mdDrawer.open}
        onClose={() => setMdDrawer(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default RequirementsPage;
