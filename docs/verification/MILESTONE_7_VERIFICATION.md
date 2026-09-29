# Milestone 7 Verification

## Scope implemented

M7 implements manager-controlled accept, modify and reject over the current M6 `AiRecommendation`, using the existing M3 `APPROVE_AND_ASSIGN` / `REJECT_APPROVAL` state-machine transaction. AI remains advisory and cannot approve, assign, change priority, start SLA, or cancel a request.

No migration was required: the frozen M2 schema already contains recommendation review status, reviewer/timestamp, manager changes, final decision, assignment linkage and decision kind.

## Contracts and transaction behavior

- Review commands carry `expectedVersion`, exact `reviewKind`, and exactly one current identity (`recommendationId` for AI or `manualDraftRevision` for manual review).
- Accept rebuilds the final decision from the immutable AI suggestion and evidence, then revalidates actor/session, request/recommendation state, sources/model identity, staff/team/skills/availability, missing-fact acknowledgment and current SLA policy.
- Modify validates the complete typed human final decision. Human-authored actions are unsourced; retained AI actions must cite source IDs from the current evidence snapshot.
- Reject records reviewer, time, reason and `REJECTED`, preserves the recommendation, clears the pending pointer and returns `PENDING_APPROVAL -> TRIAGED`. It does not cancel the request.
- Accept/modify records `AI_ACCEPT` or `AI_MODIFY`, recommendation linkage, immutable original/final values, assignment, source-bearing checklist, SLA, history/audit and notification in one transaction.
- Insufficient-evidence recommendations cannot be directly accepted; a manager must provide a human-authored modified plan or reject.

## API and UI

Existing endpoints are reused: `POST /api/v1/manager/approvals/:id/{accept|modify|reject}`. OpenAPI is version 0.7.0. The manager page separates “AI đề xuất — bản gốc” from “Quyết định của quản lý”, uses explicit confirmation, disables duplicate submission, reports 409 conflicts without retrying, and provides clear modify/reject forms. The approval list now includes both AI and manual pending reviews. The staff queue continues to use the protected current-assignment projection.

## Verification results

Results below must be updated only from commands actually run on the final source.

| Gate | Result |
|---|---|
| M6 baseline precondition | PASS: clean pushed `7750319`, tags `v0.6.0-m6` and M6 PASS tag |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS: config 6, API 35, web 1 |
| `npm run test:integration:m7` | PASS: 6 tests (5 M7 subtests plus suite), clean six-migration database |
| `npm run test:integration` | PASS: M2 1, M3 3, M5 5, M4 5, M6/M7 31 tests; actual PostgreSQL/pgvector/Ollama paths |
| `npm run test:e2e:m3` | PASS: 2 tests |
| `M4_E2E_MODE=online; npm run test:e2e:m4` | PARTIAL: normal live-intake case PASS; offline-recovery case NOT RUN because the prerequisite offline-created request was absent |
| `npm run test:e2e:m5` | PASS: 1 test |
| `npm run test:e2e:m6` | PASS: 1 live recommendation/RBAC/responsive test |
| `npm run test:e2e:m7` | PASS: 1 live manager-accept/staff-queue/responsive test |
| `npm run build` | PASS: API and 15-route Next.js production build |
| `docker compose config --quiet` | PASS |
| `docker compose up -d --build` | PASS: final API/web images rebuilt and services healthy |
| `npm audit --omit=dev --audit-level=high` | PASS: zero vulnerabilities |
| `git diff --check` | PASS; only configured LF-to-CRLF notices |

The real-PostgreSQL M7 integration coverage includes accept/accept concurrency, immutable accept/modify/reject provenance, staff-availability revalidation with `409 STALE_RECOMMENDATION`, and transaction rollback on notification persistence failure. Existing M3/M6 suites cover wrong-role denial, manual-path availability, state-machine complements, request-version conflicts, source/policy staleness and recommendation publication rollback. The first broad integration attempt exposed a manual acknowledgment regression; the command now explicitly carries the selected acknowledgment set into the final snapshot, and a full clean-database rerun passed all suites.

Live M6 regression evaluation writes were preserved by the evidence helper as hash-named iteration files under `docs/verification/evidence/iterations`; no measured failure was hidden. The M4 recovery browser case requires the documented offline-first sequence and was not falsely marked PASS in an online-only run.

## Limitations and deferrals

- M7 does not train or adapt a model from manager decisions.
- M8 Copilot, checklist adoption/editing enhancements, SLA monitoring and resolution summary remain deferred.
- M9 analytics/evaluation and M10 hardening remain deferred.
- Local synthetic evidence is not a production-quality or generalized accuracy claim.

## Gate

**PASS — M7 complete.** Human accept/modify/reject is bound to the current recommendation and existing state machine, protected by current-state revalidation and atomic persistence. Execution stops before M8.
