"use client";

import { Box, Flex, Stack, Text, NavLink, Button } from "@mantine/core";
import { useState } from "react";
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
  const [activeSection, setActiveSection] = useState<"workspaces" | "users">("workspaces");

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

      {/* Sidebar hover styles */}
      <style>{`
        .admin-sidenav:hover {
          background-color: rgba(255,255,255,0.06);
          color: #EDECEA;
        }
        .admin-sidenav[data-active]:hover {
          background-color: rgba(188,155,255,0.20);
          color: #BC9BFF;
        }
      `}</style>

      {/* Body: sidebar + content */}
      <Flex style={{ flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <Stack
          gap={0}
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 4,
          }}
        >
          <NavLink
            className="admin-sidenav"
            label="Workspaces"
            active={activeSection === "workspaces"}
            onClick={() => setActiveSection("workspaces")}
            styles={{
              root: {
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 0,
                padding: "10px 16px",
                color: activeSection === "workspaces" ? C.accent : "rgba(237,236,234,0.7)",
                background: activeSection === "workspaces" ? "rgba(188,155,255,0.20)" : "transparent",
              },
            }}
          />
          <NavLink
            className="admin-sidenav"
            label="Users"
            active={activeSection === "users"}
            onClick={() => setActiveSection("users")}
            styles={{
              root: {
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 0,
                padding: "10px 16px",
                color: activeSection === "users" ? C.accent : "rgba(237,236,234,0.7)",
                background: activeSection === "users" ? "rgba(188,155,255,0.20)" : "transparent",
              },
            }}
          />
        </Stack>

        {/* Content */}
        <Box style={{ flex: 1, overflow: "auto", padding: "12px 0 0 20px" }}>
          {activeSection === "workspaces" ? <WorkspacesPanel /> : <UsersPanel />}
        </Box>
      </Flex>
    </Stack>
  );
}
