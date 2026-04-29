import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, Space, Row, Col, Card, Statistic, message, Drawer,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons';
import request from '@/services/request';
import BugDetail from './detail';

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高', color: 'orange' },
  medium: { label: '中', color: 'gold' },
  low: { label: '低', color: 'blue' },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: '待处理', color: 'blue' },
  in_progress: { label: '处理中', color: 'cyan' },
  fixed: { label: '已修复', color: 'green' },
  verified: { label: '已验证', color: 'success' },
  closed: { label: '已关闭', color: 'default' },
  reopen: { label: '重新打开', color: 'volcano' },
};

const QUICK_ROW_KEY = '__quick_create__';

const BugsPage = () => {
  const [bugs, setBugs] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBug, setEditingBug] = useState<any>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [form] = Form.useForm();

  // 快速创建
  const [quickCreate, setQuickCreate] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState('medium');
  const [quickSaving, setQuickSaving] = useState(false);

  // 详情抽屉
  const [detailId, setDetailId] = useState<number | null>(null);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request.get('/bugs/', { params: filters });
      const data = res.data.results || res.data;
      setBugs(Array.isArray(data) ? data : []);
    } catch { message.error('获取缺陷列表失败'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);

  useEffect(() => {
    request.get('/requirements/').then((res: any) => {
      const d = res.data.results || res.data;
      setRequirements(Array.isArray(d) ? d : []);
    });
    request.get('/users/').then((res: any) => {
      const d = res.data.results || res.data;
      setUsers(Array.isArray(d) ? d : []);
    });
  }, []);

  const handleQuickSave = async () => {
    if (!quickTitle.trim()) { message.warning('请输入缺陷标题'); return; }
    setQuickSaving(true);
    try {
      await request.post('/bugs/', { title: quickTitle.trim(), priority: quickPriority });
      message.success('缺陷已创建');
      setQuickCreate(false);
      setQuickTitle('');
      setQuickPriority('medium');
      fetchBugs();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '创建失败');
    } finally {
      setQuickSaving(false);
    }
  };

  const resetQuick = () => { setQuickCreate(false); setQuickTitle(''); setQuickPriority('medium'); };

  const openEdit = (bug: any) => { form.setFieldsValue(bug); setEditingBug(bug); setModalVisible(true); };

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/bugs/${id}/`);
      message.success('缺陷已删除');
      fetchBugs();
    } catch { message.error('删除失败'); }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingBug) {
        await request.put(`/bugs/${editingBug.id}/`, values);
        message.success('缺陷已更新');
      } else {
        await request.post('/bugs/', values);
        message.success('缺陷已提报');
      }
      setModalVisible(false);
      fetchBugs();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    }
  };

  const openCount = bugs.filter((b) => b.status === 'open').length;
  const inProgressCount = bugs.filter((b) => b.status === 'in_progress').length;
  const criticalCount = bugs.filter((b) => b.priority === 'critical').length;

  const columns = [
    {
      title: '缺陷标题', dataIndex: 'title', key: 'title',
      render: (val: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) {
          return (
            <Input
              autoFocus
              placeholder="请输入缺陷标题"
              value={quickTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickTitle(e.target.value)}
              onPressEnter={handleQuickSave}
            />
          );
        }
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{ cursor: 'pointer', color: '#1890ff', flex: 1, minWidth: 0 }}
              onClick={() => setDetailId(r.id)}
            >
              {val}
            </span>
            <ExportOutlined
              style={{ color: '#bbb', fontSize: 13, flexShrink: 0, cursor: 'pointer' }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.open(`/bugs/${r.id}`, '_blank'); }}
            />
          </span>
        );
      },
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 110,
      render: (s: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) {
          return (
            <Select value={quickPriority} onChange={setQuickPriority} style={{ width: '100%' }}>
              <Select.Option value="critical">严重</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          );
        }
        const m = PRIORITY_MAP[s] || { label: s, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        const m = STATUS_MAP[s] || { label: s, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    { title: '关联需求', dataIndex: 'requirement_name', key: 'requirement_name',
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : val,
    },
    { title: '负责人', dataIndex: 'assignee_name', key: 'assignee_name', width: 90,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : (val || '-'),
    },
    { title: '报告人', dataIndex: 'reporter_name', key: 'reporter_name', width: 90,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : (val || '-'),
    },
    { title: '环境', dataIndex: 'env_display', key: 'env_display', width: 70,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : val,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : (val ? val.slice(0, 10) : ''),
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 110,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : (val ? val.slice(0, 10) : ''),
    },
    {
      title: '操作', key: 'action', width: 120,
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
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const QuickTriggerRow = () => (
    <tr>
      <td colSpan={10} style={{ padding: 0, borderBottom: '1px solid #f0f0f0' }}>
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

  const tableData = quickCreate ? [{ _key: QUICK_ROW_KEY }, ...bugs] : bugs;

  return (
    <div style={{
      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
      background: '#f5f5f7',
      minHeight: '100vh',
      padding: '32px 40px',
    }}>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="总缺陷数" value={bugs.length} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="待处理" value={openCount} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="处理中" value={inProgressCount} valueStyle={{ color: '#13c2c2' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="严重缺陷" value={criticalCount} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select placeholder="优先级" allowClear style={{ width: 120 }}
          onChange={(v: string) => setFilters((f) => ({ ...f, priority: v }))}>
          {Object.entries(PRIORITY_MAP).map(([k, v]) => (
            <Select.Option key={k} value={k}>{v.label}</Select.Option>
          ))}
        </Select>
        <Select placeholder="状态" allowClear style={{ width: 120 }}
          onChange={(v: string) => setFilters((f) => ({ ...f, status: v }))}>
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <Select.Option key={k} value={k}>{v.label}</Select.Option>
          ))}
        </Select>
        <Input.Search placeholder="关键词搜索" allowClear style={{ width: 200 }}
          onSearch={(v: string) => setFilters((f) => ({ ...f, keyword: v }))} />
      </div>

      <Table
        className="bug-table"
        columns={columns}
        dataSource={tableData}
        rowKey={(r: any) => r._key || r.id}
        rowClassName={(r: any) => r._key === QUICK_ROW_KEY ? 'quick-create-row' : ''}
        loading={loading}
        size="small"
        components={tableComponents}
      />

      <Modal
        title={editingBug ? '编辑缺陷' : '新建缺陷'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="title" label="缺陷标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="缺陷描述" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" initialValue="medium" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="critical">严重</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="low">低</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="env" label="环境" initialValue="test">
                <Select>
                  <Select.Option value="dev">开发</Select.Option>
                  <Select.Option value="test">测试</Select.Option>
                  <Select.Option value="staging">预发</Select.Option>
                  <Select.Option value="production">生产</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="requirement" label="关联需求">
            <Select allowClear placeholder="可选">
              {requirements.map((r) => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="assignee" label="负责人">
            <Select allowClear placeholder="分配给">
              {users.map((u) => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="steps_to_reproduce" label="复现步骤">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setModalVisible(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 缺陷详情抽屉 */}
      <Drawer
        open={detailId !== null}
        onClose={() => { setDetailId(null); fetchBugs(); }}
        width={1200}
        title="缺陷详情"
        destroyOnClose
      >
        {detailId !== null && (
          <BugDetail bugId={detailId} onClose={() => { setDetailId(null); fetchBugs(); }} />
        )}
      </Drawer>
    </div>
  );
};

export default BugsPage;
