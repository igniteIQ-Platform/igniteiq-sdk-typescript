# igniteiq-sdk-typescript — Agent Notes

> `CLAUDE.md` in this repo is a symlink to this file. Checked in — shared with cloud sessions, CI agents, and teammates.


## ⚠️ Read first: you may not be alone in this checkout

Ten repos live in one shared directory and several agent sessions run against them at once,
so the checkout you find is not necessarily yours. This has gone wrong twice, and both times
it looked like success:

- **2026-08-27** — a commit meant for `main` landed and pushed onto *another session's*
  feature branch, because the shared checkout was on that branch. `git log -1` showed the
  commit and read exactly like confirmation.
- **2026-08-31** — `igniteiq-docs` carried another session's uncommitted change for a full
  working day. `git add -A` would have swept it into an unrelated commit.

**Prefer your own worktree.** Sessions that write code should work in one rather than in the
shared checkout.

**If you are in the shared checkout:**
- stage explicit paths — never `git add -A`
- verify a push by reading `origin/<branch>`, never the local log
- check before you commit:

```
python3 ~/Development/GitHub/igniteiq-docs/scripts/check_worktree_isolation.py          # this repo
python3 ~/Development/GitHub/igniteiq-docs/scripts/check_worktree_isolation.py --fleet  # all ten
```

Worktrees are created at `.claude/worktrees/<name>` inside the repo and are gitignored.

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
