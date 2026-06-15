var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/// <reference path="../../../../typings/common.d.ts" />
/// <reference path="../../../../typings/ExtAPI.d.ts" />
class BrowserPermissionsError extends Error {
}
const BrowserPermissions = {
    _required: { permissions: ['tabs', 'webNavigation'], origins: ['*://*/*'] },
    request(callback) {
        chrome.permissions.request(this._required, callback);
    },
    check(callback) {
        /**
         * This would be the proper way to check for permissions if the Chrome devs
         * wouldn't have fucked app the API
         */
        // chrome.permissions.contains(this._required, callback)
        chrome.permissions.getAll((permissions) => {
            try {
                Object.keys(this._required).forEach(key => {
                    this._required[key].forEach(val => {
                        if (!permissions[key].includes(val)) {
                            throw new BrowserPermissionsError();
                        }
                    });
                });
            }
            catch (err) {
                return callback(false);
            }
            callback(true);
        });
    },
};
var Views;
(function (Views) {
    var Settings;
    (function (Settings_1) {
        var $ = Core.Utils.DOM;
        class PageSettings extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
            }
            init() {
                this.settings = new Settings(this.parent);
                ExtAPI.invoke('get-settings')
                    .then(settings => {
                    for (let key in settings) {
                        this.settings[key] = settings[key];
                    }
                })
                    .catch(this.parent._log);
                let [page, tab] = window.location.hash.split('/', 2);
                tab = tab ? '.' + tab : '';
                this.parent.navigateToTab($.q('.tab-nav a' + tab));
            }
        }
        Settings_1.PageSettings = PageSettings;
        class Settings {
            constructor(view) {
                this.view = view;
                this._settings = {};
                this._hasPermission = false;
            }
            _get(key) {
                return this._settings[key];
            }
            _set(key, val, force = false) {
                if (!force && val === this._settings[key]) {
                    return;
                }
                if (key in this._settings) {
                    let saved = {};
                    saved[key] = val;
                    setTimeout(() => ExtAPI.invoke('save-settings', saved), 10);
                }
                this._settings[key] = val;
            }
            get alwaysCenterTheWindow() {
                return this._get('alwaysCenterTheWindow');
            }
            set alwaysCenterTheWindow(val) {
                this._set('alwaysCenterTheWindow', val);
            }
            get leftAlignWindow() {
                return this._get('leftAlignWindow');
            }
            set leftAlignWindow(val) {
                this._set('leftAlignWindow', val);
            }
            get hideTooltipDelay() {
                return this._get('hideTooltipDelay');
            }
            set hideTooltipDelay(val) {
                this._set('hideTooltipDelay', parseInt(val, 10));
            }
            get popupIconStyle() {
                return this._get('popupIconStyle');
            }
            set popupIconStyle(val) {
                this._set('popupIconStyle', val);
            }
            get presetsIconsStyle() {
                return this._get('presetsIconsStyle');
            }
            set presetsIconsStyle(val) {
                this._set('presetsIconsStyle', val);
            }
            get alternatePresetsBg() {
                return this._get('alternatePresetsBg');
            }
            set alternatePresetsBg(val) {
                this._set('alternatePresetsBg', val);
            }
            get autoClosePopup() {
                return this._get('autoClosePopup');
            }
            set autoClosePopup(val) {
                this._set('autoClosePopup', val);
            }
            get presetsPrimaryLine() {
                return this._get('presetsPrimaryLine');
            }
            set presetsPrimaryLine(val) {
                this._set('presetsPrimaryLine', val);
            }
            get hidePresetsDescription() {
                return this._get('hidePresetsDescription');
            }
            set hidePresetsDescription(val) {
                this._set('hidePresetsDescription', val);
            }
            get hidePopupTooltips() {
                return this._get('hidePopupTooltips');
            }
            set hidePopupTooltips(val) {
                this._set('hidePopupTooltips', val);
            }
            get hideQuickResize() {
                return this._get('hideQuickResize');
            }
            set hideQuickResize(val) {
                this._set('hideQuickResize', val);
            }
            get alwaysShowTheTooltip() {
                return this._get('alwaysShowTheTooltip');
            }
            set alwaysShowTheTooltip(val) {
                if (!val) {
                    this._set('alwaysShowTheTooltip', false);
                    return;
                }
                // temporary set the value to true, so the binding system doesn't revert the checkbox to un-checked
                this._settings.alwaysShowTheTooltip = true;
                if (this._hasPermission) {
                    this._set('alwaysShowTheTooltip', val, true);
                    return; // permissions have already been checked
                }
                BrowserPermissions.check(granted => {
                    if (granted) {
                        this._hasPermission = true;
                        return this._set('alwaysShowTheTooltip', val, true);
                    }
                    let view = this.view;
                    let actions = [];
                    let title = 'Insufficient permissions';
                    let message = `In order for the extension to be able to automatically show the tooltip on all opened pages,
				it needs to be able to inject custom code in the context of all pages, without user interaction.
				<br /><br />
				<em>If you're not comfortable granting those permissions, you can always manually enable the tooltip for any
				given page from the extension's popup menu</em>`;
                    actions.push({
                        title: 'Cancel',
                        onDismiss: true,
                        handler: () => {
                            view.dismissMessage();
                            this.alwaysShowTheTooltip = false;
                        },
                    });
                    actions.push({
                        title: 'Grant permissions',
                        main: true,
                        handler: () => {
                            view.dismissMessage();
                            BrowserPermissions.request(granted => {
                                this.alwaysShowTheTooltip = granted;
                            });
                        },
                    });
                    view.showMessage(title, message, actions);
                });
            }
        }
        Core.Components.create('wr-page-settings', {
            static: [],
            initialize: (el, data) => new PageSettings(el, data),
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
/// <reference path="../../../../typings/ExtAPI.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        var Preset = Core.Preset;
        var $ = Core.Utils.DOM;
        class PagePresets extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
                this.presets = [];
                this.presetEdit = this.presetEdit.bind(this);
                this.presetDelete = this.presetDelete.bind(this);
            }
            init() {
                //this.template = $.q('.preset-item');
                ExtAPI.invoke('get-presets').then(presets => {
                    for (let p of presets) {
                        this.presets.push(new Preset(p));
                    }
                    Sortable.create($.q('#presetsSortList'), {
                        animation: 150,
                        forceFallback: true,
                        fallbackOnBody: true,
                        handle: 'wr-preset',
                        fallbackClass: 'sortable-mirror',
                        onEnd: evt => {
                            if (evt.newIndex === evt.oldIndex) {
                                return;
                            }
                            let presets = this.presets.slice();
                            let preset = presets.splice(evt.oldIndex, 1);
                            let views = this.parent.currentView.bindings[0].iterated;
                            let view = views.splice(evt.oldIndex, 1);
                            presets.splice(evt.newIndex, 0, preset[0]);
                            views.splice(evt.newIndex, 0, view[0]);
                            _reindex(views);
                            this.presets = presets;
                            ExtAPI.invoke('save-settings', { presets: presets });
                        }
                    });
                });
            }
            presetsDelete(evt, ctx) {
                let view = ctx.parent;
                let actions = [];
                let title = 'Warning';
                let message = `Are you sure you want to delete all the existing presets?`;
                actions.push({ title: 'Yes, I\'m sure', main: true, handler: () => {
                        ctx.presets = [];
                        ExtAPI.invoke('save-settings', { presets: ctx.presets });
                        view.dismissMessage();
                    } });
                actions.push({ title: 'No, don\'t do it', handler: () => view.dismissMessage() });
                view.showMessage(title, message, actions, { class: 'danger' });
            }
            presetsReset(evt, ctx) {
                const reset = () => {
                    ExtAPI.invoke('default-settings').then(defaults => {
                        ctx.presets = [];
                        ctx.presets = defaults.presets;
                        return ExtAPI.invoke('save-settings', { presets: defaults.presets });
                    }).catch(err => console.log(err));
                };
                if (!ctx.presets || !ctx.presets.length) {
                    return reset();
                }
                let view = ctx.parent;
                let actions = [];
                let title = 'Warning';
                let message = `Are you sure you want to replace all your existing presets with the default ones?`;
                actions.push({ title: 'Yes, I\'m sure', main: true, handler: () => {
                        reset();
                        view.dismissMessage();
                    } });
                actions.push({ title: 'No, don\'t do it', handler: () => view.dismissMessage() });
                view.showMessage(title, message, actions, { class: 'danger' });
            }
            presetAdd(evt, ctx) {
                ctx.parent.showSubPage('wr-page-edit-preset', 'add');
            }
            presetEdit(evt, ctx) {
                ctx.parent.showSubPage('wr-page-edit-preset', `edit=${ctx.item.id}`);
            }
            presetDelete(evt, ctx) {
                let index = ctx.index;
                let views = this.parent.currentView.bindings[0].iterated;
                let node = views[index].els[0];
                $.animate(node, 'puff-out', 'transform').then(n => {
                    $.animate(node, 'collapse', 'margin-top').then(n => {
                        views[index].unbind();
                        node.parentNode.removeChild(node);
                        views.splice(index, 1);
                        this.presets.splice(index, 1);
                        _reindex(views);
                        ExtAPI.invoke('save-settings', { presets: this.presets });
                    });
                });
            }
            _performUnbound(callback) {
                let binding = this.parent.currentView; //.bindings[0];
                binding.unbind();
                let result = callback();
                binding.bind();
                binding.sync();
                // for (let view of binding.iterated) {
                // 	view.sync();
                // }
                return result;
            }
        }
        Settings.PagePresets = PagePresets;
        function _reindex(views) {
            views.forEach((view, index) => {
                view.models.index = index;
            });
        }
        Core.Components.create('wr-page-presets', {
            static: [],
            initialize: (el, data) => new PagePresets(el, data)
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../typings/rivets.d.ts" />
/// <reference path="../../../typings/ExtAPI.d.ts" />
/// <reference path="../../../typings/tab-nav.d.ts" />
/// <reference path="../../../typings/common.d.ts" />
/// <reference path="./pages/settings.ts" />
/// <reference path="./pages/presets.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        var ModalMessage = Views.Common.ModalMessage;
        var $ = Core.Utils.DOM;
        class SettingsView {
            constructor(id, title, element) {
                this.id = id;
                this.title = title;
                this.element = element;
                this.selected = false;
            }
        }
        Settings.SettingsView = SettingsView;
        class MainView {
            constructor() {
                this.menu = [
                    new SettingsView('#settings', 'settings', 'wr-page-settings'),
                    new SettingsView('#presets', 'presets', 'wr-page-presets'),
                    new SettingsView('#hotkeys', 'hotkeys', 'wr-page-hotkeys'),
                    new SettingsView('#sync', 'sync', 'wr-page-sync'),
                    new SettingsView('#help', 'about', 'wr-page-help'),
                ];
                this.routes = [
                    new SettingsView('#help/release-notes', 'release-notes', 'wr-page-release-notes'),
                    new SettingsView('#pro', 'pro', 'wr-page-pro'),
                ];
                this.license = null;
                this.presetsIconsStyle = '';
                this.navigateTo = this.navigateTo.bind(this);
                this.handleNavigateToTab = this.handleNavigateToTab.bind(this);
                this.showMessage = this.showMessage.bind(this);
                this.dismissMessage = this.dismissMessage.bind(this);
                ExtAPI.invoke('get-settings')
                    .then(settings => {
                    this.license = settings.license;
                    this.presetsIconsStyle = settings.presetsIconsStyle;
                    return ExtAPI.invoke('settings:requested-page');
                })
                    .then(url => {
                    this._showView(url) || this.showView(this.menu[0]);
                    // this.showView(this._view('#pro'));
                });
                chrome.runtime.onMessage.addListener((msg, sender, respond) => {
                    if (msg && msg.showPage) {
                        let view = this._showView(msg.showPage);
                    }
                    if (msg && msg.UpdatedSettings) {
                        if ('license' in msg.UpdatedSettings) {
                            this.license = msg.UpdatedSettings.license;
                        }
                        if ('presetsIconsStyle' in msg.UpdatedSettings) {
                            this.presetsIconsStyle = msg.UpdatedSettings.presetsIconsStyle;
                        }
                    }
                });
            }
            _showView(url) {
                let [page, ...args] = (url || '').split('/');
                let view = this._view(url) || this._view(page);
                let params = '';
                if (args && args.length) {
                    params = args.join('/');
                }
                view && this.showView(view, params);
                return view;
            }
            showView(view, params = '') {
                this.selectedView = view;
                params = params || '';
                for (let item of this.menu) {
                    item.selected = view.id.indexOf(item.id) === 0;
                }
                $.hide('#content').then(_ => {
                    this.currentView && this.currentView.unbind();
                    this.currentView = rivets.init(view.element, null, { parent: this });
                    let model = this.currentView.models;
                    window.location.hash = `${view.id}/${params}`;
                    $.empty('#content');
                    $.q('#content').appendChild(this.currentView.els[0]);
                    model.init && model.init();
                    $.show('#content');
                });
            }
            showSubPage(element, id) {
                this.showView(new SettingsView(`${this.selectedView.id}/${id}`, id, element));
            }
            navigateTo(evt, ctx) {
                let item = ctx.item;
                if (!item) {
                    let target = evt.target;
                    while (target && !target.matches('a, button')) {
                        target = target.parentNode;
                    }
                    if (target) {
                        item = this._view(target.hash || target.getAttribute('data-hash'));
                    }
                }
                this.showView(item);
            }
            handleNavigateToTab(evt, ctx) {
                evt.preventDefault();
                this.navigateToTab(evt.target);
            }
            navigateToTab(target) {
                if (target.classList.contains('selected')) {
                    return;
                }
                let current = $.q('.selected', target.parentNode);
                let showNext = () => {
                    $.addClass(target, 'selected');
                    $.addClass(target.hash, 'visible');
                    setTimeout(() => {
                        $.addClass(target.hash, 'selected');
                    }, 1);
                };
                if (!current) {
                    return showNext();
                }
                $.removeClass(current, 'selected');
                $.hide(current.hash, 'selected').then(_ => {
                    $.removeClass(current.hash, 'visible');
                    showNext();
                });
            }
            showMessage(title, message, actions, options = {}) {
                if (!actions || actions.length === 0) {
                    actions = [{ title: 'OK', onDismiss: true, handler: this.dismissMessage }];
                }
                this.currentMessage = new ModalMessage(title, message, false, actions, options);
            }
            dismissMessage() {
                this.currentMessage.hide().then(x => {
                    this.currentMessage = null;
                });
            }
            _view(id) {
                let routes = this.menu.concat(this.routes);
                for (let view of routes) {
                    if (view.id === id) {
                        return view;
                    }
                }
                return null;
            }
            _log(err) {
                console.log(err);
            }
        }
        Settings.MainView = MainView;
        Settings.mainView = new MainView();
        Settings.model = rivets.bind(document.body, Settings.mainView);
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        class TabContent extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
            }
        }
        Settings.TabContent = TabContent;
        Core.Components.create('wr-tab-content', {
            static: [],
            initialize: (el, data) => new TabContent(el, data)
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        class TabGroup extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
            }
        }
        Settings.TabGroup = TabGroup;
        Core.Components.create('wr-tab-group', {
            static: [],
            initialize: (el, data) => new TabGroup(el, data)
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
/// <reference path="../../../../typings/ExtAPI.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        var $ = Core.Utils.DOM;
        var Preset = Core.Preset;
        var PresetPosition = Core.PresetPosition;
        class PageEditPreset extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
                this.title = 'add preset';
                this.preset = new Preset({});
                this.formErrors = [];
            }
            init() {
                let params = window.location.hash.match(/edit=([^\/]+)/);
                this.id = params ? params[1] : '';
                if (this.id) {
                    this.title = 'edit preset';
                    ExtAPI.invoke('get-presets').then(presets => {
                        let data = presets.find(item => item.id === this.id);
                        this.preset = new Preset(data);
                        this.customPosition = this.preset.position;
                        this.customIcon = this.preset.type;
                    });
                }
            }
            useCurrentSize(evt, ctx) {
                chrome.windows.getCurrent({ populate: true }, win => {
                    let tab = win.tabs.filter(tab => tab.active).pop();
                    if (ctx.preset.target == 1) {
                        ctx.preset.width = tab.width;
                        ctx.preset.height = tab.height;
                    }
                    else {
                        ctx.preset.width = win.width;
                        ctx.preset.height = win.height;
                    }
                });
            }
            useCurrentPosition(evt, ctx) {
                chrome.windows.getCurrent(win => {
                    ctx.customPosition = PresetPosition.CUSTOM;
                    ctx.preset.left = win.left;
                    ctx.preset.top = win.top;
                });
            }
            get allowCustomPosition() {
                return this.preset.position === PresetPosition.CUSTOM;
            }
            set allowCustomPosition(newValue) {
                // placeholder setter
            }
            get customPosition() {
                return this.preset.position;
            }
            set customPosition(newValue) {
                newValue = parseInt(newValue, 10);
                this.preset.position = newValue;
                if (newValue !== PresetPosition.CUSTOM) {
                    this.preset.left = null;
                    this.preset.top = null;
                }
                this.allowCustomPosition = newValue;
            }
            get customIcon() {
                return this.preset.type;
            }
            set customIcon(newValue) {
                newValue = parseInt(newValue, 10);
                this.preset.type = newValue;
            }
            cancel(evt, ctx) {
                ctx.parent.showView(ctx.parent.menu[1]);
            }
            savePreset(evt, ctx) {
                evt.preventDefault();
                let preset = ctx.preset;
                ctx.formErrors = [];
                if (preset.width === null && preset.height === null) {
                    ctx.formErrors.push('You must provide at least one of the width and height values!');
                    $.q('#content').scrollTop = 0;
                }
                if (ctx.formErrors.length) {
                    return;
                }
                ExtAPI.invoke('save-preset', preset).then(data => {
                    ctx.parent.showView(ctx.parent.menu[1]);
                });
            }
        }
        Settings.PageEditPreset = PageEditPreset;
        Core.Components.create('wr-page-edit-preset', {
            static: [],
            initialize: (el, data) => new PageEditPreset(el, data)
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
/// <reference path="../../../../typings/ExtAPI.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        class PageHelp extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
            }
            init() {
                return __awaiter(this, void 0, void 0, function* () {
                    let config = chrome.runtime.getManifest();
                    this.friendlyVersion = config.version_name || config.version;
                    this.completeVersion = config.version_name ? `(${config.version})` : '';
                    const flags = yield chrome.storage.local.get('debugLog');
                    let log = flags.debugLog || [];
                    this.debugLog = log.length ? JSON.stringify(log, null, 4) : null;
                });
            }
            showReleaseNotes(evt, ctx) {
                ctx.parent.showSubPage('wr-page-release-notes', 'release-notes');
            }
            showDebugLog(evt, ctx) {
                ctx.parent.showMessage('Errors log', `<pre>${ctx.debugLog}</pre>`, null, { class: 'danger' });
            }
        }
        Settings.PageHelp = PageHelp;
        Core.Components.create('wr-page-help', {
            static: [],
            initialize: (el, data) => new PageHelp(el, data),
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        var $ = Core.Utils.DOM;
        class PageHotkeys extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
                this.key_ShowPopup = '<not set>';
                this.key_ToggleTooltip = '<not set>';
                this.key_CyclePresets = '<not set>';
                this.key_CyclePresetsRev = '<not set>';
            }
            init() {
                this.parent.navigateToTab($.q('.tab-nav a'));
                chrome.commands.getAll(commands => this.globalShortcuts = commands);
            }
            configureShortcuts() {
                chrome.tabs.create({
                    url: 'chrome://extensions/shortcuts',
                    active: true
                });
            }
        }
        Settings.PageHotkeys = PageHotkeys;
        Core.Components.create('wr-page-hotkeys', {
            static: [],
            initialize: (el, data) => new PageHotkeys(el, data)
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
/// <reference path="../../../../typings/ExtAPI.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        class PagePro extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
                this.defaultPrice = 4;
                this.payAmount = 4;
                this.minAmount = 3;
                this.licenseKey = '';
                this.error = '';
                this.busy = false;
                this.activate = () => {
                    if (!this.licenseKey.match(/^\s*[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\s*$/i)) {
                        this.error = 'Invalid license key!';
                        return;
                    }
                    this.error = '';
                    this.busy = true;
                    ExtAPI.invoke('pro:activate-license', { key: this.licenseKey })
                        .then(this._handleErrors)
                        .then(data => {
                        this.licenseKey = '';
                        // this.parent.license = data;
                    });
                };
                this.purchase = () => {
                    if (this.payAmount < this.minAmount) {
                        this.error = `The minimum amount is \$${this.minAmount.toFixed(2)}`;
                        return;
                    }
                    this.error = '';
                    this.busy = true;
                    ExtAPI.invoke('pro:checkout-url', { price: this.payAmount })
                        .then(this._handleErrors)
                        .then(data => {
                        window.open(data.url);
                    });
                };
                this._handleErrors = (response) => {
                    this.busy = false;
                    this.error = '';
                    if (response.error) {
                        this.error = response.error;
                        return Promise.reject(response.error);
                    }
                    return Promise.resolve(response.data);
                };
            }
            init() {
            }
        }
        Settings.PagePro = PagePro;
        Core.Components.create('wr-page-pro', {
            static: [],
            initialize: (el, data) => new PagePro(el, data)
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
/// <reference path="../../../../typings/ExtAPI.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings) {
        class PageReleaseNotes extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
            }
            cancel(evt, ctx) {
                ctx.parent.showView(ctx.parent.menu[4]);
            }
            goTo(evt, ctx) {
                var hash = evt.target.hash || evt.target.getAttribute('data-hash');
                ctx.parent.showView(ctx.parent._view(hash));
            }
        }
        Settings.PageReleaseNotes = PageReleaseNotes;
        Core.Components.create('wr-page-release-notes', {
            static: [],
            initialize: (el, data) => new PageReleaseNotes(el, data)
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));
/// <reference path="../../../../typings/common.d.ts" />
/// <reference path="../../../../typings/ExtAPI.d.ts" />
var Views;
(function (Views) {
    var Settings;
    (function (Settings_2) {
        var $ = Core.Utils.DOM;
        class PageSync extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
                this.exportSettings = this.exportSettings.bind(this);
                this.importSettings = this.importSettings.bind(this);
            }
            init() {
                this.settings = new Settings();
                ExtAPI.invoke('get-sync-status').then(status => {
                    this.settings.syncSettings = !status;
                }).catch(this.parent._log);
            }
            exportSettings() {
                ExtAPI.invoke('get-settings').then(settings => {
                    let node = $.q('#importExportField');
                    node.value = JSON.stringify(settings);
                    node.focus();
                    node.select();
                });
            }
            importSettings() {
                let node = $.q('#importExportField');
                let data;
                let settings = {};
                try {
                    data = JSON.parse(node.value);
                }
                catch (ex) {
                    this.parent.showMessage('Error', 'The provided input is not a valid JSON object.');
                    return null;
                }
                ExtAPI.invoke('import-settings', data);
                this.parent.showMessage('Success', 'The new settings have been imported.');
                node.value = '';
            }
        }
        Settings_2.PageSync = PageSync;
        class Settings {
            constructor() {
                this._settings = {};
            }
            get syncSettings() { return this._settings.syncSettings; }
            set syncSettings(val) {
                if (val === this._settings.syncSettings) {
                    return;
                }
                this._settings.syncSettings = val;
                setTimeout(() => {
                    ExtAPI.invoke('toggle-sync', !val)
                        .then(() => ExtAPI.invoke('get-settings'))
                        .then(settings => ExtAPI.invoke('save-settings', settings));
                });
            }
        }
        Core.Components.create('wr-page-sync', {
            static: [],
            initialize: (el, data) => new PageSync(el, data)
        });
    })(Settings = Views.Settings || (Views.Settings = {}));
})(Views || (Views = {}));

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy92aWV3cy9zZXR0aW5ncy9wYWdlcy9zZXR0aW5ncy50cyIsInNyYy92aWV3cy9zZXR0aW5ncy9wYWdlcy9wcmVzZXRzLnRzIiwic3JjL3ZpZXdzL3NldHRpbmdzL3NldHRpbmdzLnRzIiwic3JjL3ZpZXdzL3NldHRpbmdzL2NvbXBvbmVudHMvdGFiLWNvbnRlbnQudHMiLCJzcmMvdmlld3Mvc2V0dGluZ3MvY29tcG9uZW50cy90YWItZ3JvdXAudHMiLCJzcmMvdmlld3Mvc2V0dGluZ3MvcGFnZXMvZWRpdC1wcmVzZXQudHMiLCJzcmMvdmlld3Mvc2V0dGluZ3MvcGFnZXMvaGVscC50cyIsInNyYy92aWV3cy9zZXR0aW5ncy9wYWdlcy9ob3RrZXlzLnRzIiwic3JjL3ZpZXdzL3NldHRpbmdzL3BhZ2VzL3Byby50cyIsInNyYy92aWV3cy9zZXR0aW5ncy9wYWdlcy9yZWxlYXNlLW5vdGVzLnRzIiwic3JjL3ZpZXdzL3NldHRpbmdzL3BhZ2VzL3N5bmMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsd0RBQXdEO0FBQ3hELHdEQUF3RDtBQUd4RCxNQUFNLHVCQUF3QixTQUFRLEtBQUs7Q0FBRztBQUU5QyxNQUFNLGtCQUFrQixHQUFHO0lBQzFCLFNBQVMsRUFBRSxFQUFFLFdBQVcsRUFBRSxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxTQUFTLENBQUMsRUFBRTtJQUUzRSxPQUFPLENBQUMsUUFBb0M7UUFDM0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQTtJQUNyRCxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQW9DO1FBQ3pDOzs7V0FHRztRQUNILHdEQUF3RDtRQUN4RCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQTJDLEVBQUUsRUFBRTtZQUN6RSxJQUFJO2dCQUNILE1BQU0sQ0FBQyxJQUFJLENB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QUFRLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQzlELENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQztTQUNEO1FBRUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO1lBQ3RDLE1BQU0sRUFBRSxFQUFFO1lBQ1YsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxRQUFRLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQztTQUNoRCxDQUFDLENBQUE7SUFDSCxDQUFDLEVBM0VZLFFBQVEsR0FBUixjQUFRLEtBQVIsY0FBUSxRQTJFcEI7QUFBRCxDQUFDLEVBM0VNLEtBQUssS0FBTCxLQUFLLFFBMkVYIiwiZmlsZSI6InZpZXdzL3NldHRpbmdzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uLy4uL3R5cGluZ3MvY29tbW9uLmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vLi4vdHlwaW5ncy9FeHRBUEkuZC50c1wiIC8+XHJcblxyXG50eXBlIEJyb3dzZXJQZXJtaXNzaW9uc0NhbGxiYWNrID0gKGdyYW50ZWQ6IGJvb2xlYW4pID0+IHZvaWRcclxuY2xhc3MgQnJvd3NlclBlcm1pc3Npb25zRXJyb3IgZXh0ZW5kcyBFcnJvciB7fVxyXG5cclxuY29uc3QgQnJvd3NlclBlcm1pc3Npb25zID0ge1xyXG5cdF9yZXF1aXJlZDogeyBwZXJtaXNzaW9uczogWyd0YWJzJywgJ3dlYk5hdmlnYXRpb24nXSwgb3JpZ2luczogWycqOi8vKi8qJ10gfSxcclxuXHJcblx0cmVxdWVzdChjYWxsYmFjazogQnJvd3NlclBlcm1pc3Npb25zQ2FsbGJhY2spIHtcclxuXHRcdGNocm9tZS5wZXJtaXNzaW9ucy5yZXF1ZXN0KHRoaXMuX3JlcXVpcmVkLCBjYWxsYmFjaylcclxuXHR9LFxyXG5cclxuXHRjaGVjayhjYWxsYmFjazogQnJvd3NlclBlcm1pc3Npb25zQ2FsbGJhY2spIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogVGhpcyB3b3VsZCBiZSB0aGUgcHJvcGVyIHdheSB0byBjaGVjayBmb3IgcGVybWlzc2lvbnMgaWYgdGhlIENocm9tZSBkZXZzXHJcblx0XHQgKiB3b3VsZG4ndCBoYXZlIGZ1Y2tlZCBhcHAgdGhlIEFQSVxyXG5cdFx0ICovXHJcblx0XHQvLyBjaHJvbWUucGVybWlzc2lvbnMuY29udGFpbnModGhpcy5fcmVxdWlyZWQsIGNhbGxiYWNrKVxyXG5cdFx0Y2hyb21lLnBlcm1pc3Npb25zLmdldEFsbCgocGVybWlzc2lvbnM6IGNocm9tZS5wZXJtaXNzaW9ucy5QZXJtaXNzaW9ucykgPT4ge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdE9iamVjdC5rZXlzKHRoaXMuX3JlcXVpcmVkKS5mb3JFYWNoKGtleSA9PiB7XHJcblx0XHRcdFx0XHR0aGlzLl9yZXF1aXJlZFtrZXldLmZvckVhY2godmFsID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKCFwZXJtaXNzaW9uc1trZXldLmluY2x1ZGVzKHZhbCkpIHtcclxuXHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgQnJvd3NlclBlcm1pc3Npb25zRXJyb3IoKVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdH0gY2F0Y2ggKGVycikge1xyXG5cdFx0XHRcdHJldHVybiBjYWxsYmFjayhmYWxzZSlcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y2FsbGJhY2sodHJ1ZSlcclxuXHRcdH0pXHJcblx0fSxcclxufVxyXG5cclxubW9kdWxlIFZpZXdzLlNldHRpbmdzIHtcclxuXHRpbXBvcnQgJCA9IENvcmUuVXRpbHMuRE9NXHJcblxyXG5cdGV4cG9ydCBjbGFzcyBQYWdlU2V0dGluZ3MgZXh0ZW5kcyBDb3JlLkN1c3RvbUVsZW1lbnQge1xyXG5cdFx0cHVibGljIHBhcmVudDogYW55IC8vIFZpZXdzLlNldHRpbmdzLk1haW5WaWV3O1xyXG5cdFx0cHVibGljIHNldHRpbmdzOiBTZXR0aW5nc1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5vZGUsIGRhdGEpIHtcclxuXHRcdFx0c3VwZXIobm9kZSwgZGF0YSlcclxuXHRcdH1cclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLnNldHRpbmdzID0gbmV3IFNldHRpbmdzKHRoaXMucGFyZW50KVxyXG5cclxuXHRcdFx0RXh0QVBJLmludm9rZSgnZ2V0LXNldHRpbmdzJylcclxuXHRcdFx0XHQudGhlbihzZXR0aW5ncyA9PiB7XHJcblx0XHRcdFx0XHRmb3IgKGxldCBrZXkgaW4gc2V0dGluZ3MpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5zZXR0aW5nc1trZXldID0gc2V0dGluZ3Nba2V5XVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdFx0LmNhdGNoKHRoaXMucGFyZW50Ll9sb2cpXHJcblxyXG5cdFx0XHRsZXQgW3BhZ2UsIHRhYl0gPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zcGxpdCgnLycsIDIpXHJcblx0XHRcdHRhYiA9IHRhYiA/ICcuJyArIHRhYiA6ICcnXHJcblxyXG5cdFx0XHR0aGlzLnBhcmVudC5uYXZpZ2F0ZVRvVGFiKCQucSgnLnRhYi1uYXYgYScgKyB0YWIpKVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Y2xhc3MgU2V0dGluZ3Mge1xyXG5cdFx0cHJpdmF0ZSBfc2V0dGluZ3M6IGFueSA9IHt9XHJcblx0XHRwcml2YXRlIF9oYXNQZXJtaXNzaW9uOiBib29sZWFuID0gZmFsc2VcclxuXHJcblx0XHRjb25zdHJ1Y3Rvcihwcml2YXRlIHZpZXc6IGFueSkge31cclxuXHJcblx0XHRwcml2YXRlIF9nZXQoa2V5KSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9zZXR0aW5nc1trZXldXHJcblx0XHR9XHJcblxyXG5cdFx0cHJpdmF0ZSBfc2V0KGtleTogc3RyaW5nLCB2YWw6IGFueSwgZm9yY2U6IGJvb2xlYW4gPSBmYWxzZSkge1xyXG5cdFx0XHRpZiAoIWZvcmNlICYmIHZhbCA9PT0gdGhpcy5fc2V0dGluZ3Nba2V5XSkge1xyXG5cdFx0XHRcdHJldHVyblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoa2V5IGluIHRoaXMuX3NldHRpbmdzKSB7XHJcblx0XHRcdFx0bGV0IHNhdmVkID0ge31cclxuXHRcdFx0XHRzYXZlZFtrZXldID0gdmFsXHJcblxyXG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gRXh0QVBJLmludm9rZSgnc2F2ZS1zZXR0aW5ncycsIHNhdmVkKSwgMTApXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX3NldHRpbmdzW2tleV0gPSB2YWxcclxuXHRcdH1cclxuXHJcblx0XHRnZXQgYWx3YXlzQ2VudGVyVGhlV2luZG93KCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0KCdhbHdheXNDZW50ZXJUaGVXaW5kb3cnKVxyXG5cdFx0fVxyXG5cdFx0c2V0IGFsd2F5c0NlbnRlclRoZVdpbmRvdyh2YWwpIHtcclxuXHRcdFx0dGhpcy5fc2V0KCdhbHdheXNDZW50ZXJUaGVXaW5kb3cnLCB2YWwpXHJcblx0XHR9XHJcblxyXG5cdFx0Z2V0IGxlZnRBbGlnbldpbmRvdygpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2dldCgnbGVmdEFsaWduV2luZG93JylcclxuXHRcdH1cclxuXHRcdHNldCBsZWZ0QWxpZ25XaW5kb3codmFsKSB7XHJcblx0XHRcdHRoaXMuX3NldCgnbGVmdEFsaWduV2luZG93JywgdmFsKVxyXG5cdFx0fVxyXG5cclxuXHRcdGdldCBoaWRlVG9vbHRpcERlbGF5KCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0KCdoaWRlVG9vbHRpcERlbGF5JylcclxuXHRcdH1cclxuXHRcdHNldCBoaWRlVG9vbHRpcERlbGF5KHZhbCkge1xyXG5cdFx0XHR0aGlzLl9zZXQoJ2hpZGVUb29sdGlwRGVsYXknLCBwYXJzZUludCh2YWwsIDEwKSlcclxuXHRcdH1cclxuXHJcblx0XHRnZXQgcG9wdXBJY29uU3R5bGUoKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9nZXQoJ3BvcHVwSWNvblN0eWxlJylcclxuXHRcdH1cclxuXHRcdHNldCBwb3B1cEljb25TdHlsZSh2YWwpIHtcclxuXHRcdFx0dGhpcy5fc2V0KCdwb3B1cEljb25TdHlsZScsIHZhbClcclxuXHRcdH1cclxuXHJcblx0XHRnZXQgcHJlc2V0c0ljb25zU3R5bGUoKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9nZXQoJ3ByZXNldHNJY29uc1N0eWxlJylcclxuXHRcdH1cclxuXHRcdHNldCBwcmVzZXRzSWNvbnNTdHlsZSh2YWwpIHtcclxuXHRcdFx0dGhpcy5fc2V0KCdwcmVzZXRzSWNvbnNTdHlsZScsIHZhbClcclxuXHRcdH1cclxuXHJcblx0XHRnZXQgYWx0ZXJuYXRlUHJlc2V0c0JnKCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0KCdhbHRlcm5hdGVQcmVzZXRzQmcnKVxyXG5cdFx0fVxyXG5cdFx0c2V0IGFsdGVybmF0ZVByZXNldHNCZyh2YWwpIHtcclxuXHRcdFx0dGhpcy5fc2V0KCdhbHRlcm5hdGVQcmVzZXRzQmcnLCB2YWwpXHJcblx0XHR9XHJcblxyXG5cdFx0Z2V0IGF1dG9DbG9zZVBvcHVwKCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0KCdhdXRvQ2xvc2VQb3B1cCcpXHJcblx0XHR9XHJcblx0XHRzZXQgYXV0b0Nsb3NlUG9wdXAodmFsKSB7XHJcblx0XHRcdHRoaXMuX3NldCgnYXV0b0Nsb3NlUG9wdXAnLCB2YWwpXHJcblx0XHR9XHJcblxyXG5cdFx0Z2V0IHByZXNldHNQcmltYXJ5TGluZSgpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2dldCgncHJlc2V0c1ByaW1hcnlMaW5lJylcclxuXHRcdH1cclxuXHRcdHNldCBwcmVzZXRzUHJpbWFyeUxpbmUodmFsKSB7XHJcblx0XHRcdHRoaXMuX3NldCgncHJlc2V0c1ByaW1hcnlMaW5lJywgdmFsKVxyXG5cdFx0fVxyXG5cclxuXHRcdGdldCBoaWRlUHJlc2V0c0Rlc2NyaXB0aW9uKCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0KCdoaWRlUHJlc2V0c0Rlc2NyaXB0aW9uJylcclxuXHRcdH1cclxuXHRcdHNldCBoaWRlUHJlc2V0c0Rlc2NyaXB0aW9uKHZhbCkge1xyXG5cdFx0XHR0aGlzLl9zZXQoJ2hpZGVQcmVzZXRzRGVzY3JpcHRpb24nLCB2YWwpXHJcblx0XHR9XHJcblxyXG5cdFx0Z2V0IGhpZGVQb3B1cFRvb2x0aXBzKCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0KCdoaWRlUG9wdXBUb29sdGlwcycpXHJcblx0XHR9XHJcblx0XHRzZXQgaGlkZVBvcHVwVG9vbHRpcHModmFsKSB7XHJcblx0XHRcdHRoaXMuX3NldCgnaGlkZVBvcHVwVG9vbHRpcHMnLCB2YWwpXHJcblx0XHR9XHJcblxyXG5cdFx0Z2V0IGhpZGVRdWlja1Jlc2l6ZSgpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2dldCgnaGlkZVF1aWNrUmVzaXplJylcclxuXHRcdH1cclxuXHRcdHNldCBoaWRlUXVpY2tSZXNpemUodmFsKSB7XHJcblx0XHRcdHRoaXMuX3NldCgnaGlkZVF1aWNrUmVzaXplJywgdmFsKVxyXG5cdFx0fVxyXG5cclxuXHRcdGdldCBhbHdheXNTaG93VGhlVG9vbHRpcCgpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2dldCgnYWx3YXlzU2hvd1RoZVRvb2x0aXAnKVxyXG5cdFx0fVxyXG5cdFx0c2V0IGFsd2F5c1Nob3dUaGVUb29sdGlwKHZhbCkge1xyXG5cdFx0XHRpZiAoIXZhbCkge1xyXG5cdFx0XHRcdHRoaXMuX3NldCgnYWx3YXlzU2hvd1RoZVRvb2x0aXAnLCBmYWxzZSlcclxuXHRcdFx0XHRyZXR1cm5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gdGVtcG9yYXJ5IHNldCB0aGUgdmFsdWUgdG8gdHJ1ZSwgc28gdGhlIGJpbmRpbmcgc3lzdGVtIGRvZXNuJ3QgcmV2ZXJ0IHRoZSBjaGVja2JveCB0byB1bi1jaGVja2VkXHJcblx0XHRcdHRoaXMuX3NldHRpbmdzLmFsd2F5c1Nob3dUaGVUb29sdGlwID0gdHJ1ZVxyXG5cclxuXHRcdFx0aWYgKHRoaXMuX2hhc1Blcm1pc3Npb24pIHtcclxuXHRcdFx0XHR0aGlzLl9zZXQoJ2Fsd2F5c1Nob3dUaGVUb29sdGlwJywgdmFsLCB0cnVlKVxyXG5cdFx0XHRcdHJldHVybiAvLyBwZXJtaXNzaW9ucyBoYXZlIGFscmVhZHkgYmVlbiBjaGVja2VkXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdEJyb3dzZXJQZXJtaXNzaW9ucy5jaGVjayhncmFudGVkID0+IHtcclxuXHRcdFx0XHRpZiAoZ3JhbnRlZCkge1xyXG5cdFx0XHRcdFx0dGhpcy5faGFzUGVybWlzc2lvbiA9IHRydWVcclxuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9zZXQoJ2Fsd2F5c1Nob3dUaGVUb29sdGlwJywgdmFsLCB0cnVlKVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0bGV0IHZpZXcgPSB0aGlzLnZpZXdcclxuXHRcdFx0XHRsZXQgYWN0aW9ucyA9IFtdXHJcblx0XHRcdFx0bGV0IHRpdGxlID0gJ0luc3VmZmljaWVudCBwZXJtaXNzaW9ucydcclxuXHRcdFx0XHRsZXQgbWVzc2FnZSA9IGBJbiBvcmRlciBmb3IgdGhlIGV4dGVuc2lvbiB0byBiZSBhYmxlIHRvIGF1dG9tYXRpY2FsbHkgc2hvdyB0aGUgdG9vbHRpcCBvbiBhbGwgb3BlbmVkIHBhZ2VzLFxyXG5cdFx0XHRcdGl0IG5lZWRzIHRvIGJlIGFibGUgdG8gaW5qZWN0IGN1c3RvbSBjb2RlIGluIHRoZSBjb250ZXh0IG9mIGFsbCBwYWdlcywgd2l0aG91dCB1c2VyIGludGVyYWN0aW9uLlxyXG5cdFx0XHRcdDxiciAvPjxiciAvPlxyXG5cdFx0XHRcdDxlbT5JZiB5b3UncmUgbm90IGNvbWZvcnRhYmxlIGdyYW50aW5nIHRob3NlIHBlcm1pc3Npb25zLCB5b3UgY2FuIGFsd2F5cyBtYW51YWxseSBlbmFibGUgdGhlIHRvb2x0aXAgZm9yIGFueVxyXG5cdFx0XHRcdGdpdmVuIHBhZ2UgZnJvbSB0aGUgZXh0ZW5zaW9uJ3MgcG9wdXAgbWVudTwvZW0+YFxyXG5cclxuXHRcdFx0XHRhY3Rpb25zLnB1c2goe1xyXG5cdFx0XHRcdFx0dGl0bGU6ICdDYW5jZWwnLFxyXG5cdFx0XHRcdFx0b25EaXNtaXNzOiB0cnVlLFxyXG5cdFx0XHRcdFx0aGFuZGxlcjogKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHR2aWV3LmRpc21pc3NNZXNzYWdlKClcclxuXHRcdFx0XHRcdFx0dGhpcy5hbHdheXNTaG93VGhlVG9vbHRpcCA9IGZhbHNlXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0pXHJcblxyXG5cdFx0XHRcdGFjdGlvbnMucHVzaCh7XHJcblx0XHRcdFx0XHR0aXRsZTogJ0dyYW50IHBlcm1pc3Npb25zJyxcclxuXHRcdFx0XHRcdG1haW46IHRydWUsXHJcblx0XHRcdFx0XHRoYW5kbGVyOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdHZpZXcuZGlzbWlzc01lc3NhZ2UoKVxyXG5cdFx0XHRcdFx0XHRCcm93c2VyUGVybWlzc2lvbnMucmVxdWVzdChncmFudGVkID0+IHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLmFsd2F5c1Nob3dUaGVUb29sdGlwID0gZ3JhbnRlZFxyXG5cdFx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9KVxyXG5cclxuXHRcdFx0XHR2aWV3LnNob3dNZXNzYWdlKHRpdGxlLCBtZXNzYWdlLCBhY3Rpb25zKVxyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Q29yZS5Db21wb25lbnRzLmNyZWF0ZSgnd3ItcGFnZS1zZXR0aW5ncycsIHtcclxuXHRcdHN0YXRpYzogW10sXHJcblx0XHRpbml0aWFsaXplOiAoZWwsIGRhdGEpID0+IG5ldyBQYWdlU2V0dGluZ3MoZWwsIGRhdGEpLFxyXG5cdH0pXHJcbn1cclxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uLy4uL3R5cGluZ3MvY29tbW9uLmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vLi4vdHlwaW5ncy9FeHRBUEkuZC50c1wiIC8+XHJcblxyXG5tb2R1bGUgVmlld3MuU2V0dGluZ3Mge1xyXG5cdGltcG9ydCBQcmVzZXQgPSBDb3JlLlByZXNldDtcclxuXHRpbXBvcnQgJCA9IENvcmUuVXRpbHMuRE9NO1xyXG5cclxuXHRkZWNsYXJlIHZhciBTb3J0YWJsZTogYW55O1xyXG5cdGRlY2xhcmUgdmFyIGRyYWd1bGE6IGFueTtcclxuXHJcblx0ZXhwb3J0IGNsYXNzIFBhZ2VQcmVzZXRzIGV4dGVuZHMgQ29yZS5DdXN0b21FbGVtZW50IHtcclxuXHRcdHB1YmxpYyBwYXJlbnQ6IGFueTsgLy8gVmlld3MuU2V0dGluZ3MuTWFpblZpZXc7XHJcblxyXG5cdFx0cHVibGljIHByZXNldHM6IFByZXNldFtdID0gIFtdO1xyXG5cdFx0cHVibGljIHRlbXBsYXRlOiBIVE1MRWxlbWVudDtcclxuXHJcblx0XHRjb25zdHJ1Y3Rvcihub2RlLCBkYXRhKSB7XHJcblx0XHRcdHN1cGVyKG5vZGUsIGRhdGEpO1xyXG5cclxuXHRcdFx0dGhpcy5wcmVzZXRFZGl0ID0gdGhpcy5wcmVzZXRFZGl0LmJpbmQodGhpcyk7XHJcblx0XHRcdHRoaXMucHJlc2V0RGVsZXRlID0gdGhpcy5wcmVzZXREZWxldGUuYmluZCh0aGlzKTtcclxuXHRcdH1cclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHQvL3RoaXMudGVtcGxhdGUgPSAkLnEoJy5wcmVzZXQtaXRlbScpO1xyXG5cclxuXHRcdFx0RXh0QVBJLmludm9rZSgnZ2V0LXByZXNldHMnKS50aGVuKHByZXNldHMgPT4ge1xyXG5cdFx0XHRcdGZvciAobGV0IHAgb2YgcHJlc2V0cykge1xyXG5cdFx0XHRcdFx0dGhpcy5wcmVzZXRzLnB1c2gobmV3IFByZXNldChwKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRTb3J0YWJsZS5jcmVhdGUoJC5xKCcjcHJlc2V0c1NvcnRMaXN0JyksIHtcclxuXHRcdFx0XHRcdGFuaW1hdGlvbjogMTUwLFxyXG5cdFx0XHRcdFx0Zm9yY2VGYWxsYmFjazogdHJ1ZSxcclxuXHRcdFx0XHRcdGZhbGxiYWNrT25Cb2R5OiB0cnVlLFxyXG5cdFx0XHRcdFx0aGFuZGxlOiAnd3ItcHJlc2V0JyxcclxuXHRcdFx0XHRcdGZhbGxiYWNrQ2xhc3M6ICdzb3J0YWJsZS1taXJyb3InLFxyXG5cdFx0XHRcdFx0b25FbmQ6IGV2dCA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChldnQubmV3SW5kZXggPT09IGV2dC5vbGRJbmRleCkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0bGV0IHByZXNldHMgPSB0aGlzLnByZXNldHMuc2xpY2UoKTtcclxuXHRcdFx0XHRcdFx0bGV0IHByZXNldCAgPSBwcmVzZXRzLnNwbGljZShldnQub2xkSW5kZXgsIDEpO1xyXG5cclxuXHRcdFx0XHRcdFx0bGV0IHZpZXdzID0gdGhpcy5wYXJlbnQuY3VycmVudFZpZXcuYmluZGluZ3NbMF0uaXRlcmF0ZWQ7XHJcblx0XHRcdFx0XHRcdGxldCB2aWV3ICA9IHZpZXdzLnNwbGljZShldnQub2xkSW5kZXgsIDEpO1xyXG5cclxuXHRcdFx0XHRcdFx0cHJlc2V0cy5zcGxpY2UoZXZ0Lm5ld0luZGV4LCAwLCBwcmVzZXRbMF0pO1xyXG5cdFx0XHRcdFx0XHR2aWV3cy5zcGxpY2UoZXZ0Lm5ld0luZGV4LCAwLCB2aWV3WzBdKTtcclxuXHJcblx0XHRcdFx0XHRcdF9yZWluZGV4KHZpZXdzKTtcclxuXHJcblx0XHRcdFx0XHRcdHRoaXMucHJlc2V0cyA9IHByZXNldHM7XHJcblxyXG5cdFx0XHRcdFx0XHRFeHRBUEkuaW52b2tlKCdzYXZlLXNldHRpbmdzJywge3ByZXNldHM6IHByZXNldHN9KTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRwcmVzZXRzRGVsZXRlKGV2dCwgY3R4KSB7XHJcblx0XHRcdGxldCB2aWV3ICAgID0gY3R4LnBhcmVudDtcclxuXHRcdFx0bGV0IGFjdGlvbnMgPSBbXTtcclxuXHRcdFx0bGV0IHRpdGxlICAgPSAnV2FybmluZyc7XHJcblx0XHRcdGxldCBtZXNzYWdlID0gYEFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgYWxsIHRoZSBleGlzdGluZyBwcmVzZXRzP2A7XHJcblxyXG5cdFx0XHRhY3Rpb25zLnB1c2goe3RpdGxlOiAnWWVzLCBJXFwnbSBzdXJlJywgbWFpbjogdHJ1ZSwgaGFuZGxlcjogKCkgPT4ge1xyXG5cdFx0XHRcdGN0eC5wcmVzZXRzID0gW107XHJcblx0XHRcdFx0RXh0QVBJLmludm9rZSgnc2F2ZS1zZXR0aW5ncycsIHtwcmVzZXRzOiBjdHgucHJlc2V0c30pO1xyXG5cdFx0XHRcdHZpZXcuZGlzbWlzc01lc3NhZ2UoKTtcclxuXHRcdFx0fX0pXHJcblx0XHRcdGFjdGlvbnMucHVzaCh7dGl0bGU6ICdObywgZG9uXFwndCBkbyBpdCcsIGhhbmRsZXI6ICgpID0+IHZpZXcuZGlzbWlzc01lc3NhZ2UoKX0pXHJcblxyXG5cdFx0XHR2aWV3LnNob3dNZXNzYWdlKHRpdGxlLCBtZXNzYWdlLCBhY3Rpb25zLCB7Y2xhc3M6ICdkYW5nZXInfSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cHJlc2V0c1Jlc2V0KGV2dCwgY3R4KSB7XHJcblx0XHRcdGNvbnN0IHJlc2V0ID0gKCkgPT4ge1xyXG5cdFx0XHRcdEV4dEFQSS5pbnZva2UoJ2RlZmF1bHQtc2V0dGluZ3MnKS50aGVuKGRlZmF1bHRzID0+IHtcclxuXHRcdFx0XHRcdGN0eC5wcmVzZXRzID0gW107XHJcblx0XHRcdFx0XHRjdHgucHJlc2V0cyA9IGRlZmF1bHRzLnByZXNldHM7XHJcblx0XHRcdFx0XHRyZXR1cm4gRXh0QVBJLmludm9rZSgnc2F2ZS1zZXR0aW5ncycsIHtwcmVzZXRzOiBkZWZhdWx0cy5wcmVzZXRzfSlcclxuXHRcdFx0XHR9KS5jYXRjaChlcnIgPT4gY29uc29sZS5sb2coZXJyKSlcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCFjdHgucHJlc2V0cyB8fCAhY3R4LnByZXNldHMubGVuZ3RoKSB7XHJcblx0XHRcdFx0cmV0dXJuIHJlc2V0KCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCB2aWV3ICAgID0gY3R4LnBhcmVudDtcclxuXHRcdFx0bGV0IGFjdGlvbnMgPSBbXTtcclxuXHRcdFx0bGV0IHRpdGxlICAgPSAnV2FybmluZyc7XHJcblx0XHRcdGxldCBtZXNzYWdlID0gYEFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byByZXBsYWNlIGFsbCB5b3VyIGV4aXN0aW5nIHByZXNldHMgd2l0aCB0aGUgZGVmYXVsdCBvbmVzP2A7XHJcblxyXG5cdFx0XHRhY3Rpb25zLnB1c2goe3RpdGxlOiAnWWVzLCBJXFwnbSBzdXJlJywgbWFpbjogdHJ1ZSwgaGFuZGxlcjogKCkgPT4ge1xyXG5cdFx0XHRcdHJlc2V0KCk7XHJcblx0XHRcdFx0dmlldy5kaXNtaXNzTWVzc2FnZSgpO1xyXG5cdFx0XHR9fSlcclxuXHRcdFx0YWN0aW9ucy5wdXNoKHt0aXRsZTogJ05vLCBkb25cXCd0IGRvIGl0JywgaGFuZGxlcjogKCkgPT4gdmlldy5kaXNtaXNzTWVzc2FnZSgpfSlcclxuXHJcblx0XHRcdHZpZXcuc2hvd01lc3NhZ2UodGl0bGUsIG1lc3NhZ2UsIGFjdGlvbnMsIHtjbGFzczogJ2Rhbmdlcid9KTtcclxuXHRcdH1cclxuXHJcblx0XHRwcmVzZXRBZGQoZXZ0LCBjdHgpIHtcclxuXHRcdFx0Y3R4LnBhcmVudC5zaG93U3ViUGFnZSgnd3ItcGFnZS1lZGl0LXByZXNldCcsICdhZGQnKTtcclxuXHRcdH1cclxuXHJcblx0XHRwcmVzZXRFZGl0KGV2dCwgY3R4KSB7XHJcblx0XHRcdGN0eC5wYXJlbnQuc2hvd1N1YlBhZ2UoJ3dyLXBhZ2UtZWRpdC1wcmVzZXQnLCBgZWRpdD0ke2N0eC5pdGVtLmlkfWApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHByZXNldERlbGV0ZShldnQsIGN0eCkge1xyXG5cdFx0XHRsZXQgaW5kZXggPSBjdHguaW5kZXg7XHJcblx0XHRcdGxldCB2aWV3cyA9IHRoaXMucGFyZW50LmN1cnJlbnRWaWV3LmJpbmRpbmdzWzBdLml0ZXJhdGVkO1xyXG5cdFx0XHRsZXQgbm9kZTogSFRNTEVsZW1lbnQgPSB2aWV3c1tpbmRleF0uZWxzWzBdO1xyXG5cclxuXHRcdFx0JC5hbmltYXRlKG5vZGUsICdwdWZmLW91dCcsICd0cmFuc2Zvcm0nKS50aGVuKG4gPT4ge1xyXG5cdFx0XHRcdCQuYW5pbWF0ZShub2RlLCAnY29sbGFwc2UnLCAnbWFyZ2luLXRvcCcpLnRoZW4obiA9PiB7XHJcblx0XHRcdFx0XHR2aWV3c1tpbmRleF0udW5iaW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0bm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xyXG5cclxuXHRcdFx0XHRcdHZpZXdzLnNwbGljZShpbmRleCwgMSk7XHJcblx0XHRcdFx0XHR0aGlzLnByZXNldHMuc3BsaWNlKGluZGV4LCAxKTtcclxuXHJcblx0XHRcdFx0XHRfcmVpbmRleCh2aWV3cyk7XHJcblxyXG5cdFx0XHRcdFx0RXh0QVBJLmludm9rZSgnc2F2ZS1zZXR0aW5ncycsIHtwcmVzZXRzOiB0aGlzLnByZXNldHN9KTtcclxuXHRcdFx0XHR9KVxyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdHByaXZhdGUgX3BlcmZvcm1VbmJvdW5kKGNhbGxiYWNrKTogYW55IHtcclxuXHRcdFx0bGV0IGJpbmRpbmcgPSB0aGlzLnBhcmVudC5jdXJyZW50VmlldzsvLy5iaW5kaW5nc1swXTtcclxuXHRcdFx0YmluZGluZy51bmJpbmQoKTtcclxuXHRcdFx0bGV0IHJlc3VsdCA9IGNhbGxiYWNrKCk7XHJcblx0XHRcdGJpbmRpbmcuYmluZCgpO1xyXG5cdFx0XHRiaW5kaW5nLnN5bmMoKTtcclxuXHJcblx0XHRcdC8vIGZvciAobGV0IHZpZXcgb2YgYmluZGluZy5pdGVyYXRlZCkge1xyXG5cdFx0XHQvLyBcdHZpZXcuc3luYygpO1xyXG5cdFx0XHQvLyB9XHJcblxyXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3JlaW5kZXgodmlld3M6IGFueVtdKTogdm9pZCB7XHJcblx0XHR2aWV3cy5mb3JFYWNoKCh2aWV3LCBpbmRleCkgPT4ge1xyXG5cdFx0XHR2aWV3Lm1vZGVscy5pbmRleCA9IGluZGV4O1xyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdENvcmUuQ29tcG9uZW50cy5jcmVhdGUoJ3dyLXBhZ2UtcHJlc2V0cycsIHtcclxuXHRcdHN0YXRpYzogW10sXHJcblx0XHRpbml0aWFsaXplOiAoZWwsIGRhdGEpID0+IG5ldyBQYWdlUHJlc2V0cyhlbCwgZGF0YSlcclxuXHR9KVxyXG59XHJcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi90eXBpbmdzL3JpdmV0cy5kLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uL3R5cGluZ3MvRXh0QVBJLmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy90YWItbmF2LmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9jb21tb24uZC50c1wiIC8+XHJcblxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9wYWdlcy9zZXR0aW5ncy50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3BhZ2VzL3ByZXNldHMudHNcIiAvPlxyXG5cclxubW9kdWxlIFZpZXdzLlNldHRpbmdzIHtcclxuXHRpbXBvcnQgTW9kYWxNZXNzYWdlID0gVmlld3MuQ29tbW9uLk1vZGFsTWVzc2FnZVxyXG5cdGltcG9ydCBNb2RhbE1lc3NhZ2VBY3Rpb24gPSBWaWV3cy5Db21tb24uTW9kYWxNZXNzYWdlQWN0aW9uXHJcblxyXG5cdGltcG9ydCAkID0gQ29yZS5VdGlscy5ET01cclxuXHJcblx0ZXhwb3J0IGNsYXNzIFNldHRpbmdzVmlldyB7XHJcblx0XHRwdWJsaWMgc2VsZWN0ZWQ6IGJvb2xlYW4gPSBmYWxzZVxyXG5cclxuXHRcdGNvbnN0cnVjdG9yKHB1YmxpYyBpZDogc3RyaW5nLCBwdWJsaWMgdGl0bGU6IHN0cmluZywgcHVibGljIGVsZW1lbnQ6IHN0cmluZykge31cclxuXHR9XHJcblxyXG5cdGV4cG9ydCBjbGFzcyBNYWluVmlldyB7XHJcblx0XHRtZW51OiBTZXR0aW5nc1ZpZXdbXSA9IFtcclxuXHRcdFx0bmV3IFNldHRpbmdzVmlldygnI3NldHRpbmdzJywgJ3NldHRpbmdzJywgJ3dyLXBhZ2Utc2V0dGluZ3MnKSxcclxuXHRcdFx0bmV3IFNldHRpbmdzVmlldygnI3ByZXNldHMnLCAncHJlc2V0cycsICd3ci1wYWdlLXByZXNldHMnKSxcclxuXHRcdFx0bmV3IFNldHRpbmdzVmlldygnI2hvdGtleXMnLCAnaG90a2V5cycsICd3ci1wYWdlLWhvdGtleXMnKSxcclxuXHRcdFx0bmV3IFNldHRpbmdzVmlldygnI3N5bmMnLCAnc3luYycsICd3ci1wYWdlLXN5bmMnKSxcclxuXHRcdFx0bmV3IFNldHRpbmdzVmlldygnI2hlbHAnLCAnYWJvdXQnLCAnd3ItcGFnZS1oZWxwJyksXHJcblx0XHRdXHJcblxyXG5cdFx0cm91dGVzOiBTZXR0aW5nc1ZpZXdbXSA9IFtcclxuXHRcdFx0bmV3IFNldHRpbmdzVmlldygnI2hlbHAvcmVsZWFzZS1ub3RlcycsICdyZWxlYXNlLW5vdGVzJywgJ3dyLXBhZ2UtcmVsZWFzZS1ub3RlcycpLFxyXG5cdFx0XHRuZXcgU2V0dGluZ3NWaWV3KCcjcHJvJywgJ3BybycsICd3ci1wYWdlLXBybycpLFxyXG5cdFx0XVxyXG5cclxuXHRcdGN1cnJlbnRWaWV3OiBhbnkgLy8gcml2ZXRzLl8uVmlld1xyXG5cdFx0c2VsZWN0ZWRWaWV3OiBTZXR0aW5nc1ZpZXdcclxuXHRcdGN1cnJlbnRNZXNzYWdlOiBNb2RhbE1lc3NhZ2VcclxuXHJcblx0XHRsaWNlbnNlOiBhbnkgPSBudWxsXHJcblx0XHRwcmVzZXRzSWNvbnNTdHlsZTogc3RyaW5nID0gJydcclxuXHJcblx0XHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdFx0dGhpcy5uYXZpZ2F0ZVRvID0gdGhpcy5uYXZpZ2F0ZVRvLmJpbmQodGhpcylcclxuXHRcdFx0dGhpcy5oYW5kbGVOYXZpZ2F0ZVRvVGFiID0gdGhpcy5oYW5kbGVOYXZpZ2F0ZVRvVGFiLmJpbmQodGhpcylcclxuXHJcblx0XHRcdHRoaXMuc2hvd01lc3NhZ2UgPSB0aGlzLnNob3dNZXNzYWdlLmJpbmQodGhpcylcclxuXHRcdFx0dGhpcy5kaXNtaXNzTWVzc2FnZSA9IHRoaXMuZGlzbWlzc01lc3NhZ2UuYmluZCh0aGlzKVxyXG5cclxuXHRcdFx0RXh0QVBJLmludm9rZSgnZ2V0LXNldHRpbmdzJylcclxuXHRcdFx0XHQudGhlbihzZXR0aW5ncyA9PiB7XHJcblx0XHRcdFx0XHR0aGlzLmxpY2Vuc2UgPSBzZXR0aW5ncy5saWNlbnNlXHJcblx0XHRcdFx0XHR0aGlzLnByZXNldHNJY29uc1N0eWxlID0gc2V0dGluZ3MucHJlc2V0c0ljb25zU3R5bGVcclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gRXh0QVBJLmludm9rZSgnc2V0dGluZ3M6cmVxdWVzdGVkLXBhZ2UnKVxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdFx0LnRoZW4odXJsID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuX3Nob3dWaWV3KHVybCkgfHwgdGhpcy5zaG93Vmlldyh0aGlzLm1lbnVbMF0pXHJcblx0XHRcdFx0XHQvLyB0aGlzLnNob3dWaWV3KHRoaXMuX3ZpZXcoJyNwcm8nKSk7XHJcblx0XHRcdFx0fSlcclxuXHJcblx0XHRcdGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobXNnLCBzZW5kZXIsIHJlc3BvbmQpID0+IHtcclxuXHRcdFx0XHRpZiAobXNnICYmIG1zZy5zaG93UGFnZSkge1xyXG5cdFx0XHRcdFx0bGV0IHZpZXcgPSB0aGlzLl9zaG93Vmlldyhtc2cuc2hvd1BhZ2UpXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAobXNnICYmIG1zZy5VcGRhdGVkU2V0dGluZ3MpIHtcclxuXHRcdFx0XHRcdGlmICgnbGljZW5zZScgaW4gbXNnLlVwZGF0ZWRTZXR0aW5ncykge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmxpY2Vuc2UgPSBtc2cuVXBkYXRlZFNldHRpbmdzLmxpY2Vuc2VcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoJ3ByZXNldHNJY29uc1N0eWxlJyBpbiBtc2cuVXBkYXRlZFNldHRpbmdzKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucHJlc2V0c0ljb25zU3R5bGUgPSBtc2cuVXBkYXRlZFNldHRpbmdzLnByZXNldHNJY29uc1N0eWxlXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdF9zaG93Vmlldyh1cmw6IHN0cmluZykge1xyXG5cdFx0XHRsZXQgW3BhZ2UsIC4uLmFyZ3NdID0gKHVybCB8fCAnJykuc3BsaXQoJy8nKVxyXG5cdFx0XHRsZXQgdmlldyA9IHRoaXMuX3ZpZXcodXJsKSB8fCB0aGlzLl92aWV3KHBhZ2UpXHJcblx0XHRcdGxldCBwYXJhbXMgPSAnJ1xyXG5cclxuXHRcdFx0aWYgKGFyZ3MgJiYgYXJncy5sZW5ndGgpIHtcclxuXHRcdFx0XHRwYXJhbXMgPSBhcmdzLmpvaW4oJy8nKVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2aWV3ICYmIHRoaXMuc2hvd1ZpZXcodmlldywgcGFyYW1zKVxyXG5cclxuXHRcdFx0cmV0dXJuIHZpZXdcclxuXHRcdH1cclxuXHJcblx0XHRzaG93Vmlldyh2aWV3OiBTZXR0aW5nc1ZpZXcsIHBhcmFtczogc3RyaW5nID0gJycpIHtcclxuXHRcdFx0dGhpcy5zZWxlY3RlZFZpZXcgPSB2aWV3XHJcblx0XHRcdHBhcmFtcyA9IHBhcmFtcyB8fCAnJ1xyXG5cclxuXHRcdFx0Zm9yIChsZXQgaXRlbSBvZiB0aGlzLm1lbnUpIHtcclxuXHRcdFx0XHRpdGVtLnNlbGVjdGVkID0gdmlldy5pZC5pbmRleE9mKGl0ZW0uaWQpID09PSAwXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCQuaGlkZSgnI2NvbnRlbnQnKS50aGVuKF8gPT4ge1xyXG5cdFx0XHRcdHRoaXMuY3VycmVudFZpZXcgJiYgdGhpcy5jdXJyZW50Vmlldy51bmJpbmQoKVxyXG5cdFx0XHRcdHRoaXMuY3VycmVudFZpZXcgPSByaXZldHMuaW5pdCh2aWV3LmVsZW1lbnQsIG51bGwsIHsgcGFyZW50OiB0aGlzIH0pXHJcblxyXG5cdFx0XHRcdGxldCBtb2RlbCA9IHRoaXMuY3VycmVudFZpZXcubW9kZWxzXHJcblxyXG5cdFx0XHRcdHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gYCR7dmlldy5pZH0vJHtwYXJhbXN9YFxyXG5cclxuXHRcdFx0XHQkLmVtcHR5KCcjY29udGVudCcpXHJcblx0XHRcdFx0JC5xKCcjY29udGVudCcpLmFwcGVuZENoaWxkKHRoaXMuY3VycmVudFZpZXcuZWxzWzBdKVxyXG5cdFx0XHRcdG1vZGVsLmluaXQgJiYgbW9kZWwuaW5pdCgpXHJcblx0XHRcdFx0JC5zaG93KCcjY29udGVudCcpXHJcblx0XHRcdH0pXHJcblx0XHR9XHJcblxyXG5cdFx0c2hvd1N1YlBhZ2UoZWxlbWVudDogc3RyaW5nLCBpZDogc3RyaW5nKSB7XHJcblx0XHRcdHRoaXMuc2hvd1ZpZXcobmV3IFNldHRpbmdzVmlldyhgJHt0aGlzLnNlbGVjdGVkVmlldy5pZH0vJHtpZH1gLCBpZCwgZWxlbWVudCkpXHJcblx0XHR9XHJcblxyXG5cdFx0bmF2aWdhdGVUbyhldnQsIGN0eCkge1xyXG5cdFx0XHRsZXQgaXRlbSA9IGN0eC5pdGVtXHJcblxyXG5cdFx0XHRpZiAoIWl0ZW0pIHtcclxuXHRcdFx0XHRsZXQgdGFyZ2V0ID0gZXZ0LnRhcmdldFxyXG5cdFx0XHRcdHdoaWxlICh0YXJnZXQgJiYgIXRhcmdldC5tYXRjaGVzKCdhLCBidXR0b24nKSkge1xyXG5cdFx0XHRcdFx0dGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICh0YXJnZXQpIHtcclxuXHRcdFx0XHRcdGl0ZW0gPSB0aGlzLl92aWV3KHRhcmdldC5oYXNoIHx8IHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaGFzaCcpKVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5zaG93VmlldyhpdGVtKVxyXG5cdFx0fVxyXG5cclxuXHRcdGhhbmRsZU5hdmlnYXRlVG9UYWIoZXZ0LCBjdHgpIHtcclxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KClcclxuXHRcdFx0dGhpcy5uYXZpZ2F0ZVRvVGFiKGV2dC50YXJnZXQpXHJcblx0XHR9XHJcblxyXG5cdFx0bmF2aWdhdGVUb1RhYih0YXJnZXQpIHtcclxuXHRcdFx0aWYgKHRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ3NlbGVjdGVkJykpIHtcclxuXHRcdFx0XHRyZXR1cm5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IGN1cnJlbnQgPSA8SFRNTEFuY2hvckVsZW1lbnQ+JC5xKCcuc2VsZWN0ZWQnLCB0YXJnZXQucGFyZW50Tm9kZSlcclxuXHRcdFx0bGV0IHNob3dOZXh0ID0gKCkgPT4ge1xyXG5cdFx0XHRcdCQuYWRkQ2xhc3ModGFyZ2V0LCAnc2VsZWN0ZWQnKVxyXG5cdFx0XHRcdCQuYWRkQ2xhc3ModGFyZ2V0Lmhhc2gsICd2aXNpYmxlJylcclxuXHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcclxuXHRcdFx0XHRcdCQuYWRkQ2xhc3ModGFyZ2V0Lmhhc2gsICdzZWxlY3RlZCcpXHJcblx0XHRcdFx0fSwgMSlcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCFjdXJyZW50KSB7XHJcblx0XHRcdFx0cmV0dXJuIHNob3dOZXh0KClcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JC5yZW1vdmVDbGFzcyhjdXJyZW50LCAnc2VsZWN0ZWQnKVxyXG5cdFx0XHQkLmhpZGUoY3VycmVudC5oYXNoLCAnc2VsZWN0ZWQnKS50aGVuKF8gPT4ge1xyXG5cdFx0XHRcdCQucmVtb3ZlQ2xhc3MoY3VycmVudC5oYXNoLCAndmlzaWJsZScpXHJcblx0XHRcdFx0c2hvd05leHQoKVxyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdHNob3dNZXNzYWdlKHRpdGxlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZywgYWN0aW9ucz86IE1vZGFsTWVzc2FnZUFjdGlvbltdLCBvcHRpb25zOiBhbnkgPSB7fSkge1xyXG5cdFx0XHRpZiAoIWFjdGlvbnMgfHwgYWN0aW9ucy5sZW5ndGggPT09IDApIHtcclxuXHRcdFx0XHRhY3Rpb25zID0gW3sgdGl0bGU6ICdPSycsIG9uRGlzbWlzczogdHJ1ZSwgaGFuZGxlcjogdGhpcy5kaXNtaXNzTWVzc2FnZSB9XVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmN1cnJlbnRNZXNzYWdlID0gbmV3IE1vZGFsTWVzc2FnZSh0aXRsZSwgbWVzc2FnZSwgZmFsc2UsIGFjdGlvbnMsIG9wdGlvbnMpXHJcblx0XHR9XHJcblxyXG5cdFx0ZGlzbWlzc01lc3NhZ2UoKSB7XHJcblx0XHRcdHRoaXMuY3VycmVudE1lc3NhZ2UuaGlkZSgpLnRoZW4oeCA9PiB7XHJcblx0XHRcdFx0dGhpcy5jdXJyZW50TWVzc2FnZSA9IG51bGxcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRfdmlldyhpZDogc3RyaW5nKTogU2V0dGluZ3NWaWV3IHtcclxuXHRcdFx0bGV0IHJvdXRlcyA9IHRoaXMubWVudS5jb25jYXQodGhpcy5yb3V0ZXMpXHJcblxyXG5cdFx0XHRmb3IgKGxldCB2aWV3IG9mIHJvdXRlcykge1xyXG5cdFx0XHRcdGlmICh2aWV3LmlkID09PSBpZCkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHZpZXdcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBudWxsXHJcblx0XHR9XHJcblxyXG5cdFx0X2xvZyhlcnI6IGFueSkge1xyXG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRleHBvcnQgdmFyIG1haW5WaWV3ID0gbmV3IE1haW5WaWV3KClcclxuXHRleHBvcnQgdmFyIG1vZGVsID0gcml2ZXRzLmJpbmQoZG9jdW1lbnQuYm9keSwgbWFpblZpZXcpXHJcbn1cclxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uLy4uL3R5cGluZ3MvY29tbW9uLmQudHNcIiAvPlxyXG5cclxubW9kdWxlIFZpZXdzLlNldHRpbmdzIHtcclxuXHRleHBvcnQgY2xhc3MgVGFiQ29udGVudCBleHRlbmRzIENvcmUuQ3VzdG9tRWxlbWVudCB7XHJcblx0XHRjb25zdHJ1Y3Rvcihub2RlLCBkYXRhKSB7XHJcblx0XHRcdHN1cGVyKG5vZGUsIGRhdGEpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Q29yZS5Db21wb25lbnRzLmNyZWF0ZSgnd3ItdGFiLWNvbnRlbnQnLCB7XHJcblx0XHRzdGF0aWM6IFtdLFxyXG5cdFx0aW5pdGlhbGl6ZTogKGVsLCBkYXRhKSA9PiBuZXcgVGFiQ29udGVudChlbCwgZGF0YSlcclxuXHR9KVxyXG59XHJcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi8uLi90eXBpbmdzL2NvbW1vbi5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBWaWV3cy5TZXR0aW5ncyB7XHJcblx0ZXhwb3J0IGNsYXNzIFRhYkdyb3VwIGV4dGVuZHMgQ29yZS5DdXN0b21FbGVtZW50IHtcclxuXHRcdGNvbnN0cnVjdG9yKG5vZGUsIGRhdGEpIHtcclxuXHRcdFx0c3VwZXIobm9kZSwgZGF0YSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRDb3JlLkNvbXBvbmVudHMuY3JlYXRlKCd3ci10YWItZ3JvdXAnLCB7XHJcblx0XHRzdGF0aWM6IFtdLFxyXG5cdFx0aW5pdGlhbGl6ZTogKGVsLCBkYXRhKSA9PiBuZXcgVGFiR3JvdXAoZWwsIGRhdGEpXHJcblx0fSlcclxufVxyXG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vLi4vdHlwaW5ncy9jb21tb24uZC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi8uLi90eXBpbmdzL0V4dEFQSS5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBWaWV3cy5TZXR0aW5ncyB7XHJcblx0aW1wb3J0ICQgPSBDb3JlLlV0aWxzLkRPTTtcclxuXHRpbXBvcnQgUHJlc2V0ID0gQ29yZS5QcmVzZXQ7XHJcblx0aW1wb3J0IFByZXNldFR5cGUgPSBDb3JlLlByZXNldFR5cGU7XHJcblx0aW1wb3J0IFByZXNldFRhcmdldCA9IENvcmUuUHJlc2V0VGFyZ2V0O1xyXG5cdGltcG9ydCBQcmVzZXRQb3NpdGlvbiA9IENvcmUuUHJlc2V0UG9zaXRpb247XHJcblxyXG5cdGltcG9ydCBGb3JtYXRJbnRlZ2VyID0gQ29yZS5Gb3JtYXR0ZXJzLlRvSW50O1xyXG5cclxuXHRleHBvcnQgY2xhc3MgUGFnZUVkaXRQcmVzZXQgZXh0ZW5kcyBDb3JlLkN1c3RvbUVsZW1lbnQge1xyXG5cdFx0cHVibGljIHBhcmVudDogYW55OyAvLyBWaWV3cy5TZXR0aW5ncy5NYWluVmlldztcclxuXHJcblx0XHRwdWJsaWMgdGl0bGU6IHN0cmluZyA9ICdhZGQgcHJlc2V0JztcclxuXHRcdHB1YmxpYyBpZDogc3RyaW5nO1xyXG5cclxuXHRcdHB1YmxpYyBwcmVzZXQ6IFByZXNldCA9IG5ldyBQcmVzZXQoe30pO1xyXG5cclxuXHRcdHB1YmxpYyBmb3JtRXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5vZGUsIGRhdGEpIHtcclxuXHRcdFx0c3VwZXIobm9kZSwgZGF0YSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0bGV0IHBhcmFtcyA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLm1hdGNoKC9lZGl0PShbXlxcL10rKS8pO1xyXG5cdFx0XHR0aGlzLmlkID0gcGFyYW1zID8gcGFyYW1zWzFdIDogJyc7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5pZCkge1xyXG5cdFx0XHRcdHRoaXMudGl0bGUgPSAnZWRpdCBwcmVzZXQnO1xyXG5cclxuXHRcdFx0XHRFeHRBUEkuaW52b2tlKCdnZXQtcHJlc2V0cycpLnRoZW4ocHJlc2V0cyA9PiB7XHJcblx0XHRcdFx0XHRsZXQgZGF0YSA9IHByZXNldHMuZmluZChpdGVtID0+IGl0ZW0uaWQgPT09IHRoaXMuaWQpO1xyXG5cdFx0XHRcdFx0dGhpcy5wcmVzZXQgPSBuZXcgUHJlc2V0KGRhdGEpO1xyXG5cdFx0XHRcdFx0dGhpcy5jdXN0b21Qb3NpdGlvbiA9IHRoaXMucHJlc2V0LnBvc2l0aW9uO1xyXG5cdFx0XHRcdFx0dGhpcy5jdXN0b21JY29uID0gdGhpcy5wcmVzZXQudHlwZTtcclxuXHRcdFx0XHR9KVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dXNlQ3VycmVudFNpemUoZXZ0LCBjdHgpIHtcclxuXHRcdFx0Y2hyb21lLndpbmRvd3MuZ2V0Q3VycmVudCh7cG9wdWxhdGU6IHRydWV9LCB3aW4gPT4ge1xyXG5cdFx0XHRcdGxldCB0YWI6IGFueSA9IHdpbi50YWJzLmZpbHRlcih0YWIgPT4gdGFiLmFjdGl2ZSkucG9wKCk7XHJcblxyXG5cdFx0XHRcdGlmIChjdHgucHJlc2V0LnRhcmdldCA9PSAxKSB7XHJcblx0XHRcdFx0XHRjdHgucHJlc2V0LndpZHRoICA9IHRhYi53aWR0aDtcclxuXHRcdFx0XHRcdGN0eC5wcmVzZXQuaGVpZ2h0ID0gdGFiLmhlaWdodDtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y3R4LnByZXNldC53aWR0aCAgPSB3aW4ud2lkdGg7XHJcblx0XHRcdFx0XHRjdHgucHJlc2V0LmhlaWdodCA9IHdpbi5oZWlnaHQ7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdHVzZUN1cnJlbnRQb3NpdGlvbihldnQsIGN0eCkge1xyXG5cdFx0XHRjaHJvbWUud2luZG93cy5nZXRDdXJyZW50KHdpbiA9PiB7XHJcblx0XHRcdFx0Y3R4LmN1c3RvbVBvc2l0aW9uID0gUHJlc2V0UG9zaXRpb24uQ1VTVE9NO1xyXG5cclxuXHRcdFx0XHRjdHgucHJlc2V0LmxlZnQgPSB3aW4ubGVmdDtcclxuXHRcdFx0XHRjdHgucHJlc2V0LnRvcCAgPSB3aW4udG9wO1xyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdGdldCBhbGxvd0N1c3RvbVBvc2l0aW9uKCk6IGJvb2xlYW4ge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5wcmVzZXQucG9zaXRpb24gPT09IFByZXNldFBvc2l0aW9uLkNVU1RPTTtcclxuXHRcdH1cclxuXHJcblx0XHRzZXQgYWxsb3dDdXN0b21Qb3NpdGlvbihuZXdWYWx1ZSkge1xyXG5cdFx0XHQvLyBwbGFjZWhvbGRlciBzZXR0ZXJcclxuXHRcdH1cclxuXHJcblx0XHRnZXQgY3VzdG9tUG9zaXRpb24oKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLnByZXNldC5wb3NpdGlvbjtcclxuXHRcdH1cclxuXHJcblx0XHRzZXQgY3VzdG9tUG9zaXRpb24obmV3VmFsdWU6IGFueSkge1xyXG5cdFx0XHRuZXdWYWx1ZSA9IHBhcnNlSW50KG5ld1ZhbHVlLCAxMCk7XHJcblx0XHRcdHRoaXMucHJlc2V0LnBvc2l0aW9uID0gbmV3VmFsdWU7XHJcblxyXG5cdFx0XHRpZiAobmV3VmFsdWUgIT09IFByZXNldFBvc2l0aW9uLkNVU1RPTSkge1xyXG5cdFx0XHRcdHRoaXMucHJlc2V0LmxlZnQgPSBudWxsO1xyXG5cdFx0XHRcdHRoaXMucHJlc2V0LnRvcCAgPSBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmFsbG93Q3VzdG9tUG9zaXRpb24gPSBuZXdWYWx1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRnZXQgY3VzdG9tSWNvbigpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMucHJlc2V0LnR5cGU7XHJcblx0XHR9XHJcblxyXG5cdFx0c2V0IGN1c3RvbUljb24obmV3VmFsdWU6IGFueSkge1xyXG5cdFx0XHRuZXdWYWx1ZSA9IHBhcnNlSW50KG5ld1ZhbHVlLCAxMCk7XHJcblx0XHRcdHRoaXMucHJlc2V0LnR5cGUgPSBuZXdWYWx1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRjYW5jZWwoZXZ0LCBjdHgpIHtcclxuXHRcdFx0Y3R4LnBhcmVudC5zaG93VmlldyhjdHgucGFyZW50Lm1lbnVbMV0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNhdmVQcmVzZXQoZXZ0LCBjdHgpIHtcclxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRsZXQgcHJlc2V0ID0gY3R4LnByZXNldDtcclxuXHJcblx0XHRcdGN0eC5mb3JtRXJyb3JzID0gW107XHJcblxyXG5cdFx0XHRpZiAocHJlc2V0LndpZHRoID09PSBudWxsICYmIHByZXNldC5oZWlnaHQgPT09IG51bGwpIHtcclxuXHRcdFx0XHRjdHguZm9ybUVycm9ycy5wdXNoKCdZb3UgbXVzdCBwcm92aWRlIGF0IGxlYXN0IG9uZSBvZiB0aGUgd2lkdGggYW5kIGhlaWdodCB2YWx1ZXMhJyk7XHJcblx0XHRcdFx0JC5xKCcjY29udGVudCcpLnNjcm9sbFRvcCA9IDA7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChjdHguZm9ybUVycm9ycy5sZW5ndGgpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdEV4dEFQSS5pbnZva2UoJ3NhdmUtcHJlc2V0JywgcHJlc2V0KS50aGVuKGRhdGEgPT4ge1xyXG5cdFx0XHRcdGN0eC5wYXJlbnQuc2hvd1ZpZXcoY3R4LnBhcmVudC5tZW51WzFdKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRDb3JlLkNvbXBvbmVudHMuY3JlYXRlKCd3ci1wYWdlLWVkaXQtcHJlc2V0Jywge1xyXG5cdFx0c3RhdGljOiBbXSxcclxuXHRcdGluaXRpYWxpemU6IChlbCwgZGF0YSkgPT4gbmV3IFBhZ2VFZGl0UHJlc2V0KGVsLCBkYXRhKVxyXG5cdH0pXHJcbn1cclxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uLy4uL3R5cGluZ3MvY29tbW9uLmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vLi4vdHlwaW5ncy9FeHRBUEkuZC50c1wiIC8+XHJcblxyXG5tb2R1bGUgVmlld3MuU2V0dGluZ3Mge1xyXG5cdGV4cG9ydCBjbGFzcyBQYWdlSGVscCBleHRlbmRzIENvcmUuQ3VzdG9tRWxlbWVudCB7XHJcblx0XHRwdWJsaWMgZnJpZW5kbHlWZXJzaW9uOiBzdHJpbmdcclxuXHRcdHB1YmxpYyBjb21wbGV0ZVZlcnNpb246IHN0cmluZ1xyXG5cdFx0cHVibGljIGRlYnVnTG9nOiBzdHJpbmdcclxuXHJcblx0XHRjb25zdHJ1Y3Rvcihub2RlLCBkYXRhKSB7XHJcblx0XHRcdHN1cGVyKG5vZGUsIGRhdGEpXHJcblx0XHR9XHJcblxyXG5cdFx0YXN5bmMgaW5pdCgpIHtcclxuXHRcdFx0bGV0IGNvbmZpZzogYW55ID0gY2hyb21lLnJ1bnRpbWUuZ2V0TWFuaWZlc3QoKVxyXG5cclxuXHRcdFx0dGhpcy5mcmllbmRseVZlcnNpb24gPSBjb25maWcudmVyc2lvbl9uYW1lIHx8IGNvbmZpZy52ZXJzaW9uXHJcblx0XHRcdHRoaXMuY29tcGxldGVWZXJzaW9uID0gY29uZmlnLnZlcnNpb25fbmFtZSA/IGAoJHtjb25maWcudmVyc2lvbn0pYCA6ICcnXHJcblxyXG5cdFx0XHRjb25zdCBmbGFncyA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgnZGVidWdMb2cnKVxyXG5cclxuXHRcdFx0bGV0IGxvZyA9IGZsYWdzLmRlYnVnTG9nIHx8IFtdXHJcblxyXG5cdFx0XHR0aGlzLmRlYnVnTG9nID0gbG9nLmxlbmd0aCA/IEpTT04uc3RyaW5naWZ5KGxvZywgbnVsbCwgNCkgOiBudWxsXHJcblx0XHR9XHJcblxyXG5cdFx0c2hvd1JlbGVhc2VOb3RlcyhldnQsIGN0eCkge1xyXG5cdFx0XHRjdHgucGFyZW50LnNob3dTdWJQYWdlKCd3ci1wYWdlLXJlbGVhc2Utbm90ZXMnLCAncmVsZWFzZS1ub3RlcycpXHJcblx0XHR9XHJcblxyXG5cdFx0c2hvd0RlYnVnTG9nKGV2dCwgY3R4KSB7XHJcblx0XHRcdGN0eC5wYXJlbnQuc2hvd01lc3NhZ2UoJ0Vycm9ycyBsb2cnLCBgPHByZT4ke2N0eC5kZWJ1Z0xvZ308L3ByZT5gLCBudWxsLCB7IGNsYXNzOiAnZGFuZ2VyJyB9KVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Q29yZS5Db21wb25lbnRzLmNyZWF0ZSgnd3ItcGFnZS1oZWxwJywge1xyXG5cdFx0c3RhdGljOiBbXSxcclxuXHRcdGluaXRpYWxpemU6IChlbCwgZGF0YSkgPT4gbmV3IFBhZ2VIZWxwKGVsLCBkYXRhKSxcclxuXHR9KVxyXG59XHJcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi8uLi90eXBpbmdzL2NvbW1vbi5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBWaWV3cy5TZXR0aW5ncyB7XHJcblx0aW1wb3J0ICQgPSBDb3JlLlV0aWxzLkRPTTtcclxuXHJcblx0ZXhwb3J0IGNsYXNzIFBhZ2VIb3RrZXlzIGV4dGVuZHMgQ29yZS5DdXN0b21FbGVtZW50IHtcclxuXHRcdHB1YmxpYyBwYXJlbnQ6IGFueTsgLy8gVmlld3MuU2V0dGluZ3MuTWFpblZpZXc7XHJcblxyXG5cdFx0cHVibGljIGtleV9TaG93UG9wdXA6IHN0cmluZyA9ICc8bm90IHNldD4nO1xyXG5cdFx0cHVibGljIGtleV9Ub2dnbGVUb29sdGlwOiBzdHJpbmcgPSAnPG5vdCBzZXQ+JztcclxuXHRcdHB1YmxpYyBrZXlfQ3ljbGVQcmVzZXRzOiBzdHJpbmcgPSAnPG5vdCBzZXQ+JztcclxuXHRcdHB1YmxpYyBrZXlfQ3ljbGVQcmVzZXRzUmV2OiBzdHJpbmcgPSAnPG5vdCBzZXQ+JztcclxuXHJcblx0XHRwdWJsaWMgZ2xvYmFsU2hvcnRjdXRzOiBjaHJvbWUuY29tbWFuZHMuQ29tbWFuZFtdO1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5vZGUsIGRhdGEpIHtcclxuXHRcdFx0c3VwZXIobm9kZSwgZGF0YSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0dGhpcy5wYXJlbnQubmF2aWdhdGVUb1RhYigkLnEoJy50YWItbmF2IGEnKSk7XHJcblxyXG5cdFx0XHRjaHJvbWUuY29tbWFuZHMuZ2V0QWxsKGNvbW1hbmRzID0+IHRoaXMuZ2xvYmFsU2hvcnRjdXRzID0gY29tbWFuZHMpXHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdGNvbmZpZ3VyZVNob3J0Y3V0cygpIHtcclxuXHRcdFx0Y2hyb21lLnRhYnMuY3JlYXRlKHtcclxuXHRcdFx0XHR1cmwgOiAnY2hyb21lOi8vZXh0ZW5zaW9ucy9zaG9ydGN1dHMnLFxyXG5cdFx0XHRcdGFjdGl2ZSA6IHRydWVcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdENvcmUuQ29tcG9uZW50cy5jcmVhdGUoJ3dyLXBhZ2UtaG90a2V5cycsIHtcclxuXHRcdHN0YXRpYzogW10sXHJcblx0XHRpbml0aWFsaXplOiAoZWwsIGRhdGEpID0+IG5ldyBQYWdlSG90a2V5cyhlbCwgZGF0YSlcclxuXHR9KVxyXG59XHJcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi8uLi90eXBpbmdzL2NvbW1vbi5kLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi8uLi90eXBpbmdzL0V4dEFQSS5kLnRzXCIgLz5cblxubW9kdWxlIFZpZXdzLlNldHRpbmdzIHtcblx0ZXhwb3J0IGNsYXNzIFBhZ2VQcm8gZXh0ZW5kcyBDb3JlLkN1c3RvbUVsZW1lbnQge1xuXHRcdHB1YmxpYyBwYXJlbnQ6IGFueTsgLy8gVmlld3MuU2V0dGluZ3MuTWFpblZpZXc7XG5cblx0XHRwdWJsaWMgZGVmYXVsdFByaWNlOiBudW1iZXIgPSA0O1xuXHRcdHB1YmxpYyBwYXlBbW91bnQ6IG51bWJlciA9IDQ7XG5cdFx0cHVibGljIG1pbkFtb3VudDogbnVtYmVyID0gMztcblx0XHRwdWJsaWMgbGljZW5zZUtleTogc3RyaW5nID0gJyc7XG5cdFx0cHVibGljIGVycm9yOiBzdHJpbmcgPSAnJztcblx0XHRwdWJsaWMgYnVzeTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdFx0Y29uc3RydWN0b3Iobm9kZSwgZGF0YSkge1xuXHRcdFx0c3VwZXIobm9kZSwgZGF0YSk7XG5cdFx0fVxuXG5cdFx0aW5pdCgpIHtcblx0XHRcdFxuXHRcdH1cblxuXHRcdGFjdGl2YXRlID0gKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLmxpY2Vuc2VLZXkubWF0Y2goL15cXHMqW2EtZlxcZF17OH0tW2EtZlxcZF17NH0tW2EtZlxcZF17NH0tW2EtZlxcZF17NH0tW2EtZlxcZF17MTJ9XFxzKiQvaSkpIHtcblx0XHRcdFx0dGhpcy5lcnJvciA9ICdJbnZhbGlkIGxpY2Vuc2Uga2V5ISc7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5lcnJvciA9ICcnO1xuXHRcdFx0dGhpcy5idXN5ID0gdHJ1ZTtcblx0XHRcdFxuXHRcdFx0RXh0QVBJLmludm9rZSgncHJvOmFjdGl2YXRlLWxpY2Vuc2UnLCB7a2V5OiB0aGlzLmxpY2Vuc2VLZXl9KVxuXHRcdFx0XHQudGhlbih0aGlzLl9oYW5kbGVFcnJvcnMpXG5cdFx0XHRcdC50aGVuKGRhdGEgPT4ge1xuXHRcdFx0XHRcdHRoaXMubGljZW5zZUtleSA9ICcnO1xuXHRcdFx0XHRcdC8vIHRoaXMucGFyZW50LmxpY2Vuc2UgPSBkYXRhO1xuXHRcdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwdXJjaGFzZSA9ICgpID0+IHtcblx0XHRcdGlmICh0aGlzLnBheUFtb3VudCA8IHRoaXMubWluQW1vdW50KSB7XG5cdFx0XHRcdHRoaXMuZXJyb3IgPSBgVGhlIG1pbmltdW0gYW1vdW50IGlzIFxcJCR7dGhpcy5taW5BbW91bnQudG9GaXhlZCgyKX1gO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuZXJyb3IgPSAnJztcblx0XHRcdHRoaXMuYnVzeSA9IHRydWU7XG5cdFx0XHRcblx0XHRcdEV4dEFQSS5pbnZva2UoJ3BybzpjaGVja291dC11cmwnLCB7cHJpY2U6IHRoaXMucGF5QW1vdW50fSlcblx0XHRcdFx0LnRoZW4odGhpcy5faGFuZGxlRXJyb3JzKVxuXHRcdFx0XHQudGhlbihkYXRhID0+IHtcblx0XHRcdFx0XHR3aW5kb3cub3BlbihkYXRhLnVybCk7XG5cdFx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdF9oYW5kbGVFcnJvcnMgPSAocmVzcG9uc2U6IGFueSk6IFByb21pc2U8YW55PiA9PiB7XG5cdFx0XHR0aGlzLmJ1c3kgPSBmYWxzZTtcblx0XHRcdHRoaXMuZXJyb3IgPSAnJztcblxuXHRcdFx0aWYgKHJlc3BvbnNlLmVycm9yKSB7XG5cdFx0XHRcdHRoaXMuZXJyb3IgPSByZXNwb25zZS5lcnJvcjtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KHJlc3BvbnNlLmVycm9yKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXNwb25zZS5kYXRhKTtcblx0XHR9XG5cdH1cblxuXHRDb3JlLkNvbXBvbmVudHMuY3JlYXRlKCd3ci1wYWdlLXBybycsIHtcblx0XHRzdGF0aWM6IFtdLFxuXHRcdGluaXRpYWxpemU6IChlbCwgZGF0YSkgPT4gbmV3IFBhZ2VQcm8oZWwsIGRhdGEpXG5cdH0pXG59XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vLi4vdHlwaW5ncy9jb21tb24uZC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi8uLi90eXBpbmdzL0V4dEFQSS5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBWaWV3cy5TZXR0aW5ncyB7XHJcblx0ZXhwb3J0IGNsYXNzIFBhZ2VSZWxlYXNlTm90ZXMgZXh0ZW5kcyBDb3JlLkN1c3RvbUVsZW1lbnQge1xyXG5cdFx0cHVibGljIHBhcmVudDogYW55OyAvLyBWaWV3cy5TZXR0aW5ncy5NYWluVmlldztcclxuXHJcblx0XHRjb25zdHJ1Y3Rvcihub2RlLCBkYXRhKSB7XHJcblx0XHRcdHN1cGVyKG5vZGUsIGRhdGEpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNhbmNlbChldnQsIGN0eCkge1xyXG5cdFx0XHRjdHgucGFyZW50LnNob3dWaWV3KGN0eC5wYXJlbnQubWVudVs0XSk7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGdvVG8oZXZ0LCBjdHgpIHtcclxuXHRcdFx0dmFyIGhhc2ggPSBldnQudGFyZ2V0Lmhhc2ggfHwgZXZ0LnRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaGFzaCcpO1xyXG5cdFx0XHRjdHgucGFyZW50LnNob3dWaWV3KGN0eC5wYXJlbnQuX3ZpZXcoaGFzaCkpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Q29yZS5Db21wb25lbnRzLmNyZWF0ZSgnd3ItcGFnZS1yZWxlYXNlLW5vdGVzJywge1xyXG5cdFx0c3RhdGljOiBbXSxcclxuXHRcdGluaXRpYWxpemU6IChlbCwgZGF0YSkgPT4gbmV3IFBhZ2VSZWxlYXNlTm90ZXMoZWwsIGRhdGEpXHJcblx0fSlcclxufVxyXG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vLi4vdHlwaW5ncy9jb21tb24uZC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi8uLi90eXBpbmdzL0V4dEFQSS5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBWaWV3cy5TZXR0aW5ncyB7XHJcblx0aW1wb3J0ICQgPSBDb3JlLlV0aWxzLkRPTTtcclxuXHJcblx0ZXhwb3J0IGNsYXNzIFBhZ2VTeW5jIGV4dGVuZHMgQ29yZS5DdXN0b21FbGVtZW50IHtcclxuXHRcdHB1YmxpYyBwYXJlbnQ6IGFueTsgLy8gVmlld3MuU2V0dGluZ3MuTWFpblZpZXc7XHJcblxyXG5cdFx0cHVibGljIHNldHRpbmdzOiBTZXR0aW5ncztcclxuXHJcblx0XHRjb25zdHJ1Y3Rvcihub2RlLCBkYXRhKSB7XHJcblx0XHRcdHN1cGVyKG5vZGUsIGRhdGEpO1xyXG5cclxuXHRcdFx0dGhpcy5leHBvcnRTZXR0aW5ncyA9IHRoaXMuZXhwb3J0U2V0dGluZ3MuYmluZCh0aGlzKTtcclxuXHRcdFx0dGhpcy5pbXBvcnRTZXR0aW5ncyA9IHRoaXMuaW1wb3J0U2V0dGluZ3MuYmluZCh0aGlzKTtcclxuXHRcdH1cclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLnNldHRpbmdzID0gbmV3IFNldHRpbmdzKCk7XHJcblx0XHRcdEV4dEFQSS5pbnZva2UoJ2dldC1zeW5jLXN0YXR1cycpLnRoZW4oc3RhdHVzID0+IHtcclxuXHRcdFx0XHR0aGlzLnNldHRpbmdzLnN5bmNTZXR0aW5ncyA9ICFzdGF0dXM7XHJcblx0XHRcdH0pLmNhdGNoKHRoaXMucGFyZW50Ll9sb2cpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGV4cG9ydFNldHRpbmdzKCkge1xyXG5cdFx0XHRFeHRBUEkuaW52b2tlKCdnZXQtc2V0dGluZ3MnKS50aGVuKHNldHRpbmdzID0+IHtcclxuXHRcdFx0XHRsZXQgbm9kZSA9IDxIVE1MVGV4dEFyZWFFbGVtZW50PiAkLnEoJyNpbXBvcnRFeHBvcnRGaWVsZCcpO1xyXG5cclxuXHRcdFx0XHRub2RlLnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoc2V0dGluZ3MpO1xyXG5cdFx0XHRcdG5vZGUuZm9jdXMoKTtcclxuXHRcdFx0XHRub2RlLnNlbGVjdCgpO1xyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdGltcG9ydFNldHRpbmdzKCkge1xyXG5cdFx0XHRsZXQgbm9kZSA9IDxIVE1MVGV4dEFyZWFFbGVtZW50PiAkLnEoJyNpbXBvcnRFeHBvcnRGaWVsZCcpO1xyXG5cdFx0XHRsZXQgZGF0YTtcclxuXHRcdFx0bGV0IHNldHRpbmdzOiBhbnkgPSB7fTtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0ZGF0YSA9IEpTT04ucGFyc2Uobm9kZS52YWx1ZSk7XHJcblx0XHRcdH0gY2F0Y2goZXgpIHtcclxuXHRcdFx0XHR0aGlzLnBhcmVudC5zaG93TWVzc2FnZSgnRXJyb3InLCAnVGhlIHByb3ZpZGVkIGlucHV0IGlzIG5vdCBhIHZhbGlkIEpTT04gb2JqZWN0LicpO1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRFeHRBUEkuaW52b2tlKCdpbXBvcnQtc2V0dGluZ3MnLCBkYXRhKTtcclxuXHJcblx0XHRcdHRoaXMucGFyZW50LnNob3dNZXNzYWdlKCdTdWNjZXNzJywgJ1RoZSBuZXcgc2V0dGluZ3MgaGF2ZSBiZWVuIGltcG9ydGVkLicpO1xyXG5cdFx0XHRub2RlLnZhbHVlID0gJyc7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRjbGFzcyBTZXR0aW5ncyB7XHJcblx0XHRwcml2YXRlIF9zZXR0aW5nczogYW55ID0ge307XHJcblxyXG5cdFx0Y29uc3RydWN0b3IoKSB7fVxyXG5cclxuXHRcdGdldCBzeW5jU2V0dGluZ3MoKSAgICAgeyByZXR1cm4gdGhpcy5fc2V0dGluZ3Muc3luY1NldHRpbmdzOyB9XHJcblx0XHRzZXQgc3luY1NldHRpbmdzKHZhbCkgIHtcclxuXHRcdFx0aWYgKHZhbCA9PT0gdGhpcy5fc2V0dGluZ3Muc3luY1NldHRpbmdzKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9zZXR0aW5ncy5zeW5jU2V0dGluZ3MgPSB2YWw7XHJcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRcdEV4dEFQSS5pbnZva2UoJ3RvZ2dsZS1zeW5jJywgIXZhbClcclxuXHRcdFx0XHRcdC50aGVuKCgpID0+IEV4dEFQSS5pbnZva2UoJ2dldC1zZXR0aW5ncycpKVxyXG5cdFx0XHRcdFx0LnRoZW4oc2V0dGluZ3MgPT4gRXh0QVBJLmludm9rZSgnc2F2ZS1zZXR0aW5ncycsIHNldHRpbmdzKSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Q29yZS5Db21wb25lbnRzLmNyZWF0ZSgnd3ItcGFnZS1zeW5jJywge1xyXG5cdFx0c3RhdGljOiBbXSxcclxuXHRcdGluaXRpYWxpemU6IChlbCwgZGF0YSkgPT4gbmV3IFBhZ2VTeW5jKGVsLCBkYXRhKVxyXG5cdH0pXHJcbn1cclxuIl19
