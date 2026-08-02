/**
 * Placeholder for tenant-init cache invalidation.
 *
 * The original initCache module (never committed) was intended to hold
 * caches that must be cleared before a tenant switch triggers a full-page
 * reload. Since switchTenant() already tears down all in-memory state via
 * window.location.reload() / window.location.href, this is a no-op.
 */
export function clearInitCache(): void {
  // Full-page navigation invalidates everything implicitly.
}
