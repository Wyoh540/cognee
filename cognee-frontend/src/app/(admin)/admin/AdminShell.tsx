"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, Box, Button, Group, NavLink, Stack, Text } from "@mantine/core";
import { useCurrentUser } from "@/modules/users/useCurrentUser";
import PageLoading from "@/ui/elements/PageLoading";
import ProfileMenu from "@/ui/layout/ProfileMenu";

const navigation = [
  { href: "/admin", label: "Workspaces", exact: true },
  { href: "/admin/users", label: "Users", exact: false },
  { href: "/admin/oidc", label: "OIDC", exact: false },
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
      <Box h="100dvh" bg="black" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Stack align="center" gap="md">
          <Text fz={48} fw={700} c="primary2.6">403</Text>
          <Text c="dimmed" fz="sm">You do not have access to this page.</Text>
          <Button component={Link} href="/dashboard" variant="subtle">Back to workspace</Button>
        </Stack>
      </Box>
    );
  }

  return (
    <AppShell header={{ height: 53 }} navbar={{ width: 264, breakpoint: "sm", collapsed: { mobile: true } }} padding={0} h="100dvh">
      <AppShell.Header px={{ base: "md", sm: "lg" }} bg="rgba(0,0,0,0.82)" style={{ display: "flex", alignItems: "center", borderColor: "var(--mantine-color-dark-5)", backdropFilter: "blur(12px)" }}>
        <Box w={{ base: "auto", sm: 240 }} style={{ flexShrink: 0 }}>
          <Link href="/dashboard" className="inline-flex items-center">
            <Image src="/cognee-logo-black.svg" alt="Cognee" width={110} height={24} style={{ filter: "invert(1)" }} />
          </Link>
        </Box>
        <Group visibleFrom="sm" gap="xs">
          <Text c="dimmed">/</Text>
          <Text fz="sm" fw={500}>Super Admin</Text>
        </Group>
        <Box ml="auto">
          <ProfileMenu userName={currentUser.name} userEmail={currentUser.email} isSuperuser profileHref="/settings" />
        </Box>
      </AppShell.Header>

      <AppShell.Navbar p="sm" bg="rgba(0,0,0,0.72)" style={{ borderColor: "var(--mantine-color-dark-5)", backdropFilter: "blur(12px)" }}>
          <NavLink component={Link} href="/dashboard" label="Back to workspace" leftSection={<span aria-hidden>←</span>} c="dimmed" mb="md" />
          <Text px="sm" pb="xs" size="xs" fw={600} tt="uppercase" c="dimmed">Platform</Text>
          <nav>
            {navigation.map((item, index) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <NavLink key={item.href} component={Link} href={item.href} label={item.label} leftSection={index === 0 ? <GridIcon /> : <UsersIcon />} active={active} color="primary2" variant="light" />
              );
            })}
          </nav>
      </AppShell.Navbar>
      <AppShell.Main h="100dvh" style={{ overflow: "auto", backgroundColor: "#000", backgroundImage: "linear-gradient(rgba(244,244,244,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(244,244,244,0.10) 1px, transparent 1px)", backgroundSize: "33px 33px" }}>
        <Box component="nav" hiddenFrom="sm" p="xs" bg="rgba(0,0,0,0.82)" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderBottom: "1px solid var(--mantine-color-dark-5)" }}>
          {navigation.map((item, index) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return <NavLink key={item.href} component={Link} href={item.href} label={item.label} leftSection={index === 0 ? <GridIcon /> : <UsersIcon />} active={active} color="primary2" variant="light" />;
          })}
        </Box>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
