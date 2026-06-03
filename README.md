# @igniteiq/vault-client

TypeScript SDK for the [IgniteIQ](https://igniteiq.com) Vault API — query home services data from any LLM agent or application.

## Installation

```bash
npm install @igniteiq/vault-client
# or
yarn add @igniteiq/vault-client
# or
pnpm add @igniteiq/vault-client
```

Requires **Node 18+** (uses native `fetch`). Works in browsers and Edge runtimes (Vercel Edge, Cloudflare Workers) out of the box.

---

## Quick start

```typescript
import { VaultClient } from '@igniteiq/vault-client';

const client = new VaultClient({
  apiKey: 'iq_live_...',
  orgSlug: 'acme-plumbing',
});

const result = await client.query({
  measures: ['fact_jobs.total_revenue', 'fact_jobs.count'],
  timeDimensions: [{ dimension: 'fact_jobs.job_created_at', dateRange: 'last 30 days', granularity: 'month' }],
  dimensions: ['dim_business_unit.business_unit_name'],
  limit: 100,
});

console.log(result.data);
// [{ 'dim_business_unit.business_unit_name': 'HVAC', 'fact_jobs.total_revenue': 48200, ... }]
```

---

## Authentication

1. Log in to your IgniteIQ Studio at `https://<your-org>.studio.igniteiq.com`
2. Navigate to **Settings → API Keys**
3. Click **Generate new key** — copy the `iq_live_...` value immediately (it is not shown again)
4. Pass the key as `apiKey` and your organisation slug as `orgSlug` to `VaultClient`

Keep your API key in an environment variable — never commit it to source control.

```bash
# .env
IGNITEIQ_API_KEY=iq_live_...
IGNITEIQ_ORG_SLUG=acme-plumbing
```

```typescript
const client = new VaultClient({
  apiKey: process.env.IGNITEIQ_API_KEY!,
  orgSlug: process.env.IGNITEIQ_ORG_SLUG!,
});
```

---

## Method reference

| Method | Description |
|---|---|
| `client.query(query)` | Execute a structured Vault semantic-layer query |
| `client.context(opts?)` | Fetch a business-context snapshot for LLM injection |
| `client.ask(question, opts?)` | Natural-language question → human-readable answer |
| `client.schema.tools(format)` | LLM tool definitions (`'openai'`, `'anthropic'`, `'json-schema'`) |
| `client.schema.openapi()` | Full OpenAPI 3.0 spec for the Vault REST API |

---

## `client.query(query)`

Execute a structured query against the Vault semantic layer.

```typescript
const result = await client.query({
  measures: ['fact_jobs.total_revenue', 'fact_jobs.count'],
  timeDimensions: [{
    dimension: 'fact_jobs.job_created_at',
    dateRange: 'last 30 days',
    granularity: 'month',
  }],
  dimensions: ['dim_technician.technician_name'],
  filters: [{
    member: 'dim_business_unit.business_unit_name',
    operator: 'equals',
    values: ['HVAC'],
  }],
  limit: 50,
  order: { 'fact_jobs.total_revenue': 'desc' },
});
```

**Returns:** `VaultResult`

```typescript
interface VaultResult {
  data: Array<Record<string, string | number | null>>;
  query: VaultQuery;
  lastRefreshTime?: string;
}
```

---

## `client.context(opts?)`

Fetch a structured business-context snapshot for the organisation. The returned `systemPromptFragment` can be injected directly into an LLM system prompt.

```typescript
const ctx = await client.context({ period: 'last_30_days' });

// Ready-made system-prompt injection:
const systemPrompt = `You are a helpful assistant for ${orgName}.\n\n${ctx.systemPromptFragment}`;

// Or access individual fields:
console.log(ctx.revenue.total);                         // 142300
console.log(ctx.jobs.completed);                        // 312
console.log(ctx.ar.over30Days);                         // 18500
console.log(ctx.technicians.topPerformers?.[0].name);   // "Alex Johnson"
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `period` | `string` | `'last_30_days'` | Period preset (`'last_7_days'`, `'last_30_days'`, `'last_90_days'`, `'this_month'`, `'last_month'`) |
| `divisionSlug` | `string` | — | Scope to a specific ServiceTitan tenant / division |

---

## `client.ask(question, opts?)`

Answer a natural-language question using live data.

```typescript
const ans = await client.ask('What was our revenue last month?');

console.log(ans.answer);       // "Revenue last month was $142,300, up 8% vs. the prior month."
console.log(ans.confidence);   // "high"
console.log(ans.data);         // raw rows used to compute the answer
console.log(ans.caveats);      // ["Excludes cancelled jobs", ...] or null
```

---

## Error handling

```typescript
import { VaultClient, VaultError } from '@igniteiq/vault-client';

try {
  const result = await client.query({ measures: ['fact_jobs.total_revenue'] });
} catch (err) {
  if (err instanceof VaultError) {
    switch (err.code) {
      case 'UNAUTHORIZED':
        console.error('Invalid API key — regenerate at Studio → Settings → API Keys');
        break;
      case 'RATE_LIMITED':
        console.error(`Rate limit hit (HTTP ${err.status}) — back off and retry`);
        break;
      case 'BAD_REQUEST':
        console.error('Malformed query:', err.message);
        break;
      default:
        console.error(`Vault API error [${err.code}]:`, err.message);
    }
  } else {
    throw err; // re-throw unexpected errors
  }
}
```

**Common error codes:**

| Code | HTTP status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Key lacks permission for this resource |
| `NOT_FOUND` | 404 | Org, measure, or dimension not found |
| `BAD_REQUEST` | 400 | Malformed query payload |
| `RATE_LIMITED` | 429 | Request quota exceeded |
| `API_ERROR` | 5xx | Unexpected server error |

---

## LangChain integration

Use `client.schema.tools('openai')` to get structured tool definitions, then call `client.query` as the executor:

```typescript
import { VaultClient } from '@igniteiq/vault-client';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const vault = new VaultClient({ apiKey: process.env.IGNITEIQ_API_KEY!, orgSlug: 'acme-plumbing' });

const queryTool = new DynamicStructuredTool({
  name: 'vault_query',
  description: 'Query IgniteIQ home services metrics — revenue, jobs, AR, technician performance',
  schema: z.object({
    measures: z.array(z.string()).optional(),
    dimensions: z.array(z.string()).optional(),
    timeDimensions: z.array(z.object({
      dimension: z.string(),
      dateRange: z.string(),
      granularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
    })).optional(),
    limit: z.number().optional(),
  }),
  func: async (input) => {
    const result = await vault.query(input);
    return JSON.stringify(result.data, null, 2);
  },
});

const model = new ChatOpenAI({ model: 'gpt-4o' });
const agent = await createOpenAIToolsAgent({ llm: model, tools: [queryTool], prompt: yourPrompt });
const executor = new AgentExecutor({ agent, tools: [queryTool] });

const response = await executor.invoke({ input: 'What were our top 5 technicians by revenue last month?' });
console.log(response.output);
```

---

## Vercel AI SDK integration

Use `client.schema.tools('openai')` alongside the Vercel AI SDK for streaming tool-use responses:

```typescript
import { VaultClient } from '@igniteiq/vault-client';
import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

const vault = new VaultClient({ apiKey: process.env.IGNITEIQ_API_KEY!, orgSlug: 'acme-plumbing' });

// Optionally pre-load the business context
const ctx = await vault.context();

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: `You are a helpful business analyst for a home services company.\n\n${ctx.systemPromptFragment}`,
    messages,
    tools: {
      queryVault: tool({
        description: 'Query IgniteIQ Vault for home services metrics',
        parameters: z.object({
          measures: z.array(z.string()).optional(),
          dimensions: z.array(z.string()).optional(),
          timeDimensions: z.array(z.object({
            dimension: z.string(),
            dateRange: z.string(),
            granularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
          })).optional(),
          limit: z.number().optional(),
        }),
        execute: async (query) => {
          const result = await vault.query(query);
          return result.data;
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
```

---

## TypeScript types

All types are exported from the package root:

```typescript
import type {
  VaultClientOptions,
  VaultQuery,
  VaultResult,
  TimeDimension,
  VaultFilter,
  ContextSnapshot,
  AskResponse,
  ToolFormat,
  Granularity,
} from '@igniteiq/vault-client';
```

---

## License

MIT — see [LICENSE](LICENSE).

Built by [IgniteIQ](https://igniteiq.com) — the headless intelligence layer for home services.
