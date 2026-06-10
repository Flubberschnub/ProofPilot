# ProofPilot UI Design Direction

This document describes a future frontend redesign for ProofPilot once the backend workflow is stable. It is intentionally a design plan, not an implementation spec for the current UI.

## Design Thesis

ProofPilot should feel like an urban operations console for turning messy business reality into a precise demo route.

The design language should combine:

- Minimalism: few inputs, clear hierarchy, restrained language.
- Brutalism: visible structure, hard edges, strong contrast, honest system state.
- Japanese subway and urban wayfinding: line colors, station codes, timetable rhythm, platform signage, icons, route progress, and dense-but-legible information.

The product should not feel like a marketing landing page or a generic AI chat box. It should feel like a tool used by solution engineers who need to move quickly from raw inputs to a credible, evidence-backed demo package.

## Product Shape

The future UI should flatten the current multi-field brief into a small number of high-leverage inputs.

Primary input model:

1. API
   - API name or product name.
   - API docs URL, pasted docs, or uploaded docs.

2. Business Data
   - Customer data set, connector, upload, or sample corpus.
   - Example: `aerocore-leasing`.

3. Context
   - One free-form text box for everything else.
   - Persona, target system, audience, constraints, demo goal, tone, live API permission, and anything the user wants ProofPilot to infer.

Optional future mode:

- A single command-box mode where the user can write:

```text
Use the Acme Document Extraction API docs below with the AeroCore sample data.
Build a sales demo for Sarah in Billing that shows repair logs and invoices flowing into Salesforce.
No live API calls.
```

ProofPilot should parse this into internal fields rather than requiring the user to fill a CRM-style form.

## Screen Layout

Use one main working screen, not a landing page.

Recommended structure:

- Left rail: route progress and agent line map.
- Main intake surface: API, data, context.
- Right inspection rail: current evidence, generated signals, claim status.
- Bottom output strip: demo package, export, download, generated files.

On smaller screens:

- Collapse the right inspection rail into tabs.
- Keep the route progress visible as a horizontal subway line.
- Keep the primary action reachable without scrolling through dense output.

## Visual Language

### Geometry

- Hard rectangular panels.
- Thin black borders.
- 0-4px radius maximum.
- No soft cards inside cards.
- No decorative gradient blobs, glassmorphism, or floating hero art.
- Use whitespace like station architecture: deliberate, gridded, and functional.

### Typography

Suggested stack:

- Primary UI: `Inter`, `Helvetica Neue`, or `Arial`.
- Technical labels: `IBM Plex Mono`, `JetBrains Mono`, or `SFMono-Regular`.
- Optional Japanese-influenced accent: `Noto Sans JP` for short labels, station IDs, or decorative line headers.

Tone:

- Short nouns.
- Operational verbs.
- Avoid explanatory paragraphs in the app surface.

Examples:

- `API`
- `DATA`
- `CONTEXT`
- `ROUTE`
- `EVIDENCE`
- `CLAIMS`
- `EXPORT`

### Color

Base palette:

- Paper white: `#F7F5EF`
- Ink black: `#111111`
- Signal gray: `#D8D5CC`
- Track gray: `#77746B`

Transit accents:

- Ginza orange: `#F39700`
- Marunouchi red: `#E60012`
- Tozai blue: `#00A7DB`
- Chiyoda green: `#00A650`
- Hanzomon purple: `#8F76D6`

Use color as system meaning, not decoration:

- Orange: active generation.
- Blue: API evidence.
- Green: supported claim.
- Red: unsupported or contradicted claim.
- Purple: customer/business context.
- Gray: waiting or skipped.

Avoid letting the whole app become one orange, blue, purple, or beige theme. The base should be monochrome and paper-like, with subway-line accents doing the work.

## Iconography

Use subway and city-system metaphors, but keep them restrained.

Useful motifs:

- Station code chips for agents: `I-01`, `S-02`, `B-03`, `V-04`.
- Route map for workflow progress.
- Platform signs for current step.
- Timetable rows for generated demo ideas.
- Fare-gate metaphor for claim validation.
- Transfer icon for API-to-system integration.
- Warning triangle for unsupported claims.
- Stamp/seal for reviewed claims.

Use icons as labels for system functions, not illustration.

Avoid cartoon transportation themes. This should feel like a real civic system, not a transit-themed toy.

## Interaction Model

### Intake

The user should only need to answer:

- What API?
- Where are the docs?
- What business data should ProofPilot use?
- What else should ProofPilot know?

Everything else should be inferred, with editable advanced fields hidden behind a compact control.

Advanced fields:

- Audience.
- Industry.
- Target persona.
- Target system.
- Preferred stack.
- Live API permission.
- Export target.

### Generation

The route map should advance as agents complete:

```text
INTAKE -> INDEX -> SIGNALS -> PLAN -> CLAIMS -> PACKAGE -> EXPORT
```

Each station should show:

- Status.
- Duration.
- Primary tool used.
- Evidence count.

### Results

Results should be organized as a transit board:

- Demo ideas as departures.
- Selected plan as the active route.
- Evidence as source platforms.
- Claims as gate checks.
- Generated files as cargo manifests.

Each result should answer:

- Why this demo?
- Which customer evidence supports it?
- Which API capabilities support it?
- Which claims are safe to say?
- What package was generated?

## Future Components

### Command Intake

A compact top-level input surface:

- API name input.
- Docs source drop zone / URL / paste area.
- Data source selector.
- Context textarea.
- Generate button.

The context textarea should be the emotional center of the form: generous, calm, and forgiving.

### Agent Route Map

A horizontal or vertical metro line showing agent progress.

Station examples:

- `IN-01 Intake`
- `DX-02 Docs`
- `BD-03 Business Data`
- `SG-04 Signals`
- `PL-05 Plan`
- `CL-06 Claims`
- `PK-07 Package`

### Evidence Inspector

A narrow inspection panel showing:

- API chunks.
- Business chunks.
- Source paths.
- Confidence/status.
- Claim links.

The inspector should feel like a station control panel: dense, sorted, and scannable.

### Demo Board

Generated demo opportunities should appear as a departure board:

| Line | Demo | Fit | Evidence | Status |
| --- | --- | --- | --- | --- |
| A | Billing Reconciliation | High | 12 | Ready |
| B | Pilot Compliance Intake | Medium | 8 | Needs Review |
| C | RMA Triage | High | 10 | Ready |

### Claim Gates

Claims should be visibly gated:

- Supported: passes through.
- Inferred: requires softer wording.
- Marketing: requires caveat.
- Unsupported: blocked with rewrite.

## Content Strategy

The UI should use labels, not instructions.

Good:

- `Docs`
- `Data`
- `Context`
- `Generate route`
- `6 signals found`
- `2 claims need safer wording`

Avoid:

- Long helper paragraphs.
- Tutorial-like cards.
- Marketing claims about what ProofPilot can do.
- Repeating backend architecture terms unless the user opens details.

## Backend Alignment

The simplified UI should map to backend fields like this:

| UI Field | Backend Field |
| --- | --- |
| API | `apiName` |
| Docs URL or pasted docs | `docsUrl` / `docsText` |
| Data source | `customerId` or future connector id |
| Context | parsed into `goal`, `industry`, `audience`, `customerPersona`, `targetSystem`, `preferredStack`, `liveApiAllowed` |

The backend should eventually own more inference so the frontend can stay minimal.

Suggested backend addition:

```ts
type WorkflowRequest = {
  apiName: string;
  docsText?: string;
  docsUrl?: string;
  customerId?: string;
  context?: string;
};
```

The Intake Agent can then derive the older structured fields for downstream compatibility.

## Implementation Phases

### Phase 1: Flatten Inputs

- Reduce visible form fields to API, docs, data, context.
- Keep advanced fields available but collapsed.
- Preserve current backend contract by deriving defaults client-side.

### Phase 2: Backend Context Parsing

- Add `context` to the workflow request schema.
- Let the Intake Agent infer industry, audience, persona, target system, and goal.
- Add tests for context-only requests.

### Phase 3: Subway System UI

- Replace the card-heavy layout with route-map navigation and inspection rails.
- Add station-coded agent progress.
- Add evidence and claim-gate panels.

### Phase 4: Demo Opportunity Board

- Generate multiple ranked demo ideas before selecting one.
- Show opportunities as a departure board.
- Let the user pick a route before package generation.

### Phase 5: Production Polish

- Add keyboard-first operation.
- Add empty, loading, error, and partial-results states.
- Add connector-aware data source picker.
- Add visual regression checks across desktop and mobile.

## Design Principles

- Fewer questions, better inference.
- Evidence is always visible.
- Generated claims must pass through gates.
- Business data and API docs are equal citizens.
- The interface should feel fast, urban, and precise.
- Brutal structure, minimal copy, transit clarity.

