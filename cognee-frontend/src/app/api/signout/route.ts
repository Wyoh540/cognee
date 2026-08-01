import { NextResponse } from "next/server";

const localApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";
const authCookieName = process.env.AUTH_TOKEN_COOKIE_NAME || "auth_token";

export async function GET(request: Request) {
  // Call the backend's logout endpoint to invalidate the session
  try {
    await fetch(`${localApiUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
  } catch {
    // Backend might be down — still clear cookies and redirect
  }

  // Clear the auth cookie and redirect to sign-in
  const response = NextResponse.redirect(new URL("/sign-in", request.url));

  // Clear the actual auth cookie (defaults to "auth_token", configurable via AUTH_TOKEN_COOKIE_NAME)
  response.cookies.set(authCookieName, "", {
    maxAge: 0,
    path: "/",
  });

  // Also clear legacy cookie name for backward compatibility
  if (authCookieName !== "fastapiusersauth") {
    response.cookies.set("fastapiusersauth", "", {
      maxAge: 0,
      path: "/",
    });
  }

  return response;
}
