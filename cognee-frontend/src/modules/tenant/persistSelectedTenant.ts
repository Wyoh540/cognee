const SELECTED_TENANT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// The selected tenant is persisted three ways on purpose:
//  - cookie: server-side API routes read the selection
//  - localStorage: survives tab close, lets a reload reconnect deterministically
//  - sessionStorage: marks that a selection was made THIS session (cleared on
//    tab close), which the auto-select logic distinguishes from
//    a stale preference left over from a previous session
export default function persistSelectedTenant(tenantId: string, tenantName?: string): void {
  document.cookie = `cognee_selected_tenant=${tenantId};path=/;max-age=${SELECTED_TENANT_MAX_AGE_SECONDS};SameSite=Lax`;
  localStorage.setItem("cognee_selected_tenant", tenantId);
  if (tenantName) localStorage.setItem("cognee_selected_tenant_name", tenantName);
  sessionStorage.setItem("cognee_selected_tenant", tenantId);
}

/**
 * Clear frontend tenant selection so the next page load shows the workspace picker.
 * Does NOT call the backend — the backend selection is only updated when the user
 * explicitly picks a workspace from the picker.
 *
 * Sets a one-shot sessionStorage flag so resolveTenant() knows to show the picker
 * even if the backend still has a stale tenant_id.
 */
export function clearSelectedTenant(): void {
  document.cookie = "cognee_selected_tenant=;path=/;max-age=0;SameSite=Lax";
  localStorage.removeItem("cognee_selected_tenant");
  localStorage.removeItem("cognee_selected_tenant_name");
  sessionStorage.removeItem("cognee_selected_tenant");
  // One-shot flag: cleared by resolveTenant() after it's read
  sessionStorage.setItem("cognee_show_picker", "1");
  window.location.reload();
}
