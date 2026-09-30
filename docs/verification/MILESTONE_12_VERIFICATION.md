# Milestone 12 Verification

## Scope implemented

Normalize/expose/test existing deterministic SLA V2 without replacing V1 lifecycle or starting M13. Canonical scalar/SQL math and state rules, additive DTO and UI mismatch removal.

## Files/modules changed

sla-clock.ts, new sla-sql.ts, request read projections/monitor DB clock, existing analytics SLA-only compatibility correction, shared SLA schema, presentation helper/shared badge and regression tests. [Combined verification](../v1.2/M11_M12_VERIFICATION.md) owns exact semantics/evidence.

## Database changes

None; six unchanged migrations. Existing clock/policy/hold/exclusion/version fields suffice. Stale mutation, history/audit/notification rollback and persistence proven with real PostgreSQL.

## API changes

Add state/deadlineAt/breachedBySeconds/completedAt/riskThresholdSeconds/totalPausedSeconds while retaining status/dueAt and previous fields. No state/role/route/mutation rename. API-first deployment for the stricter new web schema.

## UI changes

Shared SlaIndicator uses backend state for every list/detail role. Fixed 30-minute classifier removed; paused historical breach/stopped cancellation and MET have truthful Vietnamese text/colors. No design/theme/CSS change or fabricated progress.

## AI changes

None. SLA stays deterministic; AI cannot alter it, approve, assign, close or bypass authorization. Live AI semantic disagreement retained in evidence, no universal accuracy claim.

## Security considerations

No hidden read mutations, no expectedVersion bypass, state-machine authority unchanged. Bound aggregate SQL, role-safe DTOs, live identity, source ownership and protected-action regressions passed.

## Tests executed

| Command | Result |
|---|---|
| npm run lint / npm run typecheck / npm test / npm run build | PASS; 85 tests, zero skipped |
| npm run test:integration:m11-m12 | PASS; deterministic boundaries and 17 SQL/scalar cases, workflow persistence/rollback |
| npm run test:integration | PASS 48 real DB cases, including live RAG/Ollama, audit/version and canceled denominator |
| npm run test:integration:m10 | PASS; clean six migrations and idempotent coherent seed |
| npm run test:e2e:m3, M4 offline/online, M5–M10 | PASS |
| npm run test:e2e:ui-v1-1 / npm run test:e2e:v1-2 | PASS 8/8 and 4/4; final axe serious/critical=0 |

The table records implementation-phase results. Exact commands, environment and retained failed attempts: [combined report](../v1.2/M11_M12_VERIFICATION.md#implementation-run-commands-and-actual-results). Fresh closure unit/17-case SQL parity/workflow integration and both UI suites pass; see [closure results](../v1.2/M11_M12_CHECKPOINT_CLOSURE.md#fresh-safety-gates).

## Manual verification

Risk20% inclusive, zero on time, strictly negative breach; multiple wait/hold/reopen cycles, repeated pause/resume defenses, RESOLVED freeze/CLOSED finalize, sticky breach and cancel freeze reviewed against spec/tests. All role detail indicators matched real DTOs at four widths. Closure manually viewed naturally present SAFE/BREACHED/PAUSED/MET examples; AT_RISK was not naturally present and is covered by deterministic unit/PostgreSQL parity, not a fabricated screenshot. Host Ollama restored; runtime READY.

## Known limitations

Continuous UTC second clock, not business-hours calendar. Read snapshots do not tick locally. Existing analytics' other limits/windows unchanged. Targeted accessibility checks, not certification.

## Deferred items

M13–M17 NOT STARTED. No SLA override API, model-predicted risk, new enum or schema. Closure permits checkpoint commit/feature-branch push only, not a release tag or main merge.

## Release blockers

None for M12 review gate. A V1.2 release requires separate human authority.

## Gate

PASS — READY FOR HUMAN REVIEW.
