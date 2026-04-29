import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, Space,
  Switch, message, Tabs, Card, Statistic, Row, Col, List, Avatar, DatePicker,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserAddOutlined } from '@ant-design/icons';
import request from '@/services/request';

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  product_manager: { label: '产品经理', color: 'blue' },
  developer: { label: '开发人员', color: 'cyan' },
  tester: { label: '测试人员', color: 'green' },
  project_manager: { label: '项目经理', color: 'purple' },
  product_tl: { label: '产品TL', color: 'geekblue' },
  developer_tl: { label: '开发TL', color: 'teal' },
  tester_tl: { label: '测试TL', color: 'lime' },
  admin: { label: '管理员', color: 'orange' },
  super_admin: { label: '超级管理员', color: 'red' },
};

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 用户弹窗
  const [userModal, setUserModal] = useState({ visible: false, editing: null as any });
  const [userForm] = Form.useForm();

  // 团队弹窗
  const [teamModal, setTeamModal] = useState({ visible: false, editing: null as any });
  const [memberModal, setMemberModal] = useState({ visible: false, team: null as any });
  const [teamForm] = Form.useForm();
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchTeams();
    fetchWorkload();
    request.get('/auth/me/').then((res: any) => setIsAdmin(res.data.is_admin_or_above)).catch(() => {});
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await request.get('/users/');
      const data = res.data.results || res.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch { message.error('获取用户列表失败'); }
    finally { setLoading(false); }
  };

  const fetchTeams = async () => {
    try {
      const res = await request.get('/users/teams/');
      const data = res.data.results || res.data;
      setTeams(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchWorkload = async () => {
    try {
      const res = await request.get('/users/workload/');
      setWorkload(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  // 用户操作
  const handleUserSubmit = async (values: any) => {
    try {
      if (userModal.editing) {
        await request.put(`/users/${userModal.editing.id}/`, values);
        message.success('用户已更新');
      } else {
        await request.post('/users/', values);
        message.success('用户已创建');
      }
      setUserModal({ visible: false, editing: null });
      fetchUsers();
    } catch (e: any) { message.error(e.response?.data?.detail || '操作失败'); }
  };

  const handleUserDelete = async (id: number) => {
    try {
      await request.delete(`/users/${id}/`);
      message.success('用户已删除');
      fetchUsers();
    } catch { message.error('删除失败'); }
  };

  // 团队操作
  const handleTeamSubmit = async (values: any) => {
    try {
      if (teamModal.editing) {
        await request.put(`/users/teams/${teamModal.editing.id}/`, values);
      } else {
        await request.post('/users/teams/', values);
        message.success('团队已创建');
      }
      setTeamModal({ visible: false, editing: null });
      fetchTeams();
    } catch (e: any) { message.error(e.response?.data?.detail || '操作失败'); }
  };

  const handleAddMember = async () => {
    if (!selectedMemberId || !memberModal.team) return;
    try {
      await request.post(`/users/teams/${memberModal.team.id}/add-member/`, { user_id: selectedMemberId });
      message.success('成员已添加');
      fetchTeams();
    } catch (e: any) { message.error(e.response?.data?.detail || '操作失败'); }
  };

  const handleRemoveMember = async (teamId: number, userId: number) => {
    try {
      await request.post(`/users/teams/${teamId}/remove-member/`, { user_id: userId });
      message.success('成员已移出');
      fetchTeams();
    } catch {}
  };

  const userColumns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '角色', dataIndex: 'role', key: 'role',
      render: (role: string) => {
        const m = ROLE_MAP[role] || { label: role, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '企微部门', dataIndex: 'qw_department', key: 'qw_department' },
    {
      title: '状态', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
    },
    ...(isAdmin ? [{
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />}
            onClick={() => {
              userForm.setFieldsValue({ ...r, password: undefined });
              setUserModal({ visible: true, editing: r });
            }} />
          <Popconfirm title="确认删除？" onConfirm={() => handleUserDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  const teamColumns = [
    { title: '团队名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '成员数', dataIndex: 'member_count', key: 'member_count', width: 80 },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" icon={<UserAddOutlined />}
            onClick={() => setMemberModal({ visible: true, team: r })} title="成员管理" />
          <Popconfirm title="确认删除？" onConfirm={async () => {
            await request.delete(`/users/teams/${r.id}/`);
            fetchTeams();
          }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const workloadColumns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '角色', dataIndex: 'role', key: 'role', render: (r: string) => ROLE_MAP[r]?.label || r },
    { title: '负责需求数', dataIndex: 'requirement_count', key: 'requirement_count' },
    { title: '负责缺陷数', dataIndex: 'bug_count', key: 'bug_count' },
  ];

  const tabItems = [
    {
      key: 'users',
      label: '用户列表',
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            {isAdmin && (
              <Button type="primary" icon={<PlusOutlined />}
                onClick={() => { userForm.resetFields(); setUserModal({ visible: true, editing: null }); }}>
                新建用户
              </Button>
            )}
          </div>
          <Table columns={userColumns} dataSource={users} rowKey="id" loading={loading} />
        </div>
      ),
    },
    {
      key: 'teams',
      label: '团队管理',
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => { teamForm.resetFields(); setTeamModal({ visible: true, editing: null }); }}>
              新建团队
            </Button>
          </div>
          <Table columns={teamColumns} dataSource={teams} rowKey="id" />
        </div>
      ),
    },
    {
      key: 'workload',
      label: '工作量统计',
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <DatePicker.RangePicker
              onChange={(dates) => {
                if (dates) {
                  request.get('/users/workload/', {
                    params: {
                      start_date: dates[0]?.format('YYYY-MM-DD'),
                      end_date: dates[1]?.format('YYYY-MM-DD'),
                    },
                  }).then((res: any) => setWorkload(Array.isArray(res.data) ? res.data : []));
                } else {
                  fetchWorkload();
                }
              }}
            />
          </div>
          <Table columns={workloadColumns} dataSource={workload} rowKey="id" />
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
      <h2 style={{ marginBottom: 16 }}>人员与团队管理</h2>
      <Tabs items={tabItems} />

      {/* 用户弹窗 */}
      <Modal
        title={userModal.editing ? '编辑用户' : '新建用户'}
        open={userModal.visible}
        onCancel={() => setUserModal({ visible: false, editing: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={userForm} onFinish={handleUserSubmit} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input disabled={!!userModal.editing} />
          </Form.Item>
          {!userModal.editing && (
            <Form.Item name="password" label="密码" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="email" label="邮箱">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="developer" rules={[{ required: true }]}>
            <Select>
              {Object.entries(ROLE_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setUserModal({ visible: false, editing: null })} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 团队弹窗 */}
      <Modal
        title="新建团队"
        open={teamModal.visible}
        onCancel={() => setTeamModal({ visible: false, editing: null })}
        footer={null}
        destroyOnClose
      >
        <Form form={teamForm} onFinish={handleTeamSubmit} layout="vertical">
          <Form.Item name="name" label="团队名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setTeamModal({ visible: false, editing: null })} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理弹窗 */}
      <Modal
        title={`成员管理 - ${memberModal.team?.name}`}
        open={memberModal.visible}
        onCancel={() => setMemberModal({ visible: false, team: null })}
        footer={null}
        width={500}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Select style={{ flex: 1 }} placeholder="选择要添加的成员" onChange={(v) => setSelectedMemberId(v)}>
            {users.map((u) => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
          </Select>
          <Button type="primary" onClick={handleAddMember}>添加</Button>
        </div>
        <List
          dataSource={memberModal.team?.members || []}
          renderItem={(userId: number) => {
            const user = users.find((u) => u.id === userId);
            return (
              <List.Item
                actions={[
                  <Button size="small" danger
                    onClick={() => handleRemoveMember(memberModal.team?.id, userId)}>
                    移出
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar>{user?.username?.[0]}</Avatar>}
                  title={user?.username || `用户 ${userId}`}
                  description={ROLE_MAP[user?.role]?.label}
                />
              </List.Item>
            );
          }}
        />
      </Modal>
    </div>
  );
};

export default UsersPage;
