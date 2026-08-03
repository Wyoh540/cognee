"use client";

import { useEffect, useState, useCallback } from "react";
import { Tenant } from "./types";
import { TenantContext, localInstance, type AvailableTenant } from "./TenantContext";
import { tokens } from "@/ui/theme/tokens";
import NameWorkspaceModal from "@/ui/layout/NameWorkspaceModal";
import WorkspacePicker from "@/ui/layout/WorkspacePicker";
import PageLoading from "@/ui/elements/PageLoading";
import createWorkspace from "./createWorkspace";
import persistSelectedTenant from "./persistSelectedTenant";

const localApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

const APP_SHELL_BG = {
  backgroundColor: "#000000",
  backgroundImage:
    "linear-gradient(rgba(244,244,244,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(244,244,244,0.10) 1px, transparent 1px)",
  backgroundSize: "33px 33px",
} as const;

/** Thin fetch wrapper for boot-time calls (before cogniInstance exists). */
async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = localApiUrl + "/api" + (path.startsWith("/v") ? path : "/v1" + path);
  const res = await global.fetch(url, { ...init, credentials: "include" });
  if (!res.ok) {
    // 401 means the session expired — redirect to login immediately
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/sign-in";
      throw new Error("Session expired");
    }
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `${init.method || "GET"} ${path} failed (${res.status})`);
  }
  return res;
}

export function LocalProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [tenantReady, setTenantReady] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTenants, setAvailableTenants] = useState<AvailableTenant[]>([]);

  // ── Create-workspace modal state ──
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const requestCreateWorkspace = useCallback(() => {
    setNameModalOpen(true);
    setNewWorkspaceName("");
    setCreateError(null);
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    const trimmed = newWorkspaceName.trim();
    if (trimmed.length < 2) return;

    setCreating(true);
    setCreateError(null);
    try {
      const result = await createWorkspace(trimmed);
      if (result.success) {
        setNameModalOpen(false);
        // Refresh available tenants list
        const tenants: Array<{ id: string; name: string; is_owner: boolean }> = await apiFetch("/v1/permissions/tenants/me").then((r) => r.json());
        setAvailableTenants(
          tenants.map((t) => ({ id: t.id, name: t.name, isOwner: t.is_owner, ownerHasSubscription: true })),
        );
      } else {
        setCreateError(result.error || "Failed to create workspace");
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }, [newWorkspaceName]);

  const handleCreateClose = useCallback(() => {
    setNameModalOpen(false);
    setNewWorkspaceName("");
    setCreateError(null);
  }, []);

  const resolveTenant = useCallback(async () => {
    // 1. Verify authentication
    const meRes = await apiFetch("/v1/users/me");

    // 2. Check existing tenants
    const tenants: Array<{ id: string; name: string; is_owner: boolean }> = await apiFetch("/v1/permissions/tenants/me").then((r) => r.json());

    // Build available tenants list
    const built: AvailableTenant[] = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      isOwner: t.is_owner,
      ownerHasSubscription: true,
    }));

    if (tenants.length === 0) {
      return { autoSelect: null, availableTenants: [] };
    }

    // One-shot flag from clearSelectedTenant() — user explicitly chose to go back to the picker
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem("cognee_show_picker")) {
        sessionStorage.removeItem("cognee_show_picker");
        return { autoSelect: null, availableTenants: built };
      }

      // User picked a workspace this session (from the picker or a switch)
      const selectedId = sessionStorage.getItem("cognee_selected_tenant");
      if (selectedId) {
        const active = tenants.find((t) => t.id === selectedId);
        if (active) {
          return { autoSelect: active, availableTenants: built };
        }
      }
    }

    // Fallback: user was previously in a workspace (backend tenant_id is set)
    const meData: { tenant_id?: string | null } = await meRes.json();
    if (meData.tenant_id) {
      const active = tenants.find((t) => t.id === meData.tenant_id);
      if (active) {
        return { autoSelect: active, availableTenants: built };
      }
    }

    // Has workspaces but no selection anywhere — show picker
    return { autoSelect: null, availableTenants: built };
  }, []);

  const switchTenantFn = useCallback(async (tenantId: string, tenantName?: string) => {
    try {
      await apiFetch("/v1/permissions/tenants/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      persistSelectedTenant(tenantId, tenantName);
      const found = availableTenants.find((t) => t.id === tenantId);
      setTenant({ tenant_id: tenantId, tenant_name: found?.name ?? "" });
      window.location.reload();
    } catch (err) {
      console.error("Failed to switch tenant:", err);
    }
  }, [availableTenants]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Guard: don't check auth on login page
      if (typeof window !== "undefined" && window.location.pathname === "/sign-in") {
        setIsInitializing(false);
        return;
      }

      try {
        const result = await resolveTenant();
        if (cancelled) return;

        setAvailableTenants(result.availableTenants);
        if (result.autoSelect) {
          setTenant({ tenant_id: result.autoSelect.id, tenant_name: result.autoSelect.name });
          setTenantReady(true);
        } else {
          setShowPicker(true);
        }
      } catch (err) {
        if (cancelled) return;

        if (err instanceof TypeError) {
          setError("Cannot connect to local Cognee backend at " + localApiUrl + ". Is it running?");
        } else if (err instanceof Error && (
          err.message.includes("401") || err.message === "Session expired"
        )) {
          // Not authenticated — redirect to local login
          window.location.href = "/sign-in";
          return;
        } else {
          const message = err instanceof Error ? err.message : "Failed to connect to local backend";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [resolveTenant]);

  if (isInitializing) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...APP_SHELL_BG,
        }}
      >
        <PageLoading name="" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorScreen message={error} />
    );
  }

  if (showPicker) {
    // Allow navigation to /settings — the user may have clicked "Profile" from
    // the WorkspacePicker header avatar. During client-side navigation the layout
    // stays mounted and showPicker remains true, so the picker would otherwise
    // keep rendering and block the settings page (same guard pattern as /sign-in
    // in the init effect).
    if (typeof window !== "undefined" && window.location.pathname === "/settings") {
      // fall through to TenantContext.Provider
    } else {
      return (
        <WorkspacePicker
          workspaces={availableTenants}
          switchTenant={switchTenantFn}
          refreshWorkspaces={async () => {
            const result = await resolveTenant();
            setAvailableTenants(result.availableTenants);
            if (result.autoSelect) {
              setTenant({ tenant_id: result.autoSelect.id, tenant_name: result.autoSelect.name });
              setTenantReady(true);
              setShowPicker(false);
            }
          }}
        />
      );
    }
  }

  return (
    <TenantContext.Provider value={{
      tenant,
      cogniInstance: localInstance,
      localInstance,
      serviceUrl: localApiUrl,
      apiKey: "",
      isInitializing,
      tenantReady,
      podUnreachable: false,
      error,
      statusMessage: null,
      availableTenants,
      switchTenant: switchTenantFn,
      planType: null,
      hasAccess: true,
      requestCreateWorkspace,
      isOwner: true,
      nameModalOpen,
      releaseLoader: () => {},
    }}>
      {children}
      {nameModalOpen && (
        <NameWorkspaceModal
          name={newWorkspaceName}
          setName={setNewWorkspaceName}
          submitting={creating}
          error={createError}
          onSubmit={handleCreateSubmit}
          onClose={handleCreateClose}
          showPaymentInfo={false}
        />
      )}
    </TenantContext.Provider>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "2rem",
      textAlign: "center",
    }}>
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "0.75rem",
        padding: "2.5rem",
        maxWidth: "28rem",
        width: "100%",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
      }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem", fontWeight: 700, color: tokens.textDark }}>
          Connection Error
        </h2>
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: tokens.textSecondary }}>
          {message}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "0.5rem 1.5rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            backgroundColor: "#ffffff",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
