# Playwright MCP final evidence

The actual Playwright MCP server executed the three-case inspection and the QA-IOT-001 human workflow. An initial CLI session closed before dispatch and was not used as evidence; the successful evidence below is MCP-driven.

| Check | Result |
|---|---|
| USER creates each exact live request | PASS; database has one exact-title row per case |
| USER internal fact projection hidden | PASS |
| MANAGER retained facts / citations | PASS; screenshots for all three cases |
| STAFF begins and resolves QA-IOT-001 | PASS |
| USER confirms and CLOSED persists | PASS; version 7 after refresh |
| 1280×720 layout | PASS — document width 1265, no horizontal overflow; sidebar right 248 equals main left 248 |
| Final-page console errors | 0 |
| Final authenticated API calls | HTTP 200 |
| Vietnamese / technical identifier rendering | PASS |

Screenshots:

- [Conflict manager](screenshots/QA-CONFLICT-008-manager.png)
- [No-answer manager](screenshots/QA-NOANSWER-009-manager.png)
- [IoT user analyzed](screenshots/QA-IOT-001-user-analyzed.png)
- [IoT manager](screenshots/QA-IOT-001-manager.png)
- [IoT staff resolved](screenshots/QA-IOT-001-staff-resolved.png)
- [IoT user closed](screenshots/QA-IOT-001-user-closed.png)
- [IoT 1280×720](screenshots/QA-IOT-001-1280x720.png)

One audit-harness login was rate-limited after duplicate login requests; no DeepSeek call was involved. The harness was corrected to observe the browser bearer token instead of performing a second login. Aborted Next.js prefetches during navigation were not application request failures.
