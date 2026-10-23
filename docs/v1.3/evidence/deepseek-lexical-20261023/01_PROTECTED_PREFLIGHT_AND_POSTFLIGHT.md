# Protected preflight and postflight

## Protected state observed

- Protected repository: `C:\Code\MobiFlow AI`.
- Protected HEAD/branch at final pre-teardown check: `bb5dc5814ddf1a8fd169549d589c67df37b4ad70`, `fix/competition-2026-ai-ui-security`.
- Protected status remained user-owned: 2 entries (`docs/demo/COMPETITION_SUBMISSION.md` modified and `docs/demo/VIDEO_DEMO_SCRIPT_V1_3_VI.md` untracked).
- Git worktrees: 13 total, 7 dirty. None was reset, cleaned, switched, removed or used for implementation.
- Independent clone: `C:\Code\MobiFlow-AI-DeepSeek-Lexical-20261023`; fetch remote is GitHub and push URL is deliberately `DISABLED://push-not-authorized`.
- Official demo Compose project: `mobiflow-ngrok-demo-20261010`. Its web/API/edge/PostgreSQL containers remained healthy with IDs beginning `4b5472f75c6f`, `08e7230624fb`, `a39ad72df662`, `5695b82b2f19`; start timestamps remained `2026-10-23T13:08:33.778028533Z`, `13:08:33.777178005Z`, `13:08:33.779422121Z`, `13:08:33.786221383Z` respectively.
- Official demo volumes remained `mobiflow-ngrok-demo-20261010_knowledge_data` and `mobiflow-ngrok-demo-20261010_postgres_data`.
- No listener was found on local Ollama ports 11434 or 11535; Ollama was not started.

## Isolated task resources before teardown

- Compose project: `mobiflow-deepseek-lexical-20261023`.
- Bound ports: web `127.0.0.1:35400`, API `127.0.0.1:35401`, PostgreSQL `127.0.0.1:55439`.
- Containers: web `3b18ca64804f`, API `740890a820b3`, PostgreSQL `5674d913bab8`; all were healthy at evidence capture.
- Task-only volumes: `mobiflow-deepseek-lexical-20261023_knowledge_data` and `mobiflow-deepseek-lexical-20261023_postgres_data`.
- Disposable integration databases `mobiflow_v13_lexical_test` and `mobiflow_m2_test` were created inside the task PostgreSQL instance and dropped by their runners.

## Postflight

The exact task Compose project and its two task-only volumes are removed at final postflight. The protected worktrees, official demo project/volumes and host Ollama state are rechecked after removal; final identifiers and port results are recorded in `12_POSTFLIGHT_TEARDOWN.md`.
