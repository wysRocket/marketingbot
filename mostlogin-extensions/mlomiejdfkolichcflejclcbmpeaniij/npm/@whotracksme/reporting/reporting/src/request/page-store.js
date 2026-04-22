import ChromeStorageMap from "./utils/chrome-storage-map.js";
//#region node_modules/@whotracksme/reporting/reporting/src/request/page-store.js
/**
* WhoTracks.Me
* https://whotracks.me/
*
* Copyright 2017-present Ghostery GmbH. All rights reserved.
*
* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0
*/
var PAGE_TTL = 1e3 * 60 * 60;
var PAGE_LOADING_STATE = {
	CREATED: "created",
	NAVIGATING: "navigating",
	COMMITTED: "committed",
	COMPLETE: "complete"
};
function makePageActive(page, active) {
	if (active && page.activeFrom === 0) page.activeFrom = Date.now();
	else if (!active && page.activeFrom > 0) {
		page.activeTime += Date.now() - page.activeFrom;
		page.activeFrom = 0;
	}
}
function createPageFromTab(tab) {
	const { id, active, url, incognito, created } = tab;
	const page = {};
	page.id = id;
	page.url = url;
	page.isPrivate = incognito || false;
	page.isPrivateServer = false;
	page.created = created || Date.now();
	page.destroyed = null;
	page.frames = { 0: {
		parentFrameId: -1,
		url
	} };
	page.state = PAGE_LOADING_STATE.CREATED;
	page.activeTime = 0;
	page.activeFrom = active ? Date.now() : 0;
	page.requestStats = {};
	page.annotations = {};
	page.counter = 0;
	page.previous = null;
	return page;
}
var PageStore = class {
	#notifyPageStageListeners;
	#pages;
	constructor({ notifyPageStageListeners }) {
		this.#pages = new ChromeStorageMap({
			storageKey: "wtm-url-reporting:page-store:tabs",
			ttlInMs: PAGE_TTL
		});
		this.#notifyPageStageListeners = notifyPageStageListeners;
	}
	async init() {
		await this.#pages.isReady;
		chrome.tabs.onCreated.addListener(this.#onTabCreated);
		chrome.tabs.onUpdated.addListener(this.#onTabUpdated);
		chrome.tabs.onRemoved.addListener(this.#onTabRemoved);
		chrome.tabs.onActivated.addListener(this.#onTabActivated);
		chrome.webNavigation.onBeforeNavigate.addListener(this.#onBeforeNavigate);
		chrome.webNavigation.onCommitted.addListener(this.#onNavigationCommitted);
		chrome.webNavigation.onCompleted.addListener(this.#onNavigationCompleted);
		chrome.windows?.onFocusChanged?.addListener(this.#onWindowFocusChanged);
		(await chrome.tabs.query({})).forEach((tab) => this.#onTabCreated(tab));
	}
	unload() {
		this.#pages.forEach((serializedPage) => {
			const page = createPageFromTab(serializedPage);
			this.#stagePage(page);
		});
		this.#pages.clear();
		chrome.tabs.onCreated.removeListener(this.#onTabCreated);
		chrome.tabs.onUpdated.removeListener(this.#onTabUpdated);
		chrome.tabs.onRemoved.removeListener(this.#onTabRemoved);
		chrome.tabs.onActivated.removeListener(this.#onTabActivated);
		chrome.webNavigation.onBeforeNavigate.removeListener(this.#onBeforeNavigate);
		chrome.webNavigation.onCommitted.removeListener(this.#onNavigationCommitted);
		chrome.webNavigation.onCompleted.removeListener(this.#onNavigationCompleted);
		chrome.windows?.onFocusChanged?.removeListener(this.#onWindowFocusChanged);
	}
	checkIfEmpty() {
		return this.#pages.countNonExpiredKeys() === 0;
	}
	#stagePage(page) {
		makePageActive(page, false);
		page.destroyed = Date.now();
		page.previous = void 0;
		this.#pages.set(page.id, page);
		this.#notifyPageStageListeners(page);
	}
	/**
	* Create a new `tabContext` for the new tab
	*/
	#onTabCreated = (tab) => {
		this.#pages.set(tab.id, createPageFromTab(tab));
	};
	/**
	* Update an existing tab or create it if we do not have a context yet.
	*/
	#onTabUpdated = (tabId, info, tab) => {
		let page = this.#pages.get(tabId);
		if (!page) page = createPageFromTab(tab);
		page.isPrivate = tab.incognito;
		makePageActive(page, tab.active);
		if (info.url !== void 0) page.url = info.url;
		this.#pages.set(tabId, page);
	};
	/**
	* Remove tab context for `tabId`.
	*/
	#onTabRemoved = (tabId) => {
		const page = this.#pages.get(tabId);
		if (!page) return;
		if (page.state === PAGE_LOADING_STATE.COMPLETE) this.#stagePage(page);
		this.#pages.delete(tabId);
	};
	#onTabActivated = (details) => {
		const { previousTabId, tabId } = details;
		if (!previousTabId) for (const page of this.#pages.values()) {
			makePageActive(page, false);
			this.#pages.set(page.id, page);
		}
		else if (this.#pages.has(previousTabId)) {
			const previousPage = this.#pages.get(previousTabId);
			makePageActive(previousPage, false);
			this.#pages.set(previousPage.id, previousPage);
		}
		if (this.#pages.has(tabId)) {
			const page = this.#pages.get(tabId);
			makePageActive(page, true);
			this.#pages.set(page.id, page);
		}
	};
	#onWindowFocusChanged = async (focusedWindowId) => {
		const activeTabs = await chrome.tabs.query({ active: true });
		for (const { id, windowId } of activeTabs) {
			const page = this.#pages.get(id);
			if (!page) continue;
			makePageActive(page, windowId === focusedWindowId);
			this.#pages.set(id, page);
		}
	};
	#onBeforeNavigate = (details) => {
		const { frameId, tabId, url, timeStamp } = details;
		if (frameId !== 0) return;
		const page = this.#pages.get(tabId);
		if (page) {
			if (page.id === tabId && page.url === url && page.created + 200 > timeStamp) return;
			if (page.state === PAGE_LOADING_STATE.COMPLETE) this.#stagePage(page);
		}
		this.#pages.delete(tabId);
		const nextPage = createPageFromTab({
			id: tabId,
			active: false,
			url,
			incognito: page ? page.isPrivate : false,
			created: timeStamp
		});
		nextPage.previous = page;
		nextPage.state = PAGE_LOADING_STATE.NAVIGATING;
		this.#pages.set(tabId, nextPage);
	};
	#onNavigationCommitted = (details) => {
		const { frameId, tabId } = details;
		const page = this.#pages.get(tabId);
		if (!page) return;
		if (frameId === 0) {
			page.state = PAGE_LOADING_STATE.COMMITTED;
			this.#pages.set(tabId, page);
		} else if (!page.frames[frameId]) this.onSubFrame(details);
	};
	#onNavigationCompleted = (details) => {
		const { frameId, tabId } = details;
		const page = this.#pages.get(tabId);
		if (!page) return;
		if (frameId === 0) page.state = PAGE_LOADING_STATE.COMPLETE;
		this.#pages.set(tabId, page);
	};
	onSubFrame = (details) => {
		const { tabId, frameId, parentFrameId, url } = details;
		const page = this.#pages.get(tabId);
		if (!page) return;
		page.frames[frameId] = {
			parentFrameId,
			url
		};
		this.#pages.set(tabId, page);
	};
	getPageForRequest(context) {
		const { tabId, frameId, originUrl, type, initiator } = context;
		const page = this.#pages.get(tabId);
		if (!page) return null;
		if (!page.frames[frameId]) {
			if (page.previous && page.previous.frames[frameId]) return page.previous;
			return null;
		}
		const couldBePreviousPage = frameId === 0 && type !== "main_frame" && page.previous;
		if (couldBePreviousPage && page.url !== originUrl && page.previous.url === originUrl) return page.previous;
		if (couldBePreviousPage && initiator && !page.url.startsWith(initiator) && page.previous.url.startsWith(initiator)) return page.previous;
		return page;
	}
};
//#endregion
export { PageStore as default };
