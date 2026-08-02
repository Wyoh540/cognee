import { NextRequest, NextResponse } from "next/server";

const localApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

// Proxies GET (list) and POST (create) API key requests to the cognee backend.
export async function GET(request: NextRequest) {
  const headers = buildAuthHeaders(request);
  await ensureAuth(headers);

  try {
    const response = await fetch(`${localApiUrl}/api/v1/auth/api-keys`, { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      return NextResponse.json(
        { error: `Backend returned ${response.status}`, detail: body },
        { status: response.status },
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach backend", detail: String(err) },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const headers = buildAuthHeaders(request);
  headers["Content-Type"] = "application/json";
  await ensureAuth(headers);

  try {
    const body = await request.json();
    const response = await fetch(`${localApiUrl}/api/v1/auth/api-keys`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(unreadable)");
      return NextResponse.json(
        { error: `Backend returned ${response.status}`, detail: errorBody },
        { status: response.status },
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach backend", detail: String(err) },
      { status: 502 },
    );
  }
}

function buildAuthHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;
  const authHeader = request.headers.get("authorization");
  if (authHeader) headers["authorization"] = authHeader;
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

async function ensureAuth(headers: Record<string, string>): Promise<void> {
  if (headers["cookie"] || headers["authorization"] || headers["x-api-key"]) return;

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
    // Fall through — the downstream request will fail with 401 if auth is required
  }
}
