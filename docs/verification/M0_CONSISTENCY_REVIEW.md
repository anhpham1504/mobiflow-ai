# M0 Cross-Document Consistency Review

Review date: 2026-09-28. Scope: all 25 required M0 documents against the complete master plan and the explicit M0-only request. This is a design/contract review, not an executed application/security audit. Automated document checks supplement, not replace, this review.

## Requirement traceability

| Master-plan requirement | Owning artifacts and cross-check |
|---|---|
| §§1–2 frozen product, three roles, all non-goals | PROJECT_SPEC, AUTHORIZATION_SPEC, AGENTS; AI/SYSTEM remain internal/audit actors |
| §2.2/§6 complete state machine | REQUEST_STATE_MACHINE 10 states/20 explicit edges; BUSINESS_WORKFLOW/API/UI all use the same commands |
| M3 independent manual lifecycle + M7 human approval | NEW→TRIAGED→PENDING_APPROVAL→ASSIGNED with explicit manager action, no fabricated AI record; ADR 0005 |
| §3 fixed stack/local host deployment | ARCHITECTURE and ADRs 0001–0003; npm/Next/Nest/Prisma/PostgreSQL+pgvector/Ollama; no framework initialized |
| §§4/23 controlled, validated, no hidden reasoning | AI_BEHAVIOR_SPEC, AI_ARCHITECTURE, AI_SAFETY_SPEC, TOOL_CALLING_SPEC; bounded runs and real evidence |
| §§5/9 storage/security/ownership/audit | DATABASE_SPEC, AUTHORIZATION_SPEC, API_SPEC; FKs/constraints/versioned transactions/projections/session revocation |
| §§7–8 transport and screens | API_SPEC and UI_SPEC cover every minimum route/group plus minimal routes required by documented commands |
| M5/§24 real RAG sources and embedding identity | RAG_SPEC, DATABASE_SPEC, ADR 0002; immutable generation IDs, no guessed pages or dimension |
| M6/§25–26 similarity/candidates/tools | TOOL_CALLING_SPEC fixed six tools, concrete scoring/filter/bounds, scope-filtered counts; no historical-score invention |
| M7/M8 protected decisions/work/summary/feedback | BUSINESS_WORKFLOW, REQUEST_STATE_MACHINE, API/UI, DATABASE_SPEC; original AI and human final values separate |
| M3/M8/§27 SLA | SLA_SPEC owns exact clock, holds/breach/risk; API, DB and UI reference it; no AI clock authority |
| §28 in-app notifications | BUSINESS_WORKFLOW recipient table; DB dedupe; API own-recipient access; no external messages |
| M2/M4/M5/M9/M10/§29 synthetic data/evaluation | DEMO_DATA_SPEC and TEST_STRATEGY; precise counts/labels/metric denominators and actual-run evidence |
| §§11–22/33–46 milestone gates/competition package | IMPLEMENTATION_PLAN maps every gate and final artifact; M0 stops before M1 despite generic master continuation language |
| §34 verification template | MILESTONE_0_VERIFICATION includes all required headings and honest NOT RUN runtime checks |

## Resolved ambiguities and consistency findings

The assumption register A01–A17 in PROJECT_SPEC is normative for the deliberately unspecified details. Values are labeled implementation/demo defaults, not newly claimed enterprise requirements.

| Topic | Resolution / consistency obligation |
|---|---|
| NETWORK versus IOT examples | Canonical outage NETWORK/IOT_CONNECTIVITY; IOT/DEVICE_CONFIGURATION for non-outage device setup; same taxonomy in AI/API/seed/evaluation |
| Manual assignment versus mandatory approval | Manual draft and explicit pending approval; assignment remains manager-only through one transaction |
| Reject and resubmit | Reject returns TRIAGED, original retained; new manual draft or recommendation required |
| Cancel “eligible non-final” | Explicit four owner and seven manager states; no cancel from RESOLVED/terminal states; invalidate late jobs/reviews |
| Reopen and SLA confirmation time | Same SLA budget; WAITING_USER and RESOLVED holds excluded; reassignment never resets; historical breach sticky |
| Internal service scope versus STAFF privacy | Manager-review service may read bounded V1 context; requester/staff projections and Copilot scope prevent cached peer leakage |
| Invalidated PENDING recommendations | Keep original four review statuses; invalidatedAt/current pointer determine actionability; no fabricated rejection metric |
| Model configuration examples | No tags/dimensions asserted as installed; later local probe and migration required |
| Optional entities/features | RequestAttachment is reserved; no required request attachment route; PDF/TXT ingestion required, DOCX deferred |
| Early script surface versus later evaluator | M1 actual checks run; later command entrypoints fail honestly until their milestone; M10 all commands genuinely run |
| Empty versus failed lookup | Empty evidence is explicit insufficient-basis review; mandatory tool failure fails the run, never fake zero-result success |
| Source membership versus semantic grounding | IDs/generations verified mechanically; manager review and live labeled tests address semantic relevance; no claim ID checks alone prevent all hallucination |
| Historical demo rows versus live AI | Synthetic operational history labeled; current outputs and evaluation measured from actual local runs |

## Review status

Completed against all authored M0 documents and the original 3,975-line master plan. No unresolved business/security/scope contradiction remains after the following corrections:

| Finding during review | Correction made |
|---|---|
| Intake output becomes stale after a message; requiring its old version for failure cleanup could leave AI_ANALYZING stuck | Added activeAnalysisRunId, post-start contextVersion and locked-current-version cleanup for the same active run; late output cannot overwrite messages or another state |
| Reopen could leave an obsolete summary occupying the active-run slot | Clear currentResolutionId and cancel prior active summary job atomically; preserve historical artifacts; CLOSED completion still allowed for unchanged resolution |
| Owner could not poll automatically SYSTEM-scheduled intake under initiator-only wording | Defined run-read permission by purpose and current resource scope; owner sees safe intake status |
| A full cached manager reason could leak peer evidence to STAFF | Staff receives scoped facts/new explanation; original manager reasoning/peer counts stay restricted; human-approved action plan is explicit publication |
| Generic same-checks wording could block an allowed human modification of insufficient/stale evidence | Revalidate retained citations only; manager may replace unsupported actions with explicitly human-authored plan/reason; Accept remains strict |
| Terminal-state wording omitted the required safe summary retry | Added an artifact-only RESOLVED/CLOSED permission, no state or human-fact mutation |
| Repeated SLA fractional rounding could diverge across pauses | Normalize clock boundaries to integer UTC seconds before arithmetic; worked cases checked independently |
| Context could exceed bounds without an omission policy | Required complete facts/source chunks; optional history selection records truncation; required overflow fails safely |
| Unescaped union separators broke two Markdown table rows | Escaped cell separators and added table-shape assertions to the checker |

## Scenario walkthroughs

Manually followed each path through the state table, actor matrix, endpoint DTO, persistence effects, SLA, notifications and UI: manual happy path with AI unavailable; AI happy path; invalid intake/cleanup/retry; missing facts; no-source review; reject/manual resubmit; two managers approving; cancel during analysis; reassignment and former-staff denial; wait/reply; resolution summary failure; owner reopen with old-summary cancellation; confirm and one feedback. All have explicit authorized actions and failure behavior without a bypass or invented AI record.

SLA worked examples were also checked with six PowerShell arithmetic assertions: initial due/elapsed, reopen due/remaining, equality at deadline, one-second breach, 20% threshold and priority-reduction overrun. Result PASS; this verifies documented arithmetic, not a running SLA implementation.

## Limits of this review

Static structure checks and manual design review cannot prove semantic LLM grounding, runtime transaction isolation, accessibility, security or performance. Those remain executable gates in M1–M10. Known future local validations (versions, models, dimensions and measurements) are explicit and have milestone owners. They are not unresolved M0 business decisions. Final M0 evidence and exact command results are recorded in MILESTONE_0_VERIFICATION.md.
