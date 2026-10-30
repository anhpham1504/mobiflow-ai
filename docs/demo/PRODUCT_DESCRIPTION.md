---
status: historical
appliesTo: v1.4.0
notForCompetitionDemo: true
supersededBy: ../release/V1_4_2_RELEASE.md
---

# Product description

## Problem and current method

Service requests can arrive as incomplete Vietnamese descriptions. An operator must classify the issue, find relevant procedures, identify an eligible team and staff member, obtain approval and preserve the handling history. MobiFlow's implemented manual workflow supports this process without AI; no claim about a particular organization's current practice is implied.

## Solution and workflow

USER creates a request. Local AI proposes structured facts, missing information and category/priority. Real document retrieval supplies traceable source IDs and excerpts. Bounded tools retrieve similar requests, SLA policy and eligible staff candidates. MANAGER reviews the source evidence and accepts, modifies or rejects the recommendation. STAFF then works, adopts an optional Copilot checklist explicitly, records resolution, and the owning USER confirms or reopens. Assignment, role changes, closure and other protected decisions remain backend-authorized human actions.

## Users and environment

V1 is a single-organization synthetic local/demo application for USER, STAFF and MANAGER. The stack is npm workspaces, Next.js App Router, NestJS, strict TypeScript, REST `/api/v1`, Prisma and one PostgreSQL database with pgvector. Ollama runs on the Windows host. Docker Desktop runs PostgreSQL/API/web with loopback-only published ports.

## Measurable value

The product exposes database-backed workflow counts, SLA outcomes, AI success/failure/repair/latency and reviewed recommendation outcomes. Source inspection, state history and explicit approvals are demonstrable capabilities. A 100-case synthetic evaluation provides development evidence; 68/100 or 69/100 exact agreement is not generalized accuracy. Manual operator timings were not performed, so there is no time-saving or productivity result.

## Privacy and reliability

All demo inputs are synthetic. Backend role/ownership checks protect requests, files, AI context and manager analytics. Source membership, current permissions and structured output are revalidated. No hidden reasoning is stored or shown. Model failure is explicit; the manual path remains available.

## Scale and limits

The provider abstraction could support a separately authorized adapter later; no cloud adapter/dependency is part of this release. Scheduling remains process-local. Distributed workers, multi-tenant operation, high availability and enterprise scale are unverified and out of V1 scope. The V1 gate passes after the controlled run described in [M10 evaluation investigation](../evaluation/M10_EVALUATION_INVESTIGATION.md); that result does not remove these limitations.
