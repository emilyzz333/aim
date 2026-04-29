import { useState, useEffect } from 'react';
import {
  Button, Modal, Form, Input, DatePicker, Select, Tag, Popconfirm,
  message, Empty, Spin, Badge, Space, Table, Drawer,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExportOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import request from '@/services/request';
import RequirementDetail from '@/pages/requirements/detail';
import MdSourceDrawer from '@/components/MdSourceDrawer';

const { RangePicker } = DatePicker;

const ITER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  planning: { label: '规划中', color: 'blue' },
  active: { label: '进行中', color: 'green' },
  completed: { label: '已完成', color: 'default' },
};

const REQ_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_review: { label: '待评审', color: 'blue' },
  pending_tech_review: { label: '待技评', color: 'purple' },
  pending_development: { label: '待开发', color: 'orange' },
  in_development: { label: '开发中', color: 'cyan' },
  resolved: { label: '已修复', color: 'geekblue' },
  pending_test: { label: '待测试', color: 'green' },
  in_testing: { label: '测试中', color: 'lime' },
  pending_acceptance: { label: '待验收', color: 'gold' },
  pending_release: { label: '待上线', color: 'magenta' },
  pending_regression: { label: '待回归', color: 'volcano' },
  completed: { label: '已完成', color: 'success' },
  rejected: { label: '已拒绝', color: 'red' },
  suspended: { label: '挂起', color: 'default' },
  closed: { label: '已关闭', color: 'default' },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  critical: { label: '紧急', color: 'red' },
  high: { label: '高', color: 'orange' },
  medium: { label: '中', color: 'blue' },
  low: { label: '低', color: 'default' },
};

const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  url_fetch: { label: '链接', color: 'orange' },
  upload_file: { label: '文件', color: 'cyan' },
  ai_conversation: { label: '对话', color: 'purple' },
  screenshot_input: { label: '截图', color: 'blue' },
  gitlab_pull: { label: 'GitLab', color: 'green' },
};

const IterationsPage = () => {
  const [iterations, setIterations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedIter, setSelectedIter] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<number>>(new Set());
  const [reqLoading, setReqLoading] = useState(false);
  const [iterLoading, setIterLoading] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState<number | undefined>(undefined);
  const [reqStatusFilter, setReqStatusFilter] = useState<string | undefined>(undefined);
  const [reqKeyword, setReqKeyword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIteration, setEditingIteration] = useState<any>(null);
  const [form] = Form.useForm();

  // 详情抽屉
  const [detailId, setDetailId] = useState<number | null>(null);

  // 快速创建需求
  const [quickCreate, setQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPriority, setQuickPriority] = useState('medium');
  const [quickSaving, setQuickSaving] = useState(false);
  const [mdDrawer, setMdDrawer] = useState<{ open: boolean; reqId: number; reqName: string; mdType: 'req_md' | 'tech_md' | 'ui_design' | 'ui_design_web' | 'ui_design_app' }>({ open: false, reqId: 0, reqName: '', mdType: 'req_md' });

  const QUICK_ROW_KEY = '__quick_create__';
  const parentIds = new Set(requirements.filter(r => !r.parent).map((r: any) => r.id));

  const resetQuick = () => { setQuickCreate(false); setQuickName(''); setQuickPriority('medium'); };

  const handleQuickSave = async () => {
    if (!quickName.trim()) { message.warning('请输入需求名称'); return; }
    if (!selectedIter) { message.warning('请先选择迭代'); return; }
    setQuickSaving(true);
    try {
      await request.post('/requirements/', {
        name: quickName.trim(),
        priority: quickPriority,
        iteration: selectedIter.id,
        project: selectedIter.project,
      });
      message.success('需求已创建');
      resetQuick();
      fetchRequirements();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '创建失败');
    } finally {
      setQuickSaving(false);
    }
  };

  useEffect(() => {
    request.get('/auth/me/').then((res) => setIsAdmin(res.data.is_admin_or_above)).catch(() => {});
    request.get('/projects/').then((res) => {
      const data = res.data.results || res.data;
      setProjects(Array.isArray(data) ? data : []);
    });
  }, []);

  // 加载迭代列表（按项目筛选）
  const fetchIterations = async () => {
    setIterLoading(true);
    try {
      const params: any = {};
      if (filterProjectId) params.project_id = filterProjectId;
      const res = await request.get('/iterations/', { params });
      const data = res.data.results || res.data;
      const list = Array.isArray(data) ? data : [];
      setIterations(list);
      // 默认选中第一个进行中的迭代，否则选第一个
      if (!selectedIter || !list.find((i: any) => i.id === selectedIter?.id)) {
        const active = list.find((i: any) => i.status === 'active') || list[0] || null;
        setSelectedIter(active);
      }
    } catch {
      message.error('获取迭代列表失败');
    } finally {
      setIterLoading(false);
    }
  };

  useEffect(() => { fetchIterations(); }, [filterProjectId]);

  // 加载选中迭代的需求
  const fetchRequirements = async () => {
    if (!selectedIter) { setRequirements([]); return; }
    setReqLoading(true);
    try {
      const params: any = { iteration: selectedIter.id, ordering: '-updated_at' };
      if (reqStatusFilter) params.status = reqStatusFilter;
      if (reqKeyword) params.keyword = reqKeyword;
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
      setReqLoading(false);
    }
  };

  useEffect(() => { fetchRequirements(); }, [selectedIter, reqStatusFilter, reqKeyword]);

  const openCreate = () => {
    setEditingIteration(null);
    form.resetFields();
    if (filterProjectId) form.setFieldValue('project', filterProjectId);
    setModalVisible(true);
  };

  const openEdit = (record: any) => {
    setEditingIteration(record);
    form.setFieldsValue({
      name: record.name,
      project: record.project,
      status: record.status,
      dateRange: [dayjs(record.start_date), dayjs(record.end_date)],
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/iterations/${id}/`);
      message.success('迭代已删除');
      fetchIterations();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    const { dateRange, ...rest } = values;
    const payload = {
      ...rest,
      start_date: dateRange[0].format('YYYY-MM-DD'),
      end_date: dateRange[1].format('YYYY-MM-DD'),
    };
    try {
      if (editingIteration) {
        await request.put(`/iterations/${editingIteration.id}/`, payload);
        message.success('迭代已更新');
      } else {
        await request.post('/iterations/', payload);
        message.success('迭代已创建');
      }
      setModalVisible(false);
      fetchIterations();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    }
  };

  const openReqCreate = () => {};

  const reqColumns = [
    { title: '编号', dataIndex: 'requirement_id', key: 'requirement_id', width: 120,
      ellipsis: true,
      render: (val: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        const displayId = r.tapd_short_id ? `TAPD-${r.tapd_short_id}` : val;
        if (r.tapd_url) {
          return (
            <a
              href={r.tapd_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={val}
              style={{ color: '#0071e3', fontSize: 12 }}
            >
              {displayId}
            </a>
          );
        }
        return val;
      },
    },
    {
      title: <span>名称 <span style={{ color: '#999', fontWeight: 400 }}>({requirements.filter(r => r._key !== QUICK_ROW_KEY).length})</span></span>,
      dataIndex: 'name', key: 'name',
      render: (val: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) {
          return (
            <Input
              autoFocus
              placeholder="请输入需求名称"
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
            <span style={{ cursor: 'pointer', color: '#1890ff', flex: 1, minWidth: 0 }} onClick={() => setDetailId(r.id)}>
              {val}
            </span>
            <ExportOutlined
              style={{ color: '#bbb', fontSize: 13, flexShrink: 0, cursor: 'pointer' }}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.open(`/requirements/${r.id}`, '_blank'); }}
            />
          </span>
        );
      },
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 80,
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
        const m = PRIORITY_MAP[p] || { label: p, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string, r: any) => {
        if (r._key === QUICK_ROW_KEY) return null;
        const m = REQ_STATUS_MAP[s] || { label: s, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
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
    { title: '处理人', dataIndex: 'product_owner_name', key: 'product_owner_name', width: 90,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : val,
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 110,
      render: (val: string, r: any) => r._key === QUICK_ROW_KEY ? null : (val ? val.slice(0, 10) : ''),
    },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: (_: any, r: any) => {
        if (r._key === QUICK_ROW_KEY) {
          return (
            <Space size={4}>
              <Button type="primary" loading={quickSaving} onClick={handleQuickSave}>确定</Button>
              <Button onClick={resetQuick}>取消</Button>
            </Space>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 0,
      height: '100%',
      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
    }}>
      {/* 左侧迭代列表面板 */}
      <div style={{
        width: 260,
        minWidth: 260,
        borderRight: '1px solid rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
      }}>
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Select
            placeholder="筛选项目"
            allowClear
            style={{ width: '100%' }}
            value={filterProjectId}
            onChange={setFilterProjectId}
            size="large"
          >
            {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
          </Select>
          {isAdmin && (
            <Button
              icon={<PlusOutlined />}
              onClick={openCreate}
              block
              style={{
                height: '36px',
                fontSize: '14px',
                fontWeight: 400,
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                color: 'rgba(0, 0, 0, 0.8)',
              }}
            >
              新建迭代
            </Button>
          )}
        </div>

        <Spin spinning={iterLoading} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {iterations.length === 0 && !iterLoading ? (
            <Empty description="暂无迭代" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
              {iterations.map((iter) => {
                const statusInfo = ITER_STATUS_MAP[iter.status] || { label: iter.status, color: 'default' };
                const isSelected = selectedIter?.id === iter.id;
                return (
                  <div
                    key={iter.id}
                    onClick={() => setSelectedIter(iter)}
                    style={{
                      padding: '12px 14px',
                      marginBottom: '8px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: isSelected ? '#f5f5f7' : 'transparent',
                      border: isSelected ? '1px solid rgba(0, 113, 227, 0.2)' : '1px solid transparent',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#fafafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {/* 选中指示器 */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '3px',
                        height: '20px',
                        background: '#0071e3',
                        borderRadius: '0 2px 2px 0',
                      }} />
                    )}

                    <div style={{
                      fontWeight: isSelected ? 500 : 400,
                      fontSize: '15px',
                      color: isSelected ? '#1d1d1f' : 'rgba(0, 0, 0, 0.8)',
                      marginBottom: '6px',
                      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                    }}>
                      {iter.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Tag
                        color={statusInfo.color}
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: 'none',
                        }}
                      >
                        {statusInfo.label}
                      </Tag>
                      {isAdmin && (
                        <Space size={4} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Button
                            size="small"
                            type="text"
                            icon={<EditOutlined style={{ fontSize: 14 }} />}
                            onClick={() => openEdit(iter)}
                            style={{
                              width: 28,
                              height: 28,
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'rgba(0, 0, 0, 0.48)',
                            }}
                          />
                          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(iter.id)} okText="删除" cancelText="取消">
                            <Button
                              size="small"
                              type="text"
                              danger
                              icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                              style={{
                                width: 28,
                                height: 28,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'rgba(0, 0, 0, 0.48)',
                              }}
                            />
                          </Popconfirm>
                        </Space>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Spin>
      </div>

      {/* 右侧需求列表 */}
      <div style={{ flex: 1, padding: '24px 32px', overflow: 'auto', background: '#f5f5f7' }}>
        {/* 标题区域 */}
        <div style={{ marginBottom: '20px' }}>
          {selectedIter ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                fontSize: '24px',
                fontWeight: 600,
                color: 'rgba(0, 0, 0, 0.8)',
              }}>
                {selectedIter.name}
              </span>
              <span style={{
                fontSize: '14px',
                color: 'rgba(0, 0, 0, 0.48)',
                fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
              }}>
                {selectedIter.start_date} ~ {selectedIter.end_date}
              </span>
            </div>
          ) : (
            <span style={{
              fontSize: '14px',
              color: 'rgba(0, 0, 0, 0.48)',
              fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            }}>
              请选择左侧迭代
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 160 }}
            onChange={setReqStatusFilter}
          >
            {Object.entries(REQ_STATUS_MAP).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v.label}</Select.Option>
            ))}
          </Select>
          <Input.Search
            placeholder="关键词搜索" allowClear style={{ width: 200 }}
            onSearch={setReqKeyword}
          />
        </div>

        {(() => {
          const quickRow = { _key: QUICK_ROW_KEY };
          const visibleRequirements = requirements.filter((r: any) => !r.parent || !collapsedParentIds.has(r.parent));
          const tableData = quickCreate ? [quickRow, ...visibleRequirements] : visibleRequirements;
          const QuickTriggerRow = () => (
            <tr>
              <td colSpan={12} style={{ padding: 0, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ padding: '8px 16px', background: '#fff' }}>
                  <span
                    style={{ cursor: 'pointer', color: '#8c8c8c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => selectedIter && setQuickCreate(true)}
                  >
                    <PlusOutlined /> 创建需求
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
          return (
            <Table
              className="iter-req-table"
              columns={reqColumns}
              dataSource={tableData}
              rowKey={(r: any) => r._key || r.id}
              rowClassName={(r: any) => r._key === QUICK_ROW_KEY ? 'quick-create-row' : ''}
              loading={reqLoading}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              locale={{ emptyText: selectedIter ? '暂无需求' : '请选择左侧迭代查看需求' }}
              scroll={{ x: 'max-content' }}
              components={tableComponents}
            />
          );
        })()}
      </div>

      {/* 新建/编辑迭代弹窗 */}
      <Modal
        title={null}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnHidden
        width={520}
        styles={{
          body: { padding: '32px' },
        }}
        closeIcon={<span style={{ fontSize: '20px', color: 'rgba(0, 0, 0, 0.48)' }}>×</span>}
      >
        <div style={{
          fontSize: '21px',
          fontWeight: 600,
          color: '#1d1d1f',
          marginBottom: '24px',
          fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
        }}>
          {editingIteration ? '编辑迭代' : '新建迭代'}
        </div>

        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="name"
            label={<span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(0, 0, 0, 0.8)' }}>迭代名称</span>}
            rules={[{ required: true, message: '请输入迭代名称' }]}
          >
            <Input
              placeholder="请输入迭代名称"
              style={{
                height: '44px',
                fontSize: '15px',
                borderRadius: '8px',
                border: '1px solid rgba(0, 0, 0, 0.15)',
              }}
            />
          </Form.Item>

          <Form.Item
            name="project"
            label={<span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(0, 0, 0, 0.8)' }}>所属项目</span>}
            rules={[{ required: true, message: '请选择项目' }]}
          >
            <Select
              placeholder="选择项目"
              style={{ width: '100%' }}
              size="large"
            >
              {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item
            name="dateRange"
            label={<span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(0, 0, 0, 0.8)' }}>迭代周期</span>}
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <RangePicker
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="status"
            label={<span style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(0, 0, 0, 0.8)' }}>状态</span>}
            initialValue="planning"
          >
            <Select size="large">
              <Select.Option value="planning">规划中</Select.Option>
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: '32px' }}>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setModalVisible(false)}
                style={{
                  height: '40px',
                  padding: '0 24px',
                  fontSize: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  background: 'transparent',
                  color: 'rgba(0, 0, 0, 0.8)',
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                style={{
                  height: '40px',
                  padding: '0 24px',
                  fontSize: '15px',
                  borderRadius: '8px',
                  background: '#0071e3',
                  border: 'none',
                }}
              >
                保存
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 需求详情抽屉 */}
      <Drawer
        open={detailId !== null}
        onClose={() => { setDetailId(null); fetchRequirements(); }}
        width={1500}
        title="需求详情"
        destroyOnHidden
      >
        {detailId !== null && (
          <RequirementDetail requirementId={detailId} onClose={() => { setDetailId(null); fetchRequirements(); }} onNavigate={(id) => setDetailId(id)} />
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

export default IterationsPage;
