"use client";

import { useState, useEffect, useCallback } from "react";
import { Text, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { getAllUsers, patchUser, type AdminUser } from "@/modules/admin/adminApi";
import SkeletonBar from "@/ui/elements/SkeletonBar";

const C = {
  surfaceBg: "rgba(255,255,255,0.06)",
  surfaceBorder: "1px solid rgba(255,255,255,0.1)",
  textPrimary: "#EDECEA",
  textMuted: "rgba(237,236,234,0.55)",
  textDim: "rgba(237,236,234,0.35)",
  textExtraDim: "rgba(237,236,234,0.3)",
  accent: "#BC9BFF",
  accentBg: "rgba(188,155,255,0.18)",
  danger: "#EF4444",
  dangerBg: "rgba(239,68,68,0.15)",
  green: "#34D399",
} as const;

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.surfaceBg, backdropFilter: "blur(12px)", border: C.surfaceBorder, borderRadius: 12, padding: "1.25rem 1.5rem", ...style }}>{children}</div>;
}
function notifyOk(msg: string) { notifications.show({ message: msg, color: "green", autoClose: 3500 }); }
function notifyErr(msg: string) {
  notifications.show({ title: "Error", message: msg, color: "red", autoClose: 6000 });
}

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

  const COLUMNS = "1fr auto auto auto";
  return (
    <>
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
    </>
  );
}
