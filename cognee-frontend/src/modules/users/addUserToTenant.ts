import localFetch from "@/modules/instances/localFetch";

/**
 * Add a user to a tenant (workspace) by email.
 *
 * First resolves the email to a user ID, then adds that user to the tenant.
 * Requires the caller to be the tenant owner or have admin permission.
 */
export default async function addUserToTenant(email: string, tenantId: string): Promise<void> {
  // Resolve email → user ID
  const userIdRes = await localFetch("/v1/users/get-user-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!userIdRes.ok) {
    const body = await userIdRes.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `User not found (${userIdRes.status})`);
  }
  const { user_id: userId } = await userIdRes.json();

  // Add user to tenant
  const res = await localFetch(`/v1/permissions/users/${userId}/tenants?tenant_id=${tenantId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `Failed to add user to tenant (${res.status})`);
  }
}
