# Live fact-retention results

All three live analysis runs completed on the first dispatched attempt. Pre-publication validation accepted the backend-owned projection; no paid retry or fact-fabricating fallback was used.

| Scenario | Mandatory fact | Raw model output | Retention layer | Published output | Authorized UI | Verdict |
|---|---|---|---|---|---|---|
| QA-CONFLICT-008 | Field power working | Raw provider text not retained; persisted model-derived reason summary includes it | Exact USER_REPORTED observation | Present | MANAGER screenshot | PASS |
| QA-CONFLICT-008 | 12 devices offline | Raw text unavailable; structured analysis has `affectedCount=12` | Exact observation | Present | MANAGER screenshot | PASS |
| QA-CONFLICT-008 | Network restored reported at 14:00 | Raw text unavailable; structured reason summary includes 14:00 | Exact observation | Present | MANAGER screenshot | PASS |
| QA-CONFLICT-008 | Contradiction / no verified root cause | Structured reason summary records the conflict and unverified cause | Contradiction projection retained | Present; request remains TRIAGED | MANAGER screenshot | PASS |
| QA-NOANSWER-009 | `PROTO-DEMO-917` | Raw text unavailable; structured reason summary preserves the code | Exact TECHNICAL_IDENTIFIER | Present | MANAGER screenshot | PASS |
| QA-NOANSWER-009 | No verified SOP | No raw claim made | No retained citation; insufficient evidence | Zero source/citation | MANAGER review path | PASS |
| QA-IOT-001 | 23 SIMs | Raw text unavailable; structured entities have 23 | Exact observations | Present | MANAGER screenshot | PASS |
| QA-IOT-001 | 09:15 / Omega | Structured entities retain both | Exact observations | Present | MANAGER screenshot | PASS |
| QA-IOT-001 | Gateway restart attempted | Structured reason summary includes gateway | Troubleshooting attempt retained | Present | MANAGER screenshot | PASS |
| QA-IOT-001 | Restart did not help | Structured reason summary includes `NO_IMPROVEMENT` | Outcome `NO_IMPROVEMENT` retained | Present through resolution summary | MANAGER/STAFF/USER workflow | PASS |

The retention source is `BACKEND_LITERAL_EXTRACTION` with `USER_REPORTED` provenance. USER API/UI projections omit the internal retention block; MANAGER receives the validated projection. Evidence: [database/API audit](evidence/database-api-audit.json).
