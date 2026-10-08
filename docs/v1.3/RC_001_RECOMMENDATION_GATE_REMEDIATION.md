# MobiFlow AI V1.3 — RC-001 Recommendation gate remediation

Executed 2026-10-08. **RC-001 REMEDIATION PASS — READY FOR HUMAN REVIEW**.

Primary root cause: **RC-A — FIXTURE_STALE**. Production semantic impact: **NONE**. This is a targeted remediation checkpoint; it does not replace or complete the failed Final Release Checkpoint.

## A. Baseline

- Verified local `main`, `origin/main` and live remote `main`: `c9aa8470419fc025faa6b346afe0c88f54e8934f`, after `git fetch --all --prune`.
- Remediation branch: `fix/v1.3-rc-001-recommendation-gate`, in a new isolated worktree. Initial tracked source inventory: 1,793 files.
- Existing `v1.3.0` resolves to `56e97f1e522f2bef2340fd9986e0507f6c2bc172`; the baseline is seven commits later. No tag/version change is part of this task.
- Original workspace remains on `fix/v1.3-ui-ux-remediation` at `e6e61bd909c5b38c6677792ba39f6069aeb0c073`. Its 20 existing tracked modifications, six untracked status entries, empty index, diff and 2,117 tracked/untracked file hashes were captured before work and preserved.

The unchanged authoritative command was reproduced in this task on isolated real PostgreSQL:

```text
node --env-file=.env scripts/verification/m24-integration.mjs
4/5 PASS, 1/5 FAIL, exit 1
Recommendation job FAILED / INVALID_REFERENCE
Both bounded attempts: EVIDENCE_DECISION_MISMATCH
```

The unchanged diagnostic rerun reproduced the same failure. The original checkpoint failure remains valid historical evidence and has not been overwritten or promoted to PASS.

Evidence is retained outside Git at:

```text
C:/Users/AnhPhamPC/.codex/visualizations/2026/10/07/01a1168d-344a-7bd0-b8e1-522d54b64ecb/rc-001-remediation
```

Important records: `BASELINE.json`, `ORIGINAL_BASELINE.json`, `BASELINE_M24_API.json`, `baseline-m24.log`, `BASELINE_DIAGNOSTIC.json`, `baseline-diagnostic-retry.log`, `ROOT_CAUSE.json`. No runtime credentials or private context are included in this report.

## B. Root cause

**The M24 success fixture was stale relative to the current Recommendation V2 evidence contract.** Its generic SOP text contained SIM/APN keywords and an instruction but no affirmative applicability clause or matching canonical classification. It was therefore ineligible under the existing specification. The release provider also discarded the canonical `evidenceDecision` already present in its messages; the shared fixture's legacy fallback selected the first retrieved source and proposed `SUFFICIENT`.

This is one primary classification, RC-A. The dropped decision is a contributing fixture-adapter contract defect. It is not evidence of a production policy or retrieval regression.

Safe current-run diagnostic facts:

| Fact | Observed value |
|---|---|
| Validated analysis | `NETWORK / IOT_CONNECTIVITY` |
| Retrieved source | `KD-d07b54ff-cea7-4263-ab2d-e3e4f519a6d6-G1-C0` |
| Source order / generation / distance | `0 / 1 / 0` |
| Source unavailable flag | `false` |
| Excerpt SHA256 | `3cbe62a95d43ee7d3c016fd83a9a4fc3b159dd8a0bd6088685c9283061cffff3` |
| Procedurally eligible | `false` |
| Backend decision | `INSUFFICIENT_EVIDENCE / NO_ALLOWED_RELEVANT_PROCEDURE` |
| Eligible and selected procedure IDs | Both empty |
| Fixture proposal | `SUFFICIENT`, citing that retrieved source |
| Final validation | Both attempts rejected; retry count 1; job `FAILED` |

### Specification authority

| Question | Authority | Required behavior |
|---|---|---|
| Which sources qualify? | [RAG_SPEC](../specs/RAG_SPEC.md), V1.3 recommendation amendment | Allowed current READY retrieved member, compatible embedding/generation, accepted distance, affirmative instruction and explicit positive applicability/classification. |
| Who owns sufficiency? | [AI_BEHAVIOR_SPEC](../specs/AI_BEHAVIOR_SPEC.md), V1.3 recommendation ownership amendment | Backend owns evidence status and selected procedure IDs; the provider cannot override them. |
| What must generated status equal? | `apps/api/src/ai/recommendation-evidence-decision.ts`, `validateRecommendationEvidenceOutput` | Exactly the canonical backend decision; mismatch raises `INVALID_REFERENCE / EVIDENCE_DECISION_MISMATCH`. |
| When must generation fail closed? | `apps/api/src/ai/recommendation-output.ts`, `parseRecommendationV2ForGeneration`; transactional publication owner | Invalid source membership, procedure membership or decision cannot publish an artifact. |
| Is the original generic SOP sufficient? | RAG amendment and actual `supportsProcedure` rules | **NO**. Title, ranking, distance zero and keywords alone grant no procedural authority. |

### Exact failing call path

| Stage / owner | Input → output | Contract / invariant |
|---|---|---|
| `scripts/verification/m24-integration.mjs` and `m24-database.mjs` | Dedicated real-PG target → migrated/seeded test database and unchanged five-test runner | Isolated loopback synthetic target; database dropped in owned cleanup. |
| `apps/api/test/helpers/release-hardening-fixture.mjs`, `createReleaseHarness` | Test database → actual application with deterministic providers and captured calls | Real domain services; no mocked successful Recommendation job. |
| `apps/api/test/release-hardening.integration.test.mjs`, AI-isolation scenario | Public request plus private canaries → successful synthetic analysis and uploaded SOP | Actual upload/ingestion must reach READY; canaries remain excluded. |
| Existing knowledge ingestion/retrieval and Recommendation tool session | Stored chunks plus validated analysis → real retrieved source in evidence snapshot | Source availability, identity, authorization and provenance remain enforced. |
| `apps/api/src/ai/recommendation.service.ts` | Snapshot → canonical insufficient decision, stored and passed to provider | Backend computes sufficiency before generation. |
| Old release provider adapter | Provider messages → `recommendationFixture(evidence)` | Defect: omitted the supplied canonical decision. |
| `apps/api/test/helpers/recommendation-v2-fixture.mjs` | Evidence without decision → first-source procedure, `SUFFICIENT` | Legacy fixture fallback is deliberately also used by negative tests; it is not a production policy. |
| `parseRecommendationV2ForGeneration` | Proposed JSON plus original evidence/decision → independent revalidation | Schema and source/reference validation precede canonical output validation. |
| `validateRecommendationEvidenceOutput` | `SUFFICIENT` versus canonical insufficient → `EVIDENCE_DECISION_MISMATCH` | Retryable `INVALID_REFERENCE`; no invalid publication. |
| `RecommendationService` bounded attempts | Same invalid proposal twice → failed AiRun | Two attempts only; downstream M24 success assertions were not reached before repair. |

Known-good comparison: the unchanged M14 helper's default source explicitly applies to SIM IoT outages and supplies verification instructions/canonical classification. Its `fixtureProvider` already forwards `evidenceDecision`. Both use real retrieved source IDs. The repaired M24 fixture now follows that existing contract without copying eligibility logic or granting privileges.

## C. Why rejection was safe

The validator correctly rejected a proposal that contradicted the backend decision. Neither attempt became a successful Recommendation artifact. The observed failure establishes fixture/policy disagreement; it does not establish a privacy leak or a broken production eligibility rule. Keeping the original generic text insufficient is an explicit new negative regression.

Source eligibility, JSON/schema validation, exact evidence excerpts, reference membership, publication currentness, authorization, expected-version guards and human approval remain in the existing production owners. No exception for M24 or test mode was introduced.

## D. Repair and file ownership

The uploaded synthetic source now reads:

> Áp dụng cho SIM IoT bị mất kết nối. Kiểm tra trạng thái SIM và cấu hình APN, ghi lại kết quả để quản lý xem xét.

It contains realistic applicability and verification instructions, then passes through the same upload, ingestion, retrieval and production validation path. `releaseRecommendationFixture` forwards the backend decision from the actual provider message to the existing shared fixture helper. It does not calculate a second eligibility policy.

| File | Owner / reason / RC-001 relationship | Production changed | Test changed | Invariant impact |
|---|---|---|---|---|
| `apps/api/test/helpers/release-hardening-fixture.mjs` | M24 fixture: scoped source text and testable adapter forwarding canonical decision | NO | YES | Selected references follow the backend decision; existing call capture retained. |
| `apps/api/test/release-hardening.integration.test.mjs` | M24 scenario: import source text and replace uploaded buffer only | NO | YES, data only | All 55 assertion/test/pass-marker lines remain byte-identical. |
| `scripts/evaluation/m15-prompt.test.mjs` | Existing evidence/prompt regression owner: add three RC-001 behavioral tests | NO | YES | Covers success, insufficient fallback, mismatched status, ineligible member and fabricated ID. |
| `docs/v1.3/RC_001_RECOMMENDATION_GATE_REMEDIATION.md` | This checkpoint report | NO | NO | Records authority, actual results, limits and publication boundary. |
| `docs/verification/MILESTONE_24_VERIFICATION.md` | Append current section-34 follow-up and report link | NO | NO | Historical records retained verbatim. |

No global change to `recommendationFixture` was made: callers intentionally omitting a decision can still construct invalid proposals for existing rejection tests.

## E. Production semantic impact

**NONE.** Production Recommendation policy, service, prompts, provider, output parser, transactional publication and retrieval owners are byte-identical to the exact main baseline. There is no API, schema, migration, dependency, configuration or UI change.

## F. Negative guard preservation

Focused command:

```text
node --test --test-name-pattern=RC-001 scripts/evaluation/m15-prompt.test.mjs
```

Result: **3/3 PASS, exit 0**. The final tests prove:

1. Scoped eligible evidence produces the canonical sufficient proposal and passes the generation parser.
2. The original generic SOP remains insufficient; the adapter emits no procedure/checklist and includes the warning. Its old sufficient proposal still throws `INVALID_REFERENCE / EVIDENCE_DECISION_MISMATCH`.
3. A closer ineligible retrieved member cannot displace the eligible procedure. A controlled proposal using that real ineligible member passes the legacy public parser but fails new generation specifically with `PROCEDURE_DECISION_MEMBERSHIP`. A separately fabricated ID fails specifically with `SOURCE_MEMBERSHIP`.

Existing M15 and real-PG tests also preserve both directions of status mismatch, context-decision mismatch, unavailable/weak/wrong-category/negative-scope sources, invented IDs/excerpts, missing-field behavior, human prerequisites, bounded repair and transactional revalidation. No assertion, skip/todo or validation bypass was added to the authoritative M24 suite. See `ASSERTION_INTEGRITY.json` and the focused test logs.

## G. Authoritative M24 verification

The exact original command was executed after repair and again with a newly recreated isolated database:

```text
node --env-file=.env scripts/verification/m24-integration.mjs
```

| Run | Result | Evidence |
|---|---|---|
| Baseline, unchanged source | 4/5, exit 1 | `BASELINE_M24_API.json`, `baseline-m24.log` |
| After repair, fresh PG | **5/5 PASS, exit 0** | `AFTER_M24_FIRST.json`, `after-m24-first.log` |
| Deterministic repeat, fresh PG | **5/5 PASS, exit 0** | `AFTER_M24_REPEAT.json`, `after-m24-repeat.log` |
| Final local-dependency installation, fresh PG | **5/5 PASS, exit 0** | `AFTER_M24_LOCAL_DEPS.json`, `after-m24-local-deps.log` |

Each run uses the existing dedicated `mobiflow_m24_test` lifecycle, all 13 migrations, synthetic seed and owned database cleanup. Passing results are separate runs; none replaces the baseline failure.

Recommendation is now `SUCCEEDED`. All subsequent assertions execute: Copilot public context excludes private notes/watchers/template-private data, protected business snapshots remain unchanged, and human approval/assignment conditions are preserved. All five reported checks PASS: integrated human workflow; RBAC/IDOR/privacy/current recipients; deterministic AI isolation/no protected writes; scheduler handoff/dedup; transport/rate/session guards.

The existing test container was started only for isolated verification. The developer/shared database and existing demo services were not used or reset.

## H. Recommendation, RAG and M15 regression

| Exact command | Actual result / scope |
|---|---|
| `node --env-file=.env scripts/verification/m14-integration.mjs` | **38/38 PASS, exit 0**, including two parent tests and 36 nested tests. Repeated successfully after local dependency installation. Actual PG covers evidence decision/publication, source fidelity, stale/race/session/authorization, artifact-only review, separate human decisions and bounded failures. |
| `node --test scripts/evaluation/m15-evaluation.test.mjs scripts/evaluation/m15-dataset.test.mjs scripts/evaluation/m15-prompt.test.mjs` | **67/67 PASS, exit 0**. Relevant deterministic evaluation, dataset/oracle integrity, prompt and generation/reference rules. Included again in the final root deterministic run. |

Current authoritative full-live script discovered from `package.json`: `npm run eval:recommendation:m15`. Its unchanged runner is `scripts/evaluation/m15-recommendation-evaluate.mjs`. Under user section 22's fixture-only allowance, the relevant gate here is the targeted deterministic evaluation because production runtime is unchanged. The full live 100+30 protocol was **NOT RERUN** and consistency is **NOT RUN** in this task; historical accepted M15 results are not claimed as newly executed.

Dataset: `m15.recommendation.synthetic.v2`; SHA256 `d011105c106711cf7848e20d757099aa62c4152336fc2672a5e09719c01ba6e9`; 100 ordered cases and ten designated consistency cases, unchanged.

Optional bounded live smoke used the existing runner without changing model, prompt, dataset, oracle, timeout or policy:

```text
node --env-file=.env scripts/evaluation/m15-recommendation-evaluate.mjs --case-ids=M15-001-iot-gateway-offline,M15-016-customer-omitted,M15-032-iot-no-sop --skip-consistency --evidence-root=C:/Users/AnhPhamPC/.codex/visualizations/2026/10/07/01a1168d-344a-7bd0-b8e1-522d54b64ecb/rc-001-remediation/live-smoke
```

The existing local Ollama server initially did not respond; it was started hidden using the installed executable. No model download/update or tag change occurred. Verified Ollama 0.35.0, generation model `qwen3:4b-instruct-2507-q4_K_M` digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641`, embedding `bge-m3:latest` digest `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`, actual finite nonzero probe dimension 1024.

All **three selected cases SUCCEEDED on their first attempt**; no retries, terminal errors, invalid references, source-fidelity failures or bounded semantic/authority oracle findings. Statuses were respectively sufficient, sufficient with missing-information/empty checklist, and insufficient with no procedure/checklist. End-to-end durations: 18,121 / 13,518 / 9,414 ms. The evaluator correctly reports **PARTIAL**, exit 0, for this filtered run. Zero consistency runs is unmeasured, not a passing consistency result. This evaluator uses frozen synthetic retrieved contexts, so live retrieval ranking/currentness is not measured; actual ingestion/retrieval/publication is covered separately by real-PG suites.

Live run ID: `2026-10-08T08-48-19-073Z-d7463347-fc75-49b1-bcdb-647c49181605`. Logs/manifests/details stay outside Git.

## I. Deterministic totals

`npm test`: **284/284 PASS, exit 0**; configuration 7, API 172, web 19, release/evaluation scripts 86. Zero failed, skipped, cancelled or todo. This preserves the prior 281-case baseline and adds exactly three RC-001 regressions. The final run used dependencies installed inside this remediation worktree.

The 67 M15 and three focused tests overlap the root total and must not be added to it. Real-PG integrations and selected live calls are separate evidence.

## J. Static and production build gates

| Command | Final result |
|---|---|
| `npm ci --offline --no-audit --no-fund` | PASS, exit 0; 619 packages installed from existing cache; manifest/lockfile unchanged. |
| `npm run lint` | PASS, exit 0; zero allowed warnings. |
| `npm run typecheck` | PASS, exit 0; foundation, Prisma generation, API and web. |
| `$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:33901/api/v1'` then `npm run build` | PASS, exit 0; actual API and Next.js Turbopack production build. |
| `git diff --check` and final staged whitespace check | PASS; no errors. |

The first build failed because the initial dependency junction pointed outside Turbopack's filesystem root. The exact verified junction alone was removed; its shared target was preserved, and dependencies were installed normally inside the remediation worktree. The unchanged production command then passed. This was an environment/setup failure, not a product fix: no build flag, package, lockfile or config workaround. `build.log` retains that failure; `npm-ci-local.log` and `build-local-deps.log` retain recovery. Lint, typecheck, all 284 tests, M24 and M14 PG were verified again with local dependencies.

## K. Architecture and source integrity

Baseline-to-final tracked hashes/diff allowlist establish **ZERO** unexpected changes to REST `/api/v1`/OpenAPI, contracts, Prisma schema/all 13 migrations, RBAC/ownership, request state machine, SLA, template permissions, notes/watchers, routing, analytics, frontend, runtime configuration, dependency lockfile and evaluation dataset/oracles. Production AI/RAG source is byte-identical. Only the five files classified in section D enter the commit.

The authoritative M24 runner is unchanged; its 55 assertion/test/pass-marker lines are unchanged. The existing milestone document's historical bytes remain a prefix, with only this task's append added.

Original user workspace: all 2,117 file hashes, branch/HEAD, status, binary diff and index match the captured task baseline. This proves preservation during this task; it does not resolve or rewrite older developer-database preservation incidents. No developer DB access was needed.

Generated M14/M24 evidence was retained externally; only those task-generated tracked records were restored to their exact initial checkout bytes, and task-created iteration files were moved outside the repository. No blanket reset, clean, restore, stash or unrelated deletion was used. Temporary diagnostic instrumentation remains outside tracked source. Runtime `.env`, credentials, databases, raw prompts, node_modules and visualization artifacts are excluded from staging.

An independent agent reviewed the final code diff read-only and found no actionable issue after the negative test was strengthened to isolate the exact membership rule. Independent **human review is pending**; agent review does not substitute for it.

## L. Limitations and next boundary

This checkpoint establishes the targeted fixture repair and listed gates. It does not certify general AI accuracy, complete live RAG ranking, full WCAG/browser/UX coverage, production reliability or deployment readiness. Full M15 100+30 and the full Final Release Checkpoint were not rerun. The bounded lexical evaluation oracles do not prove every possible semantic claim.

No main merge, tag, version bump, deployment or later milestone is authorized here. After human review and a separately authorized merge/push, the next Final Release Checkpoint must start again at the new exact main SHA, from candidate identity through all release gates. The old partial checkpoint cannot be completed by appending only skipped gates.

## M. Git publication

Task-owned allowlist: the three test/fixture files, this report and the appended M24 verification document. All acceptance gates passed before staging. The user authorized commit and ordinary push of **only** `fix/v1.3-rc-001-recommendation-gate` after PASS; no force push or main update.

Publication commit message: `fix(v1.3): align recommendation evidence release fixture`. The publication identity is the commit containing this report, rather than an impossible self-referential hash inside that same commit. The post-publication receipt `GIT_PUBLICATION.json` in the external evidence directory records exact local/remote branch SHA, remote main/tag verification and final clean status. Commit/push are performed after this report is frozen; the final task response supplies the verified SHA and push result.

**FINAL VERDICT: RC-001 REMEDIATION PASS — READY FOR HUMAN REVIEW**.
