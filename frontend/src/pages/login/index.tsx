import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import request from '@/services/request';

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [qwLoading, setQwLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login/', {
        username: values.username,
        password: values.password,
      });
      const { access, refresh } = response.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.detail || '用户名或密码错误';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQwLogin = async () => {
    setQwLoading(true);
    try {
      const response = await request.get('/auth/qw/auth/');
      window.location.href = response.data.auth_url;
    } catch (error) {
      message.error('获取企微登录链接失败');
    } finally {
      setQwLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#000000',
        fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: '340px', padding: '0 20px' }}>
        {/* Title */}
        <h1
          style={{
            fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            fontSize: '40px',
            fontWeight: 600,
            lineHeight: 1.1,
            color: '#ffffff',
            textAlign: 'center',
            marginBottom: '12px',
            letterSpacing: 'normal',
          }}
        >
          AI-M平台
        </h1>

        {/* Login Form */}
        <Form name="login" onFinish={onFinish} layout="vertical" style={{ marginTop: '40px' }}>
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
            style={{ marginBottom: '16px' }}
          >
            <Input
              placeholder="用户名"
              style={{
                height: '48px',
                fontSize: '17px',
                background: '#272729',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#ffffff',
                padding: '0 16px',
              }}
              styles={{
                input: {
                  background: 'transparent',
                  color: '#ffffff',
                }
              }}
              classNames={{
                input: 'login-input-placeholder'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
            style={{ marginBottom: '24px' }}
          >
            <Input.Password
              placeholder="密码"
              style={{
                height: '48px',
                fontSize: '17px',
                background: '#272729',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#ffffff',
                padding: '0 16px',
              }}
              styles={{
                input: {
                  background: 'transparent',
                  color: '#ffffff',
                }
              }}
              classNames={{
                input: 'login-input-placeholder'
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: '16px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                width: '100%',
                height: '48px',
                fontSize: '17px',
                fontWeight: 400,
                background: '#0071e3',
                border: 'none',
                borderRadius: '980px',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#0077ed';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#0071e3';
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '24px 0',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <span
            style={{
              padding: '0 16px',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.48)',
            }}
          >
            或
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* WeChat Login */}
        <Button
          onClick={handleQwLogin}
          loading={qwLoading}
          style={{
            width: '100%',
            height: '48px',
            fontSize: '17px',
            fontWeight: 400,
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '980px',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          企微扫码登录
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;
