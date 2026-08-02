"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import getUser from "./getUser";
import type CogneeUser from "./CogneeUser";

export const CURRENT_USER_QUERY_KEY = ["current-user"] as const;
const localApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

function emailToName(email: string): string {
  const local = email.split("@")[0];
  if (!local) return "User";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

// Shared across TopBar, ProfileWidget, IntercomWidget, and IdentifyUser so the
// user profile is fetched once per session rather than once per component.
export function useCurrentUser(enabled = true): UseQueryResult<CogneeUser | null> {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async (): Promise<CogneeUser | null> => {
      try {
        // Fetch the real authenticated user from the backend.
        // credentials: "include" sends the fastapiusersauth cookie.
        const response = await fetch(`${localApiUrl}/api/v1/auth/me`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          return {
            id: data.id ?? "unknown",
            name: data.name ?? emailToName(data.email ?? ""),
            email: data.email ?? "",
            picture: data.picture ?? "",
            isSuperuser: data.is_superuser ?? false,
          };
        }
      } catch {
        // Backend unreachable — fall through to server-action fallback
      }
      try {
        return await getUser();
      } catch {
        // No session or fetch failed — treat as unauthenticated.
        return null;
      }
    },
    staleTime: Infinity,
    retry: false,
    throwOnError: false,
    enabled,
  });
}
