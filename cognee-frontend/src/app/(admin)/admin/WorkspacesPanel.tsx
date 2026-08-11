"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { Alert, Button, Center, Group, Paper, ScrollArea, Skeleton, Stack, Table, Text, TextInput, ThemeIcon } from "@mantine/core";
import { modals } from "@mantine/modals";
import { getAllTenants, deleteTenant, getTenantDetail, createWorkspaceByName, type AdminTenant, type AdminTenantDetail } from "@/modules/admin/adminApi";
import { PlusIcon, DeleteIcon } from "@/ui/icons";
import { notifyAdminError as notifyErr, notifyAdminSuccess as notifyOk } from "./AdminUI";
import WorkspaceDatabaseSettings from "./WorkspaceDatabaseSettings";

function BuildingIcon() {
  return (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="6" x2="9" y2="6.01" /><line x1="15" y1="6" x2="15" y2="6.01" /></svg>);
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
    title: "Delete workspace?", children: <Text size="sm" c="dimmed">Delete <strong>{name}</strong>? This cannot be undone.</Text>,
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

  return (<>
    <Paper p="lg" withBorder><Group align="flex-end" wrap="wrap">
      <div style={{ flex: 1, minWidth: 240 }}>
        <TextInput placeholder="Workspace name" value={createName} onChange={(e) => setCreateName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} disabled={creating} aria-label="New workspace name"
          />
      </div>
      <Button variant="gradient" onClick={handleCreate} loading={creating} disabled={!createName.trim() || creating} leftSection={<PlusIcon width={12} height={12} color="var(--mantine-color-white)" />}>
        Create workspace</Button></Group></Paper>
    <Paper p="lg" withBorder style={{ flex: 1, overflow: "hidden" }}>
    {loading ? (<Stack gap="md" py="xs">
      {[1, 2, 3].map((i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
        <Skeleton circle width={32} height={32} />
        <Skeleton width={180} height={14} /><div style={{ flex: 1 }} /><Skeleton width={80} height={14} /><Skeleton width={20} height={20} /></div>))}</Stack>)
    : error ? <Alert color="red" title="Unable to load workspaces">{error}<Button onClick={loadTenants} variant="subtle" size="xs" mt="sm">Retry</Button></Alert>
    : tenants.length === 0 ? <Center py={48}><Stack align="center" gap="xs"><ThemeIcon variant="light" size="xl"><BuildingIcon /></ThemeIcon><Text size="sm">No workspaces found.</Text><Text size="xs" c="dimmed">Create a workspace above to get started.</Text></Stack></Center>
    : <ScrollArea h="100%"><Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={760}>
      <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Owner</Table.Th><Table.Th>Members</Table.Th><Table.Th ta="right">Actions</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>
      {tenants.map((t) => {
        const isExp = expandedId === t.id;
        const isDel = deletingId === t.id;
        return (<Fragment key={t.id}>
          <Table.Tr>
            <Table.Td><Text size="sm" fw={500} truncate title={t.name}>{t.name}</Text></Table.Td>
            <Table.Td><Text size="sm" c="dimmed" truncate>{t.owner_email}</Text></Table.Td>
            <Table.Td><Text size="sm" c="dimmed">{t.member_count}</Text></Table.Td>
            <Table.Td><Group gap="xs" justify="flex-end" wrap="nowrap">
              <Button onClick={() => handleToggleDetail(t.id)} size="compact-xs" variant={isExp ? "light" : "subtle"}>
                {isExp ? "Hide" : "View"}</Button>
              <Button aria-label={`Delete ${t.name}`} onClick={() => handleDelete(t.id, t.name)} size="compact-xs" variant="subtle" color="red" loading={isDel}>
                <DeleteIcon width={11} height={12} color="currentColor" /></Button></Group></Table.Td></Table.Tr>
          {isExp && <Table.Tr><Table.Td colSpan={4} bg="var(--mantine-color-dark-8)">{detailLoading ? <Skeleton width={200} height={14} my="sm" />
            : detail ? (<Stack gap="sm" py="xs">
              <Text size="xs" c="dimmed">
                Members: {detail.members.map((m) => m.email).join(", ")}</Text>
              {detail.datasets.length === 0 ? <Text size="xs" c="dimmed">No datasets in this workspace.</Text> : detail.datasets.map((dataset) => dataset.database_config ? (
                <WorkspaceDatabaseSettings key={dataset.id} tenantId={t.id} datasetName={dataset.name} initialConfig={dataset.database_config}
                  onSaved={(database_config) => setDetail({ ...detail, datasets: detail.datasets.map((item) => item.id === dataset.id ? { ...item, database_config } : item) })} />
              ) : <Text key={dataset.id} size="xs" c="dimmed">{dataset.name}: no database connection configured.</Text>)}
            </Stack>) : null}</Table.Td></Table.Tr>}
        </Fragment>);})}
      </Table.Tbody>
    </Table></ScrollArea>}
    </Paper></>);}
