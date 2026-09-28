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
