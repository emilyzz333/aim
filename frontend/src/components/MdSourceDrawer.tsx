import { useState, useEffect } from 'react';
import { Drawer, Button, Tag, Space, Spin, Image, Empty, Modal } from 'antd';
import { ArrowRightOutlined, LinkOutlined, FileOutlined, SyncOutlined, DeleteOutlined } from '@ant-design/icons';
import { message } from 'antd';
import request from '@/services/request';
import { useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';

interface MdSourceDrawerProps {
  requirementId: number;
  requirementName: string;
  mdType: 'req_md' | 'tech_md' | 'ui_design' | 'ui_design_web' | 'ui_design_app';
  open: boolean;
  onClose: () => void;
}

const TAB_KEY_MAP: Record<string, string> = {
  req_md: 'requirement_md',
  tech_md: 'technical_md',
  ui_design: 'ui_design',
  ui_design_web: 'ui_design',
  ui_design_app: 'ui_design',
};

interface InputAsset {
  id: number;
  source_type: string;
  source_type_display: string;
  batch_desc: string;
  file_paths: { source_files: string[]; images: string[] } | string[];
  text_content: string;
  is_selected: boolean;
  updated_at: string;
}

const SOURCE_COLORS: Record<string, string> = {
  url_fetch: 'orange',
  upload_file: 'cyan',
  ai_conversation: 'purple',
  gitlab_pull: 'green',
};

const isImage = (path: string) => /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(path);

function RawTextWithImages({ text, images }: { text: string; images: string[] }) {
  const parts = text.split(/(\[图片\d+\])/g);
  return (
    <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.47 }}>
      {parts.map((part, i) => {
        const m = part.match(/^\[图片(\d+)\]$/);
        if (m) {
          const idx = parseInt(m[1], 10) - 1;
          const imgPath = images[idx];
          if (imgPath) return <Image key={i} src={toAssetUrl(imgPath)} style={{ maxWidth: '100%', borderRadius: 4, margin: '4px 0' }} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
const isRemoteUrl = (path: string) => /^https?:\/\//i.test(path);
const toAssetUrl = (path: string) => {
  if (!path) return '';
  if (isRemoteUrl(path)) return path;
  return `/media/${path.replace(/^\/+/, '').replace(/\\/g, '/')}`;
};

export default function MdSourceDrawer({ requirementId, requirementName, mdType, open, onClose }: MdSourceDrawerProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<InputAsset[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [refetching, setRefetching] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadAssets = () => {
    setLoading(true);
    request.get('/requirements/ai-input-assets/', {
      params: { requirement: requirementId, type: mdType },
    }).then((res) => {
      const list = res.data?.results || res.data || [];
      setAssets(list);
      const selectedIdx = list.findIndex((r: InputAsset) => r.is_selected);
      setCurrentIdx(selectedIdx >= 0 ? selectedIdx : 0);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    loadAssets();
  }, [open, requirementId, mdType]);

  const current = assets[currentIdx];
  const getImages = (asset: InputAsset): string[] => {
    const fp = asset.file_paths;
    if (Array.isArray(fp)) return fp;
    return fp?.images || [];
  };
  const matchedFiles = current ? getImages(current) : [];
  const rawText = current?.text_content || '';
  const sourceUrl = current?.batch_desc || '';

  const handleGoDetail = () => {
    onClose();
    navigate(`/requirements/${requirementId}?tab=${TAB_KEY_MAP[mdType]}`);
  };

  const handleRefetch = async () => {
    if (!current) return;
    setRefetching(true);
    try {
      const res = await request.post(`/requirements/ai-input-assets/${current.id}/refetch/`);
      setAssets(prev => prev.map((a, i) => i === currentIdx ? res.data : a));
      message.success('内容已更新');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '抓取失败');
    } finally {
      setRefetching(false);
    }
  };

  const handleDelete = () => {
    if (!current) return;
    Modal.confirm({
      title: '确认删除',
      content: '删除该记录将删除对应的AI解析和AI理解，确认删除吗？',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setDeleting(true);
        try {
          await request.delete(`/requirements/ai-input-assets/${current.id}/`);
          const newAssets = assets.filter((_, i) => i !== currentIdx);
          setAssets(newAssets);
          setCurrentIdx(Math.max(0, currentIdx - 1));
          message.success('已删除');
        } catch (err: any) {
          message.error(err?.response?.data?.detail || '删除失败');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleSelect = async () => {
    if (!current) return;
    try {
      const res = await request.patch(`/requirements/ai-input-assets/${current.id}/select/`);
      setAssets(prev => prev.map((a, i) => i === currentIdx ? res.data : { ...a, is_selected: false }));
      message.success('已设为最优');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败');
    }
  };

  return (
    <Drawer
      title={null}
      open={open}
      onClose={onClose}
      width={1200}
      styles={{
        body: {
          padding: 0,
          background: '#f5f5f7',
        }
      }}
      closable={false}
    >
      <div style={{ padding: '48px' }}>
        {/* 顶部标题栏 */}
        <div style={{
          padding: '32px 48px',
          background: '#ffffff',
          borderRadius: '12px',
          marginBottom: '32px',
          boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 12px 0px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
            <div>
              <h1 style={{
                fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                fontSize: '28px',
                fontWeight: 600,
                lineHeight: 1.14,
                color: '#1d1d1f',
                marginBottom: '6px',
                letterSpacing: '0.196px',
              }}>
                {mdType === 'req_md' ? '需求文件' : mdType === 'tech_md' ? '技术文件' : mdType === 'ui_design_web' ? 'UI设计稿-Web' : mdType === 'ui_design_app' ? 'UI设计稿-App' : 'UI设计稿'}
              </h1>
              <p style={{
                fontSize: '15px',
                fontWeight: 400,
                lineHeight: 1.47,
                color: 'rgba(0, 0, 0, 0.6)',
                marginBottom: 0,
                fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
              }}>
                {requirementName}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={handleGoDetail}
                style={{
                  height: '44px',
                  padding: '0 24px',
                  fontSize: '15px',
                }}
              >
                AI理解生成/查看
              </Button>
              <Button
                type="text"
                icon={<span style={{ fontSize: '20px' }}>×</span>}
                onClick={onClose}
                style={{
                  color: 'rgba(0, 0, 0, 0.48)',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  padding: 0,
                }}
              />
            </div>
          </div>
        </div>

      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          background: '#f5f5f7',
        }}>
          <Spin size="large" />
        </div>
      ) : assets.length === 0 ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          background: '#f5f5f7',
        }}>
          <Empty
            description={
              <span style={{
                color: 'rgba(0, 0, 0, 0.48)',
                fontSize: '15px',
                fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
              }}>
                暂无内容
              </span>
            }
          />
        </div>
      ) : (
        <>
          {/* 来源切换标签 */}
          {assets.length > 1 && (
            <div style={{
              padding: '20px 24px',
              background: '#ffffff',
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 12px 0px',
            }}>
              <div style={{
                fontSize: '14px',
                color: 'rgba(0, 0, 0, 0.6)',
                marginBottom: '12px',
                fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
              }}>
                切换文件
              </div>
              <Space wrap size={[8, 8]}>
                {assets.map((a, i) => (
                  <Tag
                    key={a.id}
                    style={{
                      cursor: 'pointer',
                      padding: '6px 16px',
                      fontSize: '14px',
                      borderRadius: '16px',
                      border: i === currentIdx ? 'none' : '1px solid rgba(0, 0, 0, 0.1)',
                      background: i === currentIdx ? '#0071e3' : '#ffffff',
                      color: i === currentIdx ? '#ffffff' : 'rgba(0, 0, 0, 0.8)',
                      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                    }}
                    onClick={() => setCurrentIdx(i)}
                  >
                    {a.is_selected && '★ '}
                    {a.source_type_display}
                  </Tag>
                ))}
              </Space>
            </div>
          )}

          {current && (
            <div style={{
              minHeight: 'calc(100vh - 200px)',
            }}>
              {/* 元信息卡片 */}
              <div style={{
                marginBottom: 32,
                padding: '20px 24px',
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 12px 0px',
              }}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Space wrap size={[12, 8]}>
                    <Tag color={SOURCE_COLORS[current.source_type] || 'default'} style={{ fontSize: '13px', padding: '4px 12px' }}>
                      {current.source_type_display}
                    </Tag>
                    {current.is_selected && (
                      <Tag color="gold" style={{ fontSize: '13px', padding: '4px 12px' }}>
                        ★ 最优
                      </Tag>
                    )}
                    <span style={{
                      color: 'rgba(0, 0, 0, 0.48)',
                      fontSize: '13px',
                      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                    }}>
                      {current.updated_at?.slice(0, 16)}
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      {!current.is_selected && (
                        <Button size="small" onClick={handleSelect}>设为最优</Button>
                      )}
                      <Button size="small" danger icon={<DeleteOutlined />} loading={deleting} onClick={handleDelete}>删除</Button>
                    </div>
                  </Space>

                  {/* 文件列表 */}
                  {matchedFiles.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {matchedFiles.map((path, i) => {
                          const url = toAssetUrl(path);
                          const fileName = path.split('/').pop() || path;
                          return isImage(path) ? (
                            <Image
                              key={i}
                              src={url}
                              width={120}
                              height={120}
                              style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0, 0, 0, 0.1)' }}
                            />
                          ) : (
                            <a
                              key={i}
                              href={url}
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
                                fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                                fontSize: '14px',
                                transition: 'all 0.2s ease',
                                background: '#f5f5f7',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 113, 227, 0.08)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f5f5f7';
                              }}
                            >
                              <FileOutlined style={{ flexShrink: 0 }} />
                              <span>{fileName}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 链接 */}
                  {current.source_type === 'url_fetch' && sourceUrl && (
                    <div>
                      <a
                        href={sourceUrl}
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
                          fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                          background: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          wordBreak: 'break-all',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 113, 227, 0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f5f5f7'; }}
                      >
                        <LinkOutlined style={{ flexShrink: 0 }} />
                        <span>{sourceUrl}</span>
                      </a>
                    </div>
                  )}
                </Space>
              </div>

              <div style={{
                marginBottom: 32,
                padding: '24px',
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 12px 0px',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <h3 style={{
                    fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                    fontSize: '21px',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    margin: 0,
                    letterSpacing: '0.231px',
                  }}>原始内容</h3>
                  {current.source_type === 'url_fetch' && (
                    <Button
                      size="small"
                      icon={<SyncOutlined />}
                      loading={refetching}
                      onClick={handleRefetch}
                    >
                      更新抓取内容
                    </Button>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.47,
                    maxHeight: '600px',
                    overflow: 'auto',
                    background: '#f5f5f7',
                    padding: 20,
                    borderRadius: 8,
                    color: '#1d1d1f',
                    fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                  }}
                >
                  {rawText ? (
                    current.source_type === 'url_fetch' ? (
                      <MDEditor.Markdown source={rawText} style={{ background: 'transparent', fontSize: '14px' }} />
                    ) : (
                      <RawTextWithImages text={rawText} images={matchedFiles} />
                    )
                  ) : (
                    <span style={{ color: 'rgba(0, 0, 0, 0.48)' }}>（无内容）</span>
                  )}
                </div>
              </div>

              {rawText && current.source_type === 'ai_conversation' && (
                <div style={{
                  marginBottom: 32,
                  padding: '24px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 12px 0px',
                }}>
                  <h3 style={{
                    fontFamily: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                    fontSize: '21px',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    marginBottom: '16px',
                    letterSpacing: '0.231px',
                  }}>AI 回复</h3>
                  <div style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: '14px',
                    lineHeight: 1.47,
                    background: '#f5f5f7',
                    padding: 16,
                    borderRadius: 8,
                    color: '#1d1d1f',
                    fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
                  }}>
                    {rawText}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </Drawer>
  );
}
