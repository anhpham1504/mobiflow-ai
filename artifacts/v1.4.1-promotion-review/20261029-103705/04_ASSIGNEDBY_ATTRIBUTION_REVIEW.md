# Assignment attribution review

The legacy non-null `Assignment.assignedById` stores the authenticated analysis initiator as provenance for automatic assignment. It is not the canonical decision actor.

Canonical attribution is:

- `actorType = SYSTEM`
- `action = REQUEST_AUTO_ASSIGNED`
- `routingSource = AUTO_ROUTING`

Manager reassignment is separately attributed to MANAGER with `routingSource = MANAGER_OVERRIDE`. USER/STAFF projections do not present `assignedById` as the auto-routing decision maker, and Manager UI uses the safe routing source/reasons instead.

Result: **PASS**; known legacy limitation is non-misleading.
