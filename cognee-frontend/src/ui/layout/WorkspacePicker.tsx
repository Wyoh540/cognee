"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useCurrentUser } from "@/modules/users/useCurrentUser";
import { type AvailableTenant } from "@/modules/tenant/TenantContext";
import NameWorkspaceModal from "./NameWorkspaceModal";
import createWorkspace from "@/modules/tenant/createWorkspace";

/* ── Dark-theme constants matching CustomAppShell / TopBar ── */

const SURFACE_CARD = "rgba(26,26,26,1)";
const SURFACE_CARD_HOVER = "rgba(30,30,30,1)";
const BORDER_CARD = "rgba(255,255,255,0.08)";
const BORDER_CARD_HOVER = "rgba(188,155,255,0.40)";
const TEXT_PRIMARY = "#EDECEA";
const TEXT_SECONDARY = "rgba(237,236,234,0.55)";
const TEXT_MUTED = "rgba(237,236,234,0.35)";
const ACCENT = "#6510F4";
const HEADER_BG = "rgba(0,0,0,0.65)";

/* Deterministic color per tenant ID, same algorithm as FilterContext */
const TENANT_COLORS = ["#6510F4", "#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#BE185D"];
function colorForTenant(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return TENANT_COLORS[Math.abs(hash) % TENANT_COLORS.length];
}

interface WorkspacePickerProps {
  workspaces: AvailableTenant[];
  switchTenant: (tenantId: string, tenantName?: string) => void;
  refreshWorkspaces: () => void;
}

export default function WorkspacePicker({ workspaces, switchTenant, refreshWorkspaces }: WorkspacePickerProps) {
  const { data: currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.isSuperuser ?? false;

  // ── Create modal ──
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createWorkspace(trimmed);
      if (result.success) {
        setNameModalOpen(false);
        setNewName("");
        refreshWorkspaces();
      } else {
        setCreateError(result.error || "Failed to create workspace");
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }, [newName, refreshWorkspaces]);

  const isEmpty = workspaces.length === 0;

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#000000",
      backgroundImage:
        "linear-gradient(rgba(244,244,244,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(244,244,244,0.10) 1px, transparent 1px)",
      backgroundSize: "33px 33px",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header — same as TopBar */}
      <header style={{
        height: 53,
        paddingInline: 24,
        display: "flex",
        alignItems: "center",
        background: HEADER_BG,
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${BORDER_CARD}`,
      }}>
        <div style={{ width: 240, flexShrink: 0, display: "flex", alignItems: "center" }}>
          <Image src="/cognee-logo-black.svg" alt="Cognee" width={110} height={24} style={{ filter: "invert(1)" }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: TEXT_SECONDARY }}>
          Workspaces
        </span>
      </header>

      {/* Body */}
      <main style={{
        flex: 1,
        padding: "2.5rem 2rem",
        maxWidth: 960,
        width: "100%",
        margin: "0 auto",
      }}>
        {/* Heading row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>
            {isEmpty ? "No workspaces" : "Your workspaces"}
          </h1>
          {isSuperAdmin && (
            <button
              onClick={() => { setNameModalOpen(true); setNewName(""); setCreateError(null); }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                background: ACCENT,
                color: "#ffffff",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <PlusIcon />
              Create workspace
            </button>
          )}
        </div>

        {/* Card grid — or empty state */}
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
            gap: "0.75rem",
          }}>
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                onClick={() => switchTenant(ws.id, ws.name)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      {nameModalOpen && (
        <NameWorkspaceModal
          name={newName}
          setName={setNewName}
          submitting={creating}
          error={createError}
          onSubmit={handleCreate}
          onClose={() => { setNameModalOpen(false); setNewName(""); setCreateError(null); }}
          showPaymentInfo={false}
        />
      )}
    </div>
  );
}

/* ── Workspace Card ── */

function WorkspaceCard({ workspace, onClick }: { workspace: AvailableTenant; onClick: () => void }) {
  const color = colorForTenant(workspace.id);
  return (
    <button
      onClick={onClick}
      style={{
        background: SURFACE_CARD,
        borderRadius: "0.625rem",
        border: `1px solid ${BORDER_CARD}`,
        padding: "1.125rem",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = SURFACE_CARD_HOVER;
        e.currentTarget.style.borderColor = BORDER_CARD_HOVER;
        e.currentTarget.style.boxShadow = "0px 4px 16px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = SURFACE_CARD;
        e.currentTarget.style.borderColor = BORDER_CARD;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Initial avatar */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "0.5rem",
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: "#ffffff", fontSize: "1rem", fontWeight: 700 }}>
            {workspace.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
          <span style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: TEXT_PRIMARY,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {workspace.name}
          </span>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: workspace.isOwner ? "rgba(188,155,255,0.60)" : TEXT_MUTED,
          }}>
            {workspace.isOwner ? "Owner" : "Member"}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── Empty State ── */

function EmptyState() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "4rem 2rem",
      textAlign: "center",
    }}>
      <div style={{ marginBottom: "1rem" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600, color: TEXT_PRIMARY }}>
        No workspaces yet
      </h2>
      <p style={{ margin: 0, fontSize: "0.875rem", color: TEXT_SECONDARY, lineHeight: "1.5", maxWidth: 340 }}>
        You are not a member of any workspace. Contact your workspace administrator to be added.
      </p>
    </div>
  );
}

/* ── Plus Icon ── */

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
