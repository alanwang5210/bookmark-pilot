# Bookmark Auto AI Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically enrich newly created bookmarks with AI tags and a one-sentence summary, without blocking bookmark creation.

**Architecture:** Extend the existing AI enrichment request to return both tags and summary in one JSON payload, persist the summary in IndexedDB, and hook a best-effort single-bookmark enrichment path into the background `chrome.bookmarks.onCreated` flow after the bookmark index refresh completes. Keep the feature asynchronous and silently degradable when AI is unavailable.

**Tech Stack:** Chrome extension background service worker, vanilla JavaScript ES modules, IndexedDB, Chrome bookmarks API, fetch-based OpenAI-compatible chat completions

---

### Task 1: Add failing tests for AI response parsing and single-bookmark persistence

**Files:**
- Create: `D:\workspace\alan\project1\scripts\background\ai.test.mjs`
- Modify: `D:\workspace\alan\project1\scripts\background\ai.js`

- [ ] **Step 1: Write the failing parser tests**
- [ ] **Step 2: Run `node --test scripts\background\ai.test.mjs` and verify failure**
- [ ] **Step 3: Implement minimal parser helpers for `tags + summary`**
- [ ] **Step 4: Re-run `node --test scripts\background\ai.test.mjs` and verify pass**

### Task 2: Persist summary in AI records

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\background\ai.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\db.js`

- [ ] **Step 1: Extend the AI record shape to include `summary`**
- [ ] **Step 2: Keep existing records without summary compatible**
- [ ] **Step 3: Add or update tests to assert summary persistence**
- [ ] **Step 4: Re-run the focused tests**

### Task 3: Add failing tests for new-bookmark auto-analysis trigger

**Files:**
- Create: `D:\workspace\alan\project1\scripts\background\background-auto-ai.test.mjs`
- Modify: `D:\workspace\alan\project1\scripts\background\background.js`

- [ ] **Step 1: Write a failing test for "created bookmark URL triggers async enrichment"**
- [ ] **Step 2: Write a failing test for "folder node does not trigger enrichment"**
- [ ] **Step 3: Run `node --test scripts\background\background-auto-ai.test.mjs` and verify failure**
- [ ] **Step 4: Add a focused helper in `background.js` for single-bookmark auto-analysis**
- [ ] **Step 5: Re-run the focused trigger tests and verify pass**

### Task 4: Wire the background bookmark-created event to the new async AI path

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\background\background.js`
- Modify: `D:\workspace\alan\project1\scripts\background\indexer.js`

- [ ] **Step 1: Keep the existing bookmark refresh on create**
- [ ] **Step 2: After refresh, resolve the created bookmark from the refreshed index**
- [ ] **Step 3: Fire best-effort AI enrichment for that single bookmark**
- [ ] **Step 4: Refresh AI tag map after success so later searches see the new record**
- [ ] **Step 5: Swallow AI failures at the event boundary so save remains non-blocking**

### Task 5: Final verification

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\background\ai.js`
- Modify: `D:\workspace\alan\project1\scripts\background\background.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\db.js`
- Create: `D:\workspace\alan\project1\scripts\background\ai.test.mjs`
- Create: `D:\workspace\alan\project1\scripts\background\background-auto-ai.test.mjs`

- [ ] **Step 1: Run `node --test scripts\background\ai.test.mjs scripts\background\background-auto-ai.test.mjs`**
- [ ] **Step 2: Run `node --check scripts\background\ai.js scripts\background\background.js scripts\shared\db.js`**
- [ ] **Step 3: Report any remaining runtime-only risks honestly**
