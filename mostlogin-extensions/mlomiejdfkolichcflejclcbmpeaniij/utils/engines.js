import store_default from "../npm/hybrids/src/store.js";
import { evaluate } from "../npm/@ghostery/adblocker/dist/esm/preprocessor.js";
import { getLinesWithFilters, mergeDiffs } from "../npm/@ghostery/adblocker/dist/esm/lists.js";
import Resources from "../npm/@ghostery/adblocker/dist/esm/resources.js";
import FilterEngine from "../npm/@ghostery/adblocker/dist/esm/engine/engine.js";
import "../npm/@ghostery/adblocker/dist/esm/index.js";
import { CDN_URL } from "./urls.js";
import { openDB } from "../npm/idb/build/index.js";
import { registerDatabase } from "./indexeddb.js";
import Resources$1 from "../store/resources.js";
//#region src/utils/engines.js
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
var MAIN_ENGINE = "main";
var FIXES_ENGINE = "fixes";
var ELEMENT_PICKER_ENGINE = "element-picker-selectors";
var CUSTOM_ENGINE = "custom-filters";
var TRACKERDB_ENGINE = "trackerdb";
var engines = /* @__PURE__ */ new Map();
var ENV = new Map([
	["ext_ghostery", true],
	["ext_ublock", true],
	["ext_ubol", checkUserAgent("Firefox")],
	["cap_html_filtering", checkUserAgent("Firefox")],
	["cap_replace_modifier", checkUserAgent("Firefox")],
	["cap_user_stylesheet", true],
	["env_firefox", checkUserAgent("Firefox")],
	["env_chromium", checkUserAgent("Chrome")],
	["env_edge", checkUserAgent("Edg")],
	["env_mobile", checkUserAgent("Mobile")],
	["env_experimental", false]
]);
function isPersistentEngine(name) {
	return name !== "element-picker-selectors" && name !== "custom-filters" && name !== "main";
}
function checkUserAgent(pattern) {
	return navigator.userAgent.indexOf(pattern) !== -1;
}
function deserializeEngine(engineBytes) {
	const engine = FilterEngine.deserialize(engineBytes);
	engine.updateEnv(ENV);
	return engine;
}
function isFilterConditionAccepted(condition) {
	return evaluate(condition, ENV);
}
function loadFromMemory(name) {
	return engines.get(name);
}
function saveToMemory(name, engine) {
	engines.set(name, engine);
}
var DB_NAME = registerDatabase("engines");
async function getDB() {
	if (!getDB.current) getDB.current = openDB(DB_NAME, 1, {
		upgrade(db) {
			db.createObjectStore("engines");
		},
		async blocking() {
			(await getDB.current).close();
			getDB.current = null;
		}
	});
	return getDB.current;
}
async function loadFromStorage(name) {
	try {
		const engineBytes = await getDB().then((db) => {
			const tx = db.transaction("engines");
			return tx.objectStore("engines").get(name).then((result) => {
				return tx.done.then(() => result);
			});
		}).catch((e) => {
			throw e;
		});
		if (engineBytes) {
			const engine = deserializeEngine(engineBytes);
			if (!engine.config.loadNetworkFilters) throw TypeError(`Engine "${name}" is obsolete and must be reloaded`);
			saveToMemory(name, engine);
			return engine;
		}
	} catch (e) {
		console.error(`[engines] Failed to load engine "${name}" from storage`, e);
	}
	return null;
}
async function saveToStorage(name, checksum) {
	const engine = loadFromMemory(name);
	const serialized = engine?.serialize();
	store_default.set(Resources$1, { checksums: { [name]: engine && checksum || null } });
	try {
		const tx = (await getDB()).transaction("engines", "readwrite");
		const table = tx.objectStore("engines");
		if (engine) await table.put(serialized, name);
		else await table.delete(name);
		await tx.done;
	} catch (e) {
		throw e;
	}
}
async function loadFromCDN(name) {
	console.log(`[engines] Loading engine "${name}" from CDN...`);
	await update(name, { force: true });
	return await loadFromStorage(name);
}
function check(response) {
	if (!response.ok) throw new Error(`Failed to fetch engine "${name}": ${response.status}: ${response.statusText}`);
	return response;
}
async function update(name, { force = false, cache = true } = {}) {
	if (!force && await loadFromStorage(name) === null) {
		console.warn(`[engines] Skipping update for engine "${name}" as the engine is not available`);
		return false;
	}
	try {
		const listURL = CDN_URL + `adblocker/configs/${name === "trackerdb" ? "trackerdbMv3" : `dnr-${name}-v2`}/allowed-lists.json`;
		console.info(`[engines] Updating engine "${name}"...`);
		const data = await fetch(listURL, { cache: cache ? "default" : "no-store" }).then(check).then((res) => res.json());
		if (!data.engines[821]) throw new Error(`Engine "${name}" for "821" engine version not found`);
		let engine = loadFromMemory(name) || await loadFromStorage(name);
		let requiresFullReload = false;
		if (engine) for (const [name, checksum] of engine.lists.entries()) {
			if (!data.lists[name]) {
				requiresFullReload = true;
				break;
			}
			if (data.lists[name].checksum !== checksum && data.lists[name].diffs[checksum] === void 0) {
				requiresFullReload = true;
				break;
			}
		}
		else requiresFullReload = true;
		if (requiresFullReload) {
			const arrayBuffer = await fetch(data.engines[821].url).then(check).then((res) => res.arrayBuffer());
			engine = deserializeEngine(new Uint8Array(arrayBuffer));
			saveToMemory(name, engine);
			saveToStorage(name, data.engines[821].checksum);
			console.info(`Engine "${name}" reloaded:`, data.engines[821].checksum);
			return true;
		}
		const diffs = [];
		/**
		* Helper function used to fetch a full list, parse it, accumulate
		* parsed filters, then update the checksum in engine if previous
		* steps were successful.
		*/
		const fetchListToAdd = async ({ name, checksum, url }) => {
			try {
				diffs.push({ added: Array.from(getLinesWithFilters(await fetch(url).then(check).then((res) => res.text()), engine.config)) });
				engine.lists.set(name, checksum);
			} catch (e) {
				console.error(`[engines] Failed to add list "${name}"`, e);
			}
		};
		/**
		* Helper function used to fetch a list diff, parse it, accumulate
		* parsed filters, then update the checksum in engine if previous
		* steps were successful.
		*/
		const fetchListToUpdate = async ({ name, checksum, url }) => {
			try {
				diffs.push(await fetch(url).then(check).then((res) => res.json()));
				engine.lists.set(name, checksum);
			} catch (e) {
				console.error(`[engines] Failed to update list "${name}"`, e);
			}
		};
		const promises = [];
		for (const name of Object.keys(data.lists)) {
			const checksum = engine.lists.get(name);
			if (checksum === void 0) promises.push(fetchListToAdd({
				name,
				checksum: data.lists[name].checksum,
				url: data.lists[name].url
			}));
			else if (checksum !== data.lists[name].checksum) promises.push(fetchListToUpdate({
				name,
				checksum: data.lists[name].checksum,
				url: data.lists[name].diffs[checksum]
			}));
		}
		await Promise.all(promises);
		const cumulativeDiff = mergeDiffs(diffs);
		let updated = engine.updateFromDiff(cumulativeDiff, ENV);
		if (data.resourcesJson && data.resourcesJson.checksum !== engine.resources.checksum) {
			engine.updateResources(await fetch(data.resourcesJson.url).then(check).then((res) => res.text()), data.resourcesJson.checksum);
			updated = true;
		}
		if (updated) {
			console.info(`[engines] Engine "${name}" updated:`, data.engines[821].checksum);
			saveToStorage(name, data.engines[821].checksum);
			return true;
		}
		return false;
	} catch (e) {
		console.error(`[engines] Failed to update engine "${name}"`, e);
	}
}
function get(name) {
	return loadFromMemory(name);
}
async function init(name) {
	return get(name) || await loadFromStorage(name) || isPersistentEngine(name) && await loadFromCDN(name) || null;
}
async function create(name, options = null) {
	const baseEngine = await init(FIXES_ENGINE);
	options = {
		...options,
		config: baseEngine.config
	};
	const engine = new FilterEngine({ ...options });
	engine.resources = Resources.copy(baseEngine.resources);
	engine.updateEnv(ENV);
	saveToMemory(name, engine);
	saveToStorage(name).catch(() => {
		console.error(`[engines] Failed to save engine "${name}" to storage`);
	});
	return engine;
}
function replace(name, engineOrEngines) {
	const engines = [].concat(engineOrEngines);
	let engine;
	if (engines.length > 1) {
		engine = FilterEngine.merge(engines, {
			skipResources: true,
			overrideConfig: { enableCompression: false }
		});
		engine.resources = Resources.copy(engines[0].resources);
	} else engine = engines[0];
	engine.updateEnv(ENV);
	saveToMemory(name, engine);
	saveToStorage(name).catch(() => {
		console.error(`[engines] Failed to save engine "${name}" to storage`);
	});
	return engine;
}
function remove(name) {
	engines.delete(name);
	saveToStorage(name).catch(() => {
		console.error(`[engines] Failed to remove engine "${name}" from storage`);
	});
}
async function getConfig() {
	return (await init(FIXES_ENGINE)).config;
}
(globalThis.ghostery ??= {}).engines = { get };
//#endregion
export { CUSTOM_ENGINE, ELEMENT_PICKER_ENGINE, FIXES_ENGINE, MAIN_ENGINE, TRACKERDB_ENGINE, create, get, getConfig, init, isFilterConditionAccepted, isPersistentEngine, remove, replace, update };
