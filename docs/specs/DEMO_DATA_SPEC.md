# Demo Data Specification

Authority: master-plan M2.6, M4/M5 evaluation, M9, M10.3–M10.6 and §29. All data is synthetic, visibly labeled and reproducible. No real phone numbers, customer identifiers, confidential SOPs or MobiFone internal data.

## Identity/routing seed (M2)

Use stable IDs/codes and idempotent upserts in the explicitly configured local demo database. Minimum one USER, one MANAGER and 3–5 STAFF; freeze initial seed at four STAFF to cover required routing. Suggested identities:

| Account | Role | Team(s) / skills |
|---|---|---|
| user@mobiflow.local | USER | No team permission |
| manager@mobiflow.local | MANAGER | Single V1 organization manager |
| staff.iot@mobiflow.local | STAFF | NETWORK_OPERATIONS / IOT, NETWORK |
| staff.network@mobiflow.local | STAFF | NETWORK_OPERATIONS / NETWORK, IOT |
| staff.support@mobiflow.local | STAFF | CUSTOMER_SUPPORT and SERVICE_OPERATIONS / ACCOUNT, CUSTOMER_SUPPORT |
| staff.billing@mobiflow.local | STAFF | BILLING_SUPPORT / BILLING |

Teams: NETWORK_OPERATIONS, CUSTOMER_SUPPORT, BILLING_SUPPORT, SERVICE_OPERATIONS. Skills: IOT, NETWORK, BILLING, ACCOUNT, CUSTOMER_SUPPORT. Staff are active/available by default; tests seed explicit inactive/wrong-team/unavailable cases separately. A second USER for ownership-negative tests is an isolated test fixture, not a fourth role. Seed fallback SLA policies LOW=480, MEDIUM=240, HIGH=120, URGENT=60 minutes; all labeled demonstration assumptions.

Passwords are generated/provided only for local demo seeding, hashed by the normal auth implementation and documented as demo-only in the future local demo README. Never reuse them as production advice or embed credentials in frontend code. No actual password or secret is created in M0.

## Synthetic knowledge (M5)

Create actual local artifacts and label every page/header “Synthetic demo document — not an actual enterprise SOP”:

- `SOP-IOT-04_Xu-ly-mat-ket-noi-IoT.pdf`: synthetic SIM/APN/gateway connectivity triage, escalation criteria and verification checklist.
- `SOP-NET-02_Xu-ly-su-co-mang.pdf`: synthetic mobile-network troubleshooting.
- `SLA-Policy.pdf`: mirrors seeded demonstration targets and WAITING_USER policy, no claim of a real company SLA.
- `FAQ-IoT.txt`: UTF-8 synthetic IoT FAQ with explicit headings and no fake page numbers.

Manager uploads through real validation/extraction/indexing or an idempotent seed command using the same services. PDF page references and document/chunk IDs come from actual extraction. No manually fabricated READY rows, embeddings or retrieval outputs. Seed document hashes/versions and selected embedding identity are recorded for reproducibility.

## Historical and primary requests (M6/M10)

Historical rows may be synthetic fixtures, labeled `seedBatchId`/demo metadata in audit with seed reference time. They must satisfy state/assignment/SLA/history constraints; no impossible final state without its history. Use a supplied seedReferenceTime to reproduce relative timestamps. Include a few actual related IoT requests within 30 minutes so similarity queries can return them; vary locations/categories for negative examples. Generate real compatible request embeddings locally before the similarity demo; never insert guessed vectors or precomputed fake counts.

Primary live input:

> Khách hàng ABC có 17 SIM IoT tại KCN Amata bị mất kết nối từ khoảng 8 giờ sáng.

ABC and the scenario are fictional; location text is illustrative. Expected taxonomy is NETWORK/IOT_CONNECTIVITY; HIGH is a suggestion grounded in explicit affected count/disruption, not an automatic operational change. Extraction must preserve 17 and the reported time without inventing a date. Actual model output, retrieval, candidates, sources and confidence must be generated during the live run, not substituted from expected values.

Demonstrate USER submit → real local AI analysis → real SOP-IOT-04 retrieval → controlled similar/SLA/candidate tools → pending recommendation → MANAGER approve/modify → assigned STAFF work/checklist/Copilot → staff resolve → factual AI summary → USER confirm CLOSED → real audit/analytics. Before approval, no assignment or active SLA exists.

Secondary demonstrations: missing location stays null/flagged; stop Ollama and show saved request/manual path/retry; manager changes suggested Staff B to eligible Staff A while preserving original suggestion and MODIFIED metric. A genuine wrong/no model answer must be shown as such or retried transparently; never present canned output as live.

## Evaluation data and analytics provenance

M4: 50 cases with the exact 30/10/5/5 distribution. M5: 20–30 labeled retrieval questions. M9: minimum 100 valid request cases, target 150–300; taxonomy coverage, missing/ambiguous/noisy/duplicate cases, manually documented expectations. Future files: `datasets/ai-evaluation/requests.json`, `rag-queries.json`, README documenting authorship/labeling/normalization and version/hash.

Use record schema `{id,input,expected:{category,priority,team,entities?,missingFields?},tags}`; retrieval schema `{id,query,expectedDocumentCode,expectedSection?,expectedPage?}` mapped to actual seeded document IDs before the run. Keep labels separate from model inputs and do not use predicted results as truth. Persist actual raw safe outcomes and timings separately from seeded historical workflow data.

Dashboards identify seeded operational history and live evaluation provenance. Seeded acceptance history illustrates UI but is never presented as a real model-quality evaluation. Metrics must be computed from stored rows/runs, not constants in components. No benchmark/latency/accuracy values are seeded as measured facts.

## Reset and safety (M10)

demo:reset requires explicit demo environment flag, verified database name/host allowlist and a seed marker, plus a preview of targeted synthetic records. Refuse unknown/non-demo target. Delete/reset only marked synthetic records in dependency-safe transactions; never drop arbitrary databases or recursively remove computed storage paths. Verify local storage targets remain under the configured demo storage root; preserve unrelated files. Re-seed and validate counts/invariants afterward. No destructive reset is executed in M0.

## Acceptance

M2 repeat seed preserves identities/counts and role boundaries; M5 documents genuinely reach READY via embeddings; M6 related-case counts equal real authorized rows; M9 labels independent and results traceable; M10 preflight, warmup, reset refusal on non-demo target, complete/secondary storylines and offline run after dependencies/models are preloaded. Record actual environment and failures, not assumed availability.
