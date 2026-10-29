# Targeted regression

- Focused auto-routing unit set: 25 passed.
- Real PostgreSQL v1.4.1 integration: final 10/10 fresh-database stress runs passed; each run covered positive assignment, no-staff review, same-request concurrency, different-request concurrency, role visibility and Manager override.
- RBAC/IDOR: PASS.
- State-machine atomicity: PASS.
- SLA creation/current policy: PASS.
- SYSTEM/MANAGER audit attribution: PASS.
- Checklist/resolution workflow: PASS.
- Playwright USER/STAFF/MANAGER journeys: PASS.
- Manager override: PASS; auto audit preserved, latest decision `REASSIGN / MANAGER_OVERRIDE`, no background reassignment.

Result: **PASS**.
