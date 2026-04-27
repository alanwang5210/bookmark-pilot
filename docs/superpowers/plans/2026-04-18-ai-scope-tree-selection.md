# Bookmark Pilot AI Scope Tree Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent tree-based AI generation scope selection for bookmarks and tabs, with saved defaults and a quick review flow before AI regeneration.

**Architecture:** Extend AI settings with persisted scope selection IDs, add a shared tree-selection helper module to build bookmark/tab trees plus derived selection state, and update the settings page to render/edit the tree scope while the background AI pipeline resolves only the selected nodes at rebuild time. Keep the existing AI generation prompt flow intact and limit changes to scope resolution, settings persistence, and settings-page UX.

**Tech Stack:** Chrome extension HTML/CSS, vanilla JavaScript modules, Chrome bookmarks/tabs APIs, local extension settings storage

---

### Task 1: Extend settings and message boundaries for AI scope

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\shared\constants.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\storage.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\i18n.js`

- [ ] **Step 1: Add default scope selection state**

Update `DEFAULT_SETTINGS.ai` in `scripts/shared/constants.js` to include:

```js
scopeSelection: {
  bookmarkNodeIds: [],
  tabNodeIds: []
}
```

- [ ] **Step 2: Make settings merge preserve nested scope selection**

Update `mergeSettings()` in `scripts/shared/storage.js` so `scopeSelection` merges like `applyTo`, for example:

```js
scopeSelection: {
  ...DEFAULT_SETTINGS.ai.scopeSelection,
  ...(stored.ai?.scopeSelection || {})
}
```

- [ ] **Step 3: Add user-facing strings for the new scope UI**

Add translation keys in `scripts/shared/i18n.js` for:

```text
optionsScopeSection
optionsScopeCopy
optionsScopeSummary
optionsScopeAdjust
optionsScopeBookmarks
optionsScopeTabs
optionsScopeEmpty
optionsScopeUnsaved
optionsScopeSavingAndRunning
optionsScopeReviewHint
optionsScopeSelectedFolders
optionsScopeSelectedBookmarks
optionsScopeSelectedWindows
optionsScopeSelectedTabs
```

- [ ] **Step 4: Verify the shared files still parse**

Run:

```powershell
node --check scripts\shared\constants.js
node --check scripts\shared\storage.js
node --check scripts\shared\i18n.js
```

Expected: all commands exit 0

### Task 2: Add reusable tree-building and selection helpers

**Files:**
- Create: `D:\workspace\alan\project1\scripts\shared\ai-scope.js`
- Modify: `D:\workspace\alan\project1\scripts\background\indexer.js`

- [ ] **Step 1: Expose bookmark tree source data**

Update `flattenBookmarkTree()` in `scripts/background/indexer.js` so folder records keep enough structure for later scope resolution, including:

```js
childFolderIds
childBookmarkIds
descendantFolderIds
```

- [ ] **Step 2: Create bookmark and tab tree helpers**

Add `scripts/shared/ai-scope.js` with pure helpers for:

```js
buildBookmarkScopeTree({ folders, bookmarks })
buildTabScopeTree({ tabs })
resolveBookmarkScopeSelection({ folders, bookmarks, selectedNodeIds })
resolveTabScopeSelection({ tabs, selectedNodeIds })
deriveNodeSelectionState({ selectedNodeIds, descendants })
summarizeScopeSelection({ bookmarkResolution, tabResolution })
```

- [ ] **Step 3: Make selection helpers store explicit IDs only**

Ensure the helper API works with:

```js
selected bookmark folder IDs
selected bookmark IDs
selected window IDs in the form window:<id>
selected tab IDs in the form tab:<id>
```

and resolves descendants only at runtime.

- [ ] **Step 4: Add a small executable verification script**

Run:

```powershell
@'
import { buildTabScopeTree, summarizeScopeSelection } from "./scripts/shared/ai-scope.js";
console.log(typeof buildTabScopeTree, typeof summarizeScopeSelection);
'@ | node --input-type=module -
```

Expected: output contains `function function`

### Task 3: Render and edit the tree selector in settings

**Files:**
- Modify: `D:\workspace\alan\project1\options.html`
- Modify: `D:\workspace\alan\project1\styles.css`
- Modify: `D:\workspace\alan\project1\scripts\options\options.js`
- Modify: `D:\workspace\alan\project1\scripts\background\background.js`

- [ ] **Step 1: Insert the new AI generation scope section**

Add a new settings card in `options.html` between the AI enhancement card and the index/privacy card containing:

```html
<section class="settings-card settings-card-wide">
  <div class="section-copy">
    <h2 id="scope-section-title"></h2>
    <p id="scope-section-copy" class="section-text"></p>
  </div>
  <div id="scope-summary" class="status-inline"></div>
  <div class="button-row">
    <button id="toggle-scope-review" class="ghost-button" type="button"></button>
  </div>
  <div id="scope-panel" class="scope-panel">
    <div class="scope-columns">
      <section class="scope-tree-card">
        <h3 id="scope-bookmarks-title"></h3>
        <div id="bookmark-scope-tree"></div>
      </section>
      <section class="scope-tree-card">
        <h3 id="scope-tabs-title"></h3>
        <div id="tab-scope-tree"></div>
      </section>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add tree-specific styles**

Extend `styles.css` with classes for:

```text
scope-panel
scope-columns
scope-tree-card
scope-tree
scope-node
scope-node-row
scope-node-children
scope-toggle
scope-checkbox
scope-node.partial
scope-summary-pills
```

and make the layout responsive so the two trees stack on narrow widths.

- [ ] **Step 3: Provide scope source data from the background**

Add a background message response in `scripts/background/background.js` that returns current scope source data:

```js
{
  folders: searchIndex.folders,
  bookmarks: searchIndex.bookmarks,
  tabs: searchIndex.tabs
}
```

using a new `MESSAGE_TYPES.GET_AI_SCOPE_SOURCE`.

- [ ] **Step 4: Render the tree and draft state in `options.js`**

Update `scripts/options/options.js` to:

```text
load current settings plus scope source data
build bookmark and tab trees with ai-scope helpers
render tree rows with expand/collapse and checkboxes
track draft scope selection separately from saved settings
update the summary live as the draft changes
show a review hint when draft scope differs from saved scope
```

- [ ] **Step 5: Verify options script parses after the tree UI changes**

Run:

```powershell
node --check scripts\options\options.js
node --check scripts\background\background.js
```

Expected: both commands exit 0

### Task 4: Apply saved scope during AI rebuild

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\shared\constants.js`
- Modify: `D:\workspace\alan\project1\scripts\background\background.js`
- Modify: `D:\workspace\alan\project1\scripts\background\ai.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\search.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\ai-scope.js`

- [ ] **Step 1: Add the new background message constant**

Add to `MESSAGE_TYPES`:

```js
GET_AI_SCOPE_SOURCE: "get-ai-scope-source"
```

- [ ] **Step 2: Resolve selected scope before running AI rebuild**

In `scripts/background/background.js`, update `startAiRebuild()` to:

```js
const selection = settings.ai.scopeSelection;
const bookmarkScope = resolveBookmarkScopeSelection({
  folders: searchIndex.folders,
  bookmarks: searchIndex.bookmarks,
  selectedNodeIds: selection.bookmarkNodeIds
});
const tabScope = resolveTabScopeSelection({
  tabs: searchIndex.tabs,
  selectedNodeIds: selection.tabNodeIds
});
```

and use those resolutions to filter the candidate item list.

- [ ] **Step 3: Respect folder, bookmark, and tab resolution in AI enrichment**

Update `scripts/background/ai.js` so `enrichItemsWithAi()` can receive a filtered candidate set that already represents the chosen scope and no longer assumes a broad type-only selection.

- [ ] **Step 4: Use scope summary in progress messaging**

Update progress-related code so the rebuild status can include a scope summary such as:

```text
2 folders / 18 bookmarks / 1 window / 6 tabs
```

in the progress message or companion status field.

- [ ] **Step 5: Verify background scripts parse**

Run:

```powershell
node --check scripts\background\background.js
node --check scripts\background\ai.js
node --check scripts\shared\search.js
node --check scripts\shared\ai-scope.js
```

Expected: all commands exit 0

### Task 5: Save draft scope safely and gate rebuild when needed

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\options\options.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\i18n.js`

- [ ] **Step 1: Save scope as part of normal settings persistence**

When the user clicks save, include:

```js
ai: {
  ...existingAiSettings,
  scopeSelection: currentDraftScopeSelection
}
```

so the scope is persisted as the default.

- [ ] **Step 2: Block empty-scope rebuilds clearly**

In `options.js`, disable rebuild when the resolved draft scope is empty and show the empty-scope guidance string.

- [ ] **Step 3: Handle unsaved scope edits before rebuild**

If draft scope differs from saved scope when the user clicks rebuild:

```text
save the new scope first
refresh current settings
then start rebuild
show feedback that the new scope was saved and used
```

- [ ] **Step 4: Verify the updated options script still parses**

Run:

```powershell
node --check scripts\options\options.js
```

Expected: exit code 0

### Task 6: Final verification evidence

**Files:**
- Modify: `D:\workspace\alan\project1\options.html`
- Modify: `D:\workspace\alan\project1\styles.css`
- Modify: `D:\workspace\alan\project1\scripts\shared\constants.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\storage.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\i18n.js`
- Create: `D:\workspace\alan\project1\scripts\shared\ai-scope.js`
- Modify: `D:\workspace\alan\project1\scripts\background\indexer.js`
- Modify: `D:\workspace\alan\project1\scripts\background\background.js`
- Modify: `D:\workspace\alan\project1\scripts\background\ai.js`
- Modify: `D:\workspace\alan\project1\scripts\options\options.js`

- [ ] **Step 1: Run the full syntax verification set**

Run:

```powershell
node --check scripts\shared\constants.js
node --check scripts\shared\storage.js
node --check scripts\shared\i18n.js
node --check scripts\shared\ai-scope.js
node --check scripts\background\indexer.js
node --check scripts\background\background.js
node --check scripts\background\ai.js
node --check scripts\options\options.js
```

Expected: all commands exit 0

- [ ] **Step 2: Run a structural HTML check for new scope nodes**

Run:

```powershell
@'
const fs = require("fs");
const html = fs.readFileSync("options.html", "utf8");
const ids = [
  "scope-section-title",
  "scope-section-copy",
  "scope-summary",
  "toggle-scope-review",
  "scope-panel",
  "bookmark-scope-tree",
  "tab-scope-tree"
];
for (const id of ids) {
  if (!html.includes(`id="${id}"`)) {
    console.error(`missing ${id}`);
    process.exit(1);
  }
}
console.log("scope HTML check passed");
'@ | node -
```

Expected: output contains `scope HTML check passed`

- [ ] **Step 3: Summarize residual risks honestly**

Report:

```text
whether visual verification in Chrome is still needed
whether dynamic tab disappearance remains a runtime-only edge case
which files now own tree-building, persistence, and rebuild filtering
```
