# V1.3 configuration reference

The existing [M16 configuration reference](../v1.2/M16_CONFIGURATION_REFERENCE.md) owns unchanged authentication, database, model/embedding and service settings. M24 exposes existing M22 settings through normal `docker-compose.yml` and `.env.example`; config semantics/defaults are unchanged. Read credentials only from private generated env files; never commit them. Changing the public API URL requires rebuilding Web.

| Variable | Default | Accepted range / behavior |
|---|---|---|
| SLA_ALERT_ENABLED | true | Explicit true/false; controls background operational observation |
| SLA_ALERT_EARLY_RATIO | 0.5 | Greater than0 and less than0.8; one stable early-reminder key per SLA lifetime |
| SLA_ALERT_AT_RISK_ENABLED | true | Explicit true/false; current canonical AT_RISK escalation |
| SLA_ALERT_BREACH_ENABLED | true | Explicit true/false; current canonical BREACHED escalation |
| SLA_ALERT_INTERVAL_SECONDS | 60 | Integer30–3600 |
| SLA_ALERT_BATCH_SIZE | 100 | Integer1–200; durable cursor permits later batches |
| SLA_ALERT_TIME_BUDGET_MS | 10000 | Integer1000–30000; per-tick bounded work |

Restart/recreate only the deliberately selected API project to apply changed environment. Policy edits do not reset dedup lifetime, recalculate M12 clocks, reroute, reprioritize, resolve or close Requests. Restarts reuse persistent scan progress and event/recipient uniqueness. Current authorization is rechecked for recipients; historical alerts remain snapshots, distinct from current SLA state. No config adds a new role, arbitrary tool, cloud dependency or autonomous business action.

The M24 isolated production test used interval30/batch2; all other settings above retained defaults. Dedicated host ports were55425 PostgreSQL,33601 API,33600 Web, bound to loopback. Verification PostgreSQL/HTTP used55424/33024. These are test overrides, not new application defaults. Normal developer PostgreSQL remained at7 migrations; release synthetic databases reached13. Do not point migration/seed/reset at a developer volume merely to match evidence.

Ollama is optional for core manual workflows. Missing provider/model must report AI unavailable: core can be ready/DEGRADED while aiReady=false. `unconfigured` is a truthful manual-demo setting, not evidence of model identity or quality. Verify actual installed tags/digests and1024-dimensional embeddings before claiming AI readiness; changing model/dimension requires owning compatibility/evaluation work.
