/**
 * Internal hook — typed API client for the Clavex REST API.
 *
 * Derives the base URL from the OIDC issuer: strip the org-slug path segment
 * to get the Clavex server root.
 *
 *   issuer  = https://id.example.com/acme
 *   baseUrl = https://id.example.com
 *   api     = https://id.example.com/api/v1
 *
 * Uses the access token from the active session if available.
 */
import { useAccessToken, useClavexConfig } from "@clavex/react";

export interface ClavexApiClient {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body: unknown): Promise<T>;
  del(path: string): Promise<void>;
  /** Clavex server root — useful for constructing org-specific URLs. */
  baseUrl: string;
}

/** Extract the Clavex server root from an issuer URL (strips the org slug). */
export function extractBaseUrl(issuer: string): string {
  try {
    const url = new URL(issuer);
    // Issuer path is /<org-slug>[/…] — we want just the origin.
    return url.origin;
  } catch {
    return issuer;
  }
}

export function useClavexApiClient(): ClavexApiClient {
  const accessToken = useAccessToken(); // returns string | null
  const config = useClavexConfig();
  const baseUrl = extractBaseUrl(config.issuer);
  const apiBase = `${baseUrl}/api/v1`;

  function authHeaders(): Record<string, string> {
    return accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};
  }

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${apiBase}${path}`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) {
      throw new Error(`Clavex API GET ${path} → HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Clavex API POST ${path} → HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async function del(path: string): Promise<void> {
    const res = await fetch(`${apiBase}${path}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    if (!res.ok) {
      throw new Error(`Clavex API DELETE ${path} → HTTP ${res.status}`);
    }
  }

  return { get, post, del, baseUrl };
}
