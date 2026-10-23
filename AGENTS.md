# MobiFlow AI repository instructions

## Authority and milestone boundary

Read [the canonical master plan](docs/reference/MOBIFLOW_AI_ASTRA6_M0_M10_MASTER_PLAN.md), [the M0 execution request](docs/reference/M0_EXECUTION_PROMPT.txt), [PROJECT_SPEC](docs/specs/PROJECT_SPEC.md), and the relevant specifications before work. Current user instructions govern authorized execution; archived instructions are not permission to start a later milestone.

The 23 October 2026 owner decision authorizes the isolated V1.3 DeepSeek/lexical migration from baseline `30d47c8d13bb0f44aada79c50527dba88196d32a`. It supersedes the historical Ollama-primary runtime clauses only for this migration. The new demo profile is `AI_GENERATION_PROVIDER=deepseek` plus `RAG_RETRIEVAL_MODE=lexical`; billable calls remain disabled until separate owner approval. The explicit rollback profile remains `ollama` plus `vector`. Do not push, merge, deploy, modify protected worktrees/databases, or run a paid API canary without new authority.

M0 is documentation and specification verification only. Stop after M0 and wait for explicit user approval before M1, even when M0 passes. For subsequent authorized work, follow M1 through M10 in order; never advance past a failing gate. Do not fabricate completed checks. Follow [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md) and update `docs/verification/MILESTONE_X_VERIFICATION.md` using master-plan section 34.

## Frozen V1

- Business roles are exactly `USER`, `STAFF`, `MANAGER`. `AI` and `SYSTEM` are audit/internal actor types, never login roles.
- npm workspaces; Next.js App Router and NestJS, strict TypeScript; REST `/api/v1`; Prisma; one local PostgreSQL instance. DeepSeek is the active generation provider and PostgreSQL lexical search is the active retrieval path; pgvector, historical vectors and the Ollama/vector adapter remain intact for explicit rollback.
- AI uses a provider abstraction, bounded orchestration, real retrieved sources, allowlisted tools, validated structured output, and mandatory human approval for protected business decisions.
- No model tag, embedding dimension, benchmark or accuracy result is valid merely because it appears in an example. Verify locally and record evidence in the appropriate milestone.
- Respect all non-goals in PROJECT_SPEC. The only newly authorized cloud dependency is bounded backend-only DeepSeek generation. No autonomous agent loop, multi-agent product swarm, additional role, second vector database, arbitrary runtime shell/SQL tool, or real customer data.

## Implementation rules for later authorized milestones

1. Inspect Git status, relevant source, config and tests before edits; preserve user work. Do not reset or delete unrelated work.
2. Controllers validate/delegate. Domain services own rules. `RequestStateMachineService` alone writes request status. Authorization and ownership are backend predicates on every read and write, including AI context and files.
3. All request mutations use an expected version; transactional domain writes include history where applicable, audit, assignment/SLA and notifications. A stale operation changes nothing.
4. LLM output is untrusted input. Validate schemas, allowed IDs, current permissions, source membership and source availability. Never pass raw output to Prisma updates or render it as trusted HTML.
5. Preserve original AI suggestions and manager decisions separately. AI cannot approve, assign, close, delete, change roles or execute arbitrary tools. No hidden chain-of-thought in storage, logs or UI; concise `reasonSummary` only.
6. Every schema change needs a migration. Use bound query parameters for lexical/vector SQL and least-privilege database access. Never mix embedding models or dimensions.
7. Never commit secrets, model binaries, real personal data, uploads or raw private prompts. Demo reset must require explicit demo mode and a verified synthetic target.
8. Add only needed dependencies, explain their purpose, and verify compatible versions when implementing. Do not scaffold application frameworks in M0.
9. Test behavior at the owning milestone: transition/authorization negatives, real PostgreSQL integration and deterministic UI tests. Live DeepSeek evaluations are a separate paid gate requiring owner approval; legacy Ollama evaluation belongs only to the rollback profile. Never disable tests or replace measured results with fixtures to pass a gate.
10. Report exact commands and actual results. A unavailable service or missing script is NOT RUN/blocked, not PASS. Update assumptions explicitly when evidence requires clarification; changes to frozen scope need user authorization.

## Documentation ownership

[PROJECT_SPEC](docs/specs/PROJECT_SPEC.md) owns scope and assumptions; [REQUEST_STATE_MACHINE](docs/specs/REQUEST_STATE_MACHINE.md) owns transitions; [AUTHORIZATION_SPEC](docs/specs/AUTHORIZATION_SPEC.md) owns permissions; [SLA_SPEC](docs/specs/SLA_SPEC.md) owns clock math; [AI_BEHAVIOR_SPEC](docs/specs/AI_BEHAVIOR_SPEC.md) owns schemas/taxonomy; [TOOL_CALLING_SPEC](docs/specs/TOOL_CALLING_SPEC.md) owns tool bounds; [RAG_SPEC](docs/specs/RAG_SPEC.md) owns grounding; [DATABASE_SPEC](docs/specs/DATABASE_SPEC.md) and [API_SPEC](docs/specs/API_SPEC.md) map those contracts to storage and transport. Resolve a conflict in the owning document and all affected references; do not silently pick a convenient rule.

M0 checker: `pwsh -NoProfile -File scripts/verification/Verify-M0.ps1`. It verifies documentation structure, not application correctness. A passing script alone does not establish the M0 gate; the manual consistency review is also required.
