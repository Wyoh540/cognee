"use client";

import { useState, useEffect, useCallback } from "react";
import { Text, TextInput, Button } from "@mantine/core";
import { modals } from "@mantine/modals";
import { getAllTenants, deleteTenant, getTenantDetail, createWorkspaceByName, type AdminTenant, type AdminTenantDetail } from "@/modules/admin/adminApi";
import SkeletonBar from "@/ui/elements/SkeletonBar";
import { PlusIcon, DeleteIcon } from "@/ui/icons";
import { AdminCard as Card, ADMIN_COLORS as C, adminPrimaryButtonStyles, notifyAdminError as notifyErr, notifyAdminSuccess as notifyOk } from "./AdminUI";

function BuildingIcon() {
  return (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="6" x2="9" y2="6.01" /><line x1="15" y1="6" x2="15" y2="6.01" /></svg>);
}

export default function WorkspacesPanel() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadTenants = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTenants(await getAllTenants()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); notifyErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadTenants(); }, [loadTenants]);
  const handleCreate = async () => { if (!createName.trim()) return; setCreating(true);
    try { await createWorkspaceByName(createName.trim()); notifyOk("Workspace created."); setCreateName(""); await loadTenants(); }
    catch (e) { notifyErr(e instanceof Error ? e.message : "Failed to create workspace"); }
    finally { setCreating(false); }
  };
  const handleDelete = (id: string, name: string) => { modals.openConfirmModal({
    title: "Delete workspace?", children: <Text size="sm" style={{ color: C.textMuted }}>Delete <strong>{name}</strong>? This cannot be undone.</Text>,
    labels: { confirm: "Delete", cancel: "Cancel" }, confirmProps: { color: "red" },
    onConfirm: async () => { setDeletingId(id);
      try { await deleteTenant(id); notifyOk("Workspace deleted."); await loadTenants(); }
      catch (e) { notifyErr(e instanceof Error ? e.message : "Failed to delete"); }
      finally { setDeletingId(null); } } }); };
  const handleToggleDetail = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id); setDetailLoading(true);
    try { setDetail(await getTenantDetail(id)); } catch (e) { notifyErr(e instanceof Error ? e.message : "Failed"); setExpandedId(null); }
    finally { setDetailLoading(false); }
  };

  const COLUMNS = "1fr auto auto auto";
  return (<>
    <Card><div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <TextInput placeholder="Workspace name" value={createName} onChange={(e) => setCreateName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} disabled={creating} aria-label="New workspace name"
          styles={{ input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: C.textPrimary, fontSize: 14, height: 40 } }} />
      </div>
      <Button onClick={handleCreate} loading={creating} disabled={!createName.trim() || creating} leftSection={<PlusIcon width={12} height={12} color="#fff" />}
        styles={adminPrimaryButtonStyles}>
        Create Workspace</Button></div></Card>
    <Card style={{ flex: 1, overflow: "auto" }}>
    {loading ? (<div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0.5rem 0" }}>
      {[1, 2, 3].map((i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <SkeletonBar width={180} height={14} /><div style={{ flex: 1 }} /><SkeletonBar width={80} height={14} /><SkeletonBar width={20} height={20} /></div>))}</div>)
    : error ? (<div style={{ textAlign: "center", padding: "2rem 0" }}>
      <Text size="sm" style={{ color: C.danger, marginBottom: 12 }}>{error}</Text>
      <Button onClick={loadTenants} variant="subtle" size="xs" styles={{ root: { color: C.accent } }}>Retry</Button></div>)
    : tenants.length === 0 ? (<div style={{ textAlign: "center", padding: "3rem 0" }}>
      <div style={{ marginBottom: 12 }}><BuildingIcon /></div>
      <Text size="xs" style={{ color: C.textExtraDim }}>Create a workspace above to get started.</Text></div>)
    : (<div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 16, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 2 }}>
        <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Name</Text>
        <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Owner</Text>
        <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Members</Text>
        <div style={{ width: 80 }} /></div>
      {tenants.map((t) => {
        const isExp = expandedId === t.id;
        const isDel = deletingId === t.id;
        return (<div key={t.id}>
          <div style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 16, alignItems: "center", padding: "10px 0", borderRadius: 8, transition: "background 120ms ease" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Text size="sm" style={{ color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.name}>{t.name}</Text>
            <Text size="sm" style={{ color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.owner_email}</Text>
            <Text size="sm" style={{ color: C.textMuted }}>{t.member_count}</Text>
            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", width: 80 }}>
              <Button onClick={() => handleToggleDetail(t.id)} size="compact-xs" variant="light"
                styles={{ root: { color: isExp ? C.accent : "rgba(237,236,234,0.5)", background: isExp ? C.accentBg : "transparent", border: "none", fontSize: 11, height: 24 } }}>
                {isExp ? "Hide" : "View"}</Button>
              <Button onClick={() => handleDelete(t.id, t.name)} size="compact-xs" variant="light" disabled={isDel}
                styles={{ root: { color: "rgba(237,236,234,0.3)", border: "none", fontSize: 11, height: 24 } }}>
                {isDel ? "..." : <DeleteIcon width={11} height={12} color="currentColor" />}</Button></div></div>
          {isExp && (detailLoading ? <div style={{ padding: "0.75rem 0" }}><SkeletonBar width={200} height={14} /></div>
            : detail ? (<div style={{ padding: "0.75rem 0 0.5rem 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }}>
              <Text size="xs" style={{ color: C.textMuted, marginBottom: 6 }}>
                Members: {detail.members.map((m) => m.email).join(", ")}</Text></div>) : null)}
        </div>);})}
    </div>)}</Card></>);}
