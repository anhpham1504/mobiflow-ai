# AI Behavior Specification

Authority: master-plan §§2.3, 4, M4/M6/M8 and §§23–26. Depends on [AUTHORIZATION_SPEC](AUTHORIZATION_SPEC.md), [TOOL_CALLING_SPEC](TOOL_CALLING_SPEC.md), [RAG_SPEC](RAG_SPEC.md) and [AI_SAFETY_SPEC](AI_SAFETY_SPEC.md). All output is untrusted; JSON-schema/Zod validation and referential validation run before persistence as a valid artifact.

## Active V1.3 generation-provider amendment (2026-10-23)

`AI_GENERATION_PROVIDER=deepseek` is the candidate default for analysis, recommendation, all six Copilot actions and resolution summary. The NestJS backend alone calls the official HTTPS origin with configured model `DEEPSEEK_MODEL`; browser code never receives the key or selects a provider. Requests use JSON-object mode plus a trusted schema instruction, temperature 0, bounded context/output, one concurrent call, bounded retry and the existing run/publication idempotency. Response envelopes, finish reason, returned model, JSON shape, source IDs and domain references are untrusted and validated before publication. Reasoning fields are discarded.

`AI_LIVE_CALLS_ENABLED=false` is the safe default and fails before HTTP. Enabling live calls additionally requires a backend-only key, official origin, maximum three calls per process, two starts per minute, one concurrent request and an application budget no greater than USD 0.25. Prompt/completion/cache token usage, the returned model and estimated cost under the dated configured price table are persisted as safe model identity metadata. The application guard is conservative but is not a provider-side hard spending cap. Authentication, balance, rate, provider, timeout, cancellation, truncated/empty/invalid JSON and unexpected-model failures are typed; only retryable failures receive the already bounded retry.

The adapter redacts common email, phone and token patterns before egress and receives only the minimum authorized context. Private notes, credentials, cookies, audit internals and unrelated requests remain excluded by context builders. No real customer data may be sent. A missing key, disabled live mode or provider outage leaves manual business workflow intact and reports truthful degraded health; it never silently falls back to Ollama. The historical Ollama bounds below remain applicable to the explicit rollback profile.

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

M14 adds a separate `recommendation.v2` contract; this section continues to own V1 history/execution. Current default synthesis uses prompt `grounded-recommendation.v2.13` for the accepted V1.3 evidence-decision repair and the strict shared V2 schema; v2.12 remains a historical presentation iteration below. Canonical short `reasoningSummary` maps to existing `reasonSummary` naming. See [M14 plan](../v1.2/M14_RECOMMENDATION_V2_IMPLEMENTATION_PLAN.md): summary/classification/recommendedAction/evidence/warnings/missingInformation/suggestedChecklist; no confidence. Classification category/subcategory matches validated analysis, priority matches retrieved policy. Every evidence reference belongs to captured request/SOP/historical context and every excerpt is a real contiguous substring. Current request evidence is mandatory; each procedure source also has knowledge evidence. Missing fields/questions exactly cover analysis, with bounded impact text and grounded warning. Zero/insufficient SOP means empty procedural sources/checklist; historical cases cannot establish procedure truth. Native generation uses draft-7 tuples for required facts/warnings and tighter text/collection bounds within the public contract to fit the unchanged 1,200-token budget; backend validation remains authoritative.

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

The authorized V1.3 local stability repair uses Recommendation V2 generation prompt/native format v2.11. Each native sufficient branch binds one selected SOP set (one or two sources), its required KNOWLEDGE evidence and the checklist source-ID enum together. This closes the measured `ACTION_SOURCE_NOT_IN_PROCEDURE` generation/validation mismatch; it does not weaken the unchanged public parser or current-source checks. Existing model identity, 1,200 output tokens, attempt/run deadlines, advisory review and manual business approval remain authoritative. Historical v2.10 artifacts are retained.

The retained local v2.11 evaluation was interrupted after 87 completed cases. Direct output inspection found M15-075 relevance asserting a cause from untrusted HTML absent from the source, M15-001 malformed relevance text and M15-016/031 incomplete missing-field prose despite the existing oracle accepting them. Generation v2.12 binds relevance to neutral REQUEST/KNOWLEDGE/HISTORICAL_REQUEST provenance labels and missing-field questions/impacts to complete, bounded sentences for the exact validated missing fields. The generation parser independently rejects noncanonical labels/questions before publication, and the live evaluator invokes the same guard. Historical public V2 parsing/read/review stays unchanged; old suggestions are preserved. Actions and sourced checklist proposals remain generated and advisory. This closes measured presentation/factuality gaps without increasing tokens/deadlines or weakening validation; it is not evidence of unrestricted semantic quality. The frozen M15 dataset and existing semantic oracle remain unchanged.

## Copilot action contracts

V1.3 checklist truncation remediation (6 October 2026): public and historical
draft bounds remain30items/text500/1–5citations. Only new GENERATE_CHECKLIST
generation uses prompt `copilot.checklist.m8.v9` and stricter internal same-shape
bounds: message160, at most8 distinct steps, text120 and1–2unique sources per
step (prefer one directly supporting source). The source drafting amendment below
binds complete source sentences/citation pairs in the native format;
no sources permits zeroitems. The same owning schema validates parsed generation
and mapped publication; excessive items/text are rejected, never sliced.
Eight preserves the longest current synthetic IoT SOP's distinct obligations:
confirmed impact/count/location/time, SIM registration, approvedAPN comparison,
gateway link, approval before change/reboot, conditional escalation with confirmed
time/place, post-work device-to-gateway check and USERconfirmation. Shorter SOPs
need fewer steps. Ordered applicable actions must preserve safeguards/missing
facts and remain future staff proposals, never execution/completion claims.
Unrelated-domain warnings are not procedural steps. Source membership remains an
independent guard; semantic grounding is separately evaluated. Other five action
prompts/formats, shared provider/options, public schema and human adoption stay
unchanged; output1200/attempt120000ms/run300000ms/max2 remain authoritative.
Character bounds are not a mathematical token guarantee across languages.

Documentary clarification: the earlier default recommendation prompt text
`grounded-recommendation.v2.12` describes a historical iteration. The retained
M15 evidence-decision implementation/report executes `grounded-recommendation.v2.13`;
this checklist remediation does not change that recommendation owner.

The V1.3 local stability follow-up measured `CASE_MEMBERSHIP` on both live attempts of FIND_SIMILAR_REQUESTS. Generation prompt m8.v3 binds native caseIds to the same STAFF-authorized retrieved ID set; no result permits only an empty caseIds array. The public copilot.m8.v2 schema, six actions and backend publication/permission validators remain unchanged. Failed attempts remain recorded. Summary generation continues to use the existing m8.v5 owner and actor provenance checks.

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

For the authorized V1.3 stability repair, generation prompt `resolution-summary.m8.v5` retains public schema `resolution-summary.m8.v3` and the existing 800-character/eight-event model presentation bounds. The summary owner supplies an executive text attributed to the STAFF resolution and exact factual labels paired with allowlisted public audit events. Each staff field is quoted whole if it fits within the executive bound; all three rootCause/resolution/verification fields are copied verbatim into the persisted public summary regardless of their inclusion in the executive text. No partial field becomes an inferred claim. Negation and simulation labels remain part of the quoted facts.

`OperationalAiService.executeSummary` selects the latest 50 SUCCEEDED, allowlisted public audit events for that request at or before the persisted resolution time, ordered by createdAt/id descending and then reversed for chronology. Events after that resolution and private collaboration/AI-review metadata are excluded. The projection supplies eventId, action, actorType and timestamp without raw audit payloads or internal-note text. The fact owner checks action/actor compatibility where the action defines an actor, valid nondecreasing timestamps and unique event IDs; inconsistent input fails with `SUMMARY_FACTS_INCONSISTENT`, and a projection without public events fails with `SUMMARY_FACTS_UNAVAILABLE`. MESSAGE facts name USER, STAFF or MANAGER only when that actor is supplied; no actor is inferred from text or sequence. Production always supplies persisted actorType; historical deterministic fixtures without actor metadata retain an action-level label.

The model selects at most eight supplied events. Both native format and backend validation require the exact supplied executive text, event/text pairing and strictly increasing selected-event order. COMPLETE_AI_ANALYSIS records advisory classification/priority, never verified root cause; REQUEST_USER_INFO and USER_PROVIDE_INFO describe exchanges without inferring an SLA result. Timeline timestamps are copied by the backend. Normal RESOLVE and explicit retry use the same prompt-version constant; queue metadata must match the generation owner. Persisted historical summaries are preserved, not silently rewritten. Passing these constrained generation checks is not evidence of unconstrained semantic summary accuracy or an actual human review.

## Audit, failure and acceptance

Record AiRun purpose/provider/model/promptVersion/schemaVersion/context version, start/end/latency, attempt count, validity, status and safe error. Tool calls and retrieval snapshot IDs are linked. Invalid output stays FAILED and is never shown as an approved result. Conflict after a call becomes stale/failed telemetry; no business commit.

Tests: every enum/schema boundary, null/missing fields, invented IDs/sources/counts, unknown tools, timeout/cancel/recovery, output size, duplicate runs, no preapproval side effects, factual summaries and restricted Copilot context. M4 uses at least 50 labeled cases; M5 20–30 retrieval queries; M9 minimum 100 valid labeled cases plus live measurements. No model/quality result has been measured in M0.
# V1.3 local recommendation ownership amendment

For new Recommendation V2 runs, backend policy owns evidenceStatus, eligible/selected procedure IDs, the canonical missing-field set and allowed main-action scope. The provider receives this authoritative decision and cannot select an alternative insufficient/sufficient native branch. `SUFFICIENT` requires the selected eligible procedure, its exact KNOWLEDGE evidence and checklist membership. `INSUFFICIENT_EVIDENCE` requires no procedures/checklist and the corresponding warning. Missing information requires MISSING_INFORMATION and REQUEST_USER_INFO without changing sufficiency when a relevant procedure exists. Candidate/SLA availability remain separate existing policies.

Generation and repair preserve one decision; mismatch is a bounded repairable validation failure, never publication success. Publication independently compares the snapshot decision with backend policy under the current configured retrieval bound, then validates the output before any artifact invalidation/insertion. Legacy persisted V1/V2 read and advisory review continue to use their existing public parser, without retroactive generation constraints. All existing schema/reference/currentness/RBAC/privacy/human-control rules remain in force. Procedural qualification and its conservative grammar are owned by RAG_SPEC.
## Source contract drafting amendment, 2026-10-06

The failed v4–v7 prompt iterations are retained in the checklist remediation evidence. The final action-specific prompt is `copilot.checklist.m8.v9`; internal contract is `checklist.source-actions.v2`. The public `copilot.m8.v2` shape and 30-item historical/public reading bound remain unchanged. Other five action prompts/formats do not change.

Source sentence duplicate identity uses NFC, Vietnamese case folding and normalized whitespace while preserving diacritics. Distinct accented instructions cannot be merged. A recognized operational sentence that also contains classification/priority/protected-decision policy fails closed as unsupported context rather than silently losing its operational clause. Only a standalone negative human-control boundary with no operational clause is omitted from draft items; human-control rules remain mandatory.

For GENERATE_CHECKLIST, the owning operational-output module selects at most one procedure with a positive canonical category/subcategory declaration in the actual authorized retrieved excerpts. The current approved request classification is authoritative. Titles and request text do not establish applicability. Conflicting positive declarations exclude a document. Scope propagates only to supplied sibling chunks with the same document UUID and generation encoded by validated source IDs. Source membership/current retrieval/authorization remain existing backend predicates.

Draft text consists of complete operational instruction sentences from that procedure, with whitespace normalized before generation. The selection keeps conditional clauses, required intake labels, prerequisites, escalation details and after-treatment checks. Classification, priority, inferred-cause and autonomous decision policy statements remain outside checklist items; system and human-control rules continue independently. Duplicate source sentences are merged without repeating an item, retaining one actual supporting citation. No request value, test ID or fixture template is embedded in this contract.

Generation's native draft-7 schema binds the complete ordered item tuple, each source/text pair and the draft/insufficient-data message to these source facts. Backend validation independently requires the same complete tuple after strict JSON parsing and source-membership validation. Missing, reordered, paraphrased or swapped-citation steps fail, with existing bounded repair/audit behavior. No post-generation string/item truncation or JSON repair is introduced.

The internal bounds remain eight items, 120 characters per instruction, 160 per message and at most two source IDs per item; source drafting uses one sufficient ID per sentence. A complete instruction exceeding the field bound, a procedure exceeding eight instructions or more than one independently applicable procedure is unsupported and fails closed for human planning. No positively scoped procedure yields an empty insufficient-data draft. This conservative declaration/sentence grammar is not a general natural-language applicability or exhaustive SOP-completeness claim. Long or differently authored SOPs need explicit follow-up contract review; no budget/validation is silently relaxed.
