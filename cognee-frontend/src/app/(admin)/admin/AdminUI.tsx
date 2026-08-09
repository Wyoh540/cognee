"use client";

import { notifications } from "@mantine/notifications";

export const ADMIN_COLORS = {
  surfaceBg: "rgba(255,255,255,0.06)",
  surfaceBorder: "1px solid rgba(255,255,255,0.1)",
  textPrimary: "#EDECEA",
  textMuted: "rgba(237,236,234,0.55)",
  textDim: "rgba(237,236,234,0.35)",
  textExtraDim: "rgba(237,236,234,0.3)",
  accent: "#BC9BFF",
  accentBg: "rgba(188,155,255,0.18)",
  danger: "#EF4444",
  green: "#34D399",
} as const;

export function AdminCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: ADMIN_COLORS.surfaceBg, backdropFilter: "blur(12px)", border: ADMIN_COLORS.surfaceBorder, borderRadius: 12, padding: "1.25rem 1.5rem", ...style }}>{children}</div>;
}

export const adminPrimaryButtonStyles = {
  root: { flexShrink: 0, background: "linear-gradient(135deg, #6510F4, #8B5CF6)", borderRadius: 8, border: "none", height: 40, padding: "0 18px", fontSize: 13, fontWeight: 600, color: "#fff" },
};

export const adminModalStyles = {
  overlay: { backgroundColor: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" },
  content: { background: "#151416", color: ADMIN_COLORS.textPrimary, border: ADMIN_COLORS.surfaceBorder, borderRadius: 12 },
  header: { background: "#151416", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  body: { paddingTop: 20 },
  title: { color: ADMIN_COLORS.textPrimary, fontWeight: 600 },
  close: { color: ADMIN_COLORS.textMuted },
};

export const adminInputStyles = {
  label: { color: ADMIN_COLORS.textMuted, marginBottom: 6 },
  description: { color: ADMIN_COLORS.textDim, marginBottom: 6 },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: ADMIN_COLORS.textPrimary, borderRadius: 8 },
};

export const adminPasswordInputStyles = { ...adminInputStyles, innerInput: { color: ADMIN_COLORS.textPrimary } };
export const adminCheckboxStyles = { label: { color: ADMIN_COLORS.textPrimary }, input: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.18)" } };

export function notifyAdminSuccess(message: string) { notifications.show({ message, color: "green", autoClose: 3500 }); }
export function notifyAdminError(message: string) { notifications.show({ title: "Error", message, color: "red", autoClose: 6000 }); }
