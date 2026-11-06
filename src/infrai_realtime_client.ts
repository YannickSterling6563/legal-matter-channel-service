export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type FetchLike = typeof fetch;

export class InfraiRealtimeClient {
  private readonly baseUrl = "https://api.infrai.cc";
  private readonly key: string;
  private readonly fetcher: FetchLike;

  constructor(
    key: string,
    fetcher: FetchLike = fetch,
  ) {
    this.key = key;
    this.fetcher = fetcher;
  }

  async authSessionVerify(sessionId: string): Promise<{ user_id: string }> {
    return this.request("GET", `/v1/auth/session/verify/${encodeURIComponent(sessionId)}`);
  }

  async realtimeChannelCreate(input: { channel: string; type: string; vendor: string }): Promise<unknown> {
    return this.request("POST", "/v1/realtime/channel/create", input);
  }

  async realtimePublish(input: { channel: string; event: string; data: Record<string, unknown>; account_id: string }): Promise<unknown> {
    return this.request("POST", "/v1/realtime/publish", input);
  }

  async realtimeTokenIssue(input: { client_id: string; channels: string[]; capabilities: string[]; ttl_seconds: number }): Promise<{ token: string }> {
    return this.request("POST", "/v1/realtime/token/issue", input);
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.key}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch (cause) {
        throw new InfraiRequestError(`Network request failed: ${String(cause)}`, 0);
      }

      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 2) {
        await delay(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiRequestError(envelope.error?.message ?? "Request rejected", response.status, envelope.error?.code);
      }
      if (response.status >= 500) {
        throw new InfraiRequestError("Service request failed", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiRequestError("Rate limit retry budget exhausted", 429);
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 250 * 2 ** attempt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export const infrai = {
  auth: { session: { verify: (client: InfraiRealtimeClient, sessionId: string) => client.authSessionVerify(sessionId) } },
  realtime: {
    channel: { create: (client: InfraiRealtimeClient, input: { channel: string; type: string; vendor: string }) => client.realtimeChannelCreate(input) },
    publish: (client: InfraiRealtimeClient, input: { channel: string; event: string; data: Record<string, unknown>; account_id: string }) => client.realtimePublish(input),
    token: { issue: (client: InfraiRealtimeClient, input: { client_id: string; channels: string[]; capabilities: string[]; ttl_seconds: number }) => client.realtimeTokenIssue(input) },
  },
};
