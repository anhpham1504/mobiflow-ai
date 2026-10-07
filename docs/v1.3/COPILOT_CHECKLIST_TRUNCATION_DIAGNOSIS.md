# Copilot checklist truncation diagnosis

Scope: V1.3, 6 October 2026, Asia/Saigon. Plan preceded product edits. Exact cumulative adoption table: [reviewed path/origin/rationale/gate audit](../../artifacts/v130-copilot-checklist-20261006/delta-audit.md); all30 individually reviewed/adopted with matching hashes, no unsafe overlap. Old checkout remains preserved.

## Actual historical run

Run `2220a738-2d57-4307-be8e-f13037bac231`; synthetic request `05258ad9-7ed2-44a4-b06c-4c4af37a0bbb` / MF-2026-000038; GENERATE_CHECKLIST/context7. Started07:08:37.904Z, failure audit07:08:58.112Z, finished07:09:10.504Z on6October. Total32602ms, retryCount1, final repair input12902characters/output1902bytes, promptcopilot.m8.v3/schemacopilot.m8.v2. These worker timestamps do not measure provider-only attempt durations.

Provider envelope was parsed; `done_reason=length` was rejected by the existing adapter as AI_INVALID_OUTPUT/TRUNCATED_GENERATION before application parser or public validation. Provider-unavailable/timeout/parser/schema errors are different categories and are not this retained first error. Original first raw, exact tokens, schema/input hash, per-attempt provider duration and host load: **NOT AVAILABLE**. Exact original generated contents remain unknown. Repair feedback from unchanged owner: `TRUNCATED_GENERATION: Return a shorter JSON object and stay within every array/string bound.` Repair uses the same format/context/allowed references plus the failed raw/feedback; no options increase.

Retained valid second output has10items,12refs to5sources, message88characters and actions57–90characters(mean68.4). It repeats intake/APN/postchecks and includes unrelated MOBILE/FIBER distinctions. These observations concern the repaired output only. Actual sources are IoT intake C0, IoT check/escalation C1, FAQ APN, mobile procedure and an explicitly unrelated fiber document. Actual safe tool trace is searchKnowledge/getRequestHistory, both READ_ONLY; protected status/version/checklist remained unchanged during Copilot. Source IDs/titles/excerpts and full raw synthetic output remain in ignored artifacts.

Copilot/provider owners matched the M15 remediation starting bytes. Causality from M15-061 patch: NOT PROVEN.

## New pre-fix execution evidence

Frozen three diagnosis fixtures before inference: full reconstructed near-workflow context, repeated long input, missing location/time. The reconstruction uses actual authorized source/history IDs and public facts, excludes private notes and is explicitly not claimed byte-identical to the lost original prompt (historical full SLA shape unavailable). Original adapter/prompt/parser source identities were recorded. No manual or selective rerun; one first invocation for each fixture.

| Fixture | Outcome | Prompt tokens | Generated tokens | Provider wall ms | Residency before | Relevant output observation |
|---|---|---:|---:|---:|---|---|
| PRE-FULL-WORKFLOW | AI_INVALID_OUTPUT/TRUNCATED_GENERATION; length |3587|1200| recorded in transport; invocation57129 | cold, observed | JSON cut inside source ID;15 text fields and22 source-ID occurrences |
| PRE-REPEATED | normal stop, syntactically valid |4588|1109| recorded in transport; invocation56102 | warm, observed |13items, close to fixed1200budget |
| PRE-MISSING | normal stop, syntactically valid |3548|860| recorded in transport; invocation37074 | warm, observed |10items |

Provider counts are actual Ollama metadata, not estimates from characters. First full call load5425.066ms/prompt1327.086ms/eval50264.61ms; this is a bounded diagnostic observation, not an SLO or causal performance comparison. Transport raw and metadata are append-only `prefix-transport.jsonl`; all three outcomes retained in `prefix-live.json`. One prior setup query used a nonexistent table and failed before any inference inside READ ONLY; corrected to existing AiAnalysis owner and retained in operator notes.

**Evidence-backed defect:** the checklist generation contract reused generous public limits (30items,500characters/action,1000message,1–5full source IDs/item) without a procedural completeness/compactness bound aligned with the frozen output budget. In the fresh near-workflow run it expanded to at least15textfields/22references until1200tokens cut JSON; adjacent variants produced13/10items. Input3587–4588tokens is below16384; no context-limit/timeout/provider-envelope bug observed. The broad contract permits this expansion and repeated source overhead. Exact token contribution of schema, individual fields or each citation is NOT AVAILABLE; no claim that char caps mathematically guarantee a token count in every language. Exact lost original content remains unknown.

## Sixteen hypotheses

| # | Hypothesis | Finding |
|---|---|---|
|1|Input too long|No hard-context overflow: observed3587/4588/3548prompttokens vs16384; original exactinput unavailable. Input content can influence output; no isolated causal input-length claim.|
|2|Verbose native schema|Format is public-shaped with broad limits; format chars/hash recorded. Schema-only token overhead NOT AVAILABLE; no extra field requirement explains15items.|
|3|Prompt demands repetition|No explicit repetition requirement. Old rule says short/max30 and lacks distinct ordered applicable-step guidance; fresh expansion and retained repair repetition support compactness defect.|
|4|Too many items|Confirmed fresh15textfields before cut; adjacent13/10items. Native allows30; longest applicable current SOP needs eight distinct obligations.|
|5|Long/many fields|Only text/sourceIds required peritem, no fabricated required fields; max500 permits verbose text. Actual complete item lengths/refs retained privately.|
|6|Repeated citations|Confirmed22source-ID occurrences in cut response; long IDs repeat peritem. Keep mandatory citations but prefer one supporting source, at most two when genuinely needed.|
|7|Reasoning/prose|Fresh content begins JSON and ends inside a cited ID; think=false on wire. No observed prose cause; original NOT AVAILABLE. Provider reasoning is discarded, never persisted as evidence.|
|8|No maxItems/maxLength|Disproved: limits exist, but generous30/500/1000/5. Need narrower action-specific generation limits at native/parser/publication.|
|9|Continues after complete JSON|Fresh cut response is incomplete, so no evidence of post-JSON continuation. No stop change justified.|
|10|Incorrect stop handling|No stopsequence sent; adapter correctly rejects length including apparently complete JSON. No stopbug evidence.|
|11|Wrong num_predict|Actual wire1200, temp0/seed42/ctx16384; adapter passes accepted config exactly. No arithmetic bug.|
|12|Action options absent|Same accepted shared options intentional. Fix contract above provider, not token/timeout options.|
|13|Repair format/context differs|Same copilotFormat/allowed/base context by source; added raw/feedback increases repair input only. Deterministic regression will assert bothattempt formats identical.|
|14|Concurrent host load causes output|Original load telemetry unavailable; response latency alone cannot establish this. No load causal claim; fresh observed token exhaustion establishes independent output mechanism.|
|15|Complete JSON but length metadata|Fresh failing JSON incomplete. Deterministic completeJSON+length fixture must remain rejected.|
|16|One fixture or input class|New3variants expose expansion15+/13/10; one length failure. Post-fix protocol fiveclasses×4 tests bounded class behavior, not general production reliability.|

## Candidate rationale, recorded before edit

Use existing owners only: same-shape checklist generation schema with max8items/message160/action120/sourceRefs1–2, preferably one per atomic step; enumerate permitted retrieved IDs natively and zeroitems with no sources. Public contracts retain30items/500characters/1–5refs and historical stored result reading is unchanged. Parser and mapping use the same tighter generation schema; no slicing, partialJSON acceptance, brace repair, timeout/token increase or stopsequence.

Canonical synthetic corpus is `scripts/demo/create-knowledge.py` (3PDF/6TXT). Longest applicable IoT procedure has eight distinct obligations: collect/confirm impact/count/location/time; SIM network state; approvedAPN comparison; gatewaylink; approval before change/reboot; conditional escalation with confirmedtime/place; post-work device→gateway transmission check; USERconfirmation. Other current SOPs are shorter. Cap8 retains these obligations while removing redundant/irrelevant steps, not lowering completeness. Prompt explicitly preserves order, missing facts, approval prerequisite, conditional/post-work status and USERcontrol; exclude unrelated domains as action authority. Semantics are separately evaluated, not established by source membership alone.

Red budget regressions demonstrate old parser accepted9generateditems and121charactertext:0PASS/2FAIL before candidate product edits. Exact command/log retained. Tight bounds/native enum and compact prompt are the smallest action-specific changes; shared adapter/options/recommendation/context/source guards remain untouched. New live manifest must be frozen before candidate results; any observed candidate failure stays in evidence and blocks PASS until a declared corrected iteration and affected gates run.

Developer preservation: **INHERITED FAIL — UNRESOLVED**; no developer access/reinspection. Independent human review NOT RUN. Git commit/push checkpoint remains BLOCKED; main/tag/production/V1.4 unchanged.

## Executed candidate diagnosis and final owner correction

All declared five-fixture batches kept the same fixture bytes/hash `8548162877df77273fe8111b22d8b69649984dd30803ddae9544611ae4c7407c`, fixed `checklist.iot.semantic.v1` oracle and frozen provider settings. No threshold was altered after results. Prompt-only native constraints removed truncation but did not establish checklist quality:

| Iteration / prompt | First attempts / retries / length | Semantic result | Retained findings |
|---|---|---|---|
|1 / v4|20/20, 0, 0|0/20 PASS|152 findings, including20 source-role violations|
|2 / v5|20/20, 0, 0|0/20 PASS|48 findings, including8 source-role violations|
|3 / v6|20/20, 0, 0|0/20 PASS|104 findings, including33 source-role violations|
|4 / v7|20/20, 0, 0|0/20 PASS|84 findings, including52 source-role violations|
|5 / v8|20/20, 0, 0|20/20 supplemental only|Coverage FAIL: runner sent generic format while manifest hashed context-native format; disqualified for native closure|
|6 / v8|20/20, 0, 0|20/20 actual native PASS|Each actual wire hash matched the frozen2929-character context-native format; historical source coverage only|
|7 / v9|20/20, 0, 0|20/20 actual native PASS|Final source/compiled identity; no parser/validation/source/privacy/semantic/protected-mutation finding|

Observed prompt-only failures included omitted intake labels/conditions, incorrect source roles and wording ending midword at native maxLength. Field/cardinality bounds alone were therefore insufficient. The existing operational-output owner now derives a short draft from complete operational sentences in authorized retrieved excerpts. Only a positively declared current canonical category/subcategory selects a procedure; supplied sibling chunks inherit scope only within the same document UUID/generation. Complete text, conditions, order and actual text/citation pairs are constrained in native generation and independently validated before publication. Unsupported multiple procedures, excessive steps or overlong complete sentences fail closed. No output slicing, partial JSON or invented obligation fills the gap. This conservative grammar is documented at AI_BEHAVIOR_SPEC and RAG_SPEC, not claimed to be exhaustive semantic entailment.

Final read-only owner review reproduced two additional v8 source-plan defects on iteration6's exact compiled owner. Accent-stripping duplicate identity merged distinct `số hóa đơn` and `sổ hóa đơn` instructions. A decision-policy substring filter also skipped an entire complete operational sentence containing a classification prerequisite. v9 uses a shared NFC/Vietnamese case/whitespace duplicate key that preserves diacritics, and rejects mixed operational/decision clauses rather than silently losing a procedure. Two actual-case regression tests cover retention, true duplicate merging, mixed-clause rejection and preservation of the standalone human-control boundary. Internal source contract is `checklist.source-actions.v2`; GENERATE_CHECKLIST prompt metadata is `copilot.checklist.m8.v9`. These are action-specific owner changes; public schema, provider/stop/options, recommendation/context/source permission owners and other five emitted action identities remain unchanged.

Final iteration7 source identity is `2125f8014cbe8960e2b3e0ade3056dc2b9175aecbb9254537311067812d861e8`; compiled API identity is `dea9c0bb7d8081ae96f22347e3d6d8a498909361521beb15c371eb46d53c6a1e` across408 artifacts. Actual20 calls produced491–588 output tokens /3420–5139 prompt tokens and7 items/7 citations, maximum text106characters. Separate native-format token overhead remains NOT AVAILABLE. Invocation latency min/median/max7980/9320/14886ms. Observed residency was1cold/19warm; cold provider wall14852ms, warm wall min/median/max7960/9248/11145ms. Residency is read before the call, not inferred from latency. One cold observation is not a reliability estimate; no SLO/p95/general-accuracy claim.

Independent human review remains NOT RUN. All initial live, failed semantic iterations, disqualified iteration5, historical iteration6 and operator/setup failures remain in Git-ignored evidence; none is rewritten as final PASS.
