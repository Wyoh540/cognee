import { NextRequest, NextResponse } from "next/server";

const localApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

// Proxies DELETE API key requests to the cognee backend.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;
  const authHeader = request.headers.get("authorization");
  if (authHeader) headers["authorization"] = authHeader;
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) headers["x-api-key"] = apiKey;

  if (!headers["cookie"] && !headers["authorization"] && !headers["x-api-key"]) {
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
    const response = await fetch(`${localApiUrl}/api/v1/auth/api-keys/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      return NextResponse.json(
        { error: `Backend returned ${response.status}`, detail: body },
        { status: response.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach backend", detail: String(err) },
      { status: 502 },
    );
  }
}
