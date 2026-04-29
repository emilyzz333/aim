import { useState, useEffect } from 'react';
import { Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import request from '@/services/request';

const HomePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ requirements: 0, iterations: 0, bugs: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [reqRes, iterRes, bugRes] = await Promise.allSettled([
          request.get('/requirements/'),
          request.get('/iterations/', { params: { status: 'active' } }),
          request.get('/bugs/'),
        ]);

        const reqData = reqRes.status === 'fulfilled' ? (reqRes.value.data.results || reqRes.value.data) : [];
        const iterData = iterRes.status === 'fulfilled' ? (iterRes.value.data.results || iterRes.value.data) : [];
        const bugData = bugRes.status === 'fulfilled' ? (bugRes.value.data.results || bugRes.value.data) : [];

        const unfinishedReqs = Array.isArray(reqData)
          ? reqData.filter((r: any) => !['completed', 'closed'].includes(r.status)).length
          : (reqRes.status === 'fulfilled' ? reqRes.value.data.count || 0 : 0);

        const activeIters = Array.isArray(iterData) ? iterData.length : 0;

        const openBugs = Array.isArray(bugData)
          ? bugData.filter((b: any) => !['closed', 'resolved'].includes(b.status)).length
          : (bugRes.status === 'fulfilled' ? bugRes.value.data.count || 0 : 0);

        setStats({ requirements: unfinishedReqs, iterations: activeIters, bugs: openBugs });
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    {
      title: '需求',
      value: stats.requirements,
      suffix: '条',
      description: '未完成需求',
      path: '/requirements',
    },
    {
      title: '迭代',
      value: stats.iterations,
      suffix: '个',
      description: '进行中迭代',
      path: '/iterations',
    },
    {
      title: '缺陷',
      value: stats.bugs,
      suffix: '条',
      description: '未修复缺陷',
      path: '/bugs',
    },
  ];

  return (
    <div
      style={{
        fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
        background: '#f5f5f7',
        minHeight: 'calc(100vh - 64px)',
        padding: '60px 20px',
      }}
    >
      {/* Hero Section */}
      <div style={{ maxWidth: '980px', margin: '0 auto', textAlign: 'center', marginBottom: '80px' }}>
        <h1
          style={{
            fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            fontSize: '56px',
            fontWeight: 600,
            lineHeight: 1.07,
            letterSpacing: '-0.28px',
            color: '#1d1d1f',
            marginBottom: '12px',
          }}
        >
          AI-M平台
        </h1>
        <p
          style={{
            fontSize: '21px',
            fontWeight: 400,
            lineHeight: 1.19,
            letterSpacing: '0.231px',
            color: 'rgba(0, 0, 0, 0.8)',
            marginBottom: '0',
          }}
        >
          快速进入核心工作区
        </p>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <div
          style={{
            maxWidth: '980px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {cards.map((card) => (
            <div
              key={card.path}
              onClick={() => navigate(card.path)}
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '40px 32px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 12px 0px',
                textAlign: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = 'rgba(0, 0, 0, 0.12) 0px 4px 20px 0px';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'rgba(0, 0, 0, 0.08) 0px 2px 12px 0px';
              }}
            >
              <div
                style={{
                  fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                  fontSize: '28px',
                  fontWeight: 400,
                  lineHeight: 1.14,
                  letterSpacing: '0.196px',
                  color: '#1d1d1f',
                  marginBottom: '16px',
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                  fontSize: '56px',
                  fontWeight: 600,
                  lineHeight: 1.07,
                  letterSpacing: '-0.28px',
                  color: '#0071e3',
                  marginBottom: '8px',
                }}
              >
                {card.value}
                <span
                  style={{
                    fontSize: '21px',
                    fontWeight: 400,
                    marginLeft: '4px',
                    color: 'rgba(0, 0, 0, 0.8)',
                  }}
                >
                  {card.suffix}
                </span>
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 400,
                  lineHeight: 1.29,
                  letterSpacing: '-0.224px',
                  color: 'rgba(0, 0, 0, 0.48)',
                }}
              >
                {card.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;
