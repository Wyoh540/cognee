"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import {
  getTenantRoles,
  getTenantUsers,
  getDatasetPermissions,
  type TenantRole,
  type Member,
} from "@/modules/users/members";
import { trackEvent } from "@/modules/analytics";

interface ShareDatasetModalProps {
  datasetId: string;
  datasetName: string;
  onClose: () => void;
  /** Page name used for analytics events. */
  pageName?: string;
}

// ── Permission toggles (independent — backend ACL has no inheritance) ──

const PERMISSION_TOGGLES = [
  { perm: "read" as const, label: "View" },
  { perm: "write" as const, label: "Edit" },
  { perm: "delete" as const, label: "Delete" },
  { perm: "share" as const, label: "Share" },
] as const;

type PermName = (typeof PERMISSION_TOGGLES)[number]["perm"];

/**
 * Four independent toggle buttons — each maps to a separate ACL row.
 * Because the backend checks permissions individually (no inheritance),
 * the user can set any combination.  Toggling any non-read permission
 * auto-adds "read" since a principal must be able to list/query the dataset.
 */
function PermissionToggles({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (perms: string[]) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
      {PERMISSION_TOGGLES.map(({ perm, label }) => {
        const checked = selected.includes(perm);
        return (
          <button
            key={perm}
            type="button"
            onClick={() => {
              let next: string[];
              if (checked) {
                next = selected.filter((p) => p !== perm);
              } else {
                next = [...selected, perm];
                // When any non-read perm is added, ensure "read" is present.
                if (perm !== "read" && !next.includes("read")) {
                  next = [...next, "read"];
                }
              }
              onChange(next);
            }}
            className="cursor-pointer"
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: checked ? 600 : 400,
              border: checked
                ? "1px solid rgba(101,16,244,0.5)"
                : "1px solid rgba(255,255,255,0.1)",
              background: checked ? "rgba(101,16,244,0.16)" : "transparent",
              color: checked ? "rgba(188,155,255,0.85)" : "rgba(237,236,234,0.35)",
              fontFamily: "inherit",
              transition: "all 0.12s",
              lineHeight: "18px",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Shared button style fragments ──

const btnPrimary: React.CSSProperties = {
  background: "#6510F4",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(237,236,234,0.45)",
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: 11,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

// ── Main component ──

export default function ShareDatasetModal({
  datasetId,
  datasetName,
  onClose,
  pageName = "Brains",
}: ShareDatasetModalProps) {
  const { cogniInstance } = useCogniInstance();
  const { tenant } = useTenant();

  // Workspace & users / roles — fetched on open.
  const usersQuery = useQuery({
    queryKey: ["tenantUsers", tenant?.tenant_id],
    queryFn: () => getTenantUsers(tenant!.tenant_id, cogniInstance!),
    enabled: !!cogniInstance && !!tenant?.tenant_id,
  });
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const rolesQuery = useQuery({
    queryKey: ["tenantRoles", tenant?.tenant_id],
    queryFn: () => getTenantRoles(tenant!.tenant_id, cogniInstance!),
    enabled: !!cogniInstance && !!tenant?.tenant_id,
    retry: false,
  });
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);

  // Existing permissions on this dataset — pre-fill on open.
  const permissionsQuery = useQuery({
    queryKey: ["datasetPermissions", datasetId],
    queryFn: () => getDatasetPermissions(datasetId, cogniInstance!),
    enabled: !!cogniInstance && !!datasetId,
  });

  // permissionMap: principal_id → currently-checked permission list.
  // This is the single source of truth for the UI — replaces sharedWith,
  // permissionSelects, and workspacePermission.
  const [permissionMap, setPermissionMap] = useState<Record<string, string[]>>({});
  // serverPermsRef tracks the last-known server state so delta computation
  // (grant / revoke) is always relative to what's actually persisted.
  const serverPermsRef = useRef<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [permsPreloaded, setPermsPreloaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // Pre-fill from the backend query result.
  useEffect(() => {
    if (permissionsQuery.data && !permsPreloaded) {
      const data = permissionsQuery.data;
      const map: Record<string, string[]> = {};
      for (const [principalId, perms] of Object.entries(data)) {
        map[principalId] = perms;
      }
      setPermissionMap(map);
      serverPermsRef.current = { ...map };
      setPermsPreloaded(true);
    }
  }, [permissionsQuery.data, permsPreloaded]);

  const workspacePrincipalId = tenant?.tenant_id ?? null;

  // Accessors for a principal's current checked permissions.
  const getPerms = (id: string): string[] => permissionMap[id] ?? [];
  const setPerms = (id: string, perms: string[]) =>
    setPermissionMap((prev) => ({ ...prev, [id]: perms }));
  const isShared = (id: string): boolean => getPerms(id).length > 0;

  /**
   * Persist permission changes by computing the delta between the last-known
   * server state (serverPermsRef) and the desired set (newPerms).  Grants
   * new permissions via POST and revokes removed ones via DELETE.
   */
  async function handleSavePermissions(principalId: string, newPerms: string[]) {
    if (!cogniInstance) return;

    const oldPerms = serverPermsRef.current[principalId] ?? [];
    const toGrant = newPerms.filter((p) => !oldPerms.includes(p));
    const toRevoke = oldPerms.filter((p) => !newPerms.includes(p));

    if (toGrant.length === 0 && toRevoke.length === 0) return;

    setSaving(principalId);
    try {
      for (const perm of toGrant) {
        await cogniInstance.fetch(
          `/v1/permissions/datasets/${principalId}?permission_name=${perm}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([datasetId]),
          },
        );
      }
      for (const perm of toRevoke) {
        await cogniInstance.fetch(
          `/v1/permissions/datasets/${principalId}?permission_name=${perm}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([datasetId]),
          },
        );
      }

      // Align local state and server snapshot.
      if (newPerms.length === 0) {
        const next = { ...serverPermsRef.current };
        delete next[principalId];
        serverPermsRef.current = next;
      } else {
        serverPermsRef.current = { ...serverPermsRef.current, [principalId]: newPerms };
      }

      setPermissionMap((prev) => {
        if (newPerms.length === 0) {
          const next = { ...prev };
          delete next[principalId];
          return next;
        }
        return { ...prev, [principalId]: newPerms };
      });

      trackEvent({
        pageName,
        eventName: "dataset_permissions_updated",
        additionalProperties: {
          dataset_id: datasetId,
          principal_id: principalId,
          permissions: newPerms.join("+"),
        },
      });
    } catch (err) {
      console.error("Save permissions failed:", err);
    } finally {
      setSaving(null);
    }
  }

  // ── Helpers for deriving display info from members ──

  function deriveUserDisplay(u: Member) {
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
    return { isAgent, displayName, sub };
  }

  // ── Render ──

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(15,15,15,0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: 24,
          width: 560,
          maxHeight: "70vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#EDECEA", margin: 0 }}>
            Share brain
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{
              background: "none",
              border: "none",
              color: "rgba(237,236,234,0.5)",
              fontSize: 18,
            }}
          >
            &#10005;
          </button>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "rgba(237,236,234,0.55)",
            margin: 0,
          }}
        >
          Share <strong>{datasetName}</strong> with your workspace, or manage
          individual permissions for users and roles.
        </p>

        {/* ── Workspace ── */}
        {workspacePrincipalId && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(101,16,244,0.45)",
              background: "rgba(101,16,244,0.08)",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#6510F4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ flex: "1 0 140px", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#EDECEA" }}>
                Everyone in workspace
              </span>
              <span style={{ fontSize: 12, color: "rgba(237,236,234,0.4)" }}>
                All current and future members
              </span>
            </div>
            <PermissionToggles
              selected={getPerms(workspacePrincipalId)}
              onChange={(perms) => setPerms(workspacePrincipalId, perms)}
            />
            <button
              onClick={() =>
                handleSavePermissions(workspacePrincipalId, getPerms(workspacePrincipalId))
              }
              disabled={saving === workspacePrincipalId}
              className="cursor-pointer hover:bg-[#5A0ED6]"
              style={btnPrimary}
            >
              {saving === workspacePrincipalId
                ? "Saving..."
                : isShared(workspacePrincipalId)
                  ? "Update"
                  : "Share"}
            </button>
          </div>
        )}

        {/* ── Tab switcher ── */}
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

        {/* ── Users tab ── */}
        {activeTab === "users" ? (
          users.length === 0 ? (
            <span
              style={{
                fontSize: 13,
                color: "rgba(237,236,234,0.35)",
                padding: "16px 0",
              }}
            >
              No workspace members found.
            </span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {users.map((u) => {
                const { isAgent, displayName, sub } = deriveUserDisplay(u);
                const perms = getPerms(u.id);
                const isSaving = saving === u.id;
                return (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.08)",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isAgent ? "#6510F4" : "#3B82F6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}
                      >
                        {displayName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: "1 0 100px", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#EDECEA",
                          display: "block",
                        }}
                      >
                        {displayName}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "rgba(237,236,234,0.4)",
                          display: "block",
                        }}
                      >
                        {sub}
                      </span>
                    </div>
                    <PermissionToggles
                      selected={perms}
                      onChange={(next) => setPerms(u.id, next)}
                    />
                    <button
                      onClick={() => handleSavePermissions(u.id, getPerms(u.id))}
                      disabled={isSaving}
                      className="cursor-pointer hover:bg-[#5A0ED6]"
                      style={btnPrimary}
                    >
                      {isSaving ? "Saving..." : isShared(u.id) ? "Update" : "Share"}
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : rolesQuery.isError ? (
          <span
            style={{
              fontSize: 13,
              color: "rgba(237,236,234,0.35)",
              padding: "16px 0",
            }}
          >
            Role management requires admin permissions.
          </span>
        ) : roles.length === 0 ? (
          <span
            style={{
              fontSize: 13,
              color: "rgba(237,236,234,0.35)",
              padding: "16px 0",
            }}
          >
            No roles found.
          </span>
        ) : (
          /* ── Roles tab ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {roles.map((role) => {
              const perms = getPerms(role.id);
              const isSaving = saving === role.id;
              const isAdmin = role.name === "admin";
              return (
                <div
                  key={role.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: isAdmin ? "#6510F4" : "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                        stroke={isAdmin ? "#fff" : "rgba(237,236,234,0.6)"}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                        stroke={isAdmin ? "#fff" : "rgba(237,236,234,0.6)"}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div style={{ flex: "1 0 100px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#EDECEA",
                        }}
                      >
                        {role.name}
                      </span>
                      {isAdmin && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#6510F4",
                            background: "rgba(101,16,244,0.12)",
                            borderRadius: 4,
                            padding: "1px 6px",
                          }}
                        >
                          ADMIN
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(237,236,234,0.4)",
                        display: "block",
                      }}
                    >
                      {role.description ??
                        `${role.user_count} member${role.user_count !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <PermissionToggles
                    selected={perms}
                    onChange={(next) => setPerms(role.id, next)}
                  />
                  <button
                    onClick={() => handleSavePermissions(role.id, getPerms(role.id))}
                    disabled={isSaving}
                    className="cursor-pointer hover:bg-[#5A0ED6]"
                    style={btnPrimary}
                  >
                    {isSaving ? "Saving..." : isShared(role.id) ? "Update" : "Share"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
