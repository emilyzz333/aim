# 问题与解决方案

## 2026-04-08

### 1. Django migrations 目录缺失

**问题**：运行 `makemigrations` 时提示 "No changes detected"，但实际上是因为各 app 缺少 `migrations/` 目录，Django 无法检测到新模型。

**原因**：手动创建 Django app 时未自动生成 `migrations/` 目录。

**解决方案**：手动为每个 app 创建 `migrations/` 目录和 `__init__.py` 文件，然后重新运行 `makemigrations`。

---

### 2. DRF Router 注册时缺少 basename

**问题**：`router.register('', BugViewSet)` 报错 `` `basename` argument not specified ``。

**原因**：自定义 ViewSet 重写了 `get_queryset()`，没有类级别的 `queryset` 属性，DRF 无法自动推导 basename。

**解决方案**：所有使用自定义 `get_queryset()` 的 ViewSet 注册时必须显式传入 `basename`：
```python
router.register('', BugViewSet, basename='bug')
```

---

### 3. MySQL 连接被拒绝（密码为空）

**问题**：settings.py 中 MySQL `PASSWORD` 为空字符串，导致 `(1045, "Access denied for user 'root'@'localhost' (using password: NO)")`。

**解决方案**：修改 `project_management/settings.py` 中 `DATABASES['default']['PASSWORD']` 为实际 MySQL root 密码。

---

### 4. TypeScript 路径别名 @/ 找不到模块

**问题**：`import request from '@/services/request'` 报错 `找不到模块"@/services/request"或其相应的类型声明`。

**原因**：UMI 3 运行时支持 `@` 别名指向 `src/`，但 TypeScript 编辑器不知道这个映射。

**解决方案**：在 `tsconfig.json` 的 `compilerOptions` 中添加：
```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["src/*"]
  }
}
```

---

### 5. Django models.py 内容错乱

**问题**：多次 Edit 操作导致 `apps/users/models.py` 和 `apps/tests/models.py` 内容重复/错误混合。

**原因**：Edit 工具的 `old_string` 匹配到了原始版本中已被修改的代码，导致插入位置错误。

**解决方案**：当文件内容较混乱时，直接用 Write 工具完整重写文件，而不是逐块 Edit。

---

### 6. TestPlan related_name 冲突

**问题**：添加 `TestPlan` 模型时，其 `project`、`module`、`requirement`、`created_by` FK 与 `FunctionCase` 的 `related_name` 冲突。

**原因**：TestPlan 错误地沿用了与 FunctionCase 相同的 FK 字段名和 related_name。

**解决方案**：TestPlan 仅使用 ManyToManyField 关联 requirements 和 cases，不再添加重复的 module/requirement FK。

---

## 2026-04-08（第二/三阶段）

### 7. f-string 内部不能含反斜杠（Python 3.9）

**问题**：`AICodeGenerationView` 的 prompt 构造使用了嵌套 f-string：
```python
f"技术方案：\n{technical_spec}" if technical_spec else ""
```
在外层 f-string 内使用，报 `SyntaxError: f-string expression part cannot include a backslash`。

**原因**：Python 3.9 及以下不允许在 f-string 的 `{}` 表达式内使用 `\n` 等反斜杠转义序列。

**解决方案**：将嵌套表达式提取为独立变量：
```python
tech_section = ('技术方案：\n' + technical_spec + '\n\n') if technical_spec else ''
prompt = '...' + tech_section + '...'
```
或者使用字符串拼接代替 f-string，完全避免嵌套 f-string 问题。

---

### 8. integrations/urls.py 从 Router 迁移到手动 path 注册

**问题**：原 `integrations/urls.py` 使用 `DefaultRouter` 注册 APIView（非 ViewSet），导致路由异常（Router 只适合 ViewSet）。

**原因**：将 `APIView` 子类错误地注册进 Router（需要 `list`/`create` 等标准 ViewSet 方法）。

**解决方案**：将所有 integrations 路由改为 `path('.../', View.as_view(), name='...')` 手动注册，不使用 Router。

---

### 9. Ant Design Drawer `styles` prop 兼容性问题

**问题**：在 `layouts/index.tsx` 中使用 `styles={{ body: { padding: 0 } }}`，TypeScript 报错：
```
属性"styles"在类型"IntrinsicAttributes & DrawerProps"上不存在
```

**原因**：`styles` 是 Ant Design 5.x 的新 API，项目使用 Ant Design 4.x，4.x 对应的属性名为 `bodyStyle`。

**解决方案**：将 `styles={{ body: { padding: 0 } }}` 改为 `bodyStyle={{ padding: 0 }}`。

---

### 10. UMI 3 中 `history` 导入方式

**问题**：从 `'umi'` 直接导入 `history` 时，TypeScript 报错 `"umi" 没有导出的成员 "history"`。

**原因**：UMI 3 中正确的 history 使用方式是通过 `useHistory` Hook，而非直接导入 `history` 对象。

**解决方案**：改为：
```tsx
import { useHistory } from 'umi';
// 组件内
const history = useHistory();
```


---

## 2026-04-15

### 14. Celery Windows prefork 子进程 `_loc` 缓存未初始化

**问题**：在 Windows 上运行 Celery worker（默认 prefork pool），触发任务时报错：
```
ValueError: not enough values to unpack (expected 3, got 0)
  File "celery/app/trace.py", line 664, in fast_trace_task
    tasks, accept, hostname = _loc
```

**原因**：Celery 5.x + billiard 在 Windows prefork 模式下，子进程的 `_loc` 全局缓存没有被正确初始化，导致任务无法执行。这是 Windows + prefork 的已知兼容性问题。

**解决方案**：启动 worker 时改用 `solo` pool：
```bash
celery -A project_management worker -l info --pool=solo
```
`solo` pool 在主进程中串行执行任务，避免了 Windows 子进程 fork 的问题。


### 11. design.md 技术约束与实际初始化框架不一致

**问题**：`design.md` 技术约束写的是 Vite，但第一阶段执行 `pnpm create umi` 实际安装了 UMI 3（webpack），导致 README 与 design.md 描述矛盾。

**原因**：初始化时未注意 design.md 的框架约束，直接使用了 UMI 3 默认模板。

**解决方案**：本次全量迁移，删除 UMI 3 相关依赖和约定文件，改用 Vite 5 + React Router v6 + React 18 + Ant Design 5，与 design.md 完全对齐。

---

### 12. UMI `history` 对象与 React Router v6 `useNavigate` 的差异

**问题**：UMI 3 支持直接导入 `history` 对象在组件外部调用 `history.push()`，但 React Router v6 强制使用 `useNavigate()` Hook，只能在组件函数体内使用。

**原因**：React Router v6 移除了命令式导航的全局对象，改为 Hook-only 模式。

**解决方案**：
1. 在组件顶层调用 `const navigate = useNavigate()`
2. 将所有 `history.push('/path')` 替换为 `navigate('/path')`
3. login 页面原本在事件回调中调用 `history.push`，改为先在组件顶层获取 `navigate`，回调中调用 `navigate`

---

### 13. Ant Design 5 移除 `antd/dist/antd.css` 引入方式

**问题**：Ant Design 5 不再提供 `antd/dist/antd.css`，改用 CSS-in-JS 方案，但需要在 `main.tsx` 引入 `antd/dist/reset.css` 作为基础样式重置。

**原因**：Ant Design 5 架构重构，默认使用 CSS-in-JS 的 `cssinjs` 运行时，不再产出单一 CSS 文件。

**解决方案**：在 `src/main.tsx` 中引入：
```tsx
import 'antd/dist/reset.css';
```
组件级样式由 Ant Design 5 内部的 CSS-in-JS 自动注入，无需额外配置。
