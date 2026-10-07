# V1.3 local demo runbook

Use a deliberately selected synthetic target. This runbook does not authorize migrating/resetting a normal developer database. The executed M24 test resources were isolated and removed; historical evidence remains in [verification](M24_RELEASE_HARDENING_VERIFICATION.md). Production deployment NOT RUN.

## Prerequisites and fresh synthetic target

Windows with Docker Desktop Linux containers, Node24.19.x/npm11.x and installed Edge for browser tests. Existing images use pgvector/pgvector:0.8.6-pg17. Prepare network-dependent packages/images before an offline demo. Host Ollama is required only for a live AI demonstration; verify actual installed model/digest/dimension rather than downloading or changing a model automatically. Six synthetic accounts are listed in [local accounts](../demo/LOCAL_DEMO_ACCOUNTS.md).

In a fresh checkout/dedicated env, run `npm ci` and `npm run env:setup -- unconfigured` for a manual/degraded demo. Privately review generated `.env`; distinct owner/runtime/JWT/refresh credentials are required. Choose an unused Compose project name, fresh PostgreSQL/knowledge volumes and loopback host ports. Set POSTGRES_PORT, API_PORT, WEB_PORT, WEB_ORIGIN and NEXT_PUBLIC_API_BASE_URL consistently; DATABASE_URL/MIGRATION_DATABASE_URL must address that exact synthetic host database with separate roles. Set DEMO_MODE=true only for this verified synthetic target. Keep RAG=false and truthful unconfigured model values for manual mode. Never print or commit credentials.

Review `docker compose config --quiet` using the selected private env/project before startup. Then, in that same deliberately configured environment:

```powershell
npm run build:foundation
npm run prisma:generate
docker compose up -d --wait postgres
npm run db:validate
npm run db:migrate
npm run demo:seed
docker compose up -d --build --wait api web
docker compose ps
```

The current repository contains13 migrations. Verify the actual target and13 successful rows before showing the application. Seed is idempotent; it preserves existing synthetic requests and V1.3 data. It is not reset. If Windows policy blocks native argon2, use the provided isolated Linux verification runner or a deliberately configured Linux execution environment; do not weaken host security. The M24 rehearsal used Linux Node24.19.0 for compilation/real-auth tests and the transient seed process.

For an intentional V1.2 upgrade, back up and verify the chosen target first. Apply existing migrations8–13 with owner credentials; never edit old migrations or replace this with a latest-schema-only mock. M24 verified actual v1.2.0 schema/data followed by successive migrations, preserving original rows and checksums. The normal developer target observed during M24 remains at7 migrations; this is separate from the release rehearsal and requires a deliberate future operator upgrade.

## Demo path and human controls

1. USER (`user@mobiflow.local`) logs in, opens dashboard/list, creates a synthetic connectivity request and checks public history/conversation. No internal notes, templates, routing internals or operational notices are visible.
2. MANAGER (`manager@mobiflow.local`) opens the request. Create or select a checklist template and inspect routing evaluation. NO_MATCH/CONFLICT retain manual choice. Apply a template/routing match only into the editable local draft; verify no assignment or active checklist exists yet.
3. MANAGER chooses category/priority/team/staff and human-reviewed steps, saves the draft, submits approval, then explicitly approves/assigns with the current version. Only that business command activates assignment/SLA/checklist.
4. STAFF (`staff.iot@mobiflow.local`) opens authorized work. Add an internal note and select an allowed manager mention; toggle personal watch. Show manager mention/watch dedup and the USER's public-only view. Reassignment revokes the previous staff member's internal Request/notice access.
5. STAFF previews a RESPONSE template, applies it into the draft, edits it and explicitly sends. USER sees the final message, not template metadata. An archived source at adoption requires the documented conflict/manual fallback.
6. MANAGER demonstrates template revision/archive history and rule lifecycle; neither operation performs hidden business decisions. Open analytics and current SLA. In a synthetic request with genuine elapsed SLA, open STAFF/MANAGER notifications and inspect the persisted operational snapshot. Do not edit normal database clock rows for a presentation.
7. Each role saves and applies its own Request filters. Show dirty/explicit save, replace/reset/back navigation, confirmation and private ownership. Manager-only assignee filter never gives USER/STAFF more access.

## Health, recovery and shutdown

`/health/live` is process liveness. `/health/ready` distinguishes coreReady and aiReady. Optional Ollama unavailable permits core200/DEGRADED with aiReady=false; manual workflows remain available, and AI errors must be described truthfully. Do not present deterministic fixtures or M15 historical evaluation as live responses. A live AI demonstration requires actual verified model/embedding runtime, sources and targeted readiness; no automatic model download/change.

A temporary DB outage should produce ready503/coreReady=false and safe authenticated503 while liveness remains200. Restore the chosen database and retry; the M24 actual container outage/restart passed without reset. API/Web restarts preserve manual data. M22 persists scan progress/events; changed cadence/ratio does not open a new lifetime or duplicate recipients. See [all7 SLA settings](M24_CONFIGURATION_REFERENCE.md).

Stop only the explicitly selected demo project with `docker compose stop` (same env/project arguments). Retain its volumes unless their owner/identity is verified and deletion is specifically appropriate. Never use a generic down-with-volumes against a normal developer project. M24 verification cleanup asserts its own labels/IDs before removal; caches/images and ignored evidence may remain. Backup/restore disaster recovery and production deployment were not exercised.

## Recorded M24 rehearsal, not a generic reset recipe

Verification project `mobiflow-m24-verification` used PostgreSQL55424/HTTP33024; production project `mobiflow-m24-release` used55425/33601/33600 with private generated env files. `m24-runtime.mjs start`, `m24-linux.mjs prepare/sync/run/collect`, and `m24-release.mjs prepare/build/database/start` implement the guarded setup. Initial runner prerequisites were git/OpenSSL/CA certificates plus `npm ci --no-audit --no-fund`; build must precede the transient production seed. Actual gate commands, failures and fixes are recorded in verification. The final audit intentionally expects the historical M23 pre-commit HEAD; do not reset a released checkout to satisfy it. A later rehearsal needs a new declared baseline and evidence directory, preserving these accepted reports.

## Later local operator rehearsal — 5 October 2026

The user-authorized [v1.3.0 local demo verification](LOCAL_DEMO_2026_10_05_VERIFICATION.md) uses a new `mobiflow-v130-demo-20261005` project, PostgreSQL55426/API33701/Web33700 and private ignored env/evidence. All13 migrations, real host Ollama/RAG and a full synthetic Request to CLOSED were executed. Developer volume/container/env/tag preservation was verified. Current infrastructure is READY; the report retains failed AI generation, summary-fidelity and recovered indexing limitations, so full AI quality is not closed PASS. This record does not replace historical M24 evidence or authorize V1.4/production deployment.

## Local AI stability follow-up — 5–6 October 2026

[New verification](LOCAL_AI_DEMO_STABILITY_2026_10_05_VERIFICATION.md) and [sanitized evidence](evidence/LOCAL_AI_DEMO_STABILITY_2026_10_05.json) retain all results above. Recommendation v2.12 adds guards for measured free-form causal/presentation defects after the retained 87-case interruption; generation guard preserves legacy read/review. Latest separate demo: runtime READY, five complete synthetic role workflows PASS, M8 Summary/Copilot PASS, full M15 FAIL (1 semantic violations). Overall FAIL: bảo toàn DB developer chưa chứng minh được và full M15 quality gate FAIL. The later developer discrepancy is not covered by the earlier documented exception or certified logically unchanged. Independent human review NOT_RUN; tag/main unchanged; source uncommitted; no new publication, V1.4 or production.


## RAG evidence decision remediation — 6 October 2026

[New executed report](EVIDENCE_DECISION_REMEDIATION_2026_10_06_VERIFICATION.md) and [sanitized evidence](evidence/EVIDENCE_DECISION_REMEDIATION_2026_10_06.json) preserve all historical results above. Recommendation v2.13 moves procedural sufficiency/selection to a deterministic backend owner, with generation and transactional publication validation; missing fields/candidates/SLA remain separate. Red regression was demonstrated first; T1–T14, 247 units, 50 scoped real-PG Node tests and API/Web build PASS. A first full run was interrupted at 100+2 and remains NOT_COMPLETED; a separate full ordered replay passes 100 evaluation +30 consistency/130 first-attempt calls, zero execution/validation/retry/semantic failures, unchanged dataset/oracle/model/embedding/config/source hashes. M8 Summary/Copilot evaluations PASS; five actual automated role workflows PASS functionally. Actual workflow AI first-attempt stability FAIL:24/25 first-attempt successes, one GENERATE_CHECKLIST truncation repaired,26 provider attempts,zero terminal failures. No selective retry or source change; Copilot/provider owners are unchanged from the task baseline. Current runtime core/AI/RAG READY, 13 migrations, 49/49 current request vectors/zero duplicates. Overall FAIL: Copilot first-attempt stability and developer preservation remain FAIL, human review NOT_RUN; native-pattern language enforcement has a disclosed limitation. No developer DB access/new exception, commit/push/main/tag change, V1.4 or production. Local demo container/runtime restoration after observed host reboot retained existing IDs/images/data. This report does not replace release acceptance.


## 2026-10-06 — Copilot checklist truncation remediation (local candidate)

Executed 2026-10-06 22:09:28 GMT+7 +07:00. Candidate branch fix/v1.3-copilot-checklist-truncation atbaseline b3f39f6b858ef32b2aafef07ea99b1ab254ba583, uncommitted. Native20/20first + acceptedM8 8/8 + fresh5workflows29/29first;0retry/truncation/terminal in finalprotocol. Static265unit/57PG/35affectedM15 and8browser checksPASS. FinalCore/AI/RAGREADY:9docs/12chunks/62currentvectors,13migrations. Failed/superseded evaluations and two interrupted batches retained; they are not promoted to PASS. See [checklist verification](../v1.3/COPILOT_CHECKLIST_TRUNCATION_VERIFICATION.md) / [closure](../v1.3/COPILOT_CHECKLIST_TRUNCATION_CHECKPOINT_CLOSURE.md).

Developer preservation remains INHERITED FAIL — UNRESOLVED; developeraccessNONE. IndependenthumanreviewNOT_RUN; checkpointBLOCKED beforecommit/push under user§12/16. Main/tagv1.3.0 unchanged; productionNOT_RUN/V1.4NOT_STARTED. Runtime process exits still have UNKNOWN cause; accepted process-only profile restored with hidden detached launcher and explicit proof, not a general availabilityclaim. Historical content above is retained verbatim.

## Cập nhật human review — 2026-10-07

Ghi nhận 2026-10-07 08:43:06 +07:00: **INDEPENDENT HUMAN REVIEW = PASS**, do người dùng trực tiếp xác nhận đã đọc bộ mẫu cho candidate `fix/v1.3-copilot-checklist-truncation`. Review pack SHA256 `6aeada870645217520327663a00d2756ef1cc059e7cdb7270c520bb1f8169848`; product dirty identity `bd52ba83aa7f392ca652623d402ee39e6e6bbb3804712ed0252d6bf146531730`. Người dùng chấp nhận tối đa tám bước trong phạm vi demo V1.3; không chứng nhận accuracy tổng quát hoặc production readiness. Xem [biên bản human review](COPILOT_CHECKLIST_HUMAN_REVIEW_2026_10_07.md) và [evidence](evidence/COPILOT_CHECKLIST_HUMAN_REVIEW_2026_10_07.json) cho đầy đủ tiêu chí và identity.

Các dòng NOT RUN phía trên là snapshot tại thời điểm thực thi ngày 06/10, được giữ nguyên. Trạng thái hiện tại: **COPILOT REMEDIATION PASS / HUMAN REVIEW PASS / CHECKPOINT BLOCKED**. Developer preservation **INHERITED FAIL — UNRESOLVED**; chưa có quyết định riêng cho sự cố hiện tại theo EXECUTE §12/16. Không commit/push/stage hoặc truy cập DB; source, model, config, migration và tag/main không đổi. Runtime không được kiểm tra lại trong cập nhật tài liệu này.

## Quyết định bảo toàn DB developer — 2026-10-07

Người dùng đã cho phép ngoại lệ riêng cho checkpoint Copilot hiện tại: **DEVELOPER PRESERVATION = INHERITED FAIL — ACCEPTED EXCEPTION**. Failure và các snapshot UNRESOLVED trước đó vẫn được giữ nguyên; không đổi thành PASS hoặc dùng làm bằng chứng equality/dữ liệu chưa từng thay đổi. Xem [quyết định và điều kiện](DEVELOPER_DB_PRESERVATION_EXCEPTION_2026_10_07.md).

Human review **PASS trong phạm vi mẫu**; điều kiện authorization của EXECUTE §12/16 đã được đáp ứng. Trạng thái checkpoint: **AUTHORIZED — PUBLICATION PENDING**, chờ kiểm tra source/security/readiness và commit/push/exact refs thực tế. Main, tag v1.3.0, migrations được bảo toàn; không truy cập DB developer, không production/V1.4.
