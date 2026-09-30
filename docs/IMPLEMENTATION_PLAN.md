# Implementation Plan

Current execution status (2026-09-30): the user authorized and completed M1–M10 after M0. The V1 evaluation-stability continuation preserved historical RED runs, froze a controlled protocol, executed its single permitted full run and passed the unchanged comparator. M10/V1 final verification is **PASS**; release Git finalization is authorized by the current task. See [M10 verification](verification/MILESTONE_10_VERIFICATION.md), [final verification](verification/FINAL_VERIFICATION.md) and [V1 release](release/V1_RELEASE.md). No M11 work is authorized or started. Historical M0-only boundaries below describe the original phase, not current authorization.

Authority: canonical master-plan §§11–22 and §§33–46, constrained by the explicit M0-only execution request. This file is the dependency map and future work contract, not a claim that implementation is present. M0 must stop after verification; starting M1 requires explicit user approval.

## Sequence and dependencies

```text
M0 specifications
  → M1 foundation/local infrastructure
  → M2 schema/auth/RBAC/seed
  → M3 request domain/manual lifecycle/SLA
  → M4 local structured intake
  → M5 knowledge/RAG
  → M6 tools/similarity/recommendation
  → M7 human review/staff UI
  → M8 Copilot/checklist/SLA monitoring/summary
  → M9 evaluation/benchmark/analytics
  → M10 hardening/audits/competition package
```

No skipping or implementing the next milestone before the current gate passes. Inputs below state additional cross-cutting dependencies; sequential gating still applies.

| Milestone | Prerequisites / inputs | Required deliverables and owning files | Evidence required for PASS |
|---|---|---|---|
| M0 | Supplied master plan and clean initial repository inspection | AGENTS, 14 specs, 2 architectures, implementation plan, 5 ADRs, baseline and M0 verification | Explicit roles/ownership/states/AI/tool/RAG/SLA/security/non-goals/demo; consistent contracts; no unresolved blocker; docs checker + manual review |
| M1 | M0 PASS plus user authorization; architecture/ADRs | npm workspaces, apps/web/api, shared config/contracts/configuration, strict TS/lint, Next/Tailwind/shadcn setup, API client/loading/error boundary, Nest validation/error/request-ID/logging/Swagger, Docker postgres/api/web, vector extension, health/provider connectivity, typed env and .env.example, README commands | Real lint/typecheck/unit/build; API boot/health/DB/vector tests; online/offline Ollama health handling; Compose config/up; web/API reachable, DB ready, AI absence nonfatal |
| M2 | M1; DATABASE/AUTHORIZATION/API/DEMO specs | Prisma domain baseline/migrations/constraints/indexes, auth login/refresh/logout/me/revocation, central guards, scoped repositories, seeded 1 USER + 4 STAFF + 1 MANAGER/4 teams/5 skills/SLA, generated OpenAPI/contracts | Empty DB migrate/seed, login all roles, no USER manager access/STAFF approval/cross-owner/unassigned staff leakage, expired/replayed sessions rejected, inactive user rejected, no client-only guards |
| M3 | M2 identities/DB and state/SLA contracts | Request creation/list/detail/messages/timeline, centralized state machine and optimistic versioning, manual triage/submit/approval, assignment history, work/info/resolve/confirm/reopen/cancel, initial SLA pause/resume and transactional notifications/audit | AI-disabled create→manual approval→assign→start→resolve→confirm, all transition positives/negatives, wait/reopen/cancel, real DB atomicity/concurrency and clock tests |
| M4 | M3 state integrity plus M1 Ollama config | LLM adapter with abort/timeouts/retry/health/model metadata, versioned prompts, schemas/taxonomy, AiRun/AiAnalysis, progress/failure UI, 50 labeled evaluation cases | Valid/invalid JSON/schema/unknown category/missing facts/timeout/offline/recovery tests; actual IoT/billing/missing-location/ambiguous/offline demonstrations; provider metadata truthful |
| M5 | M4 providers, M2 auth/DB, RAG_SPEC | PDF/TXT manager upload, private storage/validation/extraction/deterministic chunks, embedding adapter, verified D migration/index, source IDs/snapshots/authorization, disable/reindex/status/source UI, real synthetic SOPs, 20–30 retrieval queries | Real upload→READY→correct SOP retrieval→verified citation→source metadata, real pgvector tests, dimension/model mismatch/disable/empty/corrupt/source-fabrication cases, measured Hit@1/3/5 |
| M6 | M5 knowledge plus M3 policies/assignment data and M4 analysis | Six-tool registry with purpose/schemas/limits/audit, actual RequestEmbedding similarity, deterministic candidate/workload scoring, structured grounded recommendations, explanation panel and PENDING_APPROVAL publication | Unknown/unauthorized/timeout/tool errors, fabricated source/staff/policy/count rejection, no side effects before approval, primary request retrieves real SOP/cases/policy/candidates and remains unassigned |
| M7 | M6 recommendation plus M3 manual approval primitives | Full manager side-by-side accept/modify/reject UI and transaction binding to AI record; staff queue/work panels; original/change/final decision retained; notifications | Stale/double approval conflict, rollback atomicity, modify/reject behavior, wrong-role denial, valid staff queue, AI recommendation→human decision→assignment visible |
| M8 | M7 approved work plus M5 RAG and M3 SLA | Six-action Copilot, explicit checklist draft adoption/edit/waiver, deterministic SLA monitor/warning dedupe, validated resolution, factual summary, owner confirmation/reopen and closed feedback | Assigned-only context, source grounding, no AI checklist completion, pause/resume/breach math/dedupe, factual event summary, failure recovery; one fully AI-assisted request reaches CLOSED |
| M9 | M4–M8 real runs/events/decisions and M5 retrieval | >=100 valid independently labeled request cases (150–300 target), reproducible live ai:evaluate with raw JSON/report, schema/category/priority/team/entity/Hit@k/latency/outcome metrics, 20-case manual benchmark methodology/timings, manager real analytics | Actual local models verified, raw outcomes reproduce report, failures retained, no hardcoded metrics, dashboards reconcile to DB, benchmark method and limitations disclosed |
| M10 | M1–M9 all PASS | Demo preflight/reset/seed/warmup, synthetic history and knowledge, primary/3 secondary scenarios, security/AI safety audits, UX/responsive/accessibility fixes, Playwright critical paths, offline test, competition package and final verification | Full lint/typecheck/unit/integration/E2E/build/Compose/live AI/RAG/audits/preflight; safe reset and warmup; stable demo with actual configuration; no release blocker |

## Cross-milestone ownership clarifications

- M1 enables pgvector but does not guess a vector dimension. M2 creates the logical domain baseline; M5 probes actual embeddings then adds dimension-specific vector columns/index migrations; M6 populates request vectors.
- M3 owns manual human approval/assignment core because its gate explicitly requires an AI-independent lifecycle. M7 adds AI-review binding/UI and tests; it must reuse the same protected transaction, not create a bypass.
- M3 owns initial SLA and notification records; M8 adds scheduled risk warnings/dedupe and Copilot. M9 reports these real events.
- M4 proves intake only; M6 connects retrieval/tools to recommendation. Do not claim M4 analysis is a completed recommendation/assignment.
- M1's listed root command surface may provide explicit nonzero “not implemented until Mx” entrypoints for later gates; no no-op PASS stubs. M1's required runnable checks are its own explicit lint/typecheck/test/build/Compose/health gates. By M10 every final command is genuinely implemented.
- README documents only commands that actually exist; planned commands here are labeled future requirements. No application scaffold is needed to verify M0.
- Model tags, package versions and actual hardware latency remain validation tasks in M1/M4/M5/M9, not evidence-free freeze values.

## Planned command surface (not present in M0)

M1: npm install, npm run dev/build/lint/typecheck/test; docker compose config/up; later stage integration entrypoints. M2: npm run db:migrate, demo:seed, test:integration. M3 onward: executable relevant API/browser lifecycle checks. M9: npm run ai:evaluate. M10: npm run e2e, demo:preflight, demo:reset, demo:seed, demo:warmup and all prior commands. Exact syntax must match the future implemented scripts, never fabricated placeholders in final verification.

## Required final artifacts by milestone

Every milestone writes `docs/verification/MILESTONE_X_VERIFICATION.md` with master-plan section 34 headings, actual commands/results, manual evidence, limitations, deferrals, blockers and PASS/FAIL. M9 adds datasets/README, timestamped safe raw results and `docs/evaluation/AI_EVALUATION_REPORT.md`. M10 also creates:

```text
docs/verification/SECURITY_AUDIT.md
docs/verification/AI_SAFETY_AUDIT.md
docs/verification/FINAL_VERIFICATION.md
docs/demo/COMPETITION_SUBMISSION.md
docs/demo/PRODUCT_DESCRIPTION.md
docs/demo/AI_MODEL_DISCLOSURE.md
docs/demo/DEMO_SCRIPT_5_MIN.md
docs/demo/DEMO_SCRIPT_10_MIN.md
docs/demo/JUDGE_QA.md
docs/demo/VIDEO_SHOT_LIST.md
docs/demo/BEFORE_AFTER_EVIDENCE.md
```

Final verification records commit SHA if Git, environment/models, lint/typecheck/unit/integration/E2E/build/Docker, actual AI/RAG evaluation, audits and preflight. Product description covers problem/current process/AI workflow/users/environment/value/privacy/scalability. Disclosure names actual models and never claims custom training. Judge Q&A covers AI value/error control/hallucination/local-cloud boundary/privacy/approval/measurement/offline operation/scalability and difference from a chatbot/ticket UI. Demo scripts show the canonical and missing-info/offline/manager-modify scenarios with real sources, decisions and measurements.

## Work and risk protocol

For each authorized milestone: read specs/current verification/source/tests; record files/migrations/tests/risks; implement minimal complete scope; run applicable checks; fix root causes; update affected contracts/assumptions; write honest gate. Critical actions require audit, migrations require real DB tests, and important endpoints require permission negatives. No removal of required tests/security/approval/RAG/evaluation to meet a date.

Schedule target follows the master plan: 28 Sep M0, 29 Sep M1, 30 Sep M2, 1–7 Oct M3–M9, 8 Oct engineering M10, 9 Oct submission materials, 10 Oct final verification/submission. Cut optional dark mode/charts/attachments/DOCX/experience scoring/containerized Ollama first if necessary; never cut required gates. M1–M10 and the final V1 gate are complete; this plan does not authorize M11.
