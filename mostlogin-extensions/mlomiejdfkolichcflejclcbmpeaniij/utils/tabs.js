//#region src/utils/tabs.js
async function openTabWithUrl(host, event) {
	const { href } = event.currentTarget;
	event.preventDefault();
	try {
		const tabs = await chrome.tabs.query({
			url: href.split("#")[0],
			currentWindow: true
		});
		if (tabs.length) {
			await chrome.tabs.update(tabs[0].id, {
				active: true,
				url: href !== tabs[0].url ? href : void 0
			});
			window.close();
			return;
		}
	} catch (e) {
		console.error("[utils|tabs] Error while try to find existing tab:", e);
	}
	chrome.tabs.create({ url: href });
	window.close();
}
async function getCurrentTab() {
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	return tab || null;
}
//#endregion
export { getCurrentTab, openTabWithUrl };
