# Local demo accounts

These accounts are synthetic and may be used only with the allowlisted local MobiFlow demo database. They are created by `npm run demo:seed`.

The demo-only password for every seeded account is `MobiFlowDemo!2026`.

| Email | Role |
|---|---|
| `user@mobiflow.local` | USER |
| `manager@mobiflow.local` | MANAGER |
| `staff.iot@mobiflow.local` | STAFF |
| `staff.network@mobiflow.local` | STAFF |
| `staff.support@mobiflow.local` | STAFF |
| `staff.billing@mobiflow.local` | STAFF |

Do not reuse the password outside this synthetic local environment. The seed command hashes each newly created account independently with the production authentication path and never places credentials in frontend code.
