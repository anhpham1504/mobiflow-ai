# AI and workforce boundary

AI output is limited to analysis, missing information and grounded citations. It cannot supply or control staff ID, staff email, workload, private profile, Assignment, Request status or SLA.

Team/skill mapping, eligibility, workload and target selection are application-controlled. PostgreSQL predicates require active STAFF, active/available account, active Team, active TeamMember, matching Team and all required skills. Workload counts only `ASSIGNED`, `IN_PROGRESS` and `WAITING_USER`; terminal states are excluded. Ranking is lowest workload, then lexical UUID tie-break.

Weak grounding, stale/currentness failure, invalid citation, unknown/invalid mapping, rule conflict, missing SLA and no eligible STAFF fail closed to Manager review.

Result: **PASS**.
