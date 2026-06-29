/**
 * Clavex API client used by all MCP tools.
 * Reads credentials from environment variables:
 *
 *   CLAVEX_BASE_URL   — required, e.g. https://auth.example.com
 *   CLAVEX_TOKEN      — pre-acquired JWT bearer token (preferred)
 *
 *   — or —
 *
 *   CLAVEX_EMAIL      — admin email (auto-login on first call)
 *   CLAVEX_PASSWORD   — admin password
 *   CLAVEX_ORG_SLUG   — org slug (omit for superadmin)
 */

export class ClavexAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ClavexAPIError";
  }
}

interface LoginResponse {
  token: string;
}

export class ClavexClient {
  private readonly baseURL: string;
  private token: string | undefined;
  private loginPromise: Promise<void> | null = null;

  // Credential fields for auto-login
  private readonly email: string | undefined;
  private readonly password: string | undefined;
  private readonly orgSlug: string | undefined;

  constructor() {
    const base = process.env.CLAVEX_BASE_URL;
    if (!base) throw new Error("CLAVEX_BASE_URL environment variable is required");
    this.baseURL = base.replace(/\/+$/, "");
    this.token = process.env.CLAVEX_TOKEN;
    this.email = process.env.CLAVEX_EMAIL;
    this.password = process.env.CLAVEX_PASSWORD;
    this.orgSlug = process.env.CLAVEX_ORG_SLUG;
  }

  private async ensureToken(): Promise<void> {
    if (this.token) return;
    if (!this.email || !this.password) {
      throw new Error(
        "Authentication required: set CLAVEX_TOKEN or CLAVEX_EMAIL + CLAVEX_PASSWORD",
      );
    }
    if (!this.loginPromise) {
      this.loginPromise = this.doLogin().then(() => {
        this.loginPromise = null;
      }).catch((e) => {
        this.loginPromise = null;
        throw e;
      });
    }
    await this.loginPromise;
  }

  private async doLogin(): Promise<void> {
    const resp = await this.request<LoginResponse>(
      "POST",
      "/api/v1/auth/login",
      { org_slug: this.orgSlug, email: this.email, password: this.password },
      false,
    );
    this.token = resp.token;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true,
  ): Promise<T> {
    if (auth) await this.ensureToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (auth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(this.baseURL + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return undefined as unknown as T;

    let resBody: unknown;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      resBody = await res.json();
    } else {
      resBody = await res.text();
    }

    if (!res.ok) {
      const msg =
        typeof resBody === "object" && resBody !== null && "error" in resBody
          ? String((resBody as Record<string, unknown>).error)
          : String(resBody);
      throw new ClavexAPIError(res.status, resBody, `${method} ${path} → ${res.status}: ${msg}`);
    }

    return resBody as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }
  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }
  del<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  orgPath(orgID: string, suffix: string): string {
    return `/api/v1/organizations/${orgID}${suffix}`;
  }
}

// Singleton — created lazily on first tool call
let _client: ClavexClient | null = null;

export function getClient(): ClavexClient {
  if (!_client) _client = new ClavexClient();
  return _client;
}
