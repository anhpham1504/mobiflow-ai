# ADR 0004: Controlled AI orchestration

Status: Accepted for V1 at M0 (2026-09-28).

## Context

MobiFlow must combine understanding, actual SOPs and business tools without granting a model business authority. Master-plan §§4.2–4.5, 23–26 and 37 prohibit uncontrolled autonomy, arbitrary tools and invented evidence.

## Decision

Use a fixed backend pipeline: extraction/classification, retrieval, similar cases, policy/candidates/workload, synthesis, strict validation, pending human review. Six allowlisted tools have schemas, purpose/scope checks, timeouts/count/size budgets and safe telemetry. Backend controls iterations with bounded retry; no open-ended planner, agent swarm or arbitrary shell/SQL/HTTP executor.

## Alternatives and consequences

Open-ended agents/frameworks add unnecessary authority and recovery complexity. A chatbot-only interface would miss the required workflow. Fixed stages trade flexibility for auditability and predictable failures. Backend computations own ranking, counts and SLA; model output stays advisory and untrusted. Source-ID validation still requires semantic evaluation and human review.

## Verification and scope

M4 invalid-output/recovery tests; M5 source/dimension validation; M6 allowlist/ID/scope/timeout tests; M8 grounded Copilot/summary; M10 adversarial review. No runtime orchestrator is implemented in M0. See [TOOL_CALLING_SPEC](../../specs/TOOL_CALLING_SPEC.md) and [AI_SAFETY_SPEC](../../specs/AI_SAFETY_SPEC.md).
