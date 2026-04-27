# Security Policy

## Supported Versions

Bookmark Pilot is currently maintained from the main source tree in this repository. Security fixes are applied to the latest published version.

## Reporting A Vulnerability

If you discover a security issue, please report it privately using the support contact information listed on the Chrome Web Store page for Bookmark Pilot.

Please include:

- A clear description of the issue
- Steps to reproduce the issue
- The affected extension version
- Any relevant browser or operating system details

Please do not publicly disclose security issues until there has been reasonable time to investigate and address them.

## Data And Secrets

Do not commit API keys, private keys, `.pem` files, generated `.crx` files, or local extension build artifacts. The extension stores user configuration locally and only sends data externally when the user enables features that require network access, such as AI analysis or dead-link scanning.

