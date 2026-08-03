"use client";

import { useState, useEffect, useCallback } from "react";
import { Text, TextInput, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  getAllTenants,
  deleteTenant,
  getTenantDetail,
  createWorkspaceByName,
  type AdminTenant,
  type AdminTenantDetail,
} from "@/modules/admin/adminApi";
import SkeletonBar from "@/ui/elements/SkeletonBar";
import { PlusIcon, DeleteIcon } from "@/ui/icons";

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

function notifyOk(msg: string) {
  notifications.show({ message: msg, color: "green", autoClose: 3500 });
}
function notifyErr(msg: string) {
  notifications.show({ title: "Error", message: msg, color: "red", autoClose: 6000 });
}

function BuildingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="9" y1="6" x2="9" y2="6.01" />
      <line x1="15" y1="6" x2="15" y2="6.01" />
      <line x1="9" y1="10" x2="9" y2="10.01" />
      <line x1="15" y1="10" x2="15" y2="10.01" />
      <line x1="9" y1="14" x2="9" y2="14.01" />
      <line x1="15" y1="14" x2="15" y2="14.01" />
    </svg>
  );
}
export default function WorkspacesPanel() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllTenants();
      setTenants(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load workspaces';
      setError(msg);
      notifyErr(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await createWorkspaceByName(createName.trim());
      notifyOk('Workspace "' + createName.trim() + '" created.');
      setCreateName('');
      await loadTenants();
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (tenantId: string, tenantName: string) => {
    modals.openConfirmModal({
      title: 'Delete workspace?',
      children: (
        <Text size="sm" style={{ color: C.textMuted }}>
          Delete <strong>{tenantName}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setDeletingId(tenantId);
        try {
          await deleteTenant(tenantId);
          notifyOk('Workspace deleted.');
          await loadTenants();
        } catch (e) {
          notifyErr(e instanceof Error ? e.message : 'Failed to delete workspace');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleToggleDetail = async (tenantId: string) => {
    if (expandedId === tenantId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(tenantId);
    setDetailLoading(true);
    try {
      const d = await getTenantDetail(tenantId);
      setDetail(d);
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Failed to load workspace details');
      setExpandedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      {/* Create workspace form */}
      <Card>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <TextInput
              placeholder="Workspace name"
              value={createName}
              onChange={(e) => setCreateName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              disabled={creating}
              aria-label="New workspace name"
              styles={{
                input: {
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  color: C.textPrimary,
                  fontSize: 14,
                  height: 40,
                  "&:focus": { borderColor: "rgba(188,155,255,0.5)" },
                  &::placeholder": { color: "rgba(237,236,234,0.35)" },
                },
              }}
            />
          </div>
          <Button
            onClick={handleCreate}
            loading={creating}
            disabled={!createName.trim() || creating}
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
                &:hover": { opacity: 0.9 },
                &:disabled": { opacity: 0.4 },
              },
            }}
          >
            Create Workspace
          </Button>
        </div>
      </Card>

      {/* Workspace table */}
      <Card style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0.5rem 0" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                <SkeletonBar width={180} height={14} />
                <div style={{ flex: 1 }} />
                <SkeletonBar width={80} height={14} />
                <SkeletonBar id={20} height={20} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <Text size="sm" style={{ color: C.danger, marginBottom: 12 }}>{error}</Text>
            <Button onClick={loadTenants} variant="subtle" size="xs"
              styles={{
                root: { color: C.accent, "&:hover": { background: "rgba(188,155,255,0.1)" } },
              }}>
              Retry
            </Button>
          </div>
        ) : tenants.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div style={{ marginBottom: 12 }}><BuildingIcon /></div>
            <Text size="sm" style={{ color: C.textDim, marginBottom: 4 }}>
              No workspaces yet.
            </Text>
            <Text size="xs" style={{ color: C.textExtraDim }}>
              Create a workspace above to get started.
            </Text>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: COLUMNS, gap: 16, alignItems: "center",
              padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 2,
            }}>
              <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Name
              </Text>
              <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Owner
              </Text>
              <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Members
              </Text>
              <div style={{ width: 80 }} />
            </div>

            {/* Rows */}
            {tenants.map((tenant) => {
              const isExpanded = expandedId === tenant.id;
              const isDeleting = deletingId === tenant.id;
              return (
                <div key={tenant.id}>
                  <div style={{
                    display: "grid", gridTemplateColumns: COLUMNS, gap: 16, alignItems: "center",
                    padding: "10px 0", borderRadius: 8,
                    transition: "background 120ms ease",
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <Text size="sm" style={{ color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tenant.name}>
                      {tenant.name}
                    </Text>
                    <Text size="sm" style={{ color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tenant.owner_email}
                    </Text>
                    <Text size="sm" style={{ color: C.textMuted }}>
                      {tenant.member_count}
                    </Text>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", width: 80 }}>
                      <Button
                        onClick={() => handleToggleDetail(tenant.id)}
                        size="compact-xs"
                        variant="light"
                        styles={{
                          root: {
                            color: isExpanded ? C.accent : "rgba(237,236,234,0.5)",
                            background: isExpanded ? "rgba(188,155,255,0.1)" : "transparent",
                            border: "none",
                            fontSize: 12,
                            height: 28,
                           })}
                        </Button>
                      <Button
                        onClick={() => handleDelete(tenant.id, tenant.name)}
                        disabled={isDeleting}
                        size="compact-xs"
                        variant="light"
                        styles={{
                          root: {
                            color: "rgba(237,236,234,0.3)",
                            background: "transparent",
                            border: "none",
                            fontSize: 12,
                            height: 28,
                            "&:hover": { color: C.danger, background: C.dangerBg },
                          },
                        }}
                      >
                        {isDeleting ? "..." : <DeleteIcon width={12} height={14} color="currentColor" />}
                      </Button>
                    </div>
                  </div>

                  {/* Inline detail panel */}
                  {isExpanded && (detailLoading ? (
                    <div style={{ padding: "0.75rem 0" }}>
                      <SkeletonBar width={200} height={14} />
                    </div>
                  ) : detail ? (
                    <div style={{
                      padding: "0.75rem 0 0.5rem 0",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      marginTop: 4,
                    }}>
                      <Text size="xs" style={{ color: C.textMuted, marginBottom: 6 }}>
                        Members: 
{detail.members.map((m) => m.email).join(", ")}
                      </Text>
                    </div>
                  ) : null)}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
