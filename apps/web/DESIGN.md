---
name: MobiFlow AI V1.1
description: A calm, human-controlled Vietnamese telecom operations relay.
colors:
  background: "#f4f7fb"
  foreground: "#14243a"
  surface: "#ffffff"
  surface-subtle: "#f8fafd"
  surface-raised: "#ffffff"
  border: "#dce4ee"
  border-strong: "#b9c6d6"
  primary: "#1e47d2"
  primary-hover: "#183bae"
  primary-foreground: "#ffffff"
  primary-subtle: "#eaf0ff"
  brand-accent: "#c7353f"
  muted: "#eef2f7"
  muted-foreground: "#5d6c80"
  success: "#247a52"
  success-subtle: "#e8f6ef"
  warning: "#9a6500"
  warning-subtle: "#fff5da"
  danger: "#b4232d"
  danger-subtle: "#fdecee"
  info: "#245fc7"
  info-subtle: "#eaf2ff"
  focus-ring: "#0b63ce"
typography:
  display:
    fontFamily: '"Segoe UI", Inter, Arial, sans-serif'
    fontSize: "clamp(32px, 4vw, 50px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-1.5px"
  headline:
    fontFamily: '"Segoe UI", Inter, Arial, sans-serif'
    fontSize: "clamp(28px, 3vw, 32px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.7px"
  title:
    fontFamily: '"Segoe UI", Inter, Arial, sans-serif'
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "-0.3px"
  body:
    fontFamily: '"Segoe UI", Inter, Arial, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: '"Segoe UI", Inter, Arial, sans-serif'
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "0.06em"
rounded:
  notice: "7px"
  compact: "8px"
  control: "9px"
  soft: "10px"
  surface: "12px"
  prominent: "16px"
  pill: "999px"
spacing:
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "32": "32px"
  "40": "40px"
  "48": "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  status-badge-primary:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  workflow-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.surface}"
    padding: "22px"
  data-table:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.surface}"
    width: "100%"
  ai-advisory-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.surface}"
    padding: "22px"
---

# Design System: MobiFlow AI V1.1

## Overview

**Creative North Star: "The Accountable Operations Relay"**

MobiFlow AI is a restrained internal operations workspace in which every request, signal, and decision moves visibly to the next accountable human. Cool paper surrounds white, bordered work surfaces; cobalt marks routes, selection, and primary action; compact typography keeps live operational data readable without making the interface feel cramped.

The visual system is calm, reliable, and deliberately human-controlled. Rules and tonal layering carry most of the structure, while shadow is reserved for overlays. AI is presented as bounded advice with sources and status, never as spectacle or as the owner of a protected business decision.

**Key Characteristics:**

- Cool paper canvas with white bordered work surfaces
- Restrained cobalt routing cues and sparse semantic color
- Dense, scan-first data presentation with readable hierarchy
- Flat-by-default depth and compact 9–12 px corners
- Role-aware navigation and explicit AI/human decision boundaries

## Colors

The palette combines a cool operational neutral field with one assertive telecom blue and semantic colors that always retain textual meaning.

### Primary

- **MobiFlow Cobalt** (`primary`): Primary actions, selected navigation, active routes, links, and the recurring three-pixel operational marker.
- **Deep Cobalt** (`primary-hover`): Hover and active treatment for cobalt controls.
- **Cobalt Wash** (`primary-subtle`): Selected navigation, avatars, AI markers, and informational emphasis that must remain quiet.
- **Accessible Focus Blue** (`focus-ring`): The visible focus outline for keyboard operation.

### Secondary

- **Operational Information Blue** (`info`, `info-subtle`): Informational and in-progress states that are not direct actions.
- **Resolution Green** (`success`, `success-subtle`): Ready, resolved, healthy, and within-SLA states.
- **Attention Amber** (`warning`, `warning-subtle`): Waiting, risk, and time-sensitive states.
- **Consequence Red** (`danger`, `danger-subtle`): Destructive actions, failures, overdue SLA, and error recovery.

### Tertiary

- **Sparse Telecom Red** (`brand-accent`): A companion brand accent only; it does not compete with cobalt and is not claimed as an official corporate token.

### Neutral

- **Cool Paper** (`background`): The application canvas behind operational surfaces.
- **White Work Surface** (`surface`, `surface-raised`, `primary-foreground`): Cards, controls, drawers, overlays, and text on cobalt.
- **Slate Ink** (`foreground`): Primary reading and decision text.
- **Quiet Surface** (`surface-subtle`, `muted`): Table headers, grouped facts, neutral states, and hover fill.
- **Operational Slate** (`muted-foreground`): Descriptions, metadata, scope notes, and secondary labels.
- **Hairline Blue-Gray** (`border`, `border-strong`): Structural rules and stronger control boundaries.

**The Cobalt Routes Rule.** Use cobalt to show where work moves or what is selected; do not flood whole operational regions with it.

**The Red Is Earned Rule.** Red is reserved for consequence, failure, overdue state, destructive action, or a truly sparse brand accent.

**The Text Travels With Color Rule.** Every status, priority, health, and SLA color appears with a readable label or value.

## Typography

**Display Font:** Segoe UI (with Inter, Arial, and sans-serif fallbacks)
**Body Font:** Segoe UI (with Inter, Arial, and sans-serif fallbacks)
**Label Font:** Segoe UI (with Inter, Arial, and sans-serif fallbacks)

**Character:** The system stack is direct, familiar, and reliable for Vietnamese office use. Hierarchy comes from weight, scale, and compact spacing rather than a decorative display face or an external font dependency.

### Hierarchy

- **Display** (700, responsive 32–50 px, 1.08): Reserved for the login proposition, not authenticated page heroes.
- **Headline** (700, responsive 28–32 px, 1.2): Authenticated page titles and primary task context.
- **Title** (700, 20 px, 1.55): Section and workflow-card headings.
- **Body** (400, 15 px, 1.55): Forms, tables, explanations, and operational content; supporting text may use 14 px.
- **Label** (700, 12 px, 0.06 em): Eyebrows, short navigation group labels, and compact provenance; metadata may use 12–13 px without forced uppercase.

**The Operational Minimum Rule.** Never set operational text below 12 px; uppercase is limited to short group labels and technical provenance.

## Layout

Authenticated desktop uses a fixed 248 px role-aware rail and a sticky 64 px context bar. The work canvas is centered at a maximum width of 1440 px with 32 px desktop gutters; page headers pair a compact title block with only the actions valid for that role and state. Dense dashboard summaries use four columns, while request details favor a 1.85fr work column and a 0.85fr context column whose context remains sticky below the top bar.

At 1100 px, KPI and Copilot grids reduce their column count. At 900 px, the rail becomes a modal drawer, multi-column details collapse, and scan-heavy tables become complete cards rather than overflowing. At 600 px, gutters become 16 px, action groups and panels stack, and primary actions may fill available width. At 380 px, KPI cards become a single column. The supported range is 360–1920 px.

Spacing follows the implemented 4, 8, 12, 16, 20, 24, 32, 40, and 48 px rhythm. Default card padding is 22 px, mobile card padding is 16 px, and repeated list/grid gaps favor 10–20 px.

**The Continuous Workfield Rule.** Keep current truth, next action, and relevant context in one connected scan path; never break an authenticated workflow into a marketing hero followed by unrelated cards.

## Elevation & Depth

The system is flat by default. White surfaces separate from the cool paper canvas through one-pixel blue-gray rules, subtle fills, and sticky positioning. A near-imperceptible hairline shadow may steady workflow cards, while the larger ambient shadow token is reserved for raised overlays such as the mobile drawer. The top bar uses a translucent white surface and restrained backdrop blur to preserve context without appearing glassy.

### Shadow Vocabulary

- **Surface Hairline** (`0 1px 2px rgba(20,36,58,.025)`): Barely visible separation on workflow cards.
- **Raised Overlay** (`0 10px 30px rgba(20,36,58,.08)`): Mobile drawers and genuinely elevated menus only.

**The Flat-by-Default Rule.** Borders and tonal surfaces establish hierarchy at rest; shadow signals a real change in elevation, never decoration.

## Shapes

Controls use gently compact 9 px corners; work surfaces use 12 px corners; small markers and AI labels use 8–10 px corners. The 16 px radius is reserved for prominent contained surfaces such as the login card, and status badges use a fully pill-shaped silhouette. One-pixel borders are the default structural edge, while narrow three-pixel cobalt markers identify active routing and KPI emphasis. Circles are reserved for avatars, presence dots, timeline nodes, and the restrained login network motif.

## Components

Components are compact, explicit, and operational. All interactive states retain a visible focus outline, disabled controls reduce opacity, and stateful content continues to explain itself in text.

### Buttons

- **Shape:** Compact rounded rectangle with a 9 px radius and a minimum height of 42 px; small buttons use 36 px and login buttons use 48 px.
- **Primary:** Cobalt fill, white text, 9 px by 16 px padding, and 600 weight.
- **Hover / Focus:** Deep cobalt on hover, a one-pixel downward press on active, and a three-pixel focus outline offset by three pixels.
- **Secondary / Ghost:** Secondary buttons use a white surface and strong border; ghost buttons remove the border and use muted text.
- **Danger:** Consequence Red is used only for destructive or irreversible actions already supported by the workflow.

### Chips

- **Style:** Status badges use semantic subtle fills, matching semantic text, a fully rounded silhouette, and 12 px bold labels.
- **State:** Status, priority, health, and SLA always include text; color never carries state alone.

### Cards / Containers

- **Corner Style:** Work surfaces use the 12 px surface radius; internal grouped facts may use 9–10 px.
- **Background:** White Work Surface on Cool Paper, with Quiet Surface for subordinate facts and headers.
- **Shadow Strategy:** Flat at rest with only the Surface Hairline where implemented; overlays alone use Raised Overlay.
- **Border:** One-pixel Hairline Blue-Gray rule.
- **Internal Padding:** 22 px by default and 16 px on compact mobile surfaces.

### Inputs / Fields

- **Style:** White background, strong blue-gray border, 9 px radius, 10 px by 12 px padding, and a minimum height of 43 px.
- **Focus:** The shared three-pixel Accessible Focus Blue outline remains visible without relying on a color-only border change.
- **Error / Disabled:** Error copy sits below the field in a red-tinted bordered notice; disabled fields inherit the global reduced-opacity treatment.

### Navigation

- **Style:** The desktop rail is 248 px wide and groups 42 px-high links by role. Active links combine Cobalt Wash, cobalt icon/text, `aria-current`, and a narrow left route marker.
- **Hover / Focus:** Hover uses Quiet Surface and Slate Ink; keyboard focus uses the global focus outline.
- **Mobile:** Below 900 px, navigation moves into a modal drawer with backdrop, Escape close, focus containment, navigation-close, scroll lock, and focus restoration.

### Data Tables

- **Style:** Tables sit in a bordered 12 px container with quiet header fill, 12 px bold column labels, 14 px cell padding, hairline row rules, and a subtle hover row.
- **Responsive:** Below 900 px, each row becomes a full content card; no business field is discarded merely to fit the viewport.

### AI Advisory Panels

- **Style:** A blue boundary and compact `AI` marker identify model-generated material without introducing a separate visual universe.
- **Behavior:** Status, evidence, sources, availability, and provenance remain visible. Original AI suggestion and authorized human decision occupy separate visual regions.

**The Authority Boundary Rule.** AI styling marks advice, never approval; protected business actions retain explicit human labels and controls.

## Do's and Don'ts

### Do:

- **Do** show attention, scope, SLA, and the one valid next action near the top of each operational surface.
- **Do** preserve role-aware navigation, explicit status text, source evidence, and human decision ownership.
- **Do** use borders, spacing, and quiet tonal shifts before introducing shadow.
- **Do** keep desktop density high while preserving complete 360 px workflows through stacking and table-to-card conversion.
- **Do** keep motion within the implemented 100–180 ms interaction range and honor `prefers-reduced-motion`.

### Don't:

- **Don't** introduce decorative AI spectacle, free-form chatbot chrome, hidden reasoning, or visuals that imply autonomous authority.
- **Don't** use red as a routine action color or cobalt as a full-screen wash on authenticated surfaces.
- **Don't** add glassmorphism, neon, giant authenticated heroes, external fonts, or dark mode.
- **Don't** invent progress percentages, remove status labels, or communicate SLA and risk through color alone.
- **Don't** trade mobile completeness for a clipped table, hidden control, or page-wide horizontal scroll.
