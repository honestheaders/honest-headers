# Honest Headers

A small, private Chrome extension to add, change or remove HTTP request and response headers.

- Profiles, one-click pause, regex URL filters
- Request **and** response headers (empty value = remove the header)
- Imports ModHeader JSON exports
- **No data collection, no analytics, no ads, no remote code.** The extension makes no network requests of its own.

## How it works

Honest Headers only uses Chrome's built-in [`declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) rules. It has no content scripts and never reads page content. Your profiles are saved in `chrome.storage.local` on your own computer.

| File | What it does |
|---|---|
| `background.js` | Turns the active profile into header rules whenever you change something |
| `lib/rules.js` | Builds the rules (this is the whole "engine") |
| `lib/state.js` | Saving, loading and validating profiles |
| `lib/importers.js` | Import / export, ModHeader compatibility |
| `popup.*` / `options.*` | The user interface |

## Permissions

- `declarativeNetRequest` – to change headers
- `storage` – to save your profiles locally
- `<all_urls>` host access – Chrome requires this so header rules can apply to the sites you choose. Limit it with URL filters.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## License

MIT
