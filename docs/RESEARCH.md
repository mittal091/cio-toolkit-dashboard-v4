# Research notes: how an executive IT dashboard is built, and what v3 took from it

Written for the person maintaining this dashboard. All data in the dashboard is illustrative.

## How the reference cockpit was built
The reference (a CIO / CTO cockpit prototype published on GitHub) is four static files: `index.html`, `app.js`, `style.css` and a README. Its README says all data, evidence and confidence scores are simulated, there is no backend or sign-in, and it was "based on a supplied platform blueprint". It lists the next steps as governed finance and cloud-billing CSV imports first, then contract extraction and a cited board-pack narrative, then sign-in, access controls and audit logging before any confidential data. It carries no licence, so v3 takes its ideas only (status pills, evidence dialogs, decision log, board pack, period switch), not its code or branding.

## What the research says, and what v3 did about it

| Finding | Source type | What v3 changed |
|---|---|---|
| Keep the executive view small: 3 to 7 KPIs, headline first, exceptions and variance before detail | Vendor guides (read as search summaries) | Four tiles per view, a briefing banner on top, detail below |
| Every KPI needs a target or comparison, a trend cue and a status. Make deltas direction-aware (a rising cost is bad) | Vendor guides | Status pill, target or owner footer, delta by polarity, sparkline on tiles that have a series |
| Colour must never be the only signal (WCAG 1.4.1) | Accessibility guidance (search summaries) | Status is always a word plus a shape: pills, arrows, a text status per critical service, screen-reader text on availability bars, data labels on the highlighted bars and latest points |
| Text contrast 4.5:1, graphics and control boundaries 3:1 (WCAG 1.4.3, 1.4.11) | W3C pages, read directly | The old dim grey was 3.6:1 and the purple badge text 4.45:1, so both were lightened. Control borders were about 1.2:1 and are now 3.4:1. A test guards these |
| Pointer targets at least 24 by 24 px (WCAG 2.5.8) | W3C page, read directly | Link buttons and source chips enlarged |
| Tabs: arrow keys move between tabs, Home and End jump, the active tab is the only one in the Tab sequence, tabs link to their panel | W3C WAI-ARIA Authoring Practices, read directly | Implemented, with automatic activation because content is preloaded |
| Trust: each metric needs an owner, definition, freshness and an access rule; show an "as of" date | Vendor and practitioner pages, search summaries | Evidence dialog shows source, owner, refresh, definition, data-as-of and who can see the KPI. Every view shows "Data as of" |
| Respect reduced-motion settings | General practice | Hover movement and transitions are switched off when the user asks |

## v4: end-user review and the three calls
A review on a 1366x768 laptop and a 390x844 phone found: about 300px of chrome before content, the decisions list below the fold, no tiles visible on the phone, the same number shown up to three times, and catalogue IDs on tiles. v4 fixed these (decisions list now at about 530px on the laptop, two tiles visible on the phone).

Three product calls were made by comparing options:
1. **AI badge on tiles: moved into the evidence dialog.** It is jargon on every tile, but removing it entirely would lose the honest-AI principle. The dialog explains High, Medium, Low and None in plain words.
2. **Period selector: removed.** A page-wide version would need prior data for every chart and table. A tiles-only version misleads. The change arrows already show the comparison.
3. **Ask panel: kept low, with a jump link.** Moving it above the decisions would push the actions down. A top search box would add chrome.
These were not tested with real leaders. They are the first thing to validate with two or three of them.

## Not verified or only lightly sourced
- Only the W3C pages and the reference repo page were read in full. The other findings come from search-result summaries of vendor and practitioner pages, so treat them as guidance, not authority.
- Sparkline guidance (Tufte, Few) was not read first-hand. The search results agreed on the idea: small, no axes, trend not detail.
- Print was checked by switching the print rules on in a screenshot. It was not tested on a real printer or PDF viewer.

## What a real setup needs (carried over from the build)
1. Sign-in (for example Entra ID or Okta) and server-side filtering. The role switcher is a demo and every data file is downloadable today.
2. Real data feeds with a named owner per KPI, a freshness check and a "last updated" value from the source, not a typed date.
3. A metric contract per KPI: definition, grain, owner, lineage, refresh target, quality tests, access rule, change log. The evidence dialog already has the slots.
4. The KPI catalogue generated from the Excel with `tools/build-kpis.py`.
5. An AI service for Ask that checks access, cites sources, refuses without a source, and logs answers.
6. Private hosting, security review, audit logging, and automated tests on every change.
7. Real links from the evidence dialog to the source record.

## Sources
- W3C, [ARIA Authoring Practices: Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- W3C, [WCAG 2.2 Understanding 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- W3C, [WCAG 2.2 Understanding 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- W3C, [WCAG 2.2 Understanding 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Reference prototype: [subratatec1/cio-cto-cockpit](https://github.com/subratatec1/cio-cto-cockpit)
- [Dashboard best practices (Datapad)](https://datapad.io/docs/guides/dashboard-best-practices)
- [Best practices for designing a great KPI dashboard (insightsoftware)](https://insightsoftware.com/blog/best-practices-for-designing-and-building-a-great-kpi-dashboard/)
- [Power BI accessibility statement (Dorset Council)](https://www.dorsetcouncil.gov.uk/w/powerbi-accessibility-statement)
- [Digital accessibility fundamentals: colour (Mass.gov)](https://www.mass.gov/info-details/digital-accessibility-fundamentals-color)
- [Status indicator guidance (DEHN design system)](https://designsystem.dehn.de/atoms/indicator/)
- [Keep metrics consistent across dashboards (Databricks)](https://answers.databricks.com/keep-metrics-consistent-across-dashboards-ai-tools)
