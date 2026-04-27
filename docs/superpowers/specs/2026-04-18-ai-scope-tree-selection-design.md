# Bookmark Pilot AI Scope Tree Selection Design

## Context

Bookmark Pilot currently supports AI tag generation for broad categories only:

- bookmarks and folders as one group
- tabs as one group

This is too coarse for real use. The user wants to choose exactly which resources should participate in AI tag generation, using a tree-based selector that mirrors the underlying structure of bookmarks and tabs.

The new capability should support:

- bookmark selection by folder tree
- tab selection by window and tab tree
- multi-select across multiple branches
- parent selection that automatically includes all descendants
- persistent saved defaults
- a quick review and adjustment flow before starting generation

## Goals

- Let users select precise AI generation scope instead of only broad type toggles.
- Match the selection UI to real data structure so the scope feels understandable.
- Persist the last confirmed scope and restore it on future visits.
- Keep generation fast and safe by making the selected scope visible before execution.
- Preserve current AI generation behavior for items inside the chosen scope.

## Non-Goals

- No change to how tags are generated for a selected item.
- No redesign of the popup search behavior in this feature.
- No need for per-item AI prompt customization.
- No cross-device sync requirements beyond existing local settings behavior.

## Product Direction

This feature should feel like controlled scope selection, not like a file manager. The tree UI should make users feel confident about what will be included without overwhelming them with too much density or too many hidden rules.

The key experience goals are:

- clarity: users can see what is selected
- leverage: selecting a parent saves effort
- safety: users can review the scope before running a long task
- continuity: the last chosen scope comes back automatically

## UX Model

### Main Interaction Pattern

The options page should introduce a new section between AI enhancement and index/privacy:

- AI generation scope

This section contains two tree selectors:

1. Bookmarks tree
2. Tabs tree

The selector is part of the saved AI configuration, not a temporary side panel.

### Bookmark Tree

The bookmark tree should reflect:

- root folders
- nested subfolders
- individual bookmarks

Selection rule:

- selecting a folder automatically includes all descendant folders and bookmarks
- deselecting a selected folder removes the whole subtree
- selecting individual children under an unselected parent puts the parent into a partial state

This means users can choose entire branches quickly while still supporting mixed granular selections when needed.

### Tabs Tree

The tabs tree should reflect:

- browser windows
- tabs inside each window

Selection rule:

- selecting a window automatically includes all tabs in that window
- deselecting a selected window removes the whole subtree
- selecting only some tabs puts the window into a partial state

Tabs should remain distinct from bookmarks and folders in both storage and visual grouping.

### Selection States

Each tree node should support three visual states:

- selected
- unselected
- partially selected

Partial state is derived, not directly stored. It appears when some but not all descendants are selected.

### Persistence Model

The selected scope should be persisted as part of settings so that:

- the user sees the previous scope next time they open settings
- generation uses the saved scope by default

The stored model should save explicitly selected node IDs rather than storing every resolved descendant. At execution time, the app should expand those selections into the full effective scope.

Suggested shape:

```json
{
  "ai": {
    "scopeSelection": {
      "bookmarkNodeIds": ["1", "1-2", "99"],
      "tabNodeIds": ["window:123", "tab:456"]
    }
  }
}
```

The exact key names can change during implementation, but the model should preserve these principles:

- compact persisted state
- explicit user-selected nodes only
- derived final item set during execution

## Generation Flow

### Default Behavior

The primary generate action should continue to feel simple:

- click regenerate AI tags
- generate against the current saved scope

Users should not be forced through a modal every time.

### Quick Review Before Run

Before starting generation, users should be able to quickly review and adjust the scope from the same settings page. This can be done through:

- an always-visible scope summary near the generate action
- an adjacent "adjust scope" affordance that expands or focuses the tree selector

The summary should say what will actually run, for example:

- 2 folders, 18 bookmarks, 1 window, 6 tabs selected

### Unsaved Scope Changes

If the user edits the scope but has not saved it yet, generation should not silently ignore those edits.

Preferred behavior:

- if unsaved scope changes exist, prompt or gate generation with a clear message
- running generation from that state should save the new scope first, then execute

The user should always know whether generation is using the saved scope or the just-edited scope.

### Empty Scope Handling

If no nodes are selected:

- the regenerate action should be disabled
- the UI should explain that at least one folder, bookmark, window, or tab must be selected

### Progress Experience

The progress area should reflect the chosen scope, not imply a full-library rebuild. During generation it should show:

- current progress count
- current item being processed
- the active scope summary for this run

This helps users understand why a run may be small or large and reinforces trust in the selection model.

## Technical Design

### Data Sources

The feature can build on data already present in the codebase:

- bookmarks and folders from `SearchIndex` flattening logic
- tab and window data from `chrome.tabs.query`
- descendant bookmark relationships already attached to folders

The implementation should add tree-building helpers rather than forcing tree logic into the flat search-item layer.

### New Units

Expected implementation units:

- tree-building helpers for bookmark nodes
- tree-building helpers for window/tab nodes
- selection state helpers for expand, collapse, derive partial state, and resolve descendants
- settings persistence updates for stored scope
- UI rendering and event handling for the tree selector
- background AI rebuild logic updated to respect resolved scope

### Execution Semantics

AI rebuild should no longer only filter by broad type toggles. Instead, it should:

1. resolve the saved selection into concrete bookmark IDs, folder IDs, and tab IDs
2. build the candidate item list from those resolved IDs
3. run AI generation only on those candidates

Folder selection should include:

- the folder node itself for folder-tag generation
- all descendant bookmarks
- all descendant subfolders if folder tagging remains enabled for folders

## Accessibility and Usability Requirements

- tree rows should have clear hit targets
- expand/collapse controls should not conflict with checkbox interaction
- partial state must be visible without relying on color alone
- long folder names and tab titles should remain readable
- keyboard navigation is desirable if reasonably aligned with current code patterns

## Risks and Edge Cases

- very large bookmark trees may require careful rendering to avoid a sluggish settings page
- tabs are dynamic and may disappear between selection and generation
- a saved tab scope may refer to tabs or windows that no longer exist
- generation should degrade gracefully if some selected tabs are gone by the time the task starts
- tree state derivation must avoid inconsistent parent/child selection behavior

## Expected UX Outcome

After this feature, the user should be able to:

1. open settings
2. choose exactly which bookmark branches and browser windows/tabs should participate in AI tag generation
3. save that scope as the default
4. later reopen settings and see the same scope restored
5. review a concise summary before running generation
6. run AI generation against only that saved scope

## Verification Requirements

Before implementation is considered complete, verify:

- selecting a folder includes the entire descendant subtree
- selecting a window includes all tabs in that window
- partial state renders correctly for mixed child selections
- saved scope restores after reopening settings
- unsaved scope edits are not silently ignored at generation time
- empty scope disables generation clearly
- progress reflects the chosen scope
- missing tabs/windows do not crash generation
