# M9 manual-time benchmark protocol

Status: protocol implemented; operator timing not yet performed.

Use 20 fixed synthetic cases selected before timing: four each from Network, IoT, Billing, Account and Service. One operator completes two counterbalanced sessions on the same local machine: 10 cases manual-first/AI-assisted-second and 10 AI-assisted-first/manual-second. Manual mode uses the existing manual triage form with Ollama unavailable. Assisted mode uses the normal analysis/recommendation flow but still requires the manager's final decision.

Start timing when the request detail is visible. Stop when a valid review is submitted to `PENDING_APPROVAL`. Record case ID, mode, order, start/end monotonic timestamps, completion status and a short safe failure code. Do not record request text, credentials, prompts, hidden reasoning or source excerpts. Exclude only abandoned cases and report them separately; never replace them.

Report count, mean, median, minimum and maximum for each mode and paired differences. Label the result “single-operator synthetic demo benchmark,” not a scientific productivity study. Do not claim time saved until an operator actually performs the protocol. A CSV/JSON result must be stored under `docs/evaluation/results/` and cited by the M9 verification report.
