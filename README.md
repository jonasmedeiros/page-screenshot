# page-screenshot

Screenshot any URL using your Chrome profile (with cookies/auth). Built for use as a [Claude Code](https://claude.ai/code) skill to view authenticated pages and images.

## Install

```bash
git clone https://github.com/jonasmedeiros/page-screenshot.git ~/projects/page-screenshot
cd ~/projects/page-screenshot && npm install
```

## Usage

```bash
node ~/projects/page-screenshot/bin/page-screenshot.mjs <url> [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--output <path>` | Save screenshot to a specific path | `/tmp/page-screenshot-<ts>.png` |
| `--full-page` | Capture the full scrollable page | viewport only |
| `--width <px>` | Viewport width | 1280 |
| `--height <px>` | Viewport height | 800 |
| `--wait <ms>` | Extra wait time after page load | 0 |

### Examples

```bash
# Screenshot an authenticated page
page-screenshot https://2.strety.com/some-page

# Full page capture
page-screenshot --full-page https://2.strety.com/some-page

# Custom dimensions
page-screenshot --width 1920 --height 1080 https://example.com
```

## Authentication

The tool uses your existing Chrome session for authentication:

1. **Best:** If Chrome is running with `--remote-debugging-port=9222`, it connects directly to your session
2. **Fallback:** If Chrome is closed, it launches headless Chrome with your profile (has your cookies)
3. **Last resort:** If Chrome is open without debugging port, it launches a fresh session (no auth)

To enable remote debugging on your running Chrome:

```bash
open -a "Google Chrome" --args --remote-debugging-port=9222
```

## Claude Code Skill

Copy `SKILL.md` to your Claude Code skills directory to use as a `/screenshot` slash command:

```bash
mkdir -p ~/.claude/skills/screenshot
cp SKILL.md ~/.claude/skills/screenshot/SKILL.md
```

Then use `/screenshot <url>` in Claude Code to capture and read screenshots.

## Requirements

- Node.js >= 18
- Google Chrome (or Chromium)

## License

MIT
