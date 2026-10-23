# Tool Calling Specification

V1.3 lexical amendment (2026-10-23): the six-tool allowlist, schemas, permission checks, call budget and read-only behavior are unchanged. In `RAG_RETRIEVAL_MODE=lexical`, `searchKnowledge` and `findSimilarRequests` use current local PostgreSQL lexical results and the `postgresql-lexical-v1` identity; they do not require or create RequestEmbedding rows. Similar-request score keeps the existing 0.60 retrieval + 0.20 category + 0.10 location + 0.10 recency composition, but the retrieval component is bounded FTS/trigram relevance rather than cosine similarity. Scope is still applied before ranking and the wording remains “possible related cases.” The vector paragraphs below own only the explicit rollback profile.

Authority: master-plan §4.3, M6, §25–26. Runtime tools are internal backend functions, not public arbitrary invocation endpoints. Depends on [AUTHORIZATION_SPEC](AUTHORIZATION_SPEC.md), [RAG_SPEC](RAG_SPEC.md) and [AI_BEHAVIOR_SPEC](AI_BEHAVIOR_SPEC.md).

## Registry contract

Exactly six mandatory tools are allowlisted below. Optional `buildChecklistDraft` is deferred; GENERATE_CHECKLIST is a fixed Copilot action using source retrieval and structured generation, not an implicit seventh tool. No shell, filesystem browsing, arbitrary HTTP, raw SQL, delete, assign, approve, role/config change or notification-publishing tool.

Each registry entry defines a strict input/output schema, permission/purpose, timeout, maximum count/bytes, audit and failure mapper. Call context is server-derived `{actorId?,actorType,purpose,requestId,requestVersion,aiRunId,deadline,scope}`. Model input cannot override context. Unknown keys, malformed IDs or out-of-range values fail before execution; no dynamic function lookup by arbitrary name.

## Tool inventory

| Tool | Purpose | Input schema | Output schema | Permission | Max results | Timeout |
|---|---|---|---|---|---:|---:|
| searchKnowledge | Retrieve actual SOP evidence | `{query:string[1..2000],topK?:int[1..5]=5}` | `{sources:Source[],indexModel:string,indexGeneration:string}` | Recommendation service; assigned STAFF Copilot FIND_SOP/SUGGEST_NEXT_STEP/GENERATE_CHECKLIST | 5 chunks | 30s |
| findSimilarRequests | Retrieve permitted similar cases | `{requestId:UUID,timeWindow?:int[1..10080]=30,limit?:int[1..5]=5}` (minutes) | `{cases:SimilarCase[],windowMinutes,returnedCount,truncated}` | Recommendation service organization scope; assigned STAFF Copilot FIND_SIMILAR_REQUESTS with assigned-only candidates | 5 cases | 30s |
| getSlaPolicy | Lookup authoritative SLA | `{category:Category,priority:Priority}` | `{policy:{id,version,category,priority,targetMinutes}\|null}` | Recommendation service only | 1 policy | 5s |
| getCandidateStaff | Filter and rank assignable workers | `{team:UUID,skills:SkillCode[]}` (1..5 unique skill codes) | `{candidates:Candidate[],scoringVersion}` | Recommendation service only; team/skills must match backend taxonomy map | 10 staff | 5s |
| getStaffWorkload | Current bounded worker counts | `{staffIds:UUID[]}` (1..10 unique) | `{workloads:[{staffId,activeCount}]}` | Recommendation service only; IDs subset of candidate output in same run | 10 staff | 5s |
| getRequestHistory | Read scoped chronological facts | `{requestId:UUID}` | `{events:HistoryEvent[],truncated:boolean}` | Recommendation service bound request; assigned STAFF Copilot SUMMARIZE_REQUEST/SUGGEST_NEXT_STEP/GENERATE_CHECKLIST | Latest 50 events, returned oldest-first | 5s |

Default response maximum 32 KiB per tool; excerpts are bounded by RAG_SPEC. `requestId` must equal bound context, never arbitrary peer history. `Source` = stable sourceId/chunkId/documentId/generation/title/pageNumber?/section?/excerpt/score. `SimilarCase` = requestId/publicCode/title/status/category/location?/createdAt/scoreComponents (authorized projections only). `Candidate` = staffId/displayName/teamId/skillCodes/activeWorkload/score/scoreComponents. `HistoryEvent` = id/type/actorType/timestamp/safe factual payload. Reject invalid output rather than trusting database/tool wrappers implicitly. Overflow returns bounded output with explicit truncated flag where defined; never invent omitted content.

## Permission enforcement and errors

1. Verify registered name and purpose before touching data.
2. Validate input and enforce actor/resource scope using current DB identity/assignment.
3. Query with server-derived scope and parameters. Each output ID is checked against scope before it reaches the model.
4. Validate and size-limit output; persist sanitized AiToolCall metadata (including result IDs/counts, no secrets/raw prompts).
5. Reauthorize final artifact delivery/publication, especially if reassigned while a model call ran.

Every invocation records start/end/latency, status, safe input and bounded output summary. Tool telemetry is independent of successful business transactions so denied/failed calls remain observable. Error envelope: `{code,retryable,safeMessage}` with INVALID_INPUT, FORBIDDEN, UNKNOWN_TOOL, TIMEOUT, UNAVAILABLE, INVALID_OUTPUT or STALE_CONTEXT. An empty success is distinct from error. No fallback to a more privileged tool; no unchecked retry. Registry invocation budget: at most 8 calls for one recommendation (normally six; two additional policy lookups allowed for a changed suggested priority) and 3 for one Copilot action, each also bounded by the run deadline. Execution order and allowed calls are backend-defined, not model-discovered.

## Staff eligibility and ranking (A12)

Hard filters: active account with STAFF role; active target team and active membership; `available=true`; required skill set is a subset of StaffSkill; required V1 access (target active team membership) exists. No eligible candidate yields an empty result; manager review must select a valid worker before assignment. Availability is seeded/configured in V1, not a new scheduling product.

Active workload counts requests where currentAssigneeId=staffId and status in ASSIGNED/IN_PROGRESS/WAITING_USER. RESOLVED and terminal work do not count. Define skillMatch=matchedRequiredSkills/requiredSkillsCount (hard filter makes this 1 for eligible staff), workloadScore=1/(1+activeWorkload), finalScore=(60*skillMatch+25*workloadScore)/85. Sort score descending, workload ascending, staffId lexical ascending. Persist score version and components. No invented historical experience; the optional 15% experience component is absent and the remaining weights are normalized. Tied candidates are not presented as meaningfully different in expertise.

getStaffWorkload provides a timestamped recheck of selected candidates, not another ranking algorithm. A changed workload updates the final snapshot/scoring before synthesis; assignment still rechecks hard eligibility, not a requirement that the same staff rank first. Manager may modify to any currently eligible worker via authorized directory lookup, preserving why the original recommendation changed.

M6 implementation detail: workload output adds `asOf` (UTC ISO timestamp). When candidate output is empty, do not invent an invalid empty staffIds invocation: persist an explicit empty workload snapshot and five successful calls. Otherwise all six lookups are mandatory. History includes scoped status events and conversation messages, omits whole oldest optional events to a 6,000-character context allocation, and reports `truncated=true`; no message body or source is logged in tool telemetry.

## Similarity rule

Use RequestEmbedding compatible with the active embedding identity and permission-filtered candidates. Candidate window is `[now-timeWindow,now]` on createdAt, excluding self and CANCELED; no future timestamps. Missing embedding excludes a case rather than pretending a score. Cosine similarity mapped to v=clamp((cosine+1)/2,0,1); category consistency c=1 for equal non-null approved/suggested category (use approved when present), else 0; location l=1 for equal known strings normalized by NFC, trim, collapsed whitespace and lowercase, else 0; recency r=1-age/window. Score=0.60*v+0.20*c+0.10*l+0.10*r. Initial candidate cutoff v>=0.70 is a tunable engineering default, to validate at M6; it is not a semantic correctness claim. Sort score descending, createdAt descending, ID ascending and return up to limit.

Filter scope before vector query/ranking/counting. STAFF sees only its currently assigned cases, including terminal history; model cannot infer organization totals. `returnedCount` equals distinct returned rows and truncated reports if additional eligible matches existed. Text says possible related cases, never declares a major incident as fact. Demo seed can include actual synthetic recent requests so the tool returns real rows; no hard-coded count.

## Acceptance

M6 tests each tool's schemas, purpose/scope restrictions, timeouts/limits, unknown name, exact counts, candidate scoring/ties/ineligibility, parameterized queries and safe audits. Cross-user/staff privacy tests include counts and excerpts, not merely detail endpoints. Recommendation tests reject IDs outside the captured tool output and prove tools cannot mutate business state. Live similarity/retrieval behavior is evaluated separately from deterministic tool-wrapper tests.
