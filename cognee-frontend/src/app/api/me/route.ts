import { NextRequest, NextResponse } from "next/server";

const localApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

// Proxies GET /me to the cognee backend.
// Also serves the UserProvider's useQuery(["me"], ...) which currently has no
// matching route, causing userMe to stay null with isUserMeError=true.
export async function GET(request: NextRequest) {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;
  const authHeader = request.headers.get("authorization");
  if (authHeader) headers["authorization"] = authHeader;

  if (!cookie && !authHeader) {
    try {
      const loginResp = await fetch(`${localApiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "username=default_user@example.com&password=default_password",
      });
      if (loginResp.ok) {
        const data = await loginResp.json();
        headers["authorization"] = `Bearer ${data.access_token}`;
      }
    } catch {
      // Fall through
    }
  }

  try {
    const response = await fetch(`${localApiUrl}/api/v1/auth/me`, { headers });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend returned ${response.status}` },
        { status: response.status },
      );
    }
    const backendData = await response.json();

    // Map backend shape to the shape UserProvider expects:
    //   { id, email }        from backend
    // → { userId, email, ...UserMe fields }
    return NextResponse.json({
      userId: backendData.id ?? null,
      email: backendData.email,
      isSeenWelcome: true,
      onboardingCompletedAt: null,
      activeWorkspaceId: null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach backend", detail: String(err) },
      { status: 502 },
    );
  }
}
