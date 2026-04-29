SDD项管平台PRD设计文档
1. 产品概述
1.1 产品背景
为了提高项目开发效率，规范项目管理流程，需要一个集成项目管理、测试管理和人员管理的综合性平台，实现从需求提出到上线的全流程管理。
1.2 产品目标
- 实现需求全生命周期管理
- 提供直观的项目进度跟踪
- 优化团队协作流程
- 提高项目交付质量和效率
2. 核心功能模块
2.1 项目管理
- 迭代管理：创建、编辑、删除迭代，设置迭代周期和目标
- 需求管理：

- 需求创建、编辑、删除
- 需求拉取（从其他系统导入）
- 需求状态变更与处理
- 需求详情查看与编辑
- 需求关联管理（关联模块、测试用例等）
- 需求版本管理与变更记录
2.2 测试管理
- 测试用例管理：创建、编辑、执行测试用例
- 缺陷管理：缺陷提报、分配、跟踪、解决
- 测试计划：制定测试计划，跟踪测试进度
- 测试报告：生成测试报告，统计测试覆盖率
2.3 人员管理
- 用户管理：用户创建、编辑、权限分配
- 角色管理：定义角色，分配权限
- 团队管理：创建团队，管理团队成员
- 工作量统计：统计团队和个人工作量
2.4 其他功能
- Dashboard：项目概览、关键指标展示
- 通知系统：重要事件通知
- 文档管理：项目相关文档存储与管理
- GitLab集成：代码仓库关联、分支管理
- TAPD集成：与腾讯敏捷项目管理平台的数据同步与集成
- AI辅助功能：智能代码生成、需求分析、测试用例生成等
3. 页面设计
3.1 整体布局
- 左侧导航栏：

- 顶部：系统logo和名称
- 中间：项目列表（可展开查看迭代）
- 底部：用户信息、设置入口
- 顶部导航栏：

- 搜索框
- 通知中心
- 快速操作按钮
- 用户头像
- 主内容区：根据选择的功能模块动态展示
- 右侧面板：可选，用于展示详细信息或辅助操作
3.2 关键页面设计
3.2.1 需求列表页
- 页面布局：

- 顶部：搜索筛选、生命周期进度条、批量操作
- 左侧：迭代列表（可折叠）
- 右侧：需求表格
- 表格字段：

- 需求ID
- 需求名称
- 所属迭代
- 状态
- 优先级
- 负责人
- 截止日期
- 创建时间
- 操作按钮：

- 新建需求
- 批量操作（状态变更、删除等）
- 导出
- 筛选
3.2.2 需求详情页
- 页面布局：

- 顶部：需求基本信息、操作按钮
- 中部：标签页切换（基本信息、详细描述、技术方案、子需求、关联缺陷、测试用例等）
- 右侧：状态流转历史、变更记录
- 详细信息：

- 需求基本信息（名称、ID、所属迭代、状态等）
- 需求描述（Markdown格式）
- 技术方案（Markdown格式）
- 关联信息（GitLab分支、Commit ID等）
- 时间节点（技评时间、提测时间、上线时间等）
- 人员信息（产品、开发、测试等）
- 子需求/任务
- 关联缺陷
- 关联测试用例
3.2.3 迭代管理页
- 页面布局：

- 顶部：迭代列表、新建迭代按钮
- 中部：选中迭代的需求列表
- 右侧：迭代统计信息
- 功能：

- 迭代创建、编辑、删除
- 迭代状态管理
- 需求分配到迭代
- 迭代进度跟踪
3.2.4 测试管理页
- 测试用例管理：

- 用例列表
- 用例创建、编辑
- 用例执行
- 缺陷管理：

- 缺陷列表
- 缺陷提报、分配、解决
- 缺陷统计
3.2.5 人员管理页
- 用户管理：

- 用户列表
- 用户创建、编辑、删除
- 权限分配
- 团队管理：

- 团队列表
- 团队创建、编辑
- 成员管理
4. 业务流程
4.1 需求生命周期流程
1.待评审：
- 新建需求默认状态
- 上传需求MD文档（PRD、Proposal、Figma链接等）
- 产品评审通过后流转至待技评
2.待技评：
- 开发人员进行技术评审
- 上传技术MD文档
- 填写提测时间
- 技评通过后流转至待开发
3.待开发：
- 开发人员领取任务
- 提交GitLab分支和Commit ID
- 开发完成后流转至待测试
4.开发中：
- 开发人员正在实施
- 可更新开发进度
- 遇到问题可标记阻塞
5.待测试：
- 测试人员准备测试
- 确认测试环境
- 开始测试后流转至测试中
- 可驳回开发中状态
6.测试中：
- 执行测试用例
- 提报缺陷
- 测试通过后流转至待验收
7.待验收：
- 产品人员进行验收
- 验收通过后流转至待上线
8.待上线：
- 准备上线
- 执行上线流程
- 上线完成后流转至待回归
9.待回归：
- 进行回归测试
- 确认无问题后流转至已完成
10.已完成
- 需求完成
- 可归档
11.关闭
- 异常关闭
- 任何状态都可以流转到关闭状态

4.2 权限管理流程
- 角色定义：产品经理、开发人员、测试人员、项目经理、管理员、超级管理员
- 权限分配：基于角色分配操作权限
- 权限控制：确保用户只能访问和操作授权范围内的资源
5. 数据模型设计
5.1 核心数据模型
5.1.1 用户（User）
- id: 主键
- username: 用户名
- password: 密码（加密存储）
- email: 邮箱
- name: 真实姓名
- role: 角色
- qw_userid: 企微用户ID
- qw_openid: 企微开放ID
- qw_department: 企微部门
- qw_avatar: 企微头像
- created_at: 创建时间
- updated_at: 更新时间
5.1.2 项目（Project）
- id: 主键
- name: 项目名称
- description: 项目描述
- status: 状态
- created_by: 创建人
- created_at: 创建时间
- updated_at: 更新时间
5.1.3 迭代（Iteration）
- id: 主键
- name: 迭代名称
- project_id: 所属项目
- start_date: 开始日期
- end_date: 结束日期
- status: 状态
- created_by: 创建人
- created_at: 创建时间
- updated_at: 更新时间
5.1.4 需求（Requirement）
- id: 主键
- requirement_id: 需求编号
- name: 需求名称
- iteration_id: 所属迭代
- project_id: 所属项目
- status: 状态
- priority: 优先级
- description: 详细描述
- requirement_md: 需求MD
- technical_md: 技术MD
- parent_id: 父需求
- gitlab_branch: GitLab分支，可传多个
- commit_id: Commit ID，可传多个
- module: 关联模块
- product_owner: 产品人员
- developer: 开发人员
- tester: 测试人员
- dev_owner: 开发负责人
- test_owner: 测试负责人
- tech_review_time: 技评时间
- test_submit_time: 提测时间
- online_time: 上线时间
- actual_test_submit: 实际提测时间
- actual_online: 实际上线时间
- tags: 标签，可多标签
- remarks: 备注
- created_by: 创建人
- created_at: 创建时间
- updated_at: 更新时间
5.1.5 子需求（SubRequirement）
- id: 主键
- requirement_id: 所属需求
- name: 子需求名称
- description：详细信息
- status: 状态
- assignee: 负责人
- created_at: 创建时间
- updated_at: 更新时间
5.1.6 缺陷（Bug）
- id: 主键
- bug_id: 缺陷编号
- requirement_id: 关联需求
- title: 缺陷标题
- description: 缺陷描述
- severity: 严重程度
- status: 状态
- assignee: 负责人
- reporter: 报告人
- env：发现环境：T环境、pre环境、线上环境
- type：缺陷类型：线上缺陷、功能缺陷、需求缺陷、设计缺陷、用户体验、建议等
- group：归属团队：前端web、app、后端组A、后端组B、产品等
- source：缺陷来源：测试发现、技术发现、业务反馈 、用户反馈等
- created_at: 创建时间
- updated_at: 更新时间
5.1.7 测试用例（FunctionCase）
- id: 主键
- case_id: 用例编号
- project_id:所属项目
- module_id:所属模块
- requirement_id: 关联需求
- title: 用例标题
- steps: 测试步骤
- expected_result: 预期结果
- api_test: 关联接口自动化
- ui_test:关联ui自动化
- plat：端口，web、ios、安卓、鸿蒙、后端server等
- status: 状态
- is_delete: 是否删除
- source：来源：新建、导入、AI生成等
- remarks: 备注
- reviewed：审核状态：待审核、通过、不通过
- created_by: 创建人
- created_at: 创建时间
- updated_at: 更新时间
5.1.8 变更记录（ChangeLog）
- id: 主键
- target_type: 目标类型（需求、缺陷等）
- target_id: 目标ID
- field: 变更字段
- old_value: 旧值
- new_value: 新值
- changed_by: 变更人
- changed_at: 变更时间
6. 技术架构
6.1 前端架构
- 框架：React + Ant Design Pro+vite
- 状态管理：Redux + Redux Saga   
- 路由：React Router
- 网络请求：Axios
- UI组件：Ant Design
- 构建工具：Webpack
- 代码规范：ESLint + Prettier
6.2 后端架构
- 框架：Django + Django REST Framework
- 数据库：mysql
- 认证：JWT，采用 JWT 实现无状态认证，完成 Token 生成、刷新、过期策略配置；通过 Django settings 配置 JWT 加密算法、有效期、签名密钥；前端通过 Axios 拦截器统一注入 Token 并处理过期刷新，实现接口权限控制。
6.3 目录结构
project/
├── backend/
│   ├── manage.py
│   ├── project_name/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── users/
│   │   ├── projects/
│   │   ├── iterations/
│   │   ├── requirements/
│   │   ├── tests/
│   │   └── bugs/
├──frontend/  # 前端代码
│   ├── public/
│   ├── src/
│   ├── static/   #放置前端静态资源
│   ├── package.json
│   └── tsconfig.json
└── README.md
└── require.txt


7. 接口设计
7.1 认证接口
- POST /api/auth/login - 用户登录
- POST /api/auth/logout - 用户登出
- GET /api/auth/me - 获取当前用户信息
- GET /api/auth/qw/auth - 企微授权链接生成
- GET /api/auth/qw/callback - 企微授权回调
- POST /api/auth/qw/login - 企微用户登录
- GET /api/auth/qw/userinfo - 获取企微用户信息
7.1.1 TAPD集成接口
- POST /api/tapd/auth - TAPD授权
- GET /api/tapd/projects - 获取TAPD项目列表
- GET /api/tapd/requirements - 从TAPD拉取需求
- POST /api/tapd/sync - 同步TAPD数据
7.2 项目接口
- GET /api/projects - 获取项目列表
- POST /api/projects - 创建项目
- GET /api/projects/:id - 获取项目详情
- PUT /api/projects/:id - 更新项目
- DELETE /api/projects/:id - 删除项目
7.3 迭代接口
- GET /api/iterations - 获取迭代列表
- POST /api/iterations - 创建迭代
- GET /api/iterations/:id - 获取迭代详情
- PUT /api/iterations/:id - 更新迭代
- DELETE /api/iterations/:id - 删除迭代
7.4 需求接口
- GET /api/requirements - 获取需求列表
- POST /api/requirements - 创建需求
- GET /api/requirements/:id - 获取需求详情
- PUT /api/requirements/:id - 更新需求
- DELETE /api/requirements/:id - 删除需求
- POST /api/requirements/:id/change-status - 变更需求状态
- POST /api/requirements/:id/upload-md - 上传MD文档
7.5 测试用例接口
- GET /api/test-cases - 获取测试用例列表
- POST /api/test-cases - 创建测试用例
- GET /api/test-cases/:id - 获取测试用例详情
- PUT /api/test-cases/:id - 更新测试用例
- DELETE /api/test-cases/:id - 删除测试用例
7.6 缺陷接口
- GET /api/bugs - 获取缺陷列表
- POST /api/bugs - 创建缺陷
- GET /api/bugs/:id - 获取缺陷详情
- PUT /api/bugs/:id - 更新缺陷
- DELETE /api/bugs/:id - 删除缺陷
8. 部署与集成方案
8.1 本地开发环境
- 前端：npm start 启动开发服务器
- 后端：python manage.py runserver 启动Django开发服务器
8.2 生产环境部署
暂不需要
8.3 集成方案
- GitLab集成：通过GitLab API实现代码仓库关联
- 通知集成：集成企业微信或钉钉实现通知
- 企微用户认证：集成企业微信扫码登录，实现单点登录功能
- AI集成：对接主流AI模型，如DeepSeek、Claude Code等，提供智能代码生成、需求分析等功能
- TAPD集成：对接腾讯敏捷项目管理平台，实现需求、任务、缺陷等数据的同步与集成
- 文档集成：支持Markdown文档和Figma链接
9. 安全考虑
9.1 前端安全
- XSS防护：使用React的内置防护机制
- CSRF防护：实现CSRF Token验证
- 敏感信息保护：不在前端存储敏感信息
9.2 后端安全
- 密码加密：使用bcrypt等算法加密存储密码
- API认证：使用JWT进行API认证
- 权限控制：实现基于角色的权限控制
- SQL注入防护：使用Django ORM防止SQL注入
- 输入验证：对所有用户输入进行验证
10. 性能优化
10.1 前端优化
- 代码分割：使用React.lazy和Suspense实现代码分割
- 缓存策略：合理使用浏览器缓存
- 状态管理优化：避免不必要的重渲染
- 网络请求优化：使用axios拦截器和缓存
10.2 后端优化
- 数据库优化：合理设计索引，优化查询
- 缓存：使用Redis缓存热点数据
- 异步处理：使用Celery处理异步任务
- API优化：实现分页和按需加载
11. 项目计划关键里程碑
- 后端API完成
- 前端核心功能完成
- 系统集成测试通过
- 生产环境部署完成
12. 总结
本PRD设计文档详细描述了项目管理平台的功能、页面设计、业务流程、数据模型和技术架构，为开发团队提供了清晰的指导。平台采用React+Ant Design Pro前端和Django后端的技术栈，实现了需求全生命周期管理、测试管理和人员管理等核心功能，能够有效提高项目开发效率和管理水平。
在实施过程中，应严格按照PRD设计进行开发，同时根据实际情况进行适当调整和优化，确保系统的稳定性、安全性和性能。

13. 技术选型细节
- 数据库 ：确定具体使用的数据库（如PostgreSQL、MySQL等）：使用MySQL
- 缓存 ：是否需要Redis等缓存服务：暂不需要
- 认证方案 ：JWT的具体配置细节：采用 JWT 实现无状态认证，完成 Token 生成、刷新、过期策略配置；通过 Django settings 配置 JWT 加密算法、有效期、签名密钥；前端通过 Axios 拦截器统一注入 Token 并处理过期刷新，实现接口权限控制。
- 前端构建工具 ：是否使用Vite或Webpack：Vite
- 后端部署 ：使用Gunicorn还是uWSGI：Gunicorn
14. 环境配置要求
- 开发环境 ：Node.js版本、Python版本: nodev22.22.2，python3.9
- 依赖管理 ：前端使用npm/yarn/pnpm？后端使用pip，前端使用pnpm
- IDE配置 ：推荐的开发工具和插件
- 代码规范 
- 安装包：将当前实现用到的安装包与版本都实时追加写入到require.txt文件中
15. 团队协作与开发流程
- 代码仓库 ：GitHub、GitLab或其他平台
- 分支管理 ：Git Flow、GitHub Flow等策略
- 代码审查 ：PR流程和规范
- 沟通工具 ：企业微信、Slack等
16. 测试策略
- 单元测试 ：前端使用Jest，后端使用pytest
- 集成测试 ：API测试工具（如Postman、Insomnia）
- 端到端测试 ：Cypress、Playwright等
- 测试覆盖率 ：目标覆盖率指标
17. 部署方案
- 服务器环境 ：云服务器（AWS、阿里云等）或本地服务器：先本地服务器
- 容器化 ：暂不需要Docker镜像构建和Docker Compose配置
- CI/CD ：GitLab CI、GitHub Actions等配置
18. 过程留档
- 项目功能研发的过程记录到根目录下spec文件夹下的program.md文档中
- 把开发过程中遇到的问题、解决方法、经验教训等记录下来到根目录下spec文件夹下的problem.md文档中，方便后续参考。
- 把项目的前后端部署方法记录到readme.md文档中，方便后续参考。