# Budget, privacy and live-call gate

## Current state

- `AI_LIVE_CALLS_ENABLED=false`.
- `DEEPSEEK_API_KEY` is empty (length 0) in the ignored local environment.
- DeepSeek network requests observed in tests/browser: 0.
- Billable DeepSeek spend attributable to this execution: USD 0.
- Only `https://api.deepseek.com/` is accepted outside tests; loopback is permitted only for deterministic fixtures.

## Local controls

- Maximum configured process budget: USD 0.25.
- Maximum calls/process: 3; starts/minute: 2; concurrent calls: 1.
- Before HTTP, the guard reserves a conservative maximum from 64,000 outbound characters treated as if each were a cache-miss token plus 1,200 output tokens. With the dated configuration this is about USD 0.02064/call and USD 0.06192 for three calls, below USD 0.25 and the owner's approximate USD 2 balance.
- Successful usage records prompt/completion/total/cache-hit/cache-miss tokens, pricing identity/effective date and estimated USD cost.
- The provider's balance cannot be hard-capped or reconciled by this local process, and process restarts reset in-memory counters. These controls are not represented as account-level billing enforcement.

Configured reference rates, effective 2026-10-23: cache-hit input USD 0.006/M, cache-miss input USD 0.30/M and output USD 1.20/M. Pricing and model availability are time-sensitive and must be checked again against official DeepSeek documentation immediately before approval.

## Required owner gate before the first live call

1. Reconfirm official endpoint, account-supported model, price sheet, available balance and data-retention/privacy terms.
2. Provide the API key through backend secret injection; never chat, tracked files, frontend variables, screenshots, reports or shell history.
3. Approve the exact 1–3 synthetic cases, expected maximum tokens/cost and stop condition.
4. Keep `AI_LIVE_CALLS_ENABLED=false` until the same session that performs the approved canary.
5. Inspect usage/cost, citations, schema and human-review result after each case; stop on unexpected model, privacy concern, budget drift, invalid evidence or provider error.
6. Remove/rotate the key after the approved window as the owner requires.

The redactor is defense in depth, not permission to send real customer data. Enterprise privacy review remains pending.
