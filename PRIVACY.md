# Privacy Policy

Last updated: 2026-04-22

Bookmark Pilot is a Chrome extension focused on helping users search and manage bookmarks, folders, and tabs. This policy explains what data the extension accesses, how that data is used, and when data may be sent to third-party services chosen by the user.

## Data The Extension Accesses

- Bookmarks and bookmark folders, so the extension can provide unified search and organization.
- Open tab information, including tab title, URL, and window relationship, so tabs can be included in unified search results.
- Extension settings and local state, such as language preference, AI settings, saved AI scope selection, and indexing status.
- Optional page metadata, such as page title or meta description, only when the user enables enhanced AI analysis.

## How Data Is Used

- To index and search bookmarks, folders, and tabs inside the extension.
- To save user preferences locally on the user's device.
- To generate optional AI labels and summaries when the user enables AI features.
- To check whether selected bookmark or tab URLs appear to be dead links when the user starts dead-link scanning.

## Local Storage

Bookmark Pilot stores settings and extension state locally using `chrome.storage.local` and IndexedDB. This may include AI configuration entered by the user, saved scope selection, usage statistics used by the extension experience, and AI-generated labels or summaries created for bookmarks, folders, or tabs.

## AI Features And Third-Party Services

AI features are optional and only run when the user enables them and provides an AI service endpoint and API key.

When AI analysis is used, Bookmark Pilot may send selected item metadata to the user-configured AI provider, including:

- Item title
- Item URL
- Folder path
- Entity type, such as bookmark, folder, or tab
- Optional page description metadata when enhanced AI analysis is enabled

The developer of Bookmark Pilot does not operate the user-selected AI endpoint and is not responsible for the privacy practices of that third-party AI provider.

## Dead-Link Scanning

When the user runs dead-link scanning, the extension sends network requests to the URLs selected for checking in order to determine whether those URLs return errors such as `404`, `410`, DNS failure, or connection failure.

## Data Sharing

Bookmark Pilot does not sell user data. Data is not shared with the developer's own server, because the extension does not use a developer-operated backend service. Data is only transmitted externally when the user explicitly uses features that require network access, such as AI analysis or dead-link scanning.

## User Control

- Users can disable AI features at any time.
- Users can clear AI-generated labels inside the extension.
- Users can choose the AI scope and whether to include tabs.
- Users can remove the extension to delete extension-managed local data from Chrome according to Chrome's extension data behavior.

## Contact

For privacy questions about Bookmark Pilot, please contact the developer using the support contact information provided on the Chrome Web Store listing for this extension.

