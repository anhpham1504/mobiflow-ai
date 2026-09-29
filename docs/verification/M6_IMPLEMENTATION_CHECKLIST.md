# M6 implementation checklist

Authorized baseline: `7fe687ae4517c37f9fbe3fcf01668980ebe85a23`, `v0.5.0-m5`.
Working branch: `feat/m6-grounded-recommendations`. No commit/push or M7 work.

## Contract decisions

- Six fixed, read-only tools from TOOL_CALLING_SPEC; at most eight invocations, one call per tool except three SLA lookups; 32 KiB/tool, 5/30 second deadlines.
- Similar candidates are non-CANCELED requests created within the supplied window, not only terminal cases. Exact compatible current-version vectors, permission predicates before ranking, frozen hybrid formula and v >= 0.70.
- Hard staff eligibility precedes deterministic score `(60 + 25/(1+activeWorkload))/85`; active workload includes ASSIGNED/IN_PROGRESS/WAITING_USER only.
- M6 successful SYSTEM publication transitions TRIAGED to PENDING_APPROVAL atomically through RequestStateMachineService. Operational category, priority, assignment, checklist and SLA remain unchanged.
- M7 owns AI-bound accept/modify/reject. M6 manager panel is explanatory only; USER/STAFF never receive manager recommendation context.
- Reuse AiRun/AiRecommendation/AiToolCall. Add RequestEmbedding with real probed dimension, identity, version and input configuration; preserve existing migrations.

## Implementation and verification

- [x] Strict shared schemas, registry bounds, safe tool traces and current actor checks.
- [x] Real request indexing and scoped pgvector similarity; fixed synthetic labels before predictions.
- [x] Candidate/workload/policy/history tools and snapshot provenance.
- [x] Bounded synthesis, reference checks, atomic publication and stale detection.
- [x] Manager API/panel, failure/retry, safe polling and explanation.
- [x] Unit, real PostgreSQL/races/rollback, injection and provider outage tests.
- [x] Similar/candidate/recommendation evaluations with measured outcomes.
- [x] Native/Docker runtime, browser 360/768/1440 and M3–M5 regressions.
- [x] Dependency/security/migration freeze checks, durable evidence and final report.

Primary risks: stale permission/source/staff snapshots, hidden failed lookups, long model calls holding transactions, mixing embedding identities, accidental manager evidence exposure, and multiple workers violating local inference concurrency. Test each at its owning boundary.

## Resume checkpoint — 2026-09-29

Existing work preserved. HEAD remains the M5 baseline; 13 modified tracked files plus the M6 untracked implementation/evidence. No staged files, unmerged entries, merge/rebase/cherry-pick state. `git diff --check` and `npm run typecheck` completed with exit 0 on resume. Docker baseline services are healthy. The interrupted integration process is no longer running; its missing final exit status is NOT PASS.

| Component | Checkpoint | Evidence / remaining work |
|---|---|---|
| Repository/spec audit | PARTIAL | Git/diffs reviewed; cross-document review continues |
| Tool Registry / schemas / budget | PARTIAL | Six tools implemented; earlier unit checks passed, rerun after latest edits |
| Similar-case embeddings/retrieval | PARTIAL | Real pgvector results saved; version/model and boundary tests still needed |
| Candidate eligibility / workload | PARTIAL | Seven filter cases and lifecycle counts passed; shared M3 predicate changed afterward, rerun |
| Recommendation schema/orchestration | PARTIAL | Primary actual model succeeded; R2 failed INVALID_REFERENCE before interruption |
| Evidence / persistence / stale protection | PARTIAL | Request/cancel/staff/actor races passed; source/policy/rollback coverage incomplete |
| RBAC / API | PARTIAL | Manager-only route negatives passed; final regression pending |
| UI | PARTIAL | Typecheck passed; browser gates not run |
| Unit / PostgreSQL integration | PARTIAL | Earlier 35 unit tests passed; integration has no complete final exit |
| Similar evaluation | PARTIAL | 10 fixed cases, positive Hit@1/3/5=1, MRR=1; negatives no-match 1/2. Full suite interrupted |
| Candidate evaluation | PARTIAL | Seven measured cases; final rerun pending |
| Recommendation evaluation | PARTIAL | Interrupted after R1 success and R2 invalid reference; no aggregate report |
| Offline/failure gates | PARTIAL | Deterministic failures passed; actual endpoint outages pending |
| Browser E2E / M0–M5 regression | TODO | Not verified on final M6 source |
| Docker/native verification | TODO | Running containers still baseline M5 |
| Security review / verification report | TODO | Final scans/review/report pending |

Last confirmed step: current-source strict typecheck (exit 0); prior narrow deterministic tool, candidate and race tests. First incomplete step: diagnose real recommendation reference failure with safe feedback and complete the interrupted evaluation without changing fixed labels. Preserve all previous evidence when rerunning.

## Final checkpoint — 2026-09-29

All M6 implementation and verification rows above are complete. Final actual-model evaluation: 8/8 schema/reference/candidate valid, category 8/8, priority 6/8, and 7/7 applicable staff matches with the zero-staff case handled explicitly. Native and Docker online runtime, isolated Docker LLM/embedding outages, M3–M6 browser tests, M4/M5 live regressions, security/dependency checks, clean migrations, and final healthy Compose state passed. Failed/interrupted iterations remain under `evidence/iterations`. M7 was not started; no commit, push, or tag was performed.
