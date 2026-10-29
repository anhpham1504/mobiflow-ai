# Isolated live environment

- Docker project: `mobiflow-m3-rehearsal`.
- PostgreSQL: loopback `55449`.
- API: loopback `35411`.
- Web: loopback `35410`.
- Database migrations applied: 14.
- Data: synthetic seed and synthetic request only.
- Official demo containers were captured before the run and verified byte-for-byte equivalent in container identity/state after validation.
- Maximum live attempts: 2; live budget USD 0.10; orchestration attempts 1.
- Actual live DeepSeek attempts: 1; `retryCount=0`; attempt 2 unused.
- Credential existed only in process/container secret environment and was never printed or stored.

After validation, all rehearsal containers, volumes and network were removed. Private runtime manifest, environment file and canary ledger were deleted. Official containers remained unchanged.

Result: **PASS**.
