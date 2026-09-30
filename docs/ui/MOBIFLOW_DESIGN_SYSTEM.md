# MobiFlow AI Design System

Status: V1.1 implementation contract.

## Brand treatment

The repository asset `apps/web/src/app/icon.svg` is the only approved brand asset found during audit. Its blue `#1E47D2` is the primary product color. The asset is used without distortion or recoloring. No official red token or official MobiFone guideline exists in the repository; therefore the restrained red accent is an application semantic/brand companion (`#C7353F`), not claimed as an official corporate value.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#F4F7FB` | app canvas |
| `--foreground` | `#14243A` | primary text |
| `--surface` | `#FFFFFF` | cards, controls |
| `--surface-subtle` | `#F8FAFD` | section/table headers |
| `--surface-raised` | `#FFFFFF` | drawers and elevated menus |
| `--border` | `#DCE4EE` | default separators |
| `--border-strong` | `#B9C6D6` | control boundaries |
| `--primary` | `#1E47D2` | primary actions and selection |
| `--primary-hover` | `#183BAE` | hover/active |
| `--primary-foreground` | `#FFFFFF` | text on primary |
| `--primary-subtle` | `#EAF0FF` | selected navigation/info |
| `--brand-accent` | `#C7353F` | sparse attention/accent |
| `--muted` | `#EEF2F7` | neutral states |
| `--muted-foreground` | `#5D6C80` | secondary copy |
| `--success` / `--success-subtle` | `#247A52` / `#E8F6EF` | positive/ready |
| `--warning` / `--warning-subtle` | `#9A6500` / `#FFF5DA` | waiting/risk |
| `--danger` / `--danger-subtle` | `#B4232D` / `#FDECEE` | destructive/failure |
| `--info` / `--info-subtle` | `#245FC7` / `#EAF2FF` | informational |
| `--focus-ring` | `#0B63CE` | accessible focus |

Component CSS must consume semantic variables rather than scatter new hex values.

## Typography

Use the local system stack: `"Segoe UI", Inter, Arial, sans-serif`, with Vietnamese diacritics verified in-browser. Page titles are 28–32 px, section titles 20–24 px, card titles 16–18 px, body 14–16 px, and metadata 12–13 px. Operational text never falls below 12 px. Weight range is 400/500/600/700; uppercase is limited to short navigation group labels and technical provenance.

## Spacing, radius, elevation

- Spacing steps: 4, 8, 12, 16, 20, 24, 32, 40, 48 px.
- Page gutter: 32 px desktop, 24 px tablet, 16 px mobile.
- Card padding: 20–24 px desktop, 16 px mobile.
- Card/control radius: 12 px / 9 px; badges may be pill-shaped.
- Cards use a 1 px border. Shadow is limited to raised overlays and the login card.

## Buttons and forms

Buttons: primary, secondary/outline, ghost, and danger. Default height is 42–44 px; small is 34–36 px; login is 48 px. All have hover, active, focus-visible, disabled, and busy states. Inputs are 42–44 px (48 px on login), always have visible labels, and show helper/error text below the field. Textareas resize vertically. Destructive actions use danger styling and explicit consequence copy where confirmation already exists.

## Badges and operational semantics

- Request: `NEW` info-neutral, `ASSIGNED` info, `IN_PROGRESS` primary, `WAITING_USER` warning, `RESOLVED` success, `CLOSED` neutral-success, `CANCELED` muted.
- Priority: LOW muted, MEDIUM info, HIGH warning, URGENT danger. Text is always present; color is never the only signal.
- Knowledge: READY success, PROCESSING info, FAILED danger, DISABLED muted.
- Health: ready success, degraded warning, unavailable danger. Core readiness and AI readiness remain distinct.
- SLA: textual remaining/overdue duration plus state; no invented percentage.

## Navigation and shell

Authenticated desktop uses a 248 px sidebar and 64 px topbar. Menu groups and links are role-aware, while backend RBAC remains authoritative. Selected links use a soft blue background, blue icon/text, and a narrow active indicator. Mobile uses a modal drawer with a labeled trigger, Escape close, focus containment, backdrop, navigation-close, body scroll lock, and focus restoration. `/login` has no authenticated shell.

## Cards, tables, and page structure

Pages use a reusable header: breadcrumb/eyebrow, title, description, and contextual action. Content maxes at 1440 px; form/detail pages use a narrower measure. KPI cards are compact and identify when values reflect only the current paginated list. Desktop request and document collections use compact tables; mobile converts them to cards without horizontal page overflow.

## AI presentation

AI surfaces use a consistent `AI` label, subtle blue boundary, generated/status metadata, evidence availability, and one advisory note where decisions are possible: AI supports the workflow; an authorized human owns the business decision. Never display raw prompts, model JSON, or hidden reasoning. Recommendation and human decision appear in separate visual regions. Copilot retains exactly six fixed actions and has no free-form input.

## States

Loading uses layout-shaped skeletons with appropriate status semantics. Empty states use a small Lucide icon, concise explanation, and only a real supported action. Errors use safe Vietnamese copy and a retry when available. Navigation remains persistent while page data reloads.

## Responsive strategy

- 1920/1440: controlled content width; full sidebar; tables for scan-heavy collections.
- 1024/768: reduced gutters; sidebar remains until the mobile threshold where the drawer takes over; detail columns collapse as needed.
- 390/360: 16 px gutters; one-column cards; full-width primary actions where useful; no clipped controls or page-wide horizontal scroll.

## Accessibility

Maintain valid landmarks and heading order, skip-link behavior, visible focus, 44 px primary touch targets, labeled icon controls, `aria-current`, live async states, and text alongside every color status. Drawer focus is contained and restored. Major routes must have zero serious/critical Axe findings. Motion stays within 100–180 ms and is disabled under `prefers-reduced-motion`.

## Dark mode

V1 has no dark-mode contract. V1.1 does not introduce one, avoiding an unrequested behavior and verification surface.
