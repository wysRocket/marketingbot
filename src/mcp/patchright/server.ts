/**
 * Patchright MCP Server
 *
 * Mirrors MostLogin MCP structure and tool signatures.
 * Custom implementation using patchright library instead of MostLogin desktop.
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium, Browser, BrowserContext, Page } from 'patchright';
import { profiles, getProfile, listProfileIds } from '../../profiles/patchright-profiles';

// ── Helpers ───────────────────────────────────────────────────────────

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: `Error: ${msg}` }],
    isError: true,
  };
}

// ── Global state ──────────────────────────────────────────────────────

let browser: Browser | null = null;
const contexts = new Map<string, { context: BrowserContext; page: Page }>();

async function ensureBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

async function getOrCreateContext(profileId: string): Promise<{ context: BrowserContext; page: Page }> {
  const existing = contexts.get(profileId);
  if (existing) return existing;

  const profile = getProfile(profileId);
  if (!profile) throw new Error(`Profile not found: ${profileId}`);

  const b = await ensureBrowser();
  const context = await b.newContext(profile.config);
  const page = await context.newPage();

  contexts.set(profileId, { context, page });
  return contexts.get(profileId)!;
}

// ── Schemas ───────────────────────────────────────────────────────────

// Note: schemas are plain objects (ZodRawShape), NOT wrapped in z.object()

const ListProfilesSchema = {
  // No parameters
};

const GetProfileDetailSchema = {
  profile_id: z.string().describe("Profile ID")
};

const OpenBrowserSchema = {
  profile_id: z.string().describe("Profile ID")
};

const CloseBrowserSchema = {
  profile_id: z.string().describe("Profile ID")
};

const NavigateSchema = {
  profile_id: z.string().describe("Profile ID"),
  url: z.string().describe("URL to navigate to")
};

const ClickSchema = {
  profile_id: z.string().describe("Profile ID"),
  element: z.string().optional().describe("Human-readable element description"),
  ref: z.string().optional().describe("Exact target element reference")
};

const FillSchema = {
  profile_id: z.string().describe("Profile ID"),
  name: z.string().optional().describe("Field name"),
  ref: z.string().optional().describe("Element reference"),
  value: z.string().describe("Value to fill"),
  type: z.string().optional().default('textbox').describe("Field type")
};

const EvaluateSchema = {
  profile_id: z.string().describe("Profile ID"),
  script: z.string().describe("JavaScript code to execute")
};

const ScreenshotSchema = {
  profile_id: z.string().describe("Profile ID"),
  fullPage: z.boolean().optional().default(false).describe("Capture full page"),
  filename: z.string().optional().describe("Save to file")
};

const WaitForLoadStateSchema = {
  profile_id: z.string().describe("Profile ID"),
  state: z.enum(['load', 'domcontentloaded', 'networkidle']).default('load').describe("Load state to wait for")
};

const WaitForSelectorSchema = {
  profile_id: z.string().describe("Profile ID"),
  selector: z.string().describe("CSS selector"),
  timeout: z.number().optional().default(30000).describe("Timeout in ms")
};

const FileUploadSchema = {
  profile_id: z.string().describe("Profile ID"),
  ref: z.string().describe("File input element reference"),
  paths: z.array(z.string()).describe("File paths to upload")
};

const PressKeySchema = {
  profile_id: z.string().describe("Profile ID"),
  key: z.string().describe("Key to press")
};

const HoverSchema = {
  profile_id: z.string().describe("Profile ID"),
  element: z.string().optional().describe("Element description"),
  ref: z.string().optional().describe("Element reference")
};

const SelectOptionSchema = {
  profile_id: z.string().describe("Profile ID"),
  ref: z.string().describe("Dropdown element reference"),
  values: z.array(z.string()).describe("Option values to select")
};

const TabsSchema = {
  profile_id: z.string().describe("Profile ID"),
  action: z.enum(['list', 'new', 'close', 'select']).describe("Tab action"),
  index: z.number().optional().describe("Tab index (for select/close)")
};

const GetFingerprintSchema = {
  profile_id: z.string().describe("Profile ID")
};

// ── Server ────────────────────────────────────────────────────────────

const server = new McpServer({ name: "patchright-mcp", version: "1.0.0" });

// ── Profile tools ────────────────────────────────────────────────────

server.tool(
  "patchright_list_profiles",
  "List all available fingerprint profiles",
  ListProfilesSchema,
  async () => {
    try {
      return ok({ profiles: listProfileIds().map(id => ({
        id,
        name: getProfile(id)?.name || id
      })) });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_get_profile_detail",
  "Get details of a specific profile",
  GetProfileDetailSchema,
  async ({ profile_id }) => {
    try {
      const profile = getProfile(profile_id);
      if (!profile) throw new Error(`Profile not found: ${profile_id}`);
      return ok({ profile });
    } catch (e) {
      return fail(e);
    }
  }
);

// ── Browser tools ─────────────────────────────────────────────────────

server.tool(
  "patchright_open_browser",
  "Open a browser with the specified profile",
  OpenBrowserSchema,
  async ({ profile_id }) => {
    try {
      await getOrCreateContext(profile_id);
      return ok({
        status: 'opened',
        profileId: profile_id,
        message: `Browser opened for profile ${profile_id}`
      });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_close_browser",
  "Close a browser instance",
  CloseBrowserSchema,
  async ({ profile_id }) => {
    try {
      const ctx = contexts.get(profile_id);
      if (ctx) {
        await ctx.context.close();
        contexts.delete(profile_id);
      }
      return ok({ closed: true, profileId: profile_id });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_navigate",
  "Navigate to a URL",
  NavigateSchema,
  async ({ profile_id, url }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return ok({ url, status: 'loaded' });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_click",
  "Click an element",
  ClickSchema,
  async ({ profile_id, element, ref }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      const selector = ref || element;
      if (!selector) throw new Error('Either element or ref must be provided');
      await page.click(selector);
      return ok({ clicked: true });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_fill",
  "Fill a form field",
  FillSchema,
  async ({ profile_id, name, ref, value }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      if (ref) {
        await page.fill(ref, value);
      } else if (name) {
        const selectors = [
          `input[name="${name}"]`,
          `input[id="${name}"]`,
          `input[placeholder*="${name}"]`,
          `textarea[name="${name}"]`
        ];
        for (const selector of selectors) {
          try {
            await page.fill(selector, value);
            break;
          } catch {
            continue;
          }
        }
      } else {
        throw new Error('Either name or ref must be provided');
      }
      return ok({ filled: true });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_evaluate",
  "Execute JavaScript in page context",
  EvaluateSchema,
  async ({ profile_id, script }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      const result = await page.evaluate(script);
      return ok(result);
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_screenshot",
  "Capture screenshot",
  ScreenshotSchema,
  async ({ profile_id, fullPage, filename }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      const screenshot = await page.screenshot({ fullPage, type: 'png' });
      if (filename) {
        const fs = await import('fs');
        fs.writeFileSync(filename, screenshot);
        return ok({ saved: true, filename });
      }
      return ok({ data: screenshot.toString('base64') });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_wait_for_load_state",
  "Wait for page load state",
  WaitForLoadStateSchema,
  async ({ profile_id, state }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      await page.waitForLoadState(state);
      return ok({ state, status: 'reached' });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_wait_for_selector",
  "Wait for an element to appear",
  WaitForSelectorSchema,
  async ({ profile_id, selector, timeout }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      await page.waitForSelector(selector, { timeout });
      return ok({ selector, status: 'found' });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_file_upload",
  "Upload files to input",
  FileUploadSchema,
  async ({ profile_id, ref, paths }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      const fileInput = await page.$(ref);
      if (!fileInput) throw new Error(`Element not found: ${ref}`);
      await fileInput.setInputFiles(paths);
      return ok({ uploaded: true, files: paths });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_press_key",
  "Press a keyboard key",
  PressKeySchema,
  async ({ profile_id, key }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      await page.keyboard.press(key);
      return ok({ pressed: true, key });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_hover",
  "Hover over element",
  HoverSchema,
  async ({ profile_id, element, ref }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      const selector = ref || element;
      if (!selector) throw new Error('element or ref required');
      await page.hover(selector);
      return ok({ hovered: true });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_select_option",
  "Select dropdown option",
  SelectOptionSchema,
  async ({ profile_id, ref, values }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      await page.selectOption(ref, values);
      return ok({ selected: true, values });
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_tabs",
  "Manage browser tabs",
  TabsSchema,
  async ({ profile_id, action, index }) => {
    try {
      const { page, context } = await getOrCreateContext(profile_id);
      if (action === 'list') {
        const pages = context.pages();
        const tabs = await Promise.all(pages.map(async (p, i) => ({
          index: i,
          url: p.url(),
          title: await p.title()
        })));
        return ok({ tabs });
      } else if (action === 'new') {
        const newPage = await context.newPage();
        return ok({ created: true, tab: newPage.url() });
      } else if (action === 'close') {
        await page.close();
        contexts.delete(profile_id);
        return ok({ closed: true });
      } else if (action === 'select') {
        const pages = context.pages();
        const target = pages[index || 0];
        if (target) {
          await target.bringToFront();
          return ok({ selected: true, index });
        }
        throw new Error('No such tab');
      }
      throw new Error(`Invalid action: ${action}`);
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  "patchright_get_fingerprint",
  "Get current browser fingerprint",
  GetFingerprintSchema,
  async ({ profile_id }) => {
    try {
      const { page } = await getOrCreateContext(profile_id);
      const fp = await page.evaluate(() => {
        const win = window as any;
        return {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          languages: navigator.languages,
          plugins: navigator.plugins.length,
          webdriver: navigator.webdriver,
          chrome: !!(win.chrome && win.chrome.runtime),
          screen: {
            width: window.screen.width,
            height: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight
          },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          hardwareConcurrency: navigator.hardwareConcurrency
        };
      });
      return ok(fp);
    } catch (e) {
      return fail(e);
    }
  }
);

// ── Startup ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[PATCHRIGHT] MCP server started');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.error('[PATCHRIGHT] Shutting down...');
    for (const [id, ctx] of contexts) {
      await ctx.context.close();
    }
    if (browser) await browser.close();
    process.exit(0);
  });
}

main().catch(console.error);
