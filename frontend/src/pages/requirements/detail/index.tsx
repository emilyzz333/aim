import { useState, useEffect, useRef } from 'react';
import {
  Tabs, Tag, Button, Form, Input, Select,
  message, Spin, Modal, List, Avatar, Space, DatePicker, Popover, Checkbox,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  StopOutlined, WarningOutlined, SaveOutlined, RobotOutlined, EditOutlined,
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import dayjs from 'dayjs';
import DOMPurify from 'dompurify';
import request from '@/services/request';
import AiAssistantDrawer from '@/components/AiAssistantDrawer';
import AiConversationDrawer from '@/components/AiConversationDrawer';
import AiUnderstandingList from '@/components/AiUnderstandingList';
import MdSourceInput from '@/components/MdSourceInput';

const STATUS_OPTIONS = [
  { value: 'pending_review', label: '待评审', color: 'blue' },
  { value: 'pending_tech_review', label: '待技评', color: 'purple' },
  { value: 'pending_development', label: '待开发', color: 'orange' },
  { value: 'in_development', label: '开发中', color: 'cyan' },
  { value: 'resolved', label: '已修复', color: 'geekblue' },
  { value: 'pending_test', label: '待测试', color: 'green' },
  { value: 'in_testing', label: '测试中', color: 'lime' },
  { value: 'pending_acceptance', label: '待验收', color: 'gold' },
  { value: 'pending_release', label: '待上线', color: 'magenta' },
  { value: 'pending_regression', label: '待回归', color: 'volcano' },
  { value: 'completed', label: '已完成', color: 'success' },
  { value: 'rejected', label: '已拒绝', color: 'red' },
  { value: 'suspended', label: '挂起', color: 'default' },
  { value: 'closed', label: '已关闭', color: 'default' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '紧急', color: 'red' },
  { value: 'high', label: '高', color: 'orange' },
  { value: 'medium', label: '中', color: 'blue' },
  { value: 'low', label: '低', color: 'default' },
];

const getStatusInfo = (v: string) => STATUS_OPTIONS.find((s) => s.value === v) || { label: v, color: 'default' };
const getPriorityInfo = (v: string) => PRIORITY_OPTIONS.find((p) => p.value === v) || { label: v, color: 'default' };

const REQ_STATUS_MAP_DETAIL: Record<string, { label: string; color: string }> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, { label: s.label, color: s.color }])
);

interface RequirementDetailProps {
  requirementId: number;
  onClose?: () => void;
  defaultTab?: string;
  onNavigate?: (id: number) => void;
}

// 通用 inline 编辑字段
const InlineField = ({
  label, displayValue, onSave, editNode, disabled,
}: {
  label: string;
  displayValue: React.ReactNode;
  onSave?: (val: any) => Promise<void>;
  editNode?: (done: () => void) => React.ReactNode;
  disabled?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const done = () => setEditing(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: '12px',
        color: 'rgba(0,0,0,0.48)',
        marginBottom: 4,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>{label}</div>
      {editing && editNode ? (
        <div>{editNode(done)}</div>
      ) : (
        <div
          onClick={() => !disabled && setEditing(true)}
          style={{
            fontSize: '14px',
            color: disabled ? 'rgba(0,0,0,0.48)' : '#1d1d1f',
            cursor: disabled ? 'default' : 'pointer',
            padding: '4px 8px',
            marginLeft: -8,
            borderRadius: '6px',
            minHeight: 28,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {displayValue || <span style={{ color: 'rgba(0,0,0,0.24)' }}>点击编辑</span>}
        </div>
      )}
    </div>
  );
};

// 行内文本框
const InlineText = ({ value, onSave, done, placeholder }: {
  value: string; onSave: (v: string) => Promise<void>; done: () => void; placeholder?: string;
}) => {
  const [val, setVal] = useState(value);
  const commit = async () => {
    if (val !== value) await onSave(val);
    done();
  };
  return (
    <Input
      autoFocus
      size="small"
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onPressEnter={commit}
    />
  );
};

// 行内 Select
const InlineSelect = ({ value, options, onSave, done }: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
  done: () => void;
}) => {
  const [open, setOpen] = useState(true);
  const didSave = useRef(false);
  return (
    <Select
      autoFocus
      open={open}
      size="small"
      defaultValue={value}
      style={{ width: '100%' }}
      options={options}
      onChange={async (v) => {
        didSave.current = true;
        setOpen(false);
        await onSave(v);
        done();
      }}
      onDropdownVisibleChange={(visible) => {
        if (!visible && !didSave.current) done();
      }}
    />
  );
};

// 行内日期
const InlineDate = ({ value, onSave, done }: { value: string; onSave: (v: string) => Promise<void>; done: () => void }) => {
  return (
    <DatePicker
      autoFocus
      open
      size="small"
      defaultValue={value ? dayjs(value) : undefined}
      style={{ width: '100%' }}
      onChange={async (d) => {
        if (d) await onSave(d.format('YYYY-MM-DD'));
        done();
      }}
      onBlur={done}
    />
  );
};

const MdEditorTab = ({ requirementId, mdType, initialValue }: {
  requirementId: number; mdType: 'req' | 'tech'; initialValue: string;
}) => {
  const [content, setContent] = useState(initialValue || '');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await request.post(`/requirements/${requirementId}/upload-md/`, { type: mdType, content });
      message.success('文档已保存');
      setEditing(false);
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 无内容且非编辑态：不渲染
  if (!editing && !content) return null;

  // 预览态
  if (!editing) {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ textAlign: 'right', marginBottom: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => setEditing(true)}>编辑</Button>
        </div>
        <MDEditor.Markdown source={content} style={{ padding: 16, background: '#f9f9f9', borderRadius: 8, minHeight: 60 }} />
      </div>
    );
  }

  // 编辑态
  return (
    <div>
      <div style={{ marginBottom: 8, textAlign: 'right' }}>
        <Space>
          <Button size="small" onClick={() => { setContent(initialValue || ''); setEditing(false); }}>取消</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} size="small">保存</Button>
        </Space>
      </div>
      <MDEditor value={content} onChange={(v) => setContent(v || '')} height={480} data-color-mode="light" />
    </div>
  );
};

// 将文本中的 URL 渲染为可点击链接
const isHtmlContent = (text: string) => /<[a-z][\s\S]*>/i.test(text);

const sanitizeHtml = (html: string): string => {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'a', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead',
      'tbody', 'tr', 'td', 'th', 'img', 'pre', 'code', 'blockquote', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'width', 'height',
      'style', 'class', 'colspan', 'rowspan'],
  });
  return clean.replace(/<a\s/g, '<a target="_blank" rel="noopener noreferrer" ');
};

const renderTextWithLinks = (text: string) => {
  if (isHtmlContent(text)) {
    return (
      <div
        className="tapd-html-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
        style={{ lineHeight: 1.7 }}
      />
    );
  }
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{ color: '#1890ff', wordBreak: 'break-all' }}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
};

const RequirementDetail = ({ requirementId, onClose, defaultTab, onNavigate }: RequirementDetailProps) => {
  const [req, setReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [changelogs, setChangelogs] = useState<any[]>([]);
  const [subreqs, setSubreqs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [iterations, setIterations] = useState<any[]>([]);
  const [tagChoices, setTagChoices] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [subForm] = Form.useForm();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState('');
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCases, setAiCases] = useState<any[]>([]);
  const [aiSaving, setAiSaving] = useState(false);
  const [reqMdRefresh, setReqMdRefresh] = useState(0);
  const [techMdRefresh, setTechMdRefresh] = useState(0);
  const [uiDesignWebRefresh, setUiDesignWebRefresh] = useState(0);
  const [uiDesignAppRefresh, setUiDesignAppRefresh] = useState(0);
  // 父需求折叠展示
  const [parentReq, setParentReq] = useState<any>(null);
  const [parentCollapsed, setParentCollapsed] = useState(true);

  const fetchDetail = async () => {
    try {
      const res = await request.get(`/requirements/${requirementId}/`);
      setReq(res.data);
      setTitleVal(res.data.name);
      setDescVal(res.data.description || '');
      // 若是子需求，拉取父需求详情
      if (res.data.parent) {
        try {
          const parentRes = await request.get(`/requirements/${res.data.parent}/`);
          setParentReq(parentRes.data);
          // 子需求有详情内容时默认折叠父需求，无详情时默认展开
          setParentCollapsed(!!res.data.description);
        } catch {
          setParentReq(null);
        }
      } else {
        setParentReq(null);
      }
    } catch {
      message.error('获取需求详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchChangelogs = async () => {
    try {
      const res = await request.get(`/requirements/${requirementId}/changelog/`);
      setChangelogs(res.data.results || res.data);
    } catch {}
  };

  const fetchSubreqs = async () => {
    try {
      const res = await request.get(`/requirements/${requirementId}/sub-requirements/`);
      setSubreqs(res.data.results || res.data);
    } catch {}
  };

  useEffect(() => {
    fetchDetail();
    fetchChangelogs();
    fetchSubreqs();
    request.get('/users/').then((r: any) => {
      const d = r.data.results || r.data;
      setUsers(Array.isArray(d) ? d : []);
    }).catch(() => {});
    request.get('/iterations/').then((r: any) => {
      const d = r.data.results || r.data;
      setIterations(Array.isArray(d) ? d : []);
    }).catch(() => {});
    request.get('/requirements/tag-choices/').then((r: any) => {
      setTagChoices(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
  }, [requirementId]);

  const patch = async (fields: Record<string, any>) => {
    try {
      const res = await request.patch(`/requirements/${requirementId}/`, fields);
      setReq(res.data);
      setTitleVal(res.data.name);
      setDescVal(res.data.description || '');
      fetchChangelogs();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '保存失败');
      throw e;
    }
  };

  const handleBlock = async () => {
    try {
      await request.post(`/requirements/${requirementId}/block/`, {
        is_blocked: !req?.is_blocked,
        block_reason: blockReason,
      });
      message.success(req?.is_blocked ? '已解除阻塞' : '已标记阻塞');
      setBlockModalVisible(false);
      fetchDetail();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    }
  };

  const handleAddSubreq = async (values: any) => {
    try {
      await request.post(`/requirements/${requirementId}/sub-requirements/`, values);
      message.success('子需求已创建');
      subForm.resetFields();
      fetchSubreqs();
    } catch {
      message.error('创建失败');
    }
  };

  if (loading) return <Spin style={{ display: 'block', marginTop: 60 }} />;
  if (!req) return <div>需求不存在</div>;

  const statusInfo = getStatusInfo(req.status);
  const priorityInfo = getPriorityInfo(req.priority);

  const tabItems = [
    {
      key: 'info',
      label: '详细信息',
      children: (
        <div style={{ padding: '20px 0' }}>
          {/* 父需求详情（折叠） */}
          {parentReq && parentReq.description && (
            <div style={{
              marginBottom: 16,
              borderRadius: '10px',
              border: '1px solid rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}>
              <div
                onClick={() => setParentCollapsed(!parentCollapsed)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'rgba(0,113,227,0.04)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 12, color: '#0071e3', fontWeight: 500 }}>
                  ▲ 上级需求：{parentReq.name}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.32)' }}>
                  {parentCollapsed ? '展开查看' : '收起'}
                </span>
              </div>
              {!parentCollapsed && (
                <div style={{
                  padding: '12px 16px',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.7,
                  fontSize: '13px',
                  color: 'rgba(0,0,0,0.72)',
                  maxHeight: 300,
                  overflowY: 'auto',
                  background: 'rgba(0,113,227,0.02)',
                }}>
                  {renderTextWithLinks(parentReq.description)}
                </div>
              )}
            </div>
          )}
          {/* 可编辑描述 */}
          {editingDesc ? (
            <Input.TextArea
              autoFocus
              rows={20}
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              onBlur={async () => {
                setEditingDesc(false);
                if (descVal !== req.description) await patch({ description: descVal });
              }}
              style={{ marginBottom: 16, resize: 'vertical', borderRadius: '8px' }}
            />
          ) : (
            <div
              onClick={() => setEditingDesc(true)}
              style={{
                marginBottom: 24,
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: req.description ? '#1d1d1f' : 'rgba(0,0,0,0.24)',
                minHeight: 80,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                fontSize: '14px',
                background: 'rgba(0,0,0,0.02)',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.02)'; }}
            >
              {req.description ? renderTextWithLinks(req.description) : '点击添加描述...'}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
            <span style={{ color: 'rgba(0,0,0,0.48)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>标签</span>
            {req.tags?.map((t: string) => (
              <Tag
                key={t}
                closable
                onClose={async (e) => {
                  e.preventDefault();
                  await patch({ tags: req.tags.filter((x: string) => x !== t) });
                }}
                style={{ margin: 0, borderRadius: '6px' }}
              >
                {t}
              </Tag>
            ))}
            <Popover
              open={tagPopoverOpen}
              onOpenChange={setTagPopoverOpen}
              trigger="click"
              placement="bottomLeft"
              content={
                <div style={{ width: 180 }}>
                  <Checkbox.Group
                    value={req.tags || []}
                    onChange={async (vals) => {
                      await patch({ tags: vals });
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    {tagChoices.map((t) => (
                      <Checkbox key={t} value={t} style={{ marginLeft: 0, padding: '4px 8px', borderRadius: 4 }}>
                        {t}
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                </div>
              }
            >
              <Button
                type="text"
                icon={<PlusOutlined />}
                size="small"
                style={{ color: '#8c8c8c', padding: '0 4px' }}
              />
            </Popover>
          </div>

          {/* 备注 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: 'rgba(0,0,0,0.48)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>备注</div>
            <Input.TextArea
              key={req.remarks}
              rows={3}
              defaultValue={req.remarks || ''}
              placeholder="点击添加备注..."
              style={{ fontSize: '14px', resize: 'vertical', borderRadius: '8px' }}
              onBlur={async (e) => {
                if (e.target.value !== (req.remarks || '')) {
                  await patch({ remarks: e.target.value });
                }
              }}
            />
          </div>

          {req.status === 'in_development' && (
            <div style={{ marginTop: 8 }}>
              <Button
                icon={<StopOutlined />}
                danger={!req.is_blocked}
                onClick={() => {
                  if (req.is_blocked) handleBlock();
                  else setBlockModalVisible(true);
                }}
                style={{ borderRadius: '8px' }}
              >
                {req.is_blocked ? '解除阻塞' : '标记阻塞'}
              </Button>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'subreqs',
      label: '子需求',
      children: (
        <div style={{ padding: '20px 0' }}>
          {/* ── 父需求 ── */}
          {req.parent_name && (
            <div style={{
              padding: '12px 16px', marginBottom: 16,
              background: '#fff', borderRadius: '10px',
              boxShadow: 'rgba(0,0,0,0.06) 0px 1px 8px',
            }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.48)', marginBottom: 4 }}>父需求</div>
              <a
                onClick={() => {
                  const pid = req.parent;
                  if (pid) onNavigate ? onNavigate(pid) : (window.location.hash = `#req-${pid}`);
                }}
                style={{ fontSize: 14, color: '#0071e3', cursor: 'pointer' }}
              >
                {req.parent_requirement_id && <span style={{ marginRight: 6, fontSize: 12, color: 'rgba(0,0,0,0.48)' }}>{req.parent_requirement_id}</span>}
                {req.parent_name}
              </a>
            </div>
          )}

          {/* ── 关联子需求（来自 Requirement.parent FK）── */}
          {req.children_requirements?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.48)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>关联子需求</div>
              {req.children_requirements.map((c: any) => (
                <div key={c.id} style={{
                  padding: '12px 16px', marginBottom: 8,
                  background: '#ffffff', borderRadius: '10px',
                  boxShadow: 'rgba(0,0,0,0.06) 0px 1px 8px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer',
                }} onClick={() => onNavigate ? onNavigate(c.id) : (window.location.hash = `#req-${c.id}`)}>
                  <span style={{ fontSize: 14, color: '#1d1d1f' }}>
                    <span style={{ marginRight: 6, fontSize: 12, color: 'rgba(0,0,0,0.48)' }}>{c.requirement_id}</span>
                    {c.name}
                  </span>
                  <Tag color={REQ_STATUS_MAP_DETAIL[c.status]?.color || 'default'} style={{ borderRadius: '6px', margin: 0 }}>
                    {REQ_STATUS_MAP_DETAIL[c.status]?.label || c.status}
                  </Tag>
                </div>
              ))}
            </div>
          )}

          {/* ── 手动子需求 ── */}
          <Form form={subForm} onFinish={handleAddSubreq} layout="inline" style={{ marginBottom: 16 }}>
            <Form.Item name="name" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="子需求名称" style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="description">
              <Input placeholder="描述（可选）" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">添加</Button>
            </Form.Item>
          </Form>
          {subreqs.map((s) => (
            <div key={s.id} style={{
              padding: '12px 16px', marginBottom: 8,
              background: '#ffffff', borderRadius: '10px',
              boxShadow: 'rgba(0,0,0,0.06) 0px 1px 8px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '14px', color: '#1d1d1f' }}>{s.name}</span>
              <Tag style={{ borderRadius: '6px', margin: 0 }}>{s.status === 'completed' ? '已完成' : s.status === 'in_progress' ? '进行中' : '待处理'}</Tag>
            </div>
          ))}
          {subreqs.length === 0 && !req.children_requirements?.length && <div style={{ color: 'rgba(0,0,0,0.24)', textAlign: 'center', padding: 40, fontSize: '14px' }}>暂无子需求</div>}
        </div>
      ),
    },
    {
      key: 'requirement_md',
      label: '需求理解',
      children: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <MdSourceInput
              requirementId={requirementId}
              understandType="req_md"
              onSubmit={() => setReqMdRefresh(k => k + 1)}
            />
          </div>
          <MdEditorTab requirementId={requirementId} mdType="req" initialValue={req.req_md || ''} />
          <div style={{ marginTop: 24 }}>
            <AiUnderstandingList requirementId={requirementId} understandType="req_md" refreshKey={reqMdRefresh} />
          </div>
        </div>
      ),
    },
    {
      key: 'technical_md',
      label: '技术方案',
      children: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <MdSourceInput
              requirementId={requirementId}
              understandType="tech_md"
              onSubmit={() => setTechMdRefresh(k => k + 1)}
            />
          </div>
          <MdEditorTab requirementId={requirementId} mdType="tech" initialValue={req.tech_md || ''} />
          <div style={{ marginTop: 24 }}>
            <AiUnderstandingList requirementId={requirementId} understandType="tech_md" refreshKey={techMdRefresh} />
          </div>
        </div>
      ),
    },
    {
      key: 'ui_design',
      label: 'UI设计稿',
      children: (
        <div style={{ padding: '16px 0' }}>
          <Tabs
            size="small"
            items={[
              {
                key: 'ui_web',
                label: 'UI-Web',
                children: (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <MdSourceInput
                        requirementId={requirementId}
                        understandType="ui_design_web"
                        onSubmit={() => setUiDesignWebRefresh(k => k + 1)}
                      />
                    </div>
                    {req.ui_design_web && (
                      <div style={{ marginBottom: 16 }}>
                        <a href={req.ui_design_web} target="_blank" rel="noreferrer" style={{ color: '#1677ff' }}>Web设计稿链接</a>
                      </div>
                    )}
                    <AiUnderstandingList requirementId={requirementId} understandType="ui_design_web" refreshKey={uiDesignWebRefresh} />
                  </div>
                ),
              },
              {
                key: 'ui_app',
                label: 'UI-App',
                children: (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <MdSourceInput
                        requirementId={requirementId}
                        understandType="ui_design_app"
                        onSubmit={() => setUiDesignAppRefresh(k => k + 1)}
                      />
                    </div>
                    {req.ui_design_app && (
                      <div style={{ marginBottom: 16 }}>
                        <a href={req.ui_design_app} target="_blank" rel="noreferrer" style={{ color: '#1677ff' }}>App设计稿链接</a>
                      </div>
                    )}
                    <AiUnderstandingList requirementId={requirementId} understandType="ui_design_app" refreshKey={uiDesignAppRefresh} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'test_plan',
      label: '测试计划',
      children: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, color: '#262626', marginBottom: 12, fontSize: 14 }}>AI自动生成测试计划</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
              根据需求文档自动生成结构化测试计划，包含测试范围、测试策略和风险评估。
            </div>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              ghost
              onClick={async () => {
                message.info('测试计划生成功能即将上线');
              }}
            >
              生成测试计划
            </Button>
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
            <div style={{ fontWeight: 600, color: '#262626', marginBottom: 12, fontSize: 14 }}>AI测试用例</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
              AI根据需求自动生成测试用例，可保存到测试用例库。
            </div>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              ghost
              onClick={async () => {
                setAiCases([]);
                setAiLoading(true);
                try {
                  const res = await request.post('/integrations/ai/test-case-generation/', { requirement_id: requirementId });
                  if (res.data.test_cases?.length > 0) setAiCases(res.data.test_cases);
                  else message.info('AI 未返回结构化用例');
                } catch { message.error('AI 生成失败'); }
                finally { setAiLoading(false); }
              }}
              loading={aiLoading}
            >
              生成AI测试用例
            </Button>
            {(aiLoading || aiCases.length > 0) && (
              <div style={{ marginTop: 16 }}>
                {aiLoading ? (
                  <Spin tip="AI 生成中..." style={{ display: 'block', margin: '24px auto' }} />
                ) : (
                  <>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#595959', fontSize: 13 }}>共生成 {aiCases.length} 条用例</span>
                      <Button
                        type="primary"
                        size="small"
                        loading={aiSaving}
                        onClick={async () => {
                          setAiSaving(true);
                          let successCount = 0;
                          for (const c of aiCases) {
                            try {
                              await request.post('/test-cases/', {
                                title: c.name,
                                steps: Array.isArray(c.steps) ? c.steps.join('\n') : c.steps,
                                expected_result: c.expected,
                                project: req.project,
                                requirement: requirementId,
                                source: 'ai',
                                reviewed: 'pending',
                              });
                              successCount++;
                            } catch {}
                          }
                          setAiSaving(false);
                          message.success(`AI用例已保存 ${successCount}/${aiCases.length} 条`);
                          setAiCases([]);
                        }}
                      >
                        保存全部 ({aiCases.length} 条)
                      </Button>
                    </div>
                    {aiCases.map((c, i) => (
                      <div key={i} style={{ marginBottom: 10, padding: 12, background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.name}</div>
                        {c.precondition && <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>前置: {c.precondition}</div>}
                        <div style={{ fontSize: 13 }}>步骤: {Array.isArray(c.steps) ? c.steps.join(' → ') : c.steps}</div>
                        <div style={{ fontSize: 13, color: '#52c41a' }}>期望: {c.expected}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'changelogs',
      label: '变更历史',
      children: (
        <List
          style={{ padding: '8px 0' }}
          dataSource={changelogs}
          locale={{ emptyText: '暂无变更记录' }}
          renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar style={{ background: '#1890ff' }}>{item.changed_by_name?.[0]}</Avatar>}
                title={
                  <span>
                    <strong>{item.changed_by_name}</strong>{' 修改了 '}
                    <Tag>{item.field}</Tag>
                    <span style={{ color: '#999', fontSize: 12 }}>{item.changed_at?.slice(0, 16)}</span>
                  </span>
                }
                description={
                  item.old_value && item.new_value
                    ? `${item.old_value} → ${item.new_value}`
                    : item.new_value || '-'
                }
              />
            </List.Item>
          )}
        />
      ),
    },
  ];

  const userOptions = users.map((u) => ({ value: u.id, label: u.username }));
  const iterOptions = iterations.map((i) => ({ value: i.id, label: i.name }));

  return (
    <div style={{
      display: 'flex',
      gap: 0,
      height: '100%',
      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
    }}>
      {/* 左侧主内容 */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 32, overflowY: 'auto' }}>
        {/* 可编辑标题 */}
        {editingTitle ? (
          <Input
            autoFocus
            style={{
              fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
              fontSize: '21px',
              fontWeight: 600,
              marginBottom: 8,
              borderRadius: '8px',
            }}
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={async () => {
              setEditingTitle(false);
              if (titleVal.trim() && titleVal !== req.name) await patch({ name: titleVal.trim() });
            }}
            onPressEnter={async () => {
              setEditingTitle(false);
              if (titleVal.trim() && titleVal !== req.name) await patch({ name: titleVal.trim() });
            }}
          />
        ) : (
          <div
            onClick={() => setEditingTitle(true)}
            style={{
              fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
              fontSize: '21px',
              fontWeight: 600,
              lineHeight: 1.19,
              marginBottom: 8,
              cursor: 'pointer',
              padding: '4px 8px',
              marginLeft: -8,
              borderRadius: '6px',
              color: '#1d1d1f',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {req.name}
            <EditOutlined style={{ fontSize: 13, color: 'rgba(0,0,0,0.24)', marginLeft: 8 }} />
          </div>
        )}

        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {req.tapd_url ? (
              <a
                href={req.tapd_url}
                target="_blank"
                rel="noopener noreferrer"
                title={req.requirement_id}
                style={{ fontSize: '12px', color: '#0071e3', letterSpacing: '-0.12px' }}
              >
                {req.tapd_short_id ? `TAPD-${req.tapd_short_id}` : req.requirement_id}
              </a>
            ) : (
              <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.48)', letterSpacing: '-0.12px' }}>{req.requirement_id}</span>
            )}
            {req.is_blocked && (
              <Tag color="red" icon={<WarningOutlined />} style={{ borderRadius: '6px', margin: 0 }}>已阻塞: {req.block_reason}</Tag>
            )}
            {req.is_archived && <Tag style={{ borderRadius: '6px', margin: 0 }}>已归档</Tag>}
          </div>
          <Space size={8}>
            <Button
              icon={<RobotOutlined />}
              onClick={() => setAiDrawerOpen(true)}
              style={{ borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.8)' }}
            >
              AI助手
            </Button>
            <Button
              icon={<RobotOutlined />}
              onClick={() => setConversationOpen(true)}
              style={{ borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.8)' }}
            >
              AI对话
            </Button>
          </Space>
        </div>

        <Tabs items={tabItems} defaultActiveKey={defaultTab || 'info'} />
      </div>

      {/* 右侧基础信息侧边栏 */}
      <div style={{
        width: 280,
        minWidth: 280,
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        paddingLeft: 24,
        overflowY: 'auto',
      }}>
        <div style={{
          fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          color: '#1d1d1f',
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>基础信息</div>

        <InlineField
          label="需求类型"
          displayValue={
            req.req_type === 'task' ? <Tag color="purple" style={{ margin: 0 }}>任务</Tag>
            : req.req_type === 'product' ? <Tag color="blue" style={{ margin: 0 }}>产品需求</Tag>
            : <Tag style={{ margin: 0 }}>{req.req_type || '-'}</Tag>
          }
          editNode={(done) => (
            <InlineSelect
              value={req.req_type}
              options={[
                { value: 'product', label: '产品需求' },
                { value: 'task', label: '任务' },
              ]}
              done={done}
              onSave={async (v) => { await patch({ req_type: v }); }}
            />
          )}
        />

        <InlineField
          label="状态"
          displayValue={<Tag color={statusInfo.color} style={{ margin: 0 }}>{statusInfo.label}</Tag>}
          editNode={(done) => (
            <InlineSelect
              value={req.status}
              options={STATUS_OPTIONS}
              done={done}
              onSave={async (v) => { await patch({ status: v }); }}
            />
          )}
        />

        <InlineField
          label="优先级"
          displayValue={<Tag color={priorityInfo.color} style={{ margin: 0 }}>{priorityInfo.label}</Tag>}
          editNode={(done) => (
            <InlineSelect
              value={req.priority}
              options={PRIORITY_OPTIONS}
              done={done}
              onSave={async (v) => { await patch({ priority: v }); }}
            />
          )}
        />

        <InlineField
          label="迭代"
          displayValue={req.iteration_name || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineSelect
              value={req.iteration}
              options={iterOptions}
              done={done}
              onSave={async (v) => { await patch({ iteration: v }); }}
            />
          )}
        />

        {req.parent_name && (
          <InlineField
            label="父需求"
            displayValue={
              <a
                onClick={() => onNavigate ? onNavigate(req.parent) : (window.location.hash = `#req-${req.parent}`)}
                style={{ fontSize: 13, color: '#0071e3', cursor: 'pointer' }}
              >
                {req.parent_name}
              </a>
            }
            disabled
          />
        )}

        {req.module_name && (
          <InlineField label="模块" displayValue={req.module_name} disabled />
        )}

        {req.owner && (
          <InlineField label="处理人" displayValue={req.owner} disabled />
        )}

        <InlineField
          label="处理人（产品）"
          displayValue={req.product_owner_name || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineSelect
              value={req.product_owner}
              options={userOptions}
              done={done}
              onSave={async (v) => { await patch({ product_owner: v }); }}
            />
          )}
        />

        <InlineField
          label="开发负责人"
          displayValue={req.dev_owner_name || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineSelect
              value={req.dev_owner}
              options={userOptions}
              done={done}
              onSave={async (v) => { await patch({ dev_owner: v }); }}
            />
          )}
        />

        <InlineField
          label="测试负责人"
          displayValue={req.test_owner_name || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineSelect
              value={req.test_owner}
              options={userOptions}
              done={done}
              onSave={async (v) => { await patch({ test_owner: v }); }}
            />
          )}
        />

        <InlineField
          label="创建人"
          displayValue={
            req.source && req.source !== 'sys' && req.creator
              ? req.creator
              : (req.created_by_name || '-')
          }
          disabled
        />
        <InlineField
          label="创建时间"
          displayValue={
            req.source && req.source !== 'sys' && req.source_created_at
              ? req.source_created_at?.slice(0, 19).replace('T', ' ')
              : (req.created_at?.slice(0, 19).replace('T', ' ') || '-')
          }
          disabled
        />
        <InlineField
          label="更新时间"
          displayValue={(() => {
            if (req.source && req.source !== 'sys') {
              const src = req.source_updated_at || '';
              const sys = req.updated_at || '';
              const later = src > sys ? src : sys;
              return later?.slice(0, 19).replace('T', ' ') || '-';
            }
            return req.updated_at?.slice(0, 19).replace('T', ' ') || '-';
          })()}
          disabled
        />

        <InlineField
          label="开发人员"
          displayValue={
            req.developer_names?.length
              ? req.developer_names.map((u: any) => <Tag key={u.id} style={{ margin: '0 2px 2px 0' }}>{u.username}</Tag>)
              : req.developer_name
                ? <span style={{ fontSize: 13 }}>{req.developer_name}</span>
                : <span style={{ color: '#bbb' }}>-</span>
          }
          editNode={(done) => (
            <Select
              autoFocus
              mode="multiple"
              size="small"
              style={{ width: '100%' }}
              defaultValue={req.developer || []}
              options={userOptions}
              onChange={async (v) => {
                await patch({ developer: v });
                done();
              }}
              onBlur={done}
            />
          )}
        />

        <InlineField
          label="测试人员"
          displayValue={
            req.tester_names?.length
              ? req.tester_names.map((u: any) => <Tag key={u.id} style={{ margin: '0 2px 2px 0' }}>{u.username}</Tag>)
              : req.tester_name
                ? <span style={{ fontSize: 13 }}>{req.tester_name}</span>
                : <span style={{ color: '#bbb' }}>-</span>
          }
          editNode={(done) => (
            <Select
              autoFocus
              mode="multiple"
              size="small"
              style={{ width: '100%' }}
              defaultValue={req.tester || []}
              options={userOptions}
              onChange={async (v) => {
                await patch({ tester: v });
                done();
              }}
              onBlur={done}
            />
          )}
        />

        {/* ── 时间与工时 ── */}
        <InlineField
          label="预计开始"
          displayValue={req.plan_begin || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineDate value={req.plan_begin} onSave={async (v) => { await patch({ plan_begin: v }); }} done={done} />
          )}
        />
        <InlineField
          label="预计结束"
          displayValue={req.plan_due || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineDate value={req.plan_due} onSave={async (v) => { await patch({ plan_due: v }); }} done={done} />
          )}
        />
        <InlineField
          label="完成时间"
          displayValue={req.completed_at?.slice(0, 19).replace('T', ' ') || <span style={{ color: '#bbb' }}>-</span>}
          disabled
        />

        <InlineField
          label="提测时间"
          displayValue={req.test_submit_time?.slice(0, 10) || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineDate value={req.test_submit_time} onSave={async (v) => { await patch({ test_submit_time: v }); }} done={done} />
          )}
        />

        <InlineField
          label="上线时间"
          displayValue={req.online_time?.slice(0, 10) || <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineDate value={req.online_time} onSave={async (v) => { await patch({ online_time: v }); }} done={done} />
          )}
        />

        {/* ── 工时与进度 ── */}
        {(req.effort || req.effort_completed || req.effort_remain) && (
          <>
            <InlineField label="预估工时" displayValue={req.effort || <span style={{ color: '#bbb' }}>-</span>} disabled />
            <InlineField label="完成工时" displayValue={req.effort_completed || <span style={{ color: '#bbb' }}>-</span>} disabled />
            <InlineField label="剩余工时" displayValue={req.effort_remain || <span style={{ color: '#bbb' }}>-</span>} disabled />
          </>
        )}

        {req.progress != null && (
          <InlineField label="进度" displayValue={`${req.progress}%`} disabled />
        )}

        {req.label && (
          <InlineField
            label="标签"
            displayValue={
              req.label.split(';').filter(Boolean).map((t: string) => (
                <Tag key={t} style={{ margin: '0 2px 2px 0' }}>{t.trim()}</Tag>
              ))
            }
            disabled
          />
        )}

        <InlineField
          label="所属项目"
          displayValue={req.project_name || '-'}
          disabled
        />

        <InlineField
          label="UI设计稿 Web"
          displayValue={req.ui_design_web
            ? <a href={req.ui_design_web} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>查看链接</a>
            : <span style={{ color: '#bbb' }}>-</span>}
          editNode={(done) => (
            <InlineText
              value={req.ui_design_web || ''}
              placeholder="https://figma.com/..."
              done={done}
              onSave={async (v) => { await patch({ ui_design_web: v || null }); }}
            />
          )}
        />
      </div>

      {/* 标记阻塞弹窗 */}
      <Modal
        title="标记阻塞"
        open={blockModalVisible}
        onOk={handleBlock}
        onCancel={() => setBlockModalVisible(false)}
        okText="确认阻塞"
      >
        <p>请说明阻塞原因（必填）：</p>
        <Input.TextArea
          rows={3}
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
          placeholder="描述阻塞原因..."
        />
      </Modal>

      {/* AI 需求助手 Drawer */}
      <AiAssistantDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        title="AI需求助手"
        contextData={{
          requirementId,
          requirementName: req?.name,
          description: req?.description,
        }}
      />

      {/* AI 对话 Drawer */}
      <AiConversationDrawer
        open={conversationOpen}
        onClose={() => setConversationOpen(false)}
        requirementId={requirementId}
        understandType="req_md"
        onSaved={() => setReqMdRefresh(k => k + 1)}
      />
    </div>
  );
};

export default RequirementDetail;
