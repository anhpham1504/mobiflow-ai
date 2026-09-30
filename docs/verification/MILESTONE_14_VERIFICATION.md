# Milestone 14 Verification

Verified 2026-09-30. **M14 PASS — HUMAN-REVIEW CLOSURE PASS. M15 NOT STARTED.** This follows master-plan section 34; [the detailed report](../v1.2/M14_RECOMMENDATION_V2_VERIFICATION.md) records the required full report, subsequent closure, attempt history, model hashes and performance limits. Implementation-handoff Git statements below remain historical; the subsequent user request authorizes the single reviewed M14 checkpoint.

## Scope implemented

[New authoritative scope](../v1.2/M14_RECOMMENDATION_V2_SPEC.md) was stored verbatim, then referenced in the [frozen plan](../v1.2/M14_RECOMMENDATION_V2_IMPLEMENTATION_PLAN.md) and V1.2 index without rewriting M0–M13 history. V2 adds strict summary/classification, one existing domain next step, short reason, real typed evidence, missing questions/impact, grounded warnings, ordered sourced checklist and separate human provenance to current manager request detail.

V2 generation/publication/review never changes Request status/version/history, assignment/SLA/checklist or business notifications. ACCEPTED means agreement; MODIFIED stores a separate validated human plan; REJECTED preserves the original/reason. Applying a plan requires existing manual triage → submit → explicit approval. V1 history and explicit approval remain compatible.

Baseline is clean M13 checkpoint `b35fcffcad6ecba463824e4ad31cfba623f1dc81`; current branch `feat/v1.2-recommendation-v2`, same HEAD. M14 remains uncommitted; M15–M17 NOT STARTED.

## Files/modules changed

Shared V1/V2 schemas and job union; native prompt/parser/source validation; recommendation controller/service/private authorization snapshot; fixed-tool live authorization; state-machine publication/review version dispatch; review OpenAPI; existing recommendation UI and async guards; scoped CSS/session copy; one minimal migration; targeted units/DB/browser/live evaluation and isolated runners; affected owning specs/reports.

[Exact inventory](../v1.2/evidence/M14_SOURCE_INVENTORY.json): 271 files, 43 source/config/docs/tests plus 228 evidence files. No new dependencies/lockfile, provider/model, login role, Copilot action, ranking, vector dimension/store, deployment stack or autonomous mutation.

## Database changes

Schema/migration: YES; count 6 → 7. `20260930010000_m14_advisory_confidence` only drops NOT NULL from legacy confidence, preserves V1 values and permits V2 null. Existing JSON/version/review columns hold the rest; no destructive data rewrite or fake backfill.

[PostgreSQL evidence](../v1.2/evidence/M14_DATABASE.json), 2026-09-30T14:25:25.745Z: PASS 26/26 including parent, 25 child checks. It verifies original/human provenance, artifact-only effects, V1 history/actual approval, source/policy/candidate/currentness, missing acknowledgements, RBAC/IDOR/replay/concurrency/audit rollback, genuine revoke/expiry races and bounded failures/manual availability. Queued revoked/expired sessions make zero embedding/model calls.

Demo/loopback guard and advisory lock create only fresh isolated `mobiflow_m14_test`, refuse existing targets and remove only the owned DB. Read-only final check confirmed it absent. No running demo reset/migration or production deployment occurred.

## API changes

Extend existing manager recommend POST and recommendation GET (latest or request-scoped historical aiRunId). Server chooses V2; client cannot request legacy generation. Existing accept/modify/reject routes dispatch by stored artifact version; V2 writes review artifacts only, V1/manual preserves business approval. Shared strict schemas/OpenAPI, no-store and sanitized errors match actual HTTP tests. Private initiating SID/model prompts/hidden reasoning/credentials are excluded.

## UI changes

Current shell/detail retained. Original AI suggestion and human review/plan are distinct, with next step, evidence, missing questions/impact, checklist, warnings/version/time/stale/reviewer. No V2 confidence/ranking percentage. Applying a plan uses an explicit manual link/approval.

[Final Edge/Playwright evidence](../v1.2/evidence/M14_BROWSER.json), 2026-09-30T14:31:12.842Z: PASS 4/4, skipped/flaky 0. All three advisory decisions preserve business state; only explicit manual approval assigns and creates approved human work; STAFF sees approved checklist, V1/source pages remain readable. Empty/loading/invalid/error/retry/stale/supersession/permission loss/canceled navigation and SID-rotation retry are measured. Escaped malicious text creates no HTML/script.

Widths 360/768/1440/1920 have no horizontal overflow and zero total Axe violations. Keyboard generation/review/skip-link pass. Unexpected console errors/failed requests/worker errors are zero; intentional 403/503 simulation events are separately recorded.

## AI changes

Actual Ollama 0.34.4, configured qwen3:4b-instruct-2507-q4_K_M and bge-m3:latest, 1,024 dimensions; full digests in detailed evidence. Existing provider/RAG/six read-only tools remain. V1 prompt grounded-recommendation.v3/schema recommendation.v1; V2 grounded-recommendation.v2.4/schema recommendation.v2.

Draft-7 native tuples bind required current-request evidence, exact missing fields and missing/insufficient warnings. Tighter native text/collection bounds fit the unchanged 1,200-token budget. Strict public Zod/source/domain validation remains authoritative, with at most two attempts and safe failure. No postfilled/fabricated output or hidden reasoning.

[Final live comparison](../v1.2/evidence/M14_RECOMMENDATION_EVAL.json): PASS V1 6/6 and V2 6/6, first attempt 6/6 each, repairs 0. V2 source/schema/action vocabulary/expected main step/exact missing coverage/artifact-only publication all 6/6. Fixed six synthetic cases, hash `4c7b34e8639e2585ade8b4cf70a8aeef9a8bbdc1e2ab5eea64c267112961c8ad`, actual model/embeddings and frozen retrieved PostgreSQL context. Synthetic context capture is labeled test-only; no fixture substitutes for actual model comparison.

Measured model p50/p95 V1 6,358/6,937 ms; V2 13,586/16,398 ms. V2 publication 57–127 ms, read 34–66 ms. Small local timings and six synthetic cases do not establish production quality/scale or semantic improvement; no composite score.

## Security considerations

Live MANAGER identity/session authority before embedding/tools/model and under publication/review locks. Exact initiating SID is backend-only; refresh consuming it cancels unfinished work. V1 metadata-absent snapshots remain compatible. Expected version, source/candidate/policy/currentness, one-winner/replay and atomic audit guards pass real negative tests. Strict schema/size/type/reference/excerpt checks and escaped browser text reject fabricated/unsafe output. AI cannot execute protected business actions.

Final scoped configured-secret/private-key/env/upload/unsafe HTML/lockfile scan has no matches. Bound vector SQL/least-privilege principals remain unchanged. This is targeted verification, not a production penetration audit.

## Tests executed

| Exact command | Actual final result |
|---|---|
| `npm run test:unit:m14` | RUN/PASS 31/31 with prompt 2.3; the same unit files also passed in the final root suite with prompt 2.4 |
| `npm test` | RUN/PASS 98/98: config 7, API 70, web 2, release helpers 19 |
| `npm run lint` | RUN/PASS, including final test-harness changes |
| `npm run typecheck` | RUN/PASS API/web |
| `npm run build` | RUN/PASS foundation/API/production Next build, 17 static pages |
| `npm run test:integration:m14` | RUN/PASS 26/26 including parent; 25 real PostgreSQL child checks |
| `npm run test:e2e:m14` | RUN/PASS 4/4, skipped 0, flaky 0 |
| `npm run eval:recommendation:m14` | RUN/PASS V1 6/6, V2 6/6, first-attempt 6/6 each, V2 repairs 0 |
| `git diff --check` and scoped inventory/secret/link review | RUN/PASS, recorded during final closeout |
| Broad historical integration/browser/live evaluations | NOT RUN, outside authorized affected scope |
| Deployment/migration to running demo or production; load/production accuracy benchmark | NOT RUN; no release/deployment claim |

Prior genuine failed runs and test-harness mistakes remain retained: wrong fixture cwd, lint/TypeScript repair, invalidated test token, real Axe violation, select-label/201 expectation, SID-rotation assumption, offline Ollama NOT RUN, duplicate SOP, missing evidence/warnings, token truncation, random forbidden port/stale keep-alive, provider fixture under load and invalid artificial expiry timestamp. Final expiry tests respect database constraints and assert mutation actually occurred. No gate/assertion/security predicate was weakened.

RUN historical regression: affected V1 recommendation/analysis/RAG/workflow/auth units; configured root fast suites; actual V1/manual approval boundary in M14 DB/browser. Broad historical integration/browser/live evaluations are NOT RUN; unrelated milestone evidence is preserved.

## Manual verification

Trace reviewed owning contracts, version dispatch, source/provenance, protected approval, live session handling and isolated DB guards. Final successful-run screenshots at 1,440/360 were visually inspected for readable long/escaped text, controls, clear advisory/manual separation and no clipping. Other widths have executed Axe/overflow evidence; no full WCAG certification claim.

Final scoped links/inventory/secret/diff checks completed. Synthetic test DB absent after owned cleanup. Detailed report separates model/publication/read/whole-case latency and retains intermediate failed evaluations.

## Known limitations

Six local synthetic cases/source membership are not semantic accuracy or production-effectiveness proof. Human review remains necessary; prose may overstate urgency or omit prerequisites. Business effects remain behind explicit manual approval. SID rotation/revocation/expiry requires fresh generation. API/web strict expanded schemas require a paired deployment. Migration is validated only on isolated DB; running demo/production deployment, load test and full accessibility certification are NOT RUN.

## Deferred items

M15–M17, autonomous mutation, new roles/Copilot actions, staff scoring/ranking, fake confidence/probability/composites, cloud dependency, arbitrary runtime shell/SQL, new RAG/vector platform, real customer data and unrelated historical reruns. M14 commit/push/tag/merge: NO.

## Release blockers

No confirmed blocker remains for the authorized M14 implementation review gate. This does not authorize a release or production deployment. M14 remains reviewable in the uncommitted working tree.

## Gate

**PASS — HUMAN-REVIEW CLOSURE PASS.** [Final gate record](../v1.2/evidence/M14_FINAL_GATES.json). Required development gates and focused closure pass; no production accuracy/scale/deployment claim. The subsequent user authorizes exactly one checkpoint `feat(v1.2): complete M14 recommendation v2`, then M15 authority discovery only. STOP before M15 implementation.

## Subsequent closure review — 2026-09-30

Manually reviewed retained synthetic MANAGER Generate/Accept/Modify/Reject results, browser assertions, PostgreSQL side-effect/provenance assertions and successful-run desktop/mobile screenshots; focused source inspection confirms fields, loading/error/retry/stale UX and artifact-only writes. No fresh interactive flow, test suite or live-model evaluation was run. Original output and human final decisions/reviewer/time remain separate. Only explicit manual business approval applies assignment/SLA/checklist; all V2 review decisions leave Request/business state unchanged.

Fresh Git preflight and exact inventory comparison pass: 271 files (43 non-evidence/228 evidence), zero differences/duplicates; all evidence JSON parses and scoped secret/path inspection has no findings. `git diff --check` exits 0 with CRLF notices only. Only existing documentation/evidence is updated for closure. Migration SQL only drops confidence NOT NULL, without DML/backfill/table/index/vector changes. V1 values remain preserved and V2 can store null; retained isolated PostgreSQL evidence supports compatibility. Running demo DB migration and a new clone test: NOT RUN. Known V2 local latency and six-case synthetic limitations remain.
