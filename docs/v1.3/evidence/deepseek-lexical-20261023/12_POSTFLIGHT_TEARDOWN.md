# Postflight teardown

This report is finalized after removing only the task-owned Compose project `mobiflow-deepseek-lexical-20261023` and its task volumes.

## Authorized teardown target

- Containers labeled with exact Compose project `mobiflow-deepseek-lexical-20261023`.
- Volumes `mobiflow-deepseek-lexical-20261023_knowledge_data` and `mobiflow-deepseek-lexical-20261023_postgres_data`.
- Ports 35400, 35401 and 55439.

## Final result

Postflight completed at `2026-10-23T21:20:15+07:00`.

- Exact precondition check found 3 task containers and 2 task volumes, all carrying the expected project label/name.
- `docker compose down -v --remove-orphans` ran with exact project name and task ports.
- Remaining task containers: 0.
- Remaining task volumes: 0.
- Listeners on task ports 35400/35401/55439: 0/0/0.
- Protected repository remained at `bb5dc5814ddf1a8fd169549d589c67df37b4ad70`, branch `fix/competition-2026-ai-ui-security`, with the same 2 user-owned status entries.
- Worktrees remained 13 total and 7 dirty.
- Official demo remained 4/4 healthy with the same full container IDs and start timestamps recorded in `01_PROTECTED_PREFLIGHT_AND_POSTFLIGHT.md`; both official volumes remained present.
- Host Ollama listeners on 11434/11535 remained 0/0; no Ollama process was started.

The official demo project `mobiflow-ngrok-demo-20261010`, all protected worktrees and all non-task volumes are excluded from the teardown target.
