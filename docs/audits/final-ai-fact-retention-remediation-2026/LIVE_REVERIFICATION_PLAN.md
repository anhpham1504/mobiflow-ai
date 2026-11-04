# Live Reverification Plan

Status: **NOT RUN**. This remediation authorizes zero new paid DeepSeek requests.

When the owner separately authorizes a new session, spending ceiling and request count, rerun only against a disposable synthetic database and the guarded DeepSeek origin. Reverify QA-CONFLICT-008, QA-NOANSWER-009 and QA-IOT-001 with fresh model responses, then compare raw response, validated output, persisted `safeResultJson`, API projection and MANAGER/STAFF UI. Verify the provider ledger before and after, confirm no new calls occur on failed preflight, and retain the exact request/usage metadata without raw secrets or prompts.

Required live assertions:

1. working power and contradiction remain reported/unverified;
2. `PROTO-DEMO-917` remains byte-accurate and unknown knowledge triggers manager-review fallback;
3. gateway restart and `NO_IMPROVEMENT`, 23 devices and 09:15 remain present;
4. no fabricated cause, SOP, citation or protected workflow action;
5. ledger spend and attempt count remain within the separately approved budget.

Until this plan is run under fresh authority, the release cannot be called competition GO.
