"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Stack, Text, TextInput, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import {
  getTenantUsers,
  addMemberByEmail,
  removeMember,
  getTenantRoles,
  addRoleToUser,
  removeRoleFromUser,
  createTenantRole,
  deleteTenantRole,
  type Member,
  type TenantRole,
} from "@/modules/users/members";
import PageLoading from "@/ui/elements/PageLoading";
import SkeletonBar from "@/ui/elements/SkeletonBar";
import { PlusIcon, CloseIcon, DeleteIcon } from "@/ui/icons";

// ── Shared tokens (keep in sync with the rest of the UI) ──
const C = {
  surfaceBg: "rgba(255,255,255,0.06)",
  surfaceBorder: "1px solid rgba(255,255,255,0.1)",
  textPrimary: "#EDECEA",
  textMuted: "rgba(237,236,234,0.55)",
  textDim: "rgba(237,236,234,0.35)",
  textExtraDim: "rgba(237,236,234,0.3)",
  accent: "#BC9BFF",
  accentBg: "rgba(188,155,255,0.18)",
  accentBorder: "1px solid rgba(188,155,255,0.3)",
  danger: "#EF4444",
  dangerBg: "rgba(239,68,68,0.15)",
} as const;

// ── Card shell ──
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.surfaceBg,
        backdropFilter: "blur(12px)",
        border: C.surfaceBorder,
        borderRadius: 12,
        padding: "1.25rem 1.5rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Icons (only those without shared versions) ──
function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PersonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(237,236,234,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0113 0" />
    </svg>
  );
}

function ChevronDown({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

// ── Role badge ──
function RoleBadge({
  role,
  onRemove,
  editable,
}: {
  role: string;
  onRemove?: () => void;
  editable?: boolean;
}) {
  const isAdmin = role.toLowerCase() === "admin";
  return (
    <span
      onClick={editable ? onRemove : undefined}
      title={editable ? `Click to remove ${role} role` : undefined}
      onKeyDown={editable ? (e) => { if (e.key === "Enter") onRemove?.(); } : undefined}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: editable ? 4 : 0,
        padding: `2px ${editable ? 6 : 8}px 2px 8px`,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: isAdmin ? C.accentBg : "rgba(255,255,255,0.08)",
        color: isAdmin ? C.accent : C.textMuted,
        border: isAdmin ? C.accentBorder : C.surfaceBorder,
        cursor: editable ? "pointer" : "default",
        userSelect: "none",
        transition: "opacity 120ms ease",
      }}
      onMouseEnter={editable ? (e) => { e.currentTarget.style.opacity = "0.7"; } : undefined}
      onMouseLeave={editable ? (e) => { e.currentTarget.style.opacity = "1"; } : undefined}
    >
      {role}
      {editable && <CloseIcon width={8} height={8} color="currentColor" />}
    </span>
  );
}

// ── Notification helper ──
function notifyOk(msg: string) {
  notifications.show({ message: msg, color: "green", autoClose: 3500 });
}
function notifyErr(msg: string) {
  notifications.show({ title: "Error", message: msg, color: "red", autoClose: 6000 });
}

// ── Page ──
export default function MembersPage() {
  const { cogniInstance, isInitializing } = useCogniInstance();
  const { tenant, isOwner, tenantReady } = useTenant();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role editing state
  const [availableRoles, setAvailableRoles] = useState<TenantRole[]>([]);
  const [openRoleMenuId, setOpenRoleMenuId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [createRoleLoading, setCreateRoleLoading] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Add member state
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Remove member state
  const [removingId, setRemovingId] = useState<string | null>(null);

  const tenantId = tenant?.tenant_id;

  // Close role menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setOpenRoleMenuId(null);
        setNewRoleName("");
      }
    }
    if (openRoleMenuId) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openRoleMenuId]);

  const loadMembers = useCallback(async () => {
    if (!tenantId || !cogniInstance) return;
    setLoading(true);
    setError(null);
    try {
      const [data, roles] = await Promise.all([
        getTenantUsers(tenantId, cogniInstance),
        getTenantRoles(tenantId, cogniInstance),
      ]);
      setMembers(data);
      setAvailableRoles(roles);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load members";
      setError(msg);
      notifyErr(msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId, cogniInstance]);

  useEffect(() => {
    if (tenantReady && cogniInstance) {
      loadMembers();
    }
  }, [tenantReady, cogniInstance, loadMembers]);

  // ── Role actions ──
  const handleAddRole = async (userId: string, roleId: string) => {
    if (!cogniInstance) return;
    try {
      await addRoleToUser(userId, roleId, cogniInstance);
      notifyOk("Role assigned.");
      await loadMembers();
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : "Failed to assign role.");
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    if (!cogniInstance) return;
    try {
      await removeRoleFromUser(userId, roleId, cogniInstance);
      notifyOk("Role removed.");
      await loadMembers();
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : "Failed to remove role.");
    }
  };

  const handleCreateRole = async () => {
    if (!cogniInstance || !tenantId || !newRoleName.trim()) return;
    setCreateRoleLoading(true);
    try {
      await createTenantRole(tenantId, newRoleName.trim(), cogniInstance);
      notifyOk(`Role "${newRoleName.trim()}" created.`);
      setNewRoleName("");
      // Refresh roles list
      const roles = await getTenantRoles(tenantId, cogniInstance);
      setAvailableRoles(roles);
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : "Failed to create role.");
    } finally {
      setCreateRoleLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!cogniInstance) return;
    modals.openConfirmModal({
      title: "Delete role?",
      children: (
        <Text size="sm" style={{ color: C.textMuted }}>
          This will remove &ldquo;{roleName}&rdquo; from all members and delete the role permanently.
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete role", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        setDeletingRoleId(roleId);
        try {
          await deleteTenantRole(roleId, cogniInstance);
          notifyOk(`Role "${roleName}" deleted.`);
          setAvailableRoles((prev) => prev.filter((r) => r.id !== roleId));
          await loadMembers();
        } catch (e) {
          notifyErr(e instanceof Error ? e.message : "Failed to delete role.");
        } finally {
          setDeletingRoleId(null);
        }
      },
    });
  };

  // ── Add / Remove member ──
  const handleAdd = async () => {
    if (!tenantId || !cogniInstance || !addEmail.trim()) return;

    const email = addEmail.trim();
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError("Please enter a valid email address.");
      return;
    }

    setAdding(true);
    setAddError(null);
    try {
      await addMemberByEmail(email, tenantId, cogniInstance);
      notifyOk(`"${email}" added to workspace.`);
      setAddEmail("");
      await loadMembers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add member";
      setAddError(msg);
      notifyErr(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!tenantId || !cogniInstance) return;
    modals.openConfirmModal({
      title: "Remove member?",
      children: (
        <Text size="sm" style={{ color: C.textMuted }}>
          Remove <strong>{email}</strong> from this workspace?
          They will lose access to all datasets and resources.
        </Text>
      ),
      labels: { confirm: "Remove", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        setRemovingId(userId);
        try {
          await removeMember(tenantId, userId, cogniInstance);
          notifyOk(`"${email}" removed from workspace.`);
          await loadMembers();
        } catch (e) {
          notifyErr(e instanceof Error ? e.message : "Failed to remove member.");
        } finally {
          setRemovingId(null);
        }
      },
    });
  };

  // ── Loading ──
  if (isInitializing || !tenantReady) {
    return <PageLoading name="Members" />;
  }

  if (!tenantId || !cogniInstance) {
    return (
      <Stack className="h-full items-center justify-center" gap="xs">
        <Text style={{ color: C.textMuted, fontSize: 15 }}>
          Workspace not available.
        </Text>
      </Stack>
    );
  }

  const memberCount = loading ? 0 : members.length;
  // Determine which roles are already assigned to at least one member
  const assignedRoleIds = new Set(members.flatMap((m) => m.roles.map((r) => r.id)));
  const unusedRoles = availableRoles.filter((r) => !assignedRoleIds.has(r.id));

  return (
    <Stack className="!gap-[0.625rem] h-full p-[1.25rem]">
      {/* Heading */}
      <div style={{ marginBottom: "0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 20, fontWeight: 300, color: C.textPrimary, margin: 0, fontFamily: '"TWKLausanne", sans-serif' }}>
            Members
          </h2>
          {memberCount > 0 && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 22,
              height: 22,
              borderRadius: 6,
              background: C.accentBg,
              color: C.accent,
              fontSize: 11,
              fontWeight: 600,
              padding: "0 6px",
            }}>
              {memberCount}
            </span>
          )}
        </div>
        <Text size="sm" style={{ color: C.textMuted, marginTop: 4 }}>
          Manage members, roles, and access to this workspace.
        </Text>
      </div>

      {/* Add member form (owner only) */}
      {isOwner && (
        <Card>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <TextInput
                type="email"
                placeholder="Enter email address"
                value={addEmail}
                onChange={(e) => {
                  setAddEmail(e.currentTarget.value);
                  if (addError) setAddError(null);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                disabled={adding}
                error={addError}
                autoComplete="email"
                aria-label="Member email address"
                styles={{
                  input: {
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${addError ? C.danger : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 8,
                    color: C.textPrimary,
                    fontSize: 14,
                    height: 40,
                    "&:focus": { borderColor: addError ? C.danger : "rgba(188,155,255,0.5)" },
                    "&::placeholder": { color: "rgba(237,236,234,0.35)" },
                  },
                  error: { fontSize: 12 },
                }}
              />
            </div>
            <Button
              onClick={handleAdd}
              loading={adding}
              disabled={!addEmail.trim() || adding}
              leftSection={<PlusIcon width={12} height={12} color="#fff" />}
              styles={{
                root: {
                  background: "linear-gradient(135deg, #6510F4, #8B5CF6)",
                  borderRadius: 8,
                  border: "none",
                  height: 40,
                  padding: "0 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  transition: "opacity 120ms ease",
                  "&:hover": { opacity: 0.9 },
                  "&:disabled": { opacity: 0.4 },
                },
              }}
            >
              Add Member
            </Button>
          </div>
        </Card>
      )}

      {/* Member list */}
      <Card style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0.5rem 0" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                <SkeletonBar width={180} height={14} />
                <div style={{ flex: 1 }} />
                <SkeletonBar width={60} height={20} />
                <SkeletonBar width={20} height={20} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <Text size="sm" style={{ color: C.danger, marginBottom: 12 }}>{error}</Text>
            <Button onClick={loadMembers} variant="subtle" size="xs"
              styles={{
                root: { color: C.accent, "&:hover": { background: "rgba(188,155,255,0.1)" } },
              }}>
              Retry
            </Button>
          </div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div style={{ marginBottom: 12 }}><UsersIcon /></div>
            <Text size="sm" style={{ color: C.textDim, marginBottom: 4 }}>No members yet.</Text>
            <Text size="xs" style={{ color: C.textExtraDim }}>
              {isOwner ? "Add members by email above to get started." : "Ask a workspace owner to add members."}
            </Text>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "center",
              padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 2,
            }}>
              <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Member
              </Text>
              <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Roles
              </Text>
              <div style={{ width: 40 }} />
            </div>

            {/* Rows */}
            {members.map((member) => {
              const isEditingRoles = openRoleMenuId === member.id;
              const memberRoleIds = new Set(member.roles.map((r) => r.id));

              return (
                <div
                  key={member.id}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "center",
                    padding: "10px 0", borderRadius: 8,
                    transition: "background 120ms ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Email */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "rgba(188,155,255,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <PersonIcon size={18} />
                    </div>
                    <Text size="sm" style={{ color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={member.email}>
                      {member.email}
                    </Text>
                  </div>

                  {/* Roles column */}
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                      {member.roles.map((role) => (
                        <RoleBadge
                          key={role.id}
                          role={role.name}
                          editable={isOwner}
                          onRemove={() => handleRemoveRole(member.id, role.id)}
                        />
                      ))}
                      {member.roles.length === 0 && (
                        <Text size="xs" style={{ color: C.textExtraDim }}>No roles</Text>
                      )}
                      {/* Add role button (owner only) */}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRoleMenuId(isEditingRoles ? null : member.id);
                            setNewRoleName("");
                          }}
                          aria-label={isEditingRoles ? "Close role menu" : "Add role"}
                          aria-expanded={isEditingRoles}
                          style={{
                            background: isEditingRoles ? "rgba(188,155,255,0.15)" : "transparent",
                            border: "none",
                            cursor: "pointer",
                            borderRadius: 4,
                            width: 22, height: 22,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: isEditingRoles ? C.accent : "rgba(237,236,234,0.25)",
                            transition: "color 120ms ease, background 120ms ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isEditingRoles) e.currentTarget.style.color = "rgba(237,236,234,0.6)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isEditingRoles) e.currentTarget.style.color = "rgba(237,236,234,0.25)";
                          }}
                        >
                          <PlusIcon width={10} height={10} color="currentColor" />
                        </button>
                      )}
                    </div>

                    {/* Role dropdown */}
                    {isEditingRoles && (
                      <div
                        ref={roleMenuRef}
                        style={{
                          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50,
                          background: "#1a1a1a", borderRadius: 8,
                          boxShadow: "0px 8px 30px rgba(0,0,0,0.5), 0px 0px 0px 1px rgba(255,255,255,0.08)",
                          padding: 6, minWidth: 200, maxHeight: 280, overflowY: "auto",
                        }}
                      >
                        {availableRoles.length === 0 && (
                          <div style={{ padding: "8px 10px" }}>
                            <Text size="xs" style={{ color: C.textExtraDim }}>No roles yet</Text>
                          </div>
                        )}
                        {availableRoles.map((role) => {
                          const alreadyAssigned = memberRoleIds.has(role.id);
                          const isDeleting = deletingRoleId === role.id;
                          return (
                            <div
                              key={role.id}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "6px 10px", borderRadius: 6, fontSize: 13,
                                color: alreadyAssigned ? "rgba(237,236,234,0.35)" : "rgba(237,236,234,0.8)",
                                transition: "background 120ms ease",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              <span
                                onClick={() => { if (!alreadyAssigned) { handleAddRole(member.id, role.id); setOpenRoleMenuId(null); } }}
                                title={alreadyAssigned ? "Already assigned" : `Assign ${role.name} role`}
                                style={{ flex: 1, cursor: alreadyAssigned ? "default" : "pointer" }}
                              >
                                {role.name}
                                {alreadyAssigned && (
                                  <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.5 }}>(assigned)</span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id, role.name); }}
                                disabled={isDeleting}
                                aria-label={`Delete role ${role.name}`}
                                style={{
                                  background: "none", border: "none",
                                  cursor: isDeleting ? "not-allowed" : "pointer",
                                  padding: 2, borderRadius: 3,
                                  display: "flex", alignItems: "center",
                                  color: "rgba(237,236,234,0.2)",
                                  opacity: isDeleting ? 0.5 : 1,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isDeleting) {
                                    e.currentTarget.style.color = C.danger;
                                    e.currentTarget.style.background = C.dangerBg;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "rgba(237,236,234,0.2)";
                                  e.currentTarget.style.background = "transparent";
                                }}
                              >
                                <DeleteIcon width={12} height={14} color="currentColor" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Create new role */}
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 4, paddingTop: 4 }}>
                          <div style={{ display: "flex", gap: 4, padding: "2px 10px" }}>
                            <input
                              placeholder="New role name..."
                              value={newRoleName}
                              onChange={(e) => setNewRoleName(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { handleCreateRole(); e.preventDefault(); }
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              maxLength={64}
                              aria-label="New role name"
                              style={{
                                flex: 1, background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
                                color: C.textPrimary, fontSize: 12, padding: "4px 6px", outline: "none",
                              }}
                            />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleCreateRole(); }}
                              disabled={!newRoleName.trim() || createRoleLoading}
                              style={{
                                background: newRoleName.trim() ? "rgba(188,155,255,0.2)" : "transparent",
                                border: "none", borderRadius: 4,
                                cursor: newRoleName.trim() ? "pointer" : "default",
                                color: newRoleName.trim() ? C.accent : "rgba(237,236,234,0.2)",
                                fontSize: 18, lineHeight: "18px", padding: "0 6px", fontWeight: 700,
                                transition: "color 120ms ease",
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remove (owner only) */}
                  <div style={{ width: 40, display: "flex", justifyContent: "center" }}>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleRemove(member.id, member.email)}
                        disabled={removingId === member.id}
                        aria-label={`Remove ${member.email}`}
                        style={{
                          background: "none", border: "none",
                          cursor: removingId === member.id ? "not-allowed" : "pointer",
                          padding: 4, borderRadius: 6,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "rgba(237,236,234,0.3)",
                          opacity: removingId === member.id ? 0.5 : 1,
                          transition: "color 120ms ease, background 120ms ease",
                        }}
                        onMouseEnter={(e) => {
                          if (removingId !== member.id) {
                            e.currentTarget.style.color = C.danger;
                            e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "rgba(237,236,234,0.3)";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <DeleteIcon width={14} height={16} color="currentColor" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Roles management (owner only) */}
      {isOwner && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ color: C.accent }}><ShieldCheckIcon /></span>
            <Text size="sm" style={{ color: C.textPrimary, fontWeight: 600 }}>
              Roles
            </Text>
            {availableRoles.length > 0 && (
              <span style={{
                fontSize: 11, color: C.textMuted,
                background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 7px",
              }}>
                {availableRoles.length}
              </span>
            )}
          </div>

          {availableRoles.length === 0 ? (
            <Text size="sm" style={{ color: C.textDim }}>
              No roles defined yet. Create roles to assign permissions to members.
            </Text>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {availableRoles.map((role) => {
                const isDeleting = deletingRoleId === role.id;
                const assigned = assignedRoleIds.has(role.id);
                return (
                  <div
                    key={role.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: assigned ? C.accentBg : "rgba(255,255,255,0.04)",
                      border: assigned ? C.accentBorder : "1px solid rgba(255,255,255,0.06)",
                      fontSize: 13,
                      color: assigned ? C.accent : C.textMuted,
                      transition: "opacity 120ms ease",
                      opacity: isDeleting ? 0.5 : 1,
                    }}
                    title={assigned ? `Assigned to ${role.user_count} member(s)` : "Unused role"}
                  >
                    <span>{role.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(role.id, role.name)}
                      disabled={isDeleting}
                      aria-label={`Delete role ${role.name}`}
                      style={{
                        background: "none", border: "none",
                        cursor: isDeleting ? "not-allowed" : "pointer",
                        padding: 2, borderRadius: 3,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "rgba(237,236,234,0.2)",
                        transition: "color 120ms ease, background 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isDeleting) {
                          e.currentTarget.style.color = C.danger;
                          e.currentTarget.style.background = C.dangerBg;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(237,236,234,0.2)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <DeleteIcon width={10} height={12} color="currentColor" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create role inline */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <TextInput
              placeholder="New role name..."
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { handleCreateRole(); e.preventDefault(); }
              }}
              maxLength={64}
              aria-label="Create a new role"
              disabled={createRoleLoading}
              styles={{
                input: {
                  background: "rgba(255,255,255,0.06)",
                  border: `${C.surfaceBorder}`,
                  borderRadius: 8,
                  color: C.textPrimary,
                  fontSize: 13,
                  height: 36,
                  width: 180,
                  "&:focus": { borderColor: "rgba(188,155,255,0.5)" },
                  "&::placeholder": { color: "rgba(237,236,234,0.35)" },
                },
              }}
            />
            <Button
              onClick={handleCreateRole}
              loading={createRoleLoading}
              disabled={!newRoleName.trim() || createRoleLoading}
              leftSection={<PlusIcon width={12} height={12} color="#fff" />}
              styles={{
                root: {
                  background: "linear-gradient(135deg, #6510F4, #8B5CF6)",
                  borderRadius: 8,
                  border: "none",
                  height: 36,
                  padding: "0 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#fff",
                  transition: "opacity 120ms ease",
                  "&:hover": { opacity: 0.9 },
                  "&:disabled": { opacity: 0.4 },
                },
              }}
            >
              Create
            </Button>
          </div>
        </Card>
      )}
    </Stack>
  );
}
