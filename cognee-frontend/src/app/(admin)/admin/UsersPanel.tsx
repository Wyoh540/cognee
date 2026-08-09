"use client";

import { useState, useEffect, useCallback } from "react";
import { Text, Button, Modal, TextInput, PasswordInput, Checkbox, Stack, Group } from "@mantine/core";
import { createUser, getAllUsers, patchUser, type AdminUser } from "@/modules/admin/adminApi";
import SkeletonBar from "@/ui/elements/SkeletonBar";
import { PlusIcon } from "@/ui/icons";
import { AdminCard as Card, ADMIN_COLORS as C, adminCheckboxStyles, adminInputStyles, adminModalStyles, adminPasswordInputStyles, adminPrimaryButtonStyles, notifyAdminError as notifyErr, notifyAdminSuccess as notifyOk } from "./AdminUI";

function PersonIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(237,236,234,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="8" r="4" /><path d="M5.5 21a6.5 6.5 0 0113 0" /></svg>);
}

function UsersIcon() {
  return (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
}

export default function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Record<string, string | null>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try { const data = await getAllUsers(); setUsers(data); }
    catch (e) { const msg = e instanceof Error ? e.message : "Failed to load users"; setError(msg); notifyErr(msg); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleToggle = async (userId: string, field: string, currentValue: boolean) => {
    const key = userId + "/" + field;
    setToggling((prev) => ({ ...prev, [key]: field }));
    try {
      await patchUser(userId, { [field]: !currentValue });
      const label = field === "is_superuser" ? "Superuser" : "Active";
      notifyOk(label + " " + (currentValue ? "removed." : "granted."));
      await loadUsers();
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : "Failed to update user.");
    } finally {
      setToggling((prev) => ({ ...prev, [key]: null }));
    }
  };

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setEmail("");
    setPassword("");
    setIsSuperuser(false);
    setIsActive(true);
  };

  const handleCreate = async () => {
    if (!email.trim() || !password) return;
    setCreating(true);
    try {
      await createUser({ email: email.trim(), password, is_superuser: isSuperuser, is_active: isActive });
      notifyOk("User created.");
      setCreating(false);
      closeCreate();
      await loadUsers();
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  const COLUMNS = "1fr auto auto auto";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 24 }}>
        <div>
          <h1 className="m-0 text-xl font-medium text-[#EDECEA]">Users</h1>
          <Text size="sm" style={{ color: C.textMuted, marginTop: 4 }}>
            Manage platform access and super administrator permissions.
          </Text>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          leftSection={<PlusIcon width={12} height={12} color="#fff" />}
          styles={adminPrimaryButtonStyles}
        >
          New user
        </Button>
      </div>
      <Card style={{ flex: 1, overflow: "auto" }}>
        {loading ? (<div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0.5rem 0" }}>
          {[1, 2, 3].map((i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <SkeletonBar width={180} height={14} /><div style={{ flex: 1 }} />
            <SkeletonBar width={60} height={20} /><SkeletonBar width={60} height={20} /></div>))}
        </div>)
        : error ? (<div style={{ textAlign: "center", padding: "2rem 0" }}>
          <Text size="sm" style={{ color: C.danger, marginBottom: 12 }}>{error}</Text>
          <Button onClick={loadUsers} variant="subtle" size="xs" styles={{ root: { color: C.accent } }}>Retry</Button>
        </div>)
        : users.length === 0 ? (<div style={{ textAlign: "center", padding: "3rem 0" }}>
          <div style={{ marginBottom: 12 }}><UsersIcon /></div>
          <Text size="sm" style={{ color: C.textDim, marginBottom: 4 }}>No users found.</Text>
          <Text size="xs" style={{ color: C.textExtraDim }}>Users will appear here when they sign up.</Text>
        </div>)
        : (<div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 16, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 2 }}>
            <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>User</Text>
            <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Superuser</Text>
            <Text size="xs" style={{ color: C.textExtraDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Status</Text>
            <div style={{ width: 160 }} />
          </div>
          {users.map((u) => {
            const kS = u.id + "/is_superuser";
            const kA = u.id + "/is_active";
            return (
              <div key={u.id} style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 16, alignItems: "center", padding: "10px 0", borderRadius: 8, transition: "background 120ms ease" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <PersonIcon size={20} />
                  <Text size="sm" style={{ color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u.email}>{u.email}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  {u.is_superuser ? <span style={{ background: C.accentBg, color: C.accent, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Admin</span> : <span style={{ background: "rgba(255,255,255,0.08)", color: C.textMuted, padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>-</span>}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.is_active ? C.green : C.danger }} />
                  <Text size="xs" style={{ color: u.is_active ? C.green : C.danger }}>{u.is_active ? "Active" : "Inactive"}</Text></div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <Button onClick={() => handleToggle(u.id, "is_superuser", u.is_superuser)} size="compact-xs" variant="light" disabled={!!toggling[kS]} styles={{ root: { fontSize: 11, height: 24 } }}>{!!toggling[kS] ? "..." : u.is_superuser ? "Revoke Admin" : "Make Admin"}</Button>
                  <Button onClick={() => handleToggle(u.id, "is_active", u.is_active)} size="compact-xs" variant="light" disabled={!!toggling[kA]} styles={{ root: { fontSize: 11, height: 24 } }}>{!!toggling[kA] ? "..." : u.is_active ? "Deactivate" : "Activate"}</Button>
                </div>
              </div>);
          })}
        </div>)}
      </Card>
      <Modal
        opened={createOpen}
        onClose={closeCreate}
        title="Create user"
        centered
        styles={adminModalStyles}
      >
        <Stack gap="md">
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            autoFocus
            styles={adminInputStyles}
          />
          <PasswordInput
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            styles={adminPasswordInputStyles}
          />
          <Checkbox
            label="Super administrator"
            checked={isSuperuser}
            onChange={(e) => setIsSuperuser(e.currentTarget.checked)}
            styles={adminCheckboxStyles}
          />
          <Checkbox
            label="Active"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
            styles={adminCheckboxStyles}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={closeCreate} disabled={creating} styles={{ root: { color: C.textMuted } }}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!email.trim() || !password} styles={adminPrimaryButtonStyles}>Create user</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
