var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/// <reference path="../../../typings/rivets.d.ts" />
/// <reference path="../../../typings/ExtAPI.d.ts" />
/// <reference path="../../../typings/tab-nav.d.ts" />
/// <reference path="../../../typings/common.d.ts" />
var Views;
(function (Views) {
    var Popup;
    (function (Popup_1) {
        var Keys = Core.Input.Keys;
        var $ = Core.Utils.DOM;
        var ModalMessage = Views.Common.ModalMessage;
        class AffiliateBanner {
            constructor(url, image, caption, accent = '#eee') {
                this.url = url;
                this.image = image;
                this.caption = caption;
                this.accent = accent;
            }
        }
        Popup_1.AffiliateBanner = AffiliateBanner;
        class Popup {
            constructor() {
                this.presets = [];
                this.quick = { width: null, height: null, target: 0 };
                this.showKeys = false;
                this.alternatePresetsBg = false;
                this.autoClosePopup = false;
                this.hidePresetsDescription = false;
                this.hidePopupTooltips = false;
                this.hideQuickResize = false;
                this._panels = [];
                this._clickFocus = false;
                this.license = null;
                this.collapsedSidebar = false;
                this.errorMessage = null;
                this.errorMessageTimeout = null;
                this.showQuickTips = false;
                this.presetsIconsStyle = '';
                this.presetsPrimaryLine = '';
                this.hideError = () => {
                    clearTimeout(this.errorMessageTimeout);
                    this.errorMessageTimeout = null;
                };
                this.hideQuickTips = () => {
                    this.showQuickTips = false;
                    window.localStorage['showQuickTips'] = '0';
                };
                this.presets = [];
                this.collapsedSidebar = window.localStorage['collapsed-sidebar'] === '1';
                this.hideQuickResize = window.localStorage['hideQuickResize'] === '1';
                this.showQuickTips = window.localStorage['showQuickTips'] !== '0';
                this._initPanels();
                this.quickResize = this._preventDefault(this.quickResize);
                this.handlePresetClick = this.handlePresetClick.bind(this);
                this.handleToolsClick = this.handleToolsClick.bind(this);
                this.toggleResizeInfo = this.toggleResizeInfo.bind(this);
                this.rotateViewport = this.rotateViewport.bind(this);
                this.handleKeyDown = this.handleKeyDown.bind(this);
                this.handleKeyUp = this.handleKeyUp.bind(this);
                this._showKeys = this._showKeys.bind(this);
                this._hideKeys = this._hideKeys.bind(this);
                this.dismissMessage = this.dismissMessage.bind(this);
                this.hideBanner = this.hideBanner.bind(this);
                ExtAPI.invoke('get-banner')
                    .then(b => this.showBanner(b))
                    .catch(LOG_ERROR);
                ExtAPI.invoke('get-settings')
                    .then(settings => {
                    this.presetsIconsStyle = settings.presetsIconsStyle;
                    this.presetsPrimaryLine = settings.presetsPrimaryLine;
                    this.alternatePresetsBg = settings.alternatePresetsBg;
                    this.autoClosePopup = settings.autoClosePopup;
                    this.hidePresetsDescription = settings.hidePresetsDescription;
                    this.hidePopupTooltips = settings.hidePopupTooltips;
                    this.hideQuickResize = settings.hideQuickResize;
                    window.localStorage['hideQuickResize'] = settings.hideQuickResize ? 1 : 0;
                    this.license = settings.license;
                    for (let presetData of settings.presets) {
                        this.presets.push(new Core.Preset(presetData));
                    }
                    this._showTheUpdateMessage();
                })
                    .catch(LOG_ERROR);
            }
            _showTheUpdateMessage() {
                return __awaiter(this, void 0, void 0, function* () {
                    const flag = yield chrome.storage.local.get('wasUpdated');
                    if (flag.wasUpdated) {
                        this.showMessage('UPDATED', '');
                        let modalMsg = document.createElement('div');
                        const _cleanup = () => __awaiter(this, void 0, void 0, function* () {
                            modalView.unbind();
                            yield chrome.storage.local.remove('wasUpdated');
                            chrome.action.setBadgeText({ text: '' });
                        });
                        modalMsg.innerHTML = `
					<ul>
						<li>
							<a href="https://developer.chrome.com/docs/extensions/develop/migrate" target="_blank">
								Migrate to Manifest V3
							</a>
							<br />
							Please use the "Help & Support" link if you get any errors after this update.
						</li>
					</ul>

					<a rv-on-click="showReleaseNotes" href="#">&raquo; Find out more</a>
				`;
                        if (!this.license) {
                            modalMsg.innerHTML += `
						<div style="text-align: center; margin: 14px 0 -10px; padding: 14px 0 0; border-top: 1px solid #ddd;">
							<strong>Want to support this extension?</strong>
						</div>
						<style>.WR_modal_actions{text-align:center}</style>
					`;
                            this.currentMessage.actions[0].title = 'Ok, whatever!';
                            this.currentMessage.actions[0].title = 'Nope, free is good!';
                            this.currentMessage.actions.unshift({
                                title: 'Buy Pro',
                                icon: '#icon-cart',
                                main: true,
                                handler: () => __awaiter(this, void 0, void 0, function* () {
                                    yield _cleanup();
                                    this.showProPage({}, this);
                                }),
                            });
                        }
                        let modalView = rivets.bind(modalMsg, this);
                        $.q('.WR_modal_message').appendChild(modalMsg);
                        this.currentMessage.onClose.addListener(_cleanup);
                    }
                });
            }
            dismissMessage() {
                TabNav.reset();
                this.currentMessage.hide().then(x => {
                    this.currentMessage = null;
                });
            }
            _createMessage(title, message) {
                let modal = new ModalMessage(title, message);
                modal.onClose.addListener(() => {
                    this._panel.focus();
                });
                return modal;
            }
            showMessage(title, message) {
                this.currentMessage = this._createMessage(title, message);
                this.currentMessage.actions.push({ title: 'OK', handler: this.dismissMessage });
            }
            showReleaseNotes(evt, ctx) {
                ctx.currentMessage.hide().then(() => {
                    chrome.action.setBadgeText({ text: '' });
                    ExtAPI.invoke('open-release-notes').catch(error => {
                        ctx._handleCommonErrors(error);
                    });
                });
            }
            showProPage(evt, ctx) {
                ExtAPI.invoke('open-pro-page').catch(error => {
                    ctx._handleCommonErrors(error);
                });
            }
            showError(message) {
                clearTimeout(this.errorMessageTimeout);
                this.errorMessage = message;
                this.errorMessageTimeout = setTimeout(() => this.hideError(), 2000);
            }
            showBanner(banner) {
                this.currentBanner = banner;
                if (banner) {
                    let sheet = window.document.styleSheets[0];
                    sheet.insertRule(`#promo .banner:hover .dim { color: ${banner.accent}; }`, sheet.cssRules.length);
                    $.addClass('#promo', 'visible');
                }
            }
            hideBanner() {
                $.hide('#promo');
                $.addClass('#info', 'empty');
                //this.currentBanner = null;
                ExtAPI.invoke('hide-banner').then(firstTime => {
                    if (!firstTime)
                        return;
                    // this.showMessage('Notice', 'No more recommendations for you today!<br />See you again tomorrow! :)');
                });
            }
            quickResize(evt, ctx) {
                this._resize(this.quick);
            }
            resizePreset(ctx) {
                this._resize(ctx.item);
            }
            openPresetsSettings(evt, ctx) {
                ExtAPI.invoke('open-presets-settings').catch(error => {
                    ctx._handleCommonErrors(error);
                });
            }
            openSettings(evt, ctx) {
                ExtAPI.invoke('open-settings').catch(error => {
                    ctx._handleCommonErrors(error);
                });
            }
            bugReport(evt, ctx) {
                ExtAPI.invoke('open-url', {
                    url: 'https://windowresizer.userecho.com/',
                }).catch(LOG_ERROR);
            }
            toggleResizeInfo(evt, ctx) {
                ExtAPI.invoke('toggle-tooltip').catch(error => {
                    ctx._handleCommonErrors(error);
                });
            }
            openAsPopup(evt, ctx) {
                ExtAPI.invoke('open-as-popup')
                    .then(response => {
                    !isStandalonePopup() && window.close();
                })
                    .catch(error => {
                    ctx._handleCommonErrors(error);
                });
            }
            rotateViewport() {
                ExtAPI.invoke('rotate-viewport').catch(error => {
                    this._handleCommonErrors(error);
                });
            }
            toggleSidebar(evt, ctx) {
                ctx.collapsedSidebar = !ctx.collapsedSidebar;
                window.localStorage['collapsed-sidebar'] = ctx.collapsedSidebar ? 1 : 0;
                ctx._focusPanel(0);
            }
            _resize(config) {
                this.hideError();
                ExtAPI.invoke('resize', config).catch(error => {
                    console.log(error);
                    this._handleCommonErrors(error);
                });
            }
            _preventDefault(method) {
                return (evt, ctx) => {
                    evt.preventDefault();
                    method.call(this, evt, ctx);
                };
            }
            _handleCommonErrors(error) {
                this._handleOOBError(error.errors);
                this._handleProtocolError(error);
                if (error.FILE_PROTOCOL_PERMISSION) {
                    let title = 'Insufficient permissions';
                    let message = 'You need to explicitly allow access to <em>file://</em> URLs on the extensions management page.';
                    let action = {
                        title: 'OK',
                        handler: () => {
                            this.dismissMessage();
                            chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
                        },
                    };
                    this.currentMessage = this._createMessage(title, message);
                    this.currentMessage.actions.push(action);
                }
                if (error.WEBSTORE_PERMISSION) {
                    let title = 'Permissions error';
                    let message = "The tooltip can't be displayed on this tab because extensions are not allowed to alter the content of the Chrome Webstore pages.";
                    let action = { title: 'OK', handler: this.dismissMessage };
                    this.currentMessage = this._createMessage(title, message);
                    this.currentMessage.actions.push(action);
                }
            }
            _handleOOBError(error) {
                if (error && error.OUT_OF_BOUNDS) {
                    this.showError(`Chrome couldn't apply the exact desired dimensions!`);
                    return;
                    // var keys = error.OUT_OF_BOUNDS.keys;
                    // var errs = [];
                    // if (keys.indexOf('MAX_HEIGHT') > -1) {
                    // 	errs.push('the target <b>height</b> is greater than the maximum allowed by your current screen resolution');
                    // }
                    // if (keys.indexOf('MAX_WIDTH') > -1) {
                    // 	errs.push('the target <b>width</b> is greater than the maximum allowed by your current screen resolution');
                    // }
                    // if (keys.indexOf('MIN_HEIGHT') > -1) {
                    // 	errs.push('the target <b>height</b> is lower than the minimum allowed by your browser window');
                    // }
                    // if (keys.indexOf('MIN_WIDTH') > -1) {
                    // 	errs.push('the target <b>width</b> is lower than the maximum allowed by your browser window');
                    // }
                    // this.showMessage('ERROR', '<ul><li>' + errs.join('</li><li>') + '</li></ul><b>HINT:</b> Adjust the zoom level then try again. (Zoom in for fewer and zoom out for more CSS pixels)');
                }
            }
            _handleProtocolError(error) {
                if (error.INVALID_PROTOCOL) {
                    var err = error.INVALID_PROTOCOL;
                    if (!err.tab.url) {
                        let title = 'Insufficient permissions';
                        let message = 'In order for the extension to work on regular windows in <em>detached</em> mode, it needs to be able to inject custom code in the context of all pages, without user interaction.';
                        this.currentMessage = this._createMessage(title, message);
                        this.currentMessage.actions.push({ title: 'Cancel', handler: this.dismissMessage });
                        this.currentMessage.actions.push({
                            title: 'Grant permissions',
                            main: true,
                            handler: () => {
                                this.dismissMessage();
                                chrome.permissions.request({ permissions: ['tabs'], origins: ['<all_urls>'] }, granted => { });
                            },
                        });
                    }
                    else {
                        this.showMessage('Invalid protocol: <b>' + String(err.protocol) + '://</b>', 'This feature only works on pages loaded using one of the following protocols: <br /><b>http://</b>, <b>https://</b> or <b>file://</b>');
                    }
                }
            }
            _showKeys() {
                this.showKeys = true;
            }
            _hideKeys() {
                this.showKeys = false;
            }
            _initPanels() {
                this._panels.push(new ListPanel('#presetsPanel', 'wr-preset'));
                this._panels.push(new ListPanel('#toolsPanel', 'button'));
                this._panel = this._panels[0];
            }
            _focusPanel(idx) {
                if (idx === 1 && this.collapsedSidebar) {
                    return;
                }
                let panel = this._panels[idx];
                if (panel != this._panel) {
                    this._panel && this._panel.blur();
                    this._panel = panel;
                    this._panel.focus();
                }
            }
            handleBannerClick(evt, ctx) {
                const target = evt.currentTarget;
                const url = target.getAttribute('data-url');
                const action = target.getAttribute('data-action');
                if (url) {
                    ExtAPI.invoke('open-url', { url }).catch(LOG_ERROR);
                }
                else {
                    ctx[action]();
                }
            }
            handlePresetClick(evt, ctx) {
                this._focusPanel(0);
                //this._panel.reset();
                this._panel.selectItem(evt.currentTarget);
                this.resizePreset(ctx);
                this.autoClosePopup && !isStandalonePopup() && window.close();
            }
            handleToolsClick(evt, ctx) {
                if (evt.target instanceof HTMLButtonElement) {
                    this._focusPanel(1);
                    this._panel.selectItem(evt.target);
                }
            }
            handleKeyDown(evt, ctx) {
                let keyCode = evt.keyCode;
                let handled = true;
                switch (keyCode) {
                    case Keys.SHIFT:
                        if (!this.showKeys) {
                            this.showKeys = true;
                        }
                        break;
                    case Keys.SPACE:
                    case Keys.ENTER:
                        $.addClass(this._panel.currentNode(), 'active');
                        break;
                    case Keys.UP:
                        this._panel.prev();
                        break;
                    case Keys.DOWN:
                        this._panel.next();
                        break;
                    case Keys.RIGHT:
                        this._focusPanel(1);
                        break;
                    case Keys.LEFT:
                        this._focusPanel(0);
                        break;
                    default:
                        handled = false;
                        break;
                }
                let node = _getPresetByKeyCode(keyCode);
                if (node) {
                    this._panel.focus();
                    this._focusPanel(0);
                    this._panel.selectItem(node);
                    $.addClass(node, 'active');
                    handled = true;
                }
                if (!handled) {
                    let char = String.fromCharCode(keyCode);
                    let node = $.q(`[data-key="${char}"]`);
                    if (node) {
                        this._panel.focus();
                        this._focusPanel(1);
                        this._panel.selectItem(node);
                        $.addClass(node, 'active');
                        handled = true;
                    }
                }
                if (handled) {
                    evt.preventDefault();
                }
            }
            handleKeyUp(evt, ctx) {
                let keyCode = evt.keyCode;
                let handled = true;
                switch (keyCode) {
                    case Keys.SHIFT:
                        if (this.showKeys) {
                            this.showKeys = false;
                        }
                        break;
                    case Keys.SPACE:
                    case Keys.ENTER:
                        $.removeClass(this._panel.currentNode(), 'active');
                        $.trigger('click', this._panel.currentNode());
                        break;
                    default:
                        handled = false;
                        break;
                }
                let node = _getPresetByKeyCode(keyCode);
                if (node) {
                    $.removeClass(node, 'active');
                    $.trigger('click', node);
                    handled = true;
                }
                if (!handled) {
                    let char = String.fromCharCode(keyCode);
                    let node = $.q(`[data-key="${char}"]`);
                    if (node) {
                        $.removeClass(node, 'active');
                        $.trigger('click', node);
                        handled = true;
                    }
                }
                if (handled) {
                    evt.preventDefault();
                }
            }
            initNavigation() {
                let main = $.q('#main');
                $.on('keydown', main, this.handleKeyDown, true);
                $.on('keyup', main, this.handleKeyUp, true);
                let h = new FocusHandler(main);
                main.focus();
            }
        }
        Popup_1.Popup = Popup;
        class FocusHandler {
            constructor(target) {
                this.ignore = false;
                this.focused = false;
                this.target = target;
                this.__initHandlers();
                $.on('focus', this.target, this.onFocus, true);
                $.on('blur', this.target, this.onBlur, true);
                $.on('mousedown', this.target, this.onMouseDown, true);
                $.on('keydown', document, this.onKeyDown, true);
            }
            __initHandlers() {
                var handlers = ['onFocus', 'onBlur', 'onKeyDown', 'onMouseDown'];
                for (var method of handlers) {
                    this[method] = __eventHandler(this, this[method]);
                }
                function __eventHandler(context, method) {
                    return function (evt) {
                        return method.call(context, evt, this);
                    };
                }
            }
            onBlur(evt) {
                if (!this.target.contains(evt.relatedTarget)) {
                    $.removeClass(this.target, 'focused');
                }
                this.focused = false;
            }
            onFocus(evt) {
                if (!this.ignore) {
                    $.addClass(this.target, 'focused');
                }
                this.focused = true;
            }
            onKeyDown(evt) {
                this.ignore = false;
                if (this.focused) {
                    $.addClass(this.target, 'focused');
                }
            }
            onMouseDown(evt) {
                $.removeClass(this.target, 'focused');
                this.ignore = true;
            }
        }
        function _stealFocus(evt, ctx) {
            evt.preventDefault();
            evt.stopPropagation();
            this.focus();
        }
        function _getPresetByKeyCode(keyCode) {
            var node;
            if ((keyCode >= Keys.DIGITS[0] && keyCode <= Keys.DIGITS[1]) ||
                (keyCode >= Keys.NUMPAD[0] && keyCode <= Keys.NUMPAD[1])) {
                let idx = keyCode % 48 || 10;
                node = $.q(`wr-preset:nth-of-type(${idx})`);
            }
            return node;
        }
        class ListPanel {
            constructor(parent, list) {
                this.parent = null;
                this.list = null;
                this.current = -1;
                this.autoInit = true;
                this._selected = 'selected';
                this._focused = 'focused';
                this.parent = $.q(parent);
                this.list = list;
            }
            next() {
                let nodes = $.qAll(this.list, this.parent);
                let next = (this.current + 1) % nodes.length;
                this.select(next, nodes);
            }
            prev() {
                let nodes = $.qAll(this.list, this.parent);
                let prev = (nodes.length + this.current - 1) % nodes.length;
                this.select(prev, nodes);
            }
            select(next, nodes, noFocus) {
                for (let i = 0, l = nodes.length; i < l; i++) {
                    let node = nodes[i];
                    node.classList.remove(this._selected);
                }
                let node = nodes[next];
                this._selectNode(node);
                this.current = next;
                if (!noFocus) {
                    this.focus();
                }
            }
            focus() {
                this.parent.classList.add('focused');
                if (this.autoInit && this.current < 0) {
                    this.next();
                }
                this._selectNode(this.currentNode());
            }
            blur() {
                this.parent.classList.remove('focused');
            }
            reset() {
                let nodes = $.qAll(this.list, this.parent);
                for (let i = 0, l = nodes.length; i < l; i++) {
                    let node = nodes[i];
                    node.classList.remove(this._selected);
                }
                this.current = -1;
            }
            selectItem(item) {
                let nodes = $.qAll(this.list, this.parent);
                let found = -1;
                for (let i = 0, l = nodes.length; i < l; i++) {
                    if (item == nodes[i]) {
                        found = i;
                    }
                }
                if (found > -1 && found != this.current) {
                    let node = nodes[found];
                    this.reset();
                    this._selectNode(node);
                    this.current = found;
                }
            }
            currentNode() {
                let nodes = $.qAll(this.list, this.parent);
                return nodes[this.current];
            }
            _selectNode(node) {
                node.classList.add(this._selected);
                node.setAttribute('tabindex', '0');
                node.focus();
                node.setAttribute('tabindex', '-1');
            }
        }
        Popup_1.view = new Popup();
        var binding = rivets.bind(document.body, Popup_1.view);
        Popup_1.view.initNavigation();
        chrome.runtime.onMessage.addListener(msg => {
            if (msg.UpdatedSettings) {
                if ('license' in msg.UpdatedSettings && msg.UpdatedSettings.license) {
                    // view.currentBanner = null
                }
                if ('presetsIconsStyle' in msg.UpdatedSettings) {
                    Popup_1.view.presetsIconsStyle = msg.UpdatedSettings.presetsIconsStyle;
                }
                if ('presetsPrimaryLine' in msg.UpdatedSettings) {
                    Popup_1.view.presetsPrimaryLine = msg.UpdatedSettings.presetsPrimaryLine;
                }
                if ('alternatePresetsBg' in msg.UpdatedSettings) {
                    Popup_1.view.alternatePresetsBg = msg.UpdatedSettings.alternatePresetsBg;
                }
                if ('autoClosePopup' in msg.UpdatedSettings) {
                    Popup_1.view.autoClosePopup = msg.UpdatedSettings.autoClosePopup;
                }
                if ('hidePresetsDescription' in msg.UpdatedSettings) {
                    Popup_1.view.hidePresetsDescription = msg.UpdatedSettings.hidePresetsDescription;
                }
                if ('hidePopupTooltips' in msg.UpdatedSettings) {
                    Popup_1.view.hidePopupTooltips = msg.UpdatedSettings.hidePopupTooltips;
                }
                if ('hideQuickResize' in msg.UpdatedSettings) {
                    Popup_1.view.hideQuickResize = msg.UpdatedSettings.hideQuickResize;
                    window.localStorage['hideQuickResize'] = msg.UpdatedSettings.hideQuickResize ? 1 : 0;
                }
                if ('presets' in msg.UpdatedSettings) {
                    Popup_1.view.presets = [];
                    for (let presetData of msg.UpdatedSettings.presets) {
                        Popup_1.view.presets.push(new Core.Preset(presetData));
                    }
                }
            }
        });
        function LOG_ERROR(err) {
            console.log(err);
        }
        function isStandalonePopup() {
            return window.location.hash.indexOf('popup-view') > -1;
        }
        function _constrainWindowSize() {
            var limit = {};
            if (window.innerWidth < 340) {
                limit.width = 340 + window.outerWidth - window.innerWidth;
            }
            if (window.innerHeight < 400) {
                limit.height = 400 + window.outerHeight - window.innerHeight;
            }
            if (limit.width || limit.height) {
                ExtAPI.invoke('limit-popup', limit);
            }
        }
        if (isStandalonePopup()) {
            window.addEventListener('resize', _constrainWindowSize);
        }
    })(Popup = Views.Popup || (Views.Popup = {}));
})(Views || (Views = {}));

//# sourceMappingURL=data:application/json;charset=utf8;base64,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InNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi90eXBpbmdzL3JpdmV0cy5kLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uL3R5cGluZ3MvRXh0QVBJLmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy90YWItbmF2LmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9jb21tb24uZC50c1wiIC8+XHJcblxyXG5tb2R1bGUgVmlld3MuUG9wdXAge1xyXG5cdGltcG9ydCBLZXlzID0gQ29yZS5JbnB1dC5LZXlzXHJcblx0aW1wb3J0ICQgPSBDb3JlLlV0aWxzLkRPTVxyXG5cclxuXHRpbXBvcnQgTW9kYWxNZXNzYWdlID0gVmlld3MuQ29tbW9uLk1vZGFsTWVzc2FnZVxyXG5cdGltcG9ydCBNb2RhbE1lc3NhZ2VBY3Rpb24gPSBWaWV3cy5Db21tb24uTW9kYWxNZXNzYWdlQWN0aW9uXHJcblxyXG5cdGV4cG9ydCBjbGFzcyBBZmZpbGlhdGVCYW5uZXIge1xyXG5cdFx0Y29uc3RydWN0b3IocHVibGljIHVybDogc3RyaW5nLCBwdWJsaWMgaW1hZ2U6IHN0cmluZywgcHVibGljIGNhcHRpb246IHN0cmluZywgcHVibGljIGFjY2VudDogc3RyaW5nID0gJyNlZWUnKSB7fVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGNsYXNzIFBvcHVwIHtcclxuXHRcdHByZXNldHM6IGFueVtdID0gW11cclxuXHRcdHF1aWNrID0geyB3aWR0aDogbnVsbCwgaGVpZ2h0OiBudWxsLCB0YXJnZXQ6IDAgfVxyXG5cdFx0c2hvd0tleXMgPSBmYWxzZVxyXG5cclxuXHRcdGN1cnJlbnRNZXNzYWdlOiBNb2RhbE1lc3NhZ2VcclxuXHRcdGN1cnJlbnRCYW5uZXI6IEFmZmlsaWF0ZUJhbm5lclxyXG5cclxuXHRcdGFsdGVybmF0ZVByZXNldHNCZzogYm9vbGVhbiA9IGZhbHNlXHJcblx0XHRhdXRvQ2xvc2VQb3B1cDogYm9vbGVhbiA9IGZhbHNlXHJcblx0XHRoaWRlUHJlc2V0c0Rlc2NyaXB0aW9uOiBib29sZWFuID0gZmFsc2VcclxuXHRcdGhpZGVQb3B1cFRvb2x0aXBzOiBib29sZWFuID0gZmFsc2VcclxuXHRcdGhpZGVRdWlja1Jlc2l6ZTogYm9vbGVhbiA9IGZhbHNlXHJcblxyXG5cdFx0cHJvdGVjdGVkIF9wYW5lbDogTGlzdFBhbmVsXHJcblx0XHRwcm90ZWN0ZWQgX3BhbmVsczogTGlzdFBhbmVsW10gPSBbXVxyXG5cdFx0cHJvdGVjdGVkIF9jbGlja0ZvY3VzOiBib29sZWFuID0gZmFsc2VcclxuXHJcblx0XHRwdWJsaWMgbGljZW5zZTogYW55ID0gbnVsbFxyXG5cdFx0cHVibGljIGNvbGxhcHNlZFNpZGViYXI6IGJvb2xlYW4gPSBmYWxzZVxyXG5cclxuXHRcdHB1YmxpYyBlcnJvck1lc3NhZ2U6IHN0cmluZyA9IG51bGxcclxuXHRcdHB1YmxpYyBlcnJvck1lc3NhZ2VUaW1lb3V0OiBhbnkgPSBudWxsXHJcblx0XHRwdWJsaWMgc2hvd1F1aWNrVGlwczogYm9vbGVhbiA9IGZhbHNlXHJcblx0XHRwdWJsaWMgcHJlc2V0c0ljb25zU3R5bGU6IHN0cmluZyA9ICcnXHJcblx0XHRwdWJsaWMgcHJlc2V0c1ByaW1hcnlMaW5lOiBzdHJpbmcgPSAnJ1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0XHR0aGlzLnByZXNldHMgPSBbXVxyXG5cdFx0XHR0aGlzLmNvbGxhcHNlZFNpZGViYXIgPSB3aW5kb3cubG9jYWxTdG9yYWdlWydjb2xsYXBzZWQtc2lkZWJhciddID09PSAnMSdcclxuXHRcdFx0dGhpcy5oaWRlUXVpY2tSZXNpemUgPSB3aW5kb3cubG9jYWxTdG9yYWdlWydoaWRlUXVpY2tSZXNpemUnXSA9PT0gJzEnXHJcblx0XHRcdHRoaXMuc2hvd1F1aWNrVGlwcyA9IHdpbmRvdy5sb2NhbFN0b3JhZ2VbJ3Nob3dRdWlja1RpcHMnXSAhPT0gJzAnXHJcblxyXG5cdFx0XHR0aGlzLl9pbml0UGFuZWxzKClcclxuXHJcblx0XHRcdHRoaXMucXVpY2tSZXNpemUgPSB0aGlzLl9wcmV2ZW50RGVmYXVsdCh0aGlzLnF1aWNrUmVzaXplKVxyXG5cclxuXHRcdFx0dGhpcy5oYW5kbGVQcmVzZXRDbGljayA9IHRoaXMuaGFuZGxlUHJlc2V0Q2xpY2suYmluZCh0aGlzKVxyXG5cdFx0XHR0aGlzLmhhbmRsZVRvb2xzQ2xpY2sgPSB0aGlzLmhhbmRsZVRvb2xzQ2xpY2suYmluZCh0aGlzKVxyXG5cdFx0XHR0aGlzLnRvZ2dsZVJlc2l6ZUluZm8gPSB0aGlzLnRvZ2dsZVJlc2l6ZUluZm8uYmluZCh0aGlzKVxyXG5cdFx0XHR0aGlzLnJvdGF0ZVZpZXdwb3J0ID0gdGhpcy5yb3RhdGVWaWV3cG9ydC5iaW5kKHRoaXMpXHJcblxyXG5cdFx0XHR0aGlzLmhhbmRsZUtleURvd24gPSB0aGlzLmhhbmRsZUtleURvd24uYmluZCh0aGlzKVxyXG5cdFx0XHR0aGlzLmhhbmRsZUtleVVwID0gdGhpcy5oYW5kbGVLZXlVcC5iaW5kKHRoaXMpXHJcblxyXG5cdFx0XHR0aGlzLl9zaG93S2V5cyA9IHRoaXMuX3Nob3dLZXlzLmJpbmQodGhpcylcclxuXHRcdFx0dGhpcy5faGlkZUtleXMgPSB0aGlzLl9oaWRlS2V5cy5iaW5kKHRoaXMpXHJcblxyXG5cdFx0XHR0aGlzLmRpc21pc3NNZXNzYWdlID0gdGhpcy5kaXNtaXNzTWVzc2FnZS5iaW5kKHRoaXMpXHJcblx0XHRcdHRoaXMuaGlkZUJhbm5lciA9IHRoaXMuaGlkZUJhbm5lci5iaW5kKHRoaXMpXHJcblxyXG5cdFx0XHRFeHRBUEkuaW52b2tlKCdnZXQtYmFubmVyJylcclxuXHRcdFx0XHQudGhlbihiID0+IHRoaXMuc2hvd0Jhbm5lcihiKSlcclxuXHRcdFx0XHQuY2F0Y2goTE9HX0VSUk9SKVxyXG5cdFx0XHRFeHRBUEkuaW52b2tlKCdnZXQtc2V0dGluZ3MnKVxyXG5cdFx0XHRcdC50aGVuKHNldHRpbmdzID0+IHtcclxuXHRcdFx0XHRcdHRoaXMucHJlc2V0c0ljb25zU3R5bGUgPSBzZXR0aW5ncy5wcmVzZXRzSWNvbnNTdHlsZVxyXG5cdFx0XHRcdFx0dGhpcy5wcmVzZXRzUHJpbWFyeUxpbmUgPSBzZXR0aW5ncy5wcmVzZXRzUHJpbWFyeUxpbmVcclxuXHRcdFx0XHRcdHRoaXMuYWx0ZXJuYXRlUHJlc2V0c0JnID0gc2V0dGluZ3MuYWx0ZXJuYXRlUHJlc2V0c0JnXHJcblx0XHRcdFx0XHR0aGlzLmF1dG9DbG9zZVBvcHVwID0gc2V0dGluZ3MuYXV0b0Nsb3NlUG9wdXBcclxuXHRcdFx0XHRcdHRoaXMuaGlkZVByZXNldHNEZXNjcmlwdGlvbiA9IHNldHRpbmdzLmhpZGVQcmVzZXRzRGVzY3JpcHRpb25cclxuXHRcdFx0XHRcdHRoaXMuaGlkZVBvcHVwVG9vbHRpcHMgPSBzZXR0aW5ncy5oaWRlUG9wdXBUb29sdGlwc1xyXG5cdFx0XHRcdFx0dGhpcy5oaWRlUXVpY2tSZXNpemUgPSBzZXR0aW5ncy5oaWRlUXVpY2tSZXNpemVcclxuXHRcdFx0XHRcdHdpbmRvdy5sb2NhbFN0b3JhZ2VbJ2hpZGVRdWlja1Jlc2l6ZSddID0gc2V0dGluZ3MuaGlkZVF1aWNrUmVzaXplID8gMSA6IDBcclxuXHRcdFx0XHRcdHRoaXMubGljZW5zZSA9IHNldHRpbmdzLmxpY2Vuc2VcclxuXHJcblx0XHRcdFx0XHRmb3IgKGxldCBwcmVzZXREYXRhIG9mIHNldHRpbmdzLnByZXNldHMpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5wcmVzZXRzLnB1c2gobmV3IENvcmUuUHJlc2V0KHByZXNldERhdGEpKVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHRoaXMuX3Nob3dUaGVVcGRhdGVNZXNzYWdlKClcclxuXHRcdFx0XHR9KVxyXG5cdFx0XHRcdC5jYXRjaChMT0dfRVJST1IpXHJcblx0XHR9XHJcblxyXG5cdFx0YXN5bmMgX3Nob3dUaGVVcGRhdGVNZXNzYWdlKCkge1xyXG5cdFx0XHRjb25zdCBmbGFnID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KCd3YXNVcGRhdGVkJylcclxuXHJcblx0XHRcdGlmIChmbGFnLndhc1VwZGF0ZWQpIHtcclxuXHRcdFx0XHR0aGlzLnNob3dNZXNzYWdlKCdVUERBVEVEJywgJycpXHJcblx0XHRcdFx0bGV0IG1vZGFsTXNnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcclxuXHRcdFx0XHRjb25zdCBfY2xlYW51cCA9IGFzeW5jICgpID0+IHtcclxuXHRcdFx0XHRcdG1vZGFsVmlldy51bmJpbmQoKVxyXG5cdFx0XHRcdFx0YXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwucmVtb3ZlKCd3YXNVcGRhdGVkJylcclxuXHRcdFx0XHRcdGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGV4dDogJycgfSlcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdG1vZGFsTXNnLmlubmVySFRNTCA9IGBcclxuXHRcdFx0XHRcdDx1bD5cclxuXHRcdFx0XHRcdFx0PGxpPlxyXG5cdFx0XHRcdFx0XHRcdDxhIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5jaHJvbWUuY29tL2RvY3MvZXh0ZW5zaW9ucy9kZXZlbG9wL21pZ3JhdGVcIiB0YXJnZXQ9XCJfYmxhbmtcIj5cclxuXHRcdFx0XHRcdFx0XHRcdE1pZ3JhdGUgdG8gTWFuaWZlc3QgVjNcclxuXHRcdFx0XHRcdFx0XHQ8L2E+XHJcblx0XHRcdFx0XHRcdFx0PGJyIC8+XHJcblx0XHRcdFx0XHRcdFx0UGxlYXNlIHVzZSB0aGUgXCJIZWxwICYgU3VwcG9ydFwiIGxpbmsgaWYgeW91IGdldCBhbnkgZXJyb3JzIGFmdGVyIHRoaXMgdXBkYXRlLlxyXG5cdFx0XHRcdFx0XHQ8L2xpPlxyXG5cdFx0XHRcdFx0PC91bD5cclxuXHJcblx0XHRcdFx0XHQ8YSBydi1vbi1jbGljaz1cInNob3dSZWxlYXNlTm90ZXNcIiBocmVmPVwiI1wiPiZyYXF1bzsgRmluZCBvdXQgbW9yZTwvYT5cclxuXHRcdFx0XHRgXHJcblxyXG5cdFx0XHRcdGlmICghdGhpcy5saWNlbnNlKSB7XHJcblx0XHRcdFx0XHRtb2RhbE1zZy5pbm5lckhUTUwgKz0gYFxyXG5cdFx0XHRcdFx0XHQ8ZGl2IHN0eWxlPVwidGV4dC1hbGlnbjogY2VudGVyOyBtYXJnaW46IDE0cHggMCAtMTBweDsgcGFkZGluZzogMTRweCAwIDA7IGJvcmRlci10b3A6IDFweCBzb2xpZCAjZGRkO1wiPlxyXG5cdFx0XHRcdFx0XHRcdDxzdHJvbmc+V2FudCB0byBzdXBwb3J0IHRoaXMgZXh0ZW5zaW9uPzwvc3Ryb25nPlxyXG5cdFx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdFx0PHN0eWxlPi5XUl9tb2RhbF9hY3Rpb25ze3RleHQtYWxpZ246Y2VudGVyfTwvc3R5bGU+XHJcblx0XHRcdFx0XHRgXHJcblxyXG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50TWVzc2FnZS5hY3Rpb25zWzBdLnRpdGxlID0gJ09rLCB3aGF0ZXZlciEnXHJcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRNZXNzYWdlLmFjdGlvbnNbMF0udGl0bGUgPSAnTm9wZSwgZnJlZSBpcyBnb29kISdcclxuXHJcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRNZXNzYWdlLmFjdGlvbnMudW5zaGlmdCh7XHJcblx0XHRcdFx0XHRcdHRpdGxlOiAnQnV5IFBybycsXHJcblx0XHRcdFx0XHRcdGljb246ICcjaWNvbi1jYXJ0JyxcclxuXHRcdFx0XHRcdFx0bWFpbjogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0aGFuZGxlcjogYXN5bmMgKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdGF3YWl0IF9jbGVhbnVwKClcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnNob3dQcm9QYWdlKHt9LCB0aGlzKVxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxldCBtb2RhbFZpZXcgPSByaXZldHMuYmluZChtb2RhbE1zZywgdGhpcylcclxuXHRcdFx0XHQkLnEoJy5XUl9tb2RhbF9tZXNzYWdlJykuYXBwZW5kQ2hpbGQobW9kYWxNc2cpXHJcblxyXG5cdFx0XHRcdHRoaXMuY3VycmVudE1lc3NhZ2Uub25DbG9zZS5hZGRMaXN0ZW5lcihfY2xlYW51cClcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGRpc21pc3NNZXNzYWdlKCkge1xyXG5cdFx0XHRUYWJOYXYucmVzZXQoKVxyXG5cclxuXHRcdFx0dGhpcy5jdXJyZW50TWVzc2FnZS5oaWRlKCkudGhlbih4ID0+IHtcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnRNZXNzYWdlID0gbnVsbFxyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdF9jcmVhdGVNZXNzYWdlKHRpdGxlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZyk6IE1vZGFsTWVzc2FnZSB7XHJcblx0XHRcdGxldCBtb2RhbCA9IG5ldyBNb2RhbE1lc3NhZ2UodGl0bGUsIG1lc3NhZ2UpXHJcblxyXG5cdFx0XHRtb2RhbC5vbkNsb3NlLmFkZExpc3RlbmVyKCgpID0+IHtcclxuXHRcdFx0XHR0aGlzLl9wYW5lbC5mb2N1cygpXHJcblx0XHRcdH0pXHJcblxyXG5cdFx0XHRyZXR1cm4gbW9kYWxcclxuXHRcdH1cclxuXHJcblx0XHRzaG93TWVzc2FnZSh0aXRsZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcclxuXHRcdFx0dGhpcy5jdXJyZW50TWVzc2FnZSA9IHRoaXMuX2NyZWF0ZU1lc3NhZ2UodGl0bGUsIG1lc3NhZ2UpXHJcblx0XHRcdHRoaXMuY3VycmVudE1lc3NhZ2UuYWN0aW9ucy5wdXNoKHsgdGl0bGU6ICdPSycsIGhhbmRsZXI6IHRoaXMuZGlzbWlzc01lc3NhZ2UgfSlcclxuXHRcdH1cclxuXHJcblx0XHRzaG93UmVsZWFzZU5vdGVzKGV2dCwgY3R4KSB7XHJcblx0XHRcdGN0eC5jdXJyZW50TWVzc2FnZS5oaWRlKCkudGhlbigoKSA9PiB7XHJcblx0XHRcdFx0Y2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHQoeyB0ZXh0OiAnJyB9KVxyXG5cclxuXHRcdFx0XHRFeHRBUEkuaW52b2tlKCdvcGVuLXJlbGVhc2Utbm90ZXMnKS5jYXRjaChlcnJvciA9PiB7XHJcblx0XHRcdFx0XHRjdHguX2hhbmRsZUNvbW1vbkVycm9ycyhlcnJvcilcclxuXHRcdFx0XHR9KVxyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdHNob3dQcm9QYWdlKGV2dCwgY3R4KSB7XHJcblx0XHRcdEV4dEFQSS5pbnZva2UoJ29wZW4tcHJvLXBhZ2UnKS5jYXRjaChlcnJvciA9PiB7XHJcblx0XHRcdFx0Y3R4Ll9oYW5kbGVDb21tb25FcnJvcnMoZXJyb3IpXHJcblx0XHRcdH0pXHJcblx0XHR9XHJcblxyXG5cdFx0c2hvd0Vycm9yKG1lc3NhZ2UpIHtcclxuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuZXJyb3JNZXNzYWdlVGltZW91dClcclxuXHRcdFx0dGhpcy5lcnJvck1lc3NhZ2UgPSBtZXNzYWdlXHJcblx0XHRcdHRoaXMuZXJyb3JNZXNzYWdlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5oaWRlRXJyb3IoKSwgMjAwMClcclxuXHRcdH1cclxuXHJcblx0XHRoaWRlRXJyb3IgPSAoKSA9PiB7XHJcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLmVycm9yTWVzc2FnZVRpbWVvdXQpXHJcblx0XHRcdHRoaXMuZXJyb3JNZXNzYWdlVGltZW91dCA9IG51bGxcclxuXHRcdH1cclxuXHJcblx0XHRoaWRlUXVpY2tUaXBzID0gKCkgPT4ge1xyXG5cdFx0XHR0aGlzLnNob3dRdWlja1RpcHMgPSBmYWxzZVxyXG5cdFx0XHR3aW5kb3cubG9jYWxTdG9yYWdlWydzaG93UXVpY2tUaXBzJ10gPSAnMCdcclxuXHRcdH1cclxuXHJcblx0XHRzaG93QmFubmVyKGJhbm5lcjogQWZmaWxpYXRlQmFubmVyKSB7XHJcblx0XHRcdHRoaXMuY3VycmVudEJhbm5lciA9IGJhbm5lclxyXG5cclxuXHRcdFx0aWYgKGJhbm5lcikge1xyXG5cdFx0XHRcdGxldCBzaGVldCA9IDxDU1NTdHlsZVNoZWV0PndpbmRvdy5kb2N1bWVudC5zdHlsZVNoZWV0c1swXVxyXG5cdFx0XHRcdHNoZWV0Lmluc2VydFJ1bGUoYCNwcm9tbyAuYmFubmVyOmhvdmVyIC5kaW0geyBjb2xvcjogJHtiYW5uZXIuYWNjZW50fTsgfWAsIHNoZWV0LmNzc1J1bGVzLmxlbmd0aClcclxuXHJcblx0XHRcdFx0JC5hZGRDbGFzcygnI3Byb21vJywgJ3Zpc2libGUnKVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aGlkZUJhbm5lcigpIHtcclxuXHRcdFx0JC5oaWRlKCcjcHJvbW8nKVxyXG5cdFx0XHQkLmFkZENsYXNzKCcjaW5mbycsICdlbXB0eScpXHJcblx0XHRcdC8vdGhpcy5jdXJyZW50QmFubmVyID0gbnVsbDtcclxuXHJcblx0XHRcdEV4dEFQSS5pbnZva2UoJ2hpZGUtYmFubmVyJykudGhlbihmaXJzdFRpbWUgPT4ge1xyXG5cdFx0XHRcdGlmICghZmlyc3RUaW1lKSByZXR1cm5cclxuXHJcblx0XHRcdFx0Ly8gdGhpcy5zaG93TWVzc2FnZSgnTm90aWNlJywgJ05vIG1vcmUgcmVjb21tZW5kYXRpb25zIGZvciB5b3UgdG9kYXkhPGJyIC8+U2VlIHlvdSBhZ2FpbiB0b21vcnJvdyEgOiknKTtcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRxdWlja1Jlc2l6ZShldnQsIGN0eCkge1xyXG5cdFx0XHR0aGlzLl9yZXNpemUodGhpcy5xdWljaylcclxuXHRcdH1cclxuXHJcblx0XHRyZXNpemVQcmVzZXQoY3R4KSB7XHJcblx0XHRcdHRoaXMuX3Jlc2l6ZShjdHguaXRlbSlcclxuXHRcdH1cclxuXHJcblx0XHRvcGVuUHJlc2V0c1NldHRpbmdzKGV2dCwgY3R4KSB7XHJcblx0XHRcdEV4dEFQSS5pbnZva2UoJ29wZW4tcHJlc2V0cy1zZXR0aW5ncycpLmNhdGNoKGVycm9yID0+IHtcclxuXHRcdFx0XHRjdHguX2hhbmRsZUNvbW1vbkVycm9ycyhlcnJvcilcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRvcGVuU2V0dGluZ3MoZXZ0LCBjdHgpIHtcclxuXHRcdFx0RXh0QVBJLmludm9rZSgnb3Blbi1zZXR0aW5ncycpLmNhdGNoKGVycm9yID0+IHtcclxuXHRcdFx0XHRjdHguX2hhbmRsZUNvbW1vbkVycm9ycyhlcnJvcilcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRidWdSZXBvcnQoZXZ0LCBjdHgpIHtcclxuXHRcdFx0RXh0QVBJLmludm9rZSgnb3Blbi11cmwnLCB7XHJcblx0XHRcdFx0dXJsOiAnaHR0cHM6Ly93aW5kb3dyZXNpemVyLnVzZXJlY2hvLmNvbS8nLFxyXG5cdFx0XHR9KS5jYXRjaChMT0dfRVJST1IpXHJcblx0XHR9XHJcblxyXG5cdFx0dG9nZ2xlUmVzaXplSW5mbyhldnQsIGN0eCkge1xyXG5cdFx0XHRFeHRBUEkuaW52b2tlKCd0b2dnbGUtdG9vbHRpcCcpLmNhdGNoKGVycm9yID0+IHtcclxuXHRcdFx0XHRjdHguX2hhbmRsZUNvbW1vbkVycm9ycyhlcnJvcilcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRvcGVuQXNQb3B1cChldnQsIGN0eCkge1xyXG5cdFx0XHRFeHRBUEkuaW52b2tlKCdvcGVuLWFzLXBvcHVwJylcclxuXHRcdFx0XHQudGhlbihyZXNwb25zZSA9PiB7XHJcblx0XHRcdFx0XHQhaXNTdGFuZGFsb25lUG9wdXAoKSAmJiB3aW5kb3cuY2xvc2UoKVxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdFx0LmNhdGNoKGVycm9yID0+IHtcclxuXHRcdFx0XHRcdGN0eC5faGFuZGxlQ29tbW9uRXJyb3JzKGVycm9yKVxyXG5cdFx0XHRcdH0pXHJcblx0XHR9XHJcblxyXG5cdFx0cm90YXRlVmlld3BvcnQoKSB7XHJcblx0XHRcdEV4dEFQSS5pbnZva2UoJ3JvdGF0ZS12aWV3cG9ydCcpLmNhdGNoKGVycm9yID0+IHtcclxuXHRcdFx0XHR0aGlzLl9oYW5kbGVDb21tb25FcnJvcnMoZXJyb3IpXHJcblx0XHRcdH0pXHJcblx0XHR9XHJcblxyXG5cdFx0dG9nZ2xlU2lkZWJhcihldnQsIGN0eCkge1xyXG5cdFx0XHRjdHguY29sbGFwc2VkU2lkZWJhciA9ICFjdHguY29sbGFwc2VkU2lkZWJhclxyXG5cdFx0XHR3aW5kb3cubG9jYWxTdG9yYWdlWydjb2xsYXBzZWQtc2lkZWJhciddID0gY3R4LmNvbGxhcHNlZFNpZGViYXIgPyAxIDogMFxyXG5cdFx0XHRjdHguX2ZvY3VzUGFuZWwoMClcclxuXHRcdH1cclxuXHJcblx0XHRfcmVzaXplKGNvbmZpZykge1xyXG5cdFx0XHR0aGlzLmhpZGVFcnJvcigpXHJcblx0XHRcdEV4dEFQSS5pbnZva2UoJ3Jlc2l6ZScsIGNvbmZpZykuY2F0Y2goZXJyb3IgPT4ge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKGVycm9yKVxyXG5cdFx0XHRcdHRoaXMuX2hhbmRsZUNvbW1vbkVycm9ycyhlcnJvcilcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRfcHJldmVudERlZmF1bHQobWV0aG9kKSB7XHJcblx0XHRcdHJldHVybiAoZXZ0LCBjdHgpID0+IHtcclxuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKVxyXG5cdFx0XHRcdG1ldGhvZC5jYWxsKHRoaXMsIGV2dCwgY3R4KVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X2hhbmRsZUNvbW1vbkVycm9ycyhlcnJvcikge1xyXG5cdFx0XHR0aGlzLl9oYW5kbGVPT0JFcnJvcihlcnJvci5lcnJvcnMpXHJcblx0XHRcdHRoaXMuX2hhbmRsZVByb3RvY29sRXJyb3IoZXJyb3IpXHJcblxyXG5cdFx0XHRpZiAoZXJyb3IuRklMRV9QUk9UT0NPTF9QRVJNSVNTSU9OKSB7XHJcblx0XHRcdFx0bGV0IHRpdGxlID0gJ0luc3VmZmljaWVudCBwZXJtaXNzaW9ucydcclxuXHRcdFx0XHRsZXQgbWVzc2FnZSA9ICdZb3UgbmVlZCB0byBleHBsaWNpdGx5IGFsbG93IGFjY2VzcyB0byA8ZW0+ZmlsZTovLzwvZW0+IFVSTHMgb24gdGhlIGV4dGVuc2lvbnMgbWFuYWdlbWVudCBwYWdlLidcclxuXHRcdFx0XHRsZXQgYWN0aW9uID0ge1xyXG5cdFx0XHRcdFx0dGl0bGU6ICdPSycsXHJcblx0XHRcdFx0XHRoYW5kbGVyOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdHRoaXMuZGlzbWlzc01lc3NhZ2UoKVxyXG5cdFx0XHRcdFx0XHRjaHJvbWUudGFicy5jcmVhdGUoeyB1cmw6ICdjaHJvbWU6Ly9leHRlbnNpb25zLz9pZD0nICsgY2hyb21lLnJ1bnRpbWUuaWQgfSlcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR0aGlzLmN1cnJlbnRNZXNzYWdlID0gdGhpcy5fY3JlYXRlTWVzc2FnZSh0aXRsZSwgbWVzc2FnZSlcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnRNZXNzYWdlLmFjdGlvbnMucHVzaChhY3Rpb24pXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChlcnJvci5XRUJTVE9SRV9QRVJNSVNTSU9OKSB7XHJcblx0XHRcdFx0bGV0IHRpdGxlID0gJ1Blcm1pc3Npb25zIGVycm9yJ1xyXG5cdFx0XHRcdGxldCBtZXNzYWdlID1cclxuXHRcdFx0XHRcdFwiVGhlIHRvb2x0aXAgY2FuJ3QgYmUgZGlzcGxheWVkIG9uIHRoaXMgdGFiIGJlY2F1c2UgZXh0ZW5zaW9ucyBhcmUgbm90IGFsbG93ZWQgdG8gYWx0ZXIgdGhlIGNvbnRlbnQgb2YgdGhlIENocm9tZSBXZWJzdG9yZSBwYWdlcy5cIlxyXG5cdFx0XHRcdGxldCBhY3Rpb24gPSB7IHRpdGxlOiAnT0snLCBoYW5kbGVyOiB0aGlzLmRpc21pc3NNZXNzYWdlIH1cclxuXHJcblx0XHRcdFx0dGhpcy5jdXJyZW50TWVzc2FnZSA9IHRoaXMuX2NyZWF0ZU1lc3NhZ2UodGl0bGUsIG1lc3NhZ2UpXHJcblx0XHRcdFx0dGhpcy5jdXJyZW50TWVzc2FnZS5hY3Rpb25zLnB1c2goYWN0aW9uKVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X2hhbmRsZU9PQkVycm9yKGVycm9yKSB7XHJcblx0XHRcdGlmIChlcnJvciAmJiBlcnJvci5PVVRfT0ZfQk9VTkRTKSB7XHJcblx0XHRcdFx0dGhpcy5zaG93RXJyb3IoYENocm9tZSBjb3VsZG4ndCBhcHBseSB0aGUgZXhhY3QgZGVzaXJlZCBkaW1lbnNpb25zIWApXHJcblx0XHRcdFx0cmV0dXJuXHJcblxyXG5cdFx0XHRcdC8vIHZhciBrZXlzID0gZXJyb3IuT1VUX09GX0JPVU5EUy5rZXlzO1xyXG5cdFx0XHRcdC8vIHZhciBlcnJzID0gW107XHJcblxyXG5cdFx0XHRcdC8vIGlmIChrZXlzLmluZGV4T2YoJ01BWF9IRUlHSFQnKSA+IC0xKSB7XHJcblx0XHRcdFx0Ly8gXHRlcnJzLnB1c2goJ3RoZSB0YXJnZXQgPGI+aGVpZ2h0PC9iPiBpcyBncmVhdGVyIHRoYW4gdGhlIG1heGltdW0gYWxsb3dlZCBieSB5b3VyIGN1cnJlbnQgc2NyZWVuIHJlc29sdXRpb24nKTtcclxuXHRcdFx0XHQvLyB9XHJcblxyXG5cdFx0XHRcdC8vIGlmIChrZXlzLmluZGV4T2YoJ01BWF9XSURUSCcpID4gLTEpIHtcclxuXHRcdFx0XHQvLyBcdGVycnMucHVzaCgndGhlIHRhcmdldCA8Yj53aWR0aDwvYj4gaXMgZ3JlYXRlciB0aGFuIHRoZSBtYXhpbXVtIGFsbG93ZWQgYnkgeW91ciBjdXJyZW50IHNjcmVlbiByZXNvbHV0aW9uJyk7XHJcblx0XHRcdFx0Ly8gfVxyXG5cclxuXHRcdFx0XHQvLyBpZiAoa2V5cy5pbmRleE9mKCdNSU5fSEVJR0hUJykgPiAtMSkge1xyXG5cdFx0XHRcdC8vIFx0ZXJycy5wdXNoKCd0aGUgdGFyZ2V0IDxiPmhlaWdodDwvYj4gaXMgbG93ZXIgdGhhbiB0aGUgbWluaW11bSBhbGxvd2VkIGJ5IHlvdXIgYnJvd3NlciB3aW5kb3cnKTtcclxuXHRcdFx0XHQvLyB9XHJcblxyXG5cdFx0XHRcdC8vIGlmIChrZXlzLmluZGV4T2YoJ01JTl9XSURUSCcpID4gLTEpIHtcclxuXHRcdFx0XHQvLyBcdGVycnMucHVzaCgndGhlIHRhcmdldCA8Yj53aWR0aDwvYj4gaXMgbG93ZXIgdGhhbiB0aGUgbWF4aW11bSBhbGxvd2VkIGJ5IHlvdXIgYnJvd3NlciB3aW5kb3cnKTtcclxuXHRcdFx0XHQvLyB9XHJcblxyXG5cdFx0XHRcdC8vIHRoaXMuc2hvd01lc3NhZ2UoJ0VSUk9SJywgJzx1bD48bGk+JyArIGVycnMuam9pbignPC9saT48bGk+JykgKyAnPC9saT48L3VsPjxiPkhJTlQ6PC9iPiBBZGp1c3QgdGhlIHpvb20gbGV2ZWwgdGhlbiB0cnkgYWdhaW4uIChab29tIGluIGZvciBmZXdlciBhbmQgem9vbSBvdXQgZm9yIG1vcmUgQ1NTIHBpeGVscyknKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9oYW5kbGVQcm90b2NvbEVycm9yKGVycm9yKSB7XHJcblx0XHRcdGlmIChlcnJvci5JTlZBTElEX1BST1RPQ09MKSB7XHJcblx0XHRcdFx0dmFyIGVyciA9IGVycm9yLklOVkFMSURfUFJPVE9DT0xcclxuXHJcblx0XHRcdFx0aWYgKCFlcnIudGFiLnVybCkge1xyXG5cdFx0XHRcdFx0bGV0IHRpdGxlID0gJ0luc3VmZmljaWVudCBwZXJtaXNzaW9ucydcclxuXHRcdFx0XHRcdGxldCBtZXNzYWdlID1cclxuXHRcdFx0XHRcdFx0J0luIG9yZGVyIGZvciB0aGUgZXh0ZW5zaW9uIHRvIHdvcmsgb24gcmVndWxhciB3aW5kb3dzIGluIDxlbT5kZXRhY2hlZDwvZW0+IG1vZGUsIGl0IG5lZWRzIHRvIGJlIGFibGUgdG8gaW5qZWN0IGN1c3RvbSBjb2RlIGluIHRoZSBjb250ZXh0IG9mIGFsbCBwYWdlcywgd2l0aG91dCB1c2VyIGludGVyYWN0aW9uLidcclxuXHJcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRNZXNzYWdlID0gdGhpcy5fY3JlYXRlTWVzc2FnZSh0aXRsZSwgbWVzc2FnZSlcclxuXHRcdFx0XHRcdHRoaXMuY3VycmVudE1lc3NhZ2UuYWN0aW9ucy5wdXNoKHsgdGl0bGU6ICdDYW5jZWwnLCBoYW5kbGVyOiB0aGlzLmRpc21pc3NNZXNzYWdlIH0pXHJcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRNZXNzYWdlLmFjdGlvbnMucHVzaCh7XHJcblx0XHRcdFx0XHRcdHRpdGxlOiAnR3JhbnQgcGVybWlzc2lvbnMnLFxyXG5cdFx0XHRcdFx0XHRtYWluOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRoYW5kbGVyOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5kaXNtaXNzTWVzc2FnZSgpXHJcblx0XHRcdFx0XHRcdFx0Y2hyb21lLnBlcm1pc3Npb25zLnJlcXVlc3QoeyBwZXJtaXNzaW9uczogWyd0YWJzJ10sIG9yaWdpbnM6IFsnPGFsbF91cmxzPiddIH0sIGdyYW50ZWQgPT4ge30pXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLnNob3dNZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHQnSW52YWxpZCBwcm90b2NvbDogPGI+JyArIFN0cmluZyhlcnIucHJvdG9jb2wpICsgJzovLzwvYj4nLFxyXG5cdFx0XHRcdFx0XHQnVGhpcyBmZWF0dXJlIG9ubHkgd29ya3Mgb24gcGFnZXMgbG9hZGVkIHVzaW5nIG9uZSBvZiB0aGUgZm9sbG93aW5nIHByb3RvY29sczogPGJyIC8+PGI+aHR0cDovLzwvYj4sIDxiPmh0dHBzOi8vPC9iPiBvciA8Yj5maWxlOi8vPC9iPidcclxuXHRcdFx0XHRcdClcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfc2hvd0tleXMoKSB7XHJcblx0XHRcdHRoaXMuc2hvd0tleXMgPSB0cnVlXHJcblx0XHR9XHJcblx0XHRfaGlkZUtleXMoKSB7XHJcblx0XHRcdHRoaXMuc2hvd0tleXMgPSBmYWxzZVxyXG5cdFx0fVxyXG5cclxuXHRcdF9pbml0UGFuZWxzKCkge1xyXG5cdFx0XHR0aGlzLl9wYW5lbHMucHVzaChuZXcgTGlzdFBhbmVsKCcjcHJlc2V0c1BhbmVsJywgJ3dyLXByZXNldCcpKVxyXG5cdFx0XHR0aGlzLl9wYW5lbHMucHVzaChuZXcgTGlzdFBhbmVsKCcjdG9vbHNQYW5lbCcsICdidXR0b24nKSlcclxuXHJcblx0XHRcdHRoaXMuX3BhbmVsID0gdGhpcy5fcGFuZWxzWzBdXHJcblx0XHR9XHJcblxyXG5cdFx0X2ZvY3VzUGFuZWwoaWR4OiBudW1iZXIpIHtcclxuXHRcdFx0aWYgKGlkeCA9PT0gMSAmJiB0aGlzLmNvbGxhcHNlZFNpZGViYXIpIHtcclxuXHRcdFx0XHRyZXR1cm5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IHBhbmVsID0gdGhpcy5fcGFuZWxzW2lkeF1cclxuXHJcblx0XHRcdGlmIChwYW5lbCAhPSB0aGlzLl9wYW5lbCkge1xyXG5cdFx0XHRcdHRoaXMuX3BhbmVsICYmIHRoaXMuX3BhbmVsLmJsdXIoKVxyXG5cclxuXHRcdFx0XHR0aGlzLl9wYW5lbCA9IHBhbmVsXHJcblx0XHRcdFx0dGhpcy5fcGFuZWwuZm9jdXMoKVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aGFuZGxlQmFubmVyQ2xpY2soZXZ0LCBjdHgpIHtcclxuXHRcdFx0Y29uc3QgdGFyZ2V0ID0gZXZ0LmN1cnJlbnRUYXJnZXRcclxuXHRcdFx0Y29uc3QgdXJsID0gdGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS11cmwnKVxyXG5cdFx0XHRjb25zdCBhY3Rpb24gPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWFjdGlvbicpXHJcblxyXG5cdFx0XHRpZiAodXJsKSB7XHJcblx0XHRcdFx0RXh0QVBJLmludm9rZSgnb3Blbi11cmwnLCB7IHVybCB9KS5jYXRjaChMT0dfRVJST1IpXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Y3R4W2FjdGlvbl0oKVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aGFuZGxlUHJlc2V0Q2xpY2soZXZ0LCBjdHgpIHtcclxuXHRcdFx0dGhpcy5fZm9jdXNQYW5lbCgwKVxyXG5cdFx0XHQvL3RoaXMuX3BhbmVsLnJlc2V0KCk7XHJcblx0XHRcdHRoaXMuX3BhbmVsLnNlbGVjdEl0ZW0oZXZ0LmN1cnJlbnRUYXJnZXQpXHJcblxyXG5cdFx0XHR0aGlzLnJlc2l6ZVByZXNldChjdHgpXHJcblxyXG5cdFx0XHR0aGlzLmF1dG9DbG9zZVBvcHVwICYmICFpc1N0YW5kYWxvbmVQb3B1cCgpICYmIHdpbmRvdy5jbG9zZSgpXHJcblx0XHR9XHJcblxyXG5cdFx0aGFuZGxlVG9vbHNDbGljayhldnQsIGN0eCkge1xyXG5cdFx0XHRpZiAoZXZ0LnRhcmdldCBpbnN0YW5jZW9mIEhUTUxCdXR0b25FbGVtZW50KSB7XHJcblx0XHRcdFx0dGhpcy5fZm9jdXNQYW5lbCgxKVxyXG5cdFx0XHRcdHRoaXMuX3BhbmVsLnNlbGVjdEl0ZW0oZXZ0LnRhcmdldClcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGhhbmRsZUtleURvd24oZXZ0LCBjdHgpIHtcclxuXHRcdFx0bGV0IGtleUNvZGUgPSBldnQua2V5Q29kZVxyXG5cdFx0XHRsZXQgaGFuZGxlZCA9IHRydWVcclxuXHJcblx0XHRcdHN3aXRjaCAoa2V5Q29kZSkge1xyXG5cdFx0XHRcdGNhc2UgS2V5cy5TSElGVDpcclxuXHRcdFx0XHRcdGlmICghdGhpcy5zaG93S2V5cykge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnNob3dLZXlzID0gdHJ1ZVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0YnJlYWtcclxuXHJcblx0XHRcdFx0Y2FzZSBLZXlzLlNQQUNFOlxyXG5cdFx0XHRcdGNhc2UgS2V5cy5FTlRFUjpcclxuXHRcdFx0XHRcdCQuYWRkQ2xhc3ModGhpcy5fcGFuZWwuY3VycmVudE5vZGUoKSwgJ2FjdGl2ZScpXHJcblx0XHRcdFx0XHRicmVha1xyXG5cclxuXHRcdFx0XHRjYXNlIEtleXMuVVA6XHJcblx0XHRcdFx0XHR0aGlzLl9wYW5lbC5wcmV2KClcclxuXHRcdFx0XHRcdGJyZWFrXHJcblxyXG5cdFx0XHRcdGNhc2UgS2V5cy5ET1dOOlxyXG5cdFx0XHRcdFx0dGhpcy5fcGFuZWwubmV4dCgpXHJcblx0XHRcdFx0XHRicmVha1xyXG5cclxuXHRcdFx0XHRjYXNlIEtleXMuUklHSFQ6XHJcblx0XHRcdFx0XHR0aGlzLl9mb2N1c1BhbmVsKDEpXHJcblx0XHRcdFx0XHRicmVha1xyXG5cclxuXHRcdFx0XHRjYXNlIEtleXMuTEVGVDpcclxuXHRcdFx0XHRcdHRoaXMuX2ZvY3VzUGFuZWwoMClcclxuXHRcdFx0XHRcdGJyZWFrXHJcblxyXG5cdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0XHRoYW5kbGVkID0gZmFsc2VcclxuXHRcdFx0XHRcdGJyZWFrXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBub2RlID0gX2dldFByZXNldEJ5S2V5Q29kZShrZXlDb2RlKVxyXG5cdFx0XHRpZiAobm9kZSkge1xyXG5cdFx0XHRcdHRoaXMuX3BhbmVsLmZvY3VzKClcclxuXHRcdFx0XHR0aGlzLl9mb2N1c1BhbmVsKDApXHJcblx0XHRcdFx0dGhpcy5fcGFuZWwuc2VsZWN0SXRlbShub2RlKVxyXG5cclxuXHRcdFx0XHQkLmFkZENsYXNzKG5vZGUsICdhY3RpdmUnKVxyXG5cdFx0XHRcdGhhbmRsZWQgPSB0cnVlXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICghaGFuZGxlZCkge1xyXG5cdFx0XHRcdGxldCBjaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZShrZXlDb2RlKVxyXG5cdFx0XHRcdGxldCBub2RlID0gJC5xKGBbZGF0YS1rZXk9XCIke2NoYXJ9XCJdYClcclxuXHJcblx0XHRcdFx0aWYgKG5vZGUpIHtcclxuXHRcdFx0XHRcdHRoaXMuX3BhbmVsLmZvY3VzKClcclxuXHRcdFx0XHRcdHRoaXMuX2ZvY3VzUGFuZWwoMSlcclxuXHRcdFx0XHRcdHRoaXMuX3BhbmVsLnNlbGVjdEl0ZW0obm9kZSlcclxuXHJcblx0XHRcdFx0XHQkLmFkZENsYXNzKG5vZGUsICdhY3RpdmUnKVxyXG5cdFx0XHRcdFx0aGFuZGxlZCA9IHRydWVcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChoYW5kbGVkKSB7XHJcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KClcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGhhbmRsZUtleVVwKGV2dCwgY3R4KSB7XHJcblx0XHRcdGxldCBrZXlDb2RlID0gZXZ0LmtleUNvZGVcclxuXHRcdFx0bGV0IGhhbmRsZWQgPSB0cnVlXHJcblxyXG5cdFx0XHRzd2l0Y2ggKGtleUNvZGUpIHtcclxuXHRcdFx0XHRjYXNlIEtleXMuU0hJRlQ6XHJcblx0XHRcdFx0XHRpZiAodGhpcy5zaG93S2V5cykge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnNob3dLZXlzID0gZmFsc2VcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGJyZWFrXHJcblxyXG5cdFx0XHRcdGNhc2UgS2V5cy5TUEFDRTpcclxuXHRcdFx0XHRjYXNlIEtleXMuRU5URVI6XHJcblx0XHRcdFx0XHQkLnJlbW92ZUNsYXNzKHRoaXMuX3BhbmVsLmN1cnJlbnROb2RlKCksICdhY3RpdmUnKVxyXG5cdFx0XHRcdFx0JC50cmlnZ2VyKCdjbGljaycsIHRoaXMuX3BhbmVsLmN1cnJlbnROb2RlKCkpXHJcblx0XHRcdFx0XHRicmVha1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdFx0aGFuZGxlZCA9IGZhbHNlXHJcblx0XHRcdFx0XHRicmVha1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsZXQgbm9kZSA9IF9nZXRQcmVzZXRCeUtleUNvZGUoa2V5Q29kZSlcclxuXHRcdFx0aWYgKG5vZGUpIHtcclxuXHRcdFx0XHQkLnJlbW92ZUNsYXNzKG5vZGUsICdhY3RpdmUnKVxyXG5cdFx0XHRcdCQudHJpZ2dlcignY2xpY2snLCBub2RlKVxyXG5cdFx0XHRcdGhhbmRsZWQgPSB0cnVlXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICghaGFuZGxlZCkge1xyXG5cdFx0XHRcdGxldCBjaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZShrZXlDb2RlKVxyXG5cdFx0XHRcdGxldCBub2RlID0gJC5xKGBbZGF0YS1rZXk9XCIke2NoYXJ9XCJdYClcclxuXHJcblx0XHRcdFx0aWYgKG5vZGUpIHtcclxuXHRcdFx0XHRcdCQucmVtb3ZlQ2xhc3Mobm9kZSwgJ2FjdGl2ZScpXHJcblx0XHRcdFx0XHQkLnRyaWdnZXIoJ2NsaWNrJywgbm9kZSlcclxuXHRcdFx0XHRcdGhhbmRsZWQgPSB0cnVlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoaGFuZGxlZCkge1xyXG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpXHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpbml0TmF2aWdhdGlvbigpIHtcclxuXHRcdFx0bGV0IG1haW4gPSAkLnEoJyNtYWluJylcclxuXHJcblx0XHRcdCQub24oJ2tleWRvd24nLCBtYWluLCB0aGlzLmhhbmRsZUtleURvd24sIHRydWUpXHJcblx0XHRcdCQub24oJ2tleXVwJywgbWFpbiwgdGhpcy5oYW5kbGVLZXlVcCwgdHJ1ZSlcclxuXHJcblx0XHRcdGxldCBoID0gbmV3IEZvY3VzSGFuZGxlcihtYWluKVxyXG5cclxuXHRcdFx0bWFpbi5mb2N1cygpXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRjbGFzcyBGb2N1c0hhbmRsZXIge1xyXG5cdFx0cHJvdGVjdGVkIGlnbm9yZSA9IGZhbHNlXHJcblx0XHRwcm90ZWN0ZWQgZm9jdXNlZCA9IGZhbHNlXHJcblx0XHRwcm90ZWN0ZWQgdGFyZ2V0OiBIVE1MRWxlbWVudFxyXG5cclxuXHRcdGNvbnN0cnVjdG9yKHRhcmdldDogSFRNTEVsZW1lbnQpIHtcclxuXHRcdFx0dGhpcy50YXJnZXQgPSB0YXJnZXRcclxuXHRcdFx0dGhpcy5fX2luaXRIYW5kbGVycygpXHJcblxyXG5cdFx0XHQkLm9uKCdmb2N1cycsIHRoaXMudGFyZ2V0LCB0aGlzLm9uRm9jdXMsIHRydWUpXHJcblx0XHRcdCQub24oJ2JsdXInLCB0aGlzLnRhcmdldCwgdGhpcy5vbkJsdXIsIHRydWUpXHJcblx0XHRcdCQub24oJ21vdXNlZG93bicsIHRoaXMudGFyZ2V0LCB0aGlzLm9uTW91c2VEb3duLCB0cnVlKVxyXG5cdFx0XHQkLm9uKCdrZXlkb3duJywgZG9jdW1lbnQsIHRoaXMub25LZXlEb3duLCB0cnVlKVxyXG5cdFx0fVxyXG5cclxuXHRcdF9faW5pdEhhbmRsZXJzKCkge1xyXG5cdFx0XHR2YXIgaGFuZGxlcnMgPSBbJ29uRm9jdXMnLCAnb25CbHVyJywgJ29uS2V5RG93bicsICdvbk1vdXNlRG93biddXHJcblxyXG5cdFx0XHRmb3IgKHZhciBtZXRob2Qgb2YgaGFuZGxlcnMpIHtcclxuXHRcdFx0XHR0aGlzW21ldGhvZF0gPSBfX2V2ZW50SGFuZGxlcih0aGlzLCB0aGlzW21ldGhvZF0pXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZ1bmN0aW9uIF9fZXZlbnRIYW5kbGVyKGNvbnRleHQsIG1ldGhvZCkge1xyXG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiAoZXZ0KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gbWV0aG9kLmNhbGwoY29udGV4dCwgZXZ0LCB0aGlzKVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdG9uQmx1cihldnQpIHtcclxuXHRcdFx0aWYgKCF0aGlzLnRhcmdldC5jb250YWlucyhldnQucmVsYXRlZFRhcmdldCkpIHtcclxuXHRcdFx0XHQkLnJlbW92ZUNsYXNzKHRoaXMudGFyZ2V0LCAnZm9jdXNlZCcpXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZm9jdXNlZCA9IGZhbHNlXHJcblx0XHR9XHJcblxyXG5cdFx0b25Gb2N1cyhldnQpIHtcclxuXHRcdFx0aWYgKCF0aGlzLmlnbm9yZSkge1xyXG5cdFx0XHRcdCQuYWRkQ2xhc3ModGhpcy50YXJnZXQsICdmb2N1c2VkJylcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5mb2N1c2VkID0gdHJ1ZVxyXG5cdFx0fVxyXG5cclxuXHRcdG9uS2V5RG93bihldnQpIHtcclxuXHRcdFx0dGhpcy5pZ25vcmUgPSBmYWxzZVxyXG5cdFx0XHRpZiAodGhpcy5mb2N1c2VkKSB7XHJcblx0XHRcdFx0JC5hZGRDbGFzcyh0aGlzLnRhcmdldCwgJ2ZvY3VzZWQnKVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0b25Nb3VzZURvd24oZXZ0KSB7XHJcblx0XHRcdCQucmVtb3ZlQ2xhc3ModGhpcy50YXJnZXQsICdmb2N1c2VkJylcclxuXHRcdFx0dGhpcy5pZ25vcmUgPSB0cnVlXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfc3RlYWxGb2N1cyhldnQsIGN0eCkge1xyXG5cdFx0ZXZ0LnByZXZlbnREZWZhdWx0KClcclxuXHRcdGV2dC5zdG9wUHJvcGFnYXRpb24oKVxyXG5cdFx0dGhpcy5mb2N1cygpXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfZ2V0UHJlc2V0QnlLZXlDb2RlKGtleUNvZGU6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcclxuXHRcdHZhciBub2RlOiBIVE1MRWxlbWVudFxyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0KGtleUNvZGUgPj0gS2V5cy5ESUdJVFNbMF0gJiYga2V5Q29kZSA8PSBLZXlzLkRJR0lUU1sxXSkgfHxcclxuXHRcdFx0KGtleUNvZGUgPj0gS2V5cy5OVU1QQURbMF0gJiYga2V5Q29kZSA8PSBLZXlzLk5VTVBBRFsxXSlcclxuXHRcdCkge1xyXG5cdFx0XHRsZXQgaWR4ID0ga2V5Q29kZSAlIDQ4IHx8IDEwXHJcblx0XHRcdG5vZGUgPSAkLnEoYHdyLXByZXNldDpudGgtb2YtdHlwZSgke2lkeH0pYClcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbm9kZVxyXG5cdH1cclxuXHJcblx0Y2xhc3MgTGlzdFBhbmVsIHtcclxuXHRcdHBhcmVudDogRWxlbWVudCA9IG51bGxcclxuXHRcdGxpc3Q6IHN0cmluZyA9IG51bGxcclxuXHRcdGN1cnJlbnQ6IG51bWJlciA9IC0xXHJcblxyXG5cdFx0YXV0b0luaXQ6IGJvb2xlYW4gPSB0cnVlXHJcblxyXG5cdFx0X3NlbGVjdGVkOiBzdHJpbmcgPSAnc2VsZWN0ZWQnXHJcblx0XHRfZm9jdXNlZDogc3RyaW5nID0gJ2ZvY3VzZWQnXHJcblxyXG5cdFx0Y29uc3RydWN0b3IocGFyZW50OiBzdHJpbmcsIGxpc3Q6IHN0cmluZykge1xyXG5cdFx0XHR0aGlzLnBhcmVudCA9IDxFbGVtZW50PiQucShwYXJlbnQpXHJcblx0XHRcdHRoaXMubGlzdCA9IGxpc3RcclxuXHRcdH1cclxuXHJcblx0XHRuZXh0KCkge1xyXG5cdFx0XHRsZXQgbm9kZXMgPSAkLnFBbGwodGhpcy5saXN0LCB0aGlzLnBhcmVudClcclxuXHRcdFx0bGV0IG5leHQgPSAodGhpcy5jdXJyZW50ICsgMSkgJSBub2Rlcy5sZW5ndGhcclxuXHJcblx0XHRcdHRoaXMuc2VsZWN0KG5leHQsIG5vZGVzKVxyXG5cdFx0fVxyXG5cclxuXHRcdHByZXYoKSB7XHJcblx0XHRcdGxldCBub2RlcyA9ICQucUFsbCh0aGlzLmxpc3QsIHRoaXMucGFyZW50KVxyXG5cdFx0XHRsZXQgcHJldiA9IChub2Rlcy5sZW5ndGggKyB0aGlzLmN1cnJlbnQgLSAxKSAlIG5vZGVzLmxlbmd0aFxyXG5cclxuXHRcdFx0dGhpcy5zZWxlY3QocHJldiwgbm9kZXMpXHJcblx0XHR9XHJcblxyXG5cdFx0c2VsZWN0KG5leHQsIG5vZGVzLCBub0ZvY3VzPykge1xyXG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbCA9IG5vZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRcdGxldCBub2RlID0gPEVsZW1lbnQ+bm9kZXNbaV1cclxuXHRcdFx0XHRub2RlLmNsYXNzTGlzdC5yZW1vdmUodGhpcy5fc2VsZWN0ZWQpXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBub2RlID0gPEhUTUxFbGVtZW50Pm5vZGVzW25leHRdXHJcblx0XHRcdHRoaXMuX3NlbGVjdE5vZGUobm9kZSlcclxuXHJcblx0XHRcdHRoaXMuY3VycmVudCA9IG5leHRcclxuXHJcblx0XHRcdGlmICghbm9Gb2N1cykge1xyXG5cdFx0XHRcdHRoaXMuZm9jdXMoKVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9jdXMoKSB7XHJcblx0XHRcdHRoaXMucGFyZW50LmNsYXNzTGlzdC5hZGQoJ2ZvY3VzZWQnKVxyXG5cclxuXHRcdFx0aWYgKHRoaXMuYXV0b0luaXQgJiYgdGhpcy5jdXJyZW50IDwgMCkge1xyXG5cdFx0XHRcdHRoaXMubmV4dCgpXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX3NlbGVjdE5vZGUodGhpcy5jdXJyZW50Tm9kZSgpKVxyXG5cdFx0fVxyXG5cclxuXHRcdGJsdXIoKSB7XHJcblx0XHRcdHRoaXMucGFyZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2ZvY3VzZWQnKVxyXG5cdFx0fVxyXG5cclxuXHRcdHJlc2V0KCkge1xyXG5cdFx0XHRsZXQgbm9kZXMgPSAkLnFBbGwodGhpcy5saXN0LCB0aGlzLnBhcmVudClcclxuXHJcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsID0gbm9kZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdFx0bGV0IG5vZGUgPSBub2Rlc1tpXVxyXG5cdFx0XHRcdG5vZGUuY2xhc3NMaXN0LnJlbW92ZSh0aGlzLl9zZWxlY3RlZClcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5jdXJyZW50ID0gLTFcclxuXHRcdH1cclxuXHJcblx0XHRzZWxlY3RJdGVtKGl0ZW06IE5vZGUpIHtcclxuXHRcdFx0bGV0IG5vZGVzID0gJC5xQWxsKHRoaXMubGlzdCwgdGhpcy5wYXJlbnQpXHJcblx0XHRcdGxldCBmb3VuZCA9IC0xXHJcblxyXG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbCA9IG5vZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRcdGlmIChpdGVtID09IG5vZGVzW2ldKSB7XHJcblx0XHRcdFx0XHRmb3VuZCA9IGlcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChmb3VuZCA+IC0xICYmIGZvdW5kICE9IHRoaXMuY3VycmVudCkge1xyXG5cdFx0XHRcdGxldCBub2RlID0gPEhUTUxFbGVtZW50Pm5vZGVzW2ZvdW5kXVxyXG5cdFx0XHRcdHRoaXMucmVzZXQoKVxyXG5cdFx0XHRcdHRoaXMuX3NlbGVjdE5vZGUobm9kZSlcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnQgPSBmb3VuZFxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Y3VycmVudE5vZGUoKSB7XHJcblx0XHRcdGxldCBub2RlcyA9ICQucUFsbCh0aGlzLmxpc3QsIHRoaXMucGFyZW50KVxyXG5cdFx0XHRyZXR1cm4gPEhUTUxFbGVtZW50Pm5vZGVzW3RoaXMuY3VycmVudF1cclxuXHRcdH1cclxuXHJcblx0XHRfc2VsZWN0Tm9kZShub2RlOiBIVE1MRWxlbWVudCkge1xyXG5cdFx0XHRub2RlLmNsYXNzTGlzdC5hZGQodGhpcy5fc2VsZWN0ZWQpXHJcblx0XHRcdG5vZGUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJylcclxuXHRcdFx0bm9kZS5mb2N1cygpXHJcblx0XHRcdG5vZGUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICctMScpXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRleHBvcnQgdmFyIHZpZXcgPSBuZXcgUG9wdXAoKVxyXG5cdHZhciBiaW5kaW5nID0gcml2ZXRzLmJpbmQoZG9jdW1lbnQuYm9keSwgdmlldylcclxuXHR2aWV3LmluaXROYXZpZ2F0aW9uKClcclxuXHJcblx0Y2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKG1zZyA9PiB7XHJcblx0XHRpZiAobXNnLlVwZGF0ZWRTZXR0aW5ncykge1xyXG5cdFx0XHRpZiAoJ2xpY2Vuc2UnIGluIG1zZy5VcGRhdGVkU2V0dGluZ3MgJiYgbXNnLlVwZGF0ZWRTZXR0aW5ncy5saWNlbnNlKSB7XHJcblx0XHRcdFx0Ly8gdmlldy5jdXJyZW50QmFubmVyID0gbnVsbFxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoJ3ByZXNldHNJY29uc1N0eWxlJyBpbiBtc2cuVXBkYXRlZFNldHRpbmdzKSB7XHJcblx0XHRcdFx0dmlldy5wcmVzZXRzSWNvbnNTdHlsZSA9IG1zZy5VcGRhdGVkU2V0dGluZ3MucHJlc2V0c0ljb25zU3R5bGVcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCdwcmVzZXRzUHJpbWFyeUxpbmUnIGluIG1zZy5VcGRhdGVkU2V0dGluZ3MpIHtcclxuXHRcdFx0XHR2aWV3LnByZXNldHNQcmltYXJ5TGluZSA9IG1zZy5VcGRhdGVkU2V0dGluZ3MucHJlc2V0c1ByaW1hcnlMaW5lXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICgnYWx0ZXJuYXRlUHJlc2V0c0JnJyBpbiBtc2cuVXBkYXRlZFNldHRpbmdzKSB7XHJcblx0XHRcdFx0dmlldy5hbHRlcm5hdGVQcmVzZXRzQmcgPSBtc2cuVXBkYXRlZFNldHRpbmdzLmFsdGVybmF0ZVByZXNldHNCZ1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoJ2F1dG9DbG9zZVBvcHVwJyBpbiBtc2cuVXBkYXRlZFNldHRpbmdzKSB7XHJcblx0XHRcdFx0dmlldy5hdXRvQ2xvc2VQb3B1cCA9IG1zZy5VcGRhdGVkU2V0dGluZ3MuYXV0b0Nsb3NlUG9wdXBcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCdoaWRlUHJlc2V0c0Rlc2NyaXB0aW9uJyBpbiBtc2cuVXBkYXRlZFNldHRpbmdzKSB7XHJcblx0XHRcdFx0dmlldy5oaWRlUHJlc2V0c0Rlc2NyaXB0aW9uID0gbXNnLlVwZGF0ZWRTZXR0aW5ncy5oaWRlUHJlc2V0c0Rlc2NyaXB0aW9uXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICgnaGlkZVBvcHVwVG9vbHRpcHMnIGluIG1zZy5VcGRhdGVkU2V0dGluZ3MpIHtcclxuXHRcdFx0XHR2aWV3LmhpZGVQb3B1cFRvb2x0aXBzID0gbXNnLlVwZGF0ZWRTZXR0aW5ncy5oaWRlUG9wdXBUb29sdGlwc1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoJ2hpZGVRdWlja1Jlc2l6ZScgaW4gbXNnLlVwZGF0ZWRTZXR0aW5ncykge1xyXG5cdFx0XHRcdHZpZXcuaGlkZVF1aWNrUmVzaXplID0gbXNnLlVwZGF0ZWRTZXR0aW5ncy5oaWRlUXVpY2tSZXNpemVcclxuXHRcdFx0XHR3aW5kb3cubG9jYWxTdG9yYWdlWydoaWRlUXVpY2tSZXNpemUnXSA9IG1zZy5VcGRhdGVkU2V0dGluZ3MuaGlkZVF1aWNrUmVzaXplID8gMSA6IDBcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCdwcmVzZXRzJyBpbiBtc2cuVXBkYXRlZFNldHRpbmdzKSB7XHJcblx0XHRcdFx0dmlldy5wcmVzZXRzID0gW11cclxuXHRcdFx0XHRmb3IgKGxldCBwcmVzZXREYXRhIG9mIG1zZy5VcGRhdGVkU2V0dGluZ3MucHJlc2V0cykge1xyXG5cdFx0XHRcdFx0dmlldy5wcmVzZXRzLnB1c2gobmV3IENvcmUuUHJlc2V0KHByZXNldERhdGEpKVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0pXHJcblxyXG5cdGZ1bmN0aW9uIExPR19FUlJPUihlcnI6IGFueSkge1xyXG5cdFx0Y29uc29sZS5sb2coZXJyKVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNTdGFuZGFsb25lUG9wdXAoKSB7XHJcblx0XHRyZXR1cm4gd2luZG93LmxvY2F0aW9uLmhhc2guaW5kZXhPZigncG9wdXAtdmlldycpID4gLTFcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9jb25zdHJhaW5XaW5kb3dTaXplKCkge1xyXG5cdFx0dmFyIGxpbWl0OiBhbnkgPSB7fVxyXG5cclxuXHRcdGlmICh3aW5kb3cuaW5uZXJXaWR0aCA8IDM0MCkge1xyXG5cdFx0XHRsaW1pdC53aWR0aCA9IDM0MCArIHdpbmRvdy5vdXRlcldpZHRoIC0gd2luZG93LmlubmVyV2lkdGhcclxuXHRcdH1cclxuXHJcblx0XHRpZiAod2luZG93LmlubmVySGVpZ2h0IDwgNDAwKSB7XHJcblx0XHRcdGxpbWl0LmhlaWdodCA9IDQwMCArIHdpbmRvdy5vdXRlckhlaWdodCAtIHdpbmRvdy5pbm5lckhlaWdodFxyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsaW1pdC53aWR0aCB8fCBsaW1pdC5oZWlnaHQpIHtcclxuXHRcdFx0RXh0QVBJLmludm9rZSgnbGltaXQtcG9wdXAnLCBsaW1pdClcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmIChpc1N0YW5kYWxvbmVQb3B1cCgpKSB7XHJcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgX2NvbnN0cmFpbldpbmRvd1NpemUpXHJcblx0fVxyXG59XHJcbiJdfQ==
