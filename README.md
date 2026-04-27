# Bookmark Pilot

Bookmark Pilot is a Chrome extension for quickly finding, understanding, and maintaining saved browsing content. It provides unified search across bookmarks, folders, and open tabs, with typo-tolerant matching, optional AI-generated labels, and dead-link cleanup.

## Features

- Unified search for bookmarks, bookmark folders, and open tabs
- Typo-tolerant matching for misspelled queries such as `apifix` -> `Apifox`
- Folder-aware and tab-aware result ranking
- Optional AI labels and one-sentence summaries for bookmarks, folders, and tabs
- Custom AI generation scope with tree-based multi-selection
- Automatic AI analysis when a new bookmark is saved, if AI is enabled
- Dead-link scanning for `404`, `410`, DNS failure, and connection failure
- Review-first cleanup flow before deleting bookmarks or closing tabs
- Local-first settings, index state, and AI metadata storage
- Chinese and English interface support

## Screenshots

Screenshots and Chrome Web Store promotional assets can be placed in `assets/store/`.

## Installation For Development

1. Open Chrome and go to `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this project folder.
5. Pin Bookmark Pilot from the Chrome toolbar if desired.

This project is a plain Manifest V3 extension. There is no build step required for local development.

## Packaging

The extension can be packaged by zipping only the runtime files:

- `manifest.json`
- `popup.html`
- `options.html`
- `styles.css`
- `assets/icons/icon-16.png`
- `assets/icons/icon-32.png`
- `assets/icons/icon-48.png`
- `assets/icons/icon-128.png`
- `scripts/background/*.js`
- `scripts/options/*.js`
- `scripts/popup/*.js`
- `scripts/shared/*.js`

Do not include tests, docs, private keys, `.pem` files, or generated development artifacts in the store upload package.

## Project Structure

```text
assets/
  icons/                 Extension icons
docs/
  superpowers/           Design notes and implementation plans
scripts/
  background/            Service worker, indexing, AI, and cleanup logic
  options/               Options page behavior
  popup/                 Popup search UI behavior
  shared/                Shared search, storage, i18n, and scope utilities
manifest.json            Chrome extension manifest
options.html             Options page
popup.html               Popup UI
privacy-policy.html      Public privacy policy page template
styles.css               Shared extension styles
```

## Tests

Tests use Node.js built-in test runner.

```powershell
node --test .\scripts\shared\*.test.mjs
node --test .\scripts\background\*.test.mjs
```

## Privacy

Bookmark Pilot is designed around local-first data handling. It stores settings and extension state locally with `chrome.storage.local` and IndexedDB.

AI features are optional. When enabled by the user, selected item metadata such as title, URL, folder path, entity type, and optional page description metadata may be sent to the AI endpoint configured by the user.

See [PRIVACY.md](./PRIVACY.md) and [privacy-policy.html](./privacy-policy.html) for the full privacy policy.

## Permissions

Bookmark Pilot requests only the permissions needed for its core purpose: searching and managing bookmarks, folders, and tabs.

- `bookmarks`: Read bookmark and folder data, and remove user-selected dead bookmarks during cleanup.
- `tabs`: Include open tabs in search results, switch to selected tabs, and close selected tabs when requested by the user.
- `storage`: Save settings, index state, AI configuration, saved AI scope, and local extension state.
- `scripting` optional: Read lightweight page metadata only when enhanced AI analysis is enabled.
- `http://*/*` and `https://*/*` optional host permissions: Check selected URLs during dead-link scanning and connect to the user-configured AI provider endpoint.

## Chrome Web Store Notes

The extension has one clear purpose: helping users search and manage bookmarks, folders, and tabs in Chrome more efficiently. All features are directly related to finding, understanding, and maintaining saved browsing content.

The privacy policy URL must be added in the Chrome Web Store Developer Dashboard under the product's `Privacy` tab. Adding the privacy policy link only in the product description is not sufficient for review.

## Development Notes

- Keep extension code dependency-free unless a clear need appears.
- Keep generated store packages out of Git.
- Do not commit API keys, `.pem` files, or locally generated `.crx` files.
- When adding behavior that changes shared search or scope logic, add or update tests under `scripts/shared/`.

