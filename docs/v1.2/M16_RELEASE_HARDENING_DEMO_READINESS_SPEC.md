# MOBIFLOW AI V1.2 — M16 RELEASE HARDENING & DEMO READINESS

This message is the authoritative user authorization for M16.

Create:

`docs/v1.2/M16_RELEASE_HARDENING_DEMO_READINESS_SPEC.md`

and reference it from the V1.2 index.

Do not rewrite M0–M15 history.

---

# BASELINE

M15 checkpoint:

`310b6db40e8b42189baa665eb04958e999eec0dc`

Branch:

`feat/v1.2-ai-evaluation-reliability-v2`

Checkpoint state:

- working tree CLEAN
- committed YES
- pushed YES
- tagged NO
- merged NO
- deployment NOT RUN
- migration count 7
- M15 PASS
- M16 NOT STARTED

Current product:

- Next.js web
- NestJS API
- Prisma
- PostgreSQL + pgvector
- Ollama local AI
- Recommendation V2 advisory-only
- human approval required for business actions
- USER / STAFF / MANAGER RBAC
- existing RAG, Copilot and analytics retained

AI runtime baseline:

- Ollama
- `qwen3:4b-instruct-2507-q4_K_M`
- `bge-m3:latest`

M15 evidence:

- root tests 168/168 PASS
- targeted M15 98/98 PASS
- PostgreSQL 26/26 PASS
- browser 4/4 PASS
- evaluation 100/100 + consistency 30/30 PASS
- reliability matrix 24/24 PASS

Known limitation:

Synthetic evaluation does not prove production accuracy.

---

# M16 GOAL

M16 is:

**Release Hardening & Demo Readiness V1.2**

M16 does NOT introduce a new major feature.

Goal:

prove that a clean/local V1.2 environment can be installed, migrated, started, verified, demonstrated and recovered predictably.

Focus:

- fresh setup
- migration safety
- runtime readiness
- Docker/local startup
- configuration validation
- demo data
- full user-flow demo
- AI degradation behavior
- restart/recovery
- security sanity
- release packaging
- runbook
- operator diagnostics

M16 prepares the repository for M17 finalization.

---

# NON-GOALS

Do NOT add:

- new AI feature
- new role
- autonomous agent
- new Copilot action
- new analytics feature
- staff ranking
- predictive AI
- cloud AI provider
- paid service
- major UI redesign
- new business workflow
- M17 release/tag/merge

No speculative refactoring.

---

# 1. FRESH ENVIRONMENT VALIDATION

Verify a fresh environment can be prepared from repository documentation.

Use an isolated environment/database.

Do not destroy the developer's existing demo data.

Validate:

- dependencies install
- required environment variables
- PostgreSQL startup
- pgvector availability
- Prisma generation
- migrations 1 → 7
- seed/demo data
- API startup
- web startup
- health/readiness
- Ollama detection

Document exact commands.

Do not rely on undocumented machine state.

---

# 2. CONFIGURATION VALIDATION

Audit required configuration.

Classify:

## REQUIRED

Configuration without which core app cannot start.

## OPTIONAL

Configuration required only for optional AI/demo functionality.

## SECRET

Credentials/tokens that must never be committed.

Fail startup clearly for invalid critical configuration.

Do not expose secrets in:

- logs
- API
- browser
- evidence
- generated reports

Do not commit `.env`.

Provide or validate safe `.env.example` if repository convention supports it.

---

# 3. DATABASE / MIGRATION HARDENING

Migration count baseline:

`7`

M16 should NOT add a migration unless a real release blocker requires it.

Test migrations on isolated PostgreSQL.

Required checks:

- empty DB → migration 1–7
- schema reaches expected state
- seed succeeds
- existing V1-style records remain readable if fixture exists
- M14 nullable confidence migration behaves correctly
- rerunning normal startup does not corrupt DB
- failed migration does not silently continue

Do not run reset against existing demo DB.

Do not migrate production.

Expected default:

Schema changed: NO
Migration added: NO
Migration count: 7

---

# 4. STARTUP / READINESS

Verify application behavior for:

## Normal startup

PostgreSQL + API + web + Ollama available.

## Ollama unavailable

Core application must remain usable.

AI feature must fail gracefully.

No API process crash.

## PostgreSQL unavailable

Readiness must truthfully indicate failure.

No false healthy state.

## Ollama becomes available later

If existing architecture supports recovery, confirm AI works again without unsafe manual state mutation.

## Restart

Restart API/web and ensure persisted business state remains correct.

Do not introduce a new orchestration platform.

---

# 5. HEALTH CHECKS

Review existing health/readiness endpoints.

They must distinguish where appropriate:

- process alive
- database ready
- optional AI provider state

Do not report whole application DOWN solely because optional Ollama is unavailable unless existing specification explicitly requires it.

Do not expose:

- connection strings
- credentials
- internal stack traces

---

# 6. DEMO DATA

Create or verify a deterministic local demo dataset.

Reuse existing safe seed architecture where possible.

Demo should provide enough data for:

- USER
- STAFF
- MANAGER
- requests in useful states
- assignment
- SLA
- feedback
- Recommendation V2
- Copilot
- Analytics V2

Do not fabricate production/customer data.

Clearly label demo/synthetic data.

Seed must remain idempotent if repository contract expects idempotency.

Do not weaken production seed/reset guards.

---

# 7. END-TO-END DEMO FLOW

Create one canonical demo scenario.

The runbook should allow a reviewer to demonstrate the product without discovering the workflow live.

Minimum scenario:

## USER

- login
- create/view request
- observe allowed status/data

## STAFF

- login
- view assigned work
- perform allowed staff workflow
- use permitted AI/Copilot capability if applicable

## MANAGER

- view operational context
- generate Recommendation V2
- inspect evidence/checklist/warnings
- accept or modify advisory recommendation
- demonstrate that AI review does NOT execute business action
- explicitly perform manual business approval
- verify assignment/SLA/checklist downstream
- view Analytics V2

The demo must visibly preserve:

AI suggestion
→ human review
→ explicit business decision

Never collapse these into one autonomous step.

---

# 8. AI DEMO BEHAVIOR

Do not rerun the full M15 100+30 evaluation unless AI behavior is changed.

For release/demo readiness, test a small bounded live smoke.

Suggested:

3–5 representative Recommendation V2 cases.

Check:

- Ollama reachable
- structured output valid
- evidence visible
- missing information handled
- no autonomous action
- acceptable loading state

This is a smoke test only.

Do not claim new accuracy evidence.

---

# 9. OFFLINE / FAILURE DEMO

Document expected operator behavior when:

- Ollama offline
- database unavailable
- invalid env
- port occupied
- stale session
- recommendation generation fails

Provide clear recovery steps.

Do not add automatic destructive recovery.

Do not silently reset DB.

---

# 10. SECURITY HARDENING

Run focused release security checks for:

- USER → MANAGER API denied
- STAFF → MANAGER recommendation API denied
- expired/revoked session denied
- IDOR protections
- stale expected-version protections
- no raw prompt exposure
- no raw model output bypass
- no secret leakage
- CSP
- authenticated response cache policy
- unsafe HTML rendering
- production error sanitization

Do not perform a fake penetration-test claim.

Report this as targeted release hardening.

---

# 11. UI / RESPONSIVE DEMO CHECK

Perform final targeted browser review at:

- 360
- 768
- 1440
- 1920

Focus on the canonical demo path.

Check:

- no page-wide horizontal overflow
- loading/error/empty states
- readable AI recommendation
- human-vs-AI decision distinction
- dialogs
- keyboard
- focus
- dark/light mode if currently supported
- Vietnamese copy
- Axe serious/critical = 0

Do not redesign the product.

Only fix actual release blockers or obvious demo defects.

---

# 12. LOGGING / DIAGNOSTICS

Review operator-visible logs.

Ensure failures identify useful categories such as:

- database unavailable
- provider unavailable
- invalid AI response
- authorization rejection
- migration/startup problem

without logging:

- password
- refresh token
- JWT
- connection-string secret
- system prompt
- hidden reasoning
- unnecessary request PII

Do not add a new observability platform.

---

# 13. CLEAN BUILD / PACKAGING

Verify release candidate can be built from clean state.

Required:

- install
- Prisma generation if applicable
- lint
- typecheck
- unit tests
- production build
- relevant integration
- relevant browser smoke

Ensure build does not depend on:

- stale `.next`
- local generated artifacts
- untracked files
- developer-only absolute path

Check gitignored runtime/output directories.

---

# 14. DOCUMENTATION / RUNBOOK

Update or create V1.2-specific demo/release docs.

Required:

`docs/v1.2/M16_RELEASE_HARDENING_DEMO_READINESS_SPEC.md`

`docs/v1.2/M16_RELEASE_HARDENING_DEMO_READINESS_IMPLEMENTATION_PLAN.md`

`docs/v1.2/M16_RELEASE_HARDENING_DEMO_READINESS_VERIFICATION.md`

`docs/verification/MILESTONE_16_VERIFICATION.md`

Update existing:

`docs/demo/DEMO_RUNBOOK.md`

only where V1.2 changed the actual demo.

Do not rewrite historical milestone evidence.

---

# 15. DEMO RUNBOOK CONTENT

Runbook should include:

## Prerequisites

- Node
- PostgreSQL
- pgvector
- Ollama
- model
- embedding

## Startup

Exact commands.

## Demo accounts

Use repository-approved demo identities only.

Do not expose real passwords in committed docs unless the repository intentionally uses clearly synthetic local demo credentials.

## Demo order

USER → STAFF → MANAGER.

## AI demo

Exact scenario.

## Analytics demo

Exact filters/range useful for showing M13 Analytics V2.

## Recovery

Common failures and commands.

## Shutdown

Safe shutdown/cleanup.

---

# 16. RELEASE INVENTORY

Produce a V1.2 release inventory containing:

- migration count
- API routes changed since V1.1
- major UI additions
- AI version
- prompt version
- recommendation schema
- dataset/evaluation evidence identity
- known limitations
- required services
- optional services
- demo runbook path

Do not create release/tag yet.

---

# 17. TEST POLICY

Do NOT blanket rerun M0–M15.

Run release-relevant gates.

Minimum:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- fresh migration/setup validation
- targeted real PostgreSQL smoke/integration
- targeted browser demo E2E
- targeted RBAC/security checks
- small live Ollama smoke
- `git diff --check`

Only rerun M15 100+30 if Recommendation V2 behavior/prompt/schema changes.

If prompt changes:

M15 evaluation becomes affected and must be rerun.

Avoid changing prompt unless absolutely necessary.

---

# 18. RELEASE BLOCKER POLICY

Release blocker examples:

- fresh setup cannot succeed
- migration failure
- startup requires undocumented state
- core app crashes if Ollama offline
- incorrect readiness
- broken RBAC
- unsafe IDOR
- secret exposure
- Recommendation V2 bypasses human approval
- canonical demo cannot complete
- production build failure
- major responsive/accessibility regression

Non-blocking examples unless severe:

- local Ollama latency
- known synthetic-evaluation limitation
- minor wording imperfection
- cosmetic differences
- non-critical demo polish

Do not hide blockers.

---

# 19. GIT POLICY

Create M16 branch from:

`310b6db40e8b42189baa665eb04958e999eec0dc`

Suggested branch:

`feat/v1.2-release-hardening-demo-readiness`

Do not commit M16 automatically.

Leave working tree reviewable.

Do not:

- push
- tag
- merge
- deploy
- create `v1.2.0`
- start M17

unless separately authorized.

---

# 20. FINAL REPORT

Return:

# MOBIFLOW AI V1.2 — M16 RELEASE HARDENING & DEMO READINESS FINAL REPORT

**M16 PASS / BLOCKED / FAIL — READY / NOT READY FOR HUMAN REVIEW. M17 NOT STARTED.**

## BASELINE

M15 checkpoint:
...

Branch:
...

Starting HEAD:
...

## FRESH SETUP

Dependencies:
...

Database:
...

Migrations:
...

Seed:
...

API:
...

Web:
...

Ollama:
...

## DATABASE

Schema changed:
YES / NO

Migration added:
YES / NO

Migration count:
...

Fresh migration:
PASS / FAIL

## STARTUP / HEALTH

...

## DEMO FLOW

USER:
...

STAFF:
...

MANAGER:
...

AI advisory/manual approval boundary:
PASS / FAIL

## AI SMOKE

Model:
...

Cases:
...

Result:
...

Full M15 evaluation rerun:
YES / NO

## SECURITY

RBAC:
...

IDOR:
...

Session:
...

Secrets:
...

CSP/cache/errors:
...

## UI / ACCESSIBILITY

360:
...

768:
...

1440:
...

1920:
...

Axe:
...

Keyboard:
...

## FAILURE / RECOVERY

Ollama offline:
...

Database offline:
...

Invalid env:
...

Restart:
...

## BUILD / TESTS

List exact commands and exact results.

## RELEASE INVENTORY

...

## DOCUMENTATION

...

## GIT

Files changed:
...

Committed:
NO

Pushed:
NO

Tagged:
NO

Merged:
NO

Deployment:
NOT RUN

## KNOWN LIMITATIONS

...

## RELEASE BLOCKERS

None / list.

## NEXT

M17: NOT STARTED.

## FINAL GATE

**M16: PASS / BLOCKED / FAIL — ...**

STOP.

Do not implement M17.
