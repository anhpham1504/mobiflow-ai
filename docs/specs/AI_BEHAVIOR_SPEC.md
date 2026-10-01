# AI Behavior Specification

Authority: master-plan §§2.3, 4, M4/M6/M8 and §§23–26. Depends on [AUTHORIZATION_SPEC](AUTHORIZATION_SPEC.md), [TOOL_CALLING_SPEC](TOOL_CALLING_SPEC.md), [RAG_SPEC](RAG_SPEC.md) and [AI_SAFETY_SPEC](AI_SAFETY_SPEC.md). All output is untrusted; JSON-schema/Zod validation and referential validation run before persistence as a valid artifact.

## Permitted and prohibited behavior

Permitted: parse Vietnamese requests, detect intent, extract stated entities, classify controlled taxonomy, suggest priority, retrieve knowledge/similar cases/SLA/candidates/workload through allowlisted tools, draft checklists/recommendations, summarize persisted facts, explain deterministic SLA risk and provide concise reasonSummary.

Prohibited: approve, assign without a human-approved command, set actual priority (including URGENT), close/delete requests, delete users, change roles, bypass authorization, publish external communications, modify protected configuration, execute arbitrary SQL/shell/code, invoke unregistered tools, reveal secrets or hidden chain-of-thought. SYSTEM persistence of a validated analysis/recommendation is not permission for model-directed business updates.

## Taxonomy and interpretation (A06)

| Category | Allowed subcategories | Default team / required skill |
|---|---|---|
| NETWORK | IOT_CONNECTIVITY, MOBILE_NETWORK | NETWORK_OPERATIONS / IOT for IOT_CONNECTIVITY, NETWORK for MOBILE_NETWORK |
| IOT | DEVICE_CONFIGURATION | NETWORK_OPERATIONS / IOT |
| BILLING | BILLING_DISCREPANCY | BILLING_SUPPORT / BILLING |
| ACCOUNT | ACCESS_ISSUE | CUSTOMER_SUPPORT / ACCOUNT |
| SERVICE | ACTIVATION | SERVICE_OPERATIONS / CUSTOMER_SUPPORT |
| OTHER | INTERNAL_SUPPORT, UNSPECIFIED | CUSTOMER_SUPPORT / CUSTOMER_SUPPORT |

Intent enum: REPORT_INCIDENT, REQUEST_SERVICE, ASK_INFORMATION, UNKNOWN. A service disruption/complaint uses REPORT_INCIDENT; activation/configuration request uses REQUEST_SERVICE; an explicit question uses ASK_INFORMATION; insufficient intent uses UNKNOWN. Ambiguity uses OTHER/UNSPECIFIED with missing fields rather than an invented category. Connectivity outage involving SIMs maps NETWORK/IOT_CONNECTIVITY; device configuration without a reported connectivity outage maps IOT/DEVICE_CONFIGURATION.

Priority suggestions use LOW/MEDIUM/HIGH/URGENT. Synthetic annotation guideline: informational/non-blocking issue LOW; routine isolated problem MEDIUM; explicit multiple affected devices/users or substantial service disruption HIGH; URGENT only when text explicitly describes critical widespread/critical-service impact. Default uncertain severity MEDIUM with missing impact noted. Count alone never establishes a real major incident or actual urgency. Manager decides operational priority.

## Analysis schema v1

Strict object; reject unknown keys, coercion, prose surrounding JSON and invalid enum pairs. Required keys:

| Field | Type and validation |
|---|---|
| intent | Controlled intent enum |
| category / subcategory | Controlled compatible pair above |
| prioritySuggestion | LOW/MEDIUM/HIGH/URGENT |
| entities | Exact object: customer, location, affectedCount, startedAt |
| entities.customer / location | string 1–200 or null; only explicitly stated information |
| entities.affectedCount | Integer 1–1,000,000 or null; not inferred from plural language |
| entities.startedAt | Reported time text 1–100 or null; no inferred date/time zone |
| missingFields | Unique array from customer, location, affectedCount, startedAt, impact, description; max 6 |
| confidence | Finite number [0,1], model-reported; label as uncalibrated |
| reasonSummary | Plain text 1–1,000 characters, concise business explanation only |

For incident/location-dependent network/IoT work, missing location and startedAt must be flagged if absent. Unknown customer/count remain null; report them as missing when relevant to identifying impact. Incomplete description/impact can be flagged without adding arbitrary fields. Validation can verify syntactic null/missing consistency; evaluation/manual review must check semantic extraction. Never substitute fabricated confidence after a model failure.

Store immutable AiAnalysis with schemaVersion, promptVersion via AiRun and source request/context version. Proposed category/priority are separate from final approved Request fields. No analysis parser output becomes ORM update input directly.

## Controlled orchestration and execution bounds

1. Persist run and input snapshot references; reauthorize. Intake in NEW uses START_AI_ANALYSIS.
2. Entity extraction and classification can share one fixed structured call. Validate before TRIAGED.
3. In TRIAGED, fixed recommendation pipeline reads knowledge, similar requests, policy, candidates and workloads; all mandatory lookups must succeed. Use no open-ended model action loop.
4. Supply bounded evidence and allowed IDs to one recommendation synthesis call; validate schema, source membership, candidate IDs, policy, counts and missing-data flags.
5. Atomically publish PENDING recommendation and transition SUBMIT_FOR_APPROVAL. No automatic assignment.

Initial configuration: one active generation per request/purpose, one LLM generation at a time per local API worker, provider deadline 120 seconds per attempt, at most 2 attempts total (initial + one repair/transient retry) within a 300-second run deadline. Use one-second backoff for retryable transport failure; no retry on authorization, unknown tool or known model absence. Bound input context to 24,000 characters, structured output to 32 KiB; reject overflow, never truncate JSON silently. Embedding call deadline 30 seconds, at most 2 attempts within caller deadline. Values are engineering defaults to validate on local hardware; timeouts are failures, not success metrics.

User-supplied request text, messages and SOPs are delimited data. System prompt fixes taxonomy, missing-value behavior, output schema and allowed IDs. Store versioned templates in future `apps/api/src/ai/prompts/`; default telemetry stores versions and safe metadata, not full prompt/response transcripts. Adapter discards provider reasoning fields before logging/storage. Host base URL comes from validated server config only.

Context assembly is deterministic and records omissions: include full required structured facts, the original request, relevant approved/resolution facts and complete selected source chunks; then newest relevant history events that fit, returned chronologically. Do not split source IDs/JSON or silently trim required facts to meet 24,000 characters. If mandatory inputs do not fit, fail CONTEXT_TOO_LARGE with manual work still available; optional history has an explicit truncated flag. The model may describe only supplied events. Post-start intake uses the resulting request version; stale output cleanup follows REQUEST_STATE_MACHINE so later messages survive and the request cannot remain stuck AI_ANALYZING.

## Recommendation schema v1

M14 adds a separate `recommendation.v2` contract; this section continues to own V1 history/execution. New default synthesis uses prompt `grounded-recommendation.v2.10` and strict shared V2 schema. Canonical short `reasoningSummary` maps to existing `reasonSummary` naming. See [M14 plan](../v1.2/M14_RECOMMENDATION_V2_IMPLEMENTATION_PLAN.md): summary/classification/recommendedAction/evidence/warnings/missingInformation/suggestedChecklist; no confidence. Classification category/subcategory matches validated analysis, priority matches retrieved policy. Every evidence reference belongs to captured request/SOP/historical context and every excerpt is a real contiguous substring. Current request evidence is mandatory; each procedure source also has knowledge evidence. Missing fields/questions exactly cover analysis, with bounded impact text and grounded warning. Zero/insufficient SOP means empty procedural sources/checklist; historical cases cannot establish procedure truth. Native generation uses draft-7 tuples for required facts/warnings and tighter text/collection bounds within the public contract to fit the unchanged 1,200-token budget; backend validation remains authoritative.

V2 is synthesized only in TRIAGED under current eligibility. START_WORK and REQUEST_USER_INFO describe future steps after explicit human prerequisite actions; RESOLVE fails closed without completion prerequisites. Canonical SLA warnings require the supplied actual state (no AI clock math); conflicting approved category/subcategory/location requires actual snapshot contradiction; weak evidence is procedural insufficiency. Stale is computed live. Two attempts, existing 120s attempt/300s run deadline, 24k context and 32KiB output bounds remain. Reparse at publication/read/review; unknown schema or invalid stored JSON is unavailable, never raw response. Provider thinking is excluded and no hidden reasoning stored. Versioned V1 templates remain available for history and same-model comparison. V2 agreement does not execute the plan, and exact missing-field acknowledgment is required on accept/modify.

| Field | Type and invariant |
|---|---|
| suggestedPriority | Priority enum; suggestion only |
| suggestedTeamId / suggestedStaffId | UUID or null; non-null must be in successful current candidate tool output and staff belongs to suggested team |
| suggestedSlaMinutes | Positive integer or null; equals retrieved policy target for analysis category/suggested priority; null only when no policy returned |
| procedureSources | Array max 5 of `{sourceId}` present in this run's retrieval snapshot |
| actions | Array max 30 of `{text,sourceIds}`; text 1–500; every procedural action references 1–5 retrieved source IDs |
| similarCaseAlert | `{detected:boolean,count:integer}` exactly matching bounded distinct tool results; not a global incident claim |
| confidence / reasonSummary | Same bounds/labeling as analysis |
| evidenceStatus | SUFFICIENT or INSUFFICIENT_EVIDENCE, backend-verified |

Source title/page/section/score come from backend metadata, never the LLM. `actions` refines the master-plan string examples with per-step source IDs so grounding can be checked. Every referenced source must be READY/current/authorized at publication and at approval.

No knowledge results: procedureSources=[] and actions=[], evidenceStatus=INSUFFICIENT_EVIDENCE; explain the lack of evidence. This may reach manager review, but AI Accept is disabled. Manager may Modify with explicitly human-authored actions and a reason, or Reject/manual triage. No eligible staff or missing SLA policy likewise disables Accept; no invented ID/target. A failed lookup is an error, not an empty successful result; do not publish a normal recommendation with hidden failed mandatory tools.

All IDs validated against captured output; mismatch rejects the artifact and uses the bounded repair policy. Actual similar count is the number of distinct returned visible cases after limits, displayed as “up to N matching cases in this window” when results are capped. No claim about total cases unless a separate authorized count was computed; V1 has no such count tool.

### M15 structured warning coverage amendment

The retained M15 ten-case preflight omitted `SLA_AT_RISK` on a supplied canonical AT_RISK snapshot and `CONFLICTING_EVIDENCE` on approved metadata differing from analysis (the short explanation did mention the conflict). Prompt `grounded-recommendation.v2.5` and its native format now require the supported canonical SLA warning and, where a second supplied evidence reference exists, the conflict warning with both actual references. The native evidence tuple retains that referenced source even in an insufficient-procedure branch. Without a second source, the prompt requires the conflict/uncertainty to be stated in concise narrative rather than inventing a reference. Public schema, parser, action vocabulary, product generation state, deadlines/tokens/retries, protected decisions and review semantics are unchanged. This improves coverage of existing grounded warning fields; it introduces no AI capability or SLA calculation. M15 records defect → minimal fix → affected live and product regression reruns.

Independent review of the retained, interrupted v2.5 run found unsupported causal assertions in cases 002/009 and action text omitting explicit human prerequisites. Version `grounded-recommendation.v2.6` directs summaries to describe supplied symptoms and to distinguish proposed investigation from a verified cause. Native action text requires the prefix `Sau khi quản lý phê duyệt và phân công, `; the remaining text describes the future staff step, with work started before requesting information. Checklists describe sourced procedural work rather than commands to invent or change request states. These are presentation constraints inside the existing advisory contract; stored historical V2 parsing/review and human approval semantics are unchanged. The evaluator adds two explicitly labeled unverified-cause probes; it does not claim exhaustive diagnosis detection.

The v2.6 smoke misrepresented the total policy SLA target as remaining time and declared disputed approved metadata wrong. Version v2.7 used state-only canonical warning text and a neutral conflict warning. Its retained smoke still selected START_WORK in a labeled missing-information case and resolved the conflict implicitly in narrative. Version v2.8 binds conflict summary/reason to neutral supplied-disagreement text and selects REQUEST_USER_INFO when validated analysis has missing fields. Its native action prefix explicitly includes staff starting work before REQUEST_USER_INFO. Other eligible cases retain the existing action choices. No output calculates a new SLA deadline; canonical state and backend clock remain authoritative. These constraints address observed outputs, preserve the public schema and historical parser, and add no business execution.

M15's retained v2.8 full attempt was interrupted after 39 completed cases: 025/030/031 exhausted both attempts at the unchanged 1,200-token bound; 026 used a customer ID as an omitted device ID in its checklist; 032/033 confused lack of retrieved SOP with an incident cause. Final Recommendation V2 prompt/native format v2.9 uses shorter presentation fields, required missing/insufficient warning text, neutral insufficient-evidence narrative and empty checklists while validated facts remain missing. Otherwise procedural checklists contain at most three sourced steps. Customer/location values retain their own entity roles; absent SOP is a grounding limitation, never a diagnosed cause. These are generation constraints within the unchanged public contract and human workflow. The evaluator records role substitutions and no-source causal assertions separately; later full results must use the frozen revised source and declared oracle.

The v2.9 full attempt was interrupted after 20 completed cases when 009 again invented a system-error cause despite valid structured output and explicit instructions. Final v2.10 native sufficient-source narrative quotes the supplied request title as attributed data and uses a concise advisory rationale; conflict/insufficient branches retain their neutral texts. This is a generation constraint against observed unsupported diagnosis, not evidence of unconstrained model diagnostic accuracy. Questions, actions and sourced checklist proposals remain generated, advisory and separately validated. Public fields, parser, historical suggestions and review semantics are unchanged. Evaluation oracle v5 preserves attributed multi-sentence/escaped quotes as data while still rejecting commands outside the quote; negative controls prevent this precision correction from authorizing actual execution.

## Copilot action contracts

Actor: assigned STAFF; states ASSIGNED/IN_PROGRESS/WAITING_USER/RESOLVED. Input `{action,expectedVersion}`; request ID from route and identity from session. No freeform tool prompt or client-supplied context. Output envelope includes action, aiRunId, schemaVersion, generatedAt, evidenceStatus and typed result. Human must explicitly save any draft; suggestions never mark checklist tasks complete.

| Action | Context and allowed tools | Result schema |
|---|---|---|
| SUMMARIZE_REQUEST | Own assigned request, authorized history; getRequestHistory | `{summary:string<=2000,eventIds:UUID[]<=50}`; event IDs supplied by backend |
| FIND_SOP | Assigned facts; searchKnowledge | `{sources:Source[]<=5}`; DB metadata and excerpts only |
| SUGGEST_NEXT_STEP | Assigned facts/checklist/history and SOP; searchKnowledge, getRequestHistory | `{steps:GroundedAction[]<=5}`; empty with insufficient-basis message if unsupported |
| GENERATE_CHECKLIST | Approved plan and permitted SOP; searchKnowledge, getRequestHistory | `{items:GroundedAction[]<=30}`; no completion flags |
| FIND_SIMILAR_REQUESTS | Assigned request; findSimilarRequests | `{cases:SimilarCase[]<=5}` filtered to STAFF scope, no global count |
| EXPLAIN_CLASSIFICATION | Stored analysis and original text only | `{reasonSummary:string<=1000,analysisId:UUID}` or insufficient-data response if manually triaged |

Insufficient-data response has evidenceStatus=INSUFFICIENT_EVIDENCE, empty result collection/null analysisId as appropriate and a backend-defined message. Textual summary/explanation never implies sourced procedures when none were retrieved.

## Resolution summary

SYSTEM schedules one run per persisted resolution event after RESOLVE commits. Input contains only authorized request facts, timestamps, analysis, assignment, work/checklist events and submitted rootCause/resolution/verification. Schema: `{executiveSummary:string<=2000,timeline:[{eventId,summary<=500}]<=50,rootCause,resolution,verification,resolutionSeconds}`. Root fields are copied from staff facts; resolutionSeconds is computed by backend as wall-clock seconds from request creation to this resolution (SLA active seconds are separately labeled), never model arithmetic; event IDs map to real events in chronological order. Missing facts remain null and do not manufacture success. On reopen, old summary is labeled prior resolution and its unfinished job is canceled; new RESOLVE gets a new event/run. Summary can finish after CLOSED only if tied to the unchanged resolution event; discard if that event is no longer the latest effective resolution. Model failure leaves human facts accessible and allows an authorized retry without changing state.

## Audit, failure and acceptance

Record AiRun purpose/provider/model/promptVersion/schemaVersion/context version, start/end/latency, attempt count, validity, status and safe error. Tool calls and retrieval snapshot IDs are linked. Invalid output stays FAILED and is never shown as an approved result. Conflict after a call becomes stale/failed telemetry; no business commit.

Tests: every enum/schema boundary, null/missing fields, invented IDs/sources/counts, unknown tools, timeout/cancel/recovery, output size, duplicate runs, no preapproval side effects, factual summaries and restricted Copilot context. M4 uses at least 50 labeled cases; M5 20–30 retrieval queries; M9 minimum 100 valid labeled cases plus live measurements. No model/quality result has been measured in M0.
