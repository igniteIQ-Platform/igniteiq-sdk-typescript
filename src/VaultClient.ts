import type {
  VaultClientOptions,
  VaultQuery,
  VaultResult,
  ContextSnapshot,
  AskResponse,
  ToolFormat,
  Webhook,
  CreateWebhookInput,
} from './types';
import { VaultError } from './errors';

const DEFAULT_BASE_URL = 'https://api.igniteiq.com';

// ---------------------------------------------------------------------------
// Internal helper types
// ---------------------------------------------------------------------------

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

// ---------------------------------------------------------------------------
// Schema sub-client
// ---------------------------------------------------------------------------

class SchemaClient {
  constructor(
    private readonly doRequest: <T>(
      method: 'GET' | 'POST' | 'DELETE',
      path: string,
      body?: unknown,
    ) => Promise<T>,
  ) {}

  /**
   * Returns LLM tool definitions for all Vault query capabilities.
   *
   * @param format - Target LLM format: `'openai'`, `'anthropic'`, or `'json-schema'`
   *
   * @example
   * ```ts
   * const tools = await client.schema.tools('openai');
   * // Pass `tools` directly into OpenAI chat completions `tools` array
   * ```
   */
  tools(format: ToolFormat): Promise<Record<string, unknown>> {
    return this.doRequest<Record<string, unknown>>('GET', `/api/schema/tools/${format}`);
  }

  /**
   * Returns the full OpenAPI 3.0 specification for the Vault REST API.
   *
   * @example
   * ```ts
   * const spec = await client.schema.openapi();
   * ```
   */
  openapi(): Promise<Record<string, unknown>> {
    return this.doRequest<Record<string, unknown>>('GET', '/api/schema/openapi');
  }
}

// ---------------------------------------------------------------------------
// Webhooks sub-client
// ---------------------------------------------------------------------------

class WebhooksClient {
  constructor(
    private readonly doRequest: <T>(
      method: 'GET' | 'POST' | 'DELETE',
      path: string,
      body?: unknown,
    ) => Promise<T>,
  ) {}

  /**
   * Register a webhook. Requires an API key with the `webhooks` scope.
   *
   * If you omit `secret`, IgniteIQ generates one and returns it **once** on the
   * created webhook (`secret` field) — store it immediately to verify the
   * `X-IgniteIQ-Signature` header on deliveries.
   *
   * @example
   * ```ts
   * const wh = await client.webhooks.create({
   *   url: 'https://example.com/iq-hook',
   *   events: ['forge.run.completed', 'depot.sync.failed'],
   * });
   * console.log(wh.secret); // 'whsec_...' (only shown here)
   * ```
   */
  create(input: CreateWebhookInput): Promise<Webhook> {
    return this.doRequest<Webhook>('POST', '/api/webhooks', input);
  }

  /**
   * List active webhooks for the organisation. Secrets are never returned.
   *
   * @example
   * ```ts
   * const hooks = await client.webhooks.list();
   * ```
   */
  async list(): Promise<Webhook[]> {
    const res = await this.doRequest<{ webhooks: Webhook[] }>('GET', '/api/webhooks');
    return res.webhooks ?? [];
  }

  /**
   * Deactivate (delete) a webhook by id. Idempotent from the caller's view.
   *
   * @example
   * ```ts
   * await client.webhooks.delete('wh_abc123');
   * ```
   */
  async delete(webhookId: string): Promise<void> {
    await this.doRequest<unknown>('DELETE', `/api/webhooks/${encodeURIComponent(webhookId)}`);
  }
}

// ---------------------------------------------------------------------------
// VaultClient
// ---------------------------------------------------------------------------

/**
 * The main IgniteIQ Vault API client.
 *
 * @example
 * ```ts
 * import { VaultClient } from '@igniteiq/vault-client';
 *
 * const client = new VaultClient({
 *   apiKey: 'iq_live_...',
 *   orgSlug: 'acme-plumbing',
 * });
 *
 * const result = await client.query({
 *   measures: ['fact_jobs.total_revenue'],
 *   timeDimensions: [{ dimension: 'fact_jobs.job_created_at', dateRange: 'last 30 days' }],
 * });
 * ```
 */
export class VaultClient {
  private readonly apiKey: string;
  private readonly orgSlug: string;
  private readonly baseUrl: string;

  /**
   * Access schema utilities — fetch tool definitions and the OpenAPI spec.
   *
   * @example
   * ```ts
   * const tools = await client.schema.tools('openai');
   * const spec  = await client.schema.openapi();
   * ```
   */
  readonly schema: SchemaClient;

  /**
   * Manage webhooks — create, list, delete. Requires an API key with the
   * `webhooks` scope (create one in Studio → Settings → API Keys).
   *
   * @example
   * ```ts
   * const wh = await client.webhooks.create({ url: 'https://…', events: ['forge.run.completed'] });
   * const all = await client.webhooks.list();
   * await client.webhooks.delete(wh.id);
   * ```
   */
  readonly webhooks: WebhooksClient;

  constructor(opts: VaultClientOptions) {
    if (!opts.apiKey) throw new Error('VaultClient: apiKey is required');
    if (!opts.orgSlug) throw new Error('VaultClient: orgSlug is required');

    this.apiKey = opts.apiKey;
    this.orgSlug = opts.orgSlug;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');

    this.schema = new SchemaClient(this.request.bind(this));
    this.webhooks = new WebhooksClient(this.request.bind(this));
  }

  // -------------------------------------------------------------------------
  // Private HTTP helper
  // -------------------------------------------------------------------------

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': '@igniteiq/vault-client/0.2.0',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // Attempt to parse JSON; tolerate empty / non-JSON responses
    const json: unknown = await res.json().catch(() => ({}));

    if (!res.ok) {
      const envelope = json as ApiErrorEnvelope;
      const err = envelope.error;
      throw new VaultError(
        err?.code ?? 'API_ERROR',
        err?.message ?? `HTTP ${res.status}`,
        res.status,
      );
    }

    return json as T;
  }

  // -------------------------------------------------------------------------
  // Public methods
  // -------------------------------------------------------------------------

  /**
   * Execute a semantic-layer query against the Vault.
   *
   * @param query - A Cube-compatible query object.
   * @returns Tabular data rows plus query metadata.
   *
   * @example
   * ```ts
   * const result = await client.query({
   *   measures: ['fact_jobs.total_revenue', 'fact_jobs.count'],
   *   timeDimensions: [{
   *     dimension: 'fact_jobs.job_created_at',
   *     dateRange: 'last 30 days',
   *     granularity: 'month',
   *   }],
   *   dimensions: ['dim_business_unit.business_unit_name'],
   *   limit: 100,
   * });
   *
   * for (const row of result.data) {
   *   console.log(row['dim_business_unit.business_unit_name'], row['fact_jobs.total_revenue']);
   * }
   * ```
   */
  async query(query: VaultQuery): Promise<VaultResult> {
    return this.request<VaultResult>('POST', '/api/vault/query', { query });
  }

  /**
   * Fetch a structured business-context snapshot for the organisation,
   * suitable for injecting into an LLM system prompt.
   *
   * @param opts.period       - Period preset (default `'last_30_days'`).
   * @param opts.divisionSlug - Filter to a specific division / ServiceTitan tenant.
   *
   * @example
   * ```ts
   * const ctx = await client.context({ period: 'last_30_days' });
   * // Inject the ready-made fragment:
   * const systemPrompt = `You are a helpful assistant.\n\n${ctx.systemPromptFragment}`;
   * ```
   */
  async context(opts?: { period?: string; divisionSlug?: string }): Promise<ContextSnapshot> {
    const period = opts?.period ?? 'last_30_days';
    const qs = new URLSearchParams({ period });
    if (opts?.divisionSlug) qs.set('divisionSlug', opts.divisionSlug);
    return this.request<ContextSnapshot>('GET', `/api/context/${this.orgSlug}?${qs.toString()}`);
  }

  /**
   * Answer a natural-language question using the Vault data.
   *
   * The server translates the question into a structured query, executes it,
   * and returns a human-readable answer alongside the raw data rows.
   *
   * @param question         - Plain-English question.
   * @param opts.divisionSlug - Scope the question to a specific division.
   *
   * @example
   * ```ts
   * const ans = await client.ask('What was our revenue last month?');
   * console.log(ans.answer);          // "Revenue last month was $142,300"
   * console.log(ans.confidence);      // "high"
   * console.log(ans.data);            // raw rows
   * ```
   */
  async ask(question: string, opts?: { divisionSlug?: string }): Promise<AskResponse> {
    return this.request<AskResponse>('POST', '/api/ask', {
      question,
      divisionSlug: opts?.divisionSlug ?? null,
    });
  }
}
