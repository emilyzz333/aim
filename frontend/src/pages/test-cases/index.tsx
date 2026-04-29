import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, Space, message, Tabs,
  Progress, Spin, Alert, Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons';
import request from '@/services/request';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  passed: { label: '通过', color: 'success' },
  failed: { label: '失败', color: 'error' },
  blocked: { label: '阻塞', color: 'warning' },
  skipped: { label: '跳过', color: 'default' },
};

const TestCasesPage = () => {
  const [testCases, setTestCases] = useState<any[]>([]);
  const [testPlans, setTestPlans] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [caseModal, setCaseModal] = useState({ visible: false, editing: null as any });
  const [planModal, setPlanModal] = useState({ visible: false, editing: null as any });
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [caseForm] = Form.useForm();
  const [planForm] = Form.useForm();

  // AI 用例状态
  const [aiReqId, setAiReqId] = useState('');
  const [aiProject, setAiProject] = useState<number | undefined>(undefined);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCases, setAiCases] = useState<any[]>([]);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const fetchTestCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request.get('/test-cases/', { params: filters });
      const data = res.data.results || res.data;
      setTestCases(Array.isArray(data) ? data : []);
    } catch { message.error('获取测试用例列表失败'); }
    finally { setLoading(false); }
  }, [filters]);

  const fetchTestPlans = async () => {
    try {
      const res = await request.get('/test-cases/plans/');
      const data = res.data.results || res.data;
      setTestPlans(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    fetchTestCases();
    fetchTestPlans();
    request.get('/projects/').then((res) => {
      const d = res.data.results || res.data;
      setProjects(Array.isArray(d) ? d : []);
    });
    request.get('/requirements/').then((res) => {
      const d = res.data.results || res.data;
      setRequirements(Array.isArray(d) ? d : []);
    });
  }, [fetchTestCases]);

  const openCaseCreate = () => { caseForm.resetFields(); setCaseModal({ visible: true, editing: null }); };
  const openCaseEdit = (r: any) => { caseForm.setFieldsValue(r); setCaseModal({ visible: true, editing: r }); };

  const handleCaseDelete = async (id: number) => {
    try {
      await request.delete(`/test-cases/${id}/`);
      message.success('已删除');
      fetchTestCases();
    } catch { message.error('删除失败'); }
  };

  const handleCaseSubmit = async (values: any) => {
    try {
      if (caseModal.editing) {
        await request.put(`/test-cases/${caseModal.editing.id}/`, values);
        message.success('已更新');
      } else {
        await request.post('/test-cases/', values);
        message.success('已创建');
      }
      setCaseModal({ visible: false, editing: null });
      fetchTestCases();
    } catch (e: any) { message.error(e.response?.data?.detail || '操作失败'); }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await request.patch(`/test-cases/${id}/`, { status });
      message.success('状态已更新');
      fetchTestCases();
    } catch { message.error('更新失败'); }
  };

  const openPlanCreate = () => { planForm.resetFields(); setPlanModal({ visible: true, editing: null }); };

  const handlePlanSubmit = async (values: any) => {
    try {
      if (planModal.editing) {
        await request.put(`/test-cases/plans/${planModal.editing.id}/`, values);
      } else {
        await request.post('/test-cases/plans/', values);
        message.success('测试计划已创建');
      }
      setPlanModal({ visible: false, editing: null });
      fetchTestPlans();
    } catch (e: any) { message.error(e.response?.data?.detail || '操作失败'); }
  };

  const caseColumns = [
    { title: '编号', dataIndex: 'case_id', key: 'case_id', width: 100 },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '关联需求', dataIndex: 'requirement_name', key: 'requirement_name', width: 160 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => {
        const m = STATUS_MAP[s] || { label: s, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    { title: '平台', dataIndex: 'plat_display', key: 'plat_display', width: 80 },
    { title: '来源', dataIndex: 'source_display', key: 'source_display', width: 80 },
    { title: '创建人', dataIndex: 'created_by_name', key: 'created_by_name', width: 80 },
    {
      title: '操作', key: 'action', width: 200,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Select
            size="small" value={r.status} style={{ width: 80 }}
            onChange={(v) => handleStatusUpdate(r.id, v)}
          >
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v.label}</Select.Option>
            ))}
          </Select>
          <Button size="small" icon={<EditOutlined />} onClick={() => openCaseEdit(r)} />
          <Popconfirm title="确认删除？" onConfirm={() => handleCaseDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const planColumns = [
    { title: '计划名称', dataIndex: 'name', key: 'name' },
    { title: '所属项目', dataIndex: 'project_name', key: 'project_name' },
    {
      title: '执行进度', key: 'progress',
      render: (_: any, r: any) => (
        <div style={{ minWidth: 140 }}>
          <Progress
            percent={r.pass_rate || 0}
            size="small"
            format={() => `${r.passed_cases}/${r.total_cases} 通过`}
          />
        </div>
      ),
    },
    { title: '创建人', dataIndex: 'created_by_name', key: 'created_by_name', width: 90 },
  ];

  const tabItems = [
    {
      key: 'cases',
      label: '测试用例',
      children: (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <Select placeholder="筛选项目" allowClear style={{ width: 160 }}
              onChange={(v) => setFilters((f) => ({ ...f, project: v }))}>
              {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
            <Select placeholder="筛选状态" allowClear style={{ width: 120 }}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.label}</Select.Option>
              ))}
            </Select>
            <Input.Search placeholder="关键词搜索" allowClear style={{ width: 200 }}
              onSearch={(v) => setFilters((f) => ({ ...f, keyword: v }))} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCaseCreate}>新建用例</Button>
          </div>
          <Table columns={caseColumns} dataSource={testCases} rowKey="id" loading={loading} />
        </div>
      ),
    },
    {
      key: 'plans',
      label: '测试计划',
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openPlanCreate}>新建计划</Button>
          </div>
          <Table columns={planColumns} dataSource={testPlans} rowKey="id" />
        </div>
      ),
    },
    {
      key: 'ai-cases',
      label: <span><RobotOutlined /> AI用例</span>,
      children: (
        <div>
          <Alert
            message="AI 测试用例生成"
            description="输入需求 ID，AI 将根据需求内容自动生成结构化测试用例。生成后可逐条保存到用例库，审核状态默认为待审核。"
            type="info" showIcon style={{ marginBottom: 16 }}
          />
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <Input
                placeholder="需求 ID（数字）"
                value={aiReqId}
                onChange={(e) => setAiReqId(e.target.value)}
                style={{ width: 160 }}
                type="number"
              />
              <Select
                placeholder="选择保存项目"
                style={{ width: 200 }}
                value={aiProject}
                onChange={setAiProject}
              >
                {projects.map((p) => (
                  <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                ))}
              </Select>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={aiLoading}
                onClick={async () => {
                  if (!aiReqId) { message.warning('请输入需求 ID'); return; }
                  setAiLoading(true);
                  setAiCases([]);
                  try {
                    const res = await request.post('/integrations/ai/test-case-generation/', {
                      requirement_id: Number(aiReqId),
                    });
                    if (res.data.test_cases?.length > 0) {
                      setAiCases(res.data.test_cases);
                    } else {
                      message.info('AI 未返回结构化用例，请检查需求内容');
                    }
                  } catch { message.error('AI 生成失败'); }
                  finally { setAiLoading(false); }
                }}
              >
                生成测试用例
              </Button>
            </Space>
          </Card>

          {aiLoading && <Spin tip="AI 生成中..." style={{ display: 'block', marginTop: 24 }} />}

          {aiCases.length > 0 && (
            <Table
              dataSource={aiCases}
              rowKey={(_, i) => String(i)}
              size="small"
              pagination={false}
              columns={[
                { title: '用例名称', dataIndex: 'name', key: 'name', width: 200 },
                { title: '前置条件', dataIndex: 'precondition', key: 'precondition', width: 160 },
                {
                  title: '测试步骤', dataIndex: 'steps', key: 'steps',
                  render: (steps: any) => Array.isArray(steps) ? steps.join('\n') : steps,
                },
                { title: '预期结果', dataIndex: 'expected', key: 'expected' },
                {
                  title: '操作', key: 'action', width: 120,
                  render: (_: any, record: any, idx: number) => (
                    <Button
                      size="small"
                      type="primary"
                      loading={savingIdx === idx}
                      onClick={async () => {
                        if (!aiProject) { message.warning('请先选择保存项目'); return; }
                        setSavingIdx(idx);
                        try {
                          await request.post('/test-cases/', {
                            title: record.name,
                            steps: Array.isArray(record.steps) ? record.steps.join('\n') : record.steps,
                            expected_result: record.expected,
                            project: aiProject,
                            requirement: aiReqId ? Number(aiReqId) : undefined,
                            source: 'ai',
                            reviewed: 'pending',
                          });
                          message.success('已保存到用例库，审核状态：待审核');
                        } catch (e: any) {
                          message.error(e.response?.data?.detail || '保存失败');
                        } finally { setSavingIdx(null); }
                      }}
                    >
                      保存
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{
      padding: '24px',
      background: '#f5f5f7',
      minHeight: '100vh',
      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
    }}>
      <h2 style={{ marginBottom: 16 }}>测试管理</h2>
      <Tabs items={tabItems} />

      {/* 测试用例弹窗 */}
      <Modal
        title={caseModal.editing ? '编辑测试用例' : '新建测试用例'}
        open={caseModal.visible}
        onCancel={() => setCaseModal({ visible: false, editing: null })}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={caseForm} onFinish={handleCaseSubmit} layout="vertical">
          <Form.Item name="case_id" label="用例编号">
            <Input placeholder="留空自动生成" />
          </Form.Item>
          <Form.Item name="title" label="用例标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="project" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select>
              {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="requirement" label="关联需求">
            <Select allowClear placeholder="可选">
              {requirements.map((r) => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="plat" label="平台" initialValue="web">
            <Select>
              <Select.Option value="web">Web</Select.Option>
              <Select.Option value="ios">iOS</Select.Option>
              <Select.Option value="android">Android</Select.Option>
              <Select.Option value="harmonyos">鸿蒙</Select.Option>
              <Select.Option value="server">后端Server</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="steps" label="测试步骤" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="expected_result" label="预期结果" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setCaseModal({ visible: false, editing: null })} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 测试计划弹窗 */}
      <Modal
        title="新建测试计划"
        open={planModal.visible}
        onCancel={() => setPlanModal({ visible: false, editing: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={planForm} onFinish={handlePlanSubmit} layout="vertical">
          <Form.Item name="name" label="计划名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="project" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select>
              {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setPlanModal({ visible: false, editing: null })} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TestCasesPage;
