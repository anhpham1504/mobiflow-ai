---
status: historical
appliesTo: v1.4.0
notForCompetitionDemo: true
supersededBy: ../release/V1_4_2_RELEASE.md
---

# AI model disclosure

| Component | Verified configuration | Role |
|---|---|---|
| Runtime | Windows-host Ollama; observed CLI version 0.34.4 on 2026-09-30 | Local generation/embedding endpoints |
| LLM | `qwen3:4b-instruct-2507-q4_K_M` | Structured intake, grounded recommendations, constrained Copilot and factual summary |
| Embedding | `bge-m3:latest`, actually probed 1024 dimensions | Knowledge and request similarity vectors in PostgreSQL/pgvector |
| Intake prompt/schema | `request-analysis.v4` / `analysis.v1` | Versioned validation contract |

The models were not custom-trained for this project. No custom-training or model-ownership claim is made. Exact installed identities must pass preflight; a tag in this document is not evidence of installation on another machine.

The inference adapter sends JSON Schema, `stream=false`, `think=false`, temperature 0, seed 42, `num_predict=1200`, and `num_ctx=16384`. It allows at most two attempts with bounded deadlines. Temperature zero and a fixed seed did not establish identical outputs across the recorded local runs. AI text is untrusted; schema, reference, permission and current-state checks execute outside the model.

M9 and both M10 runs use the same 100-case dataset and inference source. The two M10 runs and their red comparisons are retained. See [investigation](../evaluation/M10_EVALUATION_INVESTIGATION.md) for actual timings and evidence gaps. Intake reference validity is not applicable; retrieval and Copilot reference checks are separate. No unrestricted model output, confidential prompt or hidden reasoning is part of the release evidence.
