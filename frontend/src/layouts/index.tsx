import { useState, useEffect } from 'react';
import { Layout, Avatar, Dropdown, Button, Tooltip, message, Modal, Form, Input, DatePicker, Select } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  UserOutlined, LogoutOutlined, PlusOutlined,
  FileTextOutlined, CalendarOutlined, BugOutlined,
  AppstoreOutlined, ProjectOutlined, CheckCircleOutlined,
  TeamOutlined, ApiOutlined, EllipsisOutlined,
  HomeOutlined, RightOutlined, LeftOutlined, CheckSquareOutlined,
} from '@ant-design/icons';
import request from '@/services/request';
import { canAccess } from '@/config/permissions';

const { Header, Content } = Layout;
const { RangePicker } = DatePicker;

interface CurrentUser { id: number; username: string; role: string; }

const TOP_NAV_TABS = [
  { key: '/iterations', label: '迭代' },
  { key: '/requirements', label: '需求' },
  { key: '/bugs', label: '缺陷' },
];

const SIDER_COLLAPSED_KEY = 'sider_collapsed';
const SIDER_WIDTH = 180;
const SIDER_COLLAPSED_WIDTH = 60;

interface SiderItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

const BasicLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDER_COLLAPSED_KEY) === 'true';
  });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { navigate('/login'); return; }
    request.get('/auth/me/').then((res: any) => {
      setCurrentUser(res.data);
    }).catch(() => { navigate('/login'); });
  }, []);

  const handleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDER_COLLAPSED_KEY, String(next));
  };

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) await request.post('/auth/logout/', { refresh });
    } catch {}
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    message.success('已退出登录');
    navigate('/login');
  };

  const [iterModalVisible, setIterModalVisible] = useState(false);
  const [iterProjects, setIterProjects] = useState<any[]>([]);
  const [iterForm] = Form.useForm();

  const openIterModal = async () => {
    iterForm.resetFields();
    if (!iterProjects.length) {
      const res = await request.get('/projects/').catch(() => null);
      if (res) {
        const data = res.data.results || res.data;
        setIterProjects(Array.isArray(data) ? data : []);
      }
    }
    setIterModalVisible(true);
  };

  const handleIterSubmit = async (values: any) => {
    const { dateRange, ...rest } = values;
    try {
      await request.post('/iterations/', {
        ...rest,
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
      });
      message.success('迭代已创建');
      setIterModalVisible(false);
    } catch (e: any) {
      message.error(e.response?.data?.detail || '创建失败');
    }
  };

  const role = currentUser?.role || '';

  const createMenuItems = [
    {
      key: 'create-requirement',
      icon: <FileTextOutlined style={{ color: '#1677ff' }} />,
      label: '创建需求',
      onClick: () => window.open('/requirements/new?type=product', '_blank'),
    },
    {
      key: 'create-task',
      icon: <CheckSquareOutlined style={{ color: '#722ed1' }} />,
      label: '创建任务',
      onClick: () => window.open('/requirements/new?type=task', '_blank'),
    },
    {
      key: 'create-bug',
      icon: <BugOutlined style={{ color: '#f5222d' }} />,
      label: '创建缺陷',
      onClick: () => window.open('/bugs/new', '_blank'),
    },
    {
      key: 'create-iteration',
      icon: <CalendarOutlined style={{ color: '#52c41a' }} />,
      label: '创建迭代',
      onClick: openIterModal,
    },
  ];

  const moreMenuItems = [
    ...(canAccess('projectManagement', role) ? [{
      key: '/projects', icon: <ProjectOutlined />, label: '项目管理',
      onClick: () => navigate('/projects'),
    }] : []),
    ...(canAccess('testManagement', role) ? [{
      key: '/test-cases', icon: <CheckCircleOutlined />, label: '测试管理',
      onClick: () => navigate('/test-cases'),
    }] : []),
    ...(canAccess('userManagement', role) ? [{
      key: '/users', icon: <TeamOutlined />, label: '人员管理',
      onClick: () => navigate('/users'),
    }] : []),
    ...(canAccess('integration', role) ? [{
      key: '/integrations', icon: <ApiOutlined />, label: '集成中心',
      onClick: () => navigate('/integrations'),
    }] : []),
  ];

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
  ];

  const activeTab = TOP_NAV_TABS.find(t => location.pathname.startsWith(t.key))?.key || '';

  const topItems: SiderItem[] = [
    { key: '/home', icon: <HomeOutlined />, label: '主页' },
    { key: '/dashboard', icon: <AppstoreOutlined />, label: '仪表盘' },
  ];

  const bottomItems: SiderItem[] = [
    ...(canAccess('projectManagement', role) ? [{ key: '/projects', icon: <ProjectOutlined />, label: '项目管理' }] : []),
    ...(canAccess('testManagement', role) ? [{ key: '/test-cases', icon: <CheckCircleOutlined />, label: '测试管理' }] : []),
    ...(canAccess('userManagement', role) ? [{ key: '/users', icon: <TeamOutlined />, label: '人员管理' }] : []),
    ...(canAccess('integration', role) ? [{ key: '/integrations', icon: <ApiOutlined />, label: '集成中心' }] : []),
  ];

  const siderWidth = collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH;

  const iconStyle = (key: string): React.CSSProperties => {
    const isActive = location.pathname === key;
    return {
      display: 'flex',
      flexDirection: 'row' as const,
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'flex-start',
      gap: 10,
      padding: collapsed ? '12px 0' : '10px 16px',
      cursor: 'pointer',
      borderRadius: '8px',
      margin: '2px 12px',
      color: isActive ? '#0071e3' : 'rgba(255, 255, 255, 0.8)',
      background: isActive ? 'rgba(0, 113, 227, 0.2)' : 'transparent',
      fontSize: 20,
      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
      transition: 'all 0.2s ease',
    };
  };

  const renderItem = (item: SiderItem) => (
    <Tooltip key={item.key} title={collapsed ? item.label : ''} placement="right">
      <div
        style={iconStyle(item.key)}
        onClick={() => navigate(item.key)}
        onMouseEnter={e => {
          if (location.pathname !== item.key) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
            (e.currentTarget as HTMLElement).style.color = '#ffffff';
          }
        }}
        onMouseLeave={e => {
          if (location.pathname !== item.key) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 0.8)';
          }
        }}
      >
        {item.icon}
        {!collapsed && (
          <span style={{ fontSize: '14px', lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 400 }}>{item.label}</span>
        )}
      </div>
    </Tooltip>
  );

  const collapseBtn = (
    <div
      onClick={handleCollapse}
      style={{
        position: 'absolute',
        right: -12,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: '#2a2a2d',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 20,
        boxShadow: 'rgba(0, 0, 0, 0.3) 0px 2px 8px 0px',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = '#3a3a3d';
        (e.currentTarget as HTMLElement).style.boxShadow = 'rgba(0, 0, 0, 0.4) 0px 2px 12px 0px';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = '#2a2a2d';
        (e.currentTarget as HTMLElement).style.boxShadow = 'rgba(0, 0, 0, 0.3) 0px 2px 8px 0px';
      }}
    >
      {collapsed ? <RightOutlined style={{ fontSize: 10, color: '#ffffff' }} /> : <LeftOutlined style={{ fontSize: 10, color: '#ffffff' }} />}
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh', flexDirection: 'row' }}>
      {/* Apple 风格侧边栏 */}
      <div style={{
        width: siderWidth,
        height: '100vh',
        background: '#1d1d1f',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.2s ease',
        overflow: 'visible',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        {/* Logo 区域 */}
        <div style={{
          height: 56,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 20px',
          fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
          fontSize: '17px',
          fontWeight: 600,
          color: '#ffffff',
        }}>
          {!collapsed && 'AI-M'}
        </div>

        {/* 上方菜单：主页 / 仪表盘 */}
        <div style={{ paddingTop: 12 }}>
          {topItems.map(renderItem)}
        </div>

        {/* 折叠按钮 */}
        <div style={{ paddingTop: 8, position: 'relative' }}>
          {collapseBtn}
        </div>

        {/* 中间弹性空白 */}
        <div style={{ flex: 1 }} />

        {/* 下方菜单：项目管理 / 测试管理 / 人员管理 / 集成中心 */}
        <div style={{ paddingBottom: 12 }}>
          {bottomItems.map(renderItem)}
        </div>

      </div>

      <Layout style={{ flex: 1, minWidth: 0, marginLeft: siderWidth, transition: 'margin-left 0.2s ease' }}>
        {/* Apple 风格顶部导航条 */}
        <Header style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          padding: '0 24px',
          height: 56,
          lineHeight: '56px',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
        }}>
          {/* 主导航 Tab */}
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, height: '100%', gap: '8px' }}>
            {TOP_NAV_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <div
                  key={tab.key}
                  onClick={() => navigate(tab.key)}
                  style={{
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: isActive ? '#0071e3' : 'rgba(0, 0, 0, 0.8)',
                    background: isActive ? 'rgba(0, 113, 227, 0.08)' : 'transparent',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(0, 0, 0, 0.04)';
                      (e.currentTarget as HTMLElement).style.color = '#1d1d1f';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'rgba(0, 0, 0, 0.8)';
                    }
                  }}
                >
                  {tab.label}
                </div>
              );
            })}

            {/* 快速创建按钮 */}
            <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomLeft">
              <Button
                type="text"
                icon={<PlusOutlined />}
                style={{
                  width: 36,
                  height: 36,
                  padding: 0,
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  color: 'rgba(0, 0, 0, 0.8)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                }}
              />
            </Dropdown>
          </div>

          {/* 右侧操作区 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>

            {moreMenuItems.length > 0 && (
              <Dropdown menu={{ items: moreMenuItems }} placement="bottomRight">
                <Button
                  type="text"
                  icon={<EllipsisOutlined style={{ fontSize: 18 }} />}
                  style={{
                    width: 36,
                    height: 36,
                    padding: 0,
                    border: 'none',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    color: 'rgba(0, 0, 0, 0.8)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                />
              </Dropdown>
            )}

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px 4px 4px',
                borderRadius: '8px',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              >
                <Avatar size={28} icon={<UserOutlined />} style={{ background: '#0071e3' }} />
                <span style={{
                  fontSize: '14px',
                  fontWeight: 400,
                  color: '#1d1d1f',
                  fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                }}>{currentUser?.username || ''}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{
          margin: 0,
          padding: 0,
          background: '#f5f5f7',
          minHeight: 'calc(100vh - 56px)',
        }}>
          {children}
        </Content>
      </Layout>

      {/* 创建迭代弹窗 */}
      <Modal
        title="创建迭代"
        open={iterModalVisible}
        onCancel={() => setIterModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={iterForm} onFinish={handleIterSubmit} layout="vertical">
          <Form.Item name="name" label="迭代名称" rules={[{ required: true, message: '请输入迭代名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="project" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select placeholder="选择项目">
              {iterProjects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="迭代周期" rules={[{ required: true, message: '请选择日期范围' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="planning">
            <Select>
              <Select.Option value="planning">规划中</Select.Option>
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setIterModalVisible(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default BasicLayout;
