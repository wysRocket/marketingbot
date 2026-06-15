//#region src/utils/dnr.js
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
var PAUSED_ID_RANGE = {
	start: 1,
	end: 1e6
};
var CUSTOM_FILTERS_ID_RANGE = {
	start: 1e6,
	end: 2e6
};
var EXCEPTIONS_ID_RANGE = {
	start: 2e6,
	end: 3e6
};
var FIXES_ID_RANGE = {
	start: 3e6,
	end: 4e6
};
var REDIRECT_PROTECTION_ID_RANGE = {
	start: 4e6,
	end: 5e6
};
var REDIRECT_PROTECTION_EXCEPTIONS_ID_RANGE = {
	start: 5e6,
	end: 6e6
};
var REDIRECT_PROTECTION_SESSION_OFFSET = 1e5;
var PAUSED_RULE_PRIORITY = 1e7;
var EXCEPTIONS_RULE_PRIORITY = 2e6;
var MAX_RULE_PRIORITY = 1073741823;
function filterMaxPriorityRules(rules) {
	return rules.filter((rule) => rule.priority !== MAX_RULE_PRIORITY);
}
async function getDynamicRules(type) {
	return (await chrome.declarativeNetRequest.getDynamicRules()).filter((rule) => rule.id >= type.start && rule.id < type.end);
}
async function getDynamicRulesIds(type) {
	return (await getDynamicRules(type)).map((rule) => rule.id);
}
function getRedirectProtectionRules(rules) {
	const result = [];
	for (const rule of rules) if (rule.action?.type === "block" && rule.condition?.resourceTypes?.includes("main_frame")) result.push({
		...rule,
		priority: rule.priority + 1,
		action: {
			type: "redirect",
			redirect: { extensionPath: "/pages/redirect-protection/index.html" }
		},
		condition: {
			...rule.condition,
			resourceTypes: ["main_frame"]
		}
	});
	return result;
}
//#endregion
export { CUSTOM_FILTERS_ID_RANGE, EXCEPTIONS_ID_RANGE, EXCEPTIONS_RULE_PRIORITY, FIXES_ID_RANGE, MAX_RULE_PRIORITY, PAUSED_ID_RANGE, PAUSED_RULE_PRIORITY, REDIRECT_PROTECTION_EXCEPTIONS_ID_RANGE, REDIRECT_PROTECTION_ID_RANGE, REDIRECT_PROTECTION_SESSION_OFFSET, filterMaxPriorityRules, getDynamicRules, getDynamicRulesIds, getRedirectProtectionRules };
