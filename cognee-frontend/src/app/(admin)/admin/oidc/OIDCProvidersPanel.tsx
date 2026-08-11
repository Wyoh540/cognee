"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Center, Checkbox, Group, Modal, Paper, PasswordInput, ScrollArea, Skeleton, Stack, Table, Text, TextInput, ThemeIcon } from "@mantine/core";
import { getOIDCProviders, saveOIDCProvider, type OIDCProvider, type OIDCProviderBody } from "@/modules/admin/adminApi";
import { PlusIcon } from "@/ui/icons";
import {
  AdminPage,
  AdminPageHeader,
  notifyAdminError,
  notifyAdminSuccess,
} from "../AdminUI";

const emptyProvider: OIDCProviderBody = {
  name: "",
  slug: "",
  issuer: "",
  client_id: "",
  client_secret: "",
  scopes: "openid profile email",
  enabled: true,
};

function KeyIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-dimmed)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" /></svg>;
}

export default function OIDCProvidersPanel() {
  const [providers, setProviders] = useState<OIDCProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OIDCProvider | null>(null);
  const [form, setForm] = useState<OIDCProviderBody>(emptyProvider);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setProviders(await getOIDCProviders()); }
    catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load providers";
      setError(message);
      notifyAdminError(message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openEditor(provider?: OIDCProvider) {
    setEditing(provider ?? null);
    setForm(provider ? { name: provider.name, slug: provider.slug, issuer: provider.issuer, client_id: provider.client_id, client_secret: "", scopes: provider.scopes, enabled: provider.enabled } : emptyProvider);
    setError(null);
    setOpened(true);
  }

  function closeEditor() {
    if (saving) return;
    setOpened(false);
    setEditing(null);
    setForm(emptyProvider);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveOIDCProvider(form, editing?.id);
      notifyAdminSuccess(editing ? "OIDC provider updated." : "OIDC provider created.");
      setOpened(false);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save provider";
      setError(message);
      notifyAdminError(message);
    } finally { setSaving(false); }
  }

  const formValid = Boolean(form.name.trim() && form.slug.trim() && form.issuer.trim() && form.client_id.trim() && form.scopes.trim() && (editing || form.client_secret));
  return <AdminPage>
    <AdminPageHeader
      title="OIDC providers"
      description="Configure single sign-on providers such as Keycloak."
      action={<Button variant="gradient" onClick={() => openEditor()} leftSection={<PlusIcon width={12} height={12} color="var(--mantine-color-white)" />}>New provider</Button>}
    />

    <Paper p="lg" withBorder style={{ flex: 1, overflow: "hidden" }}>
      {loading ? <Stack gap="md" py="xs">
        {[1, 2, 3].map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}><Skeleton circle width={32} height={32} /><Skeleton width={160} height={14} /><div style={{ flex: 1 }} /><Skeleton width={220} height={14} /><Skeleton width={56} height={20} /></div>)}
      </Stack> : error ? <Alert color="red" title="Unable to load OIDC providers">{error}<Button onClick={load} variant="subtle" size="xs" mt="sm">Retry</Button></Alert>
      : providers.length === 0 ? <Center py={48}><Stack align="center" gap="xs"><ThemeIcon variant="light" size="xl"><KeyIcon size={24} /></ThemeIcon><Text size="sm">No OIDC providers configured.</Text><Text size="xs" c="dimmed">Add a provider to offer single sign-on on the sign-in page.</Text></Stack></Center>
      : <ScrollArea h="100%"><Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={900}>
        <Table.Thead><Table.Tr><Table.Th>Provider</Table.Th><Table.Th>Issuer</Table.Th><Table.Th>Client ID</Table.Th><Table.Th>Status</Table.Th><Table.Th ta="right">Actions</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{providers.map((provider) => <Table.Tr key={provider.id}>
          <Table.Td><Group gap="sm" wrap="nowrap"><KeyIcon /><div><Text size="sm">{provider.name}</Text><Text size="xs" c="dimmed">{provider.slug}</Text></div></Group></Table.Td>
          <Table.Td><Text size="sm" c="dimmed" truncate maw={360} title={provider.issuer}>{provider.issuer}</Text></Table.Td>
          <Table.Td><Text size="sm" c="dimmed" truncate maw={220} title={provider.client_id}>{provider.client_id}</Text></Table.Td>
          <Table.Td><Badge size="xs" variant="dot" color={provider.enabled ? "green" : "gray"}>{provider.enabled ? "Enabled" : "Disabled"}</Badge></Table.Td>
          <Table.Td ta="right"><Button variant="light" size="compact-xs" onClick={() => openEditor(provider)}>Edit</Button></Table.Td>
        </Table.Tr>)}</Table.Tbody>
      </Table></ScrollArea>}
    </Paper>

    <Modal opened={opened} onClose={closeEditor} title={editing ? "Edit OIDC provider" : "Create OIDC provider"} size="lg" zIndex={1000}>
      <form onSubmit={submit}><Stack gap="md">
        {error && <Alert color="red">{error}</Alert>}
        <Group grow align="flex-start"><TextInput label="Display name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })} placeholder="Company SSO" autoFocus /><TextInput label="Slug" required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.currentTarget.value })} placeholder="keycloak" description="Used in the login URL." /></Group>
        <TextInput label="Issuer URL" required value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.currentTarget.value })} placeholder="https://sso.example.com/realms/company" />
        <Group grow align="flex-start"><TextInput label="Client ID" required value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.currentTarget.value })} /><PasswordInput label="Client secret" required={!editing} value={form.client_secret} onChange={(event) => setForm({ ...form, client_secret: event.currentTarget.value })} description={editing ? "Leave blank to keep the current secret." : undefined} /></Group>
        <TextInput label="Scopes" required value={form.scopes} onChange={(event) => setForm({ ...form, scopes: event.currentTarget.value })} />
        <Checkbox label="Enabled" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.currentTarget.checked })} />
        <Group justify="flex-end" mt="xs"><Button variant="subtle" onClick={closeEditor} disabled={saving}>Cancel</Button><Button variant="gradient" type="submit" loading={saving} disabled={!formValid}>{editing ? "Save changes" : "Create provider"}</Button></Group>
      </Stack></form>
    </Modal>
  </AdminPage>;
}
