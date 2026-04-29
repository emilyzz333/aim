## ADDED Requirements

### Requirement: 从 Figma 链接提取文本内容
系统 SHALL 支持通过 Figma REST API 从指定 Figma 文件链接提取所有文本节点内容，按节点垂直位置排序拼接为结构化文本，存入 `AiInputAsset.text_content`。

#### Scenario: 成功提取文本内容
- **WHEN** 用户提交有效的 Figma 文件链接，`source_type=figma_rest`，且 `FIGMA_API_TOKEN` 已配置且未过期
- **THEN** 系统调用 Figma REST API 获取节点树，提取所有 TEXT 节点内容，按 y 坐标排序拼接，创建 `AiInputAsset` 记录，`text_content` 存储提取的文本，返回 HTTP 201

#### Scenario: Token 已过期
- **WHEN** 用户提交 Figma 链接，但当前日期已超过 `FIGMA_TOKEN_EXPIRES_AT`
- **THEN** 系统返回 HTTP 400，错误信息为"Figma Token 已过期，请更新 settings.py 中的 FIGMA_API_TOKEN"

#### Scenario: Token 未配置
- **WHEN** 用户提交 Figma 链接，但 `FIGMA_API_TOKEN` 为空
- **THEN** 系统返回 HTTP 400，错误信息为"Figma Token 未配置，请在 settings.py 中配置 FIGMA_API_TOKEN"

#### Scenario: Figma API 返回 401
- **WHEN** 调用 Figma API 时返回 401 状态码
- **THEN** 系统返回 HTTP 400，错误信息为"Figma Token 无效或已被撤销，请重新生成"

#### Scenario: 指定 node_id 提取局部内容
- **WHEN** 用户提交的 Figma 链接包含 `node-id` 参数
- **THEN** 系统仅提取该节点及其子节点的文本内容，不处理整个文件

### Requirement: 从 Figma 链接下载图片
系统 SHALL 从 Figma 文件中识别 IMAGE/VECTOR 类型节点，批量获取图片导出 URL 并下载持久化到本地或 OSS，图片路径存入 `AiInputAsset.file_paths.images`，文本中对应位置插入 `[图片N]` 占位符。

#### Scenario: 成功下载图片
- **WHEN** Figma 文件中包含图片节点，且图片导出 URL 获取成功
- **THEN** 系统下载所有图片，根据 `FILE_UPLOAD_TO_OSS` 开关存储到本地或 OSS，路径写入 `file_paths.images`，文本中插入对应 `[图片N]` 占位符

#### Scenario: 单张图片下载失败
- **WHEN** 某张图片下载超时或失败
- **THEN** 系统不中断整体流程，该图片在文本中标记为 `[图片N-下载失败]`，其余图片正常处理

#### Scenario: 文件无图片节点
- **WHEN** Figma 文件中不包含任何图片节点
- **THEN** 系统正常创建 `AiInputAsset`，`file_paths.images` 为空列表，仅存储文本内容
