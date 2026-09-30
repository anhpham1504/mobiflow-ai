# Controlled V1 release evaluation protocol

Version `release-evaluation.v1`, frozen on 2026-09-30 before this continuation's live diagnostics or full evaluation. Baseline: M10 snapshot `584bd984b1769065479c5904a42bd6cb06411b85`; branch `fix/m10-evaluation-stability`. The runner stores this file's SHA-256 before making a model call. Changes after measurement invalidate the protocol identity; results are never selected by desirability.

## Authority and decision

PROJECT_SPEC, AI_BEHAVIOR_SPEC and TEST_STRATEGY remain authoritative. All 100 original labels, order, production prompts, schemas, settings, validation and retries are frozen. No application behavior or production API change is planned. Exact synthetic agreement is not generalized accuracy or semantic truth.

The unchanged M9 `compareEvaluation` and CLI remain the release gate: any pass-to-fail, schema/reference regression, increased attempt count, new failure classification or individual latency strictly greater than 1.5 times the approved M9 observation is RED. Fail-to-pass and aggregate latency are reported separately and do not cancel flags. Comparison must cover exactly the same 100 unique IDs and dataset hash; missing metadata must never become a zero or a PASS.

The 1.5 ratio originates in M9 implementation, not a statistical confidence bound or master-plan performance target. Historical runs have one observation per case and no warm/cold strata, per-call digest, provider timings or contemporaneous hardware identity. Existing cold/warm evidence (5502/2237 ms for unchanged normal-01) demonstrates that load state alone can cross the boundary. This is a measurement attribution defect, not proof that the historical 83 flags were harmless. No alternative aggregate threshold is authorized by this protocol. The old RED runs remain immutable and independently visible.

## Identity and environment

Before and after each measurement batch, capture sanitized timestamp, OS/version/architecture, CPU/cores, physical/available RAM, GPU/driver/VRAM/use/utilization/clocks/temperature, Node/npm/Ollama versions, selected model tag/digest, embedding tag/digest, loaded models, Git HEAD/branch/dirty state and content hashes. Record active Windows power plan, power-mode availability and AC/battery state where safely obtainable. Unsupported readings are explicitly unavailable. Do not change power plans, model files, GPU options or runtime settings to chase speed.

No usernames, computer names, serial numbers, raw command lines, absolute private paths, environment dumps, credentials, prompts, reasoning or arbitrary provider fields are saved. Model inventory is projected to the configured model and embedding; loaded model records retain bounded identity/resource metadata only.

## Isolation

Build and test before live measurement. Docker must be reachable; this repository's API/web services must be stopped. PostgreSQL may remain healthy at idle. No other evaluator, native API worker, Playwright test, integration suite, ingestion job or build may run concurrently. Capture process counts and safe process classifications before and after. Idle MCP browser servers are classified separately from running Playwright tests; unrelated processes are not killed. Pattern-based checks cannot establish host-wide exclusivity, and this limitation is recorded.

The collector and runner fail preflight on detected competing work or missing Docker/runtime/model identity. A lock excludes concurrent release/diagnostic runs. Only the selected LLM may be loaded before warmup; an idle embedding model may be explicitly unloaded once and the action recorded, never secretly. No database reset is needed for this intake-only measurement.

## Frozen dataset and AI contract

- File `datasets/ai-evaluation/requests.json`, version `requests.m9.v2`, exactly 100 cases in file order, SHA-256 `e462988851955ed05edbb8c6b05dd5b73b4bc9c975bb60be42b3f2999ac6bc44`.
- Approved baseline `docs/evaluation/results/m9-2026-09-29T14-17-47-313Z.json`.
- LLM `qwen3:4b-instruct-2507-q4_K_M`, digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641` (verify against the installed inventory).
- Embedding `bge-m3:latest`; capture its installed digest. Embeddings are not invoked by intake evaluation.
- Prompt/schema `request-analysis.v4` / `analysis.v1`; record source and schema hashes. Input title is input.slice(0,100), description is the full input, messages=[], historyTruncated=false, no RAG. Expected labels and IDs never enter prompts.
- Real production OllamaProvider and executeAnalysis; `/api/chat`, JSON Schema format, stream=false, think=false, temperature=0, seed=42, num_predict=1200, num_ctx=16384.
- top_p, top_k, keep_alive omitted as in production. Record model parameter/template hashes and numeric defaults; do not invent historical effective values.
- 120000 ms attempt deadline, 300000 ms case deadline; maximum two attempts including one repair/transient retry with 1000 ms backoff; same context/output/envelope bounds and validation.
- Historical evaluator routing is retained for like-for-like comparison, including the already disclosed OTHER→SERVICE_OPERATIONS scoring discrepancy. No label or scoring correction is mixed into this release comparison.

## Warmup and call budgets

Each separate diagnostic/full batch verifies identity, then executes exactly one bounded structured analysis warmup through production execution. Fixed synthetic input: `Khách hàng Demo Warmup báo 2 SIM IoT mất kết nối tại phòng lab từ 8 giờ sáng.` It must be schema-valid; failure stops the batch. This is one logical call, subject only to the existing maximum two attempts. It is saved separately and never scored as a dataset case. Verify `/api/ps` shows the exact LLM loaded with context 16384. Wait exactly 2000 ms once. Do not warm repeatedly until timing improves.

Priority diagnostics: five round-robin repetitions each of normal-06 and incomplete-06 plus controls normal-01, normal-11 and ambiguous-01, in that order each round (25 cases). Including the prior investigation's five target observations, this adds no more than ten diagnostic observations per investigated target. Preserve all outcomes and failures. Report distributions and identical request hashes. A stable small sample cannot establish deterministic behavior or erase historical disagreement. Do not change labels by voting. No new seed or model option is introduced.

One final 100-case run is permitted only after the investigation records a qualifying measurement/runtime/product defect and its correction. Before the first warmup the runner reserves an exclusive, persistent attempt record. After warmup or dataset execution has begun, any abort/failure consumes the budget and is retained; no second full attempt. A preflight refusal before any model call is NOT RUN and may be corrected. No repeats due to RED output.

## Metrics and evidence

Preserve the legacy snapshot and case fields so historical M9 inputs and analytics remain readable. Add safe actual category/priority/team, expected labels, per-attempt request/schema hashes and model identity, timing and allowlisted Ollama metadata. Store preparation, context construction, provider wall, final validation/completion, repair/backoff, metadata-collection tail and end-to-end latency separately. No observer overhead is subtracted. For failed attempts, missing fields remain missing.

Ollama durations are nanoseconds converted to milliseconds: total_duration, load_duration, prompt_eval_duration, eval_duration; token counts prompt_eval_count/eval_count; bounded done_reason when returned. Do not synthesize unavailable fields. Provider totals and generation throughput describe this run only; M9 has no compatible provider-side baseline.

Official outputs: `V1_EVAL_ENVIRONMENT.json`, `V1_AI_EVALUATION.json`, `V1_EVAL_REGRESSION.json`, append-only progress/attempt evidence and a new timestamped `m9-*.json` result. Use exclusive creation; preserve every historical JSON/report. Summaries include total/exact/schema/first-valid/repairs/terminal/failure classes, mean/p50/p95/max, all per-case latencies, pass-to-fail/fail-to-pass and comparator exit. Percentiles use the existing nearest-rank definition. All failures remain in denominators. No score combines quality and speed.

Before release, all mandatory gates must be supported and the unchanged comparator must be green. A timing improvement without a justified correction and complete gate evidence is insufficient. On unresolved criteria, commit/push useful remediation evidence and report BLOCKED; no merge/tag, no M11.

## Reproduction commands

Complete builds/checks first. With the repository services isolated:

```powershell
node --env-file=.env scripts/evaluation/capture-release-environment.mjs
node --env-file=.env scripts/evaluation/release-evaluate.mjs diagnostics
node --env-file=.env scripts/evaluation/release-evaluate.mjs final
```

The final entrypoint is the controlled canonical equivalent of `npm run ai:evaluate`, sharing its scoring and production execution contract, with isolation, metadata and a one-attempt guard. It invokes the original comparator in a scratch output directory to avoid overwriting M9 evidence.

Provider references checked 2026-09-30: [Ollama chat response timings](https://docs.ollama.com/api/chat) and [seed parameter](https://docs.ollama.com/modelfile). Current local behavior remains the evidence for the installed runtime; a documented seed is not proof of cross-runtime bitwise reproducibility.
