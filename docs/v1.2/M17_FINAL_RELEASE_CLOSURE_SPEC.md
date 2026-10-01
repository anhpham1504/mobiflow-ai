# MOBIFLOW AI V1.2 — M17 FINAL RELEASE CLOSURE

Bạn chịu trách nhiệm **đóng chính thức MobiFlow AI V1.2 và tạo release `v1.2.0`**.

Đây là RELEASE CLOSURE TASK.

Không phát triển feature mới.

Không refactor lớn.

Không replay toàn bộ M0–M16.

---

# 1. COMPRESSED CONTEXT

Project:

```text
MobiFlow AI
```

Stack:

```text
Next.js
NestJS
Prisma
PostgreSQL + pgvector
Ollama
npm monorepo
Playwright
Docker Compose
```

Roles:

```text
USER
STAFF
MANAGER
```

Core safety:

```text
Backend RBAC authoritative
AI advisory only
Human approval required
expectedVersion preserved
Audit/history preserved
RAG uses authorized real sources
AI cannot directly approve/assign/close protected actions
```

---

# 2. RELEASE HISTORY

```text
v1.0.0
→ M0–M10

v1.1.0
→ Enterprise UI Refresh

V1.2
M11 Dashboard Aggregates
M12 SLA Engine V2
M13 Analytics V2
M14 Recommendation V2
M15 AI Evaluation & Reliability V2
M16 Release Hardening & Demo Readiness
M17 Final Release Closure ← CURRENT TASK
```

---

# 3. AUTHORITATIVE BASELINE

M16 checkpoint:

```text
SHA:
8511a29529d82d4ed4adbcf5e4d49a6bacec73e4
```

Branch:

```text
feat/v1.2-release-hardening-demo-readiness
```

M16 closure state:

```text
PASS
Committed: YES
Pushed: YES
Remote SHA matches local
Working tree: CLEAN
Tagged: NO
Merged: NO
Deployment: NOT RUN
```

Database:

```text
Schema change in M16: NO
Migration count: 7
```

Expected before M17:

```text
v1.2.0 tag: ABSENT
main: not merged with M16
```

---

# 4. M16 ACCEPTED EVIDENCE

Do NOT rerun full M16 unless a release blocker appears.

Already PASS:

```text
lint
typecheck
unit 170/170
build

database 8/8
runtime/http 17/17
browser 2/2
security 13/13
browser-state 1/1
recovery 9/9
packaging/review 8/8

responsive 360/768/1440/1920
20 Axe scans
0 serious
0 critical
```

M16 found:

```text
release blockers: NONE
```

---

# 5. CURRENT KNOWN RUNTIME NOTE

At M16 checkpoint closure:

```text
Docker Engine was not available
ports 2500/2501 refused connection
```

This happened after accepted M16 verification.

It did NOT invalidate M16 evidence.

M17 must perform only a **minimal runtime sanity check** before release.

Do NOT replay the full hardening suite.

---

# 6. M17 GOAL

M17 must:

```text
preflight Git
→ minimal runtime sanity
→ final release audit
→ finalize V1.2 release docs
→ commit only if docs require changes
→ safely merge into main
→ create annotated v1.2.0 tag
→ push main
→ push tag
→ verify remote release boundary
→ stop
```

---

# 7. STRICT NON-GOALS

Do NOT implement:

```text
new dashboard metrics
new analytics
Recommendation V3
new AI evaluation
new SLA behavior
new role
new Copilot action
dark mode
mobile app
new integration
schema redesign
dependency upgrade
```

No product feature work.

---

# 8. DO NOT REPLAY HISTORICAL TESTS

Do NOT automatically run:

```text
M0
M1
M2
M3
M4
M5
M6
M7
M8
M9
M10
M11
M12
M13
M14
M15
full M16
```

unless a M17 change directly modifies that subsystem.

M17 should normally run only:

```text
Git safety checks
minimal runtime sanity
git diff --check
release documentation validation
tag/merge verification
```

---

# 9. PREFLIGHT

Run:

```powershell
git status
git branch --show-current
git rev-parse HEAD
git log -8 --oneline --decorate
git tag --list
git remote -v
```

Expected:

```text
branch =
feat/v1.2-release-hardening-demo-readiness

HEAD =
8511a29529d82d4ed4adbcf5e4d49a6bacec73e4

working tree =
CLEAN
```

Verify remote branch:

```powershell
git ls-remote origin refs/heads/feat/v1.2-release-hardening-demo-readiness
```

Local and remote checkpoint SHA must match.

---

# 10. VERIFY RELEASE TAG ABSENT

Run:

```powershell
git tag --list v1.2.0
git ls-remote --tags origin v1.2.0
```

Expected:

```text
v1.2.0 does not exist locally
v1.2.0 does not exist remotely
```

If it already exists:

STOP.

Do not overwrite or move the tag.

---

# 11. VERIFY MAIN SAFETY

Inspect:

```powershell
git fetch origin
git log --oneline --decorate --graph --all -20
git rev-parse main
git rev-parse origin/main
```

Do not assume main has not moved.

If remote main contains unexpected newer work:

do NOT force merge.

STOP and report divergence.

No force push.

No history rewrite.

---

# 12. MINIMAL RUNTIME SANITY

Because Docker was unavailable at the final checkpoint read-only check, restore Docker only for final release sanity.

Do NOT create a new isolated M16 stack.

Prefer the normal developer stack.

Start Docker Desktop if necessary.

Then inspect:

```powershell
docker version
docker compose ps
```

Expected project:

```text
mobiflow-ai
```

If normal stack is stopped, start using established project commands only.

Do not reset DB.

Do not reseed unless absolutely required by established startup procedure.

Do not migrate again if database is already current.

---

# 13. FINAL RUNTIME CHECK

Verify only:

```text
PostgreSQL container healthy
API healthy
Web healthy
web responds 200
liveness responds 200
readiness reports expected state
```

If Ollama is available:

```text
AI READY
RAG READY
```

If Ollama is unavailable but core application is healthy:

do not automatically block release if existing contract allows truthful DEGRADED state.

But release must not falsely report AI READY.

---

# 14. FINAL SMOKE

Perform a very small smoke only.

At minimum:

```text
/login loads
one USER login
one MANAGER login
dashboard loads
one request detail loads
analytics page loads for MANAGER
```

No need to create a new full request lifecycle unless a failure is observed.

Do not generate multiple new live AI cases.

---

# 15. NO FULL AI EVALUATION

Do NOT rerun M15 100+30 evaluation.

M15 remains authoritative for evaluation evidence.

Only verify identities remain unchanged:

```text
Recommendation schema
prompt identity/hash
dataset identity/hash
model config
parser
```

where existing release inventory already documents them.

---

# 16. DATABASE FINAL CHECK

Confirm:

```text
migration count = 7
schema unchanged since M16
no pending migration
```

Do not add migration 8.

Do not edit historical migration SQL.

Do not reset developer DB.

---

# 17. RELEASE DOCUMENT AUDIT

Inspect:

```text
docs/v1.2/
docs/release/
README
docs/IMPLEMENTATION_PLAN.md
V1.2 README/index
demo runbook
M16 release inventory
M16 verification
```

Ensure current documentation clearly states:

```text
M11 complete
M12 complete
M13 complete
M14 complete
M15 complete
M16 complete
M17 release closure
```

---

# 18. CREATE FINAL V1.2 RELEASE DOCUMENT

Create or update:

```text
docs/release/V1_2_RELEASE.md
```

Content:

```text
# MobiFlow AI V1.2.0

Release theme
Baseline
M11 summary
M12 summary
M13 summary
M14 summary
M15 summary
M16 summary

Database
Migration count = 7

AI/model identities
Recommendation V2
Evaluation evidence

Security
RBAC
IDOR
expectedVersion
human approval
audit

Runtime
Docker/PostgreSQL/API/Web/Ollama/RAG

Verification
Accepted M16 evidence
Final M17 sanity

Known limitations

Git release boundary
Tag v1.2.0
```

Do not exaggerate.

Do not claim:

```text
production proven
penetration tested
enterprise scale certified
100% AI accuracy
full WCAG certification
```

---

# 19. KNOWN LIMITATIONS MUST REMAIN

Preserve accepted limitations such as:

```text
synthetic/local evidence != production accuracy

Ollama latency depends on host

M15 free-text/model-language limitations remain

targeted Axe != full WCAG certification

not penetration testing

no production deployment

no backup/restore DR rehearsal

no fully disconnected fresh installation rehearsal
```

Do not remove limitations merely for release messaging.

---

# 20. RELEASE CHANGE POLICY

M17 should ideally change:

```text
release documentation only
```

If no source code fix is required.

If source code is modified:

STOP normal release flow.

Run targeted tests for the affected subsystem.

Do not tag release until those tests pass.

---

# 21. RELEASE DOC COMMIT

If M17 documentation changes exist:

run:

```powershell
git diff --check
git diff --stat
git diff
```

Stage only M17 release documents.

Then:

```powershell
git diff --cached --check
git diff --cached
```

Create one release-preparation commit.

Preferred:

```text
chore(release): prepare MobiFlow AI v1.2.0
```

Do NOT include product feature changes.

Capture the final feature-branch HEAD.

---

# 22. MERGE STRATEGY

After final feature branch is clean:

```powershell
git checkout main
git pull --ff-only
```

Verify no unexpected divergence.

Preferred integration:

```text
fast-forward
```

if possible.

Use:

```powershell
git merge --ff-only feat/v1.2-release-hardening-demo-readiness
```

If fast-forward is impossible because main has legitimate new commits:

STOP.

Do not force.

Do not automatically create a merge commit unless repository policy clearly requires it.

---

# 23. MAIN POST-MERGE CHECK

Verify:

```powershell
git status
git rev-parse HEAD
git log -8 --oneline --decorate
```

Working tree must be clean.

Capture release commit SHA.

---

# 24. CREATE ANNOTATED TAG

Create:

```powershell
git tag -a v1.2.0 -m "MobiFlow AI v1.2.0"
```

Verify:

```powershell
git show v1.2.0 --no-patch
git rev-parse v1.2.0^{}
git rev-parse HEAD
```

Expected:

```text
v1.2.0^{} == HEAD
```

Do not move old tags.

---

# 25. PUSH MAIN

Push:

```powershell
git push origin main
```

No force.

Verify:

```powershell
git ls-remote origin refs/heads/main
```

Remote main must equal local release commit SHA.

---

# 26. PUSH TAG

Push:

```powershell
git push origin v1.2.0
```

Verify:

```powershell
git ls-remote --tags origin v1.2.0
```

Also verify dereferenced tag if necessary.

Remote tag must point to the intended release commit.

---

# 27. FINAL REMOTE RELEASE CHECK

Verify:

```text
local main SHA
remote main SHA
local v1.2.0 commit
remote v1.2.0 commit
```

All must resolve to the intended release commit.

---

# 28. OLD TAG SAFETY

Verify:

```text
v1.0.0 unchanged
v1.1.0 unchanged
```

Do not recreate them.

Do not retag them.

---

# 29. WORKING TREE

Final:

```powershell
git status
```

Expected:

```text
working tree clean
```

---

# 30. DEPLOYMENT

Do NOT deploy.

Release:

```text
Git release/tag only
```

Deployment remains:

```text
NOT RUN
```

unless separately authorized.

---

# 31. M17 PASS CONDITIONS

M17 PASS only if:

```text
[ ] M16 checkpoint verified
[ ] local/remote M16 SHA matched

[ ] Docker/runtime sanity completed
[ ] database healthy
[ ] API healthy
[ ] web healthy
[ ] final smoke passed

[ ] migration count = 7
[ ] no schema surprise
[ ] no new feature
[ ] no release blocker

[ ] V1.2 release docs complete
[ ] known limitations preserved

[ ] feature branch clean
[ ] main safely integrated
[ ] release commit identified

[ ] annotated v1.2.0 created
[ ] main pushed
[ ] tag pushed
[ ] remote SHA verified

[ ] v1.0.0 unchanged
[ ] v1.1.0 unchanged

[ ] deployment NOT RUN
```

---

# 32. FAILURE POLICY

STOP release if:

```text
runtime core cannot start
database migration state invalid
main diverged unexpectedly
v1.2.0 already exists
secret discovered
source code unexpectedly dirty
release blocker found
local/remote SHA mismatch
```

Do not force release.

Do not force push.

Do not move tags.

---

# 33. FINAL RESPONSE FORMAT

Return exactly:

```text
MOBIFLOW AI V1.2.0 — FINAL RELEASE REPORT

BASELINE
M16 checkpoint:
M16 SHA:
Starting branch:
Working tree start:

RUNTIME SANITY
Docker:
PostgreSQL:
API:
Web:
Liveness:
Readiness:
Ollama:
AI:
RAG:

FINAL SMOKE
Login:
USER:
MANAGER:
Dashboard:
Request detail:
Analytics:

DATABASE
Schema changed:
Migration added:
Migration count:
Pending migration:

AI IDENTITY
Recommendation schema:
Prompt identity:
Dataset identity:
Model:
Full M15 rerun:

DOCUMENTATION
V1.2 release:
Demo runbook:
Inventory:
Known limitations:

TEST POLICY
Historical M0–M10 replay:
Historical M11–M16 full replay:
Targeted M17 sanity:

M17 CHANGES
Files changed:
Product code changed:
Release docs changed:

GIT
Feature branch final SHA:
M17 release-prep commit:
Main merge:
Release commit:
Main pushed:
Remote main SHA:

TAG
v1.2.0:
Annotated:
Tag commit:
Tag pushed:
Remote verified:

OLD RELEASES
v1.0.0 modified:
v1.1.0 modified:

WORKING TREE
Final status:

DEPLOYMENT
Status: NOT RUN

KNOWN LIMITATIONS
-

FINAL GATE
M17:
V1.2:
```

---

# 34. EXPECTED SUCCESS

Expected final state:

```text
M11 ✅
M12 ✅
M13 ✅
M14 ✅
M15 ✅
M16 ✅
M17 ✅
       ↓
v1.2.0 RELEASED
```

Git:

```text
main
 │
 └── <release commit>
       ↑
     v1.2.0
```

And:

```text
working tree CLEAN
local main == remote main
local tag == remote tag
deployment NOT RUN
```

---

# 35. FINAL INSTRUCTION

Use M16 checkpoint:

```text
8511a29529d82d4ed4adbcf5e4d49a6bacec73e4
```

as the authoritative V1.2 release-candidate baseline.

Do not rethink M0–M16.

Do not replay historical milestones.

Perform only:

```text
minimal runtime sanity
release document finalization
safe main integration
annotated v1.2.0 tag
remote verification
```

If no blocker appears:

release V1.2.

Stop after:

```text
M17 PASS
MOBIFLOW AI v1.2.0 RELEASED
DEPLOYMENT NOT RUN
```

---

# Subsequent user authorization — 2026-10-01 Asia/Saigon

The initial M17 normal-stack check found six applied migrations and old API/Web images. Release publication stopped under section 32. The agent asked for approval to update the existing developer stack by applying the existing M14 migration (drop confidence NOT NULL, preserve data), rebuild API/Web from M16, then repeat focused sanity and continue the authorized Git release.

User's explicit response:

> Cho phép cập nhật stack và tiếp tục release

This authorizes that local runtime remediation and continuation of the original M17 release flow. No new migration/source feature/reset/reseed/full historical replay or production deployment is inferred. The original request above is retained with trailing whitespace/newline normalization only.
