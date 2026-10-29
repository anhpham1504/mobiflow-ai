# Promotion issue register

## Resolved during review

- `PR-001` — real PostgreSQL concurrency: Prisma adapter exposed serialization conflict as `P2034`, wrapped `P2010`, or direct `DriverAdapterError`; the prior narrow retry recognized only one shape. Fixed inside the canonical state-machine transaction owner with type-checked `TransactionWriteConflict` recognition and bounded database-only backoff. Final 10/10 fresh-database stress PASS plus full PostgreSQL PASS.
- `PR-002` — RAG currentness: auto-routing trusted the stored `SUFFICIENT` result without revalidating cited snapshot sources inside the assignment transaction. Fixed by binding citations to snapshot sources and calling the canonical current-source validator before routing. Invalid citations and disabled/stale sources now fail closed to Manager review. Covered by the final 10/10 fresh-database stress gate and full PostgreSQL regression.

## Open promotion issues

- AR0: 0.
- AR1: 0.
- AR2: 0.
- AR3: 0 blocking promotion.

Known non-blocking product limits remain documented: administrative availability is not online presence; balancing uses active-request counts; auto-routing is initial assignment only; AI priority is advisory; legacy `assignedById` is initiator provenance while SYSTEM audit is authoritative.
