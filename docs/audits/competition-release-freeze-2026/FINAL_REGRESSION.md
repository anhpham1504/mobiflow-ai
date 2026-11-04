# Final deterministic regression

Date: 2026-11-03

No paid DeepSeek request was made. All provider-live features remained disabled for this freeze.

| Gate | Command | Result |
|---|---|---|
| Full deterministic suite | `npm test` | PASS: 370/370 |
| Config tests | included in `npm test` | PASS: 8/8 |
| API tests | included in `npm test` | PASS: 224/224 |
| Web tests | included in `npm test` | PASS: 27/27 |
| Release/evaluation tests | included in `npm test` | PASS: 111/111 |
| TypeScript | `npm run typecheck` | PASS |
| ESLint | `npm run lint` | PASS, zero warnings |
| Production build | `npm run build` | PASS; API and Next.js build complete, 19/19 static pages generated |
| Security gate | `npm run verify:security:current` | PASS; 0 high/critical/moderate advisories |
| Documentation gate | `npm run verify:docs:current` | PASS |
| Dependency audit | `npm audit --audit-level=moderate` | PASS; 0 vulnerabilities |
| PostgreSQL lexical integration | `npm run test:integration:v13-lexical` | PASS |
| Whitespace/conflict check | `git diff --check` | PASS |

## PostgreSQL integration isolation

- Project: `mobiflow-live-reverification`
- Bind: loopback `127.0.0.1:55469`
- Database and credentials: task-owned, randomly generated, process-local
- Migrations: 14/14 applied to the disposable child database
- Generation profile: DeepSeek configured but live calls false
- Retrieval profile: lexical
- Embedding calls: probe 0, document 0, query 0
- Exact/diacritic-folded/synonym/typo/billing retrieval: PASS
- No-answer query: returned no sources
- Disabled source and stale generation exclusion: PASS
- FTS GIN index use: PASS
- SQL injection-shaped query: table remained present
- Least-privilege update denial: PASS
- Business rows unchanged: PASS
- Rollback pgvector extension/type/index remained present

The exact container, network and volume were removed after the test. Port 55469 was no longer listening.

## Baseline comparison

The requested baseline was 370/370. The freeze reproduced 370/370 with no weakened, skipped or removed test. The previously reported 24/24 live database/API result is preserved as historical live evidence and was not repeated because the owner prohibited additional paid DeepSeek work.
