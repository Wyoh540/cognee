"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Stack, Text, TextInput, Button } from "@mantine/core";
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

// ── Card shell ──
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: "1.5rem 2rem 1.75rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Icons ──
function PlusIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(237,236,234,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0113 0" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseX({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: editable ? 4 : 0,
        padding: `2px ${editable ? 6 : 8}px 2px 8px`,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: isAdmin ? "rgba(188,155,255,0.18)" : "rgba(255,255,255,0.08)",
        color: isAdmin ? "#BC9BFF" : "rgba(237,236,234,0.55)",
        border: isAdmin ? "1px solid rgba(188,155,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
        cursor: editable ? "pointer" : "default",
        userSelect: "none",
        transition: "background 120ms ease, opacity 120ms ease",
      }}
      onMouseEnter={editable ? (e) => { e.currentTarget.style.opacity = "0.7"; } : undefined}
      onMouseLeave={editable ? (e) => { e.currentTarget.style.opacity = "1"; } : undefined}
    >
      {role}
      {editable && <CloseX size={8} />}
    </span>
  );
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
      setError(e instanceof Error ? e.message : "Failed to load members");
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
      await loadMembers();
    } catch (e) {
      console.error("Failed to add role:", e);
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    if (!cogniInstance) return;
    try {
      await removeRoleFromUser(userId, roleId, cogniInstance);
      await loadMembers();
    } catch (e) {
      console.error("Failed to remove role:", e);
    }
  };

  const handleCreateRole = async () => {
    if (!cogniInstance || !tenantId || !newRoleName.trim()) return;
    setCreateRoleLoading(true);
    try {
      const newRole = await createTenantRole(tenantId, newRoleName.trim(), cogniInstance);
      setAvailableRoles((prev) => [...prev, newRole]);
      setNewRoleName("");
    } catch (e) {
      console.error("Failed to create role:", e);
    } finally {
      setCreateRoleLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!cogniInstance) return;
    if (!window.confirm("Delete this role? All members with this role will lose it.")) return;
    setDeletingRoleId(roleId);
    try {
      await deleteTenantRole(roleId, cogniInstance);
      setAvailableRoles((prev) => prev.filter((r) => r.id !== roleId));
      await loadMembers();
    } catch (e) {
      console.error("Failed to delete role:", e);
    } finally {
      setDeletingRoleId(null);
    }
  };

  // ── Add / Remove member ──
  const handleAdd = async () => {
    if (!tenantId || !cogniInstance || !addEmail.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await addMemberByEmail(addEmail.trim(), tenantId, cogniInstance);
      setAddEmail("");
      await loadMembers();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!tenantId || !cogniInstance) return;
    setRemovingId(userId);
    try {
      await removeMember(tenantId, userId, cogniInstance);
      await loadMembers();
    } finally {
      setRemovingId(null);
    }
  };

  // ── Loading ──
  if (isInitializing || !tenantReady) {
    return <PageLoading name="Members" />;
  }

  if (!tenantId || !cogniInstance) {
    return (
      <Stack className="h-full items-center justify-center" gap="xs">
        <Text style={{ color: "rgba(237,236,234,0.5)", fontSize: 15 }}>
          Workspace not available.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack className="!gap-[0.625rem] h-full p-[1.25rem]">
      {/* Heading */}
      <div style={{ marginBottom: "0.25rem" }}>
        <h2 style={{ fontSize: 20, fontWeight: 300, color: "#EDECEA", margin: 0, fontFamily: '"TWKLausanne", sans-serif' }}>
          Members
        </h2>
        <Text size="sm" style={{ color: "rgba(237,236,234,0.55)", marginTop: 4 }}>
          Manage members, roles, and access to this workspace.
        </Text>
      </div>

      {/* Add member form (owner only) */}
      {isOwner && (
        <Card>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <TextInput
                placeholder="Enter email address"
                value={addEmail}
                onChange={(e) => setAddEmail(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                disabled={adding}
                styles={{
                  input: {
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    color: "#EDECEA",
                    fontSize: 14,
                    height: 40,
                    "&:focus": { borderColor: "rgba(188,155,255,0.5)" },
                    "&::placeholder": { color: "rgba(237,236,234,0.35)" },
                  },
                }}
              />
            </div>
            <Button
              onClick={handleAdd}
              loading={adding}
              disabled={!addEmail.trim() || adding}
              leftSection={<PlusIcon size={12} />}
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
                  "&:hover": { opacity: 0.9 },
                  "&:disabled": { opacity: 0.4 },
                },
              }}
            >
              Add Member
            </Button>
          </div>
          {addError && (
            <Text size="xs" style={{ color: "#EF4444", marginTop: 8 }}>{addError}</Text>
          )}
        </Card>
      )}

      {/* Member list */}
      <Card style={{ flex: 1 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "2rem 0" }}>
            <Text size="sm" style={{ color: "rgba(237,236,234,0.35)" }}>Loading members...</Text>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <Text size="sm" style={{ color: "#EF4444", marginBottom: 12 }}>{error}</Text>
            <Button onClick={loadMembers} variant="subtle" size="xs"
              styles={{ root: { color: "#BC9BFF", "&:hover": { background: "rgba(188,155,255,0.1)" } } }}>
              Retry
            </Button>
          </div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div style={{ marginBottom: 12 }}><UsersIcon /></div>
            <Text size="sm" style={{ color: "rgba(237,236,234,0.35)" }}>No members yet.</Text>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "center",
              padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <Text size="xs" style={{ color: "rgba(237,236,234,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Member
              </Text>
              <Text size="xs" style={{ color: "rgba(237,236,234,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
                    padding: "10px 12px", borderRadius: 8,
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
                    }}>
                      <PersonIcon />
                    </div>
                    <Text size="sm" style={{ color: "#EDECEA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={member.email}>
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
                        <Text size="xs" style={{ color: "rgba(237,236,234,0.3)" }}>—</Text>
                      )}
                      {/* Add role button (owner only) */}
                      {isOwner && (
                        <button
                          onClick={() => {
                            setOpenRoleMenuId(isEditingRoles ? null : member.id);
                            setNewRoleName("");
                          }}
                          aria-label="Add role"
                          title="Add role"
                          style={{
                            background: isEditingRoles ? "rgba(188,155,255,0.15)" : "transparent",
                            border: "none",
                            cursor: "pointer",
                            borderRadius: 4,
                            width: 22, height: 22,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: isEditingRoles ? "#BC9BFF" : "rgba(237,236,234,0.25)",
                            transition: "color 120ms ease, background 120ms ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isEditingRoles) e.currentTarget.style.color = "rgba(237,236,234,0.6)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isEditingRoles) e.currentTarget.style.color = "rgba(237,236,234,0.25)";
                          }}
                        >
                          <PlusIcon size={10} />
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
                          padding: 6, minWidth: 180, maxHeight: 240, overflowY: "auto",
                        }}
                      >
                        {availableRoles.length === 0 && (
                          <div style={{ padding: "8px 10px" }}>
                            <Text size="xs" style={{ color: "rgba(237,236,234,0.3)" }}>No roles yet</Text>
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
                                  <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.5 }}>assigned</span>
                                )}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                                disabled={isDeleting}
                                aria-label={`Delete role ${role.name}`}
                                title="Delete role"
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
                                    e.currentTarget.style.color = "#EF4444";
                                    e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "rgba(237,236,234,0.2)";
                                  e.currentTarget.style.background = "transparent";
                                }}
                              >
                                <TrashIcon size={12} />
                              </button>
                            </div>
                          );
                        })}

                        {/* Create new role */}
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 4, paddingTop: 4 }}>
                          <div style={{ display: "flex", gap: 4, padding: "2px 10px" }}>
                            <input
                              placeholder="New role..."
                              value={newRoleName}
                              onChange={(e) => setNewRoleName(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateRole();
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                flex: 1, background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
                                color: "#EDECEA", fontSize: 12, padding: "4px 6px", outline: "none",
                              }}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCreateRole(); }}
                              disabled={!newRoleName.trim() || createRoleLoading}
                              style={{
                                background: newRoleName.trim() ? "rgba(188,155,255,0.2)" : "transparent",
                                border: "none", borderRadius: 4, cursor: newRoleName.trim() ? "pointer" : "default",
                                color: newRoleName.trim() ? "#BC9BFF" : "rgba(237,236,234,0.2)",
                                fontSize: 18, lineHeight: "18px", padding: "0 6px", fontWeight: 700,
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
                        onClick={() => handleRemove(member.id)}
                        disabled={removingId === member.id}
                        aria-label="Remove member"
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
                            e.currentTarget.style.color = "#EF4444";
                            e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "rgba(237,236,234,0.3)";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <RemoveIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </Stack>
  );
}
