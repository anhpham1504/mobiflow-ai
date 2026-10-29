# Protected mutation authority

`RequestStateMachineService` remains the sole owner of protected auto-assignment mutation. In one serializable transaction it owns:

`TRIAGED → ASSIGNED → Assignment → SLA → History → Audit → Notification`.

`AutoRoutingService` evaluates validated facts and returns a decision only. It does not write Request, Assignment, SLA, history, audit or notification rows. No direct Request mutation or second assignment authority was found.

Result: **PASS**; authority regression absent.
