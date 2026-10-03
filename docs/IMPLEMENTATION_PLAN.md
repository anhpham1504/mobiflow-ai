# Implementation Plan

Current M21 closure authority (recorded 2026-10-03): the later direct [checkpoint closure request](v1.3/M21_CHECKPOINT_CLOSURE.md) follows accepted Rule-based Routing implementation from closed M20 checkpoint `b75d15acc2dbbb16d00ce47db8ed891af210a48d` on `feat/v1.3-rule-based-routing`. [M21 plan](v1.3/M21_RULE_BASED_ROUTING_IMPLEMENTATION_PLAN.md), [verification](v1.3/M21_RULE_BASED_ROUTING_VERIFICATION.md) and [milestone21 record](verification/MILESTONE_21_VERIFICATION.md) retain the accepted implementation/gate snapshot. Closure reviews all files, migration11, sanitized evidence and human/authorization/privacy boundaries, updates current authority, creates exactly one reviewed commit and performs an ordinary push of the exact M21 branch. Matching local/remote SHA, an unchanged M20 checkpoint and clean tree are required before STOP. Product source/tests and accepted execution evidence remain unchanged; no additional product tests are needed for documentation/audit-only closure. Developer DB remains7 per accepted metadata; closure performs no DB connection. No M0–M20 replay, live AI, normal-stack restart, main merge, tag, deployment or M22–M24. V1.3 remains IN DEVELOPMENT; actual checkpoint SHA/publication results belong to the final handoff.

Historical M20 authority: [checkpoint closure](v1.3/M20_CHECKPOINT_CLOSURE.md) produced local/remote `b75d15acc2dbbb16d00ce47db8ed891af210a48d` on `feat/v1.3-response-checklist-templates`. [M20 plan](v1.3/M20_RESPONSE_CHECKLIST_TEMPLATES_IMPLEMENTATION_PLAN.md), [verification](v1.3/M20_RESPONSE_CHECKLIST_TEMPLATES_VERIFICATION.md) and [milestone20 record](verification/MILESTONE_20_VERIFICATION.md) remain unchanged execution snapshots. That closure did not itself authorize M21; the later explicit request above does.

Historical extension authority (2026-10-02): released V1.2 is `v1.2.0` at `31b445caf07dad606601a1e38e8ed39836d9f825`. [The V1.3 roadmap](v1.3/V1_3_MASTER_PLAN.md) initially authorized M18, whose [verification](verification/MILESTONE_18_VERIFICATION.md) passed and [checkpoint closure](v1.3/M18_CHECKPOINT_CLOSURE.md) produced `1f54dce3c8427976763b19ef33f181b4ef9a3337`. The later explicit [M19 request](v1.3/M19_MENTIONS_WATCHERS_SPEC.md) authorized [M19 Mentions + Watchers](v1.3/M19_MENTIONS_WATCHERS_IMPLEMENTATION_PLAN.md) on feat/v1.3-mentions-watchers; [accepted verification](verification/MILESTONE_19_VERIFICATION.md) is PASS — READY FOR HUMAN REVIEW. The subsequent [M19 checkpoint closure authorization](v1.3/M19_CHECKPOINT_CLOSURE.md) permits file/evidence review, exactly one reviewed commit and ordinary push of that branch, then local/remote SHA and clean-tree verification. The closure record is the preparation snapshot; actual publication/SHA is reported in the final handoff. No product development, test replay, main merge, tag, deployment, normal-stack restart/rebuild, developer DB access/migration/reset/reseed or Ollama/model action. M20–M24 NOT STARTED; V1.3 IN DEVELOPMENT. Historical execution boundaries and prior evidence below remain preserved.

Historical execution status (2026-10-01): M1–M10 and releases V1/V1.1 are completed. V1.2 M11–M16 are complete; [the V1.2 index](v1.2/README.md) records their separate authorities, checkpoints and accepted evidence. M16 checkpoint `8511a29529d82d4ed4adbcf5e4d49a6bacec73e4` matches its remote feature branch. The subsequent [M17 user request and runtime-remediation authorization](v1.2/M17_FINAL_RELEASE_CLOSURE_SPEC.md) authorize minimal sanity, release documentation, one documentation preparation commit, fast-forward main integration, annotated `v1.2.0`, ordinary main/tag pushes and remote verification, with no deployment. [M17 preparation verification](verification/MILESTONE_17_VERIFICATION.md) PASS: the old developer DB/image mismatch was resolved by applying the existing seventh M14 migration and rebuilding API/Web without reset/reseed/source changes; normal-stack core and authenticated smoke passed, with truthful optional AI/RAG degradation. Post-commit main/tag publication is verified in the release handoff. Historical M0-only boundaries below describe the original phase, not current authorization; earlier reports/evidence remain unchanged.

Historical V1 planning authority: canonical master-plan §§11–22 and §§33–46, constrained at the time by the explicit M0-only execution request. The original M0 boundary required stopping after verification and explicit approval before M1. Subsequent completed work and current V1.2 authority are recorded above and in the milestone index.

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

The completed V1.2 deltas and their owning plans are listed in [the milestone index](v1.2/README.md). M14 introduced advisory version dispatch, real source provenance and separate human decisions without advisory Request writes; M15 owns the accepted 100+30 synthetic live evaluation; M16 owns the accepted isolated hardening matrix. M17 adds [the release record](release/V1_2_RELEASE.md) and its own section-34 verification, updates current documentation, and performs only focused sanity and Git release checks. It does not authorize feature changes, historical replay, a new migration, a database reset or production deployment. A failing required gate stops release rather than being replaced with historical evidence.

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

The original schedule target follows the master plan: 28 Sep M0, 29 Sep M1, 30 Sep M2, 1–7 Oct M3–M9, 8 Oct engineering M10, 9 Oct submission materials, 10 Oct final verification/submission. Cut optional dark mode/charts/attachments/DOCX/experience scoring/containerized Ollama first if necessary; never cut required gates. M1–M10 and the final V1 gate are complete; later V1.2 authorization is recorded separately in the milestone index and the current status above.
