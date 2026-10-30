# MobiFlow AI

> **V1.4.2 release overview.** The active profile is DeepSeek generation with PostgreSQL lexical retrieval. Live provider calls are disabled by default and require separate authorization. Release status and final signed-tag identity are established by canonical release metadata and a post-tag external attestation; this README does not itself establish production readiness.

The current controlled flow is: DeepSeek structured analysis → PostgreSQL lexical RAG → backend schema/citation revalidation → application-owned skill/team mapping → deterministic eligible-staff routing → protected initial auto-assignment. Weak evidence, missing routing facts, conflicts, or no eligible candidate fail closed to manager review. The LLM never chooses a staff member and priority suggestions remain advisory.

Use the [V1.4.2 release reference](docs/release/V1_4_2_RELEASE.md), [operator runbook](docs/release/V1_4_2_RUNBOOK.md), [machine checklist](docs/release/V1_4_2_MACHINE_CHECKLIST.md), and [evidence manifest](docs/release/V1_4_2_EVIDENCE_MANIFEST.json) for current work. The canonical rollback profile is explicit `ollama` + `vector`, with generation model `qwen3:4b-instruct-2507-q4_K_M` and embedding model `bge-m3:latest`; it is never an automatic fallback.

Historical V1.0–V1.3 product documentation is preserved in the [archived narrative](docs/archive/README_V1_0_TO_V1_3.md).
