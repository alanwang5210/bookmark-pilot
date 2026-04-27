# Bookmark Pilot UI Redesign Design

## Context

Bookmark Pilot is a Chrome extension for searching bookmarks, folders, and open tabs with fuzzy matching and optional AI-generated tags. The current product exposes two primary user-facing surfaces:

- `popup.html`: the high-frequency search entry point
- `options.html`: the settings and maintenance center

The redesign should improve usability without changing the core product behavior. The user wants both surfaces redesigned together, with a visual direction that feels more modern, softer, and more user-friendly while preserving the efficiency of a command palette.

## Goals

- Make the popup easier to scan and easier to trust at first glance.
- Keep search as the primary action and avoid introducing friction for frequent use.
- Make result cards easier to evaluate quickly.
- Make the settings page feel structured, calm, and understandable instead of tool-heavy.
- Clarify AI readiness, AI configuration, and index status so users always know what is missing, what is happening, and what is safe.
- Establish a shared visual system that can be reused across popup and options surfaces.

## Non-Goals

- No changes to search ranking, storage format, indexing behavior, or Chrome messaging architecture.
- No new product features beyond copy, layout, and presentation improvements needed to support the redesign.
- No major rewrite of `scripts/popup/popup.js` or `scripts/options/options.js` beyond small structural adjustments required by the new layout.

## Product Direction

The redesign should feel like a calm, capable search tool rather than a raw developer utility. The intended personality is "quietly confident": fast and practical for experienced users, but approachable for first-time users.

This direction should balance two qualities:

- Efficiency: compact enough for repeated use, with direct access to search, filters, results, and actions
- Friendliness: softer visual hierarchy, clearer guidance, and more human explanations for states and settings

The UI should not become tutorial-like, decorative, or oversized. It should remain operationally sharp while lowering cognitive load.

## Visual Language

### Theme

- Base surfaces should use warm off-white and soft neutral backgrounds instead of stark white.
- Primary text should use a dark ink color with strong contrast.
- Accent color should be a muted green-teal used sparingly for active states, highlighted results, and progress emphasis.
- Destructive actions should use a restrained warm danger palette instead of harsh saturated red.

### Layout and Surfaces

- Use rounded cards, soft shadows, and light borders to define grouping.
- Rely on spacing and section rhythm more than strong dividers.
- Keep a clean grid structure, but allow emphasis through featured cards and status panels.
- Ensure popup sizing remains compact and extension-friendly while still feeling layered and polished.

### Tone of Copy

- Replace abstract or system-heavy phrasing with plain-language guidance.
- Prefer actionable status messages over binary labels when something is incomplete.
- Keep hero copy short and confidence-building rather than feature-dense.

## Popup Design

### Purpose

The popup is the product's primary workspace. It should immediately orient the user, get out of the way, and help them decide which result to open with minimal effort.

### Structure

The popup should contain these visual zones in order:

1. Compact hero
2. Search panel
3. Lightweight guidance strip
4. Context and status bars
5. Result list
6. Minimal shortcut footer treatment

### Compact Hero

The hero remains, but becomes shorter and less dominant. It should:

- Keep the product name visible
- Use a concise headline focused on the user outcome
- Reduce explanatory copy length
- Keep the settings affordance available without competing with the search field

The keyboard shortcut card should no longer live as a large sidecar competing with search. Keyboard help should be demoted into a quieter secondary area near the bottom of the popup.

### Search Panel

The search field remains the center of gravity. It should:

- Visually feel like the main interactive object in the popup
- Support short example-led placeholder text
- Keep latency visible but secondary
- Preserve scope chips and advanced syntax access

Scope chips should remain fast to scan and easy to hit, but use softer active/inactive styling. The advanced syntax affordance should feel optional, not required.

### Guidance Strip

Below the search field, include a small informational strip that explains search signals in plain language. The content should reassure users that they can search by intent, title, domain, or folder context without knowing exact names.

This strip should be low-pressure and visually calm.

### Result Cards

Each result card should make four things immediately clear:

- What the result is
- Where it came from
- Why it matched
- What the primary next action is

### Result Hierarchy

- Title should remain the first visual anchor.
- Source badge should be visible but compact.
- Domain and path should be separated clearly enough to avoid blending into one line of metadata.
- Match reasons should appear as soft chips.

### Active and Best-Match Emphasis

- The keyboard-active card should feel distinct but not loud.
- The top candidate should read as a "best match" through subtle emphasis.
- Folder results should still expose child previews, but in a more digestible treatment.

### Explainability

Where space allows, the redesign should make the reason for ranking easier to understand. This can be done through clearer match-reason chips and supportive labeling rather than dense technical descriptions.

### Actions

Primary actions should remain direct:

- Folder: enter folder
- Tab: switch tab
- Bookmark: open

Secondary actions such as copy link should remain available but subordinate.

### Empty, Error, and Folder States

These states should become more supportive:

- Empty results should suggest better queries rather than only saying no results were found.
- Error states should remain clear and concise.
- Folder navigation context should remain visible, but styled as a lightweight breadcrumb/status card rather than a raw status block.

## Options Page Design

### Purpose

The options page should feel like a calm control center. It must help users understand defaults, enable AI safely, monitor progress, and perform maintenance without feeling lost.

### Structure

The page should be reorganized into four clear sections:

1. Basics
2. AI readiness
3. AI enhancement
4. Index and privacy

The hero area should be shorter and more useful, with a clearer explanation of what this page helps the user control.

### Basics Section

This section should group everyday preferences:

- Show advanced syntax hints
- Show recent hits on empty search
- Default search scope
- Interface language
- Omnibox keyword explanation

The section should present these as stable defaults rather than technical toggles. Supporting helper text can be added where it lowers ambiguity.

### AI Readiness Section

This is the most important conceptual improvement on the options page.

Instead of presenting readiness as a vague badge alone, this section should clearly answer:

- Is AI ready?
- If not, what exactly is missing?
- What is the next step?

Examples of actionable readiness explanations:

- Add your API key
- Add a valid base URL
- Choose whether to analyze bookmarks, tabs, or both

The visual treatment should make this section stand out as a status summary rather than just another settings card.

### AI Enhancement Section

This section should contain the full AI settings form, but be easier to understand through:

- better grouping
- clearer helper text
- less intimidating field presentation

It should reinforce that AI is optional, additive, and reversible. Privacy-related reassurance should appear near this section, not buried far away from the controls it explains.

### Index and Privacy Section

This section should combine operational status and maintenance controls in one understandable area.

It should include:

- AI progress panel
- index health summary
- maintenance actions
- privacy reassurance

### Progress Experience

The progress panel should feel informative and calm. It should communicate:

- what task is running
- how far along it is
- whether the user can safely stop it

### Maintenance Actions

Action hierarchy should be clear:

- Regenerate AI tags: primary action
- Rebuild index: secondary maintenance action
- Clear AI tags: destructive but controlled action

Feedback after these actions should use human-readable confirmation messages rather than raw system phrasing.

## Shared Interaction Principles

- Preserve keyboard efficiency in the popup.
- Preserve all current settings behaviors unless a change is required to support clarity.
- Reduce visual competition between sections.
- Make primary actions obvious and secondary actions available but quieter.
- Use status language that tells the user what to do next when relevant.
- Ensure bilingual content remains stable in both English and Simplified Chinese.

## Technical Design Constraints

The current HTML files reference `styles.css`, but no stylesheet currently exists in the project root. The redesign should therefore introduce a shared stylesheet and use it as the foundation for both pages.

Implementation should prioritize:

- creating a shared `styles.css`
- lightly restructuring `popup.html` and `options.html` where necessary to support clearer grouping
- minimizing JavaScript logic changes
- ensuring current translation hooks continue to function

The redesign should work within Chrome extension popup constraints and remain readable at extension popup dimensions.

## Accessibility and Usability Requirements

- Maintain strong contrast for text and actionable controls.
- Keep focus states visible for keyboard navigation.
- Preserve semantic structure for form fields and result actions.
- Avoid relying on color alone to explain readiness or status.
- Keep spacing and hit areas comfortable for extension UI usage.

## Verification Requirements

Before implementation is considered complete, verify:

- popup layout remains readable and usable at realistic extension popup width
- result cards remain scannable with long titles and paths
- empty, error, and folder states fit the new design
- options page sections feel distinct and understandable
- AI readiness messaging stays correct across incomplete and complete configurations
- progress, feedback, and destructive actions remain visually clear
- English and Simplified Chinese strings do not break the layout

## Delivery Scope

The first implementation pass should deliver:

- a shared visual system via `styles.css`
- redesigned popup layout and result presentation
- redesigned options layout and status presentation
- updated helper/feedback copy where needed to support the new UX direction

This pass should stop short of feature expansion and focus on a cohesive, trustworthy, user-friendly redesign.
