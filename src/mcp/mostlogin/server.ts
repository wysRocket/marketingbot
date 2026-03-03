import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  ListFoldersSchema,
  AddFolderSchema,
  BatchDeleteFoldersSchema,
  BatchUpdateFoldersSchema,
  listFolders,
  addFolder,
  batchDeleteFolders,
  batchUpdateFolders,
} from "./tools/folders";

import {
  ListProfilesSchema,
  QuickCreateProfileSchema,
  AdvancedCreateProfileSchema,
  GetProfileDetailSchema,
  UpdateProfileFolderSchema,
  UpdateProfileBaseProxySchema,
  UpdateProfileApiExtractionProxySchema,
  UpdateProfileSelectProxySchema,
  MoveProfilesToRecycleSchema,
  listProfiles,
  quickCreateProfile,
  advancedCreateProfile,
  getProfileDetail,
  updateProfileFolder,
  updateProfileBaseProxy,
  updateProfileApiExtractionProxy,
  updateProfileSelectProxy,
  moveProfilesToRecycle,
} from "./tools/profiles";

import {
  ListProxiesSchema,
  ProxyDetectSchema,
  CreateBaseProxySchema,
  UpdateBaseProxySchema,
  AddApiExtractionProxySchema,
  UpdateApiExtractionProxySchema,
  DeleteProxiesSchema,
  listProxies,
  proxyDetect,
  createBaseProxy,
  updateBaseProxy,
  addApiExtractionProxy,
  updateApiExtractionProxy,
  deleteProxies,
} from "./tools/proxies";

import {
  OpenBrowserSchema,
  CloseProfilesSchema,
  openBrowser,
  closeProfiles,
  closeAllProfiles,
} from "./tools/browsers";

import { quitApp } from "./tools/app";

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

// ── Server ────────────────────────────────────────────────────────────

const server = new McpServer({ name: "mostlogin-mcp", version: "1.0.0" });

// ── Folder tools ──────────────────────────────────────────────────────

server.tool(
  "ml_list_folders",
  "List all MostLogin folders with pagination.",
  ListFoldersSchema,
  async ({ page, pageSize }) => {
    try {
      return ok(await listFolders(page, pageSize));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_add_folder",
  "Create a new MostLogin folder. folderName must be unique.",
  AddFolderSchema,
  async ({ folderName, folderColor, sortOrder }) => {
    try {
      return ok(await addFolder(folderName, folderColor, sortOrder));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_batch_delete_folders",
  "Delete one or more MostLogin folders by ID.",
  BatchDeleteFoldersSchema,
  async ({ ids }) => {
    try {
      return ok(await batchDeleteFolders(ids));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_batch_update_folders",
  "Update name, colour, and sort order for one or more MostLogin folders.",
  BatchUpdateFoldersSchema,
  async ({ folderInfos }) => {
    try {
      return ok(await batchUpdateFolders(folderInfos));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Profile tools ─────────────────────────────────────────────────────

server.tool(
  "ml_list_profiles",
  "List MostLogin antidetect profiles with pagination.",
  ListProfilesSchema,
  async ({ page, pageSize }) => {
    try {
      return ok(await listProfiles(page, pageSize));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_quick_create_profile",
  "Quickly create a MostLogin profile with minimal options (OS, Chrome version, folder).",
  QuickCreateProfileSchema,
  async (p) => {
    try {
      return ok(await quickCreateProfile(p));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_advanced_create_profile",
  "Create a MostLogin profile with full fingerprint, proxy, and preference control.",
  AdvancedCreateProfileSchema,
  async (p) => {
    try {
      return ok(await advancedCreateProfile(p as Record<string, unknown>));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_get_profile_detail",
  "Retrieve full detail for a single MostLogin profile including fingerprint, proxy, and preferences.",
  GetProfileDetailSchema,
  async ({ profileId }) => {
    try {
      return ok(await getProfileDetail(profileId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_update_profile_folder",
  "Move one or more MostLogin profiles to a different folder.",
  UpdateProfileFolderSchema,
  async ({ ids, folderId }) => {
    try {
      return ok(await updateProfileFolder(ids, folderId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_update_profile_base_proxy",
  "Assign a static (base) proxy to one or more MostLogin profiles.",
  UpdateProfileBaseProxySchema,
  async (p) => {
    try {
      return ok(await updateProfileBaseProxy(p));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_update_profile_api_extraction_proxy",
  "Assign an API-extraction proxy to one or more MostLogin profiles.",
  UpdateProfileApiExtractionProxySchema,
  async (p) => {
    try {
      return ok(await updateProfileApiExtractionProxy(p));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_update_profile_select_proxy",
  "Assign an existing saved proxy to one or more MostLogin profiles by proxy ID.",
  UpdateProfileSelectProxySchema,
  async ({ ids, proxyId }) => {
    try {
      return ok(await updateProfileSelectProxy(ids, proxyId));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_move_profiles_to_recycle",
  "Move one or more MostLogin profiles to the recycle bin.",
  MoveProfilesToRecycleSchema,
  async ({ ids }) => {
    try {
      return ok(await moveProfilesToRecycle(ids));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Browser / Window tools ────────────────────────────────────────────

server.tool(
  "ml_open_browser",
  "Launch a MostLogin profile browser window. Optionally override startup URLs.",
  OpenBrowserSchema,
  async (p) => {
    try {
      return ok(await openBrowser(p));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_close_profiles",
  "Close one or more running MostLogin browser windows by profile ID.",
  CloseProfilesSchema,
  async ({ profileIds }) => {
    try {
      return ok(await closeProfiles(profileIds));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_close_all_profiles",
  "Close ALL currently open MostLogin browser windows.",
  {},
  async () => {
    try {
      return ok(await closeAllProfiles());
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Proxy tools ───────────────────────────────────────────────────────

server.tool(
  "ml_list_proxies",
  "List saved proxies in MostLogin with pagination.",
  ListProxiesSchema,
  async ({ page, pageSize }) => {
    try {
      return ok(await listProxies(page, pageSize));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_proxy_detect",
  "Test connectivity for a proxy and return IP/location info.",
  ProxyDetectSchema,
  async (p) => {
    try {
      return ok(await proxyDetect(p));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_create_base_proxy",
  "Add a new static (base) proxy to the MostLogin proxy library.",
  CreateBaseProxySchema,
  async (p) => {
    try {
      return ok(await createBaseProxy(p as Record<string, unknown>));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_update_base_proxy",
  "Update an existing static (base) proxy in the MostLogin proxy library.",
  UpdateBaseProxySchema,
  async (p) => {
    try {
      return ok(await updateBaseProxy(p as Record<string, unknown>));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_add_api_extraction_proxy",
  "Add a new API-extraction proxy to the MostLogin proxy library.",
  AddApiExtractionProxySchema,
  async (p) => {
    try {
      return ok(await addApiExtractionProxy(p as Record<string, unknown>));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_update_api_extraction_proxy",
  "Update an existing API-extraction proxy in the MostLogin proxy library.",
  UpdateApiExtractionProxySchema,
  async (p) => {
    try {
      return ok(await updateApiExtractionProxy(p as Record<string, unknown>));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ml_delete_proxies",
  "Delete one or more proxies from the MostLogin proxy library.",
  DeleteProxiesSchema,
  async ({ ids }) => {
    try {
      return ok(await deleteProxies(ids));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── App tools ─────────────────────────────────────────────────────────

server.tool(
  "ml_quit_app",
  "Gracefully quit the MostLogin desktop application.",
  {},
  async () => {
    try {
      return ok(await quitApp());
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Start ─────────────────────────────────────────────────────────────

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MostLogin MCP server running on stdio");
})();
