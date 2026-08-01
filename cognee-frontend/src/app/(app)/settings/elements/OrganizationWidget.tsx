"use client";

import { Stack, Text, Button } from "@mantine/core";
import Link from "next/link";

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function OrganizationWidget() {
  return (
    <Stack
      className="rounded-[0.5rem] px-[2rem] pt-[1.5rem] pb-[1.75rem] !gap-[0] flex-1"
      style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "1.375rem" }}>
        <h2 style={{ fontSize: 20, fontWeight: 300, color: "#EDECEA", margin: 0, fontFamily: '"TWKLausanne", sans-serif' }}>
          Organization
        </h2>
        <Text size="sm" style={{ color: "rgba(237,236,234,0.55)" }}>
          Manage workspace members, view the team directory, and control access to shared brains.
        </Text>
      </div>

      <Link href="/members" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
        <Button
          leftSection={<UsersIcon />}
          rightSection={<ArrowRightIcon />}
          styles={{
            root: {
              background: "rgba(188,155,255,0.15)",
              borderRadius: 8,
              border: "1px solid rgba(188,155,255,0.25)",
              height: 40,
              padding: "0 18px",
              fontSize: 13,
              fontWeight: 500,
              color: "#BC9BFF",
              "&:hover": { background: "rgba(188,155,255,0.22)" },
            },
          }}
        >
          View Members
        </Button>
      </Link>
    </Stack>
  );
}
