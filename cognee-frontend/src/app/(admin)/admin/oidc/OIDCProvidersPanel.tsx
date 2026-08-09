"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Checkbox, Group, Modal, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { getOIDCProviders, saveOIDCProvider, type OIDCProvider, type OIDCProviderBody } from "@/modules/admin/adminApi";
import SkeletonBar from "@/ui/elements/SkeletonBar";
import { PlusIcon } from "@/ui/icons";
import {
  AdminCard,
  ADMIN_COLORS as C,
  adminCheckboxStyles,
  adminInputStyles,
  adminModalStyles,
  adminPasswordInputStyles,
  adminPrimaryButtonStyles,
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
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(237,236,234,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" /></svg>;
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
  const columns = "minmax(180px, 0.8fr) minmax(260px, 1.4fr) minmax(150px, 0.7fr) auto auto";

  return <div className="flex min-h-full flex-col p-6 lg:p-8">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 24 }}>
      <div>
        <h1 className="m-0 text-xl font-medium text-[#EDECEA]">OIDC providers</h1>
        <Text size="sm" style={{ color: C.textMuted, marginTop: 4 }}>Configure single sign-on providers such as Keycloak.</Text>
      </div>
      <Button onClick={() => openEditor()} leftSection={<PlusIcon width={12} height={12} color="#fff" />} styles={adminPrimaryButtonStyles}>New provider</Button>
    </div>

    <AdminCard style={{ flex: 1, overflow: "auto" }}>
      {loading ? <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0.5rem 0" }}>
        {[1, 2, 3].map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} /><SkeletonBar width={160} height={14} /><div style={{ flex: 1 }} /><SkeletonBar width={220} height={14} /><SkeletonBar width={56} height={20} /></div>)}
      </div> : error ? <div style={{ textAlign: "center", padding: "2rem 0" }}><Text size="sm" style={{ color: C.danger, marginBottom: 12 }}>{error}</Text><Button onClick={load} variant="subtle" size="xs" styles={{ root: { color: C.accent } }}>Retry</Button></div>
      : providers.length === 0 ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "3rem 0" }}><KeyIcon size={24} /><Text size="sm" style={{ color: C.textDim, marginTop: 12, marginBottom: 4 }}>No OIDC providers configured.</Text><Text size="xs" style={{ color: C.textExtraDim }}>Add a provider to offer single sign-on on the sign-in page.</Text></div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 900 }}>
        <div style={{ display: "grid", gridTemplateColumns: columns, gap: 16, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 2 }}>
          {['Provider', 'Issuer', 'Client ID', 'Status'].map((label) => <Text key={label} size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>)}<div style={{ width: 48 }} />
        </div>
        {providers.map((provider) => <div key={provider.id} style={{ display: "grid", gridTemplateColumns: columns, gap: 16, alignItems: "center", padding: "10px 0", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><KeyIcon /><div style={{ minWidth: 0 }}><Text size="sm" style={{ color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{provider.name}</Text><Text size="xs" style={{ color: C.textExtraDim }}>{provider.slug}</Text></div></div>
          <Text size="sm" title={provider.issuer} style={{ color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{provider.issuer}</Text>
          <Text size="sm" title={provider.client_id} style={{ color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{provider.client_id}</Text>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: provider.enabled ? C.green : C.textDim }} /><Text size="xs" style={{ color: provider.enabled ? C.green : C.textMuted }}>{provider.enabled ? "Enabled" : "Disabled"}</Text></div>
          <Button variant="light" size="compact-xs" onClick={() => openEditor(provider)} styles={{ root: { color: C.accent, background: C.accentBg, border: "none", fontSize: 11, height: 24 } }}>Edit</Button>
        </div>)}
      </div>}
    </AdminCard>

    <Modal opened={opened} onClose={closeEditor} title={editing ? "Edit OIDC provider" : "Create OIDC provider"} centered size="lg" styles={adminModalStyles}>
      <form onSubmit={submit}><Stack gap="md">
        {error && <Text size="sm" style={{ color: C.danger }}>{error}</Text>}
        <Group grow align="flex-start"><TextInput label="Display name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })} placeholder="Company SSO" autoFocus styles={adminInputStyles} /><TextInput label="Slug" required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.currentTarget.value })} placeholder="keycloak" description="Used in the login URL." styles={adminInputStyles} /></Group>
        <TextInput label="Issuer URL" required value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.currentTarget.value })} placeholder="https://sso.example.com/realms/company" styles={adminInputStyles} />
        <Group grow align="flex-start"><TextInput label="Client ID" required value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.currentTarget.value })} styles={adminInputStyles} /><PasswordInput label="Client secret" required={!editing} value={form.client_secret} onChange={(event) => setForm({ ...form, client_secret: event.currentTarget.value })} description={editing ? "Leave blank to keep the current secret." : undefined} styles={adminPasswordInputStyles} /></Group>
        <TextInput label="Scopes" required value={form.scopes} onChange={(event) => setForm({ ...form, scopes: event.currentTarget.value })} styles={adminInputStyles} />
        <Checkbox label="Enabled" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.currentTarget.checked })} styles={adminCheckboxStyles} />
        <Group justify="flex-end" mt="xs"><Button variant="subtle" onClick={closeEditor} disabled={saving} styles={{ root: { color: C.textMuted } }}>Cancel</Button><Button type="submit" loading={saving} disabled={!formValid} styles={adminPrimaryButtonStyles}>{editing ? "Save changes" : "Create provider"}</Button></Group>
      </Stack></form>
    </Modal>
  </div>;
}
