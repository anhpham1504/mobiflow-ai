# V1.3 Copilot checklist — checkpoint closure

2026-10-06 22:09:28 GMT+7 +07:00. **TECHNICAL PASS / CHECKPOINT BLOCKED.** No CHECKPOINT CLOSED claim.

Baseline/localHEAD `b3f39f6b858ef32b2aafef07ea99b1ab254ba583`, requested branch `fix/v1.3-copilot-checklist-truncation`, remote candidate `ABSENT` at2026-10-06T15:04:56.559Z. Productdirtyidentity `bd52ba83aa7f392ca652623d402ee39e6e6bbb3804712ed0252d6bf146531730`; testedsource `2125f8014cbe8960e2b3e0ade3056dc2b9175aecbb9254537311067812d861e8`; compiled408 `dea9c0bb7d8081ae96f22347e3d6d8a498909361521beb15c371eb46d53c6a1e`. Agentworktree DIRTY, stagingEMPTY, newcommitNONE, pushNO. Remote existing stability branch remainsbaseline; main/peeledrelease56e97f1e522f2bef2340fd9986e0507f6c2bc172, annotatedtagb1e2c3364ce205493871f84331cd6061c70f5918. No merge, reset/stash/clean/blanketstage/forcepush/rebase/tag/prod/V1.4 action.

Developer **INHERITED FAIL — UNRESOLVED**, accessNONE. User's exact execution request§12/16 requires a decision specifically applying to the inherited developer/currenthashincident before checkpoint commit/push. “Continue” authorizes the remediation work and does not supply that decision. No new accepted exception/baseline is asserted. Independent human review **NOT RUN**; seven sample groups prepared. [Verification](COPILOT_CHECKLIST_TRUNCATION_VERIFICATION.md) and [sanitized evidence](evidence/COPILOT_CHECKLIST_TRUNCATION_2026_10_06.json) record actual gates.

## Reviewed cumulative delta

Old worktree capturedbeforeedit at2026-10-06 15:01:48 +07:00:30dirtypaths/empty staging, prior21+9M15paths;10overlapping prior paths changed during M15,11retained exact prior snapshot bytes. Fullbinarydiff/perpath hashes reviewed before explicit adoption. No unsafe overlap chosen arbitrarily. Old30bytes/status/HEAD/staging remain exact after newwork. Six historic reports/evidence unchanged. Each adopted path below has source/rationale/gate; cumulative M15 dependency is distinguished from new Copilot patch.

|Path|Source|Reason retained|Related gate|
|---|---|---|---|
|apps/api/src/ai/operational-ai.service.ts|INHERITED_COPILOT|Pass STAFF-scoped allowed IDs to first native generation; preserve accepted similar-case membership fix while new work changes checklist only|M8 all-six actions; source/RBAC; publication|
|apps/api/src/ai/prompts/copilot.ts|INHERITED_COPILOT|Retain m8.v3 similar-case native scoped ID enum and identical repair format; checklist is later scoped owner|M8 all-six; CASE_MEMBERSHIP regression; COP-TRUNC|
|apps/api/src/ai/prompts/recommendation.ts|INHERITED_PRESENTATION_PLUS_M15|Retain neutral provenance/canonical questions and authoritative immutable evidence decision native branch; prevents M15-061 regression|M15-061; 100+30 reuse identity; decision unit|
|apps/api/src/ai/recommendation-output.ts|INHERITED_PRESENTATION_PLUS_M15|Retain generation-only presentation guard plus independent decision/output validation; historical read parser preserved|M15 generation/legacy compatibility; publication negative|
|apps/api/src/ai/recommendation-snapshot.ts|M15_ADDITION|Strip backend evidence decision/auth from public evidence while retaining typed decision for publication|Privacy; M15 publication; legacy history|
|apps/api/src/ai/recommendation.service.ts|INHERITED_PRESENTATION_PLUS_M15|Persist authoritative decision before inference and reuse decision on both bounded attempts; generation parser matches native schema|M15 bounded repair; no mutation; snapshot preservation|
|apps/api/src/requests/request-state-machine.service.ts|M15_ADDITION|Recompute snapshot decision and generation validate before artifact invalidation/insertion within transaction|Real PG forged/missing/flip publication; stale; no mutation|
|apps/api/test/helpers/m15-reliability-fixture.mjs|M15_ADDITION|Synthetic SOP now explicitly applicable to existing domain; avoids title-only authority assumption in reliability fixtures|M15 recovery/reliability unit; unchanged source policy|
|apps/api/test/helpers/recommendation-v2-fixture.mjs|INHERITED_PRESENTATION_PLUS_M15|Fixture output matches generation presentation/selected procedure decision; explicit applicable synthetic upload retains original behavior intent|M14 real PG; M15 decision unit; human review remains NOT_RUN|
|apps/api/test/operational.test.mjs|INHERITED_COPILOT|Retain measured CASE_MEMBERSHIP first/repair enum regression; existing summary provenance regression already in checkpoint|M8 all-six; source validation; summary regression|
|apps/api/test/recommendation-v2.integration.test.mjs|INHERITED_PRESENTATION_PLUS_M15|Retain two generation-vs-history presentation regressions and nine evidence decision publication/repair/legacy checks|Real PG M14; M15-061; bounded retry; no mutation|
|apps/api/test/recommendation-v2.test.mjs|M15_ADDITION|Allow single authoritative native branch in existing injection/schema assertions; no assertion removal|M14 private context; native schema|
|apps/web/src/components/analysis-panel.tsx|INHERITED_UI|Retain correct STAFF status/polling when private job metadata is omitted|Web unit; real role workflow; polling UX|
|apps/web/src/lib/analysis-presentation.ts|INHERITED_UI|Shared pure status presentation for role-filtered AI explanation; no public contract change|Web unit; USER privacy; role/logout|
|apps/web/test/analysis-presentation.test.mjs|INHERITED_UI|Regression for STAFF role filtered job and actual status/loading/error|Web unit; role UX|
|scripts/evaluation/m14-recommendation-evaluate.mjs|M15_ADDITION|Evaluator uses actual decision/parser and publication metadata consistently; keeps V1 comparator behavior|M14 evaluation publication/identity; no evaluator softening|
|scripts/evaluation/m15-prompt.test.mjs|INHERITED_PRESENTATION_PLUS_M15|Retain grounding budget/presentation cases and red M15-061 plus T1-T14 policy tests|M15 decision/unit/deterministic061 regression|
|scripts/evaluation/m15-recommendation-evaluate.mjs|INHERITED_PRESENTATION_PLUS_M15|Runner calls owning generation guard and captures 12 source hashes; frozen data/oracle untouched|100+30 historical identity reuse; targeted061 if needed|
|scripts/evaluation/m8-copilot-evaluate.mjs|INHERITED_COPILOT|Runner already passes same allowed IDs to actual native schema; exact accepted bytes retained, datasets untouched|Accepted M8 all-six unchanged suite|
|apps/api/src/ai/recommendation-evidence-decision.ts|M15_ADDITION|Pure frozen backend sufficiency/selection policy independent of missing fields/candidates, preserves accepted M15-061 dependency|M15-061; T1-T14; publication forgery negatives|
|docs/specs/AI_BEHAVIOR_SPEC.md|INHERITED_SPEC_PLUS_M15|Retain generation-only presentation, m8.v3 membership and backend authority amendment; flag existing v2.12 default line vs actual v2.13 for explicit documentary reconciliation|Owner consistency; public contract invariants; M15 hash review|
|docs/specs/RAG_SPEC.md|M15_ADDITION|Own explicit positive applicability grammar and nearest eligible selection; avoid inferring sufficiency from titles/similarity|RAG decision policy; M15 negative fixtures|
|docs/v1.3/M24_DEMO_RUNBOOK.md|INHERITED_HISTORY_PLUS_M15|Preserve append-only October local demo/follow-up/remediation records and developer failure caveat; add new chapter only later|Historical preservation; readiness; no V1.4/production|
|docs/verification/MILESTONE_24_VERIFICATION.md|INHERITED_HISTORY_PLUS_M15|Preserve historical release acceptance and append-only later scoped executed outcomes separately|Milestone/release boundary; preservation|
|docs/v1.3/LOCAL_AI_DEMO_STABILITY_2026_10_05_VERIFICATION.md|INHERITED_HISTORY|Exact historical failed M15/developer preservation evidence must remain available and not be overwritten|Historical preservation; honest failure accounting|
|docs/v1.3/LOCAL_DEMO_2026_10_05_VERIFICATION.md|INHERITED_HISTORY|Exact initial demo recommendation/summary/indexing limitations are primary evidence|Historical preservation; diagnosis|
|docs/v1.3/evidence/LOCAL_AI_DEMO_STABILITY_2026_10_05.json|INHERITED_HISTORY|Exact sanitized prior evidence and command results preserved|Historical artifact/hash audit|
|docs/v1.3/evidence/LOCAL_DEMO_2026_10_05.json|INHERITED_HISTORY|Exact initial sanitized evidence preserved; no relabeling first failure|Historical artifact/hash audit|
|docs/v1.3/EVIDENCE_DECISION_REMEDIATION_2026_10_06_VERIFICATION.md|M15_HISTORY_ADDITION|Exact executed M15 pass and checklist first-attempt fail remain separate baseline records|M15 reuse evidence; new checklist root-cause trace|
|docs/v1.3/evidence/EVIDENCE_DECISION_REMEDIATION_2026_10_06.json|M15_HISTORY_ADDITION|Exact sanitized 100+30/source identity and operational failed audit retained|M15 reuse manifest; failure retention; hash audit|

## Remediation additions and overlapping edits

New paths relative to30baseline before finalreport generation:

- apps/api/src/ai/operational-output.ts
- apps/api/test/analysis.test.mjs
- apps/api/test/copilot-truncation.integration.test.mjs
- apps/api/test/recommendation.integration.test.mjs
- apps/web/src/components/copilot-panel.tsx
- docs/v1.3/COPILOT_CHECKLIST_TRUNCATION_DIAGNOSIS.md
- docs/v1.3/COPILOT_CHECKLIST_TRUNCATION_IMPLEMENTATION_PLAN.md

Final additions are verification, checkpointclosure and sanitized evidence. Existing operational-ai.service/prompts/copilot/operational.test owner overlap retains inherited scoped similar-case fixes while adding GEN-only bounds/source contract/validation/revision/regressions. AI_BEHAVIOR/RAG owner amendments keep accepted recommendationv2.13 and clarify v9 source-plan semantics. Runbook/M24 receive append-only currentresults. No recommendation/context/provider/config/tools/knowledge/dataset/oracle/contracts/schema/migration product change beyond already reviewed adopted delta. Other-five emittedprompt/repair/format45comparisons match old compiled owner; M15 watched12 and full130raw hash/order proof remain exact. Testmetadata-only v8→v9 literal correction has inverse-hash proof and all408API match. Web change is the single encoded citation Link and verified UI/gates.

Before publication, required by exact user instruction: retain technical/source PASS, review cumulative diff, resolve developer-preservation authority for this currentincident, record actual humanreview state, stage explicitallowlist, diffcheck/secretscan/migration/tag/main check, ordinary exactbranch commit/push and exactrefs verification. None of those publication actions is taken while blocker remains. Final dirty snapshot/hash/secret scan and sourcepreservation proofs are in `artifacts/v130-copilot-checklist-20261006/final-security-source-audit.json` and `artifacts/v130-copilot-checklist-20261006/preservation-final.json`.

## Cập nhật human review — 2026-10-07

Ghi nhận 2026-10-07 08:43:06 +07:00: **INDEPENDENT HUMAN REVIEW = PASS**, do người dùng trực tiếp xác nhận đã đọc bộ mẫu cho candidate `fix/v1.3-copilot-checklist-truncation`. Review pack SHA256 `6aeada870645217520327663a00d2756ef1cc059e7cdb7270c520bb1f8169848`; product dirty identity `bd52ba83aa7f392ca652623d402ee39e6e6bbb3804712ed0252d6bf146531730`. Người dùng chấp nhận tối đa tám bước trong phạm vi demo V1.3; không chứng nhận accuracy tổng quát hoặc production readiness. Xem [biên bản human review](COPILOT_CHECKLIST_HUMAN_REVIEW_2026_10_07.md) và [evidence](evidence/COPILOT_CHECKLIST_HUMAN_REVIEW_2026_10_07.json) cho đầy đủ tiêu chí và identity.

Các dòng NOT RUN phía trên là snapshot tại thời điểm thực thi ngày 06/10, được giữ nguyên. Trạng thái hiện tại: **COPILOT REMEDIATION PASS / HUMAN REVIEW PASS / CHECKPOINT BLOCKED**. Developer preservation **INHERITED FAIL — UNRESOLVED**; chưa có quyết định riêng cho sự cố hiện tại theo EXECUTE §12/16. Không commit/push/stage hoặc truy cập DB; source, model, config, migration và tag/main không đổi. Runtime không được kiểm tra lại trong cập nhật tài liệu này.

## Quyết định bảo toàn DB developer — 2026-10-07

Người dùng đã cho phép ngoại lệ riêng cho checkpoint Copilot hiện tại: **DEVELOPER PRESERVATION = INHERITED FAIL — ACCEPTED EXCEPTION**. Failure và các snapshot UNRESOLVED trước đó vẫn được giữ nguyên; không đổi thành PASS hoặc dùng làm bằng chứng equality/dữ liệu chưa từng thay đổi. Xem [quyết định và điều kiện](DEVELOPER_DB_PRESERVATION_EXCEPTION_2026_10_07.md).

Human review **PASS trong phạm vi mẫu**; điều kiện authorization của EXECUTE §12/16 đã được đáp ứng. Trạng thái checkpoint: **AUTHORIZED — PUBLICATION PENDING**, chờ kiểm tra source/security/readiness và commit/push/exact refs thực tế. Main, tag v1.3.0, migrations được bảo toàn; không truy cập DB developer, không production/V1.4.
