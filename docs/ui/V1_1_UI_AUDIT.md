# MobiFlow AI V1.1 UI Audit

Baseline: `v1.0.0` (`cf59b68852aa69bd54d8b478c1dd0a595b3220fe`)

Audit method: route/component inventory, source inspection, existing Playwright coverage, API-contract review, and release evidence review. At the resume checkpoint no application containers or test/evaluation processes were running, so the initial audit is source-based; runtime verification is part of the V1.1 gate.

## Cross-product findings

- The root layout always renders authenticated navigation, header, and footer, including on `/login`.
- The shell reads like documentation navigation and becomes a wrapping horizontal link strip on mobile instead of an accessible drawer.
- Authenticated pages lack a shared compact page-header pattern and dashboard KPI hierarchy.
- Raw page text, cards, forms, lists, AI panels, and system health share too few reusable presentation primitives.
- Secondary typography reaches 10 px in operational areas; spacing and density vary significantly.
- Status and priority use generic treatment, and request rows are card-only on desktop.
- Loading, empty, and failure states are mainly plain text; recovery exists but is not consistently presented.
- Existing behavior is carefully versioned and role-scoped. The redesign must change presentation only.

## Screen audit

| Route / surface | Role | Purpose | Current UX issues | Information priority | Redesign action | Behavior risk |
|---|---|---|---|---|---|---|
| `/login` | Public | Authenticate | Authenticated sidebar visible; form stretches inside app content; weak hierarchy and copy | Credentials, error, local-demo status | Dedicated full-height public frame; 440 px card; 48 px fields/CTA; password visibility | Low: preserve `login()` and role redirect |
| `/` | Public/authenticated | Read readiness | Oversized debug-like list; tiny labels; public navigation competes with content | Core readiness, AI degradation, component states | Operational status summary and compact component grid/list | Low: preserve readiness semantics and API-doc link |
| `/user/dashboard` | USER | Personal overview | Same request list as dashboard; no attention summary | Open, in progress, awaiting user, completed; create CTA | Role-aware dashboard header and derived visible-list KPIs above recent requests | Medium: derived counts must not imply global totals |
| `/user/requests` | USER | Own requests | Card-only desktop list; controls lack search/clear hierarchy | Code/title, status, priority, SLA, updated | Desktop table + mobile cards; standardized filters and badges | Medium: keep server filters and pagination |
| `/user/requests/new` | USER | Create request | Form visually blends with generic cards | Title, description, submit state | Focused form page and clear helper/error presentation | Low: preserve request schema |
| `/user/requests/[id]` | USER | Follow request | Long single-column flow; actions buried; SLA is raw text | State, SLA, current outcome, messages, allowed action | Two-column desktop summary/actions with stacked mobile layout | High: do not alter state/action predicates or expectedVersion |
| `/staff/dashboard` | STAFF | Work overview | Same list-only layout; no workload cues | Assigned, active, waiting user, SLA attention | Operational KPI row and “cần xử lý” list | Medium: only current page data; label scope truthfully |
| `/staff/work-queue` | STAFF | Assigned work | Same scanability issues as request list | SLA, priority, state, assignee | Dense desktop table/mobile cards | Medium: preserve staff-scoped endpoint |
| `/staff/requests/[id]` | STAFF | Execute work | Copilot/checklist/actions compete in long flow | Next valid action, checklist, SLA, conversation | Sticky-safe action rail on desktop; clear sections; fixed Copilot action grid | High: six-action contract and checklist adoption unchanged |
| `/manager/dashboard` | MANAGER | Operational overview | List-only dashboard | Open work, pending approval, SLA risk, recent requests | Denser overview with scoped KPI row and recent work | Medium: no invented organization aggregates |
| `/manager/requests` | MANAGER | Manage all requests | Cards reduce comparison speed | Request, state, priority, assignee, SLA | Enterprise table/mobile cards | Medium: preserve manager list filters |
| `/manager/approvals` | MANAGER | Review pending decisions | Presentation does not clearly separate AI suggestion and human authority | Review kind, evidence, recommendation, decision | Branded advisory panel plus explicit “Quyết định của quản lý” section | High: accept/modify/reject payloads unchanged |
| `/manager/requests/[id]` | MANAGER | Triage/assign/audit | Very long page and nested forms; AI and manual decision visually merge | State/SLA, evidence, draft, human decision | Two-column detail, section navigation hierarchy, advisory AI labels | High: preserve revision and review identity checks |
| AI analysis | Scoped | Intake explanation | Generic card and raw field layout | Status, suggestion, missing facts, source evidence | `AI` label, compact facts, advisory note, explicit degraded/retry state | High: no raw prompt or hidden reasoning added |
| Recommendation | MANAGER | Recommend candidate/plan | Recommendation and decision controls share undifferentiated surface | Original suggestion, evidence, human outcome | Separate recommendation surface from decision form | High: original suggestion remains immutable |
| Copilot | STAFF | Six bounded helpers | Buttons read as undifferentiated actions | Purpose of each fixed action, run state, result/evidence | Six concise action tiles; timestamp/evidence result block | High: no free-form prompt or extra action |
| `/manager/knowledge` | MANAGER | Document library/admin | Card list and forms lack library density | Document, state, chunks, update, allowed action | Table/mobile rows, state badges, compact upload/reindex/disable affordances | Medium: uploads and versioned mutations unchanged |
| `/manager/knowledge/sources/[id]` | MANAGER | Inspect source | Technical content lacks hierarchy | Source availability, document metadata, excerpt | Source-detail header and evidence card | Low |
| `/manager/analytics` | MANAGER | Operational and evaluation evidence | Dense metrics but weak section grouping; milestone-first headline | Operational KPIs, SLA, AI runs, evaluation provenance | Truthful sectioned analytics, concise provenance copy, no composite AI score | Low: calculations and endpoint unchanged |
| `/notifications` | Authenticated | Own notifications | Generic request cards; unread state is text only | Unread, message type, related request, time | Compact notification feed with icon, dot, related action | Low: recipient-only read endpoint unchanged |
| `/profile` | Authenticated | Own identity | Bare text | Display name, email, role | Small account card in standard page shell | Low |

## Route and behavior guardrails

- Keep all existing endpoint selection, polling, abort behavior, role checks, action predicates, schemas, and `expectedVersion` mutation payloads.
- Treat counts derived from a paginated visible list as “trong danh sách hiện tại”; do not present them as global analytics.
- Keep `/` public and truthful; authenticated role navigation may link to it as system status.
- Do not expose manager-only AI evidence to USER or STAFF.
- Do not add a dark theme because V1 has none and this refresh must not expand behavior.
