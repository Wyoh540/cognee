# Workspace Picker Header Avatar + Sidebar Members Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user avatar (ProfileMenu) to the right side of the WorkspacePicker header so users can log out / re-login from that page, and move the Members entry from the TopBar avatar dropdown into a new `MANAGE` section in the left sidebar (visible only to workspace owners).

**Architecture:** Reuse the existing `ProfileMenu` component in WorkspacePicker for behavioral parity with TopBar. Add a new `MANAGE` section to `NAV_SECTIONS` in `CustomAppShellNavbar` that's only rendered when `useTenant().isOwner` is true. Clean up `ProfileMenu` by removing the now-redundant Members link and `showMembers` prop, then clean up `TopBar` to match. Each task produces a working app state — the system is never broken between tasks.

**Tech Stack:** React 19, Next.js 16 (App Router), TypeScript, Mantine 8 (unrelated to this change), custom `useTenant` / `useCurrentUser` hooks, existing `ProfileMenu` and `useOutsideClick` utilities.

## Global Constraints

- **Code style:** Double quotes, 100-char line limit, ruff/prettier-equivalent (Ruff for Python, Prettier/ESLint for TS). Match existing inline-style patterns in `TopBar.tsx` and `CustomAppShellNavbar.tsx`.
- **TypeScript strict mode:** All new/modified code must compile under existing tsconfig settings; no `any` introduced.
- **No new test files:** Per the spec — verify changes with manual checks + `npm run lint` and `npx tsc --noEmit`.
- **No new dependencies:** Use only libraries already in `package.json`.
- **Permission gating:** Members is owner-only, both in the new sidebar entry and (historically) in the old ProfileMenu entry. Behavior is unchanged for non-owners — they never see a Members entry.
- **Existing routes:** `/members` page itself is untouched; only navigation entry points change.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx` | Renders left sidebar nav sections. | **Modify** — add `UsersIcon`, add `MANAGE` section, gate on `isOwner`. |
| `cognee-frontend/src/ui/layout/WorkspacePicker.tsx` | Renders the workspace-selection page. | **Modify** — add `<ProfileMenu />` to header right. |
| `cognee-frontend/src/ui/layout/ProfileMenu.tsx` | Avatar + dropdown menu (Profile, Log out). | **Modify** — remove Members link, `showMembers` prop, inline `UsersIcon`. |
| `cognee-frontend/src/ui/layout/TopBar.tsx` | Top app bar with breadcrumbs and right-side profile. | **Modify** — remove `isOwner` destructure and `showMembers` prop. |

No new files are created. No tests are added (per spec).

---

## Task Ordering Rationale

Tasks are ordered so that the app is in a working state after every commit:

1. **Task 1** adds the new sidebar entry. `Members` is now reachable from two places (old ProfileMenu + new sidebar) — this is intentional and safe.
2. **Task 2** adds the WorkspacePicker header avatar. Independent of the sidebar change.
3. **Task 3** removes the Members link from `ProfileMenu` and the now-unused `showMembers` prop. `Members` is now only in the sidebar.
4. **Task 4** removes the now-unused `isOwner` destructure from `TopBar` and the `showMembers` prop pass. Pure cleanup.
5. **Task 5** runs the verification suite (lint + type check + manual checklist).

---

### Task 1: Add MANAGE section with Members to the left sidebar

**Files:**
- Modify: `cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx`

**Interfaces:**
- Consumes: `useTenant()` — already imported, returns `{ isOwner, ... }`.
- Produces: a new "MANAGE" section visible only when `isOwner === true`, containing one item: `{ text: "Members", link: "/members", icon: UsersIcon }`.

**Background:** `CustomAppShellNavbar` already uses a `NAV_SECTIONS` constant array. We need to add a section gated on `isOwner`. To keep `NAV_SECTIONS` as a module-level constant (so it isn't reallocated every render), split it into a `BASE_NAV_SECTIONS` constant (the existing three sections) and a `MANAGE_NAV_SECTION` constant (the new one). In the component body, derive the rendered list with `isOwner ? [...BASE_NAV_SECTIONS, MANAGE_NAV_SECTION] : BASE_NAV_SECTIONS`.

- [ ] **Step 1: Add `UsersIcon` component above `NAV_SECTIONS`**

Open `cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx`. Immediately after the `KeyIcon` function (around line 93) and before the comment `// -- Navigation data --` (line 95), insert:

```tsx
function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#BC9BFF" : "rgba(255,255,255,0.5)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
```

- [ ] **Step 2: Rename `NAV_SECTIONS` to `BASE_NAV_SECTIONS` and add `MANAGE_NAV_SECTION`**

Find the existing declaration (line 118):

```tsx
const NAV_SECTIONS: NavSection[] = [
```

Change it to:

```tsx
const BASE_NAV_SECTIONS: NavSection[] = [
```

Then immediately after the closing `];` of `BASE_NAV_SECTIONS` (after the `CONNECT` section, around line 143), append:

```tsx
const MANAGE_NAV_SECTION: NavSection = {
  label: "MANAGE",
  items: [
    { text: "Members", link: "/members", icon: UsersIcon },
  ],
};
```

- [ ] **Step 3: Use `isOwner` from `useTenant()` to compute the sections list**

In the `CustomAppShellNavbar` function body (line 145), the existing destructure is:

```tsx
const { tenantReady } = useTenant();
```

Change it to:

```tsx
const { tenantReady, isOwner } = useTenant();
```

Then, immediately above the existing `<nav>` element (around line 183, the line `        <nav className="flex-1 overflow-y-auto px-3 py-2">`), add:

```tsx
        const navSections: NavSection[] = isOwner
          ? [...BASE_NAV_SECTIONS, MANAGE_NAV_SECTION]
          : BASE_NAV_SECTIONS;
```

Then update the `NAV_SECTIONS.map(...)` call (around line 184) to use `navSections` instead of `NAV_SECTIONS`. The line should change from:

```tsx
          {NAV_SECTIONS.map((section) => (
```

to:

```tsx
          {navSections.map((section) => (
```

- [ ] **Step 4: Lint check**

Run:

```bash
cd cognee-frontend && npm run lint -- src/ui/layout/Navbar/CustomAppShellNavbar.tsx
```

Expected: no errors. If ESLint complains about hook rules (declaring `const navSections` after a conditional return), wrap the entire `useTenant()` line + `navSections` derivation above all early returns. Currently the function has no early returns, so this is fine — but if any future change adds one, move the derivation to a `useMemo` keyed on `isOwner`:

```tsx
const navSections: NavSection[] = useMemo(
  () => (isOwner ? [...BASE_NAV_SECTIONS, MANAGE_NAV_SECTION] : BASE_NAV_SECTIONS),
  [isOwner]
);
```

Apply this version if `useMemo` is needed for the rules-of-hooks check; `useMemo` is already in `@/utils` or available via `react` directly (use `import { useMemo } from "react"`).

- [ ] **Step 5: Manual verify (owner account)**

Log in as a workspace owner. Confirm:
- The left sidebar shows `DATA` / `EXPLORE` / `CONNECT` / `MANAGE` sections.
- Under `MANAGE`, the `Members` item is present with a users icon.
- Clicking `Members` navigates to `/members` and the page loads.

- [ ] **Step 6: Manual verify (non-owner account)**

Log in as a non-owner member of a workspace. Confirm:
- The left sidebar shows `DATA` / `EXPLORE` / `CONNECT` only — no `MANAGE` section.
- `/members` is still not reachable from any UI entry (only direct URL would work, and the page itself would deny it; this is unchanged behavior).

- [ ] **Step 7: Commit**

```bash
git add cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx
git commit -m "feat(sidebar): add MANAGE section with Members entry for workspace owners"
```

---

### Task 2: Add ProfileMenu to WorkspacePicker header

**Files:**
- Modify: `cognee-frontend/src/ui/layout/WorkspacePicker.tsx`

**Interfaces:**
- Consumes: `useCurrentUser()` — already imported (line 5) and called (line 37) in this file.
- Consumes: `<ProfileMenu />` from `@/ui/layout/ProfileMenu` — to be imported.
- Produces: a `<ProfileMenu />` rendered in the header right when `currentUser` is non-null.

- [ ] **Step 1: Import `ProfileMenu`**

At the top of `cognee-frontend/src/ui/layout/WorkspacePicker.tsx`, the existing imports are:

```tsx
import { useState, useCallback } from "react";
import Image from "next/image";
import { useCurrentUser } from "@/modules/users/useCurrentUser";
import { type AvailableTenant } from "@/modules/tenant/TenantContext";
import NameWorkspaceModal from "./NameWorkspaceModal";
import createWorkspace from "@/modules/tenant/createWorkspace";
```

Add this import immediately after the `createWorkspace` import (alphabetical grouping, but since this is a new import for a sibling file in `./`, place it just after `NameWorkspaceModal`):

```tsx
import ProfileMenu from "./ProfileMenu";
```

- [ ] **Step 2: Modify the header to add the avatar on the right**

Find the existing `<header>` block (lines 80–95). It currently contains a 240px logo div, then a `<span>Workspaces</span>`, and nothing after. We need to wrap the `<span>Workspaces</span>` so a sibling div with `marginLeft: auto` pushes the avatar to the far right.

Replace the entire header block (lines 80–95):

```tsx
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
```

with:

```tsx
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
        {currentUser && (
          <div style={{ marginLeft: "auto" }}>
            <ProfileMenu
              userName={currentUser.name}
              userEmail={currentUser.email}
            />
          </div>
        )}
      </header>
```

The conditional `currentUser && (...)` ensures no avatar is rendered before the user query resolves or if the user is unauthenticated.

- [ ] **Step 3: Lint check**

Run:

```bash
cd cognee-frontend && npm run lint -- src/ui/layout/WorkspacePicker.tsx
```

Expected: no errors. If TypeScript complains about the `currentUser.name` / `currentUser.email` possibly being undefined, the existing `useCurrentUser` query returns `CogneeUser | null`, and we've already gated on `currentUser` being truthy, so the types should narrow correctly. If it doesn't narrow, assert:

```tsx
<ProfileMenu
  userName={currentUser.name ?? ""}
  userEmail={currentUser.email ?? ""}
/>
```

- [ ] **Step 4: Manual verify**

Trigger the WorkspacePicker by clearing the selected tenant (e.g., `localStorage.removeItem("cognee_selected_tenant")` and reload, or sign out and back in for a user with multiple workspaces). Confirm:
- The header right side shows a circular avatar with the user's initial.
- Clicking the avatar opens a dropdown with `Profile` and `Log out` (no `Members` — that comes in Task 3).
- Clicking `Log out` redirects to `/api/signout` and signs the user out.

- [ ] **Step 5: Commit**

```bash
git add cognee-frontend/src/ui/layout/WorkspacePicker.tsx
git commit -m "feat(workspace-picker): show user avatar in header for re-login"
```

---

### Task 3: Remove Members link from ProfileMenu

**Files:**
- Modify: `cognee-frontend/src/ui/layout/ProfileMenu.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `ProfileMenu` with no `showMembers` prop, no Members link, and no inline `UsersIcon` (the `UsersIcon` is now defined in `CustomAppShellNavbar.tsx` only).

**Background:** After Task 1, Members is reachable via the sidebar. The Members link in ProfileMenu is now redundant. Removing it eliminates duplicate entry points and a `showMembers` prop that would otherwise always be `false`.

- [ ] **Step 1: Remove the `showMembers` field from `ProfileMenuProps`**

Open `cognee-frontend/src/ui/layout/ProfileMenu.tsx`. Find the interface (lines 38–45):

```tsx
interface ProfileMenuProps {
  userName: string;
  userEmail: string;
  profileHref?: string;
  logoutHref?: string;
  /** Show Members link — gated by workspace owner / admin permission. */
  showMembers?: boolean;
}
```

Replace with:

```tsx
interface ProfileMenuProps {
  userName: string;
  userEmail: string;
  profileHref?: string;
  logoutHref?: string;
}
```

- [ ] **Step 2: Remove the `showMembers` parameter from the function signature**

Find the function declaration (line 47):

```tsx
export default function ProfileMenu({ userName, userEmail, profileHref = "/settings", logoutHref = "/api/signout", showMembers = false }: ProfileMenuProps) {
```

Replace with:

```tsx
export default function ProfileMenu({ userName, userEmail, profileHref = "/settings", logoutHref = "/api/signout" }: ProfileMenuProps) {
```

- [ ] **Step 3: Remove the `UsersIcon` function**

Find the function (lines 17–26):

```tsx
function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(237,236,234,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
```

Delete the entire function (lines 17–26, including the trailing blank line).

- [ ] **Step 4: Remove the Members link block**

Find the JSX block (lines 113–126):

```tsx
          {/* Members link — only for workspace owner / admin */}
          {showMembers && (
            <Link
              href="/members"
              onClick={close}
              className="flex items-center gap-[10px] rounded-[6px] px-3 py-[10px]"
              style={{ fontSize: 13, color: "rgba(237,236,234,0.8)", textDecoration: "none" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <UsersIcon />
              Members
            </Link>
          )}
```

Delete the entire block (including the comment line and the blank line that follows it).

- [ ] **Step 5: Lint and type check**

Run:

```bash
cd cognee-frontend && npm run lint -- src/ui/layout/ProfileMenu.tsx
npx tsc --noEmit -p cognee-frontend/tsconfig.json
```

Expected: no errors. If TypeScript flags the unused `Link` import (it was used by the Members link), verify that the `Profile` link above still uses `Link` — it does, so the import is still needed.

- [ ] **Step 6: Manual verify**

In any TopBar (i.e., on any app page), open the user avatar dropdown. Confirm:
- Only `Profile` and `Log out` items are shown.
- No `Members` item is present.
- Both items still work as before (Profile navigates to `/settings`, Log out signs out).

- [ ] **Step 7: Commit**

```bash
git add cognee-frontend/src/ui/layout/ProfileMenu.tsx
git commit -m "refactor(profile-menu): drop redundant Members link and showMembers prop"
```

---

### Task 4: Clean up TopBar — remove `isOwner` and `showMembers` usage

**Files:**
- Modify: `cognee-frontend/src/ui/layout/TopBar.tsx`

**Interfaces:**
- Consumes: `useTenant()` — currently destructures `{ requestCreateWorkspace, availableTenants, isOwner }` at line 71.
- Produces: a `TopBar` that no longer references `isOwner` or `showMembers`.

**Background:** After Task 3, `ProfileMenu` no longer takes `showMembers`. The only `isOwner` usage in TopBar was to pass that prop, so it can be removed from the destructure.

- [ ] **Step 1: Remove `isOwner` from the `useTenant()` destructure**

Find line 71:

```tsx
  const { requestCreateWorkspace, availableTenants, isOwner } = useTenant();
```

Replace with:

```tsx
  const { requestCreateWorkspace, availableTenants } = useTenant();
```

- [ ] **Step 2: Remove `showMembers` from the `<ProfileMenu />` invocation**

Find the `<ProfileMenu />` block (lines 162–167):

```tsx
        <ProfileMenu
          userName={currentUser?.name || ""}
          userEmail={currentUser?.email || ""}
          logoutHref="/api/signout"
          showMembers={isOwner}
        />
```

Replace with:

```tsx
        <ProfileMenu
          userName={currentUser?.name || ""}
          userEmail={currentUser?.email || ""}
          logoutHref="/api/signout"
        />
```

- [ ] **Step 3: Lint and type check**

Run:

```bash
cd cognee-frontend && npm run lint -- src/ui/layout/TopBar.tsx
npx tsc --noEmit -p cognee-frontend/tsconfig.json
```

Expected: no errors. Verify no other reference to `isOwner` remains in this file (a quick `grep -n isOwner cognee-frontend/src/ui/layout/TopBar.tsx` should return nothing).

- [ ] **Step 4: Manual verify**

On any app page, confirm:
- TopBar still renders the workspace switcher, breadcrumbs, HelpMenu, and avatar.
- The avatar dropdown still works (Profile + Log out, no Members).
- Workspace switcher still functions (this exercises `availableTenants` and `requestCreateWorkspace`, which we still consume).

- [ ] **Step 5: Commit**

```bash
git add cognee-frontend/src/ui/layout/TopBar.tsx
git commit -m "refactor(topbar): remove unused isOwner destructuring and showMembers prop"
```

---

### Task 5: Final verification

**Files:** None modified — verification only.

- [ ] **Step 1: Run lint across the entire frontend**

Run:

```bash
cd cognee-frontend && npm run lint
```

Expected: 0 errors. Warnings are tolerated (pre-existing warnings in unrelated files are OK).

- [ ] **Step 2: Run TypeScript type check**

Run:

```bash
cd cognee-frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run the build**

Run:

```bash
cd cognee-frontend && npm run build
```

Expected: build succeeds. (This catches anything `next build` enforces that `tsc --noEmit` doesn't, such as client/server boundary issues.)

- [ ] **Step 4: Manual end-to-end verification**

Run `npm run dev` and walk through the full manual checklist from the spec (`docs/superpowers/specs/2026-08-03-workspace-picker-header-avatar-and-sidebar-members-design.md`, section 7). Each item must pass:

1. WorkspacePicker header right side shows the user avatar; clicking opens Profile + Log out; Log out works.
2. After re-login, the new account's avatar appears.
3. Owner account: sidebar shows MANAGE > Members; clicking navigates to `/members`; page loads.
4. Non-owner account: sidebar has no MANAGE section.
5. TopBar avatar dropdown no longer contains Members.
6. Tenant switch: MANAGE section appears/disappears as `isOwner` changes.
7. Mobile drawer: MANAGE section visible the same way as desktop.

- [ ] **Step 5: Confirm no regressions in other consumers**

Search the codebase for any other consumer of `ProfileMenu` or `isOwner` that may have relied on the old shape:

```bash
grep -rn "showMembers\|ProfileMenu" cognee-frontend/src/
grep -rn "isOwner" cognee-frontend/src/ui/layout/
```

Expected: no remaining references to `showMembers`. `ProfileMenu` and `isOwner` references are expected and fine (sidebar uses `isOwner`; multiple files use `ProfileMenu`).

- [ ] **Step 6: Final commit (if Step 5 surfaced any tiny fix-ups)**

If any fix-up commit is needed (e.g., a stray unused import), commit it with a clear message. If nothing needs fixing, skip this step.

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: post-implementation cleanup"
```
