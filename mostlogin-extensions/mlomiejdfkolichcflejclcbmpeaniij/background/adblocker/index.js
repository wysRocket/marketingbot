import store_default from "../../npm/hybrids/src/store.js";
import { isWebkit } from "../../utils/browser-info.js";
import Options, { ENGINES, getPausedDetails } from "../../store/options.js";
import { addListener } from "../../utils/options-observer.js";
import { FLAG_CHROMIUM_INJECT_COSMETICS_ON_RESPONSE_STARTED, FLAG_INJECTION_TARGET_DOCUMENT_ID, FLAG_SUBFRAME_SCRIPTING } from "../../npm/@ghostery/config/dist/esm/flags.js";
import { resolveFlag } from "../../store/config.js";
import { CUSTOM_ENGINE, ELEMENT_PICKER_ENGINE, FIXES_ENGINE, MAIN_ENGINE, create, get, init, isPersistentEngine, replace, update } from "../../utils/engines.js";
import asyncSetup from "../../utils/setup.js";
import { parseWithCache } from "../../utils/request.js";
import { setup as setup$1 } from "../../utils/trackerdb.js";
import "../../npm/@ghostery/adblocker-webextension/dist/esm/index.js";
import scriptlets from "../../npm/@ghostery/scriptlets/index.js";
import { updateDNRRulesForExceptions } from "../exceptions.js";
import { tabStats } from "../stats.js";
import "../redirect-protection.js";
import { FramesHierarchy } from "./ancestors.js";
//#region src/background/adblocker/index.js
/**
* Ghostery Browser Extension
* https://www.ghostery.com/
*
* Copyright 2017-present Ghostery GmbH. All rights reserved.
*
* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0
*/
var options = Options;
(() => {
	const map = /* @__PURE__ */ new Map();
	return {
		async register(hostname, code) {
			this.unregister(hostname);
			try {
				const contentScript = await browser.contentScripts.register({
					js: [{ code }],
					allFrames: true,
					matches: [`https://*.${hostname}/*`, `http://*.${hostname}/*`],
					matchAboutBlank: true,
					matchOriginAsFallback: true,
					runAt: "document_start",
					world: "MAIN"
				});
				map.set(hostname, contentScript);
			} catch (e) {
				console.warn(e);
				this.unregister(hostname);
			}
		},
		isRegistered(hostname) {
			return map.has(hostname);
		},
		unregister(hostname) {
			const contentScript = map.get(hostname);
			if (contentScript) {
				contentScript.unregister();
				map.delete(hostname);
			}
		},
		unregisterAll() {
			for (const hostname of map.keys()) this.unregister(hostname);
		}
	};
})();
function getEnabledEngines(config) {
	if (config.terms) {
		const list = ENGINES.filter(({ key }) => config[key]).map(({ name }) => name);
		if (config.regionalFilters.enabled) list.push(...config.regionalFilters.regions.map((id) => `lang-${id}`));
		if (config.fixesFilters && list.length) list.push(FIXES_ENGINE);
		list.push(ELEMENT_PICKER_ENGINE);
		if (config.customFilters.enabled) list.push(CUSTOM_ENGINE);
		return list;
	}
	return [];
}
function pause(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
async function reloadMainEngine() {
	if (isWebkit()) await pause(1e3);
	const enabledEngines = getEnabledEngines(options);
	const resolvedEngines = (await Promise.all(enabledEngines.map((id) => init(id).catch(() => {
		console.error(`[adblocker] failed to load engine: ${id}`);
		return null;
	}).then((engine) => {
		if (!engine) enabledEngines.splice(enabledEngines.indexOf(id), 1);
		return engine;
	})))).filter((engine) => engine);
	if (resolvedEngines.length) {
		replace(MAIN_ENGINE, resolvedEngines);
		console.info(`[adblocker] Main engine reloaded with: ${enabledEngines.join(", ")}`);
	} else {
		await create(MAIN_ENGINE);
		console.info("[adblocker] Main engine reloaded with no filters");
	}
}
var updating = false;
async function updateEngines({ cache = true } = {}) {
	if (updating) return;
	try {
		updating = true;
		const enabledEngines = getEnabledEngines(options);
		if (enabledEngines.length) {
			let updated = false;
			await Promise.all(enabledEngines.filter(isPersistentEngine).map(async (id) => {
				await init(id);
				updated = await update(id, { cache }) || updated;
			}));
			setup$1.pending && await setup$1.pending;
			if (await update("trackerdb", { cache })) await updateDNRRulesForExceptions();
			await store_default.set(Options, { filtersUpdatedAt: Date.now() });
			if (updated) await reloadMainEngine();
		}
	} finally {
		updating = false;
	}
}
var UPDATE_ENGINES_DELAY = 3600 * 1e3;
var setup = asyncSetup("adblocker", [addListener(async function adblockerEngines(value, lastValue) {
	options = value;
	const enabledEngines = getEnabledEngines(value);
	const lastEnabledEngines = lastValue && getEnabledEngines(lastValue);
	const enginesChanged = lastEnabledEngines && (enabledEngines.length !== lastEnabledEngines.length || enabledEngines.some((id, i) => id !== lastEnabledEngines[i]));
	if (!await init("main") || enginesChanged) await reloadMainEngine();
	if (enginesChanged || options.filtersUpdatedAt < Date.now() - 36e5) await updateEngines();
})]);
var INJECTION_TARGET_DOCUMENT_ID = resolveFlag(FLAG_INJECTION_TARGET_DOCUMENT_ID);
function resolveInjectionTarget(details) {
	const target = { tabId: details.tabId };
	if (INJECTION_TARGET_DOCUMENT_ID.enabled && details.documentId) target.documentIds = [details.documentId];
	else target.frameIds = [details.frameId];
	return target;
}
var scriptletGlobals = { warOrigin: chrome.runtime.getURL("/rule_resources/redirects/empty").slice(0, -6) };
function injectScriptlets(filters, hostname, details) {
	for (const filter of filters) {
		const parsed = filter.parseScript();
		if (!parsed) {
			console.warn("[adblocker] could not inject script filter:", filter.toString());
			continue;
		}
		const scriptletName = `${parsed.name}${parsed.name.endsWith(".js") ? "" : ".js"}`;
		const scriptlet = scriptlets[scriptletName];
		if (!scriptlet) {
			console.warn("[adblocker] unknown scriptlet with name:", scriptletName);
			continue;
		}
		const func = scriptlet.func;
		const args = [scriptletGlobals, ...parsed.args.map((arg) => decodeURIComponent(arg))];
		chrome.scripting.executeScript({
			injectImmediately: true,
			world: chrome.scripting.ExecutionWorld?.MAIN ?? "MAIN",
			target: resolveInjectionTarget(details),
			func,
			args
		}, () => {
			if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
		});
	}
}
function injectStyles(styles, details) {
	chrome.scripting.insertCSS({
		css: styles,
		origin: "USER",
		target: resolveInjectionTarget(details)
	}).catch((e) => console.warn("[adblocker] failed to inject CSS", e));
}
var SUBFRAME_SCRIPTING = resolveFlag(FLAG_SUBFRAME_SCRIPTING);
var framesHierarchy = new FramesHierarchy();
framesHierarchy.handleWebWorkerStart();
framesHierarchy.handleWebextensionEvents();
async function injectCosmetics(details, config) {
	const { bootstrap: isBootstrap = false, scriptletsOnly } = config;
	try {
		setup.pending && await setup.pending;
	} catch (e) {
		console.error("[adblocker] not ready for cosmetic injection", e);
		return;
	}
	const { tabId, frameId, parentFrameId, documentId, url } = details;
	const parsed = parseWithCache(url);
	const domain = parsed.domain || "";
	const hostname = parsed.hostname || "";
	if (getPausedDetails(options, hostname)) return false;
	const tabHostname = tabStats.get(tabId)?.hostname;
	if (tabHostname && getPausedDetails(options, tabHostname)) return false;
	const engine = get(MAIN_ENGINE);
	let ancestors = void 0;
	if (SUBFRAME_SCRIPTING.enabled && typeof parentFrameId === "number") ancestors = framesHierarchy.ancestors({
		tabId,
		frameId,
		parentFrameId,
		documentId
	}, {
		domain,
		hostname
	});
	{
		const { matches } = engine.matchCosmeticFilters({
			domain,
			hostname,
			url,
			ancestors,
			classes: config.classes,
			hrefs: config.hrefs,
			ids: config.ids,
			getInjectionRules: isBootstrap,
			getExtendedRules: isBootstrap,
			getRulesFromHostname: isBootstrap,
			getPureHasRules: true,
			getRulesFromDOM: !isBootstrap,
			callerContext: { tabId }
		});
		const styleFilters = [];
		const scriptFilters = [];
		for (const { filter, exception } of matches) if (exception === void 0) if (filter.isScriptInject()) scriptFilters.push(filter);
		else styleFilters.push(filter);
		if (isBootstrap) injectScriptlets(scriptFilters, hostname, details);
		if (scriptletsOnly) return;
		const { styles, extended } = engine.injectCosmeticFilters(styleFilters, {
			url,
			injectScriptlets: isBootstrap,
			injectExtended: isBootstrap,
			injectPureHasSafely: true,
			allowGenericHides: false,
			getBaseRules: false
		});
		if (styles) injectStyles(styles, details);
		if (extended && extended.length > 0) chrome.tabs.sendMessage(tabId, {
			action: "evaluateExtendedSelectors",
			extended
		}, { frameId });
	}
	if (isBootstrap) {
		const { styles } = engine.getCosmeticsFilters({
			domain,
			hostname,
			url,
			getBaseRules: true,
			getInjectionRules: false,
			getExtendedRules: false,
			getRulesFromDOM: false,
			getRulesFromHostname: false
		});
		injectStyles(styles, details);
	}
}
chrome.webNavigation.onCommitted.addListener((details) => injectCosmetics(details, { bootstrap: true }), { url: [{ urlPrefix: "http://" }, { urlPrefix: "https://" }] });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg.action === "injectCosmetics" && sender.tab) {
		injectCosmetics({
			url: !sender.url.startsWith("http") ? sender.origin : sender.url,
			tabId: sender.tab.id,
			frameId: sender.frameId,
			documentId: sender.documentId
		}, msg).then(sendResponse);
		return true;
	}
});
{
	let INJECT_COSMETICS_ON_RESPONSE_STARTED = resolveFlag(FLAG_CHROMIUM_INJECT_COSMETICS_ON_RESPONSE_STARTED);
	chrome.webRequest?.onResponseStarted.addListener((details) => {
		if (!INJECT_COSMETICS_ON_RESPONSE_STARTED.enabled) return;
		if (details.tabId === -1) return;
		if (details.type !== "main_frame" && details.type !== "sub_frame") return;
		if (!details.documentId) return;
		injectCosmetics(details, { bootstrap: true });
	}, { urls: ["http://*/*", "https://*/*"] });
}
//#endregion
export { UPDATE_ENGINES_DELAY, reloadMainEngine, setup, updateEngines };
