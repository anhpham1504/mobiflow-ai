# Full regression

Final candidate state:

- `npm run lint`: PASS, 0 warnings.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; API TypeScript and Next.js production build.
- `npm test`: PASS, 348 passed, 0 failed, 0 skipped.
  - config: 8
  - API: 221
  - web: 21
  - release/evaluation: 98
- Full real-PostgreSQL integration: 32 passed, 0 failed, 1 explicitly historical live-Ollama skip.
- Database migration/privilege check: 14 migrations; runtime cannot update append-only AuditLog.

The earlier accepted unit baseline was 334; 14 tests were added and none removed.

Result: **PASS**.
