# PII Prompt Shield (Browser Extension MVP)

This project is a Manifest V3 browser extension (Chrome + Firefox packaging) that detects likely sensitive personal data in prompts before they are sent to LLM chat interfaces.

## What it does

- Watches prompt submissions in common LLM chat UIs.
- Intercepts send attempts from form submit, send buttons, and Enter key.
- Detects common private data patterns, including:
  - Names (contextual intros like `my name is ...`)
  - Ages (contextual forms like `I am 34 years old`)
  - German-language variants (for example `Mein Name ist ...`, `Ich bin 34 Jahre alt`, `Geburtsdatum ...`)
  - Email addresses
  - Phone numbers (context-filtered)
  - SSNs
  - National IDs (German `Steuer-ID` context)
  - Bank account identifiers (German `IBAN`)
  - Credit card numbers (Luhn-checked)
  - Street addresses
  - Date of birth patterns
  - Common API keys/tokens (OpenAI, Anthropic, GitHub, Google, AWS)
- Ignores weaker signals (like names/ages) inside backticks/fenced code blocks, while still catching high-risk secrets.
- Supports two behaviors:
  - `Block + Review`: prevent send and show an action modal.
  - `Warn Only`: prompt a confirmation dialog.
- Supports sensitivity tuning:
  - `Strict`: flag any signal
  - `Balanced`: score-based default (recommended)
  - `Lenient`: only higher-confidence signals
- Runs on supported LLM sites.
- Lets you trust/bypass selected websites.

## Structure

- `manifest.json` - extension manifest
- `src/detector.js` - privacy detection + scoring + redaction logic
- `src/content.js` - in-page guard that intercepts sends
- `popup/popup.html` - popup UI
- `popup/popup.css` - popup styles
- `popup/popup.js` - popup settings logic
- `firefox/manifest.overrides.json` - Firefox-specific manifest additions
- `landing/index.html` - standalone product landing page
- `landing/styles.css` - landing page styles

## Landing Page Preview

Open this file directly in your browser:

- `landing/index.html`

## Load in Chrome (Development)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Load in Firefox (Development)

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**
3. Select either:
   - `manifest.json` (quick local load), or
   - a packaged Firefox build from `dist/*.xpi`

## Usage

1. Open an LLM site (ChatGPT, Claude, Gemini, etc.).
2. Enter a prompt containing private info.
3. Attempt to send.
4. The extension will warn or block depending on popup settings.

## Testing

1. Run tests:
   ```bash
   npm test
   ```
2. This runs `node --test` against `tests/detector.test.js`.
3. The test suite verifies detection of all supported privacy entities:
   - `name`, `age`, `email`, `phone`, `ssn`, `address`, `dob`, `credit_card`, `api_key`, `national_id`, `bank_account`

## Packaging For Chrome Web Store

1. Build an upload ZIP (runs tests first):
   ```bash
   npm run package:chrome
   ```
2. Or build without running tests:
   ```bash
   npm run package:chrome:skip-tests
   ```
3. Output is written to `dist/<name>-v<version>.zip`.

## Packaging For Firefox Add-ons

1. Build an `.xpi` package (runs tests first):
   ```bash
   npm run package:firefox
   ```
2. Or build without running tests:
   ```bash
   npm run package:firefox:skip-tests
   ```
3. Output is written to `dist/<name>-firefox-v<version>.xpi`.

The Firefox build merges `manifest.json` with `firefox/manifest.overrides.json` to add Firefox-specific settings (`browser_specific_settings` for Gecko).

## Store Assets

1. Generate store screenshots and promotional images:
   ```bash
   npm run assets:store
   ```
2. Output is written to `store-assets/`.

## Privacy Policy Document

Use these files for the Chrome Web Store privacy policy URL field:

- `legal/privacy-policy.md`
- `legal/privacy-policy.html`

Host the HTML file on a public URL (for example GitHub Pages), then paste that URL into the Web Store form.

## Notes

- This is heuristic detection, not guaranteed perfect classification.
- `Balanced` mode is designed to reduce false positives from weaker single signals.
- You can tune regexes and scoring in `src/detector.js`.
