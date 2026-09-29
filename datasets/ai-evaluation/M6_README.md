# M6 synthetic development evaluations

`m6-cases.json` was authored from the frozen taxonomy and business specifications before the first M6 predictions. Labels have not been edited after observing results. SHA-256: `a6fd238fe50f143b49c61140f7604a3ca3bb795db0530903925e5ddcbc214bf2`.

- Six synthetic corpus cases are created through the domain state machine and actually analyzed/embedded locally.
- Ten similarity queries: eight labeled positives (paraphrase, unaccented, typo, short, long, billing/account and same-keyword/different-topic), two negatives. Expected corpus codes map to actual fresh DB IDs. Query cases are canceled after evaluation, preventing contamination of later rankings.
- Eight recommendation cases: all category families, missing facts and two injection attempts. Expected category/priority/skill labels are not supplied to the model. Missing-fact labels are diagnostic expectations, not invented facts.
- Candidate fixtures separately exercise live PostgreSQL predicates and exact workload lifecycle counts. Their deterministic embeddings/providers are labeled test fixtures, never used as live model measurements.

The M6 portion of `npm run test:integration` (or `npm run test:integration:m6`) writes measured similar/candidate/recommendation reports under `docs/verification/evidence`. Previous bytes are archived in `iterations`. Interrupted runs retain per-case progress; final evaluation counts errors in all denominators. Relevant live gate is the primary actual-model request retrieving SOP evidence, policy, candidates and a recommendation while still unassigned. There is no invented numeric accuracy threshold.

Hit@k and MRR use the eight positive similarity cases; negative no-match is reported separately. At the frozen mapped-cosine threshold 0.70, one of two negative queries still matched. No threshold or label was changed to conceal that result. Recommendation schema/reference validity is successful validated artifacts divided by all eight inputs; routing and priority agreement are separately reported. ID membership and citations do not establish semantic entailment. The tiny reused development set is not an independent holdout, production accuracy estimate or calibrated confidence benchmark.
