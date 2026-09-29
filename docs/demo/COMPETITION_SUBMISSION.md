# MobiFlow AI — competition submission package

Prepared 2026-09-30 for a local synthetic demonstration. Release status: **BLOCKED** at the M10 verification gate; the longitudinal live-evaluation comparison is still red. This package describes implemented behavior, not an approved production release.

MobiFlow AI connects Vietnamese service intake to sourced guidance, a proposed work plan, human approval, staff execution, resolution and measured outcomes. The three login roles are USER, STAFF and MANAGER. AI and SYSTEM are internal audit actors.

The demonstrable path uses real local Ollama generation and embeddings, PostgreSQL/pgvector retrieval, permission-scoped tools and transactional domain services. A manager approves or modifies a recommendation before assignment. Staff complete work; the owner confirms closure. All demonstration customers, requests and documents are synthetic.

Submission contents:

1. [Product description](PRODUCT_DESCRIPTION.md)
2. [AI model disclosure](AI_MODEL_DISCLOSURE.md)
3. [Five-minute script](DEMO_SCRIPT_5_MIN.md)
4. [Ten-minute script](DEMO_SCRIPT_10_MIN.md)
5. [Judge Q&A](JUDGE_QA.md)
6. [Video shot list](VIDEO_SHOT_LIST.md)
7. [Before/after evidence](BEFORE_AFTER_EVIDENCE.md)
8. This submission overview

Operator preparation is in [DEMO_RUNBOOK](DEMO_RUNBOOK.md). The authoritative result is [FINAL_VERIFICATION](../verification/FINAL_VERIFICATION.md), with [security](../verification/SECURITY_AUDIT.md), [AI safety](../verification/AI_SAFETY_AUDIT.md) and the [release checklist](../release/M10_RELEASE_CHECKLIST.md).

Measured development evidence: the approved M9 run matched 68/100 exact labels; M10 runs matched 68/100 and 69/100. Each produced 100/100 final schema-valid results and no terminal failures. The isolated M10 run still has two lost matches and 83 per-case latency regressions above the existing 1.5× comparison boundary. No productivity, customer adoption, ROI, uptime or production-scale claim is made.
