"use client";

import { Stack } from "@mantine/core";
import { trackPageEvent } from "@/modules/analytics";

export default function SecurityWidget() {
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
          Security
        </h2>
        <p style={{ fontSize: 14, color: "rgba(237,236,234,0.55)", margin: 0 }}>
          Manage your account security and session
        </p>
      </div>

      <Stack gap="1.25rem">
        <Stack gap="0.25rem">
          <span style={{ fontSize: 14, fontWeight: 500, color: "#EDECEA" }}>
            Password
          </span>
          <span style={{ fontSize: 14, color: "rgba(237,236,234,0.55)" }}>
            Your password is managed by your authentication provider.
          </span>
        </Stack>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

        <Stack gap="0.25rem">
          <span style={{ fontSize: 14, fontWeight: 500, color: "#EDECEA" }}>
            Session
          </span>
          <span style={{ fontSize: 14, color: "rgba(237,236,234,0.55)", marginBottom: "0.5rem" }}>
            Sign out of your account on this device.
          </span>
          <a
            href="/api/signout"
            onClick={() => trackPageEvent({ pageName: "Settings", eventName: "sign_out" })}
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(237,236,234,0.7)",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            Log out
          </a>
        </Stack>
      </Stack>
    </Stack>
  );
}
