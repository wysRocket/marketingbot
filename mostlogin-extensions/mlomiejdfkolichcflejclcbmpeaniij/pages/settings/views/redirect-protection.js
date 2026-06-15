import store_default from "../../../npm/hybrids/src/store.js";
import router_default from "../../../npm/hybrids/src/router.js";
import { html } from "../../../npm/hybrids/src/template/index.js";
import Options from "../../../store/options.js";
import redirect_protection_add_exception_default from "./redirect-protection-add-exception.js";
//#region src/pages/settings/views/redirect-protection.js
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
function removeException(hostname) {
	return ({ options }) => {
		store_default.set(options, { redirectProtection: { exceptions: { [hostname]: null } } });
	};
}
var redirect_protection_default = {
	[router_default.connect]: { stack: [redirect_protection_add_exception_default] },
	options: store_default(Options),
	hostnames: ({ options }) => Object.keys(options.redirectProtection.exceptions),
	render: ({ options, hostnames }) => html`
    <template layout="contents">
      <settings-page-layout layout="column gap:4">
        <section layout="column gap:4">
          <div layout="column gap" layout@992px="margin:bottom">
            <settings-link href="${router_default.backUrl()}" data-qa="button:back" layout="self:start">
              <ui-icon name="chevron-left" color="primary"></ui-icon>
              <ui-text type="headline-s" layout="row gap items:center"> Back </ui-text>
            </settings-link>
            <ui-text type="headline-m">Redirect Protection</ui-text>
            <ui-text type="body-l" mobile-type="body-m" color="secondary">
              Prevents websites from redirecting you through tracking services or unknown
              destinations that may compromise your privacy or security.
            </ui-text>
          </div>
          <settings-card type="content">
            <ui-toggle
              value="${options.redirectProtection.enabled}"
              onchange="${html.set(options, "redirectProtection.enabled")}"
              data-qa="toggle:redirect-protection"
            >
              <div layout="column grow gap:0.5">
                <div layout="row gap items:center">
                  <ui-icon name="globe-lock" color="quaternary" layout="size:3"></ui-icon>
                  <ui-text type="headline-xs">Redirect Protection</ui-text>
                </div>
              </div>
            </ui-toggle>
          </settings-card>
          ${options.redirectProtection.enabled && html`
            <div layout="column gap:2">
              <div layout="row content:space-between items:center">
                <ui-text type="label-l">Exceptions</ui-text>
                <ui-button data-qa="button:redirect-protection:add">
                  <a href="${router_default.url(redirect_protection_add_exception_default)}"> Add </a>
                </ui-button>
              </div>
              ${hostnames.length ? html`
                    <settings-table>
                      <div slot="header" layout="grid:1|max gap">
                        <ui-text type="label-m">
                          Website <span>(${hostnames.length})</span>
                        </ui-text>
                      </div>
                      ${hostnames.map((hostname) => html`
                          <div
                            layout="grid:1|max content:center gap"
                            data-qa="item:redirect-protection:exception:${hostname}"
                          >
                            <ui-text type="label-m">${hostname}</ui-text>
                            <ui-action>
                              <button
                                onclick="${removeException(hostname)}"
                                data-qa="button:redirect-protection:remove:${hostname}"
                              >
                                <ui-icon name="trash" color="tertiary" layout="size:3"></ui-icon>
                              </button>
                            </ui-action>
                          </div>
                        `)}
                    </settings-table>
                  ` : html`
                    <div
                      layout="column center gap padding:5:0"
                      data-qa="component:redirect-protection:empty-state"
                    >
                      <ui-icon name="block-m" layout="size:4" color="tertiary"></ui-icon>
                      <ui-text layout="block:center width:::200px">
                        No exceptions added yet
                      </ui-text>
                    </div>
                  `}
            </div>
          `}
        </section>
      </settings-page-layout>
    </template>
  `
};
//#endregion
export { redirect_protection_default as default };
