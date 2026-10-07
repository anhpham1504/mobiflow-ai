# V1.3 Copilot checklist truncation implementation plan

Written before candidate product edits, 6 October 2026, Asia/Saigon (UTC+7).

Baseline: `b3f39f6b858ef32b2aafef07ea99b1ab254ba583`.
Candidate branch: `fix/v1.3-copilot-checklist-truncation`.
Candidate root: `C:/Users/AnhPhamPC/.codex/worktrees/v130-checklist-truncation/MobiFlow AI`.
Preserved root: `C:/Users/AnhPhamPC/.codex/worktrees/v130-stability-followup/MobiFlow AI`.

## Preservation and adoption

The old root was captured at 2026-10-06 15:01:48 +07:00: same checkpoint HEAD, 30 dirty paths, empty staging. Exact dirty bytes, SHA256 for every path, full binary unstaged and staged diffs, refs and prior 21-path baseline are retained in its ignored `artifacts/v130-copilot-checklist-20261006`. No old product edits are authorized by this plan. The new managed worktree starts clean from the exact checkpoint; its requested branch has been created. Review each cumulative delta against both checkpoint and saved M15 starting bytes before explicit adoption. The path-level adoption table will be frozen in the diagnosis/evidence from the independent delta audit before copying product files. No reset, checkout-discard, clean, stash, blanket staging, commit or push.

Preserve the uncommitted M15 evidence-decision dependency, inherited summary fidelity/Copilot case-membership/UI fixes and historical reports only after owner/diff review. Historical FAIL evidence remains byte-identical. A nonseparable overlap blocks that file's mutation.

## Symptom and hypotheses

Actual run `2220a738-2d57-4307-be8e-f13037bac231`, request `05258ad9-7ed2-44a4-b06c-4c4af37a0bbb` / MF-2026-000038: GENERATE_CHECKLIST first attempt rejected `AI_INVALID_OUTPUT / TRUNCATED_GENERATION`; bounded repair succeeded, total32602ms, retryCount1. Adapter emits that category for provider `done_reason=length`, before application parser. First raw output, token counts and provider-only attempt duration were not retained. No causal claim about M15 or host load.

Audit separately input length, native format overhead, repeated instructions/items/fields/citations, prose/reasoning, cardinality/length bounds, termination/stop handling, num_predict/options, repair drift, concurrency, complete JSON with length and fixture-class reproducibility. Record unavailable telemetry as NOT AVAILABLE.

## Owners and proposed change

| Owner | Responsibility / intended scope | Gate |
|---|---|---|
| `apps/api/src/ai/prompts/copilot.ts` | Action-specific compact checklist instructions/native format; retain other five action messages/formats and summary | prompt/format tests;20 live;M8 |
| `apps/api/src/ai/operational-output.ts` | Same-shape stricter checklist generation validation; retain strict JSON/source shape/public contract | COP-TRUNC01–08 |
| `apps/api/src/ai/operational-ai.service.ts` | Existing context/retry/mapping/publication owner; only checklist-specific validation/identity if necessary | bounded attempts;PG;workflow |
| `apps/api/src/ai/ollama-provider.ts` | Shared transport and length rejection: read/test, no proposed edit | adapter01/02/09/10;M15 hash |
| `apps/api/test/operational.test.mjs`, existing provider/PG tests | Actual regressions, source/privacy/stale/control negatives | unit/PG |
| `apps/web/src/components/copilot-panel.tsx` | Read/verify loading/error/retry/no-autoapply/role/source behavior; no planned product edit | browser |
| `docs/specs/AI_BEHAVIOR_SPEC.md` | Document internal generation caps/rationale, keep public30/500 contract | owner consistency |

Proposed smallest fix, conditional on live accounting: bound the checklist before generation with compact same-shape internal schema, retrieval-ID enumeration, concise nonduplicated actions and only necessary per-item citations. Use the same limits in parsing and publication. Choose cardinality from real applicable multi-step SOP requirements; do not silently slice generated strings/items or fix partial JSON. No stop-sequence change without evidence. If same public shape and budget cannot retain required meaning, report blocker rather than increase budget.

## Frozen invariants

Qwen3 4B instruct2507 q4_K_M digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641`; BGE-M3 digest `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`, dimension1024/revisionm5.v1. Temp0/seed42/context16384/output1200/attempt120000ms/run300000ms/max2; same provider and accepted process-only Vulkan profile. Public API/contracts, DB schema/13 migrations, RBAC, privacy, six actions, read-only tools, source membership, version guards and human protected commands remain intact. Native format/parser/publication limits must agree. Repaired success remains a first-attempt failure.

## Test and live protocol

Deterministic COP-TRUNC01–10: length with cut item, closing cut and complete JSON all rejected; valid normal/near-budget accepted; prose, excessive items/field, invalid references rejected; two lengths terminal within2; first length then valid retains failure/retry1. Checklist semantics: ordered actionable applicable steps, no duplicates/completion assertions/protected mutations, no invented/private/foreign sources, missing facts preserved. All six action/RBAC/privacy/stale/context/tool bounds regressions.

Pre-fix live reproduction uses current authorized synthetic request/SOP context close to the real failure with multiple variants, exact provider options and transport metadata. Preserve every outcome. Freeze candidate manifest before live results: source/prompt/format and fixture hashes, model/runtime, settings, counts and success gates. Five fixtures (multi-step SOP, multiple sources/subset, long repeated input, missing facts, privacy/scope canary) ×4 =20; require20 first-attempt successes/20 attempts/0 repair/length/parser/validation/source/leak/mutation. Report min/median/max latency without SLO/p95 claim. Accepted M8 suite unchanged, all six actions, no retry/truncation. Five new synthetic full workflows, checklist in every one, existing SLA policies and no historical reset. Automated manager fixture decisions are not independent human review.

Run actual lint/typecheck/npm test/build scripts, affected unit/provider/parser/format/real-PG gates, backend/Web builds, readiness/RAG/index. Preserve build failures; only reuse verified installed Prisma engine with version/commit/hash if TLS download fails, no TLS bypass/lockfile change. UI check on candidate: loading/first success, controlled truncation error and explicit retry, no autoapply, keyboard/focus, console/network, role/logout, citations and USER privacy. Fixture UI errors are labeled controlled, not live success evidence.

M15: run evidence-decision/unit/deterministic061 and relevant real-PG publication negatives. Reuse prior full100+30 only if all12 watched M15 owner hashes plus dataset/oracle/shared options remain exact; otherwise full rerun and ≥3 live061 if recommendation affected. No unnecessary full evaluation to inflate counts.

## Identity, runtime and closure

Exact source hashes and compiled identity tie tested builder/native evaluator/serving API to candidate. Recheck after gates; any product edit reruns affected gates and creates a new declared live iteration when applicable. Demo/test PostgreSQL only (verified synthetic project/loopback55426), preserve historical rows and13 migrations. API/Web may be rebuilt within that explicit demo project without DB reset/reseed; accepted Ollama process may be restored with recorded process-only profile.

Developer preservation: **INHERITED FAIL — UNRESOLVED**. No developer startup, SQL, connection, mount, hash remeasurement, reset, migration or seed. No new exception. Consequently publication stops before commit/push even if all technical gates pass. Independent human review stays NOT RUN until actual user review. Main/tag unchanged; production NOT RUN; V1.4 NOT STARTED.

Deliver diagnosis, verification, checkpoint closure and sanitized evidence, plus review pack (short/multi-step/missing/multi-source/061/summary/error-retry UI). Technical PASS requires all requested Copilot gates; checkpoint BLOCKED remains distinct. No fabricated PASS.
## Evidence-driven source contract amendment

Completed prompt-only iterations v4/v5/v6/v7 each ran the unchanged five fixtures four times. They removed length/retry but failed the frozen semantic oracle; no failed rows were dropped. Exact qualifiers, intake labels and citation role were lost, and some text stopped midword at maxLength. This justified a tighter action-specific source sentence contract at the existing operational-output owner, rather than more token/timeout or a permissive parser.

The before-edit decision was recorded in ignored iteration5-decision.json. v8 uses positively declared current canonical scope, authorized document/generation sibling chunks and complete source instructions. Native tuple and independent validator preserve every selected instruction/citation in order; unsupported long/multiple/excess procedures fail closed. No fixture ID/value or domain-specific checklist template is embedded. AI_BEHAVIOR_SPEC and RAG_SPEC own the documented conservative grammar. Existing other-five prompts/formats, recommendation owners, provider options, public schema and migrations remain unchanged.

Iteration5 produced20 first-attempt successes with the v8 prompt and exact source validator, but a runner dataflow defect sent the generic format instead of API's context-specific format. Its coverage-audit FAIL disqualifies those rows from closing the native gate; complete original records remain supplemental evidence. Corrected iteration6 freezes the same fixtures/oracle/product/compiled bytes, passes context to every format call, and asserts each wireformat hash against the frozen manifest. No evaluator threshold or failed result is rewritten.

New regressions cover qualifier/order/source-pair preservation, negative/conflicting/missing scope, document generation boundaries, unsupported long/excess/multiple procedures and a different canonical domain with unrelated UUIDs. The legacy real-PG M8 fixture now supplies an explicit scoped procedure and still exercises manual adoption, SLA, summary and feedback. Test-only globalThis qualification repairs lint without changing product/compiled bytes; proof compares all408API artifacts.

Final owner review reproduced two v8 source-plan losses using the same compiled binary as iteration6: accent-stripping merged distinct Vietnamese actions, and a decision-policy substring filter skipped a complete operational instruction. v9/source-actions.v2 uses the same accent-preserving duplicate key as generation validation and rejects mixed operational/decision clauses instead of silently dropping them. Two actual-case regressions were added. A fresh iteration7 freezes identical five fixtures/oracle, records new source/compiled identities and executes all20 native runs. Earlier iteration6 PASS remains historical and cannot close v9 source coverage.

The interrupted original workflow batch retains three completed PASS records, one incomplete round and one NOT_RUN. After observing exited runtime processes/containers, restore only the exact synthetic demo container IDs/images/mounts and the accepted process-only Vulkan profile, recording changed StartedAt and UNKNOWN exit cause. Execute a new declared whole-five batch with fresh requests and the same inputs/thresholds; do not selectively resume or overwrite historical requests/results.
