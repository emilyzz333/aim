import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  Tabs, Card, Form, Input, Button, Select, Table, message,
  Space, Alert, Tag, Checkbox, DatePicker, Collapse, Badge,
  Spin, Tooltip, Divider, Switch,
} from 'antd';
import {
  SyncOutlined, RobotOutlined, GithubOutlined, LinkOutlined, CheckCircleOutlined,
  BugOutlined, CheckSquareOutlined, FileTextOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import request from '@/services/request';

const { RangePicker } = DatePicker;
const { Panel } = Collapse;

// ─────────────────────────────
// 类型定义
// ─────────────────────────────
interface TapdItem {
  tapd_id: string;
  name: string;
  type: string;
  status: string;
  priority: string;
  created: string;
  modified: string;
  creator: string;
  story_id?: string;
}

interface TapdIteration {
  tapd_id: string;
  name: string;
  status: string;
  begin_date: string;
  end_date: string;
  created: string;
  modified: string;
  requirements: TapdItem[];
  tasks: TapdItem[];
  bugs: TapdItem[];
}

interface PreviewResult {
  iterations: TapdIteration[];
  unassigned: TapdItem[];
}

// ─────────────────────────────
// 辅助组件：迭代内数据表格
// ─────────────────────────────
const typeIconMap: Record<string, React.ReactNode> = {
  product: <FileTextOutlined style={{ color: '#1677ff' }} />,
  requirement: <FileTextOutlined style={{ color: '#1677ff' }} />,
  task: <CheckSquareOutlined style={{ color: '#52c41a' }} />,
  bug: <BugOutlined style={{ color: '#ff4d4f' }} />,
};
const typeTagMap: Record<string, { color: string; label: string }> = {
  product: { color: 'blue', label: '需求' },
  requirement: { color: 'blue', label: '需求' },
  task: { color: 'green', label: '任务' },
  bug: { color: 'red', label: '缺陷' },
};
const priorityMap: Record<string, { color: string; label: string }> = {
  '1': { color: 'red', label: '紧急' },
  '2': { color: 'orange', label: '高' },
  '3': { color: 'blue', label: '中' },
  '4': { color: 'default', label: '低' },
  'High': { color: 'orange', label: '高' },
  'Medium': { color: 'blue', label: '中' },
  'Low': { color: 'default', label: '低' },
};

const ItemTable = ({
  items, selectedIds, onSelect,
}: {
  items: TapdItem[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}) => {
  if (!items.length) return null;
  return (
    <Table
      dataSource={items}
      rowKey="tapd_id"
      size="small"
      pagination={false}
      rowSelection={{
        selectedRowKeys: selectedIds,
        onChange: (keys) => onSelect(keys as string[]),
      }}
      columns={[
        {
          title: '类型', dataIndex: 'type', key: 'type', width: 70,
          render: (t: string) => <Tag color={typeTagMap[t]?.color}>{typeTagMap[t]?.label ?? t}</Tag>,
        },
        {
          title: '标题', dataIndex: 'name', key: 'name', ellipsis: true,
          render: (name: string, rec: TapdItem) => (
            <Space size={4}>{typeIconMap[rec.type]}<span>{name}</span></Space>
          ),
        },
        {
          title: '优先级', dataIndex: 'priority', key: 'priority', width: 70,
          render: (p: string) => p ? <Tag color={priorityMap[p]?.color}>{priorityMap[p]?.label ?? p}</Tag> : '-',
        },
        { title: '状态', dataIndex: 'status', key: 'status', width: 90, ellipsis: true },
        { title: '创建人', dataIndex: 'creator', key: 'creator', width: 100, ellipsis: true },
        { title: '创建时间', dataIndex: 'created', key: 'created', width: 150, ellipsis: true },
        { title: '更新时间', dataIndex: 'modified', key: 'modified', width: 150, ellipsis: true },
      ]}
    />
  );
};

// ─────────────────────────────
// TAPD 集成 Tab
// ─────────────────────────────
const TAPDTab = () => {
  const now = dayjs();
  const [loading, setLoading] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState<'month' | 'twoMonths' | 'quarter' | 'year' | 'custom' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [dataTypes, setDataTypes] = useState<string[]>(['iteration', 'requirement', 'bug']);
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selectedIterIds, setSelectedIterIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [cascadeSync, setCascadeSync] = useState(false);

  // 获取快捷操作的时间范围
  const getMonthRange = () => ({ start: now.startOf('month').format('YYYY-MM-DD'), end: now.endOf('month').format('YYYY-MM-DD') });
  const getRecentTwoMonthsRange = () => ({
    start: now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
    end: now.endOf('month').format('YYYY-MM-DD'),
  });
  const getRecentThreeMonthsRange = () => ({
    start: now.subtract(2, 'month').startOf('month').format('YYYY-MM-DD'),
    end: now.endOf('month').format('YYYY-MM-DD'),
  });
  const getYearRange = () => ({ start: now.startOf('year').format('YYYY-MM-DD'), end: now.endOf('year').format('YYYY-MM-DD') });

  const handleFetch = async (time_range: { start: string; end: string }, btnType: 'month' | 'twoMonths' | 'quarter' | 'year' | 'custom') => {
    if (!dataTypes.length) { message.warning('请至少选择一种数据类型'); return; }
    setLoading(true);
    setLoadingBtn(btnType);
    setPreview(null);
    setSelectedIterIds([]);
    setSelectedItemIds([]);
    message.loading({ content: '拉取数据预览获取中...', key: 'fetching', duration: 0 });
    try {
      const res = await request.post('/integrations/tapd/batch-sync/', {
        time_range,
        data_types: dataTypes,
        preview_only: true,
      });
      setPreview(res.data);
      const totalItems = (res.data.iterations?.length || 0) +
        res.data.iterations?.reduce((s: number, it: TapdIteration) => s + it.requirements.length + it.tasks.length + it.bugs.length, 0) +
        (res.data.unassigned?.length || 0);
      message.destroy('fetching');
      if (totalItems === 0) message.info('该时间范围内暂无数据');
      else message.success(`成功拉取 ${totalItems} 条数据`);
    } catch (e: any) {
      message.destroy('fetching');
      message.error(e.response?.data?.detail || '拉取失败');
    } finally {
      setLoading(false);
      setLoadingBtn(null);
    }
  };

  const handleAdvancedFetch = () => {
    if (!customRange) { message.warning('请选择时间范围'); return; }
    handleFetch({ start: customRange[0].format('YYYY-MM-DD'), end: customRange[1].format('YYYY-MM-DD') }, 'custom');
  };

  const handleSync = async () => {
    if (!selectedIterIds.length && !selectedItemIds.length) {
      message.warning('请选择要同步的数据');
      return;
    }
    setSyncing(true);
    try {
      // 从预览数据中构建 tapd_id → type 查找表
      const itemTypeMap = new Map<string, string>();
      if (preview) {
        for (const it of preview.iterations) {
          for (const r of it.requirements) itemTypeMap.set(r.tapd_id, 'requirement');
          for (const t of it.tasks) itemTypeMap.set(t.tapd_id, 'task');
          for (const b of it.bugs) itemTypeMap.set(b.tapd_id, 'bug');
        }
        for (const item of preview.unassigned) {
          itemTypeMap.set(item.tapd_id, item.type);
        }
      }

      // 按类型分组选中的 IDs
      const storyIds = selectedItemIds.filter((id) => itemTypeMap.get(id) === 'requirement');
      const taskIds = selectedItemIds.filter((id) => itemTypeMap.get(id) === 'task');
      const bugIds = selectedItemIds.filter((id) => itemTypeMap.get(id) === 'bug');

      const res = await request.post('/integrations/tapd/execute-sync/', {
        selected_items: {
          iterations: selectedIterIds,
          stories: storyIds,
          tasks: taskIds,
          bugs: bugIds,
        },
        cascade: cascadeSync,
      });
      message.success(res.data.message);
      if (res.data.errors?.length) {
        message.warning(`${res.data.errors.length} 条数据同步失败，请查看控制台`);
        console.error('同步错误:', res.data.errors);
      }
    } catch (e: any) {
      message.error(e.response?.data?.detail || '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 统计已选数量
  const selectedIterCount = selectedIterIds.length;
  const selectedItemCount = selectedItemIds.length;

  // 所有预览数据的 item ids（拆分需求/任务和缺陷）
  const allRequirementIds = preview
    ? [
        ...preview.iterations.flatMap((it) => [...it.requirements, ...it.tasks].map((r) => r.tapd_id)),
        ...preview.unassigned.filter((r) => r.type !== 'bug').map((r) => r.tapd_id),
      ]
    : [];
  const allBugIds = preview
    ? [
        ...preview.iterations.flatMap((it) => it.bugs.map((b) => b.tapd_id)),
        ...preview.unassigned.filter((r) => r.type === 'bug').map((r) => r.tapd_id),
      ]
    : [];
  const allIterIds = preview ? preview.iterations.map((it) => it.tapd_id) : [];

  const selectedRequirementCount = selectedItemIds.filter((id) => allRequirementIds.includes(id)).length;
  const selectedBugCount = selectedItemIds.filter((id) => allBugIds.includes(id)).length;

  // 获取所有 item IDs（需求+任务+缺陷）
  const allItemIds = preview
    ? [...allRequirementIds, ...allBugIds]
    : [];

  // 获取某个迭代下的所有 item IDs
  const getIterItemIds = (iteration: TapdIteration) =>
    [...iteration.requirements, ...iteration.tasks, ...iteration.bugs].map((i) => i.tapd_id);

  // 根据需求/任务 ID 集合，找到关联的缺陷 ID 集合（通过 story_id）
  const getAssociatedBugIds = (reqTaskIds: string[]): string[] => {
    if (!preview || !reqTaskIds.length) return [];
    const reqTaskIdSet = new Set(reqTaskIds);
    const bugIds: string[] = [];
    for (const it of preview.iterations) {
      for (const bug of it.bugs) {
        if (bug.story_id && reqTaskIdSet.has(bug.story_id)) {
          bugIds.push(bug.tapd_id);
        }
      }
    }
    for (const item of preview.unassigned) {
      if (item.type === 'bug' && item.story_id && reqTaskIdSet.has(item.story_id)) {
        bugIds.push(item.tapd_id);
      }
    }
    return bugIds;
  };

  // 全选迭代：选中所有迭代 + 所有迭代下的需求/任务/缺陷
  const handleSelectAllIter = (checked: boolean) => {
    setSelectedIterIds(checked ? allIterIds : []);
    setSelectedItemIds(checked ? allItemIds : []);
  };
  const handleSelectAllRequirements = (checked: boolean) => {
    if (checked) {
      // 选中所有需求/任务，并级联选中关联的缺陷
      const associatedBugIds = getAssociatedBugIds(allRequirementIds);
      setSelectedItemIds([...new Set([...selectedItemIds, ...allRequirementIds, ...associatedBugIds])]);
    } else {
      setSelectedItemIds(selectedItemIds.filter((id) => !allRequirementIds.includes(id)));
    }
  };
  const handleSelectAllBugs = (checked: boolean) => {
    if (checked) {
      setSelectedItemIds([...new Set([...selectedItemIds, ...allBugIds])]);
    } else {
      setSelectedItemIds(selectedItemIds.filter((id) => !allBugIds.includes(id)));
    }
  };

  return (
    <div>
      <Alert
        message="TAPD 同步规则"
        description={
          <div>
            {/* <p style={{ marginBottom: 8 }}>凭据已在服务端 settings.py 中配置。点击快捷操作或使用高级选项选择时间范围，预览数据后勾选需要同步的内容，点击「同步选中项」写入本平台。</p> */}
            {/* <p style={{ marginBottom: 4, fontWeight: 500 }}>同步规则：</p> */}
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li><strong>迭代：</strong>同步 TAPD 迭代开始时间~结束时间 或 创建时间/更新时间 在所选时间范围 的迭代信息</li>
              <li><strong>需求/任务：</strong>同步 TAPD 需求（Story）和任务（Task）所在迭代 或 创建时间/更新时间 在所选时间范围 的需求/任务</li>
              <li><strong>缺陷：</strong>同步 TAPD 缺陷（Bug）所在迭代/需求/任务 或 创建时间 在 所选时间范围 的缺陷</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title="同步/拉取 TAPD 数据">
        {/* 快捷操作 */}
        <Space wrap style={{ marginBottom: 16 }}>
          <Button icon={<SyncOutlined />} loading={loadingBtn === 'month'} onClick={() => handleFetch(getMonthRange(), 'month')}>
            同步本月数据
          </Button>
          <Button icon={<SyncOutlined />} loading={loadingBtn === 'twoMonths'} onClick={() => handleFetch(getRecentTwoMonthsRange(), 'twoMonths')}>
            同步近2月数据
          </Button>
          <Button icon={<SyncOutlined />} loading={loadingBtn === 'quarter'} onClick={() => handleFetch(getRecentThreeMonthsRange(), 'quarter')}>
            同步近3月数据
          </Button>
          <Button icon={<SyncOutlined />} loading={loadingBtn === 'year'} onClick={() => handleFetch(getYearRange(), 'year')}>
            同步本年数据
          </Button>
          <Button icon={<SyncOutlined />} onClick={() => setCustomTimeOpen(!customTimeOpen)}>
            自定义时间
          </Button>
          {customTimeOpen && (
            <>
              <RangePicker
                value={customRange}
                onChange={(v) => setCustomRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                format="YYYY-MM-DD"
                placeholder={['开始日期', '结束日期']}
              />
              <Button
                icon={<SyncOutlined />}
                loading={loadingBtn === 'custom'}
                onClick={handleAdvancedFetch}
              >
                开始拉取
              </Button>
            </>
          )}
        </Space>

        {/* 数据类型选择 */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ marginRight: 12, fontWeight: 500 }}>数据类型：</span>
          <Checkbox.Group
            value={dataTypes}
            onChange={(v) => setDataTypes(v as string[])}
            options={[
              { label: '迭代', value: 'iteration' },
              { label: '需求/任务', value: 'requirement' },
              { label: '缺陷', value: 'bug' },
            ]}
          />
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* 数据预览 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="正在从 TAPD 拉取数据..." />
          </div>
        )}

        {!loading && preview && (
          <>
            {/* 全选栏 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 12, padding: '8px 12px', background: '#f0f5ff', borderRadius: 6 }}>
              <Checkbox
                indeterminate={selectedIterCount > 0 && selectedIterCount < allIterIds.length}
                checked={selectedIterCount === allIterIds.length && allIterIds.length > 0}
                onChange={(e) => handleSelectAllIter(e.target.checked)}
              >
                全选迭代（{allIterIds.length} 条）
              </Checkbox>
              <Checkbox
                indeterminate={selectedRequirementCount > 0 && selectedRequirementCount < allRequirementIds.length}
                checked={selectedRequirementCount === allRequirementIds.length && allRequirementIds.length > 0}
                onChange={(e) => handleSelectAllRequirements(e.target.checked)}
              >
                全选需求/任务（{allRequirementIds.length} 条）
              </Checkbox>
              <Checkbox
                indeterminate={selectedBugCount > 0 && selectedBugCount < allBugIds.length}
                checked={selectedBugCount === allBugIds.length && allBugIds.length > 0}
                onChange={(e) => handleSelectAllBugs(e.target.checked)}
              >
                全选缺陷（{allBugIds.length} 条）
              </Checkbox>
            </div>

            {/* 迭代分组展示 */}
            {preview.iterations.map((iteration) => {
              const allIter = [...iteration.requirements, ...iteration.tasks, ...iteration.bugs];
              const selItems = allIter.filter((i) => selectedItemIds.includes(i.tapd_id)).map((i) => i.tapd_id);
              const isIterSelected = selectedIterIds.includes(iteration.tapd_id);

              const header = (
                <Space>
                  <Checkbox
                    checked={isIterSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const iterItemIds = getIterItemIds(iteration);
                      if (e.target.checked) {
                        setSelectedIterIds([...selectedIterIds, iteration.tapd_id]);
                        setSelectedItemIds([...new Set([...selectedItemIds, ...iterItemIds])]);
                      } else {
                        setSelectedIterIds(selectedIterIds.filter((id) => id !== iteration.tapd_id));
                        setSelectedItemIds(selectedItemIds.filter((id) => !iterItemIds.includes(id)));
                      }
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{iteration.name}</span>
                  <Tag color="default">
                    {iteration.begin_date || iteration.end_date
                      ? `${iteration.begin_date || ''} ~ ${iteration.end_date || ''}`
                      : '时间未设置'}
                  </Tag>
                  <Tag color={iteration.status === 'done' ? 'success' : 'processing'}>{iteration.status}</Tag>
                  <Badge count={iteration.requirements.length} color="blue" overflowCount={999}
                    title={`需求 ${iteration.requirements.length} 条`} />
                  <Badge count={iteration.tasks.length} color="green" overflowCount={999}
                    title={`任务 ${iteration.tasks.length} 条`} />
                  <Badge count={iteration.bugs.length} color="red" overflowCount={999}
                    title={`缺陷 ${iteration.bugs.length} 条`} />
                </Space>
              );

              return (
                <Collapse
                  key={iteration.tapd_id}
                  style={{ marginBottom: 8 }}
                  items={[{
                    key: iteration.tapd_id,
                    label: header,
                    children: (
                      <div>
                        <ItemTable
                          items={allIter}
                          selectedIds={selItems}
                          onSelect={(ids) => {
                            const otherIds = selectedItemIds.filter(
                              (id) => !allIter.some((i) => i.tapd_id === id)
                            );
                            // 找出新增选中的需求/任务 IDs（非 bug 类型）
                            const prevReqTaskIds = selItems.filter(
                              (id) => allIter.find((i) => i.tapd_id === id && i.type !== 'bug')
                            );
                            const newReqTaskIds = ids.filter(
                              (id) => !prevReqTaskIds.includes(id) && allIter.find((i) => i.tapd_id === id && i.type !== 'bug')
                            );
                            // 级联选中关联的缺陷
                            const associatedBugIds = getAssociatedBugIds(newReqTaskIds);
                            setSelectedItemIds([...new Set([...otherIds, ...ids, ...associatedBugIds])]);
                          }}
                        />
                      </div>
                    ),
                  }]}
                />
              );
            })}

            {/* 未分配迭代 */}
            {preview.unassigned.length > 0 && (
              <Collapse
                style={{ marginBottom: 8 }}
                items={[{
                  key: 'unassigned',
                  label: (
                    <Space>
                      <Checkbox
                        checked={preview.unassigned.every((i) => selectedItemIds.includes(i.tapd_id)) && preview.unassigned.length > 0}
                        indeterminate={preview.unassigned.some((i) => selectedItemIds.includes(i.tapd_id)) && !preview.unassigned.every((i) => selectedItemIds.includes(i.tapd_id))}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const unassignedIds = preview.unassigned.map((i) => i.tapd_id);
                          if (e.target.checked) {
                            setSelectedItemIds([...selectedItemIds, ...unassignedIds.filter(id => !selectedItemIds.includes(id))]);
                          } else {
                            setSelectedItemIds(selectedItemIds.filter(id => !unassignedIds.includes(id)));
                          }
                        }}
                      />
                      <span style={{ fontWeight: 600, color: '#999' }}>未分配迭代</span>
                      <Badge count={preview.unassigned.filter(i => i.type !== 'task' && i.type !== 'bug').length} color="blue" overflowCount={999} title="需求" />
                      <Badge count={preview.unassigned.filter(i => i.type === 'task').length} color="green" overflowCount={999} title="任务" />
                      <Badge count={preview.unassigned.filter(i => i.type === 'bug').length} color="red" overflowCount={999} title="缺陷" />
                    </Space>
                  ),
                  children: (
                    <ItemTable
                      items={preview.unassigned}
                      selectedIds={preview.unassigned.filter((i) => selectedItemIds.includes(i.tapd_id)).map((i) => i.tapd_id)}
                      onSelect={(ids) => {
                        const otherIds = selectedItemIds.filter(
                          (id) => !preview.unassigned.some((i) => i.tapd_id === id)
                        );
                        // 找出新增选中的需求/任务 IDs
                        const prevSelectedUnassigned = preview.unassigned
                          .filter((i) => selectedItemIds.includes(i.tapd_id) && i.type !== 'bug')
                          .map((i) => i.tapd_id);
                        const newReqTaskIds = ids.filter(
                          (id) => !prevSelectedUnassigned.includes(id) && preview.unassigned.find((i) => i.tapd_id === id && i.type !== 'bug')
                        );
                        const associatedBugIds = getAssociatedBugIds(newReqTaskIds);
                        setSelectedItemIds([...new Set([...otherIds, ...ids, ...associatedBugIds])]);
                      }}
                    />
                  ),
                }]}
              />
            )}

            {/* 同步按钮 */}
            <div style={{
              position: 'sticky', bottom: 0, background: '#fff',
              padding: '12px 0', borderTop: '1px solid #f0f0f0', marginTop: 8,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <Button
                type="primary"
                size="large"
                icon={<SyncOutlined />}
                loading={syncing}
                disabled={!selectedIterCount && !selectedItemCount}
                onClick={handleSync}
              >
                同步选中项
              </Button>
              <Space size={4}>
                <Switch
                  checked={cascadeSync}
                  onChange={setCascadeSync}
                  checkedChildren="级联同步"
                  unCheckedChildren="级联同步"
                />
                <Tooltip title="开启后将自动拉取选中项关联的迭代、子需求、子任务及缺陷">
                  <QuestionCircleOutlined style={{ color: '#999', cursor: 'pointer' }} />
                </Tooltip>
              </Space>
              <span style={{ color: '#666', fontSize: 13 }}>
                已选：
                {selectedIterCount > 0 && <Tag color="blue">{selectedIterCount} 条迭代</Tag>}
                {selectedItemCount > 0 && <Tag color="green">{selectedItemCount} 条需求/任务/缺陷</Tag>}
                {!selectedIterCount && !selectedItemCount && <span style={{ color: '#bbb' }}>暂未选择</span>}
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

// ─────────────────────────────
// AI 模型配置 Tab
// ─────────────────────────────
const AITab = () => {
  const [config, setConfig] = useState<{ deepseek_configured: boolean; claude_configured: boolean } | null>(null);

  useEffect(() => {
    request.get('/integrations/system-config/').then((res: any) => {
      setConfig({
        deepseek_configured: res.data.deepseek_configured || false,
        claude_configured: res.data.claude_configured || false,
      });
    }).catch(() => {});
  }, []);

  return (
    <div>
      <Alert
        message="AI 模型配置"
        description="AI 大模型的 API Key 在服务端 settings.py 中配置。配置后平台将使用对应模型进行需求分析、测试用例生成等 AI 功能。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <Card title="当前配置状态" style={{ maxWidth: 640 }}>
        {config ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <span style={{ color: '#999', marginRight: 8 }}>DeepSeek API Key：</span>
              <Tag color={config.deepseek_configured ? 'success' : 'default'} icon={config.deepseek_configured ? <CheckCircleOutlined /> : undefined}>
                {config.deepseek_configured ? '已配置' : '未配置'}
              </Tag>
            </div>
            <div>
              <span style={{ color: '#999', marginRight: 8 }}>Claude API Key：</span>
              <Tag color={config.claude_configured ? 'success' : 'default'} icon={config.claude_configured ? <CheckCircleOutlined /> : undefined}>
                {config.claude_configured ? '已配置' : '未配置'}
              </Tag>
            </div>
            <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>配置方法：</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                编辑服务端 <code>settings.py</code> 文件，设置以下配置项：
              </div>
              <pre style={{ fontSize: 11, marginTop: 8, padding: 8, background: '#fff', borderRadius: 4 }}>
{`DEEPSEEK_API_KEY = 'your-deepseek-api-key'
CLAUDE_API_KEY = 'your-claude-api-key'`}
              </pre>
            </div>
          </Space>
        ) : (
          <span style={{ color: '#bbb' }}>加载中...</span>
        )}
      </Card>
    </div>
  );
};

// ─────────────────────────────
// GitLab 配置 Tab
// ─────────────────────────────
const GitLabTab = () => {
  const [form] = Form.useForm();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [projectForm] = Form.useForm();

  useEffect(() => {
    request.get('/projects/').then((res: any) => {
      const data = res.data.results || res.data;
      setProjects(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const handleSaveUserConfig = async (values: any) => {
    try {
      await request.post('/integrations/gitlab/config/', values);
      message.success('GitLab 个人配置已保存');
    } catch {
      message.error('保存失败');
    }
  };

  const handleSaveProjectConfig = async (values: any) => {
    if (!selectedProject) { message.warning('请选择项目'); return; }
    try {
      await request.post(`/integrations/gitlab/project/${selectedProject}/`, values);
      message.success('项目 GitLab 配置已保存');
    } catch {
      message.error('保存失败');
    }
  };

  return (
    <div>
      <Card title="个人 GitLab Token" style={{ marginBottom: 16 }}>
        <Form form={form} onFinish={handleSaveUserConfig} layout="inline">
          <Form.Item name="private_token" label="Private Token" rules={[{ required: true }]}>
            <Input.Password placeholder="glpat-xxxx" style={{ width: 260 }} />
          </Form.Item>
          <Form.Item name="api_url" label="API 地址">
            <Input placeholder="https://gitlab.com/api/v4/" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="项目级 GitLab 仓库配置">
        <div style={{ marginBottom: 12 }}>
          <Select
            placeholder="选择项目"
            style={{ width: 220, marginRight: 8 }}
            onChange={(v) => {
              setSelectedProject(v);
              projectForm.resetFields();
              request.get(`/integrations/gitlab/project/${v}/`).then((res: any) => {
                projectForm.setFieldsValue({ repo_url: res.data.repo_url, api_url: res.data.api_url });
              }).catch(() => {});
            }}
            options={projects.map((p: any) => ({ label: p.name, value: p.id }))}
          />
        </div>
        <Form form={projectForm} onFinish={handleSaveProjectConfig} layout="inline">
          <Form.Item name="repo_url" label="仓库地址" rules={[{ required: true }]}>
            <Input placeholder="https://gitlab.com/org/repo" style={{ width: 280 }} />
          </Form.Item>
          <Form.Item name="access_token" label="Access Token" rules={[{ required: true }]}>
            <Input.Password placeholder="glpat-xxxx" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="api_url" label="API 地址">
            <Input placeholder="https://gitlab.com/api/v4/" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" disabled={!selectedProject}>保存</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

// ─────────────────────────────
// Confluence 配置 Tab
// ─────────────────────────────
const ConfluenceTab = () => {
  const [config, setConfig] = useState<{ base_url: string; username: string; has_password: boolean; configured: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    request.get('/integrations/confluence/config/').then((res: any) => {
      setConfig(res.data);
    }).catch(() => {});
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await request.post('/integrations/confluence/config/');
      message.success(res.data.message);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '连接失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <Alert
        message="Confluence 集成说明"
        description="配置 Confluence 凭据后，粘贴 Confluence 页面链接时将自动通过 REST API 获取完整页面内容（支持 pageId 格式的链接）。凭据在服务端 settings.py 中配置，无需在此页面输入。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <Card title="当前配置状态" style={{ maxWidth: 640 }}>
        {config ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <span style={{ color: '#999', marginRight: 8 }}>服务地址：</span>
              {config.base_url ? (
                <a href={config.base_url} target="_blank" rel="noreferrer">
                  <LinkOutlined style={{ marginRight: 4 }} />{config.base_url}
                </a>
              ) : <span style={{ color: '#bbb' }}>未配置</span>}
            </div>
            <div>
              <span style={{ color: '#999', marginRight: 8 }}>用户名：</span>
              {config.username || <span style={{ color: '#bbb' }}>未配置</span>}
            </div>
            <div>
              <span style={{ color: '#999', marginRight: 8 }}>密码：</span>
              {config.has_password ? '••••••••' : <span style={{ color: '#bbb' }}>未配置</span>}
            </div>
            <div>
              <span style={{ color: '#999', marginRight: 8 }}>状态：</span>
              {config.configured ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>已配置</Tag>
              ) : (
                <Tag color="default">未完整配置</Tag>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <Button
                icon={<SyncOutlined />}
                loading={testing}
                onClick={handleTest}
                disabled={!config.configured}
              >
                测试连接
              </Button>
              <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>
                如需修改配置，请编辑服务端 <code>settings.py</code> 中的 CONFLUENCE_* 配置项
              </span>
            </div>
          </Space>
        ) : (
          <span style={{ color: '#bbb' }}>加载中...</span>
        )}
      </Card>
      <Card title="支持的链接格式" style={{ maxWidth: 640, marginTop: 16 }}>
        <Space direction="vertical">
          <div><Tag color="blue">支持</Tag> <code>https://confluence.xxx.com/pages/viewpage.action?pageId=123456</code></div>
          <div><Tag color="blue">支持</Tag> <code>https://confluence.xxx.com/xxx?pageId=123456</code></div>
          <div><Tag color="default">暂不支持</Tag> <code>https://confluence.xxx.com/display/SPACE/Page+Title</code>（空间/标题格式）</div>
        </Space>
      </Card>
    </div>
  );
};

// ─────────────────────────────
// 主页面
// ─────────────────────────────
const IntegrationsPage = () => {
  const tabItems = [
    {
      key: 'tapd',
      label: <span><SyncOutlined /> TAPD 集成</span>,
      children: <TAPDTab />,
    },
    {
      key: 'gitlab',
      label: <span><GithubOutlined /> GitLab 配置</span>,
      children: <GitLabTab />,
    },
    {
      key: 'confluence',
      label: <span><LinkOutlined /> Confluence</span>,
      children: <ConfluenceTab />,
    },
    {
      key: 'ai',
      label: <span><RobotOutlined /> AI 功能</span>,
      children: <AITab />,
    },
  ];

  return (
    <div style={{
      padding: '24px',
      background: '#f5f5f7',
      minHeight: '100vh',
      fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
    }}>
      <h2 style={{ marginBottom: 16 }}>集成中心</h2>
      <Tabs items={tabItems} />
    </div>
  );
};

export default IntegrationsPage;
