import getApiKeys from "./getApiKeys";
import createApiKey from "./createAPIKey";

/**
 * Returns an existing API key, or creates one if none exist.
 */
export default async function getOrCreateApiKey(): Promise<string> {
  const keys = await getApiKeys();
  if (keys.length > 0) {
    return keys[0].key;
  }

  const created = await createApiKey({ name: "Default" });
  return created.key;
}
