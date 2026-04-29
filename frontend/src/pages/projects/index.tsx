import { useState, useEffect } from 'react';
import { Table, Button, Select, Popconfirm, message, Tabs, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined, CaretRightOutlined, FolderFilled } from '@ant-design/icons';
import request from '@/services/request';

interface ModuleNode {
  id: number;
  name: string;
  description?: string;
  parent: number | null;
  project: number;
  order: number;
  children?: ModuleNode[];
  level?: number;
}

// ---- 模块管理 Tab ----
const ModulesTab = () => {
  const [modules, setModules] = useState<ModuleNode[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [quickCreate, setQuickCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<number>>(new Set());

  // 快速创建状态
  const [quickName, setQuickName] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickParent, setQuickParent] = useState<number | null>(null);
  const [quickProject, setQuickProject] = useState<number | undefined>(undefined);
  const [quickSaving, setQuickSaving] = useState(false);

  // 编辑状态
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editParent, setEditParent] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    request.get('/projects/').then((res) => {
      const data = res.data.results || res.data;
      setProjects(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    if (selectedProjectId && selectedProjectId !== 'all') {
      fetchModules(selectedProjectId);
    } else if (selectedProjectId === 'all') {
      fetchAllModules();
    }
  }, [selectedProjectId, projects]);

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

  const fetchAllModules = async () => {
    setLoading(true);
    try {
      const allModules: ModuleNode[] = [];
      for (const project of projects) {
        const res = await request.get('/projects/modules/', { params: { project_id: project.id } });
        const data = res.data.results || res.data;
        if (Array.isArray(data)) {
          allModules.push(...data);
        }
      }
      setModules(allModules);
    } catch {
      message.error('获取模块列表失败');
    } finally {
      setLoading(false);
    }
  };

  const resetQuick = () => {
    setQuickCreate(false);
    setQuickName('');
    setQuickDesc('');
    setQuickParent(null);
    setQuickProject(undefined);
  };

  const startQuickCreate = (parentId: number | null = null) => {
    setQuickCreate(true);
    setQuickParent(parentId);
    setQuickName('');
    setQuickDesc('');

    // 如果是添加子模块，自动选中父模块的项目
    if (parentId !== null) {
      const parentModule = flatModules.find((m) => m.id === parentId);
      if (parentModule) {
        setQuickProject(parentModule.project);
      }
    } else {
      setQuickProject(undefined);
    }
  };

  const handleQuickSave = async () => {
    if (!quickName.trim()) { message.warning('请输入模块名称'); return; }
    const targetProject = selectedProjectId === 'all' ? quickProject : selectedProjectId;
    if (!targetProject) { message.warning('请选择所属项目'); return; }
    setQuickSaving(true);
    try {
      await request.post('/projects/modules/', {
        name: quickName.trim(),
        description: quickDesc.trim() || undefined,
        parent: quickParent,
        project: targetProject,
      });
      message.success('模块已创建');
      resetQuick();
      if (selectedProjectId === 'all') {
        fetchAllModules();
      } else if (selectedProjectId) {
        fetchModules(selectedProjectId);
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '创建失败');
    } finally {
      setQuickSaving(false);
    }
  };

  const startEdit = (mod: ModuleNode) => {
    setEditingId(mod.id);
    setEditName(mod.name);
    setEditDesc(mod.description || '');
    setEditParent(mod.parent);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setEditParent(null);
  };

  const handleEditSave = async (id: number) => {
    if (!editName.trim()) { message.warning('请输入模块名称'); return; }
    const module = flatModules.find((m) => m.id === id);
    if (!module) return;
    setEditSaving(true);
    try {
      await request.put(`/projects/modules/${id}/`, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        parent: editParent,
        project: module.project,
      });
      message.success('模块已更新');
      cancelEdit();
      if (selectedProjectId === 'all') {
        fetchAllModules();
      } else if (selectedProjectId) {
        fetchModules(selectedProjectId);
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '更新失败');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/projects/modules/${id}/`);
      message.success('模块已删除');
      if (selectedProjectId === 'all') {
        fetchAllModules();
      } else if (selectedProjectId) {
        fetchModules(selectedProjectId);
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败（可能有子模块）');
    }
  };

  // 扁平化模块树，支持展开/收起
  const flattenModules = (nodes: ModuleNode[], level = 0, parentExpanded = true): any[] => {
    let result: any[] = [];
    nodes.forEach((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedKeys.has(node.id);
      // 移除 children 字段，避免 Ant Design Table 自动添加展开按钮
      const { children, ...nodeWithoutChildren } = node;
      result.push({ ...nodeWithoutChildren, level, hasChildren });

      // 只有父节点展开且当前节点展开时，才显示子节点
      if (hasChildren && isExpanded && parentExpanded) {
        result = result.concat(flattenModules(children!, level + 1, true));
      }
    });
    return result;
  };

  const flatModules = flattenModules(modules);

  // 初始化展开所有节点
  useEffect(() => {
    const getAllIds = (nodes: ModuleNode[]): number[] => {
      let ids: number[] = [];
      nodes.forEach((node) => {
        ids.push(node.id);
        if (node.children && node.children.length > 0) {
          ids = ids.concat(getAllIds(node.children));
        }
      });
      return ids;
    };
    setExpandedKeys(new Set(getAllIds(modules)));
  }, [modules]);

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedKeys(newExpanded);
  };
  const moduleOptions = flatModules.map((m) => ({
    label: '  '.repeat(m.level) + m.name,
    value: m.id,
  }));

  const QUICK_ROW_KEY = '__quick_create__';

  // 构建表格数据，将快速创建行插入到正确位置
  let tableData: any[] = [];
  if (quickCreate) {
    if (quickParent === null) {
      // 根模块，插入到最前面
      const quickRow = { _key: QUICK_ROW_KEY, id: 0, name: '', description: '', parent: null, project: 0, order: 0, level: 0 };
      tableData = [quickRow, ...flatModules];
    } else {
      // 子模块，插入到父模块后面
      const parentIndex = flatModules.findIndex((m) => m.id === quickParent);
      if (parentIndex !== -1) {
        const parentLevel = flatModules[parentIndex].level || 0;
        const quickRow = { _key: QUICK_ROW_KEY, id: 0, name: '', description: '', parent: quickParent, project: 0, order: 0, level: parentLevel + 1 };
        tableData = [
          ...flatModules.slice(0, parentIndex + 1),
          quickRow,
          ...flatModules.slice(parentIndex + 1),
        ];
      } else {
        tableData = flatModules;
      }
    }
  } else {
    tableData = flatModules;
  }

  const columns = [
    {
      title: '模块名称', dataIndex: 'name', key: 'name', width: 250,
      render: (name: string, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: record.level * 24 }}>
              <span style={{ width: 20, display: 'inline-block' }}></span>
              <Input
                autoFocus
                placeholder="模块名称 *"
                value={quickName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickName(e.target.value)}
                onPressEnter={handleQuickSave}
                size="small"
                style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', marginLeft: 4 }}
              />
            </div>
          );
        }
        if (editingId === record.id) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: record.level * 24 }}>
              <span style={{ width: 20, display: 'inline-block' }}></span>
              <Input
                autoFocus
                placeholder="模块名称 *"
                value={editName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                size="small"
                style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', marginLeft: 4 }}
              />
            </div>
          );
        }

        const hasChildren = record.hasChildren;
        const isExpanded = expandedKeys.has(record.id);

        return (
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: record.level * 24 }}>
            {hasChildren ? (
              <>
                <CaretRightOutlined
                  onClick={() => toggleExpand(record.id)}
                  style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#8c8c8c',
                    transition: 'transform 0.2s ease',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    width: 20,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <FolderFilled style={{
                  fontSize: 14,
                  color: '#ff9500',
                  marginLeft: 4,
                  marginRight: 4,
                }} />
              </>
            ) : (
              <span style={{
                width: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                color: '#d9d9d9',
                marginRight: 4,
              }}>●</span>
            )}
            <span style={{ color: '#1d1d1f' }}>{name}</span>
          </div>
        );
      },
    },
    ...(selectedProjectId === 'all' ? [{
      title: '所属项目', dataIndex: 'project', key: 'project', width: 150,
      render: (projectId: number, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <Select
              placeholder="所属项目 *"
              value={quickProject}
              onChange={setQuickProject}
              options={projects.map((p) => ({ label: p.name, value: p.id }))}
              size="small"
              style={{ width: '100%', borderRadius: 8 }}
            />
          );
        }
        if (editingId === record.id) {
          const proj = projects.find((p) => p.id === record.project);
          return <span style={{ color: 'rgba(0,0,0,0.8)' }}>{proj ? proj.name : '-'}</span>;
        }
        const proj = projects.find((p) => p.id === projectId);
        return <span style={{ color: 'rgba(0,0,0,0.8)' }}>{proj ? proj.name : '-'}</span>;
      },
    }] : []),
    {
      title: '描述', dataIndex: 'description', key: 'description', ellipsis: true,
      render: (desc: string, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <Input
              placeholder="描述（可选）"
              value={quickDesc}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickDesc(e.target.value)}
              size="small"
              style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}
            />
          );
        }
        if (editingId === record.id) {
          return (
            <Input
              placeholder="描述（可选）"
              value={editDesc}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDesc(e.target.value)}
              size="small"
              style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}
            />
          );
        }
        return <span style={{ color: 'rgba(0,0,0,0.8)' }}>{desc}</span>;
      },
    },
    {
      title: '父模块', dataIndex: 'parent', key: 'parent', width: 180,
      render: (parent: number | null, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <Select
              placeholder="父模块（可选）"
              value={quickParent}
              onChange={setQuickParent}
              options={moduleOptions}
              allowClear
              size="small"
              style={{ width: '100%', borderRadius: 8 }}
            />
          );
        }
        if (editingId === record.id) {
          return (
            <Select
              placeholder="父模块（可选）"
              value={editParent}
              onChange={setEditParent}
              options={moduleOptions.filter((o) => o.value !== record.id)}
              allowClear
              size="small"
              style={{ width: '100%', borderRadius: 8 }}
            />
          );
        }
        const parentModule = flatModules.find((m) => m.id === parent);
        return <span style={{ color: 'rgba(0,0,0,0.8)' }}>{parentModule ? parentModule.name : '-'}</span>;
      },
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="primary" size="small" loading={quickSaving} onClick={handleQuickSave}
                style={{ background: '#0071e3', borderRadius: 8, border: 'none', fontFamily: "'SF Pro Text', sans-serif" }}>确定</Button>
              <Button size="small" onClick={resetQuick} style={{ borderRadius: 8, fontFamily: "'SF Pro Text', sans-serif" }}>取消</Button>
            </div>
          );
        }
        if (editingId === record.id) {
          return (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="primary" size="small" loading={editSaving} onClick={() => handleEditSave(record.id)}
                style={{ background: '#0071e3', borderRadius: 8, border: 'none', fontFamily: "'SF Pro Text', sans-serif" }}>保存</Button>
              <Button size="small" onClick={cancelEdit} style={{ borderRadius: 8, fontFamily: "'SF Pro Text', sans-serif" }}>取消</Button>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => startQuickCreate(record.id)}
              title="添加子模块" style={{ borderRadius: 8, color: '#0071e3', border: 'none' }} />
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => startEdit(record)}
              style={{ borderRadius: 8, color: '#0071e3', border: 'none' }} />
            <Popconfirm title="删除该模块？若有子模块将无法删除。"
              onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ borderRadius: 8, border: 'none' }} />
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  const QuickTriggerRow = () => (
    <tr>
      <td colSpan={selectedProjectId === 'all' ? 5 : 4} style={{ padding: 0, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '6px 16px', background: '#fff' }}>
          <span
            style={{ cursor: 'pointer', color: '#0071e3', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => startQuickCreate(null)}
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

  return (
    <div>
      <style>{`
        .module-table .ant-table-thead > tr > th {
          background: #f5f5f7 !important;
          color: #1d1d1f !important;
          font-weight: 600;
          border-bottom: 1px solid rgba(0,0,0,0.1);
          font-family: 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .module-table .ant-table-tbody > tr > td {
          font-family: 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: rgba(0,0,0,0.8);
        }
        .module-table .ant-table-tbody > tr:hover > td {
          background: #fafafc !important;
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ color: '#1d1d1f', fontWeight: 600, fontSize: 14 }}>项目：</span>
        <Select
          placeholder="选择项目"
          style={{ width: 200, borderRadius: 8 }}
          value={selectedProjectId}
          onChange={setSelectedProjectId}
        >
          <Select.Option value="all">所有项目</Select.Option>
          {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
        </Select>
      </div>

      <Table className="module-table" columns={columns} dataSource={tableData}
        rowKey={(r: any) => r._key || r.id} loading={loading} size="small" components={tableComponents} pagination={false} />
    </div>
  );
};

// ---- 项目列表 Tab ----
const ProjectsTab = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // 快速创建
  const [quickCreate, setQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickTechLead, setQuickTechLead] = useState<number | undefined>(undefined);
  const [quickTestLead, setQuickTestLead] = useState<number | undefined>(undefined);
  const [quickSaving, setQuickSaving] = useState(false);

  // 编辑状态
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTechLead, setEditTechLead] = useState<number | undefined>(undefined);
  const [editTestLead, setEditTestLead] = useState<number | undefined>(undefined);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetchProjects();
    request.get('/auth/me/').then((res: any) => {
      setIsAdmin(res.data.is_admin_or_above);
    }).catch(() => {});
    request.get('/users/list/').then((res) => {
      const data = res.data.results || res.data;
      setUsers(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await request.get('/projects/');
      const data = response.data.results || response.data;
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSave = async () => {
    if (!quickName.trim()) { message.warning('请输入项目名称'); return; }
    setQuickSaving(true);
    try {
      await request.post('/projects/', {
        name: quickName.trim(),
        description: quickDesc.trim() || undefined,
        tech_lead: quickTechLead,
        test_lead: quickTestLead,
      });
      message.success('项目已创建');
      setQuickCreate(false);
      setQuickName('');
      setQuickDesc('');
      setQuickTechLead(undefined);
      setQuickTestLead(undefined);
      fetchProjects();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '创建失败');
    } finally {
      setQuickSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/projects/${id}/`);
      message.success('项目已删除');
      fetchProjects();
    } catch {
      message.error('删除失败');
    }
  };

  const userOptions = users.map((u: any) => ({ label: u.username, value: u.id }));

  // 快速创建行作为 dataSource 第一条特殊记录，各列 render 里判断渲染输入控件
  const QUICK_ROW_KEY = '__quick_create__';

  const resetQuick = () => {
    setQuickCreate(false);
    setQuickName('');
    setQuickDesc('');
    setQuickTechLead(undefined);
    setQuickTestLead(undefined);
  };

  const startEdit = (project: any) => {
    setEditingId(project.id);
    setEditName(project.name);
    setEditDesc(project.description || '');
    setEditTechLead(project.tech_lead);
    setEditTestLead(project.test_lead);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setEditTechLead(undefined);
    setEditTestLead(undefined);
  };

  const handleEditSave = async (id: number) => {
    if (!editName.trim()) { message.warning('请输入项目名称'); return; }
    setEditSaving(true);
    try {
      await request.put(`/projects/${id}/`, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        tech_lead: editTechLead,
        test_lead: editTestLead,
      });
      message.success('项目已更新');
      cancelEdit();
      fetchProjects();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '更新失败');
    } finally {
      setEditSaving(false);
    }
  };

  const columns = [
    {
      title: '项目名称', dataIndex: 'name', key: 'name', width: 200,
      render: (name: string, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <Input
              autoFocus
              placeholder="项目名称 *"
              value={quickName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickName(e.target.value)}
              onPressEnter={handleQuickSave}
              size="small"
              style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}
            />
          );
        }
        if (editingId === record.id) {
          return (
            <Input
              autoFocus
              placeholder="项目名称 *"
              value={editName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
              size="small"
              style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}
            />
          );
        }
        return <a href={`/iterations?project_id=${record.id}`} style={{ color: '#0066cc', textDecoration: 'none' }}>{name}</a>;
      },
    },
    {
      title: '描述', dataIndex: 'description', key: 'description', ellipsis: true, width: 220,
      render: (desc: string, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <Input
              placeholder="描述（可选）"
              value={quickDesc}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickDesc(e.target.value)}
              size="small"
              style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}
            />
          );
        }
        if (editingId === record.id) {
          return (
            <Input
              placeholder="描述（可选）"
              value={editDesc}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDesc(e.target.value)}
              size="small"
              style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}
            />
          );
        }
        return desc;
      },
    },
    {
      title: '技术负责人', dataIndex: 'tech_lead_name', key: 'tech_lead_name', width: 140,
      render: (val: string, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <Select
              placeholder="技术负责人"
              value={quickTechLead}
              onChange={setQuickTechLead}
              options={userOptions}
              allowClear
              size="small"
              style={{ width: '100%' }}
            />
          );
        }
        if (editingId === record.id) {
          return (
            <Select
              placeholder="技术负责人"
              value={editTechLead}
              onChange={setEditTechLead}
              options={userOptions}
              allowClear
              size="small"
              style={{ width: '100%' }}
            />
          );
        }
        return val;
      },
    },
    {
      title: '测试负责人', dataIndex: 'test_lead_name', key: 'test_lead_name', width: 140,
      render: (val: string, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <Select
              placeholder="测试负责人"
              value={quickTestLead}
              onChange={setQuickTestLead}
              options={userOptions}
              allowClear
              size="small"
              style={{ width: '100%' }}
            />
          );
        }
        if (editingId === record.id) {
          return (
            <Select
              placeholder="测试负责人"
              value={editTestLead}
              onChange={setEditTestLead}
              options={userOptions}
              allowClear
              size="small"
              style={{ width: '100%' }}
            />
          );
        }
        return val;
      },
    },
    { title: '创建人', dataIndex: 'created_by_name', key: 'created_by_name',
      render: (val: string, record: any) => (record._key === QUICK_ROW_KEY || editingId === record.id) ? null : val,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (val: string, record: any) => (record._key === QUICK_ROW_KEY || editingId === record.id) ? null : (val ? val.slice(0, 10) : ''),
    },
    ...(isAdmin ? [{
      title: '操作', key: 'action', width: 120,
      render: (_: any, record: any) => {
        if (record._key === QUICK_ROW_KEY) {
          return (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="primary" size="small" loading={quickSaving} onClick={handleQuickSave}
                style={{ background: '#0071e3', borderRadius: 8, border: 'none' }}>确定</Button>
              <Button size="small" onClick={resetQuick} style={{ borderRadius: 8 }}>取消</Button>
            </div>
          );
        }
        if (editingId === record.id) {
          return (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="primary" size="small" loading={editSaving} onClick={() => handleEditSave(record.id)}
                style={{ background: '#0071e3', borderRadius: 8, border: 'none' }}>保存</Button>
              <Button size="small" onClick={cancelEdit} style={{ borderRadius: 8 }}>取消</Button>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(record)} style={{ borderRadius: 8 }} />
            <Popconfirm title="确认删除该项目？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
              <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }} />
            </Popconfirm>
          </div>
        );
      },
    }] : []),
  ];

  // 快速创建行插入 dataSource 头部
  const quickRow = { _key: QUICK_ROW_KEY, name: '', description: '', tech_lead_name: '', test_lead_name: '', created_by_name: '', created_at: '' };
  const tableData = quickCreate ? [quickRow, ...projects] : projects;

  const QuickTriggerRow = () => (
    <tr>
      <td colSpan={isAdmin ? 7 : 6} style={{ padding: 0, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ padding: '6px 16px', background: '#fff' }}>
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

  const tableComponents = isAdmin && !quickCreate ? {
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
    <div>
      <style>{`
        .proj-table .ant-table-thead > tr > th {
          background: #f5f5f7 !important;
          color: #1d1d1f !important;
          font-weight: 600;
          border-bottom: 1px solid rgba(0,0,0,0.1);
          font-family: 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .proj-table .ant-table-tbody > tr > td {
          font-family: 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: rgba(0,0,0,0.8);
        }
        .proj-table .ant-table-tbody > tr:hover > td {
          background: #fafafc !important;
        }
      `}</style>
      <Table className="proj-table" columns={columns} dataSource={tableData} rowKey={(r: any) => r._key || r.id} loading={loading} size="small" components={tableComponents} />
    </div>
  );
};

// ---- 主页面 ----
const ProjectsPage = () => {
  return (
    <div style={{
      padding: '24px',
      background: '#f5f5f7',
      minHeight: '100vh',
      fontFamily: "'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      <Tabs
        defaultActiveKey="projects"
        items={[
          {
            key: 'projects',
            label: '项目列表',
            children: <ProjectsTab />,
          },
          {
            key: 'modules',
            label: <span><ApartmentOutlined style={{ marginRight: 4 }} />模块管理</span>,
            children: <ModulesTab />,
          },
        ]}
        style={{
          fontFamily: "'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      />
    </div>
  );
};

export default ProjectsPage;
