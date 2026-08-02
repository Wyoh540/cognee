export interface ApiKey {
  id: string;
  key: string;
  label: string;
  name: string;
}

export default async function getApiKeys(): Promise<ApiKey[]> {
  const response = await fetch("/api/api-keys");
  if (!response.ok) {
    throw new Error(`Failed to fetch API keys: ${response.status}`);
  }
  return response.json();
}
