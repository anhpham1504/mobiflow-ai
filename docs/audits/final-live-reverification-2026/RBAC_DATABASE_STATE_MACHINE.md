# RBAC, database and state-machine verification

Live database/API audit: **PASS (24/24)**.

| Scenario | Ownership / provider | Routing | State | Human control | Verdict |
|---|---|---|---|---|---|
| QA-CONFLICT-008 | USER; live deepseek-flash | MANAGER_REVIEW_REQUIRED | TRIAGED v3 | No protected mutation | PASS |
| QA-NOANSWER-009 | USER; live deepseek-flash | MANAGER review / no arbitrary assignment | TRIAGED v3 | No protected mutation | PASS |
| QA-IOT-001 | USER; live deepseek-flash | Qualified IoT STAFF auto-assigned | CLOSED v7 | STAFF RESOLVE, USER USER_CONFIRM | PASS |

Representative USER attempts to change priority, start work and resolve returned HTTP 403. Status, version and audit count were unchanged. An assigned STAFF stale-version start returned HTTP 409; status, version and audit count were unchanged. The API matrix also passed unauthenticated 401, invalid create 400, unknown request 404 and authorized MANAGER read 200.

QA-IOT-001 persisted the implemented chain `NEW → AI_ANALYZING → TRIAGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`. SLA finished `MET` with `CLOSED` stop reason. Synthetic resolution evidence remained separately attributed to STAFF. Full evidence: [database/API audit](evidence/database-api-audit.json).
