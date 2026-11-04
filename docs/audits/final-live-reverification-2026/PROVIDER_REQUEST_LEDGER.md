# Provider request ledger

Session: `7fb850b3-2aac-41c1-80ec-b00d68732105`
Authorization: maximum 6 requests, USD 0.20, concurrency 1, automatic retries 0.
Provider: DeepSeek `deepseek-flash` through `https://api.deepseek.com/`. Thinking disabled, JSON mode, `max_tokens=1200`.

| # | Scenario | Model | HTTP | Input | Cache hit | Output | Reasoning | USD | Cumulative USD | Reservation | Retry | Sanitized request ID |
|---:|---|---|---:|---:|---:|---:|---|---:|---:|---|---:|---|
| 1 | QA-CONFLICT-008 | deepseek-flash | 200 | 6480 | 2048 | 264 | N/A | 0.001658688 | 0.001658688 | reconciled | 0 | 13054cb3-a1ac-421d-8c6b-11d7c1a21ce4 |
| 2 | QA-NOANSWER-009 | deepseek-flash | 200 | 6444 | 6016 | 281 | N/A | 0.000501696 | 0.002160384 | reconciled | 0 | 05600bb3-b458-4a21-9bc9-44ad25f93e61 |
| 3 | QA-IOT-001 analysis | deepseek-flash | 200 | 6962 | 2048 | 303 | N/A | 0.001850088 | 0.004010472 | reconciled | 0 | 0e474072-9275-4e49-a6e0-a37948d23517 |
| 4 | QA-IOT-001 resolution summary | deepseek-flash | 200 | 1798 | 0 | 475 | N/A | 0.0011094 | 0.005119872 | reconciled | 0 | 237d746f-feae-4d9c-aa7b-950b4961698a |

Final counters: 4/6 attempts, 4 responses, 0 failures, 0 timeouts, USD 0.005119872, USD 0.194880128 remaining. Two unused request slots were deliberately not consumed. Reasoning-token usage was not supplied by the provider and is reported as N/A, not zero.

The durable sanitized JSON is [evidence/provider-ledger.json](evidence/provider-ledger.json). It contains hashes and usage metadata, not prompts, raw responses, API keys or authorization headers.
