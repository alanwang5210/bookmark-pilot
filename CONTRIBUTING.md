# Contributing

Thanks for taking an interest in Bookmark Pilot.

## Local Development

1. Open Chrome and go to `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the project folder.

No build step is required for local development.

## Tests

Run the focused test suites with:

```powershell
node --test .\scripts\shared\*.test.mjs
node --test .\scripts\background\*.test.mjs
```

## Guidelines

- Keep changes scoped to the feature or bug being addressed.
- Follow the existing plain JavaScript Manifest V3 structure.
- Add or update tests for shared search, scope, AI, or cleanup behavior.
- Do not commit generated packages, API keys, `.pem` files, or `.crx` files.
- Keep user-facing copy clear in both Chinese and English when touching i18n content.

