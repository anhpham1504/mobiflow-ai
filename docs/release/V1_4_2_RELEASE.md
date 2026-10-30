---
status: active
appliesTo: v1.4.2
releaseStatus: patch-candidate
---

# MobiFlow AI V1.4.2 patch candidate

This document is the canonical current narrative for the V1.4.2 audit-remediation candidate. It does not declare production readiness, deployment, publication, or a new quality result.

## Release identity

| Field | Value |
|---|---|
| Version | `1.4.2` patch candidate |
| Base commit | `d225f0ebacbaf0521ac64349fb4ce9ba6600c092` |
| Base tree | `5b3de63f2eee6441a5845ac0fcb29dc5bb861794` |
| Base tag | `v1.4.1` (not modified) |
| Active generation | DeepSeek, bounded backend-only adapter |
| Active retrieval | PostgreSQL lexical full-text/trigram retrieval |
| Live provider calls in remediation | Disabled and not run |

Machine-readable identity is owned by [`release-metadata.json`](../../packages/config/src/release-metadata.json). Frozen external artifacts and test results are indexed by the [evidence manifest](V1_4_2_EVIDENCE_MANIFEST.json).

## Identity layers and post-tag attestation

The in-repository metadata and evidence manifest record the candidate version and immutable base identity only: `releaseVersion`, `baseCommit`, `baseTree`, and `baseTag`. They intentionally do not embed or claim a future V1.4.2 release commit, tree, or signed tag. A commit cannot truthfully contain its own final commit hash, and this candidate does not assert that a final V1.4.2 tag already exists.

After an authorized signed tag is created, final release identity must be recorded in an external release attestation. That attestation must contain:

- release commit;
- release tree;
- signed tag name;
- annotated tag object;
- signer identity and verification status;
- GitHub Actions run ID;
- required check results; and
- artifact SHA-256 values.

The external attestation supplements this base-identity manifest; it does not rewrite the candidate commit or historical V1.4.1 tag.

## Current request path

1. DeepSeek proposes bounded structured analysis. Model output is untrusted input.
2. PostgreSQL lexical RAG retrieves current, permission-scoped sources.
3. The backend revalidates schema, source membership, source generation, availability, citation IDs, and quoted evidence.
4. Application rules map validated facts to required skills and team. The LLM does not select or rank staff.
5. Deterministic routing filters current eligible staff, chooses the lowest workload, then uses stable staff ID as the tie-break.
6. The protected initial-assignment transaction rechecks current request version, evidence, routing facts, eligibility, and authorization before assignment, SLA, history, audit, and notifications commit together.
7. Weak evidence, missing facts, rule conflict, invalid target, or no eligible candidate produces manager review with no partial assignment.

AI priority remains advisory. The model cannot approve, close, delete, change roles, execute arbitrary tools, or bypass the request state machine. Existing USER, STAFF, and MANAGER authorization and privacy boundaries are unchanged.

## Runtime profiles

The active profile is `AI_GENERATION_PROVIDER=deepseek` plus `RAG_RETRIEVAL_MODE=lexical`. `AI_LIVE_CALLS_ENABLED=false` remains the default and was preserved throughout this remediation.

The explicit rollback profile is `ollama` plus `vector`. Its canonical generation model is `qwen3:4b-instruct-2507-q4_K_M`; its embedding model is `bge-m3:latest`. Rollback is operator-selected, separately preflighted, and never automatic. See the [runbook](V1_4_2_RUNBOOK.md) and [machine checklist](V1_4_2_MACHINE_CHECKLIST.md).

## Documentation classification

| Document set | Classification | Current use |
|---|---|---|
| This reference, runbook, machine checklist, evidence manifest | Active V1.4.2 | Current release and operator guidance |
| Root README | Active V1.4.2 | Current-only entry point and profile summary |
| `docs/archive/README_V1_0_TO_V1_3.md` | Archived V1.0–V1.3 | Historical product narrative; not current release instructions |
| `docs/demo` V1/V1.2 flow documents | Historical V1.4.0 | Lineage only; metadata points here |
| Historical video shot list | Archived demo artifact | Not for the current competition demo |
| `docs/demo/LOCAL_DEMO_ACCOUNTS.md` | Active synthetic utility | Local allowlisted demo accounts only |
| V1.4.1 freeze pack | Immutable external evidence | Referenced by checksum; not modified |

The historical M0 checker remains [`Verify-M0.ps1`](../../scripts/verification/Verify-M0.ps1) and is not a current release gate. The current release documentation gate is `npm run verify:docs:current`.

## Known limits

- No live DeepSeek call or new model-quality evaluation was authorized or run.
- External competition binaries and screenshots remain outside the candidate tree and are referenced by immutable hashes.
- This remediation changes release metadata, documentation, tests, and CI gates only. It does not change AI prompts, output schemas, retrieval behavior, routing rules, state transitions, RBAC, or transaction boundaries.
- Final acceptance requires all reported local gates and the blocking PostgreSQL CI job; it is not a production certification.
