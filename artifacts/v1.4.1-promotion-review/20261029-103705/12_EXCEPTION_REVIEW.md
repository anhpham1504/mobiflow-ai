# Exception and Manager review paths

No second billable DeepSeek call was spent because provider use adds no value to deterministic eligibility exceptions.

Unit and real-PostgreSQL paths prove that weak RAG, invalid/stale facts, invalid target, routing conflict, missing SLA policy, no eligible STAFF and technical routing failure leave the Request `TRIAGED`, create no Assignment, emit `AUTO_ROUTING_REVIEW_REQUIRED` and notify Managers.

The promotion rerun exposed a PostgreSQL serialization race. The canonical state machine now recognizes only transaction-write-conflict error shapes and performs at most four database-only retries with 10/20/40/80 ms backoff. Exhaustion retains the same fail-closed Manager review path. Final clean-database concurrency stress: 10/10 PASS.

Result: **PASS**.
