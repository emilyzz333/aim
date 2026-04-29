## Context

平台当前支持通过文件上传、URL 抓取（含 Confluence）、GitLab 拉取、AI 对话四种方式为需求添加素材（`AiInputAsset`），进而触发 AI 解析与理解流程。Figma 是团队存放 PRD 文档和 UI 设计稿的主要平台，需要作为第五种来源类型接入，成为整个 AI 提效链路的数据入口。

现有数据流：
```
fetch_md 接口 → 创建 AiInputAsset
  → trigger-parse → parse_document_task（阶段一：文档解析）
  → trigger-generate → generate_structured_ai_understanding（阶段二：AI理解）
```

Figma 集成复用该完整流程，只需在 `fetch_md` 入口新增 Figma 来源分支。

## Goals / Non-Goals

**Goals:**
- 支持粘贴 Figma 链接，提取 PRD 文本和 UI 设计稿图片，存入 `AiInputAsset`
- 提取的文本保留结构（含 `[图片N]` 占位符），图片持久化到本地/OSS
- 复用现有 AI 解析与理解流程，不改动下游任务代码
- 提供 Figma Token 配置状态查询和连通性测试接口
- 前端识别 Figma 链接，自动选择正确的 source_type

**Non-Goals:**
- 不实现 OAuth 2.0 自动续期（Token 过期由用户手动更新）
- 不实现 Figma Webhook 自动同步（仅手动触发）
- 不新建任何数据模型（复用现有 AiInputAsset / AiUnderstanding）
- 不实现 Figma MCP 后端集成（MCP 仅用于开发阶段 Claude Code 辅助，平台运行时使用 REST API）

## Decisions

### 决策一：三种对接模式，通过 settings 开关切换

**选择：`FIGMA_FETCH_MODE` 支持三个值**

```python
FIGMA_FETCH_MODE = 'rest'  # 'rest' | 'mcp' | 'rest_mcp'
```

**模式对比：**

| 模式 | 数据拉取 | AI 解析 | AI 理解 | 适用场景 |
|------|---------|--------|--------|---------|
| `rest` | REST API → AiInputAsset | 用 AiInputAsset 存储数据 | 用 AiInputAsset 存储数据 | 生产环境，数据持久化 |
| `mcp` | 只存 Figma URL | Claude + MCP 实时读取 | Claude + MCP 实时读取 | 实时性要求高，不需要存储 |
| `rest_mcp` | REST API → AiInputAsset（存档备用） | Claude + MCP 实时读取 | Claude + MCP 实时读取 | 调试对比，数据备份 + MCP 实时处理 |

**REST 模式数据流：**
```
fetch_md → 调 Figma REST API 提取文本+下载图片
→ 存入 AiInputAsset（text_content + file_paths）
→ trigger-parse → parse_document_task（用 AiInputAsset 数据）
→ trigger-generate → AI 理解生成（用 AiInputAsset 数据）
```

**MCP 模式数据流：**
```
fetch_md → 只存 Figma URL 到 AiInputAsset（source_type='figma_mcp'）
→ trigger-parse → 检测到 figma_mcp
  → 调用 AIService（Claude API）+ Figma MCP tool
  → Claude 实时读取 Figma 并输出解析结果
→ trigger-generate → 同样调用 Claude + MCP 实时读取
```

**rest_mcp 模式数据流：**
```
fetch_md → 调 Figma REST API 提取文本+下载图片
→ 存入 AiInputAsset（text_content + file_paths，作为备份）
→ trigger-parse → 检测到 source_type='figma_rest' 且 FIGMA_FETCH_MODE='rest_mcp'
  → 忽略 AiInputAsset 存储数据
  → 从 batch_desc 取 Figma URL，调用 Claude + MCP 实时读取
→ trigger-generate → 同样调用 Claude + MCP 实时读取
```

MCP 模式复用平台已有的 `AIService._call_claude()`，通过 Claude API 的 `tools` 参数传入 Figma MCP，由 Claude 自主读取 Figma 数据并解析，无需后端单独实现 Figma 内容提取逻辑。

`rest_mcp` 模式便于调试阶段对比两种数据来源的差异，REST 拉取的数据作为存档备份，AI 处理全程使用 MCP 实时读取。

### 决策二：Token 存 settings.py，不新建配置模型

**选择：settings.py 存全局配置**

当前 Confluence、AI 模型等集成 Token 均存放在 settings.py，Figma 保持一致，避免引入新模型。Token 过期时在 settings.py 中替换后重启服务，简单可控。

```python
FIGMA_API_TOKEN = 'figd_xxxxxxxx'
FIGMA_TOKEN_EXPIRES_AT = '2026-07-01'  # 方便前置过期检查
FIGMA_FETCH_MODE = 'rest'              # 'rest' 或 'mcp'
```

### 决策三：不新建 FigmaSync 模型，直接存入 AiInputAsset

**选择：复用 AiInputAsset**

每次用户粘贴 Figma 链接均为新增操作，新建一条 AiInputAsset 记录。`batch_desc` 存 Figma URL 作为来源标识。这与现有 URL 抓取逻辑完全一致，无需引入新模型增加复杂度。

### 决策四：Figma REST API 实际机制与图片提取策略

`GET /v1/files/{file_key}` **一次调用返回完整节点树**，每个节点包含：

```json
{
  "type": "TEXT",
  "characters": "需求背景说明",
  "absoluteBoundingBox": { "x": 100, "y": 200, "width": 400, "height": 50 }
}
```

图片节点通过 `fills` 中的 `imageRef` 标识：
```json
{
  "type": "RECTANGLE",
  "absoluteBoundingBox": { "x": 100, "y": 350 },
  "fills": [{ "type": "IMAGE", "imageRef": "abc123" }]
}
```

图片获取分两步：
1. 从节点树收集所有含 `IMAGE` fill 的节点 ID
2. `GET /v1/images/{file_key}?ids=node1,node2` 批量获取 CDN 临时 URL → 立即下载到本地/OSS

Figma CDN URL 有时效性，必须在同步时立即下载持久化。

### 决策五：文本与图片统一按坐标排序，保证占位准确

文本节点和图片节点都在同一节点树中，共享同一坐标系（`absoluteBoundingBox.y`）。

处理逻辑：
1. 递归遍历节点树，收集所有 TEXT 节点和含 IMAGE fill 的节点
2. 统一按 `absoluteBoundingBox.y` 升序排序
3. 按顺序输出：TEXT 节点输出文本，IMAGE 节点输出 `[图片N]` 占位符
4. 最终拼接为带结构的文本存入 `AiInputAsset.text_content`

这保证了图片占位符在文本中的位置与 Figma 画布视觉顺序完全一致，与现有 PDF/DOCX 解析输出格式兼容，下游 `parse_document_task` 无需任何改动。

## Risks / Trade-offs

- **Figma Token 过期** → 调用前检查 `FIGMA_TOKEN_EXPIRES_AT`，过期直接返回明确错误提示，引导用户更新 settings.py
- **Figma 节点树过大** → 大型 Figma 文件节点可能数千个，需限制提取深度或仅处理指定 node_id 的子树；提供 node_id 参数支持用户指定范围
- **图片下载超时** → 批量图片下载设置超时，单张失败不阻断整体流程，失败图片以 `[图片N-下载失败]` 标记
- **Figma API 速率限制** → Figma REST API 有速率限制（约 100 req/min），大文件需分批请求图片导出 URL

## Migration Plan

1. `settings.py` 新增 `FIGMA_API_TOKEN` 和 `FIGMA_TOKEN_EXPIRES_AT`（需人工填写）
2. 执行数据库迁移（`AiInputAsset.source_type` 枚举扩展，无破坏性变更）
3. 部署后端代码
4. 部署前端代码
5. 无需数据迁移，无回滚风险（新增枚举值向后兼容）

## Open Questions

- Figma 文件节点树提取深度上限定为多少层？（建议默认全量，节点数超过 500 时警告）
- MCP 模式下如何调用 Figma MCP Server？是否需要启动独立进程还是通过 Claude API 间接调用？（需技术验证）
