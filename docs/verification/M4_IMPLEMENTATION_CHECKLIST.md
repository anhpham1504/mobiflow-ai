# M4 implementation checklist

Authority: frozen AI_BEHAVIOR_SPEC, REQUEST_STATE_MACHINE, AUTHORIZATION_SPEC, API_SPEC, TEST_STRATEGY and master M4 gate. M4 explicitly authorized; M5 is not authorized. Starting Git working tree was clean.

- [x] Provider: actual configured Ollama model identity, strict structured output, abort, 120s attempt / 300s run, at most two attempts, 24,000-character context / 32 KiB output.
- [x] Persistent QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELED intake with leases and recovery; one active request/purpose and one local generation.
- [x] Atomic create + automatic queued intake; explicit owner/manager analyze/retry; SYSTEM processing transitions through the existing state machine only.
- [x] Post-start context version; stale cleanup preserving newer messages; cancel/revoked access prevent publication; no transaction held during inference.
- [x] Strict analysis v1, controlled taxonomy, null/missing consistency, safe metadata and immutable AiAnalysis; no operational classification/priority/assignment/SLA changes.
- [x] Role-projected explanation/run polling, OpenAPI, bounded progress/failure/retry UI; preserve manual workflow when AI is offline.
- [x] Deterministic provider/schema/lifecycle/security/race/rollback/recovery tests on actual PostgreSQL; M3 regressions.
- [x] Independently labeled synthetic dataset: 30 normal, 10 incomplete, 5 ambiguous, 5 noisy; real live evaluation retaining failures and latency.
- [x] Real IoT, billing, missing-location, ambiguous, offline/recovery demonstrations; native and Docker provider calls; M4 browser E2E.
- [x] All requested quality gates, sanitized evidence and M4 verification; stop before M5.

No schema change is planned. Native fetch, existing Zod and existing test tools suffice; no new dependency is planned. Optional auto-intake switch permits the existing isolated M3 AI-disabled regression, while normal startup enables automatic intake. No fake provider is selectable through production configuration.
