import store_default from "../../../npm/hybrids/src/store.js";
import router_default from "../../../npm/hybrids/src/router.js";
import { html } from "../../../npm/hybrids/src/template/index.js";
import ManagedConfig from "../../../store/managed-config.js";
import Options, { GLOBAL_PAUSE_ID } from "../../../store/options.js";
import { longDateFormatter } from "../../../ui/labels.js";
import { BECOME_A_CONTRIBUTOR_PAGE_URL } from "../../../utils/urls.js";
import "../../../npm/@ghostery/config/dist/esm/flags.js";
import Config from "../../../store/config.js";
import assets_default from "../assets/index.js";
import { asyncAction } from "../utils/actions.js";
import regional_filters_default from "./regional-filters.js";
import custom_filters_default from "./custom-filters.js";
import serp_default from "./serp.js";
import redirect_protection_default from "./redirect-protection.js";
//#region src/pages/settings/views/privacy.js
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
function toggleNeverConsent({ options }) {
	store_default.set(options, { blockAnnoyances: !options.blockAnnoyances });
}
function updateGlobalPause({ options }, value, lastValue) {
	if (lastValue === void 0) return;
	store_default.set(options, { paused: { [GLOBAL_PAUSE_ID]: value ? { revokeAt: Date.now() + 1440 * 60 * 1e3 } : null } });
}
function updateEngines(host, event) {
	asyncAction(event, chrome.runtime.sendMessage({ action: "updateEngines" }));
}
var privacy_default = {
	[router_default.connect]: { stack: [
		regional_filters_default,
		custom_filters_default,
		serp_default,
		redirect_protection_default
	] },
	options: store_default(Options),
	config: store_default(Config),
	managedConfig: store_default(ManagedConfig),
	devMode: false,
	globalPause: {
		value: false,
		observe: updateGlobalPause
	},
	globalPauseRevokeAt: {
		value: ({ options }) => store_default.ready(options) && options.paused["<all_urls>"]?.revokeAt,
		observe: (host, value) => {
			host.globalPause = value;
		}
	},
	render: ({ options, config, managedConfig, devMode, globalPause, globalPauseRevokeAt }) => html`
    <template layout="contents">
      <settings-page-layout layout="column gap:4">
        ${store_default.ready(options) && html`
          <section layout="column gap:4">
            <div layout="column gap" layout@992px="margin:bottom">
              <ui-text type="headline-m">Privacy protection</ui-text>
              <ui-text type="body-l" mobile-type="body-m" color="secondary">
                Ghostery protects your privacy by detecting and neutralizing different types of data
                collection including ads, trackers, and cookie pop-ups.
              </ui-text>
            </div>
            <ui-toggle
              value="${globalPause}"
              onchange="${html.set("globalPause")}"
              data-qa="toggle:global-pause"
            >
              <settings-option icon="pause">
                Pause Ghostery
                <span slot="description"> Suspends privacy protection globally for 1 day. </span>
                ${globalPauseRevokeAt && html`
                  <ui-text type="body-s" color="secondary" slot="footer">
                    <ui-revoke-at revokeAt="${globalPauseRevokeAt}"></ui-revoke-at>
                  </ui-text>
                `}
              </settings-option>
            </ui-toggle>
            <ui-line></ui-line>
            <div
              layout="column gap:4"
              style="${{ opacity: globalPause ? .5 : void 0 }}"
              inert="${globalPause}"
            >
              <div layout="column gap:3">
                <ui-toggle
                  value="${options.blockAds}"
                  onchange="${html.set(options, "blockAds")}"
                  data-qa="toggle:ad-blocking"
                >
                  <settings-option icon="ads">
                    Ad-Blocking
                    <span slot="description">
                      Eliminates ads on websites for safe and fast browsing.
                    </span>
                  </settings-option>
                </ui-toggle>
                <ui-toggle
                  value="${options.blockTrackers}"
                  onchange="${html.set(options, "blockTrackers")}"
                  data-qa="toggle:anti-tracking"
                >
                  <settings-option icon="tracking">
                    Anti-Tracking
                    <span slot="description">
                      Prevents various tracking techniques using AI-driven technology.
                    </span>
                  </settings-option>
                </ui-toggle>
                <ui-toggle
                  value="${options.blockAnnoyances}"
                  onchange="${toggleNeverConsent}"
                  data-qa="toggle:never-consent"
                >
                  <settings-option icon="autoconsent">
                    Never-Consent
                    <span slot="description"> Automatically rejects cookie consent notices. </span>
                  </settings-option>
                </ui-toggle>
              </div>
              <ui-line></ui-line>
              <div layout="column gap:3">
                <div layout="grid:1|max content:center gap">
                  <settings-link href="${router_default.url(serp_default)}">
                    <ui-icon
                      name="search"
                      color="quaternary"
                      layout="size:3 margin:right"
                    ></ui-icon>
                    <ui-text type="headline-xs" layout="row gap:0.5 items:center">
                      Search Engine Redirect Protection </ui-text
                    ><ui-icon name="chevron-right" color="primary" layout="size:2"></ui-icon>
                  </settings-link>
                  <ui-toggle
                    value="${options.serpTrackingPrevention}"
                    onchange="${html.set(options, "serpTrackingPrevention")}"
                  >
                  </ui-toggle>
                </div>
                <div layout="grid:1|max content:center gap">
                  <settings-link
                    href="${router_default.url(regional_filters_default)}"
                    data-qa="button:regional-filters"
                  >
                    <ui-icon name="pin" color="quaternary" layout="size:3 margin:right"></ui-icon>
                    <ui-text type="headline-xs" layout="row gap:0.5 items:center">
                      Regional Filters
                    </ui-text>
                    <ui-icon name="chevron-right" color="primary" layout="size:2"></ui-icon>
                  </settings-link>
                  <ui-toggle
                    value="${options.regionalFilters.enabled}"
                    onchange="${html.set(options, "regionalFilters.enabled")}"
                    data-qa="toggle:regional-filters"
                  >
                  </ui-toggle>
                </div>
                <settings-managed value="${managedConfig.customFilters.enabled}">
                  <div layout="grid:1|max content:center gap">
                    <settings-link
                      href="${!managedConfig.customFilters.enabled ? router_default.url(custom_filters_default) : ""}"
                      data-qa="button:custom-filters"
                    >
                      <ui-icon
                        name="detailed-view"
                        color="quaternary"
                        layout="size:3 margin:right"
                      ></ui-icon>
                      <ui-text type="headline-xs" layout="row gap:0.5 items:center">
                        Custom Filters
                      </ui-text>
                      <ui-icon name="chevron-right" color="primary" layout="size:2"></ui-icon>
                    </settings-link>
                    <ui-toggle
                      value="${options.customFilters.enabled}"
                      onchange="${html.set(options, "customFilters.enabled")}"
                      data-qa="toggle:custom-filters"
                    >
                    </ui-toggle>
                  </div>
                </settings-managed>
                ${config.hasFlag("redirect-protection") && options.mode !== "zap" && html`
                  <div layout="grid:1|max content:center gap">
                    <settings-link
                      href="${router_default.url(redirect_protection_default)}"
                      data-qa="button:redirect-protection"
                    >
                      <ui-icon
                        name="globe-lock"
                        color="quaternary"
                        layout="size:3 margin:right"
                      ></ui-icon>
                      <ui-text type="headline-xs" layout="row gap:0.5 items:center">
                        Redirect Protection
                      </ui-text>
                      <ui-icon name="chevron-right" color="primary" layout="size:2"></ui-icon>
                    </settings-link>
                    <ui-toggle
                      value="${options.redirectProtection.enabled}"
                      onchange="${html.set(options, "redirectProtection.enabled")}"
                      data-qa="toggle:redirect-protection"
                    >
                    </ui-toggle>
                  </div>
                `}
              </div>
            </div>
          </section>

          <div>
            <settings-devtools
              onshown="${html.set("devMode", true)}"
              visible="${devMode}"
            ></settings-devtools>
            <div layout="row gap items:center">
              <ui-text type="body-m" color="tertiary">
                Last update:
                ${options.filtersUpdatedAt ? longDateFormatter.format(new Date(options.filtersUpdatedAt)) : html`updating...`}
              </ui-text>
              <ui-button
                type="outline"
                size="s"
                style="height:26px"
                onclick="${updateEngines}"
                disabled="${!options.filtersUpdatedAt}"
              >
                <button layout="padding:0:1">Update Now</button>
              </ui-button>
            </div>
          </div>
        `}
        <section layout="grid:1/1 grow items:end:stretch padding:0" layout@992px="hidden">
          <settings-card layout="column items:center gap" layout@768px="row gap:5">
            <img src="${assets_default["hands"]}" layout="size:12" alt="Contribution" slot="picture" />
            <div
              layout="block:center column gap:0.5"
              layout@768px="block:left row grow gap:5 content:space-between"
            >
              <div layout="column gap:0.5">
                <ui-text type="label-l" layout=""> Become a Contributor </ui-text>
                <ui-text type="body-s" color="secondary">
                  Help Ghostery fight for a web where privacy is a basic human right.
                </ui-text>
              </div>
              <ui-button type="primary" layout="grow margin:top">
                <a
                  href="${BECOME_A_CONTRIBUTOR_PAGE_URL}?utm_source=gbe&utm_campaign=privacy-becomeacontributor"
                  target="_blank"
                >
                  Become a Contributor
                </a>
              </ui-button>
            </div>
          </settings-card>
        </section>
      </settings-page-layout>
    </template>
  `
};
//#endregion
export { privacy_default as default };
