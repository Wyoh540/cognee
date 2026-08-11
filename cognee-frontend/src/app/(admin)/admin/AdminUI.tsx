"use client";

import {
  Box,
  Group,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

export function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <Box
      mih="100%"
      p={{ base: "md", sm: "xl" }}
      style={{ display: "flex", flexDirection: "column", gap: "var(--mantine-spacing-lg)" }}
    >
      {children}
    </Box>
  );
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Group component="header" align="flex-start" justify="space-between" gap="lg" wrap="wrap">
      <div>
        <Title order={1} size="h3" fw={500}>{title}</Title>
        <Text size="sm" c="dimmed" mt={4}>{description}</Text>
      </div>
      {action}
    </Group>
  );
}

export function notifyAdminSuccess(message: string) { notifications.show({ message, color: "green", autoClose: 3500 }); }
export function notifyAdminError(message: string) { notifications.show({ title: "Error", message, color: "red", autoClose: 6000 }); }
