# M10 Evaluation Blocker Investigation

## Scope

2026-09-30 (Asia/Saigon). **Release decision: BLOCKED.** This continuation investigates only the two priority pass→fail cases and the 83 isolated-run latency flags. No production inference, business, security, database or UI behavior changed. At investigation time no commit, push, merge, tag or M11 work occurred; later Git finalization may only preserve this blocked branch snapshot.

Branch `feat/m10-release-hardening`; HEAD/tag `v0.9.0-m9` resolve to `c0e7c9520ae4172b28415b609f8e66191d906803`. Initial status/log/stat/whitespace checks confirmed the intentionally dirty M10 tree. Nine existing evaluation/M9 evidence files were hashed before diagnostics and remain byte-identical. All 20 diagnostic calls are retained; no additional full evaluation occurred.

## Approved M9 baseline

Artifact: [m9-2026-09-29T14-17-47-313Z.json](results/m9-2026-09-29T14-17-47-313Z.json), run `c9fb5577-6c3e-46f8-8114-c5f9537b4a1c`, 14:13:09.814–14:17:47.313 UTC on 2026-09-29.

Dataset `requests.m9.v2`, 100 synthetic cases, SHA-256 `e462988851955ed05edbb8c6b05dd5b73b4bc9c975bb60be42b3f2999ac6bc44`. Model `qwen3:4b-instruct-2507-q4_K_M`; prompt/schema `request-analysis.v4` / `analysis.v1`. Exact 68/100, schema 100, first-valid 99, repaired 1, terminal failures 0. Mean/p50/p95/max: **2774.87 / 2704 / 3116 / 6597 ms**.

Recorded environment: Node v24.19.0, temperature 0, output limit 1200. Per-call digest, Ollama version, endpoint, host state, actual predictions, token counts and component timings were NOT recorded.

## Existing M10 runs

| Preserved artifact | Exact / schema / first / repair / terminal | Mean / p50 / p95 / max ms | Comparator vs M9 |
|---|---|---|---|
| [Contended](results/m9-2026-09-29T16-34-01-887Z.json) | 68 / 100 / 99 / 1 / 0 | 4942.51 / 4786 / 5621 / 11023 | RED: 3 pass→fail, 98 latency flags |
| [Isolated](results/m9-2026-09-29T16-42-23-764Z.json) | 69 / 100 / 99 / 1 / 0 | 4441.65 / 4377 / 5147 / 9386 | RED: 2 pass→fail, 83 latency flags |

Contended execution overlapped API/vector work. Prior isolated execution stopped API/web, reset the demo DB and unloaded bge-m3; it ran 16:34:59.587–16:42:23.764 UTC. These are retained observations, not new repetitions. Both runs have fail→pass M9-065/075/085. `normal-21` varies between M10 runs. Neither has increased repairs, lost schema validity or a new terminal failure category.

## Contract-equivalence audit

[M10_EVAL_CONTRACT_DIFF.json](../verification/evidence/M10_EVAL_CONTRACT_DIFF.json) records 62 normalized per-file SHA-256 comparisons and an empty Git diff for AI, knowledge, analytics, evaluation scripts, dataset, contracts and `.env.example`. CRLF normalization is explicit; dataset byte hashes also match. Config changes only secret validation. Package changes add release commands and development-only Axe; inference dependencies and evaluation/comparison commands are unchanged.

| Contract component | M9 | M10 | Changed? | Can affect result? |
|---|---|---|---|---|
| Prompt/assembly | request-analysis.v4 / analysisMessages | Same source | No | Yes if changed |
| Schema/strictness/taxonomy | analysis.v1, strict Zod, six category branches, four priorities | Same | No | Yes if changed |
| Preprocessing/normalization | title=input.slice(0,100); full input description; no additional normalization | Same | No | Yes if changed |
| Context/truncation/routing | messages=[]; historyTruncated=false; no retrieval/team/skill context; static route after generation | Same | No | Yes if changed |
| Structured transport | /api/chat, format JSON Schema, stream=false, think=false | Same, observed on wire | No | Yes if changed |
| Sampling | temperature=0; seed=42 | Same, observed on wire | No | Yes |
| top_p/top_k | Not sent; runtime defaults | Not sent; current model defaults .8 / 20 | No source change; historical effective defaults unrecorded | Possible runtime effect |
| Token/context/size limits | num_predict=1200; num_ctx=16384; context 24000 chars; output 32768/envelope 65536 bytes | Same | No | Yes |
| Timeouts | 120000ms attempt / 300000ms run defaults | Same parsed config | No source change; historical per-run overrides unrecorded | Yes |
| Retry/repair | Two attempts max; 1000ms delay; trusted validation feedback | Same executeAnalysis | No | Yes |
| keep_alive | Omitted | Omitted | No source change; historical effective default unrecorded | Possible load effect |
| Provider URL | Validated OLLAMA_BASE_URL; tracked localhost example | Native localhost:11434 | No tracked change; historical actual URL unrecorded | Possible runtime effect |
| Parser/validation | boundedJson / parseAnalysis / strict analysisSchema | Same | No | Yes |
| Expected-label logic | Exact category AND priority AND deterministic team; all cases retained | Same | No | Yes |
| Comparator | Per-case regression; latency strictly >1.5× | Same source and CLI | No | Yes; intentionally frozen |

No relevant M10 production AI-path change was found. Bootstrap, DB seed, RAG and worker changes do not enter this intake evaluator. Source equivalence does not prove identical unrecorded runtime conditions.

Current system prompt length is 3862 characters; schema JSON 7797; sample user/context lengths 140–289. Evidence stores hashes/lengths, not raw prompts. Tagged source, unchanged inference dependency entries and identical input reconstruct the same messages under the current runtime. Historical live token counts were never captured, so a measured historical token-count comparison is unavailable.

## Dataset-equivalence audit

Mechanical assertions pass: identical version/hash, all 100 full rows, ordered IDs and every expected category/priority/team. Comparison uses the tagged dataset plus the exact dataset hash in each historical result. Historical results do not independently store expected or predicted label strings.

| ID | Tagged M9 expected | Current expected | Changed? |
|---|---|---|---|
| normal-06 | IOT / MEDIUM / NETWORK_OPERATIONS | Same | No |
| incomplete-06 | ACCOUNT / MEDIUM / CUSTOMER_SUPPORT | Same | No |
| M9-065 | SERVICE / LOW / SERVICE_OPERATIONS | Same | No |
| M9-075 | SERVICE / LOW / SERVICE_OPERATIONS | Same | No |
| M9-085 | SERVICE / LOW / SERVICE_OPERATIONS | Same | No |

No label, case, denominator, threshold or prior result changed. The service cases matched LOW in both prior M10 runs; their nonmatching M9 priority is UNRECORDED, not inferred from today's replay.

## Priority ownership

The evaluated prioritySuggestion is **B: AI-classified**; the wider workflow is human-approved. [AI_BEHAVIOR_SPEC](../specs/AI_BEHAVIOR_SPEC.md) permits suggestions and forbids AI setting actual priority. LOW informational/nonblocking, MEDIUM isolated/uncertain, HIGH multiple/significant and URGENT explicit critical-impact guidance is not a specified deterministic text algorithm.

[PROJECT_SPEC](../specs/PROJECT_SPEC.md) leaves actual priority MEDIUM until approval. [BUSINESS_WORKFLOW](../specs/BUSINESS_WORKFLOW.md) and [AUTHORIZATION_SPEC](../specs/AUTHORIZATION_SPEC.md) give operational authority to MANAGER. [SLA_SPEC](../specs/SLA_SPEC.md) deterministically selects policy/calculates clocks after approved priority; it does not calculate intake priority. No invented keyword rule or benchmark-specific replacement is justified.

## normal-06 investigation

Synthetic description: “Khách hàng Demo Sen tại phòng lab A muốn cấu hình chu kỳ gửi dữ liệu cho 1 thiết bị IoT từ 8 giờ. Không có sự cố kết nối.” Title uses the unchanged first-100-character excerpt; no messages or truncated history.

Expected IOT / MEDIUM / NETWORK_OPERATIONS. M9 matched all three, implying those labels from stored booleans. Both historical M10 runs matched category/team but not priority; exact alternative priority is **UNRECORDED**. All three were one-attempt/schema-valid with no failure category. M9/contended/isolated latencies: 2659/4344/3516ms.

Current replay returns the expected triple **5/5**, one attempt each, identical request hash. Its reasonSummary treats this as routine single-device configuration. Nonblocking LOW and routine MEDIUM guidance may invite interpretation overlap; that is not proof of the unknown historical alternative or a bad label. No prompt/label change. The regression did not reproduce in this small warm batch; its cause remains unresolved.

## incomplete-06 investigation

Synthetic title/description: “Không truy cập được tài khoản, nhờ hỗ trợ.” No stated customer/location/count/time; no messages or truncated history.

Expected ACCOUNT / MEDIUM / CUSTOMER_SUPPORT. M9 matched. Both historical M10 runs matched category/team and disagreed on priority; exact alternative **UNRECORDED**. All one-attempt/schema-valid, no failure category. Latencies: 2981/4663/4344ms.

Current replay returns the expected triple **5/5**, same request hash; entities remain null and missing impact is noted. This accords with uncertain-impact MEDIUM guidance, but does not explain prior disagreement. Current intent is ASK_INFORMATION despite the reported access problem, illustrating that passing three exact labels does not validate every semantic field. No unrelated intent/product change was made.

## Targeted replay results

[M10_EVAL_PRIORITY_REPLAY.json](../verification/evidence/M10_EVAL_PRIORITY_REPLAY.json) preserves validated outputs, safe failures/identity, request hashes and timings. Four alternating dedicated trials plus one fixed microbenchmark occurrence total **five per case**, not six.

| Case | Priority distribution | Category/team | Valid / first / repair / terminal | Latency range ms |
|---|---|---|---|---|
| normal-06 | MEDIUM 5/5 | IOT / NETWORK_OPERATIONS 5/5 | 5 / 5 / 0 / 0 | 2376–2709 |
| incomplete-06 | MEDIUM 5/5 | ACCOUNT / CUSTOMER_SUPPORT 5/5 | 5 / 5 / 0 / 0 | 2928–3008 |

Priority is stable within this batch. normal-06's reasonSummary/token length varies on its first trial under the same request hash; that is output variation, not priority variation. Target cases were warm; only normal-01 was cold/warm probed. Target-priority correlation with cold state is **not established**.

## Latency instrumentation

`scripts/verification/m10-eval-observer.mjs` delegates to the real OllamaProvider and unchanged executeAnalysis. It times boundaries and observes only allowlisted metadata via a bounded response clone. Original requests/responses, validation and retries are unchanged; no extra model generation or public business contract change.

Components: input preparation, context assembly, provider wall including inventory/envelope handling, final validation plus promise completion, retry-validation/backoff interval, repair provider time, runner wall. Exact fields: total_duration, load_duration, prompt_eval_count, prompt_eval_duration, eval_count, eval_duration, done_reason; durations retain raw nanoseconds and millisecond conversions.

Passive observation cannot isolate failed validation from the actual 1000ms retry wait; they are labeled together. No live diagnostic needed repair. A fixture verifies repair/backoff observation, not live model quality. Observer clone/bookkeeping overhead remains uncorrected; nothing is subtracted to improve reported latency. Twenty requests made exactly twenty chat attempts.

## Host/runtime state

[M10_OLLAMA_RUNTIME.json](../verification/evidence/M10_OLLAMA_RUNTIME.json) records four snapshots, 17:58:29.695–17:59:33.177 UTC. Windows Balanced; i7-13650HX, 14 cores/20 logical processors. Total visible memory 24952696 KiB; free 11245308 before / 10508132 after. CPU snapshots 14%, 6%, 6%, 7%.

RTX 4060 Laptop GPU, driver 616.92, 8188 MiB VRAM; used 765 MiB before / 5733–5747 MiB warm; 39–48°C. Snapshot utilization 0–2% is BETWEEN calls, not an inference utilization measurement. Power limit N/A. No OS/GPU/server setting, model or dependency was changed.

API/web stopped; PostgreSQL healthy. No competing Node evaluator/native MobiFlow worker detected; four unrelated Node processes were untouched. Classification uses command patterns, not authoritative process working directories or a host-wide exclusivity guarantee. No builds/tests during live measurement. bge-m3 unloaded; only LLM loaded after probe. /api/ps reports all 5098103111 loaded bytes in VRAM and context 16384.

At approximately 17:50 UTC CLI reported no Ollama server; `ollama.exe ps` auto-started the Windows app. Subsequent diagnostics used API reads. This fresh process is a recorded difference, **not proof the prior isolated benchmark was invalid**. API/web restarted after diagnostics. No DB reset/business mutation in this continuation.

## Ollama timing breakdown

[M10_EVAL_LATENCY_DIAGNOSTIC.json](../verification/evidence/M10_EVAL_LATENCY_DIAGNOSTIC.json) owns the measurements. All below are milliseconds.

| Component | Cold normal-01 | Immediate warm normal-01 | Fixed warm sample mean |
|---|---:|---:|---:|
| Official executeAnalysis latency | 5502 | 2237 | 2638.700 |
| Input preparation | .018 | .003 | .003 |
| Context assembly | .233 | .027 | .029 |
| Provider wall | 5500.833 | 2236.433 | 2638.701 |
| Ollama total | 5469.793 | 2218.027 | 2615.287 |
| Load | 2902.083 | 2.166 | 2.661 |
| Prompt evaluation | 357.000 | 13.633 | 43.299 |
| Generation | 2180.235 | 2175.312 | 2543.087 |
| Final validation/completion | .925 | .084 | .076 |
| Repair provider time | 0 | 0 | 0 |
| Runner wall | 5502.156 | 2236.574 | 2638.834 |

Cold overhead is mainly loading/prompt evaluation **in this probe**. Warm generation is 97.24% of Ollama total; weighted throughput 74.56 output tokens/second. Mean provider-minus-Ollama total 23.414 ms (inventory/network/envelope/observer combined), not the historical ~1.67-second mean gap. No repeated multi-second loads, duplicate calls, repairs or large application overhead observed now.

Current prompt counts 1058–1099; output counts 161–216. Historical per-call counts/timing are unavailable. These measurements do NOT attribute the old 83 flags to generation speed/volume, thermals, cache, GPU offload or contention.

## Model identity

Ollama API 0.34.4; Node v24.19.0. Exact model `qwen3:4b-instruct-2507-q4_K_M`; digest `d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641`; qwen3, 4.0B, GGUF, Q4_K_M.

Template 4040 chars, SHA-256 `40c21f34cf67d8c760ef72f8ad3ae5afad514299d4b06e91dd9a8d705af7b541`. Parameter text 263 chars, SHA-256 `c473bc5c447cfb767472db82b1be95c170a64a6d7c3c3c88016aae1e696944b5`. Current model defaults: top_k=20, top_p=.8, repeat_penalty=1, temperature=.7, num_ctx=32768. Wire requests explicitly override temperature=0 and num_ctx=16384, retain seed=42/num_predict=1200 and omit keep_alive/top_p/top_k.

[M4 verification](../verification/MILESTONE_4_VERIFICATION.md) recorded the same digest/version. **M9 did not record its own run digest**; older matching history is not proof of contemporaneous M9 identity. No evidence of an altered artifact or lost explicit setting was found; model/template unchanged.

## Controlled microbenchmark

Predeclared sample: normal-01, normal-06, normal-11, incomplete-01, incomplete-06, ambiguous-01, M9-057, M9-065, M9-075, M9-085. Covers normal Network/IoT/Billing, missing facts, both blockers, ambiguity, accentless Vietnamese and all three prior fail→pass cases; not selected by favorable latency.

[M10_EVAL_MICROBENCHMARK.json](../verification/evidence/M10_EVAL_MICROBENCHMARK.json): **mean 2638.7, p50 2566, p95/max 2928 ms**. Nearest-rank p95 for n=10 is maximum. All ten schema-valid first attempt; five exact triple matches and five disagreements. None omitted.

| Case | Wall ms | Prompt / output tokens | Category / priority |
|---|---:|---|---|
| normal-01 | 2429 | 1086 / 161 | NETWORK / HIGH |
| normal-06 | 2380 | 1099 / 172 | IOT / MEDIUM |
| normal-11 | 2924 | 1091 / 212 | BILLING / MEDIUM |
| incomplete-01 | 2453 | 1062 / 178 | NETWORK / HIGH |
| incomplete-06 | 2928 | 1058 / 216 | ACCOUNT / MEDIUM |
| ambiguous-01 | 2566 | 1060 / 186 | OTHER / MEDIUM |
| M9-057 | 2245 | 1078 / 161 | NETWORK / MEDIUM |
| M9-065 | 2784 | 1066 / 199 | SERVICE / MEDIUM |
| M9-075 | 2919 | 1066 / 212 | SERVICE / MEDIUM |
| M9-085 | 2759 | 1066 / 199 | SERVICE / MEDIUM |

Same-subset historical means: M9 3075.4, contended 5090.9, isolated 4271 ms. Historical load state differs/unrecorded; not a controlled speedup claim. Service priorities disagree with LOW again now; two improved targets do not establish overall quality improvement.

Pre-existing evaluator mapping OTHER→SERVICE_OPERATIONS differs from A06/dataset CUSTOMER_SUPPORT and explains ambiguous-01's team miss. This is unchanged from M9 and unrelated to either priority blocker; disclosed, not silently fixed or used to change the frozen comparison.

## Root cause

**Historical root cause unresolved.** High confidence: unchanged relevant source/data; current wire contract verified; current warm cost dominated by generation; no large app overhead/repeated cold loads; target priorities stable in five warm trials. Earlier disagreement is established by saved match flags.

Low confidence in any historical mechanism: actual alternative priorities and per-call token/load/host observations are missing. Fresh runtime/warm isolation now resembles baseline latency, but was not a controlled correction of a reproduced defect. Runtime/cache/numerical/host variation remains hypothetical. Current observations cannot invalidate the isolated run or establish that all regressions are harmless.

## Corrective intervention

**No justified production correction identified.** Evaluation-only instrumentation addresses the observability gap. Worker isolation, embedding unload and LLM warmup are measurement controls, not a claimed production fix. Fresh process start is disclosed. No model/prompt/rule/setting/label/comparator/threshold change.

Added scripts: m10-eval-observer.mjs, m10-eval-observer.test.mjs, m10-eval-diagnostics.mjs, m10-eval-host.ps1, m10-eval-comparator-recheck.mjs under scripts/verification. New evidence is M10_EVAL_* and M10_OLLAMA_RUNTIME. Backend testing/verification skills guided request transparency, safe projections, retry/failure tests and scoped gates.

## Post-fix targeted verification

No production fix to certify. Instrumentation checks actually executed:

| Command | Result |
|---|---|
| `node --check scripts/verification/m10-eval-diagnostics.mjs` | PASS after initial syntax correction; no inference before correction |
| `node --test scripts/verification/m10-eval-observer.test.mjs` | PASS 6/6: request equivalence, privacy, bounded repair/failure, metadata, sample/statistics |
| `node --env-file=.env scripts/verification/m10-eval-diagnostics.mjs audit` | PASS 62 source hashes and dataset/label assertions |
| `npm run lint` | PASS after syntax/unused-import fixes; failed lint attempts retained in iterations |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, 17 static pages |
| `node --env-file=.env scripts/verification/m10-eval-diagnostics.mjs live` | Completed once; 20/20 first-attempt valid; not release PASS |
| `node --env-file=.env scripts/verification/m10-eval-diagnostics.mjs verify-protected` | PASS; nine prior evaluation/M9 evidence hashes unchanged |
| `git diff --exit-code v0.9.0-m9 -- apps/api/prisma/migrations` | PASS; six migrations unchanged |
| `git status --short --branch`, `git diff --stat`, `git diff --name-status v0.9.0-m9`, `git diff --check` | Reviewed; expected M10 tree preserved; whitespace PASS (`M10_EVAL_DIFF_CHECK.json`) |
| `docker compose start api web`, `docker compose ps --all --format json` | Restored; API/web/PostgreSQL running and healthy |

Final read-only readiness check: web HTTP 200; canonical `/health/ready` HTTP 200, coreReady=true, aiReady=true, RAG READY. An initial ad-hoc probe used the nonexistent `/api/v1/health` endpoint and received 404; it was corrected after inspecting the registered route, not treated as an application failure. Thirty new diagnostic source/evidence files were checked against configured secret values with zero matches; five updated documents have zero broken local links. `.env` is not tracked; no final-run artifact, model binary, generated build output, migration change, benchmark-specific production rule or M11 implementation was added. HEAD and its only pointing release tag remain the approved M9 baseline.

Evidence: M10_EVAL_DIAG_LINT/TYPECHECK/UNIT/BUILD.json and timestamped logs. Full root unit/integration/security/E2E **NOT RERUN** because only diagnostics/scripts/docs changed; prior M10 results retained, not newly claimed passes. Focused observer tests do not replace a security audit.

## Final full evaluation

**NOT RUN.** The one remaining 100-case budget is unused. No real defect was corrected and no specific reproducibility defect proved the previous isolated run invalid. Better small-sample timings and matching replays do not meet the prerequisite. No final-result/final-regression artifact exists; no repeat-until-green selection.

## Comparator result

The unchanged scripts/evaluation/m9-compare.mjs executed against approved M9 and existing isolated M10. Its fixed output was confined to a fresh ignored scratch directory to preserve M9 evidence. [M10_EVAL_COMPARATOR_RECHECK.json](../verification/evidence/M10_EVAL_COMPARATOR_RECHECK.json) records original script hash/command/output location and **exit 1 / RED**.

100 cases; normal-06/incomplete-06 pass→fail; M9-065/075/085 fail→pass; **83 latency flags, 85 total flags**; zero schema/reference/repair/new-failure regressions. Threshold remains strictly >1.5×. Diagnostic subset never substitutes for this comparison.

## Release decision

**M10 BLOCKED.** The bounded investigation is complete; release approval is not. Master-plan section 34 permits PASS only when no blocker remains. TEST_STRATEGY supplies no invented absolute accuracy target, but neither it nor current authorization waives unresolved longitudinal blockers. M10/final/checklist stay BLOCKED. Git finalization of this snapshot does not create a release tag or authorize M11.

Further work needs a reproducible mechanism or explicit independent-adjudication direction; neither is assumed. No additional run, background monitor or delayed action scheduled.

## Limitations

68/100 or 69/100 exact synthetic label agreement is **not generalized AI accuracy**. Disagreement does not automatically establish semantic incorrectness. The small nonrandom diagnostic set is not a replacement benchmark. Historical alternative predictions, per-call identity/options, token counts, load/generation timing and host telemetry remain unavailable.

Current evidence cannot separate every host/runtime/cache/numerical cause, measure during-call GPU utilization, establish cold-priority effects or justify a waiver. Structure validation is not complete semantic validation. Original failures remain visible. No hidden reasoning, raw private prompts, credentials, .env dump or real customer data persisted.
