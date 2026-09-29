# M8 Implementation Checklist

Authority: frozen repository specifications and master-plan M8. This checklist records M8 scope only; it is not evidence of a passing gate.

## In scope M8

- [x] STAFF-only, request-scoped Copilot in ASSIGNED/IN_PROGRESS/WAITING_USER/RESOLVED.
- [x] Exactly six fixed actions; no free prompt, arbitrary tool, or business mutation.
- [x] Current approved request state, bounded messages/history/checklist/SLA, strict output, source membership validation, three-call tool budget and stale-context binding.
- [x] Explicit human adoption of generated checklist drafts, human editing/completion/waiver, source provenance, dedupe and expectedVersion.
- [x] Deterministic 30-second SLA sweep using the M3 clock, 20% boundary, current staff + active manager notifications and database dedupe.
- [x] Automatic factual resolution summary, strict event references, immutable resolution-cycle binding, controlled retry and non-blocking failure.
- [x] Owner-only immutable 1–5 feedback after CLOSED.
- [x] Staff Copilot/checklist UI, SLA state, summary states and closed feedback UI.
- [x] Final unit/integration/browser/offline/runtime/security evidence and verification report.

## Out of scope M8

- M9 expanded evaluation corpus, benchmark platform, analytics dashboards, evaluation history and generalized quality claims.
- M10 production deployment, distributed scheduling/exactly-once claims, cloud rollout and final competition hardening.
- USER or MANAGER Copilot, unrestricted chat, arbitrary URLs/shell/SQL, AI assignment/approval/priority/status mutation, automatic checklist adoption/completion, or LLM-based SLA decisions.

## Frozen operational values

- Copilot prompt/schema: `copilot.m8.v2`; summary prompt/schema: `resolution-summary.m8.v3`.
- Copilot history: latest 20 messages and 30 safe successful audit events; maximum three recorded read-only context calls; model context remains under the existing 24,000-character provider bound.
- Generation: per-action native Ollama JSON Schema, `stream=false`, `think=false`, 1,200 output tokens, at most two attempts and therefore at most one bounded repair. The summary model schema selects 1–8 key timeline events while the public contract remains unchanged.
- SLA sweep: 30 seconds, maximum 200 rows per local API process per sweep; risk threshold 20% remaining; equality is on time and breach begins at dueAt + 1 second.
- Scheduler limitation: process-local single API instance for V1; database uniqueness prevents repeated recipient/instance/level warnings but this is not a distributed scheduler claim.
- Resolution summary is queued in the resolve transaction. Provider failure never rolls back staff resolution.
- No M8 migration: the M2 baseline deliberately reserved M8 persistence and uniqueness constraints; all six prior migrations remain frozen.
