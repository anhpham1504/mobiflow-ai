# MobiFlow AI v1.3.0 release

Theme: **Operational Collaboration & Workflow Productivity**. Release preparation4 October2026 Asia/Saigon. User-confirmed M24 execution authorizes automatic checkpoint and final Git release; production deployment is **NOT RUN**, V1.4 **NOT STARTED**. Independent external/human review **NOT RUN**; technical self-review **PASS**.

## Verified hardening and release identity

M24 hardening checkpoint **CLOSED** at `c50d8d84378502d3d3654f8d7fd07f2371065351`. Ordinary push and live verification at `2026-10-04T07:01:11.554Z` confirmed local/remote `feat/v1.3-release-hardening` equal that SHA, CLEAN,84 reviewed blobs and179 tested product/config/migration blobs equal committed content. [Publication evidence](../v1.3/evidence/M24_CHECKPOINT_PUBLICATION.json) is that historical checkpoint observation. Its docs-only release-preparation child may become the final branch tip; it does not invalidate the closed ancestor.

Final release identity: **`v1.3.0^{}`**. This document is prepared before tag publication and intentionally contains no invented self-SHA. **RELEASED** is established only when live local/remote main and peeled v1.3.0 all equal the verified candidate, annotated tag objects match, the release branch is synchronized, old tag objects/peeled commits remain unchanged and main has a CLEAN working tree. Final handoff/post-publication evidence records actual candidate/tag object IDs. A prepared document alone does not prove publication.

Baseline v1.2.0/main: `31b445caf07dad606601a1e38e8ed39836d9f825`. Accepted sequential checkpoints M18–M23 were verified before M24; source M23: `4735afafe7cda4dbf98bdd387cc2fd49db22f764`. Main must fast-forward only through that chain and the hardening/docs commits. No force, rebase, retag or branch-protection bypass. Atomic `main` + exact `refs/tags/v1.3.0` push is preferred; ambiguous results require reading refs before retry.

## Accepted content

| Milestone | Released behavior |
|---|---|
| M18 Internal Notes | Private manager/current-staff notes, explicit human create, no USER/AI leakage |
| M19 Mentions + Watchers | Allowed scoped mentions, personal watch, current-recipient deduplicated notifications |
| M20 Templates | Versioned response/checklist libraries, editable local drafts and historical provenance, explicit send/business approval |
| M21 Routing | Manager rules, read-only MATCH/NO_MATCH/CONFLICT and human-form prefill |
| M22 SLA operations | Bounded fair reminders/escalations with durable dedup; M12 remains SLA authority |
| M23 Saved Views | Private owner/versioned filters,50/account, strict canonical scope-safe queries and URL behavior |
| M24 Hardening | Seven existing SLA config passthroughs; integrated real install/upgrade/runtime/recovery/security/browser evidence; release docs |

Exactly USER/STAFF/MANAGER remain login roles. AI/SYSTEM are internal actors. AI cannot approve, assign, close, delete, change roles or execute arbitrary tools. Template/routing/SLA features do not perform hidden protected actions. API remains REST `/api/v1`; M24 changes no endpoint, contract, app TypeScript, schema, migration or dependency. The existing Dockerfile/lockfile are unchanged. See [full inventory](../v1.3/M24_RELEASE_INVENTORY.md) for checkpoint hashes and owners.

## Actual gates and data

Lint/typecheck/217 current unit tests/explicit production build **PASS**. Original Dockerfile API/Web images and actual isolated production runtime **PASS**. Real fresh13-migration install and actual v1.2.0 schema7→8→9→10→11→12→13 with original-row/checksum preservation and current three-role app startup **PASS**. M24 adds0 migrations; all13 historical migrations remain unchanged. Normal developer PostgreSQL remains7 migrations, without migrate/reset/reseed.

Five real HTTP/PostgreSQL integrated tests **PASS**, covering explicit human transitions, stale409, RBAC/IDOR/private projections, strict transport/rate/session guards, cross-feature notifications and deterministic AI context isolation. Four production Microsoft Edge browser tests **PASS**,28 responsive/Axe scans at360/768/1440/1920,0 serious/critical and no horizontal overflow. Keyboard/dialog/focus checks pass; no other browser/WCAG certification claimed.

Actual API/Web restart, temporary PostgreSQL outage/restore and scheduler restart **PASS**: readiness503/coreReady=false and safe API503 during DB outage, live200, authenticated core recovery. Five fixture alerts/10 recipients remain unchanged through at least5 persisted scans after restart, with batch2 across7 active rows. Populated repeat seed preserves all15 inspected table populations including templates/rules/views/alerts/history. Packaging runtime controls,13 migration hashes, actual secret scan including25 production JS bundles and owned-resource cleanup **PASS**.

[Source coverage](../v1.3/evidence/M24_SOURCE_COVERAGE.json) binds179 product/config/migration files to14 gate captures. [Final audit](../v1.3/evidence/M24_FINAL.json) covers84 reviewed entries plus two self-report records,256 frozen historical records, scoped cleanup and released ports. The hardening commit contains86 files. The release-preparation child changes documentation only; source must continue matching these tested blobs. [Detailed verification](../v1.3/M24_RELEASE_HARDENING_VERIFICATION.md) records exact commands, retained failed iterations/corrections, performance sample scope and all limits.

## Runtime and AI limits

NestJS/Next App Router/npm workspaces, PostgreSQL17+pgvector, Node24.19.0 and Windows-host optional Ollama remain the stack. Actual API/Web containers are non-root/read-only/drop-all/no-new-privileges with resource bounds and loopback ports. Seven existing M22 SLA settings are documented in [configuration](../v1.3/M24_CONFIGURATION_REFERENCE.md); defaults and human-control semantics are unchanged.

M24 deliberately verified optional Ollama unavailable: **DEGRADED**, **coreReady=true**, **aiReady=false**, RAG disabled and model labels unconfigured. Core manual release is permitted by the existing optional-provider contract; AI READY is not claimed.61 AI/evaluation owner files match V1.2; M15 hashes and all six actions are preserved. Historical M15 synthetic100 cases+30 consistency runs, accepted model digests, prompt/schema and dataset identity remain historical evidence. Deterministic M24 captures exclude private V1.3 canaries; no live model evaluation/download/change was performed.

Use [the V1.3 demo runbook](../v1.3/M24_DEMO_RUNBOOK.md) for deliberate synthetic startup, role workflow, health/recovery and shutdown. All M24 runtime projects/volumes were removed and five test ports released. Docker engine startup auto-resumed the normal developer PostgreSQL before baseline capture; developer API/Web stayed stopped and subsequent container IDs/start times/ports and7 migration checksums were preserved. Images/cache/ignored local evidence may remain.

Known limits: synthetic local evidence is not production accuracy or an enterprise SLO; no penetration test, full WCAG certification, full DR rehearsal or production deployment. Routing is advisory/prefill; templates are drafts; SLA events are historical operational snapshots; saved views are private/capped with fixed ordering. Optional AI latency/availability is host-dependent. Independent human review and unrelated historical replay **NOT RUN**. Required technical blockers **0**; publication blockers must be reported from actual refs if any occur. After verified Git release, **STOP**.
