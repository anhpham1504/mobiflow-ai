# Milestone 15 Verification

## Scope implemented

Authorized M15 evaluation/reliability only, from M14 checkpoint `3a85c65ffcb1eb6480b60a6b9e78ef288769f58b`, branch `feat/v1.2-ai-evaluation-reliability-v2`. Deterministic 100-case Recommendation V2 dataset, objective metrics, ten-case × three-run consistency design, 24 failure/currentness checks, actual local embedding/read-only retrieval probes and affected product regressions. [Detailed verification](../v1.2/M15_AI_EVALUATION_RELIABILITY_V2_VERIFICATION.md) owns methodology, identities, retained failures, limitations and final live metrics.

## Files/modules changed

Added M15 dataset/loader/metrics/live evaluator/tests, reliability helper/test/runner, product-regression/final-gates/read-only-retrieval scripts, spec/plan/verification documents and consolidated evidence. Modified root/API script wiring, owning Recommendation V2 prompt/native format, AI_BEHAVIOR amendment and V1.2 index. Two existing M14 writers accept an evidence destination override; assertions/historical evidence remain unchanged.

## Database changes

None. Prisma schema unchanged; no new migration; seven existing migrations. Real isolated PostgreSQL regression **26/26 PASS**. Injected failure-matrix repositories are in-memory and do not establish PostgreSQL isolation.

## API changes

No route, DTO, public schema, parser, authorization, version, state-machine or review behavior change. Native-generation presentation constraints address measured omissions/unsupported cause/SLA/conflict/prerequisite outputs. Historical V2 parsing/review remains unchanged.

## UI changes

No frontend product edits. Existing affected production browser gate **4/4 PASS** at responsive widths with escaped text, keyboard/RBAC/currentness/manual flow and Axe checks. A failed concurrent build/browser attempt is retained; serialized final rerun passed unchanged assertions.

## AI changes

Prompt/native format `grounded-recommendation.v2.10`, shared `recommendation.v2`. Same local Qwen model/bge-m3 and unchanged tokens/deadlines/retry/context bounds. Measured defect → minimal owning fix → affected smoke → final full-run sequence is retained, including v2.8 39-row and v2.9 20-row interrupted attempts and resumed setup NOT RUN. Dataset version `m15.recommendation.synthetic.v2`, SHA-256 `e3e9022433a4378ce98294169b2ae1b77799ee2cce6acba2d0f2c4d9673c5290`. Oracle v5 role/no-source-cause/quoted-data checks are separate tested metrics. Final live **100/100 + 30/30 PASS**, all first attempt, no repairs; model/dataset/eight source hashes unchanged. No claim of production accuracy or composite quality.

## Security considerations

No new tool, authority, protected business write, cloud dependency or role. Untrusted data/markup remains data; source/candidate/context membership and currentness remain backend predicates. Original suggestion/manager decision separation and mandatory human approval persist. Recorded structured outputs are synthetic; credentials/provider thinking/private prompts are excluded. Historical evidence is preserved by byte/hash checks.

## Tests executed

| Exact command | Final result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS, 168/168 |
| `npm run build` | PASS |
| `npm run test:unit:m15` | PASS, 98/98 |
| `node --env-file=.env scripts/evaluation/m15-recommendation-evaluate.mjs` | PASS, 100/100 baseline + 30/30 consistency |
| `node --env-file=.env scripts/verification/m15-reliability.mjs` | PASS, 24/24 |
| `node --env-file=.env scripts/verification/m15-retrieval.mjs` | PASS, 3/3 read-only source checks |
| `node --env-file=.env scripts/verification/m15-product-regression.mjs --database` | PASS, 26/26 |
| `node --env-file=.env scripts/verification/m15-product-regression.mjs --browser` | PASS, 4/4 |
| `git diff --check` | PASS |

Exact output and identities: [root gates](../v1.2/evidence/M15_FINAL_GATES.json), [targeted](../v1.2/evidence/M15_TARGETED_TESTS.json), [failure matrix](../v1.2/evidence/M15_FAILURE_MATRIX.json), [database](../v1.2/evidence/M15_DATABASE_REGRESSION.json), [browser](../v1.2/evidence/M15_BROWSER_REGRESSION.json). Initial/intermediate failed commands and partial live attempts are disclosed in the detailed verification and retained evidence; final results do not erase them.

## Manual verification

Reviewed authorization/baseline/frozen scope and owning contract consistency. Independent dataset audit checked all 21 omission scenarios and corrected incidental populations in 019/029. Independent agent review found causal/SLA/conflict/prerequisite/field-role issues missed by syntax alone, leading to narrow documented fixes and tested oracle refinements. Root reviewed seven-case v2.9 and four-case v2.10 smokes, then all 100 baseline and 30 repeated outputs. [Consolidated review](../v1.2/evidence/M15_SEMANTIC_REVIEW.json) records every reviewed row, repeat aggregates, seven actual retained failure replays and nonblocking qualitative limitations. Final identity verification passed. Agent review is not a blinded human quality rating.

## Known limitations

Static synthetic contexts isolate recommendation from upstream analysis/retrieval; shared templates are easier than production. Bounded lexical checks cannot establish exhaustive fact accuracy or entailment. Actual RAG smoke has three unlabeled queries. Case 099 is below request-creation minimum and exercises direct context only. Compact generated prose can be clipped or contain stray foreign characters. Free relevance prose in 055/060/075 has unsupported temporal/causal wording outside declared probes; zero detected protected-value findings does not mean zero hallucinated prose. Latency is host-observed with no production target. In-memory fault rollback and actual PostgreSQL integration are separately identified.

## Deferred items

Optional V1 comparator NOT RUN; no comparative result claimed. Production accuracy/calibration/blinded human assessment deferred beyond this synthetic evidence. M16/M17 implementation NOT STARTED; no execution authorization. A subsequent user request authorizes exactly one reviewed M15 checkpoint and M16 scope discovery only; no tag/merge/deployment.

## Release blockers

None confirmed within authorized M15 contract, protected workflow and security scope. Full 100+30 evaluation, complete output review, failure matrix and engineering/product regressions completed. Qualitative relevance/readability limitations remain explicit for human review; no production-accuracy or release-acceptance claim.

## Gate

**M15 PASS — FOCUSED CLOSURE REVIEW ACCEPTED FOR CHECKPOINT. Development/synthetic evidence only.** The 2026-10-01 user closure request authorizes exactly one M15 checkpoint. Review of 055/060/075/099 and representative 001/017/020 accepts the disclosed limitations under the stated canonical-value, valid-reference, human-approval and no-autonomous-execution conditions; no production code changes or redundant gate reruns. Inventory 7 modified + 108 new = 115 files, unchanged dependencies/schema and seven migrations, final `git diff --check` PASS. [Closure record](../v1.2/M15_AI_EVALUATION_RELIABILITY_V2_VERIFICATION.md#focused-checkpoint-closure--2026-10-01) records the focused findings and evidence boundary. M16 implementation NOT STARTED.
