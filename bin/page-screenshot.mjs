#!/usr/bin/env node

import puppeteer from "puppeteer-core"
import { existsSync } from "fs"
import { platform, homedir, tmpdir } from "os"
import { join } from "path"
import { execSync } from "child_process"

const CHROME_PATHS = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
}

const CHROME_PROFILE_PATHS = {
  darwin: join(homedir(), "Library", "Application Support", "Google", "Chrome"),
  linux: join(homedir(), ".config", "google-chrome"),
  win32: join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data"),
}

function findChrome() {
  const paths = CHROME_PATHS[platform()] || []
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  return null
}

function getChromeProfilePath() {
  return CHROME_PROFILE_PATHS[platform()] || null
}

function isChromeRunning() {
  try {
    if (platform() === "darwin") {
      execSync("pgrep -x 'Google Chrome'", { stdio: "pipe" })
      return true
    } else if (platform() === "linux") {
      execSync("pgrep -x chrome", { stdio: "pipe" })
      return true
    } else if (platform() === "win32") {
      execSync("tasklist /FI \"IMAGENAME eq chrome.exe\" /NH", { stdio: "pipe" })
      return true
    }
  } catch {
    return false
  }
  return false
}

function findChromeDebugPort() {
  try {
    if (platform() === "darwin" || platform() === "linux") {
      const result = execSync("lsof -i :9222 -sTCP:LISTEN -t 2>/dev/null", { stdio: "pipe" }).toString().trim()
      return result ? 9222 : null
    }
  } catch {
    return null
  }
  return null
}

function printUsage() {
  console.log(`
page-screenshot - Screenshot any URL using your Chrome profile

Usage:
  page-screenshot <url> [options]

Options:
  --output <path>   Save screenshot to a specific path (default: /tmp/page-screenshot-<ts>.png)
  --full-page       Capture the full scrollable page
  --width <px>      Viewport width (default: 1280)
  --height <px>     Viewport height (default: 800)
  --wait <ms>       Extra wait time after page load (default: 0)
  --help            Show this help message

Examples:
  page-screenshot https://app.test.com/some-page
  page-screenshot --full-page https://app.test.com/some-page
  page-screenshot --output ./shot.png https://example.com
  page-screenshot --width 1920 --height 1080 https://example.com

Notes:
  - Uses your existing Chrome profile for authentication (cookies, sessions)
  - If Chrome is running, it will try to connect via remote debugging port (9222)
  - If Chrome is not running, it launches headless Chrome with your profile
  - To enable remote debugging on a running Chrome, launch it with:
      open -a "Google Chrome" --args --remote-debugging-port=9222
`)
}

function parseArgs(args) {
  const opts = {
    url: null,
    output: null,
    fullPage: false,
    width: 1280,
    height: 800,
    wait: 0,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--output" && args[i + 1]) {
      opts.output = args[++i]
    } else if (arg === "--full-page") {
      opts.fullPage = true
    } else if (arg === "--width" && args[i + 1]) {
      opts.width = parseInt(args[++i], 10)
    } else if (arg === "--height" && args[i + 1]) {
      opts.height = parseInt(args[++i], 10)
    } else if (arg === "--wait" && args[i + 1]) {
      opts.wait = parseInt(args[++i], 10)
    } else if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else if (!arg.startsWith("--")) {
      opts.url = arg
    }
  }

  return opts
}

async function connectToRunningChrome() {
  const debugPort = findChromeDebugPort()
  if (!debugPort) return null

  try {
    process.stderr.write("Connecting to running Chrome on port 9222...\n")
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${debugPort}`,
    })
    return browser
  } catch {
    return null
  }
}

async function launchWithProfile(chromePath, profilePath) {
  process.stderr.write("Launching headless Chrome with your profile...\n")
  return await puppeteer.launch({
    executablePath: chromePath,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      `--user-data-dir=${profilePath}`,
      "--disable-extensions",
      "--disable-background-timer-throttling",
    ],
  })
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printUsage()
    process.exit(0)
  }

  const opts = parseArgs(args)

  if (!opts.url) {
    console.error("Error: Please provide a URL.")
    printUsage()
    process.exit(1)
  }

  // Validate URL
  try {
    new URL(opts.url)
  } catch {
    console.error(`Error: Invalid URL: ${opts.url}`)
    process.exit(1)
  }

  const chromePath = findChrome()
  if (!chromePath) {
    console.error("Error: Could not find Chrome or Chromium.")
    console.error(`Looked in: ${(CHROME_PATHS[platform()] || []).join(", ")}`)
    process.exit(1)
  }

  const outputPath = opts.output || join(tmpdir(), `page-screenshot-${Date.now()}.png`)

  let browser = null
  let connected = false

  async function cleanup() {
    if (browser) {
      try {
        if (connected) {
          await browser.disconnect()
        } else {
          await browser.close()
        }
      } catch {}
      browser = null
    }
  }

  process.on("SIGINT", async () => { await cleanup(); process.exit(130) })
  process.on("SIGTERM", async () => { await cleanup(); process.exit(143) })
  process.on("uncaughtException", async (err) => {
    console.error(`Error: ${err.message}`)
    await cleanup()
    process.exit(1)
  })

  try {
    // Strategy 1: Connect to running Chrome with remote debugging
    browser = await connectToRunningChrome()
    if (browser) {
      connected = true
    } else {
      // Strategy 2: Launch headless Chrome with user profile
      const chromeRunning = isChromeRunning()
      const profilePath = getChromeProfilePath()

      if (chromeRunning) {
        console.error("Warning: Chrome is running. Cannot use your profile directly (it's locked).")
        console.error("Tip: Restart Chrome with remote debugging enabled:")
        console.error('  open -a "Google Chrome" --args --remote-debugging-port=9222')
        console.error("")
        console.error("Falling back to a fresh session (no auth cookies)...")

        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        })
      } else if (profilePath && existsSync(profilePath)) {
        browser = await launchWithProfile(chromePath, profilePath)
      } else {
        console.error("Warning: Chrome profile not found. Launching without profile (no auth cookies).")
        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        })
      }
    }

    const page = await browser.newPage()
    await page.setViewport({ width: opts.width, height: opts.height })

    process.stderr.write(`Navigating to ${opts.url}...`)
    await page.goto(opts.url, { waitUntil: "networkidle2", timeout: 30000 })
    process.stderr.write(" done.\n")

    if (opts.wait > 0) {
      process.stderr.write(`Waiting ${opts.wait}ms...`)
      await new Promise((r) => setTimeout(r, opts.wait))
      process.stderr.write(" done.\n")
    }

    process.stderr.write("Taking screenshot...")
    await page.screenshot({
      path: outputPath,
      fullPage: opts.fullPage,
    })
    process.stderr.write(" done.\n")

    // Output the file path to stdout (for Claude to pick up)
    console.log(outputPath)
  } catch (err) {
    if (err.message.includes("timeout")) {
      console.error("Error: Timed out loading the page. Check the URL and your internet connection.")
    } else {
      console.error(`Error: ${err.message}`)
    }
    process.exit(1)
  } finally {
    await cleanup()
  }
}

main()
