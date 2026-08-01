"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import { getTenantRoles, getTenantUsers, type TenantRole, type Member } from "@/modules/users/members";
import { trackEvent } from "@/modules/analytics";

type SharePermission = "read" | "write" | "delete" | "share";

interface ShareDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  /** Page name used for analytics events. */
  pageName?: string;
}

// ── Permission dropdown (dark-theme, matches TopBar Dropdown) ──

const PERMISSION_OPTIONS = [
  { value: "write" as SharePermission, label: "Can edit" },
  { value: "read" as SharePermission, label: "Can view" },
  { value: "share" as SharePermission, label: "Can share" },
  { value: "delete" as SharePermission, label: "Can delete" },
];

function PermissionDropdown({
  value,
  onChange,
}: {
  value: SharePermission;
  onChange: (perm: SharePermission) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const selected = PERMISSION_OPTIONS.find((o) => o.value === value) ?? PERMISSION_OPTIONS[1];

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "rgba(255,255,255,0.06)",
          border: open ? "1px solid rgba(101,16,244,0.45)" : "1px solid rgba(255,255,255,0.12)",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
          color: "#EDECEA",
          fontFamily: "inherit",
          transition: "border-color 0.15s",
        }}
      >
        <span>{selected.label}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? "M3 7.5L6 4.5L9 7.5" : "M3 4.5L6 7.5L9 4.5"} stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 4,
            background: "#1a1a1a",
            borderRadius: 8,
            boxShadow: "0px 8px 30px rgba(0,0,0,0.5), 0px 0px 0px 1px rgba(255,255,255,0.08)",
            padding: 4,
            zIndex: 60,
            minWidth: 120,
            maxHeight: "min(160px, calc(100vh - 120px))",
            overflowY: "auto",
          }}
        >
          {PERMISSION_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: opt.value === value ? 500 : 400,
                color: opt.value === value ? "rgba(188,155,255,0.60)" : "#EDECEA",
                background: opt.value === value ? "rgba(188,155,255,0.12)" : "transparent",
                cursor: "pointer",
              }}
              onClick={() => onChange(opt.value)}
            >
              <span>{opt.label}</span>
              {opt.value === value && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: "auto", flexShrink: 0 }}>
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#6510F4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modal for sharing a brain (dataset): with the whole workspace (grant to the
 * tenant principal — covers all current and future members) or read-only with
 * individual agents and users. Shared between the Brains list and the dataset
 * detail page. Sharing is optimistic — the backend has no "list existing
 * shares" endpoint yet, so the shared set is tracked only for this session.
 */
export default function ShareDatasetModal({ datasetId, datasetName, onClose, pageName = "Brains" }: ShareDatasetModalProps) {
  const { cogniInstance } = useCogniInstance();
  const { tenant } = useTenant();

  // Users — fetched on modal open, scoped to current workspace.
  const usersQuery = useQuery({
    queryKey: ["tenantUsers", tenant?.tenant_id],
    queryFn: () => getTenantUsers(tenant!.tenant_id, cogniInstance!),
    enabled: !!cogniInstance && !!tenant?.tenant_id,
  });
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const [sharedWith, setSharedWith] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState<string | null>(null);
  const [workspacePermission, setWorkspacePermission] = useState<SharePermission>("write");
  const [permissionSelects, setPermissionSelects] = useState<Record<string, SharePermission>>({});

  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  const getPermission = (id: string): SharePermission => permissionSelects[id] ?? "read";
  const setPermission = (id: string, perm: SharePermission) =>
    setPermissionSelects((prev) => ({ ...prev, [id]: perm }));
  // Every non-read permission also grants read so the principal can list/query.
  const toPermissions = (perm: SharePermission): SharePermission[] =>
    perm === "read" ? ["read"] : ["read", perm];

  // The tenant is itself a principal, so granting to it covers every current
  // AND future workspace member — nothing runs at member-join time.
  const workspacePrincipalId = tenant?.tenant_id ?? null;

  // Roles — fetched on modal open. Handles 403 gracefully for non-admin users.
  const rolesQuery = useQuery({
    queryKey: ["tenantRoles", tenant?.tenant_id],
    queryFn: () => getTenantRoles(tenant!.tenant_id, cogniInstance!),
    enabled: !!cogniInstance && !!tenant?.tenant_id,
    retry: false,
  });
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);

  async function handleShare(principalId: string, permissions: SharePermission[] = ["read"]) {
    if (!cogniInstance) return;
    setSharing(principalId);
    try {
      for (const permission of permissions) {
        await cogniInstance.fetch(`/v1/permissions/datasets/${principalId}?permission_name=${permission}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([datasetId]),
        });
      }
      trackEvent({ pageName, eventName: "dataset_shared", additionalProperties: { dataset_id: datasetId, agent_id: principalId, permission: permissions.join("+") } });
      setSharedWith((prev) => new Set([...prev, principalId]));
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setSharing(null);
    }
  }

  function handleShareWithWorkspace() {
    if (!workspacePrincipalId) return;
    handleShare(workspacePrincipalId, toPermissions(workspacePermission));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(15,15,15,0.92)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 24, width: 480, maxHeight: "70vh", overflow: "auto", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#EDECEA", margin: 0 }}>Share brain</h2>
          <button onClick={onClose} className="cursor-pointer" style={{ background: "none", border: "none", color: "rgba(237,236,234,0.5)", fontSize: 18 }}>&#10005;</button>
        </div>
        <p style={{ fontSize: 13, color: "rgba(237,236,234,0.55)", margin: 0 }}>Share <strong>{datasetName}</strong> with your whole workspace, or grant read access to individual agents and users.</p>

        {workspacePrincipalId && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(101,16,244,0.45)", background: "rgba(101,16,244,0.08)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#6510F4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#EDECEA" }}>Everyone in workspace</span>
              <span style={{ fontSize: 12, color: "rgba(237,236,234,0.4)" }}>All current and future members</span>
            </div>
            {sharedWith.has(workspacePrincipalId) ? (
              <span style={{ fontSize: 12, color: "#22C55E", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Shared
              </span>
            ) : (
              <>
                <PermissionDropdown value={workspacePermission} onChange={setWorkspacePermission} />
                <button
                  onClick={handleShareWithWorkspace}
                  disabled={sharing === workspacePrincipalId}
                  className="cursor-pointer hover:bg-[#5A0ED6]"
                  style={{ background: "#6510F4", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 500 }}
                >
                  {sharing === workspacePrincipalId ? "Sharing..." : "Share"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Tab switcher */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {(["users", "roles"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="cursor-pointer"
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: 14,
                fontWeight: 500,
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #6510F4" : "2px solid transparent",
                color: activeTab === tab ? "#EDECEA" : "rgba(237,236,234,0.4)",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab === "users" ? "Users" : "Roles"}
            </button>
          ))}
        </div>

        {activeTab === "users" ? (
          users.length === 0 ? (
            <span style={{ fontSize: 13, color: "rgba(237,236,234,0.35)", padding: "16px 0" }}>No workspace members found.</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {users.map((u) => {
                const isShared = sharedWith.has(u.id);
                const isSharing = sharing === u.id;
                // Derive display info from workspace member (tenant-scoped user list).
                const isAgent = u.email.endsWith("@cognee.agent");
                let displayName: string;
                let sub: string;
                if (isAgent) {
                  const localPart = u.email.split("@")[0];
                  if (localPart.includes("+")) {
                    const [name, shortId] = localPart.split("+");
                    displayName = name.replace(/-/g, " ").replace(/_/g, " ");
                    sub = shortId;
                  } else {
                    displayName = localPart.replace(/-/g, " ").replace(/_/g, " ");
                    sub = "Agent";
                  }
                } else if (u.email === "default_user@example.com") {
                  displayName = "Human User";
                  sub = "Owner";
                } else {
                  displayName = u.email;
                  sub = u.roles.length > 0 ? u.roles.map((r) => r.name).join(", ") : "User";
                }
                return (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: isAgent ? "#6510F4" : "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{displayName.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#EDECEA" }}>{displayName}</span>
                      <span style={{ fontSize: 12, color: "rgba(237,236,234,0.4)" }}>{sub}</span>
                    </div>
                    {isShared ? (
                      <span style={{ fontSize: 12, color: "#22C55E", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        Shared
                      </span>
                    ) : (
                      <>
                        <PermissionDropdown value={getPermission(u.id)} onChange={(perm) => setPermission(u.id, perm)} />
                        <button
                          onClick={() => handleShare(u.id, toPermissions(getPermission(u.id)))}
                          disabled={isSharing}
                          className="cursor-pointer hover:bg-[#5A0ED6]"
                          style={{ background: "#6510F4", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 500 }}
                        >
                          {isSharing ? "Sharing..." : "Share"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : rolesQuery.isError ? (
          <span style={{ fontSize: 13, color: "rgba(237,236,234,0.35)", padding: "16px 0" }}>Role management requires admin permissions.</span>
        ) : roles.length === 0 ? (
          <span style={{ fontSize: 13, color: "rgba(237,236,234,0.35)", padding: "16px 0" }}>No roles found.</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {roles.map((role) => {
              const isShared = sharedWith.has(role.id);
              const isSharing = sharing === role.id;
              const isAdmin = role.name === "admin";
              return (
                <div key={role.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: isAdmin ? "#6510F4" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={isAdmin ? "#fff" : "rgba(237,236,234,0.6)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={isAdmin ? "#fff" : "rgba(237,236,234,0.6)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#EDECEA" }}>{role.name}</span>
                      {isAdmin && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#6510F4", background: "rgba(101,16,244,0.12)", borderRadius: 4, padding: "1px 6px" }}>ADMIN</span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "rgba(237,236,234,0.4)" }}>
                      {role.description ?? `${role.user_count} member${role.user_count !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                  {isShared ? (
                    <span style={{ fontSize: 12, color: "#22C55E", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Shared
                    </span>
                  ) : (
                    <>
                      <PermissionDropdown value={getPermission(role.id)} onChange={(perm) => setPermission(role.id, perm)} />
                      <button
                        onClick={() => handleShare(role.id, toPermissions(getPermission(role.id)))}
                        disabled={isSharing}
                        className="cursor-pointer hover:bg-[#5A0ED6]"
                        style={{ background: "#6510F4", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 500 }}
                      >
                        {isSharing ? "Sharing..." : "Share"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
