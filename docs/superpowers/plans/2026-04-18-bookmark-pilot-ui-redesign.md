# Bookmark Pilot UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the popup and options pages so Bookmark Pilot feels calmer, clearer, and more user-friendly without changing core extension behavior.

**Architecture:** Add a shared `styles.css` as the visual system for both extension pages, lightly restructure `popup.html` and `options.html` to fit the approved information hierarchy, and update the page scripts so the new copy, status blocks, and layout hooks continue to work. Keep search/indexing logic intact and focus code changes on presentation, small DOM bindings, and copy fidelity.

**Tech Stack:** Chrome extension HTML, CSS, vanilla JavaScript modules

---

### Task 1: Capture the approved implementation shape

**Files:**
- Modify: `D:\workspace\alan\project1\docs\superpowers\specs\2026-04-18-bookmark-pilot-ui-redesign-design.md`
- Create: `D:\workspace\alan\project1\docs\superpowers\plans\2026-04-18-bookmark-pilot-ui-redesign.md`

- [ ] **Step 1: Re-read the approved spec and current file map**

Run: `Get-Content docs\superpowers\specs\2026-04-18-bookmark-pilot-ui-redesign-design.md`
Expected: approved goals, layout direction, and verification requirements are visible before editing UI code

- [ ] **Step 2: Freeze the execution plan in this file**

Implementation intent:

```text
Create styles.css for shared tokens and components.
Restructure popup.html around compact hero, search surface, guidance strip, status blocks, and compact shortcut footer.
Restructure options.html into basics, AI readiness, AI enhancement, and index/privacy sections.
Update popup.js and options.js DOM bindings to match the new structure.
Update i18n copy where the redesign needs softer, clearer messaging.
```

- [ ] **Step 3: Move to implementation once the plan matches the spec**

Run: `Get-Content docs\superpowers\plans\2026-04-18-bookmark-pilot-ui-redesign.md`
Expected: this plan reflects the approved spec and is ready to execute inline

### Task 2: Build the shared visual system

**Files:**
- Create: `D:\workspace\alan\project1\styles.css`

- [ ] **Step 1: Create the shared stylesheet**

Add:

```css
:root {
  --bg: #f6f1e8;
  --panel: rgba(255, 255, 255, 0.88);
  --panel-strong: #ffffff;
  --panel-muted: #f2f4f2;
  --text: #18302c;
  --text-soft: #5d6b67;
  --accent: #2f7a67;
  --accent-strong: #163a33;
  --accent-soft: #e7f4ef;
  --line: rgba(24, 48, 44, 0.1);
  --danger-soft: #fff1ea;
  --danger-text: #965241;
  --shadow-lg: 0 22px 48px rgba(30, 44, 40, 0.14);
  --shadow-md: 0 14px 28px rgba(30, 44, 40, 0.09);
  --radius-xl: 24px;
  --radius-lg: 18px;
  --radius-md: 14px;
}
```

- [ ] **Step 2: Add shared component styles**

Add component groups for:

```text
shell backgrounds
hero cards
search surface
scope chips
guidance strip
context/status cards
result cards and badges
settings cards
form fields and toggles
progress bars and feedback banners
button variants
responsive adjustments
```

- [ ] **Step 3: Add motion and accessibility polish**

Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 4: Verify stylesheet is present**

Run: `Get-Item styles.css | Select-Object FullName,Length`
Expected: `styles.css` exists in the project root with non-zero size

### Task 3: Redesign the popup structure

**Files:**
- Modify: `D:\workspace\alan\project1\popup.html`
- Modify: `D:\workspace\alan\project1\scripts\popup\popup.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\i18n.js`

- [ ] **Step 1: Update popup markup to match the approved layout**

Implement:

```text
compact hero with short copy
search panel as the visual centerpiece
plain-language guidance strip
context/status cards below the search surface
results region with the existing template
compact shortcut footer instead of the old sidecar card
```

- [ ] **Step 2: Update popup script bindings**

Ensure `popup.js` binds and translates:

```text
hero subheading
shortcut title and shortcut labels
signals label and signals copy
search examples or softer placeholder text
new footer/status hooks introduced by the updated markup
```

- [ ] **Step 3: Refresh popup copy to match the redesign**

Adjust `i18n.js` copy for:

```text
popup heading/subheading
empty state guidance
status summary tone
signals copy
search placeholder
shortcut strings if needed
```

- [ ] **Step 4: Verify popup script parses cleanly**

Run: `node --check scripts\popup\popup.js`
Expected: exit code 0 with no syntax errors

### Task 4: Redesign the options structure

**Files:**
- Modify: `D:\workspace\alan\project1\options.html`
- Modify: `D:\workspace\alan\project1\scripts\options\options.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\i18n.js`

- [ ] **Step 1: Update options markup to reflect the four-section control center**

Implement:

```text
shorter hero with clearer explanation
basics card
AI readiness summary card
AI enhancement form card
index and privacy operations card
feedback and progress areas that align with the new structure
```

- [ ] **Step 2: Repair and align options DOM bindings**

Ensure `options.js` has element references for:

```text
showAdvancedHints
showRecents
basic/options copy paragraphs
hero note copy
privacy copy
any IDs added during markup restructuring
```

- [ ] **Step 3: Update settings copy for clearer readiness and feedback**

Adjust `i18n.js` copy for:

```text
options hero copy
basics copy
AI readiness language
privacy and progress explanations
feedback messages that should sound calmer and more instructive
```

- [ ] **Step 4: Verify options script parses cleanly**

Run: `node --check scripts\options\options.js`
Expected: exit code 0 with no syntax errors

### Task 5: Run end-to-end file verification

**Files:**
- Modify: `D:\workspace\alan\project1\popup.html`
- Modify: `D:\workspace\alan\project1\options.html`
- Modify: `D:\workspace\alan\project1\styles.css`
- Modify: `D:\workspace\alan\project1\scripts\popup\popup.js`
- Modify: `D:\workspace\alan\project1\scripts\options\options.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\i18n.js`

- [ ] **Step 1: Run syntax verification on all updated JavaScript files**

Run:

```powershell
node --check scripts\popup\popup.js
node --check scripts\options\options.js
node --check scripts\shared\i18n.js
```

Expected: all commands exit 0

- [ ] **Step 2: Sanity-check the final file set**

Run:

```powershell
Get-Item popup.html, options.html, styles.css, scripts\popup\popup.js, scripts\options\options.js, scripts\shared\i18n.js |
  Select-Object Name, Length, LastWriteTime
```

Expected: all redesigned files exist and have updated timestamps

- [ ] **Step 3: Summarize verification evidence before reporting completion**

Report:

```text
which files changed
which checks passed
whether any residual risks remain (for example: visual verification in Chrome still recommended)
```
