import test from "node:test";
import assert from "node:assert/strict";

import { attachAiMetadataToScopeTree, deriveNodeSelectionState, getDefaultScopeSelection, hasScopeSelection } from "./ai-scope.js";

const scopeTree = {
  id: "root",
  type: "folder",
  title: "Root",
  children: [
    {
      id: "child-a",
      type: "folder",
      title: "Child A",
      children: [
        {
          id: "leaf-a1",
          type: "bookmark",
          title: "Leaf A1",
          children: []
        },
        {
          id: "leaf-a2",
          type: "bookmark",
          title: "Leaf A2",
          children: []
        }
      ]
    },
    {
      id: "child-b",
      type: "bookmark",
      title: "Child B",
      children: []
    }
  ]
};

test("selected ancestors make descendants render as checked", () => {
  const selectedNodeIds = new Set(["root"]);

  assert.deepEqual(deriveNodeSelectionState(scopeTree, selectedNodeIds), {
    checked: true,
    partial: false
  });
  assert.deepEqual(deriveNodeSelectionState(scopeTree.children[0], selectedNodeIds, true), {
    checked: true,
    partial: false
  });
  assert.deepEqual(deriveNodeSelectionState(scopeTree.children[0].children[0], selectedNodeIds, true), {
    checked: true,
    partial: false
  });
});

test("unchecking one descendant turns every ancestor on that path partial", () => {
  const selectedNodeIds = new Set(["leaf-a2", "child-b"]);

  assert.deepEqual(deriveNodeSelectionState(scopeTree, selectedNodeIds), {
    checked: false,
    partial: true
  });
  assert.deepEqual(deriveNodeSelectionState(scopeTree.children[0], selectedNodeIds), {
    checked: false,
    partial: true
  });
  assert.deepEqual(deriveNodeSelectionState(scopeTree.children[0].children[0], selectedNodeIds), {
    checked: false,
    partial: false
  });
  assert.deepEqual(deriveNodeSelectionState(scopeTree.children[0].children[1], selectedNodeIds), {
    checked: true,
    partial: false
  });
});

test("attachAiMetadataToScopeTree decorates matching nodes with summary and tags only", () => {
  const nodes = [
    {
      id: "folder-1",
      type: "folder",
      title: "Folder",
      children: [
        {
          id: "bookmark-1",
          type: "bookmark",
          title: "Bookmark 1",
          url: "https://example.com/1",
          children: []
        }
      ]
    },
    {
      id: "window:9",
      type: "window",
      title: "Window 9",
      children: [
        {
          id: "tab:3",
          type: "tab",
          title: "Tab 3",
          url: "https://example.com/3",
          children: []
        }
      ]
    }
  ];

  const decorated = attachAiMetadataToScopeTree(nodes, [
    {
      key: "bookmark:bookmark-1",
      summary: "This bookmark explains feature flags.",
      tags: ["docs", "flags"]
    },
    {
      key: "folder:folder-1",
      summary: "A curated set of documentation links.",
      tags: ["collection"]
    }
  ]);

  assert.equal(decorated[0].aiSummary, "A curated set of documentation links.");
  assert.deepEqual(decorated[0].aiTags, ["collection"]);
  assert.equal(decorated[0].analyzedLeafCount, 1);
  assert.equal(decorated[0].children[0].aiSummary, "This bookmark explains feature flags.");
  assert.deepEqual(decorated[0].children[0].aiTags, ["docs", "flags"]);
  assert.equal(decorated[0].children[0].analyzedLeafCount, 1);
  assert.equal(decorated[1].aiSummary, "");
  assert.deepEqual(decorated[1].aiTags, []);
  assert.equal(decorated[1].analyzedLeafCount, 0);
  assert.equal(decorated[1].children[0].aiSummary, "");
  assert.deepEqual(decorated[1].children[0].aiTags, []);
  assert.equal(decorated[1].children[0].analyzedLeafCount, 0);
});

test("getDefaultScopeSelection selects root bookmark folders but leaves tabs unchecked by default", () => {
  const selection = getDefaultScopeSelection({
    folders: [
      { id: "10", parentId: "", title: "Root A", folderPath: [] },
      { id: "11", parentId: "10", title: "Nested", folderPath: ["Root A"] }
    ],
    bookmarks: [
      { id: "b-1", parentId: "10", title: "Bookmark", url: "https://example.com", folderPath: ["Root A"] }
    ],
    tabs: [
      { id: 1, windowId: 100, title: "Tab 1", url: "https://example.com/1", index: 0 },
      { id: 2, windowId: 200, title: "Tab 2", url: "https://example.com/2", index: 0 }
    ]
  });

  assert.deepEqual(selection, {
    bookmarkNodeIds: ["10"],
    tabNodeIds: []
  });
});

test("hasScopeSelection returns false only when both branches are empty", () => {
  assert.equal(hasScopeSelection({ bookmarkNodeIds: [], tabNodeIds: [] }), false);
  assert.equal(hasScopeSelection({ bookmarkNodeIds: ["10"], tabNodeIds: [] }), true);
  assert.equal(hasScopeSelection({ bookmarkNodeIds: [], tabNodeIds: ["window:1"] }), true);
});
