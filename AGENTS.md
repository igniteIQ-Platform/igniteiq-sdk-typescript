# igniteiq-sdk-typescript — Agent Notes

> `CLAUDE.md` in this repo is a symlink to this file. Checked in — shared with cloud sessions, CI agents, and teammates.

## Overview

TypeScript SDK — `@igniteiq/vault-client` on npm. Wraps the Vault API (`igniteiq-vault`) for any LLM agent or application.

Bundled with `tsup` (CJS + ESM + `.d.ts`). Source in `src/`.

## ⚠️ This is published to npm

Anything merged and released is public and permanent. There is **no CI in this repo**, so no automated gate stands between an edit and a release — run the checks below by hand.

## Common commands

```bash
npm run build      # tsup (cjs, esm, dts)
npm run typecheck  # tsc --noEmit
```

No test script is defined — don't assume a framework is wired up.

## Conventions

- **Public API mirrors `igniteiq-sdk-python`** where reasonable — same Vault API, parallel SDKs. Silent divergence between the two is a bug; a change to one should say whether the other needs it.
- **Keep the package dependency-light** — it's a published client library, and every dependency is a tax on consumers.
- Ship correct types: the `.d.ts` is the contract most consumers actually program against, and a wrong type is worse than a missing one.
- README code samples must stay in sync with the real public API.

## Gotchas

- **Vault measures bind by name.** A measure renamed or redefined in `igniteiq-vault` breaks working SDK code at runtime with no compile-time signal — the types describe the transport, not the semantic layer's contents. When a Vault change lands, check the documented examples still resolve.
- Dual CJS + ESM output means export-shape mistakes surface only in one module system. If you change exports, verify both builds import cleanly.
- Auth is by API key against the Vault API — env vars and placeholders only, never a real key in examples or fixtures.

## Do not

- Don't introduce a breaking API change without a corresponding version bump.
- Don't add runtime dependencies without a strong reason.
- Don't let the two SDKs' public surfaces drift silently.
- Never commit a real API key or customer identifier.
