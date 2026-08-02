const localApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

export default async function createWorkspace(tenantName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${localApiUrl}/api/v1/permissions/tenants?tenant_name=${encodeURIComponent(tenantName)}`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { success: false, error: body.detail || `Failed to create workspace (HTTP ${response.status})` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to connect to backend" };
  }
}
