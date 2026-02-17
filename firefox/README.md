# Firefox Build

This folder contains Firefox-specific manifest overrides used during packaging.

- `manifest.overrides.json`: merged into the root `manifest.json` to add Gecko settings.

## Build Firefox Package

From the project root:

- `npm run package:firefox`
- `npm run package:firefox:skip-tests`

Output:

- `dist/<name>-firefox-v<version>.xpi`
