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
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to update user (${res.status})`);
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
