# Auto-routing verification

Date: 2026-10-29
Candidate: `feat/v1.4.1-hybrid-auto-routing` based on `c33a6dd5fd362787a3b427ad0d3e33bf3260bac5`

## Deterministic gates

| Gate | Result |
|---|---|
| `npm run lint` | PASS, 0 warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; API TypeScript and Next.js production build |
| `npm test` | PASS: 348 passed, 0 failed, 0 skipped |
| Config tests | 8 passed |
| API tests | 221 passed |
| Web tests | 21 passed |
| Release/evaluation tests | 98 passed |
| Focused auto-routing unit set | 25 passed |
| Real PostgreSQL auto-routing integration | PASS; final 10/10 clean-database stress runs after transaction-conflict hardening |
| Full PostgreSQL integration | 32 passed, 0 failed, 1 explicitly historical live-Ollama skip |

The previous accepted unit/release baseline was 334. The current count is 348: 14 tests added and 0 removed.

## Real PostgreSQL proof

`DEMO_MODE=true node scripts/verification/v141-auto-routing-integration.mjs` applied all 14 migrations to a fresh isolated PostgreSQL database per run and passed auto-assignment, review-required handling, same-request concurrency, different-request concurrency, role visibility and Manager override. Promotion rerun exposed Prisma adapter transaction conflicts in more than one runtime shape (`P2034`, wrapped `P2010`, and direct `DriverAdapterError`). The state-machine owner now recognizes only `TransactionWriteConflict`, retries the serializable transaction at most four times with bounded backoff, and otherwise records the existing fail-closed Manager review result. The final stress gate passed 10/10 clean-database runs. These are isolated test measurements, not production SLA claims.

The broader integration suite also passed authentication/RBAC, manual lifecycle, RAG/knowledge, AI analysis, recommendation, workflow, SLA, checklist, analytics and dashboard/SLA parity.

## RAG and routing evidence

Auto-assignment requires validated `SUFFICIENT` grounding with a valid source citation. Weak/no grounding, stale analysis, malformed facts, unknown team/skill, rule conflict, missing SLA policy or no eligible STAFF remain unassigned and visible for Manager review. The synthetic IoT case binds to SOP-IOT-04 and routes only through local canonical Team/Skill/User facts.

## Browser verification

Playwright exercised the isolated candidate at 1920×1080, 1366×768 and 390×844:

- Manager saw the auto-routing source, application-level reasons and working reassignment.
- STAFF saw the request in the normal queue and the existing start/checklist workflow.
- USER saw only “Yêu cầu đã được chuyển đến bộ phận phù hợp.”
- USER and STAFF did not receive candidate workload, internal routing details or private workforce data.
- Horizontal overflow: 0 at all three widths.
- Keyboard focus and accessible control names: PASS.
- Console errors: 0; page errors: 0; unexpected 5xx: 0.

## Live AI validation

The owner-authorized isolated promotion gate used exactly **1 / 2** permitted live DeepSeek attempts, with `retryCount=0`; the second attempt was not used. A fresh synthetic request produced `NETWORK / IOT_CONNECTIVITY / HIGH`, lexical top-1 `SOP-IOT-04`, `SUFFICIENT` grounding and a valid current citation. The application then automatically selected the lowest-workload eligible STAFF, invoked the canonical state machine and created Assignment, SLA, history, SYSTEM audit and notification without a Manager click or manual assignment API. A subsequent Manager reassignment preserved the auto-routing audit and remained authoritative. No provider secret, key fragment, provider request identifier or private prompt was retained.

## Candidate and fallback demos

- Candidate fixture: `MF-AUTOROUTE-DEMO-001`, request ID `44014698-6660-4990-b577-67537ceb2eb5`, assigned to the synthetic `staff.iot@mobiflow.local` account in the isolated database only.
- Exception path: valid routing class with no eligible staff remained TRIAGED, emitted `AUTO_ROUTING_REVIEW_REQUIRED`, notified Managers and accepted normal manual assignment.
- Official v1.4.0 fixture remained `MF-2026-000001 | CLOSED | HIGH | v19 | SLA MET | checklist 8/8 | feedback 5/5 | AI 4/4 | audit 35 | migrations 14`.

## Known limitations

- `User.available` is administrative availability, not online presence.
- Balancing uses active-request counts, not advanced fairness/capacity forecasting.
- Auto-routing is initial assignment only; later changes require Manager reassignment.
- Existing `Assignment.assignedById` stores the authenticated analysis initiator as provenance. Canonical decision attribution is the SYSTEM audit with `REQUEST_AUTO_ASSIGNED` and `AUTO_ROUTING`.
- The AI priority is advisory; the existing Request priority remains applied.

## Result

All live and deterministic GO gates passed, no AR0/AR1 issue remains, and v1.4.0 stayed unchanged.

`MOBIFLOW_V1_4_1_HYBRID_AUTO_ROUTING_PASS`

`READY_FOR_OWNER_V1_4_1_MAIN_PROMOTION`
