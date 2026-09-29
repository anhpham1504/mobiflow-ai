# Judge Q&A

**Why AI instead of ordinary rules?** AI extracts proposed structure from varied Vietnamese descriptions and drafts context-specific assistance. Rules still own authorization, transitions, SLA math, eligible candidates and protected decisions.

**What if AI is wrong?** A manager can modify or reject the proposal. Staff and owner control subsequent work and closure. Schema validity does not prove factual correctness.

**How are hallucinations controlled?** Retrieval uses real current sources; source IDs/quotes and allowed entity IDs are validated. Missing evidence is explicit. These controls do not guarantee semantic correctness, so humans inspect the source and decision.

**Why local AI?** The demonstrated runtime can operate locally once dependencies and model assets are available. It avoids a required cloud inference service for this demo; no universal privacy or uptime guarantee follows.

**Can enterprise users use cloud AI?** A provider interface exists, but V1 includes only Ollama. A cloud adapter, data policy and deployment review would need separate authorization and testing.

**How is data protected?** Backend session, role, ownership/current-assignee and source checks apply independently of the UI/model. Docker ports are loopback-bound, the runtime database role is restricted, and demo data is synthetic.

**What exactly does AI do?** It proposes structured intake, grounded recommendations, six allowlisted Copilot actions and a factual resolution summary. It cannot approve, assign, close, delete, change roles or execute arbitrary shell/SQL/URL tools.

**What is human approval?** MANAGER explicitly accepts/modifies/rejects the current recommendation using the expected request version. The domain transaction rechecks eligibility, permissions and source availability before assignment/SLA/audit/notifications commit.

**How is accuracy measured?** A fixed 100-case synthetic development dataset compares exact category/priority/deterministic-team labels. M9 matched 68; M10 matched 68 and 69. It is not generalized accuracy or semantic ground truth. Both M10 comparisons are red and retained.

**Can it scale beyond telecom?** The workflow concepts are reusable, but other domains and distributed production scale have not been validated. V1 is a local single-organization demo with process-local scheduling.

**What happens if Ollama goes down?** AI records explicit bounded failure, while manual work and core readiness remain available. Embedding outage fails retrieval-dependent operations closed. Restore the provider and explicitly retry; restart API to resume paused vector backfill if needed.

**Why is this more than a chatbot?** The interface operates on authorized workflow records with structured contracts, sources, history, staff work and human decisions; it does not provide arbitrary chat/tool execution.

**Why is this more than ticket management?** It adds measured local AI intake, sourced assistance and bounded recommendations to the workflow. Their quality and limitations are visible rather than assumed.

**Is it ready to release?** The implementation and demonstration package are available for review, but M10 is BLOCKED by the unresolved longitudinal live-evaluation result. No release tag or production-readiness claim has been made.
