---
description: Toolkit for testing web applications using Playwright. Use when verifying frontend functionality, debugging UI behavior, or capturing screenshots.
globs: "src/__tests__/**/*.{ts,js,py}"
---

# Web Application Testing

Test local web applications using Playwright.
Source: [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) (Licensed)

## Quick Start

Start the dev server, then run Playwright against it:

```bash
# Start dev server (port 5173, base path /)
npm run dev &

# Run Playwright script
python your_test.py
```

## Playwright Script Template

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173/')
    page.wait_for_load_state('networkidle')  # CRITICAL: Wait for JS to execute

    # ... your test logic

    browser.close()
```

## Decision Tree

```
Is the dev server running?
├─ No → Start it: npm run dev
│        Wait for it to be ready, then proceed
└─ Yes → Reconnaissance-then-action:
    1. Navigate and wait for networkidle
    2. Take screenshot or inspect DOM
    3. Identify selectors from rendered state
    4. Execute actions with discovered selectors
```

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   ```python
   page.screenshot(path='screenshot.png', full_page=True)
   content = page.content()
   page.locator('button').all()
   ```

2. **Identify selectors** from inspection results

3. **Execute actions** using discovered selectors

## Common Pitfalls

- ❌ Don't inspect DOM before waiting for `networkidle` on dynamic apps
- ✅ Always `page.wait_for_load_state('networkidle')` before inspection
- ❌ Don't use `/Njord/` in URLs — base path is `/` (Cloudflare Pages)
- ✅ Always close the browser when done

## Best Practices

- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Add appropriate waits: `page.wait_for_selector()` or `page.wait_for_timeout()`
- Use `sync_playwright()` for synchronous scripts
- Screenshot before and after actions for debugging
