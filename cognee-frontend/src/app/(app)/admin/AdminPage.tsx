"use client";

import { Stack, Text, Tabs, Button } from "@mantine/core";
import Link from "next/link";
import WorkspacesPanel from "./WorkspacesPanel";
import UsersPanel from "./UsersPanel";
import { useCurrentUser } from "@/modules/users/useCurrentUser";
import PageLoading from "@/ui/elements/PageLoading";

const C = {
  surfaceBg: "rgba(255,255,255,0.06)",
  textPrimary: "#EDECEA",
  textMuted: "rgba(237,236,234,0.55)",
  accent: "#BC9BFF",
} as const;

export default function AdminPage() {
  const { data: currentUser, isLoading } = useCurrentUser();

  if (isLoading) {
    return <PageLoading name="Admin" />;
  }

  if (!currentUser?.isSuperuser) {
    return (
      <Stack className="h-full items-center justify-center" gap="md">
        <Text style={{ fontSize: 48, fontWeight: 700, color: C.accent }}>
          403
        </Text>
        <Text style={{ color: C.textMuted, fontSize: 15 }}>
          You do not have access to this page.
        </Text>
        <Button
          component={Link}
          href="/dashboard"
          variant="subtle"
          styles={{
            root: {
              color: C.accent,
              "&:hover": { background: "rgba(188,155,255,0.1)" },
            },
          }}
        >
          Back to Dashboard
        </Button>
      </Stack>
    );
  }

  return (
    <Stack className="!gap-[0.625rem] h-full p-[1.25rem]">
      {/* Heading */}
      <div style={{ marginBottom: "0.25rem" }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 300,
            color: C.textPrimary,
            margin: 0,
            fontFamily: '"TWKLausanne", sans-serif',
          }}
        >
          Admin
        </h2>
        <Text size="sm" style={{ color: C.textMuted, marginTop: 4 }}>
          Manage workspaces and users across the platform.
        </Text>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="workspaces"
        styles={{
          list: {
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            gap: 0,
          },
          tab: {
            color: "rgba(237,236,234,0.5)",
            fontSize: 14,
            fontWeight: 500,
            padding: "10px 20px",
            border: "none",
            "&[data-active]": {
              color: C.accent,
              borderBottom: `2px solid ${C.accent}`,
            },
            "&:hover": { background: "transparent", color: C.textPrimary },
          },
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="workspaces">Workspaces</Tabs.Tab>
          <Tabs.Tab value="users">Users</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="workspaces" pt="md">
          <WorkspacesPanel />
        </Tabs.Panel>

        <Tabs.Panel value="users" pt="md">
          <UsersPanel />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
