# Fact Retention Regression

Permanent tests passed in `apps/api/test/analysis.test.mjs`, `apps/api/test/analysis.integration.test.mjs`, `apps/api/test/knowledge.test.mjs` and `apps/web/test/analysis-fact-retention.test.mjs`.

Coverage includes:

- working-power observations;
- exact identifiers without translation or invention;
- attempted remedies and `NO_IMPROVEMENT`, `FAILED`, `SUCCEEDED` and unknown outcomes;
- counts and times;
- contradictory observations marked for verification;
- unknown causes and no-source behavior;
- identifiers/language/order/noise/long descriptions/multiple attempts and mixed English/Vietnamese variants;
- publication tampering rejection and stale source protection;
- USER, STAFF and MANAGER visibility boundaries.

The API unit suite passed **224/224**. The web suite passed **27/27**. The controlled persisted UI fixture created three scenarios with `liveProviderCalls: 0`; Playwright MCP live snapshots verified MANAGER, STAFF and USER projections. The pre-existing seven-scenario audit retains the broader screenshot set; this remediation records the new UI assertions as live browser evidence without copying screenshots across worktree roots.
