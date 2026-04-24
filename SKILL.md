---
name: screenshot
description: Screenshot any URL using your Chrome profile (authenticated). Use when the user provides a URL and wants to see what's on the page, read images, or inspect UI.
argument-hint: <url>
allowed-tools: Bash(node ~/projects/page-screenshot/bin/page-screenshot.mjs *), Read
---

# Page Screenshot

Capture a screenshot of any URL using the `page-screenshot` CLI tool, then read the image so Claude can describe its contents.

## Prerequisites

The tool must be cloned and installed locally:

```bash
cd ~/projects/page-screenshot && npm install
```

## How to take a screenshot

```bash
node ~/projects/page-screenshot/bin/page-screenshot.mjs <url>
```

Available flags:
- `--full-page` — Capture the full scrollable page
- `--width <px>` — Viewport width (default: 1280)
- `--height <px>` — Viewport height (default: 800)
- `--wait <ms>` — Extra wait time after page load
- `--output <path>` — Custom output path

## Steps

1. Take the URL from `$ARGUMENTS` or from the user's message
2. Run the CLI to capture a screenshot
3. The CLI outputs the screenshot file path to stdout
4. Use the `Read` tool to view the screenshot image (Claude can read images natively)
5. Describe the contents of the screenshot to the user

## Authentication

The tool uses your existing Chrome session for authentication:

- **Best:** If Chrome is running with `--remote-debugging-port=9222`, it connects directly to your session
- **Fallback:** If Chrome is closed, it launches headless Chrome with your profile (has your cookies)
- **Last resort:** If Chrome is open without debugging port, it launches a fresh session (no auth)

To enable remote debugging on your running Chrome:
```bash
open -a "Google Chrome" --args --remote-debugging-port=9222
```

## Notes

- Output is a PNG screenshot saved to `/tmp/page-screenshot-<timestamp>.png`
- Works with any URL — Strety, Intercom, or any site you're logged into in Chrome
- If the page needs auth and you see a login page, restart Chrome with the debugging port flag
