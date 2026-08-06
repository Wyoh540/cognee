# 平台超级管理员页面 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 新增平台超级管理员页面 /admin

**Architecture:** 后端 FastAPI admin router (5 endpoints) + 前端单页 Mantine Tabs

**Tech Stack:** Python/FastAPI/SQLAlchemy, Next.js/TypeScript/Mantine

## Global Constraints

- 所有 admin API 端点检查 user.is_superuser, 非超管返回 403
- 前端样式复用 Members 页的 C tokens 和 Card 组件
- 使用 localFetch (不走 workspace pod)
- Python 代码用双引号
- 不引入新依赖

## File Structure

| 动作 | 文件 | 职责 |
|---|---|---|
| Create | cognee/api/v1/users/routers/get_admin_router.py | 5 个 admin 端点 |
| Modify | cognee/api/v1/users/routers/__init__.py | 导出 get_admin_router |
| Modify | cognee/api/client.py | 导入 + include_router |
| Create | cognee-frontend/src/modules/admin/adminApi.ts | localFetch 封装 |
| Create | cognee-frontend/src/app/(app)/admin/page.tsx | 页面入口 |
| Create | cognee-frontend/src/app/(app)/admin/AdminPage.tsx | 主组件 |
| Create | cognee-frontend/src/app/(app)/admin/WorkspacesPanel.tsx | 工作空间面板 |
| Create | cognee-frontend/src/app/(app)/admin/UsersPanel.tsx | 用户面板 |
| Modify | cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx | ADMIN 导航分区 |

---

### Task 1: 后端 Admin API Router

**Files:**
- Create: `cognee/api/v1/users/routers/get_admin_router.py`

**Interfaces:**
- Produces: `get_admin_router() -> APIRouter`
- 5 endpoints registered on the returned router

- [ ] **Step 1: 创建 admin router 文件**

创建 `cognee/api/v1/users/routers/get_admin_router.py`:

```python
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from cognee import __version__ as cognee_version
from cognee.modules.users.models import User
from cognee.modules.users.models.Tenant import Tenant
from cognee.modules.users.models.UserTenant import UserTenant
from cognee.modules.users.methods import get_authenticated_user
from cognee.infrastructure.databases.relational import get_relational_engine
from cognee.shared.utils import send_telemetry


class PatchUserBody(BaseModel):
    is_superuser: Optional[bool] = None
    is_active: Optional[bool] = None


def get_admin_router() -> APIRouter:
    """Return a FastAPI router with admin-only endpoints for platform management.

    Every endpoint checks user.is_superuser at entry. Non-superuser callers
    receive 403. Do NOT add non-admin endpoints to this router.
    """
    admin_router = APIRouter()

    @admin_router.get("/tenants")
    async def list_all_tenants(user: User = Depends(get_authenticated_user)):
        """List all tenants with owner email and member count. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            # Subquery: count members per tenant
            cnt_subq = (
                select(UserTenant.tenant_id, func.count().label("cnt"))
                .group_by(UserTenant.tenant_id)
                .subquery()
            )

            query = (
                select(
                    Tenant,
                    User.email.label("owner_email"),
                    func.coalesce(cnt_subq.c.cnt, 0).label("member_count"),
                )
                .outerjoin(User, Tenant.owner_id == User.id)
                .outerjoin(cnt_subq, Tenant.id == cnt_subq.c.tenant_id)
            )

            result = await session.execute(query)
            rows = result.all()

            return [
                {
                    "id": str(row.Tenant.id),
                    "name": row.Tenant.name,
                    "owner_email": row.owner_email or "unknown",
                    "member_count": row.member_count,
                    "created_at": row.Tenant.created_at.isoformat()
                    if row.Tenant.created_at
                    else None,
                }
                for row in rows
            ]

    @admin_router.get("/tenants/{tenant_id}")
    async def get_tenant_detail(
        tenant_id: UUID, user: User = Depends(get_authenticated_user)
    ):
        """Get single tenant detail with member list. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            # Get tenant
            tenant_q = select(Tenant).where(Tenant.id == tenant_id)
            tenant_result = await session.execute(tenant_q)
            tenant = tenant_result.scalar_one_or_none()
            if not tenant:
                return JSONResponse(
                    status_code=404, content={"detail": "Tenant not found."}
                )

            # Get owner email
            owner_q = select(User).where(User.id == tenant.owner_id)
            owner_result = await session.execute(owner_q)
            owner = owner_result.scalar_one_or_none()

            # Get members
            members_q = (
                select(User)
                .join(UserTenant, User.id == UserTenant.user_id)
                .where(UserTenant.tenant_id == tenant_id)
            )
            members_result = await session.execute(members_q)
            members = members_result.scalars().all()

            return {
                "id": str(tenant.id),
                "name": tenant.name,
                "owner_email": owner.email if owner else "unknown",
                "created_at": tenant.created_at.isoformat()
                if tenant.created_at
                else None,
                "members": [
                    {"id": str(m.id), "email": m.email} for m in members
                ],
            }

    @admin_router.delete("/tenants/{tenant_id}")
    async def delete_tenant(
        tenant_id: UUID, user: User = Depends(get_authenticated_user)
    ):
        """Delete a tenant. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            tenant_q = select(Tenant).where(Tenant.id == tenant_id)
            tenant_result = await session.execute(tenant_q)
            tenant = tenant_result.scalar_one_or_none()
            if not tenant:
                return JSONResponse(
                    status_code=404, content={"detail": "Tenant not found."},
                )

            await session.delete(tenant)
            await session.commit()

        send_telemetry(
            "Admin API: Tenant Deleted",
            user.id,
            additional_properties={
                "tenant_id": str(tenant_id),
                "tenant_name": tenant.name,
                "cognee_version": cognee_version,
            },
        )

        return JSONResponse(
            status_code=200, content={"message": "Tenant deleted."}
        )

    @admin_router.get("/users")
    async def list_all_users(user: User = Depends(get_authenticated_user)):
        """List all users in the system. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            query = select(User).options(selectinload(User.tenants))
            result = await session.execute(query)
            users = result.unique().scalars().all()

            return [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "is_superuser": u.is_superuser,
                    "is_active": u.is_active,
                    "is_verified": u.is_verified,
                    "tenant_ids": [str(t.id) for t in u.tenants],
                    "created_at": u.created_at.isoformat()
                    if u.created_at
                    else None,
                }
                for u in users
            ]

    @admin_router.patch("/users/{user_id}")
    async def patch_user(
        user_id: UUID,
        body: PatchUserBody,
        user: User = Depends(get_authenticated_user),
    ):
        """Update user superuser or active status. Superuser only."""
        if not user.is_superuser:
            return JSONResponse(
                status_code=403,
                content={"detail": "Superuser privileges required."},
            )

        if body.is_superuser is None and body.is_active is None:
            return JSONResponse(
                status_code=400,
                content={"detail": "At least one field is required."},
            )

        db_engine = get_relational_engine()
        async with db_engine.get_async_session() as session:
            user_q = select(User).where(User.id == user_id)
            user_result = await session.execute(user_q)
            target = user_result.scalar_one_or_none()
            if not target:
                return JSONResponse(
                    status_code=404, content={"detail": "User not found."},
                )

            if body.is_superuser is not None:
                target.is_superuser = body.is_superuser
            if body.is_active is not None:
                target.is_active = body.is_active

            await session.commit()

        send_telemetry(
            "Admin API: User Patched",
            user.id,
            additional_properties={
                "target_user_id": str(user_id),
                "changes": body.model_dump(exclude_none=True),
                "cognee_version": cognee_version,
            },
        )

        return JSONResponse(
            status_code=200, content={"message": "User updated."}
        )

    return admin_router
```

- [ ] **Step 2: Commit**

```bash
git add cognee/api/v1/users/routers/get_admin_router.py
git commit -m "feat: add admin API router for platform superuser management"
```

---

### Task 2: 注册 Admin Router 到应用

**Files:**
- Modify: `cognee/api/v1/users/routers/__init__.py`
- Modify: `cognee/api/client.py`

**Interfaces:**
- Produces: `get_admin_router` importable from `cognee.api.v1.users.routers`
- Registered at prefix `/api/v1/admin`

- [ ] **Step 1: 更新 __init__.py 导出**

在 `cognee/api/v1/users/routers/__init__.py` 末尾追加一行:

```python
from .get_admin_router import get_admin_router
```

- [ ] **Step 2: 在 client.py 中导入并注册**

在 `cognee/api/client.py` 的 import 块中（第 37-46 行附近，`get_user_id_by_email_router` 后面）追加 `get_admin_router`:

```python
from cognee.api.v1.users.routers import (
    get_auth_router,
    get_register_router,
    get_reset_password_router,
    get_verify_router,
    get_users_router,
    get_visualize_router,
    get_configuration_router,
    get_user_id_by_email_router,
    get_admin_router,
)
```

在文件末尾（第 258 行 `get_configuration_router` 注册之后）追加:

```python
app.include_router(
    get_admin_router(),
    prefix="/api/v1/admin",
    tags=["admin"],
)
```

- [ ] **Step 3: Commit**

```bash
git add cognee/api/v1/users/routers/__init__.py cognee/api/client.py
git commit -m "feat: register admin router at /api/v1/admin"
```

---

### Task 3: 前端 API 数据层

**Files:**
- Create: `cognee-frontend/src/modules/admin/adminApi.ts`

**Interfaces:**
- Produces: `getAllTenants()`, `getTenantDetail(id)`, `deleteTenant(id)`, `getAllUsers()`, `patchUser(id, body)`
- Uses `localFetch` from `@/modules/instances/localFetch`

- [ ] **Step 1: 创建 adminApi.ts**

创建 `cognee-frontend/src/modules/admin/adminApi.ts`:

```typescript
import localFetch from "@/modules/instances/localFetch";

// Admin API: all endpoints require superuser (backend enforced).
// Uses localFetch which hits the local backend directly (not workspace pod).

export interface AdminTenant {
  id: string;
  name: string;
  owner_email: string;
  member_count: number;
  created_at: string | null;
}

export interface AdminTenantDetail extends AdminTenant {
  members: { id: string; email: string }[];
}

export interface AdminUser {
  id: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
  is_verified: boolean;
  tenant_ids: string[];
  created_at: string | null;
}

export interface PatchUserBody {
  is_superuser?: boolean;
  is_active?: boolean;
}

export async function getAllTenants(): Promise<AdminTenant[]> {
  const res = await localFetch("/v1/admin/tenants");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to list tenants (${res.status})`);
  }
  return res.json();
}

export async function getTenantDetail(
  tenantId: string,
): Promise<AdminTenantDetail> {
  const res = await localFetch("/v1/admin/tenants/" + tenantId);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to get tenant (${res.status})`);
  }
  return res.json();
}

export async function deleteTenant(tenantId: string): Promise<void> {
  const res = await localFetch("/v1/admin/tenants/" + tenantId, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to delete tenant (${res.status})`);
  }
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const res = await localFetch("/v1/admin/users");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to list users (${res.status})`);
  }
  return res.json();
}

export async function patchUser(
  userId: string,
  body: PatchUserBody,
): Promise<void> {
  const res = await localFetch("/v1/admin/users/" + userId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to update user (${res.status})`);
  }
}

export async function createWorkspaceByName(
  name: string,
): Promise<string> {
  const res = await localFetch(
    "/v1/permissions/tenants?tenant_name=" + encodeURIComponent(name),
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.detail || `Failed to create workspace (${res.status})`,
    );
  }
  const data = await res.json();
  return data.tenant_id;
}
```

- [ ] **Step 2: Commit**

```bash
git add cognee-frontend/src/modules/admin/adminApi.ts
git commit -m "feat: add admin API data layer (localFetch wrappers)"
```

---

### Task 4: AdminPage 主组件 + page.tsx 入口

**Files:**
- Create: `cognee-frontend/src/app/(app)/admin/page.tsx`
- Create: `cognee-frontend/src/app/(app)/admin/AdminPage.tsx`

**Interfaces:**
- `page.tsx`: server component, re-exports `AdminPage`
- `AdminPage`: client component, checks `isSuperuser`, renders Tabs

- [ ] **Step 1: 创建页面入口 page.tsx**

```typescript
export const dynamic = "force-dynamic";

import AdminPage from "./AdminPage";

export default function Page() {
  return <AdminPage />;
}
```

- [ ] **Step 2: 创建 AdminPage.tsx（权限守卫 + Tabs）**

参考 Members 页的 page.tsx 和 SettingsPage.tsx 结构。
使用 Mantine Tabs 组件、C tokens、PageLoading、useCurrentUser。

```tsx
"use client";

import { Stack, Text, Tabs, Button } from "@mantine/core";
import Link from "next/link";
import WorkspacesPanel from "./WorkspacesPanel";
import UsersPanel from "./UsersPanel";
import { useCurrentUser } from "@/modules/users/useCurrentUser";
import PageLoading from "@/ui/elements/PageLoading";

const C = {
  surfaceBg: "rgba(255,255,255,0.06)",
  textPrimary: "#EDECEA",
  textMuted: "rgba(237,236,234,0.55)",
  accent: "#BC9BFF",
} as const;

export default function AdminPage() {
  const { data: currentUser, isLoading } = useCurrentUser();

  if (isLoading) {
    return <PageLoading name="Admin" />;
  }

  if (!currentUser?.isSuperuser) {
    return (
      <Stack className="h-full items-center justify-center" gap="md">
        <Text style={{ fontSize: 48, fontWeight: 700, color: C.accent }}>
          403
        </Text>
        <Text style={{ color: C.textMuted, fontSize: 15 }}>
          You do not have access to this page.
        </Text>
        <Button
          component={Link}
          href="/dashboard"
          variant="subtle"
          styles={{
            root: {
              color: C.accent,
              "&:hover": { background: "rgba(188,155,255,0.1)" },
            },
          }}
        >
          Back to Dashboard
        </Button>
      </Stack>
    );
  }

  return (
    <Stack className="!gap-[0.625rem] h-full p-[1.25rem]">
      {/* Heading */}
      <div style={{ marginBottom: "0.25rem" }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 300,
            color: C.textPrimary,
            margin: 0,
            fontFamily: '"TWKLausanne", sans-serif',
          }}
        >
          Admin
        </h2>
        <Text size="sm" style={{ color: C.textMuted, marginTop: 4 }}>
          Manage workspaces and users across the platform.
        </Text>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="workspaces"
        styles={{
          list: {
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            gap: 0,
          },
          tab: {
            color: "rgba(237,236,234,0.5)",
            fontSize: 14,
            fontWeight: 500,
            padding: "10px 20px",
            border: "none",
            "&[data-active]": {
              color: C.accent,
              borderBottom: `2px solid ${C.accent}`,
            },
            "&:hover": { background: "transparent", color: C.textPrimary },
          },
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="workspaces">Workspaces</Tabs.Tab>
          <Tabs.Tab value="users">Users</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="workspaces" pt="md">
          <WorkspacesPanel />
        </Tabs.Panel>

        <Tabs.Panel value="users" pt="md">
          <UsersPanel />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add cognee-frontend/src/app/\(app\)/admin/
git commit -m "feat: add AdminPage with Tabs and superuser guard"
```

---

### Task 5: WorkspacesPanel

**Files:**
- Create: cognee-frontend/src/app/(app)/admin/WorkspacesPanel.tsx

- [ ] **Step 1: 创建文件**
参考 Members page (members/page.tsx) 的 Table/Card/ConfirmModal 模式。
组件包含:
  - useState: tenants[], loading, error, createName, creating, expandedId, detail, detailLoading, deletingId
  - useEffect loadTenants() useCallback
  - handleCreate: POST permissions/tenants?tenant_name=XXX via createWorkspaceByName, notifyOk, reload
  - handleDelete: modals.openConfirmModal -> deleteTenant, notifyOk, reload
  - handleToggleDetail: expandedId toggle -> getTenantDetail -> inline expand
  - Card shell (复用 Members 页 style)
  - Create form: TextInput + Button (PlusIcon), error handling
  - Table: grid-template-columns: 1fr auto auto auto
  - Columns: Name, Owner Email, Members (count), Actions (View / Delete buttons)
  - Inline detail panel: expand below row, show member emails
  - Loading: SkeletonBar rows
  - Empty state: centered text
  - Error state: red text + Retry button
  - CSS tokens identical to Members page C constant

- [ ] **Step 2: Commit**
git add cognee-frontend/src/app/(app)/admin/WorkspacesPanel.tsx
git commit -m "feat: add WorkspacesPanel with create/delete/expand-detail"


---

### Task 6: UsersPanel (user management panel)

**Files:**
- Create: cognee-frontend/src/app/(app)/admin/UsersPanel.tsx

- [ ] **Step 1: Create file**
Reference UsersPanel design from spec section 5.4.
Component contains:
  - useState: users[], loading, error, toggling{userId, field}
  - useEffect loadUsers() useCallback -> getAllUsers()
  - handleToggleSuperuser: patchUser(id, {is_superuser: !current}) -> notifyOk -> reload
  - handleToggleActive: patchUser(id, {is_active: !current}) -> notifyOk -> reload
  - toggling state: disable button + show spinner while request in flight per user+field
  - Card shell (reuse C tokens, same as WorkspacesPanel)
  - Table: grid-template-columns: 1fr auto auto auto
  - Columns: Email (with PersonIcon), Superuser badge (purple/gray), Active status (green/red dot + text), Actions
  - Superuser badge: accentBg background + accent text when true, gray otherwise
  - Active status: green dot (currentColor) + "Active" / red dot (danger) + "Inactive"
  - Actions column: two small buttons (Toggle Superuser / Toggle Active)
  - Loading/Error/Empty states same pattern as WorkspacesPanel
  - CSS tokens: use same C constant as WorkspacesPanel
  - Import localFetch for API calls
  - Import PersonIcon inline or reuse from members page pattern


- [ ] **Step 2: Commit**

git add cognee-frontend/src/app/(app)/admin/WorkspacesPanel.tsx
git commit -m "feat: add WorkspacesPanel with create/delete/expand-detail"

---

### Task 6: UsersPanel (user management panel)

**Files:**
- Create: cognee-frontend/src/app/(app)/admin/UsersPanel.tsx

- [ ] **Step 1: Create UsersPanel.tsx**

Reference spec section 5.4. Component contains:
- useState: users[], loading, error, toggling{userId, field}
- useEffect loadUsers() useCallback -> getAllUsers()
- handleToggleSuperuser: patchUser(id, {is_superuser: !current}) -> notifyOk -> reload
- handleToggleActive: patchUser(id, {is_active: !current}) -> notifyOk -> reload
- Card shell (reuse C tokens, same as WorkspacesPanel)
- Table: grid-template-columns: 1fr auto auto auto
- Columns: Email (with PersonIcon), Superuser badge (purple/gray), Active status (green/red dot + text), Actions
- Superuser badge: accentBg background + accent text when true, gray otherwise
- Active status: green dot + Active / red dot + Inactive
- Actions column: two small buttons (Toggle Superuser / Toggle Active)
- Loading/Error/Empty states same pattern as WorkspacesPanel

- [ ] **Step 2: Commit**

git add cognee-frontend/src/app/(app)/admin/UsersPanel.tsx
git commit -m "feat: add UsersPanel with toggle superuser/active"

---

### Task 7: CustomAppShellNavbar (ADMIN nav section)

**Files:**
- Modify: cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx

- [ ] **Step 1: Add ShieldIcon + ADMIN_NAV_SECTION**

Changes in CustomAppShellNavbar.tsx:

1. Add import: import { useCurrentUser } from "@/modules/users/useCurrentUser";

2. Add ShieldIcon component (before CustomAppShellNavbar function):
   function ShieldIcon({ active }: { active: boolean }) { return <svg ...>shield path</svg>; }

3. In function body, get isSuperuser:
   const { data: currentUser } = useCurrentUser();
   const isSuperuser = currentUser?.isSuperuser ?? false;

4. Add ADMIN_NAV_SECTION constant (same pattern as MANAGE_NAV_SECTION):
   const ADMIN_NAV_SECTION: NavSection = {
     label: "ADMIN",
     items: [{ text: "Admin", link: "/admin", icon: ShieldIcon }],
   };

5. Update navSections logic:
   Change from: const navSections = isOwner ? [...BASE_NAV_SECTIONS, MANAGE_NAV_SECTION] : BASE_NAV_SECTIONS;
   To:
   const navSections = [...BASE_NAV_SECTIONS];
   if (isOwner) navSections.push(MANAGE_NAV_SECTION);
   if (isSuperuser) navSections.push(ADMIN_NAV_SECTION);

- [ ] **Step 2: Commit**

git add cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx
git commit -m "feat: add ADMIN nav section for superuser users"

---

### Task 8: Type check and manual verification

- [ ] **Step 1: Run type check**
  cd cognee-frontend && npx tsc --noEmit
  Fix any type errors.

- [ ] **Step 2: Manual verification per spec section 7**
  1. Non-superuser: /admin shows 403, no ADMIN in sidebar
  2. Superuser login: ADMIN > Admin visible in sidebar
  3. Admin page: Workspaces tab, list shows all tenants
  4. Create workspace: Modal -> name -> success -> list refreshed
  5. Delete workspace: Confirm -> removed from list
  6. Users tab: list shows all users with badges
  7. Toggle superuser: badge flips
  8. Toggle active: status flips
  9. Refresh: state persists
  10. Mobile sidebar: Admin entry visible for superuser

- [ ] **Step 3: Commit any fixes**
  git add . && git commit -m "fix: type check and verification fixes"
