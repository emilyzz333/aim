import { useState, useEffect, type ReactNode } from 'react';
import { Tabs, Tag, Button, Space, Alert, Spin, Popconfirm, Input, message, Typography, Collapse, Card, List, Select } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import request from '@/services/request';
import MDEditor from '@uiw/react-md-editor';

const { TextArea } = Input;
const { Text } = Typography;
const { Panel } = Collapse;

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

interface ParseReviewData {
  id: number;
  parse_status: string;
  parse_status_display: string;
  parse_error_msg: string;
  parsed_content: string;
  parsed_content_with_images: string;
  parse_reviewed: boolean;
  parse_reviewed_by_name: string;
  parse_reviewed_at: string;
}

interface AiReviewData {
  id: number;
  status: string;
  status_display: string;
  error_msg: string;
  ai_understanding: string;
  ai_understanding_result: {
    summary?: string;
    features?: Array<{
      name: string;
      module_name: string;
      change_type: string;
      description: string;
      priority: string;
      acceptance_criteria?: Array<{
        scenario: string;
        given: string;
        when: string;
        then: string;
      }>;
      impact_points?: string[];
      attention_points?: string[];
    }>;
    changes?: {
      added?: string[];
      modified?: string[];
      removed?: string[];
    };
    quality_issues?: Array<{
      type: string;
      feature_name?: string;
      description: string;
      severity: string;
      suggestion: string;
    }>;
    technical_design_notes?: {
      data_model_hints?: string[];
      api_hints?: string[];
      permission_hints?: string[];
      performance_hints?: string[];
      common_pitfalls?: string[];
    };
  };
  suggested_modules?: string[];
  ai_reviewed: boolean;
  ai_reviewed_by_name: string;
  ai_reviewed_at: string;
}

interface Props {
  understandingId: number;
  requirementId?: number;
  onRefresh?: () => void;
}

const PARSE_STATUS_COLOR: Record<string, string> = {
  pending: 'default', processing: 'processing', done: 'success', failed: 'error',
};
const AI_STATUS_COLOR: Record<string, string> = {
  pending: 'default', processing: 'processing', done: 'success', failed: 'error',
};
const ISSUE_TYPE_COLOR: Record<string, string> = {
  缺失: 'orange', 矛盾: 'red', 未定义: 'gold', 风险: 'volcano',
};
const SEVERITY_COLOR: Record<string, string> = {
  高: 'red', 中: 'orange', 低: 'green',
};
const SCENARIO_ICON: Record<string, string> = {
  正常流程: '✅', 异常流程: '❌', 边界情况: '⚠️',
};
const PRIORITY_COLOR: Record<string, string> = {
  P0: 'red', P1: 'orange', P2: 'blue', P3: 'default',
};
const CHANGE_TYPE_COLOR: Record<string, string> = {
  新增: 'green', 修改: 'orange', 删除: 'red', 优化: 'blue',
};

function renderFeaturesTab(result: AiReviewData['ai_understanding_result']) {
  const features = result.features || [];
  if (!features.length) return <Text type="secondary">暂无功能点</Text>;

  const groups: Record<string, typeof features> = {};
  features.forEach(f => {
    const key = f.module_name || '未知模块';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(groups).map(([moduleName, feats]) => (
        <div key={moduleName}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6, padding: '2px 0' }}>
            📁 {moduleName}
          </div>
          <Collapse
            defaultActiveKey={feats.filter(f => f.priority === 'P0').map((_, i) => String(i))}
            style={{ background: 'transparent', border: 'none' }}
          >
            {feats.map((feat, i) => (
              <Panel
                key={String(i)}
                style={{ marginBottom: 6, background: '#fff', borderRadius: 8, border: '1px solid #e5e5e7', overflow: 'hidden' }}
                header={
                  <Space size={8}>
                    <Text strong style={{ fontSize: 14 }}>{feat.name}</Text>
                    {feat.priority && <Tag color={PRIORITY_COLOR[feat.priority] || 'default'} style={{ margin: 0 }}>{feat.priority}</Tag>}
                    {feat.change_type && <Tag color={CHANGE_TYPE_COLOR[feat.change_type] || 'default'} style={{ margin: 0 }}>{feat.change_type}</Tag>}
                  </Space>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {feat.description && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>描述</Text>
                      <div style={{ fontSize: 13, color: '#333', marginTop: 2 }}>{feat.description}</div>
                    </div>
                  )}

                  {(feat.acceptance_criteria?.length || 0) > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>验收标准</Text>
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {feat.acceptance_criteria!.map((ac, j) => (
                          <div key={j} style={{ background: '#f8f8f8', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              {SCENARIO_ICON[ac.scenario] || ''} {ac.scenario}
                            </div>
                            {ac.given && <div><Text type="secondary">Given: </Text>{ac.given}</div>}
                            {ac.when && <div><Text type="secondary">When: </Text>{ac.when}</div>}
                            {ac.then && <div><Text type="secondary">Then: </Text>{ac.then}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(feat.impact_points?.length || 0) > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>影响点</Text>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                        {feat.impact_points!.map((p, j) => <li key={j} style={{ fontSize: 13 }}>{p}</li>)}
                      </ul>
                    </div>
                  )}

                  {(feat.attention_points?.length || 0) > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>注意点</Text>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                        {feat.attention_points!.map((p, j) => <li key={j} style={{ fontSize: 13, color: '#d46b08' }}>{p}</li>)}
                      </ul>
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

function renderChangesTab(result: AiReviewData['ai_understanding_result']) {
  const changes = result.changes;
  if (!changes) return <Text type="secondary">暂无变更汇总</Text>;

  const sections: Array<{ label: string; color: string; items: string[] }> = [
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
          <List
            size="small"
            dataSource={s.items}
            renderItem={item => (
              <List.Item style={{ padding: '4px 0', fontSize: 13 }}>{item}</List.Item>
            )}
          />
        </div>
      ))}
    </div>
  );
}

function renderQualityTab(result: AiReviewData['ai_understanding_result']) {
  const issues = result.quality_issues || [];
  if (!issues.length) return <Text type="secondary">未发现质量问题</Text>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {issues.map((issue, i) => (
        <Card key={i} size="small" style={{ borderRadius: 8, borderLeft: `3px solid ${issue.severity === '高' ? '#ff4d4f' : issue.severity === '中' ? '#fa8c16' : '#52c41a'}` }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              <Tag color={ISSUE_TYPE_COLOR[issue.type] || 'default'}>{issue.type}</Tag>
              <Tag color={SEVERITY_COLOR[issue.severity] || 'default'}>严重度：{issue.severity}</Tag>
              {issue.feature_name && <Text type="secondary" style={{ fontSize: 12 }}>关联功能：{issue.feature_name}</Text>}
            </Space>
            <Text style={{ fontSize: 13 }}>{issue.description}</Text>
            {issue.suggestion && (
              <div style={{ background: '#fffbe6', padding: '4px 8px', borderRadius: 4, fontSize: 12, color: '#614700' }}>
                建议：{issue.suggestion}
              </div>
            )}
          </Space>
        </Card>
      ))}
    </div>
  );
}

function renderTechnicalTab(result: AiReviewData['ai_understanding_result']) {
  const notes = result.technical_design_notes;
  if (!notes) return <Text type="secondary">暂无技术注意事项</Text>;

  const sections: Array<{ label: string; icon: string; items: string[] | undefined }> = [
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
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {s.items!.map((item, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.7 }}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AiUnderstandingReviewPanel({ understandingId, requirementId, onRefresh }: Props) {
  const [parseData, setParseData] = useState<ParseReviewData | null>(null);
  const [aiData, setAiData] = useState<AiReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState('parse');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  const fetchParseReview = async () => {
    setLoading(true);
    try {
      const res = await request.get(`/requirements/ai-understandings/${understandingId}/parse-review/`);
      setParseData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiReview = async () => {
    setLoading(true);
    try {
      const res = await request.get(`/requirements/ai-understandings/${understandingId}/understanding-review/`);
      setAiData(res.data);
      if (res.data.suggested_modules?.length) {
        setSelectedModules(res.data.suggested_modules);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'parse' && !parseData) fetchParseReview();
    if (key === 'ai' && !aiData) fetchAiReview();
  };

  useEffect(() => {
    fetchParseReview();
  }, [understandingId]);

  const approveParseReview = async () => {
    try {
      await request.post(`/requirements/ai-understandings/${understandingId}/parse-review/approve/`);
      message.success('解析内容已批准，AI 理解任务已触发');
      fetchParseReview();
      onRefresh?.();
    } catch {
      message.error('操作失败');
    }
  };

  const rejectParseReview = async () => {
    try {
      await request.post(`/requirements/ai-understandings/${understandingId}/parse-review/reject/`, { reason: rejectReason });
      message.success('已拒绝，重新解析任务已触发');
      setRejectReason('');
      fetchParseReview();
    } catch {
      message.error('操作失败');
    }
  };

  const approveAiReview = async () => {
    try {
      await request.post(`/requirements/ai-understandings/${understandingId}/understanding-review/approve/`);
      message.success('AI 理解已批准');
      fetchAiReview();
      onRefresh?.();
    } catch {
      message.error('操作失败');
    }
  };

  const rejectAiReview = async () => {
    try {
      await request.post(`/requirements/ai-understandings/${understandingId}/understanding-review/reject/`, { reason: rejectReason });
      message.success('已拒绝，重新生成任务已触发');
      setRejectReason('');
      fetchAiReview();
    } catch {
      message.error('操作失败');
    }
  };

  const confirmModules = async () => {
    if (!requirementId) {
      message.error('缺少需求 ID');
      return;
    }
    try {
      await request.post(`/requirements/requirements/${requirementId}/confirm-modules/`, { module_names: selectedModules });
      message.success('模块确认成功');
      onRefresh?.();
    } catch {
      message.error('模块确认失败');
    }
  };

  const tabItems = [
    {
      key: 'parse',
      label: '解析内容审核',
      children: (
        <Spin spinning={loading}>
          {!parseData ? (
            <div style={{ padding: 24, color: '#999', textAlign: 'center' }}>加载中...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Space>
                <Text type="secondary">解析状态：</Text>
                <Tag color={PARSE_STATUS_COLOR[parseData.parse_status]}>{parseData.parse_status_display}</Tag>
                {parseData.parse_reviewed && (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    已审核 · {parseData.parse_reviewed_by_name} · {parseData.parse_reviewed_at?.slice(0, 16)}
                  </Tag>
                )}
              </Space>

              {parseData.parse_error_msg && (
                <Alert type="error" message={parseData.parse_error_msg} />
              )}

              <Tabs
                size="small"
                items={[
                  {
                    key: 'text',
                    label: '纯文本内容',
                    children: (
                      <div data-color-mode="light">
                        <MDEditor.Markdown source={parseData.parsed_content || '（暂无内容）'} />
                      </div>
                    ),
                  },
                  {
                    key: 'with_images',
                    label: '含图片识别',
                    children: (
                      <div>
                        {renderParsedContent(parseData.parsed_content_with_images || '（暂无内容）')}
                      </div>
                    ),
                  },
                ]}
              />

              {!parseData.parse_reviewed && parseData.parse_status === 'done' && (
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                  <TextArea
                    placeholder="拒绝原因（可选）"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={2}
                    style={{ marginBottom: 8, borderRadius: 8 }}
                  />
                  <Space>
                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={approveParseReview}
                      style={{ borderRadius: 980, background: '#0071e3' }}>
                      批准解析内容
                    </Button>
                    <Popconfirm title="确认拒绝并重新解析？" onConfirm={rejectParseReview}>
                      <Button danger icon={<CloseCircleOutlined />} style={{ borderRadius: 8 }}>
                        拒绝并重新解析
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              )}
            </div>
          )}
        </Spin>
      ),
    },
    {
      key: 'ai',
      label: 'AI 理解审核',
      children: (
        <Spin spinning={loading}>
          {!aiData ? (
            <Button onClick={fetchAiReview} icon={<ReloadOutlined />}>加载 AI 理解</Button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Space>
                <Text type="secondary">理解状态：</Text>
                <Tag color={AI_STATUS_COLOR[aiData.status]}>{aiData.status_display}</Tag>
                {aiData.ai_reviewed && (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    已审核 · {aiData.ai_reviewed_by_name} · {aiData.ai_reviewed_at?.slice(0, 16)}
                  </Tag>
                )}
              </Space>

              {aiData.error_msg && <Alert type="error" message={aiData.error_msg} />}

              {aiData.ai_understanding_result?.summary && (
                <Card size="small" style={{ background: '#f5f5f7', borderRadius: 12, border: '1px solid #e5e5e7' }}>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text strong style={{ fontSize: 15 }}>📋 {aiData.ai_understanding_result.summary}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>功能总数：{aiData.ai_understanding_result.features?.length || 0}</Text>
                  </Space>
                </Card>
              )}

              {(aiData.suggested_modules?.length || 0) > 0 && (
                <Card size="small" style={{ borderRadius: 10, border: '1px solid #e5e5e7' }}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Text strong style={{ fontSize: 13 }}>🏷️ AI 建议模块关联</Text>
                    <Select
                      mode="tags"
                      style={{ width: '100%' }}
                      value={selectedModules}
                      onChange={setSelectedModules}
                      options={aiData.suggested_modules!.map(m => ({ label: m, value: m }))}
                      placeholder="选择或输入模块路径"
                    />
                    <Button size="small" type="default" onClick={confirmModules} style={{ borderRadius: 6 }}>
                      确认模块关联
                    </Button>
                  </Space>
                </Card>
              )}

              {aiData.ai_understanding_result && (
                <Tabs size="small" items={[
                  { key: 'features', label: '功能列表', children: renderFeaturesTab(aiData.ai_understanding_result) },
                  { key: 'changes', label: '变更汇总', children: renderChangesTab(aiData.ai_understanding_result) },
                  {
                    key: 'reference',
                    label: <span style={{ color: '#999' }}>参考信息</span>,
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Alert
                          type="info"
                          showIcon
                          message="以下内容由 AI 推断生成，仅供参考，请结合实际需求判断"
                          style={{ borderRadius: 8 }}
                        />
                        <div>
                          <Text strong style={{ fontSize: 14, color: '#666' }}>质量问题预判</Text>
                          <div style={{ marginTop: 8 }}>{renderQualityTab(aiData.ai_understanding_result)}</div>
                        </div>
                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                          <Text strong style={{ fontSize: 14, color: '#666' }}>技术注意事项</Text>
                          <div style={{ marginTop: 8 }}>{renderTechnicalTab(aiData.ai_understanding_result)}</div>
                        </div>
                      </div>
                    ),
                  },
                  { key: 'raw', label: '原始输出', children: (<div data-color-mode="light"><MDEditor.Markdown source={aiData.ai_understanding || '（暂无内容）'} /></div>) },
                ]} />
              )}

              {!aiData.ai_reviewed && aiData.status === 'done' && (
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                  <TextArea
                    placeholder="拒绝原因（可选）"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={2}
                    style={{ marginBottom: 8, borderRadius: 8 }}
                  />
                  <Space>
                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={approveAiReview} style={{ borderRadius: 980, background: '#0071e3' }}>
                      批准 AI 理解
                    </Button>
                    <Popconfirm title="确认拒绝并重新生成？" onConfirm={rejectAiReview}>
                      <Button danger icon={<CloseCircleOutlined />} style={{ borderRadius: 8 }}>
                        拒绝并重新生成
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              )}
            </div>
          )}
        </Spin>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 24px', background: '#f5f5f7', minHeight: '100vh' }}>
      <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} />
    </div>
  );
}
