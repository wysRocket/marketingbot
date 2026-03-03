import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  CreateProfileSchema,
  ProfileIdSchema,
  ListProfilesSchema,
  DeleteProfilesSchema,
  ListProfilesCursorSchema,
  createProfile,
  deleteProfile,
  listProfiles,
  deleteProfiles,
  listProfilesCursor,
} from "./tools/profiles";

import {
  StartBrowserSchema,
  StopBrowserSchema,
  ConnectBrowserSchema,
  StartBrowsersSchema,
  StopBrowsersSchema,
  StartOnceBrowserSchema,
  GetBrowserPagesSchema,
  GetBrowserDebuggerSchema,
  ConnectOnceBrowserSchema,
  startBrowser,
  stopBrowser,
  getBrowsers,
  connectBrowser,
  startBrowsers,
  stopBrowsers,
  startOnceBrowser,
  getBrowserPages,
  getBrowserDebugger,
  connectOnceBrowser,
} from "./tools/browsers";

import {
  UpdateProfileProxySchema,
  BatchUpdateProxySchema,
  ResetProfileProxySchema,
  UpdateContextProxySchema,
  BatchResetProxySchema,
  updateProfileProxy,
  batchUpdateProxy,
  resetProfileProxy,
  updateContextProxy,
  batchResetProxy,
} from "./tools/proxy";

import {
  GetProfileGroupsSchema,
  ChangeProfileGroupSchema,
  BatchChangeProfileGroupSchema,
  getProfileGroups,
  changeProfileGroup,
  batchChangeProfileGroup,
} from "./tools/groups";

import {
  GetProfileTagsSchema,
  CreateProfileTagsSchema,
  BatchCreateProfileTagsSchema,
  UpdateProfileTagsSchema,
  BatchUpdateProfileTagsSchema,
  ClearProfileTagsSchema,
  BatchClearProfileTagsSchema,
  getProfileTags,
  createProfileTags,
  batchCreateProfileTags,
  updateProfileTags,
  batchUpdateProfileTags,
  clearProfileTags,
  batchClearProfileTags,
} from "./tools/tags";

import {
  ClearProfileCacheSchema,
  ClearProfileCookiesSchema,
  clearProfileCache,
  clearProfileCookies,
} from "./tools/locals";

import { RunRpaFlowSchema, runRpaFlow } from "./tools/rpa";
import type { RpaAction } from "./types";

import {
  RunBrowseHomepageSchema,
  RunBrowseFooterLinksSchema,
  RunLoginSchema,
  RunExplorePricingSchema,
  RunAccountDashboardSchema,
  runBrowseHomepage,
  runBrowseFooterLinks,
  runLogin,
  runExplorePricing,
  runAccountDashboard,
} from "./tools/flows";

// ── Helper ───────────────────────────────────────────────────────────

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

// ── Server ───────────────────────────────────────────────────────────

const server = new McpServer({ name: "nstbrowser-mcp", version: "1.0.0" });

// ── Profile tools ────────────────────────────────────────────────────

server.tool(
  "create_profile",
  "Create an Nstbrowser antidetect profile with a randomised fingerprint. " +
    "Optionally set platform, Chrome version, proxy, group, and fingerprint noise flags.",
  CreateProfileSchema,
  async (p) => {
    try {
      return ok(await createProfile(p));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "delete_profile",
  "Permanently delete a profile by ID.",
  ProfileIdSchema,
  async ({ profileId }) => {
    try {
      return ok(await deleteProfile(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "delete_profiles",
  "Batch-delete multiple profiles by ID.",
  DeleteProfilesSchema,
  async ({ profileIds }) => {
    try {
      return ok(await deleteProfiles(profileIds));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "list_profiles",
  "List profiles with offset-based pagination.",
  ListProfilesSchema,
  async ({ page, perPage }) => {
    try {
      return ok(await listProfiles(page, perPage));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "list_profiles_cursor",
  "List profiles with cursor-based pagination (more efficient; requires Nstbrowser ≥ 1.17.3).",
  ListProfilesCursorSchema,
  async ({ cursor, pageSize }) => {
    try {
      return ok(await listProfilesCursor(cursor, pageSize));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Browser tools ────────────────────────────────────────────────────

server.tool(
  "start_browser",
  "Launch a browser for a single profile. Returns wsEndpoint.",
  StartBrowserSchema,
  async ({ profileId }) => {
    try {
      return ok(await startBrowser(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "start_browsers",
  "Launch browsers for multiple profiles in one call.",
  StartBrowsersSchema,
  async ({ profileIds }) => {
    try {
      return ok(await startBrowsers(profileIds));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "start_once_browser",
  "Launch a one-time ephemeral browser (no saved profile). Good for anonymous sessions.",
  StartOnceBrowserSchema,
  async (p) => {
    try {
      return ok(await startOnceBrowser(p));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "stop_browser",
  "Stop a running browser by profile ID.",
  StopBrowserSchema,
  async ({ profileId }) => {
    try {
      return ok(await stopBrowser(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "stop_browsers",
  "Stop multiple running browsers. Pass an empty array to stop ALL running browsers.",
  StopBrowsersSchema,
  async ({ profileIds }) => {
    try {
      return ok(await stopBrowsers(profileIds));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "get_browsers",
  "List all currently running browser sessions.",
  {},
  async () => {
    try {
      return ok(await getBrowsers());
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "get_browser_pages",
  "List open pages/tabs for a running browser.",
  GetBrowserPagesSchema,
  async ({ profileId }) => {
    try {
      return ok(await getBrowserPages(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "get_browser_debugger",
  "Get the remote debugging address for a running browser.",
  GetBrowserDebuggerSchema,
  async ({ profileId }) => {
    try {
      return ok(await getBrowserDebugger(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "connect_browser",
  "Launch a saved profile and return the CDP wsEndpoint for Playwright/Puppeteer automation.",
  ConnectBrowserSchema,
  async (p) => {
    try {
      return ok(await connectBrowser(p));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "connect_once_browser",
  "Launch an ephemeral browser via CDP and return the wsEndpoint. No profile is saved.",
  ConnectOnceBrowserSchema,
  async (p) => {
    try {
      return ok(await connectOnceBrowser(p));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Proxy tools ──────────────────────────────────────────────────────

server.tool(
  "update_profile_proxy",
  "Update the saved proxy for a single profile.",
  UpdateProfileProxySchema,
  async ({ profileId, proxy }) => {
    try {
      return ok(await updateProfileProxy(profileId, proxy));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "batch_update_proxy",
  "Update the proxy on multiple profiles at once.",
  BatchUpdateProxySchema,
  async ({ profileIds, proxy }) => {
    try {
      return ok(await batchUpdateProxy(profileIds, proxy));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "reset_profile_proxy",
  "Reset a single profile proxy to direct (no proxy).",
  ResetProfileProxySchema,
  async ({ profileId }) => {
    try {
      return ok(await resetProfileProxy(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "batch_reset_proxy",
  "Reset the proxy on multiple profiles to direct (no proxy).",
  BatchResetProxySchema,
  async ({ profileIds }) => {
    try {
      return ok(await batchResetProxy(profileIds));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "update_context_proxy",
  "Hot-swap the proxy on a LIVE running browser using CDP Network.updateContextProxy — " +
    "no restart needed. Pass the wsEndpoint from connect_browser.",
  UpdateContextProxySchema,
  async ({ wsEndpoint, proxyServer, proxyBypassList }) => {
    try {
      return ok(
        await updateContextProxy(wsEndpoint, proxyServer, proxyBypassList),
      );
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Group tools ──────────────────────────────────────────────────────

server.tool(
  "get_profile_groups",
  "List all profile groups.",
  GetProfileGroupsSchema,
  async () => {
    try {
      return ok(await getProfileGroups());
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "change_profile_group",
  "Move a single profile to a different group.",
  ChangeProfileGroupSchema,
  async ({ profileId, groupId }) => {
    try {
      return ok(await changeProfileGroup(profileId, groupId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "batch_change_profile_group",
  "Move multiple profiles to a different group.",
  BatchChangeProfileGroupSchema,
  async ({ profileIds, groupId }) => {
    try {
      return ok(await batchChangeProfileGroup(profileIds, groupId));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Tag tools ─────────────────────────────────────────────────────────

server.tool(
  "get_profile_tags",
  "List all tags across all profiles.",
  GetProfileTagsSchema,
  async () => {
    try {
      return ok(await getProfileTags());
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "create_profile_tags",
  "Add tags to a single profile.",
  CreateProfileTagsSchema,
  async ({ profileId, tags }) => {
    try {
      return ok(await createProfileTags(profileId, tags));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "batch_create_profile_tags",
  "Add tags to multiple profiles at once.",
  BatchCreateProfileTagsSchema,
  async ({ profileIds, tags }) => {
    try {
      return ok(await batchCreateProfileTags(profileIds, tags));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "update_profile_tags",
  "Replace all tags on a single profile.",
  UpdateProfileTagsSchema,
  async ({ profileId, tags }) => {
    try {
      return ok(await updateProfileTags(profileId, tags));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "batch_update_profile_tags",
  "Replace tags on multiple profiles.",
  BatchUpdateProfileTagsSchema,
  async ({ profileIds, tags }) => {
    try {
      return ok(await batchUpdateProfileTags(profileIds, tags));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "clear_profile_tags",
  "Remove all tags from a single profile.",
  ClearProfileTagsSchema,
  async ({ profileId }) => {
    try {
      return ok(await clearProfileTags(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "batch_clear_profile_tags",
  "Remove all tags from multiple profiles.",
  BatchClearProfileTagsSchema,
  async ({ profileIds }) => {
    try {
      return ok(await batchClearProfileTags(profileIds));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Local data tools ─────────────────────────────────────────────────

server.tool(
  "clear_profile_cache",
  "Clear the local browser cache for a profile.",
  ClearProfileCacheSchema,
  async ({ profileId }) => {
    try {
      return ok(await clearProfileCache(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "clear_profile_cookies",
  "Clear the local cookies for a profile.",
  ClearProfileCookiesSchema,
  async ({ profileId }) => {
    try {
      return ok(await clearProfileCookies(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── RPA tool ─────────────────────────────────────────────────────────

server.tool(
  "run_rpa_flow",
  "Execute an ordered list of browser automation steps on a running Nstbrowser session.\n\n" +
    "Steps: navigate | click | fill | wait | scroll | scrape | evaluate\n\n" +
    'Scraped/evaluated values are returned keyed by their "as" field.',
  RunRpaFlowSchema,
  async ({ wsEndpoint, steps }) => {
    try {
      return ok(await runRpaFlow(wsEndpoint, steps as RpaAction[]));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Flow tools ───────────────────────────────────────────────────────

server.tool(
  "run_browse_homepage",
  "Open eurocookflow.com in a browser, scroll through Hero -> Journeys -> Academy -> CookFlows -> Members -> Footer, " +
    "and return the hero heading, nav links, feature names, pricing tiers, and footer links. " +
    "Pass a profileId to use a saved Nstbrowser profile; omit for a plain Playwright session.",
  RunBrowseHomepageSchema,
  async ({ profileId }) => {
    try {
      return ok(await runBrowseHomepage(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "run_browse_footer_links",
  "Navigate to eurocookflow.com, then click each footer link (/legal/privacy, /legal/terms, /legal/vat) in sequence. " +
    "On each page the bot scrolls to simulate reading. " +
    "Returns the URL and <h1> heading collected from each visited page. " +
    "Pass a profileId to use a saved Nstbrowser profile; omit for a plain Playwright session.",
  RunBrowseFooterLinksSchema,
  async ({ profileId }) => {
    try {
      return ok(await runBrowseFooterLinks(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "run_login",
  "Navigate to /auth/sign-in on eurocookflow.com, fill the sign-in form, and validate the outcome. " +
    "Returns { success, finalUrl, errorMessage? }.",
  RunLoginSchema,
  async ({ username, password, profileId }) => {
    try {
      return ok(await runLogin(username, password, profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "run_explore_pricing",
  "Navigate to the #members section on eurocookflow.com, read all tier names and CTA links, " +
    "hover over each CTA, click the first one, and validate the redirect to /auth/sign-up. " +
    "Returns { tiers, ctaLinksValid }.",
  RunExplorePricingSchema,
  async ({ profileId }) => {
    try {
      return ok(await runExplorePricing(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "run_account_dashboard",
  "Login to eurocookflow.com with the provided credentials and then read the /app/courses dashboard context. " +
    "Returns { login: LoginResult, account: { creditBalance, orders, hasPaymentMethods } }.",
  RunAccountDashboardSchema,
  async ({ username, password, profileId }) => {
    try {
      return ok(await runAccountDashboard(username, password, profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Start ────────────────────────────────────────────────────────────

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Nstbrowser MCP server running on stdio");
})();
