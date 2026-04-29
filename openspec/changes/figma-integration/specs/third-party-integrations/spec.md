## ADDED Requirements

### Requirement: AiInputAsset 支持 Figma 来源类型
系统 SHALL 在 `AiInputAsset.source_type` 枚举中新增 `figma_rest`（Figma REST API）和 `figma_mcp`（Figma MCP）两种来源类型。

#### Scenario: 创建 Figma 来源的 AiInputAsset
- **WHEN** `fetch_md` 接口接收到 `source_type=figma_rest` 的请求
- **THEN** 系统创建 `source_type=figma_rest` 的 `AiInputAsset` 记录，`batch_desc` 存储 Figma 链接
