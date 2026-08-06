# 平台超级管理员页面

**日期:** 2026-08-03
**状态:** 待用户审阅

## 1. 目标

新增一个平台级别的超级管理员页面 /admin，允许 is_superuser 用户管理平台上所有工作空间和登录用户。目前系统已有 is_superuser 字段和默认超管用户，但缺少可视化管理界面。

## 2. 需求摘要

- 页面结构：单一 /admin 页面 + Tabs（Workspaces / Users）
- 工作空间操作：创建、删除、查看详情
- 用户操作：查看列表与详情、授予/撤销 superuser、禁用/启用账号
- 入口可见性：仅对 is_superuser === true 的用户显示，非超管访问返回 403
- 权限校验：前端 + 后端双重校验
- 方案选择：方案 A — 新增独立 Admin 路由 + 直接调用本地后端
## 3. 范围

### 3.1 后端新增

| 文件 | 用途 |
|---|---|
| cognee/api/v1/users/routers/get_admin_router.py | Admin API 路由 |
| cognee/api/v1/users/routers/__init__.py | 导出 get_admin_router |

### 3.2 后端修改

| 文件 | 变更 |
|---|---|
| cognee/api/client.py | include_router(get_admin_router(), prefix="/api/v1/admin") |

### 3.3 前端新增

| 文件 | 用途 |
|---|---|
| cognee-frontend/src/app/(app)/admin/page.tsx | 页面入口 |
| cognee-frontend/src/app/(app)/admin/AdminPage.tsx | 主组件：Tabs |
| cognee-frontend/src/app/(app)/admin/WorkspacesPanel.tsx | 工作空间列表 |
| cognee-frontend/src/app/(app)/admin/UsersPanel.tsx | 用户列表 |
| cognee-frontend/src/modules/admin/adminApi.ts | API 调用层 |

### 3.4 前端修改

| 文件 | 变更 |
|---|---|
| cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx | 新增 ADMIN 分区 |

### 3.5 不在范围

- 审计日志专用表（使用现有 structlog + User 字段变更历史）
- 租户编辑（如改名）留作后续
- 用户搜索/筛选/分页 首版输出全量列表
- 批量操作（批量删除租户等）

## 4. 后端 API 设计

### 4.1 Admin Router

所有端点使用 Depends(get_authenticated_user) 获取当前用户，并以 user.is_superuser 做网关校验，非超管返回 403。

端点列表：

- GET    /api/v1/admin/tenants         -> 列出所有租户
- DELETE /api/v1/admin/tenants/{id}    -> 删除指定租户
- GET    /api/v1/admin/tenants/{id}    -> 查看单个租户详情
- GET    /api/v1/admin/users           -> 列出所有用户
- PATCH  /api/v1/admin/users/{id}      -> 更新用户 (is_superuser / is_active)

### 4.2 GET /admin/tenants 响应

数组，每项结构：
- id: UUID string
- name: 租户名称
- owner_email: 所有者邮箱
- member_count: 成员数 (int)
- created_at: ISO 8601 时间字符串

实现：从 tenants 表 join users + user_tenants 聚合。

### 4.3 GET /admin/tenants/{id} 响应

上述单租户结构 + members 列表（id, email, roles）。

### 4.4 DELETE /admin/tenants/{id}

软删除租户，保留关联数据，记录日志。返回 200 { message: "Tenant deleted." }

### 4.5 GET /admin/users 响应

数组，每项结构：
- id: UUID string
- email: 邮箱字符串
- is_superuser: bool
- is_active: bool
- is_verified: bool
- tenant_ids: UUID 字符串数组
- created_at: ISO 8601 时间字符串

### 4.6 PATCH /admin/users/{id}

请求体：{ is_superuser?: bool, is_active?: bool }
仅允许写入这两个字段，部分更新（Pydantic BaseModel: is_superuser: Optional[bool], is_active: Optional[bool]）。

### 4.7 权限校验模式

每个端点统一开头：

    if not user.is_superuser:
        return JSONResponse(status_code=403,
            content={"detail": "Superuser privileges required."})

不提取为装饰器（因为路由函数上已有很多装饰器如 telemetry），直接内联以保持清晰。

## 5. 前端设计

### 5.1 导航入口

在 CustomAppShellNavbar.tsx 中：

- import useCurrentUser（已有 useTenant import，并行新增）
- const { data: currentUser } = useCurrentUser()
- const isSuperuser = currentUser?.isSuperuser ?? false
- 当 isSuperuser 为 true 时，在 navSections 末尾追加 ADMIN_NAV_SECTION
- ADMIN_NAV_SECTION 结构：

    const ADMIN_NAV_SECTION: NavSection = {
      label: "ADMIN",
      items: [
        { text: "Admin", link: "/admin", icon: ShieldIcon },
      ],
    };

- ShieldIcon 在文件内新增（SVG shield 图标），与 HouseIcon 等同级

### 5.2 AdminPage 主组件

布局采用 Stack + Tabs（Mantine）：

- 标题区："Admin" (TWKLausanne, 20px, #EDECEA, fontWeight 300)
- 副标题："Manage workspaces and users across the platform."
- Mantine Tabs 包含 Workspaces 和 Users 两个面板
- 默认激活 Workspaces tab

### 5.3 WorkspacesPanel

功能：

- 表格显示：名称、Owner email、成员数、操作列
- 顶部有 "Create Workspace" 按钮
- 点击 Create 打开 Modal：输入名称 -> POST /v1/permissions/tenants?tenant_name=XXX（复用现有 API，query param 格式，已限定 superuser）
- 每个工作空间行有 "View" 和 "Delete" 按钮
- View: GET /v1/admin/tenants/{id} 获取详情，在行下方展开 inline 面板显示成员列表（id, email）。点击其他行时关闭当前展开
- Delete: openConfirmModal -> 确认 -> DELETE /v1/admin/tenants/{id}
- 加载态用 SkeletonBar 占位（复用现有组件）

### 5.4 UsersPanel

功能：

- 表格显示：邮箱、Superuser 徽章、Active 状态徽章、操作列
- 每行操作：
  - "Toggle Superuser" 按钮 -> PATCH /v1/admin/users/{id} { is_superuser: !current }
  - "Toggle Active" 按钮 -> PATCH /v1/admin/users/{id} { is_active: !current }
- Superuser 徽章：紫色背景（accentBg），与非超管灰底区分
- Active 状态：绿色 dot + "Active" / 红色 dot + "Inactive"

### 5.5 数据层 (adminApi.ts)

adminApi.ts 直接使用 localFetch（与 members.ts 模式一致）：

    import localFetch from "@/modules/instances/localFetch";

    export async function getAllTenants() {
      const res = await localFetch("/v1/admin/tenants");
      if (!res.ok) throw new Error(...);
      return res.json();
    }

同理：deleteTenant, getAllUsers, patchUser

不走 workspace pod，本地后端直连。

### 5.6 权限守卫

AdminPage 中：

    const { data: currentUser, isLoading } = useCurrentUser();
    if (isLoading) return <PageLoading />;
    if (!currentUser?.isSuperuser) return <ForbiddenPage />;

ForbiddenPage 显示：
- 居中 403 图标
- "You do not have access to this page."
- "Back to Dashboard" 按钮（Link to /dashboard）

### 5.7 样式与 UX

- 复用 Members 页面中定义的共享 token（C 常量）：
  - surfaceBg: "rgba(255,255,255,0.06)"
  - surfaceBorder: "1px solid rgba(255,255,255,0.1)"
  - textPrimary: "#EDECEA"
  - textMuted: "rgba(237,236,234,0.55)"
  - accent: "#BC9BFF"
  - accentBg: "rgba(188,155,255,0.18)"
  - danger: "#EF4444"
  - dangerBg: "rgba(239,68,68,0.15)"
- Card 组件复用 Members 页定义的 Card（blur + border-radius 12px）
- 表格样式与 Members 页一致：grid-template-columns 定义，hover 行高亮
- Tabs 样式用 Mantine 默认，颜色覆盖为 accent 紫色

## 6. 错误处理

| 场景 | 前端行为 |
|---|---|
| 非超管访问 /admin | 页面显示 403 无权限 + Back to Dashboard |
| 非超管调用 Admin API | localFetch 收到 403 -> Toast 提示 |
| 删除租户 API 失败 | Toast 显示后端返回的 detail message |
| 更新用户 API 失败 | Toast 显示错误，表单状态回滚 |
| 删除确认 | modals.openConfirmModal（复用 Members 页模式） |
| 加载中 | 页面级 isLoading state -> SkeletonBar 占位 |
| 网络错误 | Toast + Retry 按钮 |

## 7. 测试与验证清单（手动）

1. 非超管用户访问 /admin -> 看到 403 无权限页面
2. 非超管用户侧边栏不显示 ADMIN 分区
3. 超管用户登录 -> 侧边栏可见 ADMIN > Admin
4. 点击 Admin 进入 /admin，默认 Workspaces Tab
5. Workspaces Tab：列表显示所有租户（名称、Owner email、成员数）
6. 点击 Create Workspace 按钮 -> Modal 输入名称 -> 成功后列表刷新
7. 点击 Delete -> 确认弹窗 -> 确认后租户从列表移除
8. 切换至 Users Tab：列表显示所有用户（邮箱、Superuser 徽章、Active 状态）
9. 点击 Toggle Superuser -> 用户 is_superuser 状态切换
10. 点击 Toggle Active -> 用户 is_active 状态切换
11. 刷新页面后状态持久化
12. 移动端抽屉侧边栏同样可见 Admin 入口（仅在超管时）

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| localFetch API key 与 admin 路由不兼容 | Admin 路由直接注册在 FastAPI app，不依赖 workspace 认证 |
| 他人向 admin router 添加非 admin 端点 | Router 文件内注释说明所有端点需 superuser |
| useCurrentUser 加载延迟导致侧边栏闪烁 | isSuperuser 为 falsy 时不渲染 ADMIN，与 Members isOwner 处理一致 |

## 9. 实现步骤概要

1. 后端：创建 get_admin_router.py，实现 5 个端点
2. 后端：更新 routers/__init__.py 导出
3. 后端：在 client.py 中注册路由
4. 前端：创建 modules/admin/adminApi.ts
5. 前端：创建 AdminPage.tsx、WorkspacesPanel.tsx、UsersPanel.tsx
6. 前端：创建 page.tsx 入口
7. 前端：修改 CustomAppShellNavbar.tsx 新增 ADMIN 分区
8. 类型检查 + 手动验证清单
