"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Stack, Text } from "@mantine/core";
import { useCurrentUser } from "@/modules/users/useCurrentUser";
import PageLoading from "@/ui/elements/PageLoading";
import ProfileMenu from "@/ui/layout/ProfileMenu";

const navigation = [
  { href: "/admin", label: "Workspaces", exact: true },
  { href: "/admin/users", label: "Users", exact: false },
];

function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

export default function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { data: currentUser, isLoading } = useCurrentUser();

  if (isLoading) return <PageLoading name="Admin" />;

  if (!currentUser?.isSuperuser) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Stack align="center" gap="md">
          <Text style={{ fontSize: 48, fontWeight: 700, color: "#BC9BFF" }}>403</Text>
          <Text style={{ color: "rgba(237,236,234,0.55)", fontSize: 15 }}>You do not have access to this page.</Text>
          <Button component={Link} href="/dashboard" variant="subtle" color="violet">Back to workspace</Button>
        </Stack>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: "#000", backgroundImage: "linear-gradient(rgba(244,244,244,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(244,244,244,0.10) 1px, transparent 1px)", backgroundSize: "33px 33px" }}>
      <header className="flex flex-shrink-0 items-center" style={{ height: 53, paddingInline: 24, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ width: 240, flexShrink: 0 }}>
          <Link href="/dashboard" className="inline-flex items-center">
            <Image src="/cognee-logo-black.svg" alt="Cognee" width={110} height={24} style={{ filter: "invert(1)" }} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "rgba(237,236,234,0.25)" }}>/</span>
          <span style={{ color: "#EDECEA", fontSize: 14, fontWeight: 500 }}>Super Admin</span>
        </div>
        <div className="ml-auto">
          <ProfileMenu userName={currentUser.name} userEmail={currentUser.email} isSuperuser profileHref="/settings" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[264px] flex-shrink-0 flex-col border-r border-white/[0.08] bg-black/40 px-3 py-5">
          <div className="mb-4 border-b border-white/[0.08] pb-4">
            <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80">
              <span aria-hidden>←</span> Back to workspace
            </Link>
          </div>
          <div className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">Platform</div>
          <nav className="flex flex-col gap-1">
            {navigation.map((item, index) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors" style={{ color: active ? "#BC9BFF" : "rgba(237,236,234,0.65)", background: active ? "rgba(188,155,255,0.18)" : "transparent" }}>
                  {index === 0 ? <GridIcon /> : <UsersIcon />}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
