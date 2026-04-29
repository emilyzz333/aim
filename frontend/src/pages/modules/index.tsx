import { useState, useEffect } from 'react';
import { Tree, Button, Modal, Form, Input, Select, Popconfirm, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import request from '@/services/request';

interface ModuleNode {
  id: number;
  name: string;
  description?: string;
  parent: number | null;
  project: number;
  order: number;
  children?: ModuleNode[];
}

function toTreeData(modules: ModuleNode[]): any[] {
  return modules.map((m) => ({
    ...m,
    key: m.id,
    title: m.name,
    children: m.children ? toTreeData(m.children) : [],
  }));
}

const ModulesPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const projectId = params.get('project_id');

  const [modules, setModules] = useState<ModuleNode[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    projectId ? Number(projectId) : null,
  );
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleNode | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    request.get('/projects/').then((res) => {
      const data = res.data.results || res.data;
      setProjects(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchModules(selectedProjectId);
    }
  }, [selectedProjectId]);

  const fetchModules = async (pid: number) => {
    setLoading(true);
    try {
      const res = await request.get('/projects/modules/', { params: { project_id: pid } });
      const data = res.data.results || res.data;
      setModules(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取模块列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (pid: number | null = null) => {
    setEditingModule(null);
    setParentId(pid);
    form.resetFields();
    form.setFieldValue('parent', pid);
    setModalVisible(true);
  };

  const openEdit = (mod: ModuleNode) => {
    setEditingModule(mod);
    form.setFieldsValue({ name: mod.name, description: mod.description, parent: mod.parent });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/projects/modules/${id}/`);
      message.success('模块已删除');
      if (selectedProjectId) fetchModules(selectedProjectId);
    } catch (error: any) {
      const msg = error.response?.data?.detail || '删除失败（可能有子模块）';
      message.error(msg);
    }
  };

  const handleSubmit = async (values: any) => {
    const payload = {
      ...values,
      project: selectedProjectId,
    };
    try {
      if (editingModule) {
        await request.put(`/projects/modules/${editingModule.id}/`, payload);
        message.success('模块已更新');
      } else {
        await request.post('/projects/modules/', payload);
        message.success('模块已创建');
      }
      setModalVisible(false);
      if (selectedProjectId) fetchModules(selectedProjectId);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    }
  };

  const renderTreeTitle = (node: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{node.name}</span>
      <Button
        size="small"
        type="text"
        icon={<PlusOutlined />}
        onClick={(e) => { e.stopPropagation(); openCreate(node.id); }}
        title="添加子模块"
      />
      <Button
        size="small"
        type="text"
        icon={<EditOutlined />}
        onClick={(e) => { e.stopPropagation(); openEdit(node); }}
      />
      <Popconfirm
        title="删除该模块？若有子模块将无法删除。"
        onConfirm={() => handleDelete(node.id)}
        okText="删除"
        cancelText="取消"
      >
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
      </Popconfirm>
    </div>
  );

  const treeData = toTreeData(modules).map((n) => ({ ...n, title: renderTreeTitle(n) }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <ApartmentOutlined style={{ marginRight: 8 }} />
          模块管理
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            placeholder="选择项目"
            style={{ width: 200 }}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
          >
            {projects.map((p) => (
              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
            ))}
          </Select>
          {selectedProjectId && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(null)}>
              新建根模块
            </Button>
          )}
        </div>
      </div>

      <Card loading={loading}>
        {modules.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
            {selectedProjectId ? '暂无模块，点击"新建根模块"开始' : '请先选择项目'}
          </div>
        ) : (
          <Tree
            treeData={treeData}
            defaultExpandAll
            blockNode
          />
        )}
      </Card>

      <Modal
        title={editingModule ? '编辑模块' : '新建模块'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="name" label="模块名称" rules={[{ required: true, message: '请输入模块名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="parent" label="父级模块" hidden>
            <Input />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setModalVisible(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModulesPage;
