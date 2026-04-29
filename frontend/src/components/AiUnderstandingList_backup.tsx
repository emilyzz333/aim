import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Tag, Button, Drawer, Input, Space, Popconfirm, message, Modal, Dropdown, Tooltip, Collapse, Tabs } from 'antd';
import type { MenuProps } from 'antd';
import {
  EditOutlined, DeleteOutlined, ReloadOutlined, ThunderboltOutlined,
  FileOutlined, LinkOutlined, MessageOutlined, SyncOutlined, DownOutlined,
  AuditOutlined, SearchOutlined, MoreOutlined, RightOutlined,
} from '@ant-design/icons';
import request from '@/services/request';
import MDEditor from '@uiw/react-md-editor';
import AiUnderstandingReviewPanel from './AiUnderstandingReviewPanel';

const { TextArea } = Input;
const { Panel } = Collapse;

interface UnderstandingSummary {
  id: number;
  status: string;
  status_display: string;
  parse_status: string;
  parse_status_display: string;
  is_selected: boolean;
  ai_understanding: string | null;
  parsed_content: string | null;
  parse_reviewed: boolean;
  ai_reviewed: boolean;
  error_msg: string | null;
  parse_error_msg: string | null;
  note: string | null;
  updated_at: string | null;
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
  gitlab_pull: 'green',
};

const isRemoteUrl = (p: string) => /^https?:\/\//i.test(p);
const toAssetUrl = (p: string) => {
  if (!p) return '';
  if (isRemoteUrl(p)) return p;
  return `/media/${p.replace(/^\/+/, '').replace(/\\/g, '/')}`;
};
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
  const [refetching, setRefetching] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('parse');

  // Review modal
  const [reviewModalId, setReviewModalId] = useState<number | null>(null);

  // Single-shot refresh timer ref
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await request.get('/requirements/ai-input-assets/', {
        params: { requirement: requirementId, type: understandType },
      });
      const newList: InputAsset[] = res.data?.results || res.data || [];
      setList(newList);
    } catch { /* ignore */ }
    if (!quiet) setLoading(false);
  }, [requirementId, understandType]);

  useEffect(() => { fetchList(); }, [fetchList, refreshKey]);

  // Schedule a single delayed refresh after triggering a task
  const scheduleRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => fetchList(true), 5000);
  };

  // ─── Asset (first layer) actions ──────────────────────────────────────────

  const handleTriggerParseForAsset = async (asset: InputAsset) => {
    try {
      const res = await request.post(`/requirements/ai-input-assets/${asset.id}/trigger-parse/`);
      setList(prev => prev.map(a => a.id === asset.id ? res.data : a));
      message.success('已触发AI解析，请稍后刷新查看进度');
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
      const res = await request.post(`/requirements/ai-input-assets/${asset.id}/trigger-generate/`);
      setList(prev => prev.map(a => a.id === asset.id ? res.data : a));
      message.success('已触发AI理解生成，请稍后刷新查看进度');
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
      message.success('已触发解析，请稍后刷新查看进度');
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
    setEditContent(u.ai_understanding || '');
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
      await request.patch(`/requirements/ai-understandings/${drawerUnderstanding.id}/`, { ai_understanding: editContent });
      await fetchList(true);
      setEditing(false);
      message.success('内容已保存');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存失败');
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
      width: 80,
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
      width: '35%',
      render: (_: any, row: FlatRow) => {
        if (row.rowSpan === 0) return { children: null, props: { rowSpan: 0 } };
        const label = row.asset.batch_desc || row.asset.source_type_display;

        const assetMenuItems: MenuProps['items'] = [
          {
            key: 'parse',
            label: <span style={{ color: '#0071e3' }}>AI解析</span>,
            icon: <span style={{ color: '#0071e3', fontSize: 16, fontWeight: 500 }}>+</span>,
            onClick: () => handleTriggerParseForAsset(row.asset),
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
            label: (
              <Popconfirm
                title="删除该记录将同时删除所有关联的AI解析和AI理解，确认删除吗？"
                okText="确认删除"
                okType="danger"
                cancelText="取消"
                onConfirm={() => handleDeleteAsset(row.asset.id)}
              >
                <span>删除</span>
              </Popconfirm>
            ),
            icon: <DeleteOutlined />,
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
      width: '26%',
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
      width: '28%',
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
      width: 130,
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
      width: 110,
      render: (_: any, row: FlatRow) => {
        const time = row.understanding?.updated_at || row.asset.updated_at;
        return <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', whiteSpace: 'nowrap' }}>{time?.slice(0, 16).replace('T', ' ') || ''}</span>;
      },
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, row: FlatRow) => {
        if (!row.understanding) return null;
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
      `}</style>

      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
          文件列表（含AI解析/理解记录）
        </div>
        <Button size="small" icon={<SyncOutlined />} onClick={() => fetchList()}>
          刷新状态
        </Button>
      </div>

      <Table
        dataSource={flattenData()}
        columns={mergedColumns}
        rowKey="key"
        size="small"
        loading={loading}
        pagination={false}
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
        title={drawerUnderstanding ? 'AI理解详情' : '素材详情'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={1200}
        destroyOnClose
        styles={{ body: { background: '#f5f5f7', padding: 0 } }}
      >
        {drawerAsset && (
          <div style={{ padding: '24px 32px' }}>
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
                </div>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1d1d1f',
                    marginBottom: 12,
                    letterSpacing: '-0.224px'
                  }}>原始内容</div>
                  <div style={{
                    whiteSpace: 'pre-wrap',
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
                    {drawerAsset.text_content || '暂无内容'}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Understanding Detail */}
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
                  }}>备注</div>
                  <TextArea
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    rows={2}
                    placeholder="添加备注..."
                    style={{
                      fontSize: 14,
                      lineHeight: 1.47,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.12)'
                    }}
                  />
                  <Button
                    type="primary"
                    style={{
                      marginTop: 12,
                      background: '#0071e3',
                      borderRadius: 8,
                      height: 36,
                      fontSize: 14,
                      fontWeight: 400,
                      border: 'none'
                    }}
                    onClick={handleSaveNote}
                  >
                    保存备注
                  </Button>
                </div>

                <div style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12
                  }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1d1d1f',
                      letterSpacing: '-0.224px'
                    }}>AI理解</div>
                    {editing ? (
                      <Space size={8}>
                        <Button
                          onClick={() => setEditing(false)}
                          style={{
                            borderRadius: 8,
                            height: 32,
                            fontSize: 14,
                            border: '1px solid rgba(0,0,0,0.12)'
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          type="primary"
                          onClick={handleSaveContent}
                          style={{
                            background: '#0071e3',
                            borderRadius: 8,
                            height: 32,
                            fontSize: 14,
                            border: 'none'
                          }}
                        >
                          保存
                        </Button>
                      </Space>
                    ) : (
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => setEditing(true)}
                        style={{
                          borderRadius: 8,
                          height: 32,
                          fontSize: 14,
                          border: '1px solid rgba(0,0,0,0.12)'
                        }}
                      >
                        编辑
                      </Button>
                    )}
                  </div>

                  {editing ? (
                    <TextArea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={16}
                      style={{
                        fontFamily: 'SF Mono, Monaco, Consolas, monospace',
                        fontSize: 13,
                        lineHeight: 1.6,
                        borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.12)'
                      }}
                    />
                  ) : (
                    editContent ? (
                      <div style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: 14,
                        lineHeight: 1.47,
                        color: '#1d1d1f',
                        letterSpacing: '-0.224px',
                        background: '#f5f5f7',
                        padding: 16,
                        borderRadius: 8,
                        maxHeight: 'calc(100vh - 400px)',
                        overflow: 'auto',
                        border: '1px solid rgba(0,0,0,0.06)'
                      }}>
                        {editContent}
                      </div>
                    ) : (
                      <div style={{
                        color: 'rgba(0,0,0,0.48)',
                        fontSize: 14,
                        padding: 16,
                        textAlign: 'center'
                      }}>
                        暂未生成理解
                      </div>
                    )
                  )}

                  {drawerUnderstanding.status === 'failed' && drawerUnderstanding.error_msg && (
                    <div style={{
                      marginTop: 12,
                      color: '#ff3b30',
                      fontSize: 13,
                      padding: '8px 12px',
                      background: 'rgba(255,59,48,0.08)',
                      borderRadius: 6,
                      border: '1px solid rgba(255,59,48,0.2)'
                    }}>
                      失败原因：{drawerUnderstanding.error_msg}
                    </div>
                  )}

                  <div style={{
                    marginTop: 20,
                    paddingTop: 20,
                    borderTop: '1px solid rgba(0,0,0,0.06)'
                  }}>
                    <AiUnderstandingReviewPanel
                      understandingId={drawerUnderstanding.id}
                      onRefresh={fetchList}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
