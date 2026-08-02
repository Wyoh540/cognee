import { http } from "./client";

/**
 * OSS stub — the SaaS version creates a tenant-pod-scoped HTTP client
 * with API-key auth. The OSS build uses a single local backend, so this
 * returns the standard http client.
 */
export function createPodClient(_podUrl: string, _apiKey: string) {
  return http;
}
