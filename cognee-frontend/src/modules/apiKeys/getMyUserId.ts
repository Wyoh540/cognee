export default async function getMyUserId(): Promise<string | null> {
  const response = await fetch("/api/me");
  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`);
  }
  const data = await response.json();
  return data.userId ?? null;
}
