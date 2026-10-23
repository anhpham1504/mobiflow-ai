# Business, RBAC and privacy regression

## Preserved invariants

- Login roles remain exactly `USER`, `STAFF`, `MANAGER`; `AI` and `SYSTEM` remain audit actor types only.
- Controllers validate and delegate; domain services retain business rules, and `RequestStateMachineService` remains the request-status writer.
- Expected-version checks, transactional request history/audit/assignment/SLA/notification behavior and stale-operation no-op semantics remain in place.
- LLM output remains untrusted: schemas, allowlisted IDs, source membership/currentness and permissions are validated before publication.
- AI cannot approve, assign, close, delete, change roles or execute arbitrary SQL/shell/tools. Original suggestions and human decisions remain separate.
- Protected recommendation decisions still require manager review. The browser scenario confirmed a manager-authored draft and acceptance before assignment, followed by a staff start transition.

## Test evidence

- The 320 deterministic tests include authorization, workflows, analysis, knowledge, recommendations, operational tools, analytics, SLA, templates, internal notes, mentions/watchers and rate limits.
- The rollback-profile real PostgreSQL runner passed auth 1/1, workflow 3/3, knowledge 5/5, analysis 5/5, recommendation/approval/Copilot/analytics 32/32 and dashboard/SLA 1/1; one separate live-Ollama item was skipped.
- Browser: USER access to the manager route returned 403; a USER request stayed `NEW` when live AI was disabled; MANAGER approval produced `ASSIGNED` with SLA 120 and retained human decision; STAFF start produced `IN_PROGRESS`; degraded Copilot did not change state.
- Lexical source validation excludes disabled/stale generations and revalidates source membership at recommendation-read time.

## Privacy boundary

Only synthetic fixtures were used. No real customer data was copied into the clone, prompts, screenshots or reports. The backend redactor covers common email, phone and secret/token patterns and the origin is allowlisted, but this is not enterprise DLP. Before any live use, the owner must approve the privacy/retention/egress policy and the exact synthetic canary content. Raw provider prompts/responses and hidden reasoning are not an approved evidence artifact.
