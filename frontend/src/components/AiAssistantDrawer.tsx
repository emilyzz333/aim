import { useState, useRef, useEffect, useCallback } from 'react';
import { Drawer, Button, Input, Switch, Spin, Upload, Image, message } from 'antd';
import {
  SendOutlined, PlusOutlined, MenuOutlined, CloseOutlined, PaperClipOutlined, RobotOutlined,
} from '@ant-design/icons';
import request from '@/services/request';

interface MessageImage {
  id: string;
  file: File;
  preview: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: MessageImage[];
  time: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  contextData?: {
    requirementId?: number;
    requirementName?: string;
    description?: string;
  };
  title?: string;
}

const genId = () => Math.random().toString(36).slice(2);

const AiAssistantDrawer = ({ open, onClose, contextData, title = 'AI需求助手' }: AiAssistantDrawerProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [injectContext, setInjectContext] = useState(false);
  const [showList, setShowList] = useState(false);
  const [draftImages, setDraftImages] = useState<MessageImage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [activeConv?.messages]);

  const newConversation = () => {
    const id = genId();
    const conv: Conversation = { id, title: '新对话', messages: [] };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setShowList(false);
    setDraftImages([]);
  };

  useEffect(() => {
    if (open && conversations.length === 0) {
      newConversation();
    }
  }, [open]);

  const appendDraftImage = (file: File) => {
    const id = genId();
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDraftImages(prev => [...prev, { id, file, preview: ev.target?.result as string }]);
    };
    reader.readAsDataURL(file);
  };

  const removeDraftImage = (id: string) => {
    setDraftImages(prev => prev.filter(img => img.id !== id));
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) appendDraftImage(file);
      }
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [open, handlePaste]);

  const sendMessage = async () => {
    if (!inputVal.trim() && draftImages.length === 0) return;
    if (!activeId) { newConversation(); return; }

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: inputVal.trim(),
      images: [...draftImages],
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              title: c.messages.length === 0 ? (inputVal.trim().slice(0, 15) || '图片对话') : c.title,
              messages: [...c.messages, userMsg],
            }
          : c,
      ),
    );
    setInputVal('');
    setDraftImages([]);
    setLoading(true);

    try {
      let content = userMsg.content || '请结合我上传的截图进行分析。';
      if (injectContext && contextData) {
        const ctx: string[] = [];
        if (contextData.requirementName) ctx.push(`需求名称：${contextData.requirementName}`);
        if (contextData.description) ctx.push(`需求描述：${contextData.description}`);
        if (ctx.length > 0) content = `[上下文]\n${ctx.join('\n')}\n\n[问题]\n${content}`;
      }

      const res = await request.post('/integrations/ai/chat/', {
        message: content,
        requirement_id: contextData?.requirementId,
        inject_context: injectContext,
      });

      const assistantMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: res.data.reply || res.data.message || '暂无回复',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...c, messages: [...c.messages, assistantMsg] } : c,
        ),
      );
    } catch {
      message.error('AI 请求失败，请检查 AI 配置');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1200}
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#ffffff',
        }
      }}
      title={null}
      closable={false}
    >
      {/* 顶部栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        flexShrink: 0,
        background: '#ffffff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RobotOutlined style={{ fontSize: 20, color: '#0071e3' }} />
          <span style={{
            fontWeight: 600,
            fontSize: 21,
            color: '#1d1d1f',
            fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            letterSpacing: '0.231px',
          }}>{title}</span>
          <Button
            type="text"
            size="small"
            icon={<MenuOutlined />}
            onClick={() => setShowList((v) => !v)}
            style={{
              color: showList ? '#0071e3' : 'rgba(0, 0, 0, 0.48)',
              fontSize: 13,
              fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            }}
          >
            对话列表
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 14,
            color: 'rgba(0, 0, 0, 0.6)',
            fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
          }}>注入项目数据</span>
          <Switch size="small" checked={injectContext} onChange={setInjectContext} />
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={newConversation}
          >
            新建对话
          </Button>
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
        </div>
      </div>

      {/* 对话列表面板（可折叠） */}
      {showList && (
        <div style={{
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          background: '#f5f5f7',
          maxHeight: 240,
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          {conversations.length === 0 ? (
            <div style={{
              padding: '24px',
              color: 'rgba(0, 0, 0, 0.48)',
              fontSize: 14,
              textAlign: 'center',
              fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            }}>暂无对话</div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => { setActiveId(c.id); setShowList(false); }}
                style={{
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontSize: 14,
                  background: c.id === activeId ? '#ffffff' : 'transparent',
                  borderLeft: c.id === activeId ? '3px solid #0071e3' : '3px solid transparent',
                  color: c.id === activeId ? '#1d1d1f' : 'rgba(0, 0, 0, 0.8)',
                  fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (c.id !== activeId) {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (c.id !== activeId) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {c.title}
              </div>
            ))
          )}
        </div>
      )}

      {/* 消息区 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        background: '#f5f5f7',
      }}>
        {(!activeConv || activeConv.messages.length === 0) ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
          }}>
            <RobotOutlined style={{ fontSize: 56, color: '#0071e3', marginBottom: 16, opacity: 0.6 }} />
            <div style={{
              fontSize: 21,
              fontWeight: 600,
              color: '#1d1d1f',
              marginBottom: 8,
              fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            }}>{title}</div>
            <div style={{
              fontSize: 14,
              color: 'rgba(0, 0, 0, 0.6)',
              textAlign: 'center',
              maxWidth: 320,
              lineHeight: 1.47,
              marginBottom: 12,
            }}>
              我可以帮助你生成测试用例、分析需求文档、提供需求建议等
            </div>
            <div style={{
              fontSize: 13,
              color: 'rgba(0, 0, 0, 0.48)',
            }}>
              支持 Ctrl+V 粘贴截图或点击添加图片
            </div>
          </div>
        ) : (
          activeConv.messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                marginBottom: 16,
                gap: 10,
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                flexShrink: 0,
                background: msg.role === 'user' ? '#0071e3' : '#34c759',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                color: '#ffffff',
                fontWeight: 600,
                fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
              }}>
                {msg.role === 'user' ? '我' : 'AI'}
              </div>
              <div style={{
                maxWidth: '75%',
                background: msg.role === 'user' ? '#0071e3' : '#ffffff',
                color: msg.role === 'user' ? '#ffffff' : '#1d1d1f',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '12px 16px',
                fontSize: 14,
                lineHeight: 1.47,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                boxShadow: msg.role === 'user' ? 'none' : 'rgba(0, 0, 0, 0.08) 0px 2px 8px 0px',
              }}>
                {msg.images && msg.images.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {msg.images.map((img) => (
                      <Image key={img.id} src={img.preview} width={100} height={100} style={{ objectFit: 'cover', borderRadius: 8 }} />
                    ))}
                  </div>
                )}
                {msg.content}
                <div style={{
                  fontSize: 11,
                  opacity: 0.6,
                  marginTop: 6,
                  textAlign: 'right',
                  fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                }}>{msg.time}</div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#34c759',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            }}>AI</div>
            <div style={{
              background: '#ffffff',
              borderRadius: '18px 18px 18px 4px',
              padding: '12px 16px',
              boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 8px 0px',
            }}>
              <Spin size="small" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 草稿图片预览 */}
      {draftImages.length > 0 && (
        <div style={{
          padding: '12px 24px',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          borderTop: '1px solid rgba(0, 0, 0, 0.06)',
          background: '#ffffff',
        }}>
          {draftImages.map((img) => (
            <div key={img.id} style={{ position: 'relative' }}>
              <img src={img.preview} alt="" style={{
                width: 80,
                height: 80,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid rgba(0, 0, 0, 0.1)',
              }} />
              <CloseOutlined
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  fontSize: 12,
                  background: '#ff3b30',
                  color: '#ffffff',
                  borderRadius: '50%',
                  padding: 4,
                  cursor: 'pointer',
                  boxShadow: 'rgba(0, 0, 0, 0.2) 0px 2px 4px 0px',
                }}
                onClick={() => removeDraftImage(img.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div style={{
        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
        padding: '16px 24px',
        flexShrink: 0,
        background: '#ffffff',
      }}>
        <div style={{ position: 'relative' }}>
          <Input.TextArea
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息 / Ctrl+V 粘贴截图..."
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{
              resize: 'none',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 12,
              fontSize: 14,
              fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
              paddingRight: 80,
            }}
          />
          <div style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            display: 'flex',
            gap: 4,
            alignItems: 'center',
          }}>
            <Upload
              accept="image/*"
              multiple
              showUploadList={false}
              beforeUpload={(file) => {
                appendDraftImage(file);
                return false;
              }}
            >
              <Button
                type="text"
                size="small"
                icon={<PaperClipOutlined />}
                style={{
                  color: 'rgba(0, 0, 0, 0.48)',
                }}
              />
            </Upload>
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={sendMessage}
              loading={loading}
              disabled={!inputVal.trim() && draftImages.length === 0}
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default AiAssistantDrawer;
