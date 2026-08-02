export default async function deleteApiKey(keyId: string): Promise<void> {
  const response = await fetch(`/api/api-keys/${keyId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete API key: ${response.status}`);
  }
}
