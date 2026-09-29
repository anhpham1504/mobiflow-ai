# M9 AI Evaluation Report

Generated: 2026-09-29T14:17:47.313Z

Dataset: requests.m9.v2 (100 synthetic development cases; SHA-256 `e462988851955ed05edbb8c6b05dd5b73b4bc9c975bb60be42b3f2999ac6bc44`)

Provider/model: Ollama / `qwen3:4b-instruct-2507-q4_K_M`

## Metrics

- Passed expected category, priority and deterministic team route: 68/100
- Schema valid: 100/100
- First-attempt valid: 99/100
- Repaired success: 1/100
- Terminal failures: 0/100
- Latency mean/p50/p95/max: 2775 / 2704 / 3116 / 6597 ms
- Reference validity: not applicable to intake classification; M5/M8 evidence remains separately reported.

## Methodology and limitations

100 synthetic development cases with specification-authored labels; not real customer data, prevalence, calibrated confidence, or generalized accuracy. Reference validity is not applicable to intake classification and is reported separately as null.

Expected labels never enter prompts. Failures remain in all denominators. No model-as-judge is used.
