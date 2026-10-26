# Browser UX and degraded-mode evidence

Browser regression ran against the isolated Docker demo at web `127.0.0.1:35400` and API `127.0.0.1:35401` with DeepSeek live calls disabled and no Ollama listener.

## Observed scenario

- Health displayed core ready, lexical RAG READY with 9 documents/12 chunks, DeepSeek intentionally disabled, pgvector rollback ready and Ollama not configured.
- Manager knowledge detail showed substantive source text including the complete `NETWORK` token; no `NETWO` excerpt was rendered.
- USER created synthetic request `MF-2026-000001` (`8c0edacc-465e-481d-bf9f-97551a80d564`). Disabled live AI failed safely, the request remained `NEW`, and the manual path remained usable.
- USER navigation to a manager route returned HTTP 403.
- MANAGER manually drafted NETWORK/IOT high priority, chose an IoT specialist and source-backed checklist, submitted and accepted it. The request became `ASSIGNED`, version 6, SLA 120; the human decision remained distinct.
- STAFF started work, producing `IN_PROGRESS`, version 7.
- Copilot `FIND_SOP` under live-disabled generation failed safely and did not mutate request state.
- At viewport 390x844, measured horizontal overflow was 0.
- Network inspection observed 0 DeepSeek and 0 Ollama requests.

An installed Kaspersky browser component attempted an external injection that CSP blocked. This environmental console event was not an application network dependency or application failure. A complete WCAG/axe audit, cross-browser matrix and production-load test were not performed and are not claimed.

## Sanitized screenshots

- `raw/BROWSER_MOBILE_REQUEST.png` — SHA-256 `e02d5fa7e288743bf2a46415d6b5847e220cd38ad4e259991e91bd90eb31c6eb`, 36,649 bytes.
- `raw/BROWSER_HEALTH_DESKTOP.png` — SHA-256 `dbea7945bcb0f88d3f3ed26054a9d8f65b26416e5c3c82f5cc9d563e835c51f0`, 74,983 bytes.

The screenshots contain only synthetic demo content and no API key.
