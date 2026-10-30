---
status: historical
appliesTo: v1.4.0
notForCompetitionDemo: true
supersededBy: ../release/V1_4_2_RELEASE.md
---

# Ten-minute demonstration script

This is a presentation plan, not measured operator timing. Use [DEMO_RUNBOOK](DEMO_RUNBOOK.md); disclose the current M10 release block.

1. **Minutes 0–1:** show core/AI/RAG health and explain the three business roles and synthetic data.
2. **Minutes 1–4:** create the canonical 17-SIM Amata request. Observe real structured extraction, actual SOP-IOT-04 retrieval, bounded tool results and pending recommendation. Inspect current source excerpts and original request facts.
3. **Minutes 4–5:** MANAGER changes the suggested staff member to another currently eligible candidate, records a reason and approves. Show original recommendation, final decision and MODIFIED outcome. If only one candidate is eligible, demonstrate a valid field change or use another request; never bypass eligibility.
4. **Minutes 5–7:** the actual assigned STAFF starts, requests Copilot assistance, explicitly adopts a checklist and records completion/waivers. Resolve with human-entered facts. USER confirms closure; show audit and analytics.
5. **Minutes 7–8 — missing information:** submit “17 SIM IoT mất kết nối từ 8 giờ sáng.” Inspect actual location null/missing-field behavior. If the model disagrees, show the output honestly and correct through the human workflow.
6. **Minutes 8–9 — outage:** use the documented isolated outage check or deliberately stop the local demo Ollama service. Show core readiness/manual work and explicit AI failure. Restore the original service/configuration, then retry transparently.
7. **Minutes 9–10:** distinguish workflow metrics from model quality. State M9 68/100, M10 68/100 and 69/100 exact development-set matches; show the red comparison and explain the unresolved latency block. No time-saving claim.

Live generation can exceed these budgets. Preserve the distinction between current inference and a labeled recorded example. Restore normal provider settings and run `npm run demo:ready` after an outage demonstration.
