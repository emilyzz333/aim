import { useState, useRef, useEffect, useCallback } from 'react';
import { Drawer, Button, Input, Spin, Upload, Image, message } from 'antd';
import { SendOutlined, PaperClipOutlined, CloseOutlined } from '@ant-design/icons';
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

interface AiConversationDrawerProps {
  open: boolean;
  onClose: () => void;
  requirementId: number;
  understandType: string;
  onSaved?: () => void;
}

const genId = () => Math.random().toString(36).slice(2);

export default function AiConversationDrawer({ open, onClose, requirementId, understandType, onSaved }: AiConversationDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftImages, setDraftImages] = useState<MessageImage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInputVal('');
      setDraftImages([]);
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

  const removeDraftImage = (id: string) => {
    setDraftImages(prev => prev.filter(img => img.id !== id));
  };

  const sendMessage = async () => {
    if (!inputVal.trim() && draftImages.length === 0) return;

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: inputVal.trim(),
      images: [...draftImages],
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setDraftImages([]);
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('message', userMsg.content || '');
      fd.append('requirement_id', String(requirementId));
      fd.append('inject_context', 'true');
      userMsg.images?.forEach(img => fd.append('images', img.file));

      const res = await request.post('/integrations/ai/chat/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      const assistantMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: res.data.reply || res.data.message || '(no reply)',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || err?.message || 'AI 请求失败');
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

  const handleSave = async () => {
    if (messages.length === 0) {
      message.warning('暂无对话内容');
      return;
    }
    setSaving(true);
    try {
      // Build conversation_history: user messages with [图片N] placeholders
      // and text_content: AI replies only
      let imageCounter = 1;
      const userLines: string[] = [];

      for (const m of messages) {
        if (m.role !== 'user') continue;
        let line = m.content || '';
        if (m.images && m.images.length > 0) {
          const placeholders = m.images.map(() => `[图片${imageCounter++}]`).join(' ');
          line = line ? `${line}\n${placeholders}` : placeholders;
        }
        userLines.push(line);
      }
      const conversationHistory = userLines.join('\n\n');

      const textContent = messages
        .filter(m => m.role === 'assistant')
        .map(m => m.content)
        .join('\n\n');

      const fd = new FormData();
      fd.append('understand_type', understandType);
      fd.append('text_content', textContent);
      fd.append('conversation_history', conversationHistory);

      // Append all user images in order
      messages
        .filter(m => m.role === 'user')
        .flatMap(m => m.images || [])
        .forEach(img => fd.append('images', img.file));

      await request.post(`/requirements/${requirementId}/save-conversation/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      message.success('对话已保存，AI理解生成中...');
      onSaved?.();
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const UNDERSTAND_LABELS: Record<string, string> = {
    req_md: '需求解析',
    tech_md: '技术方案',
    ui_design: 'UI设计稿',
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1200}
      title={`AI对话 - ${UNDERSTAND_LABELS[understandType] || understandType}`}
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#ffffff',
        }
      }}
      extra={
        <Button type="primary" size="small" loading={saving} onClick={handleSave} disabled={messages.length === 0}>
          确认保存
        </Button>
      }
    >
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 24,
        background: '#f5f5f7',
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'rgba(0, 0, 0, 0.48)',
            padding: 60,
            fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
          }}>
            <div style={{
              fontSize: 17,
              marginBottom: 8,
              fontWeight: 600,
              color: '#1d1d1f',
            }}>开始 AI 对话</div>
            <div style={{ fontSize: 14 }}>输入文字或 Ctrl+V 粘贴截图，返回对应AI解析，确认保存后存储</div>
          </div>
        )}
        {messages.map(msg => (
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
        ))}
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

      <div style={{
        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
        padding: '16px 24px',
        flexShrink: 0,
        background: '#ffffff',
      }}>
        <div style={{ position: 'relative' }}>
          <Input.TextArea
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息 / Ctrl+V 粘贴截图..."
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{
              resize: 'none',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 12,
              fontSize: 14,
              paddingRight: 80,
              fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
            }}
          />
          <div style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            display: 'flex',
            gap: 6,
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
                style={{ color: 'rgba(0, 0, 0, 0.48)' }}
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
}
