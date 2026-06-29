import { LoginParams, LoginResponse } from "./types.js";

export class ClavexError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ClavexError";
  }

  /** Returns true when the server responded with 404 Not Found. */
  isNotFound(): boolean {
    return this.status === 404;
  }
}

export interface ClientOptions {
  /** Pre-acquired JWT (supersedes email/password). */
  token?: string;
  /** Admin e-mail for password-based authentication. */
  email?: string;
  /** Admin password. */
  password?: string;
  /** Organisation slug (leave empty for superadmin login). */
  orgSlug?: string;
  /** Custom fetch implementation (e.g. for testing). Defaults to global fetch. */
  fetch?: typeof fetch;
}

/**
 * Low-level HTTP client used by all service classes.
 * Applications should use `ClavexClient` from `index.ts` instead.
 */
export class HttpClient {
  private token: string | undefined;
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;

  // Credential fields for auto-login.
  private readonly email: string | undefined;
  private readonly password: string | undefined;
  private readonly orgSlug: string | undefined;
  private loginPromise: Promise<void> | null = null;

  constructor(baseURL: string, opts: ClientOptions = {}) {
    this.baseURL = baseURL.replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.token = opts.token;
    this.email = opts.email;
    this.password = opts.password;
    this.orgSlug = opts.orgSlug;
  }

  /** Override the bearer token (e.g. after external rotation). */
  setToken(token: string): void {
    this.token = token;
  }

  /** Authenticate with email+password and store the resulting JWT. */
  async login(p: LoginParams): Promise<LoginResponse> {
    const resp = await this.request<LoginResponse>("POST", "/api/v1/auth/login", p, false);
    this.token = resp.token;
    return resp;
  }

  // ── Auth helpers ────────────────────────────────────────────────────────────

  private async ensureToken(): Promise<void> {
    if (this.token) return;
    if (!this.email || !this.password) return;
    // Deduplicate concurrent inflight login calls.
    if (!this.loginPromise) {
      this.loginPromise = this.login({
        org_slug: this.orgSlug,
        email: this.email,
        password: this.password,
      }).then(() => {
        this.loginPromise = null;
      }).catch((e) => {
        this.loginPromise = null;
        throw e;
      });
    }
    await this.loginPromise;
  }

  // ── Core request ────────────────────────────────────────────────────────────

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true,
  ): Promise<T> {
    if (auth) await this.ensureToken();

    const url = this.baseURL + path;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (auth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await this.fetchImpl(url, {
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
        typeof resBody === "object" &&
        resBody !== null &&
        "error" in resBody
          ? String((resBody as Record<string, unknown>)["error"])
          : `HTTP ${res.status}`;
      throw new ClavexError(res.status, resBody, msg);
    }

    return resBody as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete(path: string, body?: unknown): Promise<void> {
    return this.request<void>("DELETE", path, body);
  }

  // ── Path helpers ─────────────────────────────────────────────────────────────

  orgPath(orgID: string, suffix: string): string {
    return `/api/v1/organizations/${orgID}${suffix}`;
  }
}
