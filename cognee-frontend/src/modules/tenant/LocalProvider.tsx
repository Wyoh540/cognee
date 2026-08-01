"use client";

import { useEffect, useState, useCallback } from "react";
import { Tenant } from "./types";
import { TenantContext, localInstance, type AvailableTenant } from "./TenantContext";
import { tokens } from "@/ui/theme/tokens";

const localApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

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
  const [error, setError] = useState<string | null>(null);
  const [availableTenants, setAvailableTenants] = useState<AvailableTenant[]>([]);

  const resolveTenant = useCallback(async () => {
    // 1. Verify authentication
    const meRes = await apiFetch("/v1/users/me");

    // 2. Check existing tenants
    const tenants: Array<{ id: string; name: string }> = await apiFetch("/v1/permissions/tenants/me").then((r) => r.json());

    let activeTenant: { id: string; name: string };

    if (tenants.length === 0) {
      // 3. No tenant — create one
      const created: { tenant_id: string; message: string } = await apiFetch(
        `/v1/permissions/tenants?tenant_name=MyWorkspace`,
        { method: "POST" },
      ).then((r) => r.json());
      activeTenant = { id: created.tenant_id, name: "MyWorkspace" };
    } else {
      activeTenant = tenants[0];
      // If user has tenants but none is selected, select the first one
      const meData: { activeWorkspaceId?: string | null } = await meRes.json();
      if (!meData.activeWorkspaceId) {
        await apiFetch("/v1/permissions/tenants/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: activeTenant.id }),
        });
      }
    }

    // 4. Build available tenants list
    const built: AvailableTenant[] = tenants.length > 0
      ? tenants.map((t) => ({
          id: t.id,
          name: t.name,
          isOwner: true,
          ownerHasSubscription: false,
        }))
      : [{ id: activeTenant.id, name: activeTenant.name, isOwner: true, ownerHasSubscription: false }];

    return { activeTenant, availableTenants: built };
  }, []);

  const switchTenantFn = useCallback(async (tenantId: string) => {
    try {
      await apiFetch("/v1/permissions/tenants/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
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
        setTenant({ tenant_id: result.activeTenant.id, tenant_name: result.activeTenant.name });
        setTenantReady(true);
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

  if (error && !isInitializing) {
    return (
      <ErrorScreen message={error} />
    );
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
      requestCreateWorkspace: () => {},
      isOwner: true,
      nameModalOpen: false,
      releaseLoader: () => {},
    }}>
      {children}
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
