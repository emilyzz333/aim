import { useState, useEffect } from 'react';
import {
  Card, Statistic, Row, Col, List, Tag, Progress,
} from 'antd';
import {
  ProjectOutlined, CalendarOutlined, FileTextOutlined, BugOutlined,
} from '@ant-design/icons';
import request from '@/services/request';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_review: { label: '待评审', color: 'blue' },
  pending_tech_review: { label: '待技评', color: 'purple' },
  pending_development: { label: '待开发', color: 'orange' },
  in_development: { label: '开发中', color: 'cyan' },
  pending_test: { label: '待测试', color: 'green' },
  in_test: { label: '测试中', color: 'lime' },
  pending_acceptance: { label: '待验收', color: 'gold' },
  pending_release: { label: '待上线', color: 'magenta' },
  pending_regression: { label: '待回归', color: 'volcano' },
  completed: { label: '已完成', color: 'success' },
  closed: { label: '已关闭', color: 'default' },
};

const DashboardPage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request.get('/dashboard/')
      .then((res: any) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const summary = data?.summary || {};
  const iterations = data?.active_iterations || [];
  const reqDist = data?.requirement_status_distribution || [];
  const projectOverview = data?.project_overview || [];

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      background: '#f5f5f7',
      minHeight: 'calc(100vh - 64px)'
    }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: '40px',
          fontWeight: 600,
          lineHeight: 1.1,
          color: '#1d1d1f',
          margin: 0
        }}>仪表盘</h1>
      </div>

      {/* 概览数字 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            loading={loading}
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            <Statistic
              title={<span style={{ fontSize: '14px', color: 'rgba(0,0,0,0.48)' }}>总项目数</span>}
              value={summary.total_projects ?? '-'}
              prefix={<ProjectOutlined style={{ color: '#0071e3' }} />}
              valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#1d1d1f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            loading={loading}
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            <Statistic
              title={<span style={{ fontSize: '14px', color: 'rgba(0,0,0,0.48)' }}>进行中迭代</span>}
              value={summary.active_iterations ?? '-'}
              prefix={<CalendarOutlined style={{ color: '#0071e3' }} />}
              valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            loading={loading}
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            <Statistic
              title={<span style={{ fontSize: '14px', color: 'rgba(0,0,0,0.48)' }}>需求总数</span>}
              value={summary.total_requirements ?? '-'}
              prefix={<FileTextOutlined style={{ color: '#0071e3' }} />}
              valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#1d1d1f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            loading={loading}
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            <Statistic
              title={<span style={{ fontSize: '14px', color: 'rgba(0,0,0,0.48)' }}>待处理缺陷</span>}
              value={summary.open_bugs ?? '-'}
              prefix={<BugOutlined style={{ color: '#0071e3' }} />}
              valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 需求状态分布 */}
        <Col xs={24} lg={12}>
          <Card
            title={<span style={{ fontSize: '21px', fontWeight: 600, color: '#1d1d1f' }}>需求状态分布</span>}
            loading={loading}
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              minHeight: '320px'
            }}
          >
            {reqDist.map((item: any) => {
              const info = STATUS_LABELS[item.status] || { label: item.status, color: 'default' };
              return (
                <div key={item.status} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  padding: '8px 0'
                }}>
                  <Tag color={info.color} style={{ fontSize: '14px', padding: '4px 12px' }}>{info.label}</Tag>
                  <strong style={{ fontSize: '17px', color: '#1d1d1f' }}>{item.count}</strong>
                </div>
              );
            })}
            {reqDist.length === 0 && !loading && (
              <div style={{
                color: 'rgba(0,0,0,0.48)',
                textAlign: 'center',
                padding: '40px 0',
                fontSize: '14px'
              }}>暂无数据</div>
            )}
          </Card>
        </Col>

        {/* 进行中迭代进度 */}
        <Col xs={24} lg={12}>
          <Card
            title={<span style={{ fontSize: '21px', fontWeight: 600, color: '#1d1d1f' }}>进行中迭代进度</span>}
            loading={loading}
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              minHeight: '320px'
            }}
          >
            {iterations.length === 0 && !loading && (
              <div style={{
                color: 'rgba(0,0,0,0.48)',
                textAlign: 'center',
                padding: '40px 0',
                fontSize: '14px'
              }}>暂无进行中迭代</div>
            )}
            {iterations.map((it: any) => (
              <div key={it.id} style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}>
                  <span style={{ fontSize: '15px' }}>
                    <strong style={{ color: '#1d1d1f' }}>{it.name}</strong>
                    <span style={{ color: 'rgba(0,0,0,0.48)', marginLeft: 8 }}>({it.project_name})</span>
                  </span>
                  <span style={{ color: 'rgba(0,0,0,0.48)', fontSize: '14px' }}>{it.completed}/{it.total}</span>
                </div>
                <Progress
                  percent={it.rate}
                  size="small"
                  status={it.rate === 100 ? 'success' : 'active'}
                  strokeColor="#0071e3"
                />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* 项目概览 */}
      <Card
        title={<span style={{ fontSize: '21px', fontWeight: 600, color: '#1d1d1f' }}>项目概览</span>}
        loading={loading}
        bordered={false}
        style={{
          marginTop: 16,
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        <List
          dataSource={projectOverview}
          renderItem={(p: any) => (
            <List.Item style={{ padding: '16px 0' }}>
              <List.Item.Meta
                title={
                  <a
                    href={`/iterations?project_id=${p.id}`}
                    style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      color: '#0071e3'
                    }}
                  >
                    {p.name}
                  </a>
                }
                description={
                  <span style={{ fontSize: '14px', color: 'rgba(0,0,0,0.48)' }}>
                    需求数: {p.total_reqs} | 待处理缺陷: {p.open_bugs}
                  </span>
                }
              />
              <Tag
                color={p.status === 'active' ? 'green' : 'default'}
                style={{ fontSize: '14px', padding: '4px 12px' }}
              >
                {p.status === 'active' ? '进行中' : p.status === 'planning' ? '规划中' : p.status}
              </Tag>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default DashboardPage;
