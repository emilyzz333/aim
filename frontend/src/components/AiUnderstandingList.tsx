import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Table, Tag, Button, Drawer, Input, Space, Popconfirm, message, Modal, Dropdown, Tooltip, Collapse, Tabs, Image, Typography, Alert } from 'antd';
import type { MenuProps } from 'antd';
import {
  EditOutlined, DeleteOutlined, ReloadOutlined, ThunderboltOutlined,
  FileOutlined, SyncOutlined, LinkOutlined,
  AuditOutlined, SearchOutlined, MoreOutlined, RightOutlined,
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import request from '@/services/request';
import AiUnderstandingReviewPanel from './AiUnderstandingReviewPanel';
import ScreenshotInputDrawer from './ScreenshotInputDrawer';

const { TextArea } = Input;
const { Panel } = Collapse;
const { Text } = Typography;

const IMPORTANCE_COLOR: Record<string, string> = { 核心: 'red', 重要: 'orange', 辅助: 'blue' };
const CHANGE_TYPE_COLOR: Record<string, string> = { 新增: 'green', 修改: 'orange', 删除: 'red', 优化: 'blue' };
const SCENARIO_ICON: Record<string, string> = { 正常流程: '✅', 异常流程: '❌', 边界情况: '⚠️' };
const ISSUE_TYPE_COLOR: Record<string, string> = { 缺失: 'orange', 矛盾: 'red', 未定义: 'gold', 风险: 'volcano' };
const SEVERITY_COLOR: Record<string, string> = { 高: 'red', 中: 'orange', 低: 'green' };

function renderStructuredFeatures(result: Record<string, any>) {
  const features = result.features || [];
  if (!features.length) return <Text type="secondary">暂无功能点</Text>;

  const groups: Record<string, typeof features> = {};
  features.forEach((f: any) => {
    const key = f.module_name || '未知模块';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(groups).map(([moduleName, feats]) => (
        <div key={moduleName}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>📁 {moduleName}</div>
          <Collapse defaultActiveKey={feats.filter((f: any) => f.importance === '核心').map((_: any, i: number) => String(i))} style={{ background: 'transparent', border: 'none' }}>
            {feats.map((feat: any, i: number) => (
              <Panel key={String(i)} style={{ marginBottom: 6, background: '#fff', borderRadius: 8, border: '1px solid #e5e5e7' }} header={
                <Space size={8}>
                  <Text strong style={{ fontSize: 14 }}>{feat.name}</Text>
                  {feat.importance && <Tag color={IMPORTANCE_COLOR[feat.importance]} style={{ margin: 0 }}>{feat.importance}</Tag>}
                  {feat.change_type && <Tag color={CHANGE_TYPE_COLOR[feat.change_type]} style={{ margin: 0 }}>{feat.change_type}</Tag>}
                </Space>
              }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {feat.description && <div><Text type="secondary" style={{ fontSize: 12 }}>描述</Text><div style={{ fontSize: 13, marginTop: 2 }}>{feat.description}</div></div>}
                  {(feat.acceptance_criteria?.length || 0) > 0 && (
                    <div><Text type="secondary" style={{ fontSize: 12 }}>验收标准</Text>
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {feat.acceptance_criteria.map((ac: any, j: number) => (
                          <div key={j} style={{ background: '#f8f8f8', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{SCENARIO_ICON[ac.scenario] || ''} {ac.scenario}</div>
                            {ac.given && <div><Text type="secondary">Given: </Text>{ac.given}</div>}
                            {ac.when && <div><Text type="secondary">When: </Text>{ac.when}</div>}
                            {ac.then && <div><Text type="secondary">Then: </Text>{ac.then}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            ))}
          </Collapse>
        </div>
      ))}
    </div>
  );
}

function renderStructuredChanges(result: Record<string, any>) {
  const changes = result.changes;
  if (!changes) return <Text type="secondary">暂无变更汇总</Text>;
  const sections = [
    { label: '新增', color: 'green', items: changes.added || [] },
    { label: '修改', color: 'orange', items: changes.modified || [] },
    { label: '删除', color: 'red', items: changes.removed || [] },
  ].filter(s => s.items.length > 0);
  if (!sections.length) return <Text type="secondary">暂无变更汇总</Text>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sections.map(s => (
        <div key={s.label}>
          <Tag color={s.color} style={{ marginBottom: 8, fontSize: 13 }}>{s.label} ({s.items.length})</Tag>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{s.items.map((item: string, i: number) => <li key={i} style={{ fontSize: 13, padding: '2px 0' }}>{item}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function renderReferenceInfo(result: Record<string, any>) {
  const issues = result.quality_issues || [];
  const notes = result.technical_design_notes;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert type="info" showIcon message="以下内容由 AI 推断生成，仅供参考，请结合实际需求判断" style={{ borderRadius: 8 }} />
      <div>
        <Text strong style={{ fontSize: 14, color: '#666' }}>质量问题预判</Text>
        <div style={{ marginTop: 8 }}>
          {!issues.length ? <Text type="secondary">未发现质量问题</Text> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {issues.map((issue: any, i: number) => (
                <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #e5e5e7', borderLeft: `3px solid ${issue.severity === '高' ? '#ff4d4f' : issue.severity === '中' ? '#fa8c16' : '#52c41a'}` }}>
                  <Space size={8} style={{ marginBottom: 4 }}>
                    <Tag color={ISSUE_TYPE_COLOR[issue.type]}>{issue.type}</Tag>
                    <Tag color={SEVERITY_COLOR[issue.severity]}>严重度：{issue.severity}</Tag>
                  </Space>
                  <div style={{ fontSize: 13 }}>{issue.description}</div>
                  {issue.suggestion && <div style={{ background: '#fffbe6', padding: '4px 8px', borderRadius: 4, fontSize: 12, color: '#614700', marginTop: 6 }}>建议：{issue.suggestion}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
        <Text strong style={{ fontSize: 14, color: '#666' }}>技术注意事项</Text>
        <div style={{ marginTop: 8 }}>
          {!notes ? <Text type="secondary">暂无技术注意事项</Text> : (() => {
            const sections = [
              { label: '数据模型', icon: '🗄️', items: notes.data_model_hints },
              { label: 'API 设计', icon: '🔌', items: notes.api_hints },
              { label: '权限控制', icon: '🔐', items: notes.permission_hints },
              { label: '性能考量', icon: '⚡', items: notes.performance_hints },
              { label: '常见陷阱', icon: '⚠️', items: notes.common_pitfalls },
            ].filter(s => (s.items?.length || 0) > 0);
            if (!sections.length) return <Text type="secondary">暂无技术注意事项</Text>;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {sections.map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{s.icon} {s.label}</div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>{s.items!.map((item: string, i: number) => <li key={i} style={{ fontSize: 13, lineHeight: 1.7 }}>{item}</li>)}</ul>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

interface UnderstandingSummary {
  id: number;
  status: string;
  status_display: string;
  parse_status: string;
  parse_status_display: string;
  is_selected: boolean;
  ai_understanding: string | null;
  parsed_content: string | null;
  parsed_content_with_images: string | null;
  parse_reviewed: boolean;
  ai_reviewed: boolean;
  error_msg: string | null;
  parse_error_msg: string | null;
  note: string | null;
  updated_at: string | null;
  suggested_modules?: string[];
  ai_understanding_result?: Record<string, unknown> | null;
  ai_quality_issues?: unknown[] | null;
}

interface InputAsset {
  id: number;
  requirement: number;
  understand_type: string;
  source_type: string;
  source_type_display: string;
  batch_desc: string;
  file_paths: { source_files: string[]; images: string[] } | string[];
  text_content: string | null;
  is_selected: boolean;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  understandings: UnderstandingSummary[];
}

interface AiUnderstandingListProps {
  requirementId: number;
  understandType: string;
  refreshKey?: number;
}

// Flattened row for merged table
interface FlatRow {
  key: string;
  assetId: number;
  understandingId?: number;
  isFirstRow: boolean;
  rowSpan: number;
  asset: InputAsset;
  understanding?: UnderstandingSummary;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  processing: 'processing',
  done: 'success',
  failed: 'error',
};

const SOURCE_COLORS: Record<string, string> = {
  url_fetch: 'orange',
  upload_file: 'cyan',
  ai_conversation: 'purple',
  screenshot_input: 'blue',
  gitlab_pull: 'green',
};

const isRemoteUrl = (p: string) => /^https?:\/\//i.test(p);
const toAssetUrl = (p: string) => {
  if (!p) return '';
  if (isRemoteUrl(p)) return p;
  return `/media/${p.replace(/^\/+/, '').replace(/\\/g, '/')}`;
};
function RawTextWithImages({ text, images }: { text: string; images: string[] }) {
  const parts = text.split(/(\[图片\d+\])/g);
  return (
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
      {parts.map((part, i) => {
        const m = part.match(/^\[图片(\d+)\]$/);
        if (m) {
          const idx = parseInt(m[1], 10) - 1;
          const imgPath = images[idx];
          if (imgPath) return <Image key={i} src={toAssetUrl(imgPath)} style={{ maxWidth: '100%', borderRadius: 4, margin: '8px 0', display: 'block' }} />;
        }
        // 为段落添加间距
        if (part.includes('\n\n')) {
          return <div key={i} style={{ marginBottom: 12 }}>{part}</div>;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
// Render parsed_content_with_images, converting <img-desc> blocks to styled callouts
function renderParsedContent(source: string): ReactNode {
  const parts = source.split(/(<img-desc[\s\S]*?<\/img-desc>)/g);
  return (
    <div>
      {parts.map((part, i) => {
        const m = part.match(/^<img-desc[^>]*>([\s\S]*?)<\/img-desc>$/);
        if (m) {
          return (
            <div key={i} style={{
              margin: '8px 0',
              padding: '10px 14px',
              background: 'rgba(0,0,0,0.03)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderLeft: '3px solid #faad14',
              borderRadius: 6,
              fontSize: 13,
              color: 'rgba(0,0,0,0.55)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {m[1].trim()}
            </div>
          );
        }
        if (!part) return null;
        return (
          <div key={i} data-color-mode="light">
            <MDEditor.Markdown source={part} style={{ background: 'transparent', fontSize: 14, lineHeight: 1.6 }} />
          </div>
        );
      })}
    </div>
  );
}

const truncate = (s: string | null | undefined, n = 40) => {
  if (!s) return '';
  const line = s.replace(/^#+\s*/m, '').split('\n')[0];
  return line.length > n ? line.slice(0, n) + '...' : line;
};

export default function AiUnderstandingList({ requirementId, understandType, refreshKey }: AiUnderstandingListProps) {
  const [list, setList] = useState<InputAsset[]>([]);
  const [loading, setLoading] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAsset, setDrawerAsset] = useState<InputAsset | null>(null);
  const [drawerUnderstanding, setDrawerUnderstanding] = useState<UnderstandingSummary | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('parse');

  // Review modal
  const [reviewModalId, setReviewModalId] = useState<number | null>(null);

  // Screenshot input drawer
  const [screenshotDrawerOpen, setScreenshotDrawerOpen] = useState(false);

  // Polling interval ref — keeps ticking while any understanding is in-progress
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasInProgress = (data: InputAsset[]) =>
    data.some(a => a.understandings.some(u =>
      u.parse_status === 'processing' || u.status === 'processing'
    ));

  const fetchList = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await request.get('/requirements/ai-input-assets/', {
        params: { requirement: requirementId, type: understandType },
      });
      const newList: InputAsset[] = res.data?.results || res.data || [];
      setList(newList);
      // Keep polling while tasks are running
      if (hasInProgress(newList)) {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollTimerRef.current = setTimeout(() => fetchList(true), 3000);
      }
    } catch { /* ignore */ }
    if (!quiet) setLoading(false);
  }, [requirementId, understandType]);

  useEffect(() => {
    fetchList();
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [fetchList, refreshKey]);

  // Trigger immediate re-fetch after user action, then start polling
  const scheduleRefresh = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(() => fetchList(true), 1500);
  };

  // ─── Asset (first layer) actions ──────────────────────────────────────────

  const handleTriggerParseForAsset = async (asset: InputAsset) => {
    try {
      await request.post(`/requirements/ai-input-assets/${asset.id}/trigger-parse/`);
      message.success('已触发AI解析，请稍后查看进度');
      await fetchList(true);
      scheduleRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '触发失败');
    }
  };

  const handleTriggerGenerateForAsset = async (asset: InputAsset) => {
    if (!asset.text_content) {
      message.warning('该素材暂无文本内容，请先更新抓取内容或检查文件');
      return;
    }
    try {
      await request.post(`/requirements/ai-input-assets/${asset.id}/trigger-generate/`);
      message.success('已触发AI理解生成，请稍后查看进度');
      await fetchList(true);
      scheduleRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '触发失败');
    }
  };

  const handleDeleteAsset = async (id: number) => {
    try {
      await request.delete(`/requirements/ai-input-assets/${id}/`);
      setList(prev => prev.filter(a => a.id !== id));
      message.success('删除成功');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败');
    }
  };

  // ─── Understanding (second layer) actions ──────────────────────────────────

  const handleTriggerParse = async (u: UnderstandingSummary, assetId: number) => {
    try {
      await request.post(`/requirements/ai-understandings/${u.id}/trigger-parse/`);
      message.success('已触发解析，请稍后查看进度');
      await fetchList(true);
      scheduleRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '触发失败');
    }
  };

  const handleTriggerGenerate = async (u: UnderstandingSummary) => {
    try {
      await request.post(`/requirements/ai-understandings/${u.id}/trigger-generate/`);
      message.success('已触发理解生成，请稍后刷新查看进度');
      scheduleRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '触发失败');
    }
  };

  const handleSelect = async (u: UnderstandingSummary) => {
    try {
      await request.patch(`/requirements/ai-understandings/${u.id}/select/`);
      await fetchList(true);
      message.success('已设为最优');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败');
    }
  };

  const handleDeselect = async (u: UnderstandingSummary) => {
    try {
      await request.patch(`/requirements/ai-understandings/${u.id}/deselect/`);
      await fetchList(true);
      message.success('已取消最优');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败');
    }
  };

  const handleDeleteUnderstanding = async (u: UnderstandingSummary) => {
    try {
      await request.delete(`/requirements/ai-understandings/${u.id}/`);
      await fetchList(true);
      message.success('删除成功');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败');
    }
  };

  // ─── Drawer actions ────────────────────────────────────────────────────────

  const openAssetDrawer = (asset: InputAsset) => {
    setDrawerAsset(asset);
    setDrawerUnderstanding(null);
    setDrawerOpen(true);
  };

  const openUnderstandingDrawer = (asset: InputAsset, u: UnderstandingSummary) => {
    setDrawerAsset(asset);
    setDrawerUnderstanding(u);
    setEditNote(u.note || '');
    setEditContent(u.parsed_content_with_images || u.parsed_content || '');
    setEditing(false);
    setActiveTab('parse');
    setDrawerOpen(true);
  };

  const handleSaveNote = async () => {
    if (!drawerUnderstanding) return;
    try {
      await request.patch(`/requirements/ai-understandings/${drawerUnderstanding.id}/`, { note: editNote });
      await fetchList(true);
      message.success('备注已保存');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存失败');
    }
  };

  const handleSaveContent = async () => {
    if (!drawerUnderstanding) return;
    try {
      const field = activeTab === 'parse' ? 'parsed_content_with_images' : 'ai_understanding';
      await request.patch(`/requirements/ai-understandings/${drawerUnderstanding.id}/`, { [field]: editContent });
      const res = await request.get(`/requirements/ai-understandings/${drawerUnderstanding.id}/`);
      const updated: UnderstandingSummary = res.data;
      setDrawerUnderstanding(updated);
      // 保存后切换回显示内容
      setEditContent(activeTab === 'parse' ? (updated.parsed_content_with_images || updated.parsed_content || '') : (updated.ai_understanding || ''));
      await fetchList(true);
      setEditing(false);
      message.success('内容已保存');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存失败');
    }
  };

  const refreshDrawerUnderstanding = async () => {
    if (!drawerUnderstanding) return;
    try {
      const res = await request.get(`/requirements/ai-understandings/${drawerUnderstanding.id}/`);
      const updated: UnderstandingSummary = res.data;
      setDrawerUnderstanding(updated);
      setEditContent(activeTab === 'parse' ? (updated.parsed_content_with_images || updated.parsed_content || '') : (updated.ai_understanding || ''));
      await fetchList(true);
      message.success('已刷新');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '刷新失败');
    }
  };

  // Helper: get file paths from asset
  const getFilePaths = (asset: InputAsset): string[] => {
    if (!asset.file_paths) return [];
    if (Array.isArray(asset.file_paths)) return asset.file_paths;
    if (typeof asset.file_paths === 'object') {
      const { source_files = [], images = [] } = asset.file_paths as { source_files?: string[]; images?: string[] };
      return [...source_files, ...images];
    }
    return [];
  };

  // ─── Flatten data for merged table ────────────────────────────────────────

  const flattenData = (): FlatRow[] => {
    const result: FlatRow[] = [];
    list.forEach(asset => {
      const understandings = asset.understandings.length > 0 ? asset.understandings : [undefined];
      understandings.forEach((u, idx) => {
        result.push({
          key: u ? `${asset.id}-${u.id}` : `${asset.id}-empty`,
          assetId: asset.id,
          understandingId: u?.id,
          isFirstRow: idx === 0,
          rowSpan: idx === 0 ? understandings.length : 0,
          asset,
          understanding: u,
        });
      });
    });
    return result;
  };

  // ─── Merged table columns ──────────────────────────────────────────────────

  const mergedColumns = [
    {
      title: '来源',
      width: 50,
      render: (_: any, row: FlatRow) => {
        if (row.rowSpan === 0) return { children: null, props: { rowSpan: 0 } };
        return {
          children: <Tag color={SOURCE_COLORS[row.asset.source_type] || 'default'} style={{ fontSize: 12 }}>{row.asset.source_type_display}</Tag>,
          props: { rowSpan: row.rowSpan },
        };
      },
    },
    {
      title: '原始文件',
      width: 340,
      render: (_: any, row: FlatRow) => {
        if (row.rowSpan === 0) return { children: null, props: { rowSpan: 0 } };
        const label = row.asset.batch_desc || row.asset.source_type_display;

        const assetMenuItems: MenuProps['items'] = [
          {
            key: 'parse',
            label: <span style={{ color: '#0071e3' }}>AI解析</span>,
            icon: <span style={{ color: '#0071e3', fontSize: 16, fontWeight: 500 }}>+</span>,
            onClick: (e) => { e.domEvent.stopPropagation(); handleTriggerParseForAsset(row.asset); },
          },
          // {
          //   key: 'generate',
          //   label: <span style={{ color: '#0071e3' }}>AI理解</span>,
          //   icon: <span style={{ color: '#0071e3', fontSize: 16, fontWeight: 500 }}>+</span>,
          //   onClick: () => handleTriggerGenerateForAsset(row.asset),
          // },
          { type: 'divider' },
          {
            key: 'delete',
            danger: true,
            label: '删除',
            icon: <DeleteOutlined />,
            onClick: (e) => {
              e.domEvent.stopPropagation();
              Modal.confirm({
                title: '确认删除',
                content: '删除该记录将同时删除所有关联的AI解析和AI理解，确认删除吗？',
                okText: '确认删除',
                okType: 'danger',
                cancelText: '取消',
                onOk: () => handleDeleteAsset(row.asset.id),
              });
            },
          },
        ];

        return {
          children: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#1677ff', wordBreak: 'break-all', cursor: 'pointer', fontSize: 13 }}
                onClick={e => { e.stopPropagation(); openAssetDrawer(row.asset); }}>
                <FileOutlined style={{ marginRight: 4 }} />
                {label}
              </span>
              <Dropdown menu={{ items: assetMenuItems }} trigger={['click']} placement="bottomRight">
                <Button type="text" size="small" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
              </Dropdown>
            </div>
          ),
          props: { rowSpan: row.rowSpan },
        };
      },
    },
    {
      title: <span title="点击★设为最优">★</span>,
      width: 36,
      render: (_: any, row: FlatRow) => {
        if (!row.understanding) return <span style={{ color: '#d9d9d9' }}>-</span>;
        const u = row.understanding;
        return (
          <span
            style={{ cursor: 'pointer', color: u.is_selected ? '#faad14' : '#d9d9d9', fontSize: 16 }}
            title={u.is_selected ? '取消最优' : '设为最优'}
            onClick={e => { e.stopPropagation(); u.is_selected ? handleDeselect(u) : handleSelect(u); }}
          >★</span>
        );
      },
    },
    {
      title: 'AI解析',
      width: 240,
      render: (_: any, row: FlatRow) => {
        if (!row.understanding?.parsed_content) return <span style={{ color: '#bbb' }}>-</span>;
        return (
          <span style={{ color: '#1d1d1f', fontSize: 13 }}>
            {truncate(row.understanding.parsed_content)}
          </span>
        );
      },
    },
    {
      title: 'AI理解',
      width: 280,
      render: (_: any, row: FlatRow) => {
        if (!row.understanding?.ai_understanding) return <span style={{ color: '#bbb' }}>-</span>;
        return (
          <a style={{ color: '#1677ff', fontSize: 13 }} onClick={() => openUnderstandingDrawer(row.asset, row.understanding!)}>
            {truncate(row.understanding.ai_understanding)}
          </a>
        );
      },
    },
    {
      title: '状态',
      width: 80,
      render: (_: any, row: FlatRow) => {
        if (!row.understanding) return <span style={{ color: '#bbb' }}>-</span>;
        const u = row.understanding;
        const parseTag = (() => {
          const s = u.parse_status;
          if (s === 'processing') return <Tag color="processing" style={{ fontSize: 11 }}>解析中</Tag>;
          if (s === 'done') return <Tag color="success" style={{ fontSize: 11 }}>已解析{u.parse_reviewed ? '✓' : ''}</Tag>;
          if (s === 'failed') return <Tag color="error" style={{ fontSize: 11 }}>解析失败</Tag>;
          return <Tag style={{ fontSize: 11 }}>待解析</Tag>;
        })();
        const understandTag = (
          <Tag color={STATUS_COLORS[u.status] || 'default'} style={{ fontSize: 11 }}>{u.status_display}</Tag>
        );
        return <Space size={2}>{parseTag}{understandTag}</Space>;
      },
    },
    {
      title: '更新时间',
      width: 70,
      render: (_: any, row: FlatRow) => {
        const time = row.understanding?.updated_at || row.asset.updated_at;
        return <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', whiteSpace: 'nowrap' }}>{time?.slice(0, 16).replace('T', ' ') || ''}</span>;
      },
    },
    {
      title: '操作',
      width: 70,
      render: (_: any, row: FlatRow) => {
        if (!row.understanding) {
          if (!row.isFirstRow) return null;
          // No understanding yet — asset-level actions only
          return (
            <Space size={2} onClick={e => e.stopPropagation()}>
              <Tooltip title="AI解析">
                <Button type="link" size="small" onClick={() => handleTriggerParseForAsset(row.asset)} style={{ padding: '0 4px', fontWeight: 600, fontSize: 16, lineHeight: 1 }}>+</Button>
              </Tooltip>
              <Tooltip title="更新原始内容">
                <Button type="link" size="small" icon={<ReloadOutlined />} onClick={async () => {
                  try {
                    await request.post(`/requirements/ai-input-assets/${row.asset.id}/refetch/`);
                    message.success('已触发更新，请稍后刷新');
                    scheduleRefresh();
                  } catch (err: any) { message.error(err?.response?.data?.detail || '操作失败'); }
                }} />
              </Tooltip>
            </Space>
          );
        }
        const u = row.understanding;
        const needReview = (u.parse_status === 'done' && !u.parse_reviewed) || (u.status === 'done' && !u.ai_reviewed);

        return (
          <Space size={2} onClick={e => e.stopPropagation()}>
            <Tooltip title="AI解析">
              <Button type="link" size="small" icon={<SearchOutlined />} onClick={() => handleTriggerParse(u, row.asset.id)} />
            </Tooltip>
            <Tooltip title="AI理解">
              <Button type="link" size="small" icon={<ThunderboltOutlined />} onClick={() => handleTriggerGenerate(u)} />
            </Tooltip>
            {needReview && (
              <Tooltip title="审核">
                <Button type="link" size="small" icon={<AuditOutlined />} onClick={() => setReviewModalId(u.id)} />
              </Tooltip>
            )}
            <Popconfirm
              title="确定删除该条记录？"
              okText="确认删除"
              okType="danger"
              cancelText="取消"
              onConfirm={() => handleDeleteUnderstanding(u)}
            >
              <Tooltip title="删除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <style>{`
        .ai-understanding-selected-row {
          background-color: #fffbe6 !important;
        }
        .ai-drawer-tabs.ant-tabs {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .ai-drawer-tabs.ant-tabs .ant-tabs-content-holder {
          flex: 1;
          overflow: hidden;
        }
        .ai-drawer-tabs.ant-tabs .ant-tabs-content {
          height: 100%;
        }
        .ai-drawer-tabs.ant-tabs .ant-tabs-tabpane {
          height: 100%;
        }
        .btn-approve {
          background: rgba(52, 199, 89, 0.08) !important;
          color: #25a244 !important;
          border: 1px solid rgba(52, 199, 89, 0.35) !important;
          height: 24px !important;
          font-size: 12px !important;
          padding: 0 8px !important;
          line-height: 22px !important;
        }
        .btn-approve:hover {
          background: rgba(52, 199, 89, 0.14) !important;
          border-color: rgba(52, 199, 89, 0.6) !important;
        }
        .btn-reject {
          background: rgba(255, 59, 48, 0.07) !important;
          color: #d93025 !important;
          border: 1px solid rgba(255, 59, 48, 0.30) !important;
          height: 24px !important;
          font-size: 12px !important;
          padding: 0 8px !important;
          line-height: 22px !important;
        }
        .btn-reject:hover {
          background: rgba(255, 59, 48, 0.12) !important;
          border-color: rgba(255, 59, 48, 0.55) !important;
        }
        .btn-trigger {
          background: rgba(0, 113, 227, 0.07) !important;
          color: #0071e3 !important;
          border: 1px solid rgba(0, 113, 227, 0.28) !important;
          height: 24px !important;
          font-size: 12px !important;
          padding: 0 8px !important;
          line-height: 22px !important;
        }
        .btn-trigger:hover {
          background: rgba(0, 113, 227, 0.12) !important;
          border-color: rgba(0, 113, 227, 0.55) !important;
        }
        .btn-edit {
          height: 24px !important;
          font-size: 12px !important;
          padding: 0 8px !important;
          line-height: 22px !important;
        }
      `}</style>

      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
          文件列表（含AI解析/理解记录）
        </div>
        <Space size={8}>
          <Button size="small" icon={<SyncOutlined />} onClick={() => fetchList()}>
            刷新状态
          </Button>
        </Space>
      </div>

      <Table
        dataSource={flattenData()}
        columns={mergedColumns}
        rowKey="key"
        size="small"
        loading={loading}
        pagination={false}
        scroll={{ x: 1130 }}
        rowClassName={(row) => row.understanding?.is_selected ? 'ai-understanding-selected-row' : ''}
        onRow={(row) => ({
          onClick: () => {
            if (row.understanding) {
              openUnderstandingDrawer(row.asset, row.understanding);
            } else {
              openAssetDrawer(row.asset);
            }
          },
          style: { cursor: 'pointer' },
        })}
      />

      {/* Review Modal */}
      <Modal
        title="AI解析/理解审核"
        open={!!reviewModalId}
        onCancel={() => setReviewModalId(null)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {reviewModalId && (
          <AiUnderstandingReviewPanel
            understandingId={reviewModalId}
            onRefresh={() => { fetchList(true); setReviewModalId(null); }}
          />
        )}
      </Modal>

      {/* Drawer */}
      <Drawer
        title={drawerUnderstanding ? 'AI Understanding 详情' : '素材详情'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={drawerUnderstanding ? 1500 : 1300}
        destroyOnClose
        styles={{ body: { background: '#f5f5f7', padding: 0 } }}
      >
        {drawerAsset && (
          <div style={{ padding: '8px 12px' }}>
            {!drawerUnderstanding ? (
              <>
                {/* Asset Detail */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '20px 24px',
                  marginBottom: 16,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1d1d1f',
                    marginBottom: 12,
                    letterSpacing: '-0.224px'
                  }}>来源类型</div>
                  <Tag color={SOURCE_COLORS[drawerAsset.source_type] || 'default'} style={{ fontSize: 13 }}>
                    {drawerAsset.source_type_display}
                  </Tag>
                  {drawerAsset.source_type === 'url_fetch' && drawerAsset.batch_desc && (
                    <div style={{ marginTop: 12 }}>
                      <a
                        href={drawerAsset.batch_desc}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 12px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: 8,
                          color: '#0071e3',
                          textDecoration: 'none',
                          fontSize: '14px',
                          background: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          wordBreak: 'break-all',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 113, 227, 0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f5f5f7'; }}
                      >
                        <LinkOutlined style={{ flexShrink: 0 }} />
                        <span>{drawerAsset.batch_desc}</span>
                      </a>
                    </div>
                  )}
                </div>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.224px' }}>原始内容</div>
                    <Button size="small" style={{ borderRadius: 6 }} icon={<ReloadOutlined />} onClick={async () => {
                        try {
                          await request.post(`/requirements/ai-input-assets/${drawerAsset.id}/refetch/`);
                          message.success('已触发更新，请稍后刷新');
                          scheduleRefresh();
                        } catch (err: any) { message.error(err?.response?.data?.detail || '操作失败'); }
                      }}>更新抓取内容</Button>
                  </div>
                  <div style={{
                    fontSize: 14,
                    lineHeight: 1.47,
                    color: '#1d1d1f',
                    letterSpacing: '-0.224px',
                    background: '#f5f5f7',
                    padding: 16,
                    borderRadius: 8,
                    maxHeight: 500,
                    overflow: 'auto',
                    border: '1px solid rgba(0,0,0,0.06)'
                  }}>
                    {drawerAsset.text_content
                      ? <RawTextWithImages
                          text={drawerAsset.text_content}
                          images={(() => {
                            const fp = drawerAsset.file_paths;
                            return fp ? (Array.isArray(fp) ? [] : ((fp as any).images || [])) : [];
                          })()}
                        />
                      : '暂无内容'}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Understanding Detail — left-right comparison layout */}
                <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 140px)' }}>

                  {/* ── Left panel: 原始内容 ── */}
                  <div style={{
                    width: 480, minWidth: 320,
                    background: '#ffffff',
                    borderRadius: 12,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}>
                    {/* Left header */}
                    <div style={{
                      padding: '6px 8px',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexShrink: 0,
                    }}>
                      <Space size={8}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.224px' }}>原始内容</span>
                        <Tag color={SOURCE_COLORS[drawerAsset.source_type] || 'default'} style={{ fontSize: 11 }}>
                          {drawerAsset.source_type_display}
                        </Tag>
                      </Space>
                    </div>

                    {/* Left body: scrollable */}
                    <div style={{ flex: 1, overflow: 'auto', padding: 8, background: '#f5f5f7' }}>
                      {drawerAsset.text_content ? (
                        <RawTextWithImages
                          text={drawerAsset.text_content}
                          images={(() => {
                            const fp = drawerAsset.file_paths;
                            return fp ? (Array.isArray(fp) ? [] : ((fp as any).images || [])) : [];
                          })()}
                        />
                      ) : (() => {
                        const fp = drawerAsset.file_paths;
                        const imgs: string[] = fp
                          ? (Array.isArray(fp)
                            ? (fp as string[]).filter(p => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p))
                            : ((fp as { source_files?: string[]; images?: string[] }).images || []))
                          : [];
                        return imgs.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {imgs.map((img, i) => (
                              <Image key={i} src={toAssetUrl(img)} style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)' }} />
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>暂无内容</span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Right panel: AI解析 / AI理解 Tabs ── */}
                  <div style={{
                    flex: 1, minWidth: 320,
                    background: '#ffffff',
                    borderRadius: 12,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}>
                    <Tabs
                      className="ai-drawer-tabs"
                      activeKey={activeTab}
                      onChange={(key) => {
                        setEditing(false);
                        setEditContent(key === 'parse'
                          ? (drawerUnderstanding?.parsed_content_with_images || drawerUnderstanding?.parsed_content || '')
                          : (drawerUnderstanding?.ai_understanding || ''));
                        setActiveTab(key);
                      }}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 0 0 8px' }}
                      items={[
                        {
                          key: 'parse',
                          label: <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 12,padding: '0 4px' }}>AI解析</span>,
                          children: (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 8px 8px' }}>
                              {/* Action row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                                <Space size={8}>
                                  {(() => {
                                    const s = drawerUnderstanding.parse_status;
                                    if (s === 'processing') return <Tag color="processing">解析中</Tag>;
                                    if (s === 'done') return <Tag color="success">已解析{drawerUnderstanding.parse_reviewed ? ' ✓' : ''}</Tag>;
                                    if (s === 'failed') return <Tag color="error">解析失败</Tag>;
                                    return <Tag>待解析</Tag>;
                                  })()}
                                </Space>
                                <Space size={8}>
                                  {drawerUnderstanding.parse_status === 'done' && (
                                    <>
                                      <Button size="small" className="btn-approve" style={{ borderRadius: 6 }} onClick={async () => { try { await request.post(`/requirements/ai-understandings/${drawerUnderstanding.id}/parse-review/approve/`); await fetchList(true); message.success('已审核通过'); } catch (err: any) { message.error(err?.response?.data?.detail || '操作失败'); } }}>审核通过</Button>
                                      <Button size="small" className="btn-reject" style={{ borderRadius: 6 }} onClick={async () => { try { await request.post(`/requirements/ai-understandings/${drawerUnderstanding.id}/parse-review/reject/`); await fetchList(true); message.success('已标记不通过'); } catch (err: any) { message.error(err?.response?.data?.detail || '操作失败'); } }}>审核不通过</Button>
                                      <Button size="small" className="btn-trigger" style={{ borderRadius: 6 }} icon={<ThunderboltOutlined />} onClick={async () => { await handleTriggerGenerate(drawerUnderstanding); setDrawerUnderstanding(prev => prev ? { ...prev, status: 'processing' } : prev); setActiveTab('understand'); }}>触发理解</Button>
                                      <Button size="small" className="btn-trigger" style={{ borderRadius: 6 }} icon={<SearchOutlined />} onClick={async () => { await handleTriggerParse(drawerUnderstanding, drawerAsset.id); await fetchList(true); setDrawerUnderstanding(prev => prev ? { ...prev, parse_status: 'processing' } : prev); }}>重新解析</Button>
                                    </>
                                  )}
                                  {drawerUnderstanding.parse_status === 'processing' ? (
                                    <Button size="small" className="btn-trigger" style={{ borderRadius: 6 }} icon={<ReloadOutlined />} onClick={refreshDrawerUnderstanding}>刷新</Button>
                                  ) : (drawerUnderstanding.parse_status === 'pending' || drawerUnderstanding.parse_status === 'failed') ? (
                                    <Button size="small" className="btn-trigger" style={{ borderRadius: 6 }} icon={<SearchOutlined />} onClick={() => { handleTriggerParse(drawerUnderstanding, drawerAsset.id); }}>触发解析</Button>
                                  ) : null}
                                  {drawerUnderstanding.parse_status === 'done' && (editing ? (
                                    <>
                                      <Button size="small" className="btn-edit" style={{ borderRadius: 6 }} onClick={() => setEditing(false)}>取消</Button>
                                      <Button size="small" type="primary" className="btn-edit" style={{ borderRadius: 6, background: '#0071e3', border: 'none' }} onClick={handleSaveContent}>保存</Button>
                                    </>
                                  ) : (
                                    <Button size="small" className="btn-edit" icon={<EditOutlined />} style={{ borderRadius: 6 }} onClick={() => {
                                      if (activeTab === 'parse') {
                                        setEditContent(drawerUnderstanding?.parsed_content_with_images || drawerUnderstanding?.parsed_content || '');
                                      }
                                      setEditing(true);
                                    }}>编辑</Button>
                                  ))}
                                </Space>
                              </div>

                              {/* Error message */}
                              {drawerUnderstanding.parse_status === 'failed' && drawerUnderstanding.parse_error_msg && (
                                <div style={{ marginBottom: 12, color: '#ff3b30', fontSize: 13, padding: '8px 12px', background: 'rgba(255,59,48,0.08)', borderRadius: 6, border: '1px solid rgba(255,59,48,0.2)', flexShrink: 0 }}>失败原因：{drawerUnderstanding.parse_error_msg}</div>
                              )}

                              {/* Content area */}
                              <div style={{ flex: 1, overflow: 'auto' }}>
                                {drawerUnderstanding.parsed_content ? (
                                  editing ? (
                                    <TextArea value={editContent} onChange={e => setEditContent(e.target.value)} style={{ height: '100%', fontFamily: 'SF Mono, Monaco, Consolas, monospace', fontSize: 13, lineHeight: 1.6, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', resize: 'none' }} />
                                  ) : (
                                    <div style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', background: '#f5f5f7', padding: 6 }}>
                                      {renderParsedContent(editContent)}
                                    </div>
                                  )
                                ) : (
                                  <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>暂无解析内容</div>
                                )}
                              </div>
                            </div>
                          ),
                        },
                        {
                          key: 'understand',
                          label: <span style={{ fontSize: 14, fontWeight: 600, padding: '0 4px' }}>AI理解</span>,
                          children: (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 8px 8px' }}>
                              {/* Action row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                                <Space size={8}>
                                  <Tag color={STATUS_COLORS[drawerUnderstanding.status] || 'default'}>{drawerUnderstanding.status_display}</Tag>
                                  {drawerUnderstanding.is_selected && <Tag color="gold">最优</Tag>}
                                </Space>
                                <Space size={8}>
                                  {drawerUnderstanding.status === 'done' && (
                                    <>
                                      <Button size="small" className="btn-approve" style={{ borderRadius: 6 }} onClick={async () => { try { await request.post(`/requirements/ai-understandings/${drawerUnderstanding.id}/understanding-review/approve/`); await fetchList(true); message.success('已审核通过'); } catch (err: any) { message.error(err?.response?.data?.detail || '操作失败'); } }}>审核通过</Button>
                                      <Button size="small" className="btn-reject" style={{ borderRadius: 6 }} onClick={async () => { try { await request.post(`/requirements/ai-understandings/${drawerUnderstanding.id}/understanding-review/reject/`); await fetchList(true); message.success('已标记不通过'); } catch (err: any) { message.error(err?.response?.data?.detail || '操作失败'); } }}>审核不通过</Button>
                                      <Button size="small" className="btn-trigger" style={{ borderRadius: 6 }} icon={<ThunderboltOutlined />} onClick={async () => { await handleTriggerGenerate(drawerUnderstanding); setDrawerUnderstanding(prev => prev ? { ...prev, status: 'processing' } : prev); }}>重新理解</Button>
                                    </>
                                  )}
                                  {drawerUnderstanding.status === 'processing' ? (
                                    <Button size="small" className="btn-trigger" style={{ borderRadius: 6 }} icon={<ReloadOutlined />} onClick={refreshDrawerUnderstanding}>刷新</Button>
                                  ) : (drawerUnderstanding.status === 'pending' || drawerUnderstanding.status === 'failed') ? (
                                    <Button size="small" className="btn-trigger" style={{ borderRadius: 6 }} icon={<ThunderboltOutlined />} onClick={() => handleTriggerGenerate(drawerUnderstanding)}>触发理解</Button>
                                  ) : null}
                                  {drawerUnderstanding.status === 'done' && (editing ? (
                                    <>
                                      <Button size="small" className="btn-edit" style={{ borderRadius: 6 }} onClick={() => setEditing(false)}>取消</Button>
                                      <Button size="small" type="primary" className="btn-edit" style={{ borderRadius: 6, background: '#0071e3', border: 'none' }} onClick={handleSaveContent}>保存</Button>
                                    </>
                                  ) : (
                                    <Button size="small" className="btn-edit" icon={<EditOutlined />} style={{ borderRadius: 6 }} onClick={() => {
                                      if (activeTab === 'parse') {
                                        setEditContent(drawerUnderstanding?.parsed_content_with_images || drawerUnderstanding?.parsed_content || '');
                                      }
                                      setEditing(true);
                                    }}>编辑</Button>
                                  ))}
                                </Space>
                              </div>

                              {/* Error message */}
                              {drawerUnderstanding.status === 'failed' && drawerUnderstanding.error_msg && (
                                <div style={{ marginBottom: 12, color: '#ff3b30', fontSize: 13, padding: '8px 12px', background: 'rgba(255,59,48,0.08)', borderRadius: 6, border: '1px solid rgba(255,59,48,0.2)', flexShrink: 0 }}>失败原因：{drawerUnderstanding.error_msg}</div>
                              )}

                              {/* Content area */}
                              <div style={{ flex: 1, overflow: 'auto' }}>
                                {editing ? (
                                  <TextArea value={editContent} onChange={e => setEditContent(e.target.value)} style={{ height: '100%', fontFamily: 'SF Mono, Monaco, Consolas, monospace', fontSize: 13, lineHeight: 1.6, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', resize: 'none' }} />
                                ) : editContent ? (
                                  <div data-color-mode="light" style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', background: '#f5f5f7', padding: 6 }}>
                                    <MDEditor.Markdown source={editContent} style={{ background: 'transparent', fontSize: 14, lineHeight: 1.6 }} />
                                  </div>
                                ) : (
                                  <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>暂未生成理解</div>
                                )}
                              </div>
                            </div>
                          ),
                        },
                      ]}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* Screenshot Input Drawer */}
      <ScreenshotInputDrawer
        open={screenshotDrawerOpen}
        onClose={() => setScreenshotDrawerOpen(false)}
        requirementId={requirementId}
        understandType={understandType}
        onSaved={() => fetchList(true)}
      />
    </div>
  );
}
