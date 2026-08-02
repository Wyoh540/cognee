import { http } from "./client";

/**
 * OSS stub — the SaaS version uses a separate management-plane HTTP
 * client for tenant provisioning. The OSS build has no management plane.
 */
export const managementHttp = http;
