# Regression results

| Gate | Command | Result |
|---|---|---|
| Full tests | `npm test` | PASS — config 8, API 224, web 27, release/evaluation 111; total 370 |
| Typecheck | `npm run typecheck` | PASS |
| Production build | `npm run build` | PASS |
| Root lint | `npm run lint` | PASS; 0 warnings |
| Security | `npm run verify:security:current` | PASS; 0 high/critical/moderate; credential scan clean |
| Documentation | `npm run verify:docs:current` | PASS |
| Dependencies | `npm audit --audit-level=moderate` | PASS; 0 vulnerabilities |
| Lexical PostgreSQL integration | `npm run test:integration:v13-lexical` | PASS; 14 migrations, 0 embeddings, disabled/current filtering, no-answer, FTS index |
| Whitespace | `git diff --check` | PASS |

The deterministic remediation tests include complete/missing/tampered/stale fact projections, exact identifier and troubleshooting outcome checks, generalized language/order/noise cases, role-specific projection, cutoff 0.99 behavior and citation validation. No test was removed or weakened.
