---
status: historical
appliesTo: v1.4.0
notForCompetitionDemo: true
supersededBy: ../release/V1_4_2_RELEASE.md
---

# Before/after evidence

The comparison is between implemented manual and assisted workflows, not a productivity study.

| Task | Manual path | Assisted path | Evidence |
|---|---|---|---|
| Intake | MANAGER enters category, priority and plan | Model proposes facts and flags missing fields | M3/M4 integration and E2E |
| Find guidance | Operator reviews available knowledge | Real pgvector retrieval supplies current source IDs/excerpts | M5 live clean-database/RAG evidence |
| Choose staff | MANAGER selects eligible staff | Bounded tools rank candidates; MANAGER decides | M6/M7 integration and E2E |
| Execute work | STAFF writes/completes checklist and resolution | Copilot drafts are explicitly adopted; factual summary is optional | M8 E2E and outage checks |
| Observe outcomes | Stored request/SLA history | Stored AI latency/failure and reviewed recommendation outcomes | M9 analytics/privacy tests |

No manual timing benchmark was performed. [The protocol](../evaluation/MANUAL_TIME_BENCHMARK.md) is available, but reduction in effort, productivity improvement and business ROI are **not measured**.

| Live intake evidence | Exact matches | Schema-valid | First valid / repaired / failed | Mean / p50 / p95 / max (ms) |
|---|---:|---:|---|---|
| Approved M9 | 68/100 | 100/100 | 99 / 1 / 0 | 2774.87 / 2704 / 3116 / 6597 |
| M10 contended | 68/100 | 100/100 | 99 / 1 / 0 | 4942.51 / 4786 / 5621 / 11023 |
| M10 isolated | 69/100 | 100/100 | 99 / 1 / 0 | 4441.65 / 4377 / 5147 / 9386 |

Dataset SHA-256: `e462988851955ed05edbb8c6b05dd5b73b4bc9c975bb60be42b3f2999ac6bc44`. These synthetic specification-authored labels are not independent semantic ground truth or generalized model accuracy. The isolated comparison still reports two pass-to-fail priority cases and 83 latency regressions. [Full investigation](../evaluation/M10_EVALUATION_INVESTIGATION.md) retains all runs and limitations.
