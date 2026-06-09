---
name: browser-proof
description: Verify user-visible web changes in a real browser or browser-equivalent runtime before claiming they work.
---

# Browser Proof

Use this for visible UI, navigation, forms, auth flows, dashboards, or content pages.

## Flow

1. Start the app using the repo's normal command.
2. Open the relevant page in the available browser tool or approved headless browser.
3. Check the actual user flow, not just the component in isolation.
4. Inspect console and network errors when possible.
5. Capture screenshots, logs, or a concise manual proof note.
6. If browser access is unavailable, state that clearly and run the closest meaningful fallback.

## Guardrails

- Do not claim "renders" from a successful build alone.
- Do not ignore responsive/mobile layout when the change affects layout.
- Do not use screenshots as decoration; use them as proof of the requested state.
