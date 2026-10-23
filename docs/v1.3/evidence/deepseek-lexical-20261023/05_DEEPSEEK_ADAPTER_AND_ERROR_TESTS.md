# DeepSeek adapter and error tests

No test in this work contacted DeepSeek. Unit tests use a loopback HTTP fixture permitted only under `NODE_ENV=test`.

## Contract behavior verified

- `POST /chat/completions`, `stream=false`, JSON-object response mode, temperature/output bounds and configured model.
- API key remains only in the backend Authorization header; response objects, errors, logs and client bundle do not echo it.
- Common email, phone, bearer-token and DeepSeek-style token strings are redacted before outbound serialization.
- Vendor envelope is bounded and schema-validated; usage records prompt, completion, total, cache-hit and cache-miss tokens.
- Estimated USD cost is calculated with a dated price identity and persisted inside the successful `AiRun.modelIdentityJson` path.
- Vendor/model mismatch, empty body, invalid JSON, excessive/truncated generation and incomplete finish reasons fail closed.
- `401`, insufficient balance (`402`), `429`, 5xx, transport disconnect, timeout and caller cancellation map to typed failure codes with bounded retryability.
- Existing orchestration retries retryable 429/5xx once and publishes only a fully validated application JSON result.
- Live-disabled, budget, request-rate and concurrency checks stop before HTTP; counters are process-local and conservatively reserve maximum cost before a request.
- Provider health becomes degraded/down on applicable failures; there is no automatic Ollama fallback.

Deterministic DeepSeek tests are part of the 320/320 passing repository suite. Live authentication, balance, latency, actual model identity, actual token accounting and output quality remain **NOT RUN** pending owner approval.

One limitation is explicit: successful vendor usage/cost is persisted, while a failed HTTP call may still incur provider-side usage that cannot always be learned or centrally persisted from an error response. The local reservation/call counter still limits attempts, but it is not billing-system reconciliation.
