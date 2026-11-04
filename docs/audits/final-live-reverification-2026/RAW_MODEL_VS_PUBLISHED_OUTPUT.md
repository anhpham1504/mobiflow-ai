# Raw model versus published output

## Evidence boundary

The egress guard intentionally stores request-body hashes, provider IDs, token usage and cost. The application stores validated structured analysis and a response digest, but not the raw DeepSeek response text. Therefore:

- **Raw provider text:** unavailable; no raw-text retention PASS is claimed.
- **Model-derived structured fields:** available in the persisted `Analysis` rows and include the required counts, times, identifiers, uncertainty and troubleshooting result.
- **Deterministic retention:** independently reconstructed from original request text, validated against source hash/version/provenance, and persisted in the safe result.
- **Published result:** combines validated structured analysis, current grounding and role-filtered fact projection.

| Scenario | Persisted model-derived result | Deterministic projection | Published/system verdict |
|---|---|---|---|
| QA-CONFLICT-008 | 12 devices, 14:00, power working, conflict, cause unverified | Exact observations plus contradiction evidence | PASS |
| QA-NOANSWER-009 | Exact `PROTO-DEMO-917`, knowledge limitation | Exact identifier, no invented source | PASS |
| QA-IOT-001 | 23, 09:15, Omega, gateway and `NO_IMPROVEMENT` | Exact observations and troubleshooting outcome | PASS |

Final classification: **SYSTEM-LEVEL PASS / RAW-MODEL LIMITATION**. This limitation is evidentiary, not a discovered publication defect.
