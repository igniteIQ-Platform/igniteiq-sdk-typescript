/**
 * Options for initialising a VaultClient instance.
 */
export interface VaultClientOptions {
  /** IgniteIQ API key (starts with `iq_live_` or `iq_test_`). */
  apiKey: string;
  /**
   * Your organisation slug (e.g. `tapps`, `airworks`).
   * Required for the `context()` method.
   */
  orgSlug: string;
  /**
   * Override the base URL. Defaults to `https://api.igniteiq.com`.
   * Useful for local development or self-hosted deployments.
   */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface TimeDimension {
  dimension: string;
  /** Either a preset string (`'last 30 days'`) or an ISO-8601 tuple `['2024-01-01', '2024-01-31']`. */
  dateRange: string | [string, string];
  granularity?: Granularity;
}

export interface VaultFilter {
  member: string;
  operator:
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'set'
    | 'notSet'
    | 'inDateRange'
    | 'notInDateRange'
    | 'beforeDate'
    | 'afterDate';
  values?: string[];
}

/** A Vault semantic-layer query (mirrors the Cube.dev query format). */
export interface VaultQuery {
  measures?: string[];
  dimensions?: string[];
  timeDimensions?: TimeDimension[];
  filters?: VaultFilter[];
  limit?: number;
  offset?: number;
  order?: Record<string, 'asc' | 'desc'>;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface VaultResult {
  data: Array<Record<string, string | number | null>>;
  query: VaultQuery;
  lastRefreshTime?: string;
}

// ---------------------------------------------------------------------------
// Context snapshot (Phase 19 shape)
// ---------------------------------------------------------------------------

export interface RevenueSummary {
  total: number;
  currency: string;
  changeVsPriorPeriod?: number;
  byBusinessUnit?: Array<{ name: string; revenue: number }>;
}

export interface JobsSummary {
  total: number;
  completed: number;
  cancelled: number;
  averageJobValue?: number;
}

export interface ARSummary {
  totalOutstanding: number;
  currency: string;
  over30Days?: number;
  over60Days?: number;
  over90Days?: number;
}

export interface TechnicianSummary {
  active: number;
  averageRevenuePerTech?: number;
  topPerformers?: Array<{ name: string; revenue: number }>;
}

export interface ContextSnapshot {
  /** Ready-to-inject system prompt fragment for LLM context. */
  systemPromptFragment: string;
  period: string;
  generatedAt: string;
  revenue: RevenueSummary;
  jobs: JobsSummary;
  ar: ARSummary;
  technicians: TechnicianSummary;
}

// ---------------------------------------------------------------------------
// Ask / NL query
// ---------------------------------------------------------------------------

export interface AskResponse {
  question: string;
  answer: string;
  data: unknown[];
  /** The structured Vault query that was executed, if any. */
  query: VaultQuery | null;
  confidence: 'high' | 'medium' | 'low';
  caveats: string[] | null;
}

// ---------------------------------------------------------------------------
// Schema / tool definitions
// ---------------------------------------------------------------------------

export type ToolFormat = 'openai' | 'anthropic' | 'json-schema';

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/** Events you can subscribe a webhook to. */
export type WebhookEvent =
  | 'forge.run.completed'
  | 'forge.run.failed'
  | 'depot.sync.completed'
  | 'depot.sync.failed'
  | 'vault.schema.updated';

/** A registered webhook. */
export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: string;
  /**
   * The signing secret. Present **only** in the `create()` response when
   * IgniteIQ generated it (you omitted `secret`). Store it immediately — it is
   * never returned again, and never included in `list()`.
   */
  secret?: string;
}

/** Input for registering a webhook. */
export interface CreateWebhookInput {
  /** HTTPS endpoint that will receive event POSTs. */
  url: string;
  events: WebhookEvent[];
  /**
   * Optional signing secret. If omitted, IgniteIQ generates one and returns it
   * once in the `create()` response (`whsec_…`). Used to compute the
   * `X-IgniteIQ-Signature` (`sha256=<hmac>`) header on each delivery.
   */
  secret?: string;
}
