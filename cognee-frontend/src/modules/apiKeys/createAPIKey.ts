export interface CreatedApiKey {
  id: string;
  key: string;
}

export default async function createApiKey(
  options: { name?: string; noRedirectOnAuth?: boolean } = {},
): Promise<CreatedApiKey> {
  const response = await fetch("/api/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: options.name ?? null }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
    throw new Error(error?.error?.message || `Failed to create API key: ${response.status}`);
  }
  return response.json();
}
