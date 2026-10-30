---
status: historical
appliesTo: v1.4.0
notForCompetitionDemo: true
supersededBy: ../release/V1_4_2_RELEASE.md
---

# MobiFlow AI — competition submission package

Prepared 2026-09-30 for a local synthetic demonstration. Release status: **PASS** for the documented V1 scope after one controlled final evaluation passed the unchanged comparator. Historical RED runs remain disclosed; this is not an enterprise-production certification.

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

Measured development evidence: the approved M9 run matched 68/100 exact labels; historical M10 runs matched 68/100 and 69/100 and included RED comparisons. The single final controlled V1 run matched 68/100 exact labels, with 100/100 schema-valid, 99/100 first-attempt-valid, one repair, zero terminal failures and no comparator flags. These synthetic exact-label results are not generalized accuracy. No productivity, customer adoption, ROI, uptime or production-scale claim is made.
