"use client";

import { useState, useEffect, useCallback } from "react";
import { Alert, Badge, Button, Center, Checkbox, Group, Modal, Paper, PasswordInput, ScrollArea, Skeleton, Stack, Table, Text, TextInput, ThemeIcon } from "@mantine/core";
import { createUser, getAllUsers, patchUser, type AdminUser } from "@/modules/admin/adminApi";
import { PlusIcon } from "@/ui/icons";
import { AdminPage, AdminPageHeader, notifyAdminError as notifyErr, notifyAdminSuccess as notifyOk } from "./AdminUI";

function PersonIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-dimmed)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="8" r="4" /><path d="M5.5 21a6.5 6.5 0 0113 0" /></svg>);
}

function UsersIcon() {
  return (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
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

  return (
    <AdminPage>
      <AdminPageHeader
        title="Users"
        description="Manage platform access and super administrator permissions."
        action={<Button variant="gradient"
          onClick={() => setCreateOpen(true)}
          leftSection={<PlusIcon width={12} height={12} color="var(--mantine-color-white)" />}
        >
          New user
        </Button>}
      />
      <Paper p="lg" withBorder style={{ flex: 1, overflow: "hidden" }}>
        {loading ? (<Stack gap="md" py="xs">
          {[1, 2, 3].map((i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
            <Skeleton circle width={32} height={32} />
            <Skeleton width={180} height={14} /><div style={{ flex: 1 }} />
            <Skeleton width={60} height={20} /><Skeleton width={60} height={20} /></div>))}
        </Stack>)
        : error ? <Alert color="red" title="Unable to load users">{error}<Button onClick={loadUsers} variant="subtle" size="xs" mt="sm">Retry</Button></Alert>
        : users.length === 0 ? <Center py={48}><Stack align="center" gap="xs"><ThemeIcon variant="light" size="xl"><UsersIcon /></ThemeIcon><Text size="sm">No users found.</Text><Text size="xs" c="dimmed">Users will appear here when they sign up.</Text></Stack></Center>
        : <ScrollArea h="100%">
          <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md" miw={760}>
            <Table.Thead><Table.Tr><Table.Th>User</Table.Th><Table.Th>Superuser</Table.Th><Table.Th>Status</Table.Th><Table.Th ta="right">Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
          {users.map((u) => {
            const kS = u.id + "/is_superuser";
            const kA = u.id + "/is_active";
            return (
              <Table.Tr key={u.id}>
                <Table.Td><Group gap="sm" wrap="nowrap">
                  <PersonIcon size={20} />
                  <Text size="sm" truncate title={u.email}>{u.email}</Text>
                </Group></Table.Td>
                <Table.Td><Badge size="xs" variant={u.is_superuser ? "light" : "default"}>{u.is_superuser ? "Admin" : "—"}</Badge></Table.Td>
                <Table.Td><Badge size="xs" variant="dot" color={u.is_active ? "green" : "red"}>{u.is_active ? "Active" : "Inactive"}</Badge></Table.Td>
                <Table.Td><Group gap="xs" justify="flex-end" wrap="nowrap">
                  <Button onClick={() => handleToggle(u.id, "is_superuser", u.is_superuser)} size="compact-xs" variant="light" loading={!!toggling[kS]}>{u.is_superuser ? "Revoke admin" : "Make admin"}</Button>
                  <Button onClick={() => handleToggle(u.id, "is_active", u.is_active)} size="compact-xs" variant="subtle" color={u.is_active ? "red" : "primary2"} loading={!!toggling[kA]}>{u.is_active ? "Deactivate" : "Activate"}</Button>
                </Group></Table.Td>
              </Table.Tr>);
          })}
            </Table.Tbody>
          </Table>
        </ScrollArea>}
      </Paper>
      <Modal
        opened={createOpen}
        onClose={closeCreate}
        title="Create user"
        centered
        zIndex={1000}
      >
        <Stack gap="md">
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            autoFocus
          />
          <PasswordInput
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Checkbox
            label="Super administrator"
            checked={isSuperuser}
            onChange={(e) => setIsSuperuser(e.currentTarget.checked)}
          />
          <Checkbox
            label="Active"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={closeCreate} disabled={creating}>Cancel</Button>
            <Button variant="gradient" onClick={handleCreate} loading={creating} disabled={!email.trim() || !password}>Create user</Button>
          </Group>
        </Stack>
      </Modal>
    </AdminPage>
  );
}
