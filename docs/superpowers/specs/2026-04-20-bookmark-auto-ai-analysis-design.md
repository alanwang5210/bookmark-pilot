# Bookmark Auto AI Analysis Design

## Context

Bookmark Pilot already supports manual AI enrichment for existing bookmarks, folders, and tabs. The user now wants new bookmarks to gain AI help automatically at save time, without delaying or blocking the save flow.

The new behavior should:

- keep bookmark creation fast and non-blocking
- automatically analyze newly created bookmarks in the background
- generate both AI tags and a one-sentence purpose summary
- reuse the existing AI provider, model, permissions, and storage flow

## Goals

- Trigger AI enrichment automatically for new bookmarks after creation.
- Store a generated one-sentence summary alongside generated tags.
- Keep manual AI rebuild and search behavior compatible with the new data.
- Fail gracefully when AI is disabled, misconfigured, or temporarily unavailable.

## Non-Goals

- No blocking "save bookmark" flow while waiting for AI.
- No UI redesign in popup or options for this feature.
- No retroactive full-library rebuild logic changes beyond the existing manual rebuild.
- No custom prompt editor for summaries.

## Product Direction

This feature should feel invisible when it works and harmless when it fails. Bookmark save should stay immediate. AI enrichment should trail behind as a background enhancement that quietly improves recall and later presentation.

## UX Model

### Save Flow

When a new bookmark is created:

1. the bookmark is saved immediately
2. the search index refreshes as it does today
3. a background async task attempts AI enrichment for that single bookmark

If enrichment succeeds, the bookmark gets:

- AI tags
- a short one-sentence summary of what the bookmark is for

If enrichment fails, the bookmark remains saved and searchable without AI extras.

### Failure Handling

No user-blocking error should appear during bookmark creation. Background failures should be logged or safely ignored for now. This keeps the primary action reliable.

## Technical Design

### Trigger Point

Use `chrome.bookmarks.onCreated` in the background script as the trigger. After the existing bookmark refresh runs, schedule a best-effort async enrichment task for the new bookmark only.

### Candidate Resolution

The background task should:

1. ignore non-URL bookmark nodes
2. locate the newly created bookmark inside the refreshed `SearchIndex`
3. call the existing AI enrichment pipeline with a single-item candidate list

### AI Result Shape

The current AI pipeline returns tags only. Extend it to request and persist:

```json
{
  "tags": ["..."],
  "summary": "一句话说明这个书签的作用。"
}
```

The summary should be:

- a single sentence
- concise
- useful for later search/result explanation

### Prompt Strategy

Keep one AI request per bookmark. Reuse the existing prompt inputs:

- title
- url
- folder path
- entity type
- optional enhanced page metadata when available

Update the prompt instructions so the model returns both tags and a summary in one JSON response.

### Storage Model

AI records in IndexedDB should gain a `summary` field in addition to `tags`. Existing records without `summary` must continue to work.

Suggested persisted record shape:

```json
{
  "key": "bookmark:123",
  "entityType": "bookmark",
  "entityId": "123",
  "title": "Example",
  "url": "https://example.com",
  "tags": ["reference", "docs"],
  "summary": "用于查阅产品 API 文档的参考页面。",
  "updatedAt": "2026-04-20T10:00:00.000Z"
}
```

### Search Index Compatibility

The existing search pipeline should continue to use tags as before. Summary storage is additive and should not break current indexing or result ranking.

### Safety Rules

Auto-analysis should be skipped when:

- AI is disabled
- API key or base URL is missing
- host permission is missing
- the created node is not a bookmark URL

### Concurrency and Noise

Bulk bookmark imports or sync events may create many bookmarks quickly. The initial implementation should still process them best-effort, but keep each item isolated so one failure does not abort unrelated items. Avoid duplicate work for the same bookmark creation event when possible.

## Risks and Edge Cases

- bookmark creation can happen before AI settings are configured
- imported bookmarks may arrive in bursts
- enhanced metadata fetch is only possible for tabs, so most bookmarks will rely on saved bookmark fields only
- malformed AI JSON should not break the background event pipeline

## Expected Outcome

After this feature:

1. the user saves a bookmark
2. the bookmark appears immediately
3. the extension asynchronously enriches it with AI tags
4. the extension also stores a concise one-sentence summary
5. AI outages do not block saving bookmarks

## Verification Requirements

Before this feature is considered complete, verify:

- a new bookmark triggers best-effort background AI enrichment
- the AI response parser accepts `tags + summary`
- summary is stored with the AI record
- AI-disabled or AI-misconfigured states skip auto-analysis without throwing user-facing failures
- syntax checks pass for the changed background, shared, and test files
