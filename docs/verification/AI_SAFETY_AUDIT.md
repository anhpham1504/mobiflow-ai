# Final AI-safety audit — M10

Scope: unchanged V1 AI inference/authorization contract with M10 release tooling and UI hardening. All inputs, retrieved documents, historical text and model outputs remain untrusted. The three login roles are USER, STAFF, MANAGER; AI/SYSTEM are audit actors.

| Attempt/boundary | Verified enforcement |
|---|---|
| Request says ignore rules, self-assign or close | Versioned prompts delimit untrusted request data; deterministic state/permission tests prevent model text executing protected transitions |
| Reveal another request/context | Backend ownership/current-assignee/manager predicates are reapplied; IDOR and access-loss negatives cover AI context and source access |
| Arbitrary prompt/action | Six-action Copilot enum and strict DTO reject extra/freeform prompt fields; wrong role/action/current state rejected |
| Unknown/delete/shell/SQL/URL tool | Closed registry, purpose/permission/argument/result schemas, duplicate-call and eight-call bounds; no arbitrary execution tool exists |
| Malicious SOP/tool/history text | Prompt delimitation, tool-output injection fixtures and live synthetic adversarial corpus exercise the boundary; text cannot grant tool/manager authority |
| Fake source/quote/case/staff/policy/count | Independent source membership/exact-quote/current-generation and allowlisted-ID/policy/count validation rejects fabricated values |
| Stale request/source/permission | Real PostgreSQL race, revoked initiator, late completion, source-disable and stale-version tests reject publication/approval without partial effects |
| Missing evidence/provider | No invented reference; retrieval-dependent generation fails closed, bounded retry/timeout records explicit failure, manual workflow remains usable |
| Hidden reasoning/raw output | Adapter excludes provider thinking; only validated structured results and concise reasonSummary are published; analytics/evaluation use narrow sanitized projections |
| Human decisions | Original AI recommendation and manager accepted/modified/rejected decision are retained separately; staff explicitly saves/completes checklist; owner confirms closure |

Evidence owners: `analysis.test.mjs`, `knowledge.test.mjs`, `recommendation.test.mjs`, `operational.test.mjs`; their corresponding PostgreSQL integration files; M4–M8 real runtime/evaluation/browser evidence; M10 outage and adversarial evidence. Test-provider fixtures exercise failure paths and are not labeled real model-quality measurements. The malicious-content corpus is synthetic; no raw sensitive attack response is reproduced here.

The fresh 100-case M10 intake evaluations both produced 100/100 final schema-valid output, 99 first-attempt valid, one repaired and zero terminal failures. This proves neither factual accuracy nor correct grounding of all possible responses. Intake has no applicable source-reference denominator. Separate real RAG evidence verifies actual bge-m3/pgvector/citation use; Copilot tests verify source/event membership.

The earlier broad M10 integration suite passed its declared assertions while live R5 ended `AI_TIMEOUT` after two attempts and R1 recovered on retry. That timeout remains recorded. The continuation's full database-suite rerun passed every group (1 auth, 3 workflow, 5 knowledge, 5 analysis, 33 recommendation/operational/analytics tests including nested cases); live R1–R8 all succeeded in that rerun. Its final group took 175,429.8798 ms. This subsequent success does not erase the earlier failure or resolve the separate 100-case latency comparison. Recovery, no duplicate worker effects and no phantom business success have separate tests.

Final live-comparison decision is **BLOCKED**: two isolated priority-label pass→fail cases and 83 latency flags remain. Source equivalence and one observed run-to-run label variation do not justify turning the comparator green. See [the full investigation](../evaluation/M10_EVALUATION_INVESTIGATION.md).

The subsequent bounded diagnosis returned MEDIUM 5/5 for both cases and faster warm sample timings, without identifying a production correction or proving the prior run invalid. Priority remains AI-advisory and manager-authoritative; no deterministic benchmark rule was substituted. Diagnostic evidence contains only validated synthetic outputs, safe hashes/metadata and timings; observer tests verify unchanged requests, bounded retry and exclusion of provider thinking. The unchanged comparator still exits 1, historical evidence is preserved, and no additional full run was performed. This is new observability evidence, not a new security-suite pass or release waiver.

Residual limitations: synthetic specification-authored labels, uncalibrated model confidence, exact-match disagreement not semantic ground truth, process-local scheduler, host-sensitive latency, no operator time benchmark and no production-scale/ROI/productivity claim. No new autonomous agent loop, product multi-agent swarm, cloud dependency or protected decision authority was added.
