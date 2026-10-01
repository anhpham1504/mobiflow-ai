# M15 AI Evaluation & Reliability V2 implementation plan

Authority: [verbatim user authorization](M15_AI_EVALUATION_RELIABILITY_V2_SPEC.md), supplied 2026-09-30. Baseline HEAD `3a85c65ffcb1eb6480b60a6b9e78ef288769f58b`, clean working tree, branch `feat/v1.2-ai-evaluation-reliability-v2`. M0–M14 records remain historical. M16/M17 are not authorized.

## Scope and sequence

1. Preserve the authoritative request and reference it from the V1.2 index before implementation.
2. Inspect only the owning Recommendation V2 contracts, prompt, parser, provider, worker, authorization, retrieval and existing evaluation/test helpers.
3. Author a static dataset `m15.recommendation.synthetic.v2` with 100 ordered synthetic cases and complete deterministic supplied contexts. Commit-ready JSON records the methodology, fixed IDs/time, truth labels, missing fields, adversarial strings and ten consistency IDs. Hash exact dataset bytes with SHA-256. No randomized case creation in the runner.
4. Implement independently tested objective metrics and a live Ollama runner using existing production messages, native format, adapter and parser. Preserve two attempts, one-second retry delay, shared run deadline, configured context/token/temperature limits and existing model. Record every attempt, including rejected references and repairs. Preserve failed runs with immutable consolidated artifacts; write one summary, one manifest and one details file per run rather than per-case files or repeated snapshots.
5. Test injected provider/parser/retrieval/database/authentication/stale failures through actual owning implementation. Verify bounded failure, no partial publication/business mutation and availability of the manual path. Include currentness tests separately from model inference.
6. Execute 100 cases in order and ten representative cases three times each. Repeat prose may vary; report invariant changes separately. A small V1 comparator is optional and does not determine M15 PASS.
7. Execute targeted M15/Recommendation/provider/grounding tests, root lint/typecheck/unit and production build. Review changed files, evidence identities, database/migration count and frozen semantics.
8. Write both M15 verification documents and update the index with the actual gate. Leave the working tree uncommitted for human review. Stop before M16.

## Files/modules

New dataset/loader, objective metrics/tests, live evaluation runner, consolidated evidence writer, targeted reliability tests and four required M15 documents. Root/API package scripts wire reproducible commands and include M15 tests in root units. Existing M14 runners and evidence are not overwritten.

Production changes are permitted only for a demonstrated defect: record failure → minimal owning fix → affected rerun. No schema/migration or dependency is planned. A production migration or external service requires stopping with the reason before implementation.

## Evaluation interpretation

Static supplied contexts isolate Recommendation V2 generation/validation from upstream analysis accuracy. SOP excerpts, candidates, historical references and canonical SLA values are synthetic fixtures; reference integrity means membership in those actual supplied contexts. It does not establish real retrieval recall, historical freshness in PostgreSQL or production correctness. An actual configured embedding probe is recorded separately; any focused live retrieval check is identified separately from fixture-source metrics.

Only TRIAGED accepts product generation; other states are covered as service rejection/currentness tests. Schema-valid output, parser-accepted output and semantic oracle findings remain separate. Free-text checks use declared known/forbidden facts and explicit authority/execution patterns with negative control tests; they do not establish exhaustive factual or semantic accuracy. Missing-information exact/partial/missed/fabricated results have separate counts. First-attempt schema validity is distinct from first-attempt complete contract acceptance. Protected facts, accepted hallucinated IDs, output bounds, action vocabulary, policy violations and final contract success are individual gates; no composite score or confidence percentage.

## Verification boundary

Required commands are added as `test:unit:m15` and `eval:recommendation:m15`, plus `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Execute affected owning units and failure tests. If production behavior stays unchanged: M14 PostgreSQL 26/26 and browser 4/4 are **NOT RUN — owning product behavior unchanged**. If a fix changes persisted/product behavior, rerun only the affected PostgreSQL/browser regression and record why.

## Observed defects and amended execution

Retain all preflight/partial/interrupted evidence. The initial ten-case run revealed missing canonical SLA/conflict warnings; v2.5 bound required native warning/evidence tuples. Independent review interrupted its 27-case full attempt after unsupported causal claims and incomplete prerequisite wording. v2.6 added symptom-only instructions and human action prefixes. Its smoke revealed total SLA target mistaken for remaining time and premature adjudication of approved-analysis conflict; v2.7 bound state-only/neutral warning text. The next smoke still used START_WORK before obtaining declared missing fields and adjudicated conflict in narrative; v2.8 uses information-first action constraints, complete REQUEST_USER_INFO prerequisites and neutral conflict narrative. Tests cover these actual defects while public parsing/history/review semantics remain unchanged.

Dataset review also removed incidental population counts from cases 019/029. Original contexts and outputs remain in their earlier evidence directories; final dataset hash identifies the corrected inputs. Oracle refinements are declared and independently tested. Source and dataset hashes must remain unchanged throughout the final 100+30 run.

The v2.8 full attempt was interrupted after 39 completed cases, preserving its original dataset and all outputs: three multi-field cases exhausted both attempts at 1,200 tokens; a missing device was filled with a customer identifier in a checklist; two no-SOP narratives treated retrieval absence as an incident cause. Final v2.9 shortens generated presentation, defers procedural checklists until missing information is obtained, preserves field roles and uses neutral insufficient-source narrative. Add tested role-substitution/no-source-cause probes and rerun the actual failed cases plus the largest missing-information context, then repeat the frozen full 100+30 gate. Keep the same model, output/deadline/retry bounds and public contract. Final source changes justify fresh engineering and affected persisted/browser checks; run those sequentially.

Because production prompt/native presentation changed, run affected real PostgreSQL and browser regressions under M15 evidence names, preserving M14 bytes. Serialize root builds and browser regressions: a recorded overlapping build caused EBUSY and unavailable browser hydration chunks; retain that failure and rerun without weakening assertions. No migration, dependency or new product capability is needed.

The subsequent v2.9 run retained 20 completed rows and was interrupted on recurring case009 unsupported system-error diagnosis. Final v2.10 binds sufficient-source summary to an attributed exact request-title quote and reason to a neutral human-verification rationale, preserving existing conflict/insufficient narratives. This general generation constraint avoids diagnosis across all requests rather than using case IDs. Oracle v5's precision tests recognize attributed multi-sentence/escaped quotes while detecting commands outside them. Preserve every preceding failure; final reports must explain that constrained generation success does not measure unconstrained model reasoning. Repeat affected smoke, source-frozen full 100+30 and necessary final engineering/product gates.

## Risks and gate

Live failures must remain in evidence. No fixture replaces unavailable Ollama, embedding or PostgreSQL. Dataset hashes and exact case order, source/prompt/schema hashes, model digests, runtime settings, attempts and timing support reproducibility of the procedure; they do not promise identical prose/hardware latency. Gate requires at least 50 actually executed cases, complete final validity, zero accepted hallucinated IDs, zero detected protected-fact fabrication/authority/execution violations, valid actions/bounds, safe failure matrix and all engineering gates passing. Unresolved actual blockers result in FAIL/BLOCKED, never a fabricated PASS.
