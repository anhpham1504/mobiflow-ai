# MobiFlow AI

AI-native enterprise workflow automation platform with local AI.

The repository currently contains the **M0 specifications and architecture freeze**. Application scaffolding, dependencies and runtime features begin in M1 after explicit approval. No application startup or npm commands are available yet.

Start with [AGENTS.md](AGENTS.md), the [project scope and assumption register](docs/specs/PROJECT_SPEC.md), [architecture](docs/architecture/ARCHITECTURE.md), and [M1–M10 implementation/dependency map](docs/IMPLEMENTATION_PLAN.md). The [canonical master plan](docs/reference/MOBIFLOW_AI_ASTRA6_M0_M10_MASTER_PLAN.md) and [M0 execution request](docs/reference/M0_EXECUTION_PROMPT.txt) are preserved for provenance.

M0 evidence: [repository baseline](docs/verification/REPOSITORY_BASELINE.md), [cross-document review](docs/verification/M0_CONSISTENCY_REVIEW.md), and [milestone verification](docs/verification/MILESTONE_0_VERIFICATION.md).

Run the documentation structure check from this directory with PowerShell 7:

```powershell
pwsh -NoProfile -File scripts/verification/Verify-M0.ps1
```

This checks document integrity and M0 scope; it does not test an application, local model or database. Runtime gates remain assigned to M1–M10.
