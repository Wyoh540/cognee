import type { CogneeInstance } from "@/modules/instances/types";

export interface MemberRole {
  id: string;
  name: string;
}

export interface Member {
  id: string;
  email: string;
  roles: MemberRole[];
}

/**
 * List all members of a tenant (workspace).
 * Requires owner or admin permission.
 */
export async function getTenantUsers(
  tenantId: string,
  instance: CogneeInstance,
): Promise<Member[]> {
  const res = await instance.fetch(`/v1/permissions/tenants/${tenantId}/users`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to list members (${res.status})`);
  }
  return res.json();
}

/**
 * Resolve a user ID from an email address.
 */
export async function getUserIdByEmail(
  email: string,
  instance: CogneeInstance,
): Promise<string> {
  const res = await instance.fetch("/v1/users/get-user-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `User not found (${res.status})`);
  }
  const data = await res.json();
  return data.user_id;
}

/**
 * Add a user to a tenant by email.
 * First resolves email → userId, then adds to tenant.
 */
export async function addMemberByEmail(
  email: string,
  tenantId: string,
  instance: CogneeInstance,
): Promise<void> {
  const userId = await getUserIdByEmail(email, instance);
  const res = await instance.fetch(
    `/v1/permissions/users/${userId}/tenants?tenant_id=${tenantId}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to add member (${res.status})`);
  }
}

/**
 * Remove a user from a tenant.
 * Requires owner or admin permission. Cannot remove the tenant owner.
 */
export async function removeMember(
  tenantId: string,
  userId: string,
  instance: CogneeInstance,
): Promise<void> {
  const res = await instance.fetch(
    `/v1/permissions/tenants/${tenantId}/users/${userId}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to remove member (${res.status})`);
  }
}

// ── Role management ──

export interface TenantRole {
  id: string;
  name: string;
  description: string | null;
  user_count: number;
}

/** List all roles defined in a tenant. */
export async function getTenantRoles(
  tenantId: string,
  instance: CogneeInstance,
): Promise<TenantRole[]> {
  const res = await instance.fetch(`/v1/permissions/tenants/${tenantId}/roles`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to list roles (${res.status})`);
  }
  return res.json();
}

/** Create a new role in a tenant. */
export async function createTenantRole(
  tenantId: string,
  roleName: string,
  instance: CogneeInstance,
): Promise<TenantRole> {
  const res = await instance.fetch(
    `/v1/permissions/roles?tenant_id=${tenantId}&role_name=${encodeURIComponent(roleName)}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to create role (${res.status})`);
  }
  const data = await res.json();
  return { id: data.role_id, name: roleName, description: null, user_count: 0 };
}

/** Assign a role to a user. */
export async function addRoleToUser(
  userId: string,
  roleId: string,
  instance: CogneeInstance,
): Promise<void> {
  const res = await instance.fetch(
    `/v1/permissions/users/${userId}/roles?role_id=${roleId}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to add role (${res.status})`);
  }
}

/** Remove a role from a user. */
export async function removeRoleFromUser(
  userId: string,
  roleId: string,
  instance: CogneeInstance,
): Promise<void> {
  const res = await instance.fetch(
    `/v1/permissions/users/${userId}/roles?role_id=${roleId}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to remove role (${res.status})`);
  }
}

/**
 * Delete a role from the tenant entirely.
 * Removes all user-role associations and ACL entries for this role.
 * Requires owner or admin permission.
 */
export async function deleteTenantRole(
  roleId: string,
  instance: CogneeInstance,
): Promise<void> {
  const res = await instance.fetch(`/v1/permissions/roles/${roleId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to delete role (${res.status})`);
  }
}

/** List users assigned to a specific role in a tenant. */
export async function getUsersInRole(
  tenantId: string,
  roleId: string,
  instance: CogneeInstance,
): Promise<{ id: string; name: string }[]> {
  const res = await instance.fetch(
    `/v1/permissions/tenants/${tenantId}/roles/${roleId}/users`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to list role users (${res.status})`);
  }
  return res.json();
}

/**
 * Get existing permissions on a dataset.
 * Returns a mapping of principal_id → permission names
 * (e.g. {"user-uuid": ["read", "write"], "role-uuid": ["read"]}).
 * The caller must have at least read access to the dataset.
 */
export async function getDatasetPermissions(
  datasetId: string,
  instance: CogneeInstance,
): Promise<Record<string, string[]>> {
  const res = await instance.fetch(
    `/v1/permissions/datasets/${datasetId}/principals`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.detail || `Failed to get dataset permissions (${res.status})`,
    );
  }
  return res.json();
}
