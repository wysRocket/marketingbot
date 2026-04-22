var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var Core;
(function (Core) {
    let PresetType;
    (function (PresetType) {
        PresetType[PresetType["PHONE"] = 0] = "PHONE";
        PresetType[PresetType["TABLET"] = 1] = "TABLET";
        PresetType[PresetType["LAPTOP"] = 2] = "LAPTOP";
        PresetType[PresetType["DESKTOP"] = 3] = "DESKTOP";
    })(PresetType = Core.PresetType || (Core.PresetType = {}));
    let PresetTarget;
    (function (PresetTarget) {
        PresetTarget[PresetTarget["WINDOW"] = 0] = "WINDOW";
        PresetTarget[PresetTarget["VIEWPORT"] = 1] = "VIEWPORT";
    })(PresetTarget = Core.PresetTarget || (Core.PresetTarget = {}));
    let PresetPosition;
    (function (PresetPosition) {
        PresetPosition[PresetPosition["DEFAULT"] = 0] = "DEFAULT";
        PresetPosition[PresetPosition["CUSTOM"] = 1] = "CUSTOM";
        PresetPosition[PresetPosition["CENTER"] = 2] = "CENTER";
    })(PresetPosition = Core.PresetPosition || (Core.PresetPosition = {}));
    let PopupIconStyle;
    (function (PopupIconStyle) {
        PopupIconStyle[PopupIconStyle["MONOCHROME"] = 0] = "MONOCHROME";
        PopupIconStyle[PopupIconStyle["COLORED"] = 1] = "COLORED";
        PopupIconStyle[PopupIconStyle["CONTRAST"] = 2] = "CONTRAST";
    })(PopupIconStyle = Core.PopupIconStyle || (Core.PopupIconStyle = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/html5.d.ts" />
var Core;
(function (Core) {
    var Utils;
    (function (Utils) {
        function UUID() {
            let uuid;
            let bytes = crypto.getRandomValues(new Uint8Array(21));
            let hexed = val => (val % 16).toString(16);
            bytes[12] = 4;
            bytes[16] = bytes[16] & 0x3 | 0x8;
            uuid = Array.from(bytes, hexed).join('');
            uuid = uuid + Date.now().toString(16);
            uuid = uuid.replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
            return uuid.toUpperCase();
        }
        Utils.UUID = UUID;
    })(Utils = Core.Utils || (Core.Utils = {}));
})(Core || (Core = {}));
var Core;
(function (Core) {
    var Utils;
    (function (Utils) {
        var Request;
        (function (Request) {
            function Get(url) {
                return new Promise((resolve, reject) => {
                    var xhr = new XMLHttpRequest();
                    xhr.addEventListener('load', resolve);
                    xhr.addEventListener('error', reject);
                    xhr.addEventListener('abort', reject);
                    xhr.open('GET', url);
                    xhr.send();
                });
            }
            Request.Get = Get;
            function GetJSON(url) {
                return Get(url).then(data => Promise.resolve(JSON.parse(data.target.responseText)));
            }
            Request.GetJSON = GetJSON;
            function Post(url, data) {
                return _post(url, data).then(response => response.text());
            }
            Request.Post = Post;
            function PostJSON(url, data) {
                return _post(url, data).then(response => response.json());
            }
            Request.PostJSON = PostJSON;
            function _post(url, data) {
                let parts = [];
                for (let k in data) {
                    let name = encodeURIComponent(k);
                    let value = encodeURIComponent(data[k]);
                    parts.push(`${name}=${value}`);
                }
                const init = {
                    method: 'POST',
                    body: parts.join('&'),
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }
                };
                return fetch(url, init);
            }
        })(Request = Utils.Request || (Utils.Request = {}));
    })(Utils = Core.Utils || (Core.Utils = {}));
})(Core || (Core = {}));
var ResizerAPI;
(function (ResizerAPI) {
    var Tooltip;
    (function (Tooltip) {
        function _message(tabId, message) {
            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, message, answer => resolve(chrome.runtime.lastError ? null : answer));
            });
        }
        Tooltip.HIDDEN = 'HIDDEN';
        Tooltip.VISIBLE = 'VISIBLE';
        function Enable(tabId) {
            return new Promise((resolve, reject) => {
                chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['scripts/enable-tooltip.js'],
                }, result => resolve(!chrome.runtime.lastError));
            });
        }
        Tooltip.Enable = Enable;
        function Disable(tabId) {
            return _message(tabId, 'DISABLE');
        }
        Tooltip.Disable = Disable;
        function GetStatus(tabId) {
            return _message(tabId, 'STATUS');
        }
        Tooltip.GetStatus = GetStatus;
        function Show(tabId) {
            return _message(tabId, 'SHOW');
        }
        Tooltip.Show = Show;
        function Hide(tabId) {
            return _message(tabId, 'HIDE');
        }
        Tooltip.Hide = Hide;
        function Toggle(tabId) {
            return _message(tabId, 'STATUS').then(status => {
                if (status === null) {
                    return Tooltip.Enable(tabId).then(result => {
                        setTimeout(() => Tooltip.Show(tabId), 100);
                        return result;
                    });
                }
                return _message(tabId, 'TOGGLE');
            });
        }
        Tooltip.Toggle = Toggle;
        function SetTimeout(tabId, timeout) {
            return _message(tabId, { command: 'SET_HIDE_DELAY', delay: timeout });
        }
        Tooltip.SetTimeout = SetTimeout;
        function EnableOnAllPages() {
            if (chrome.webNavigation && !chrome.webNavigation.onDOMContentLoaded.hasListener(enableOnNewTabs)) {
                chrome.webNavigation.onDOMContentLoaded.addListener(enableOnNewTabs);
            }
            chrome.tabs.query({}, tabs => {
                for (let tab of tabs) {
                    Enable(tab.id);
                }
            });
        }
        Tooltip.EnableOnAllPages = EnableOnAllPages;
        function DisableOnAllPages() {
            if (chrome.webNavigation) {
                while (chrome.webNavigation.onDOMContentLoaded.hasListener(enableOnNewTabs)) {
                    chrome.webNavigation.onDOMContentLoaded.removeListener(enableOnNewTabs);
                }
            }
            chrome.tabs.query({}, tabs => {
                for (let tab of tabs) {
                    Disable(tab.id);
                }
            });
        }
        Tooltip.DisableOnAllPages = DisableOnAllPages;
        function enableOnNewTabs(details) {
            if (details.tabId && !details.frameId) {
                Enable(details.tabId);
            }
        }
    })(Tooltip = ResizerAPI.Tooltip || (ResizerAPI.Tooltip = {}));
})(ResizerAPI || (ResizerAPI = {}));
var ResizerAPI;
(function (ResizerAPI) {
    var Settings;
    (function (Settings) {
        var PresetType = Core.PresetType;
        var PresetTarget = Core.PresetTarget;
        var PresetPosition = Core.PresetPosition;
        Settings.DefaultSettings = {
            alwaysCenterTheWindow: false,
            leftAlignWindow: false,
            alwaysShowTheTooltip: false,
            hideTooltipDelay: 3000,
            tooltipPosition: ['bottom', 'right'],
            popupIconStyle: 'dark+color',
            presetsIconsStyle: 'clear',
            alternatePresetsBg: false,
            autoClosePopup: false,
            presetsPrimaryLine: '',
            hidePresetsDescription: false,
            hidePopupTooltips: false,
            hideQuickResize: false,
            originalInstallDate: null,
            license: null,
            presets: []
        };
        function _getStore(local = false, force = false) {
            let store = local ? chrome.storage.local : chrome.storage.sync;
            if (force) {
                return Promise.resolve(store);
            }
            return new Promise((resolve, reject) => {
                chrome.storage.local.get({ disableSync: false }, settings => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    let store = local || settings.disableSync ? chrome.storage.local : chrome.storage.sync;
                    resolve(store);
                });
            });
        }
        function _getLicense() {
            return new Promise((resolve, reject) => {
                return _getStore(false, true).then(store => {
                    store.get({ license: null }, data => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(data.license);
                    });
                });
            });
        }
        function Set(key, value, local = false) {
            let data = _normalize(key, value);
            if ('license' in data) {
                _getStore(false, true).then(store => {
                    store.set({ license: data.license });
                });
            }
            return _getStore(local).then(store => {
                return new Promise((resolve, reject) => {
                    store.set(data, () => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(data);
                    });
                });
            });
        }
        Settings.Set = Set;
        function Get(key, defaultValue, local = false) {
            let keys = _normalize(key, defaultValue);
            return _getLicense().then(license => _getStore(local).then(store => {
                return new Promise((resolve, reject) => {
                    store.get(keys, settings => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        settings.license = license;
                        if (typeof (key) === 'string') {
                            return resolve(settings[key]);
                        }
                        for (let k in Settings.DefaultSettings) {
                            if (!(k in settings)) {
                                settings[k] = Settings.DefaultSettings[k];
                            }
                        }
                        return resolve(settings);
                    });
                });
            }));
        }
        Settings.Get = Get;
        function Del(key, local = false) {
            let keys = (key instanceof Array) ? key : [key];
            return _getStore(local).then(store => {
                return new Promise((resolve, reject) => {
                    store.remove(keys, () => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        return resolve();
                    });
                });
            });
        }
        Settings.Del = Del;
        function _normalize(key, defaultValue) {
            let keys = {};
            if (typeof (key) === 'string') {
                if (defaultValue === undefined) {
                    defaultValue = Settings.DefaultSettings[key];
                }
                keys[key] = defaultValue;
            }
            else {
                keys = key;
            }
            return keys;
        }
        function _handler(resolve, reject) {
            return function (data) {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve(data);
            };
        }
        function ParseV1(data) {
            if (!data) {
                return;
            }
            let settings = {};
            let presets = JSON.parse(data['WindowResizer.Rows']);
            settings.alwaysShowTheTooltip = data['WindowResizer.Tooltip'] != 1;
            settings.hideTooltipDelay = parseInt(data['WindowResizer.TooltipDelay'], 10) || Settings.DefaultSettings.hideTooltipDelay;
            settings.hidePresetsDescription = data['WindowResizer.PopupDescription'] == 1;
            settings.presets = [];
            for (let preset of presets) {
                settings.presets.push({
                    id: Core.Utils.UUID(),
                    width: _parseNumber(preset.width),
                    height: _parseNumber(preset.height),
                    top: _parseNumber(preset.Y),
                    left: _parseNumber(preset.X),
                    description: preset.title || null,
                    position: _parsePosition(preset.pos),
                    type: _parseType(preset.type),
                    target: _parseTarget(preset.target)
                });
            }
            return settings;
            function _parseNumber(value) {
                return parseInt(value, 10) || null;
            }
            function _parseTarget(value) {
                return value == 'window' ? PresetTarget.WINDOW : PresetTarget.VIEWPORT;
            }
            function _parsePosition(value) {
                let pos = parseInt(value, 10) || 0;
                switch (pos) {
                    case 1: return PresetPosition.CUSTOM;
                    case 3: return PresetPosition.CENTER;
                }
                return PresetPosition.DEFAULT;
            }
            function _parseType(value) {
                switch (value) {
                    case 'desktop': return PresetType.DESKTOP;
                    case 'laptop': return PresetType.LAPTOP;
                    case 'tablet': return PresetType.TABLET;
                    case 'smartphone': return PresetType.PHONE;
                    case 'featurephone': return PresetType.PHONE;
                }
                return PresetType.DESKTOP;
            }
        }
        Settings.ParseV1 = ParseV1;
        Settings.DefaultSettings.presets.push({
            id: 'D482CEBD-12DC-457D-8FCF-B15226DFEDD8',
            width: 320,
            height: 568,
            target: Core.PresetTarget.VIEWPORT,
            description: 'iPhone 5',
            type: Core.PresetType.PHONE
        });
        Settings.DefaultSettings.presets.push({
            id: 'A1D7D065-33B0-44BD-8F20-A15226DFF237',
            width: 375,
            height: 667,
            target: Core.PresetTarget.VIEWPORT,
            description: 'iPhone 6',
            type: Core.PresetType.PHONE
        });
        Settings.DefaultSettings.presets.push({
            id: 'FF3DE6CD-F560-4576-811F-E15226DFF45F',
            width: 1024,
            height: 768,
            target: Core.PresetTarget.VIEWPORT,
            description: 'iPad',
            type: Core.PresetType.TABLET
        });
        Settings.DefaultSettings.presets.push({
            id: '27ACDD9C-9A94-44F8-B333-C15226DFF5FF',
            width: 1440,
            height: 900,
            target: Core.PresetTarget.WINDOW,
            description: 'Laptop',
            type: Core.PresetType.LAPTOP
        });
        Settings.DefaultSettings.presets.push({
            id: '2256E7AD-B7BA-40B7-9969-415226DFF817',
            width: 1680,
            height: 1050,
            target: Core.PresetTarget.WINDOW,
            description: 'Desktop',
            type: Core.PresetType.DESKTOP
        });
        Settings.DefaultSettings.presets.push({
            id: '2256E7AD-B7BA-40B7-9969-415226DFF818',
            width: 1920,
            height: 1080,
            target: Core.PresetTarget.WINDOW,
            description: 'Desktop',
            type: Core.PresetType.DESKTOP
        });
        Settings.DefaultSettings.presets.push({
            id: 'C76F48DB-B2D2-4DEA-B35D-6152606F883D',
            width: 2560,
            height: 1440,
            target: Core.PresetTarget.WINDOW,
            description: 'Desktop',
            type: Core.PresetType.DESKTOP
        });
    })(Settings = ResizerAPI.Settings || (ResizerAPI.Settings = {}));
})(ResizerAPI || (ResizerAPI = {}));
var ResizerAPI;
(function (ResizerAPI) {
    var SettingsPage;
    (function (SettingsPage) {
        let currentPage = null;
        function Open(page = null) {
            page = page || '#settings';
            currentPage = page;
            return new Promise((resolve, reject) => {
                chrome.runtime.openOptionsPage(() => {
                    chrome.runtime.sendMessage({ showPage: page }, (response) => {
                        if (chrome.runtime.lastError) {
                            // it's ok, don't need to do anything
                        }
                        resolve(response);
                    });
                    return true;
                });
            });
        }
        SettingsPage.Open = Open;
        function Current() {
            return Promise.resolve(currentPage);
        }
        SettingsPage.Current = Current;
    })(SettingsPage = ResizerAPI.SettingsPage || (ResizerAPI.SettingsPage = {}));
})(ResizerAPI || (ResizerAPI = {}));
var ResizerAPI;
(function (ResizerAPI) {
    var Chrome;
    (function (Chrome) {
        var Windows;
        (function (Windows) {
            Windows.NONE = chrome.windows.WINDOW_ID_NONE;
            function Get(winId, config) {
                config = config || { populate: true };
                return new Promise((resolve, reject) => {
                    chrome.windows.get(winId, config, win => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(win);
                    });
                });
            }
            Windows.Get = Get;
            function All(config) {
                return new Promise((resolve, reject) => {
                    chrome.windows.getAll(config, win => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(win);
                    });
                });
            }
            Windows.All = All;
            function Create(config) {
                return new Promise((resolve, reject) => {
                    chrome.windows.create(config, win => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(win);
                    });
                });
            }
            Windows.Create = Create;
            function CreatePopup(url, config = {}) {
                config.url = url;
                config.type = 'popup';
                return Create(config);
            }
            Windows.CreatePopup = CreatePopup;
            function Update(winId, config) {
                return new Promise((resolve, reject) => {
                    chrome.windows.update(winId, config, win => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(win);
                    });
                });
            }
            Windows.Update = Update;
            function On(name, callback) {
                let event = chrome.windows['on' + name];
                event && !event.hasListener(callback) && event.addListener(callback);
            }
            Windows.On = On;
            function Off(name, callback) {
                let event = chrome.windows['on' + name];
                event && event.removeListener(callback);
            }
            Windows.Off = Off;
        })(Windows = Chrome.Windows || (Chrome.Windows = {}));
    })(Chrome = ResizerAPI.Chrome || (ResizerAPI.Chrome = {}));
})(ResizerAPI || (ResizerAPI = {}));
var ResizerAPI;
(function (ResizerAPI) {
    var Chrome;
    (function (Chrome) {
        var Tabs;
        (function (Tabs) {
            function Query(filter = {}) {
                return new Promise((resolve, reject) => {
                    function _done(tabs) {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        if (!(tabs instanceof Array)) {
                            tabs = [tabs];
                        }
                        resolve(tabs);
                    }
                    if (typeof filter === 'number') {
                        chrome.tabs.get(filter, _done);
                    }
                    else {
                        chrome.tabs.query(filter, _done);
                    }
                });
            }
            Tabs.Query = Query;
            function GetActive(winId) {
                let filter = {
                    active: true,
                    windowId: winId
                };
                return new Promise((resolve, reject) => {
                    chrome.tabs.query(filter, tabs => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(tabs[0]);
                    });
                });
            }
            Tabs.GetActive = GetActive;
            function Create(config) {
                return new Promise((resolve, reject) => {
                    chrome.windows.create(config, win => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(win);
                    });
                });
            }
            Tabs.Create = Create;
            function CreatePopup(url, config) {
                config.url = url;
                config.type = 'popup';
                return Create(config);
            }
            Tabs.CreatePopup = CreatePopup;
            function Update(winId, config) {
                return new Promise((resolve, reject) => {
                    chrome.windows.update(winId, config, win => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(win);
                    });
                });
            }
            Tabs.Update = Update;
            function Duplicate(tabId) {
                return new Promise((resolve, reject) => {
                    chrome.tabs.duplicate(tabId, tab => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(tab);
                    });
                });
            }
            Tabs.Duplicate = Duplicate;
            function GetZoom(tabId) {
                return new Promise((resolve, reject) => {
                    chrome.tabs.getZoom(tabId, zoom => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(zoom);
                    });
                });
            }
            Tabs.GetZoom = GetZoom;
        })(Tabs = Chrome.Tabs || (Chrome.Tabs = {}));
    })(Chrome = ResizerAPI.Chrome || (ResizerAPI.Chrome = {}));
})(ResizerAPI || (ResizerAPI = {}));
var ResizerAPI;
(function (ResizerAPI) {
    var Chrome;
    (function (Chrome) {
        var Runtime;
        (function (Runtime) {
            function Error() {
                return chrome.runtime.lastError;
            }
            Runtime.Error = Error;
            function Broadcast(message) {
                return new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(message, response => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve(response);
                    });
                });
            }
            Runtime.Broadcast = Broadcast;
            function On(name, callback) {
                let event = chrome.runtime['on' + name];
                event && !event.hasListener(callback) && event.addListener(callback);
            }
            Runtime.On = On;
            function Off(name, callback) {
                let event = chrome.runtime['on' + name];
                event && event.removeListener(callback);
            }
            Runtime.Off = Off;
        })(Runtime = Chrome.Runtime || (Chrome.Runtime = {}));
    })(Chrome = ResizerAPI.Chrome || (ResizerAPI.Chrome = {}));
})(ResizerAPI || (ResizerAPI = {}));
var ResizerAPI;
(function (ResizerAPI) {
    var Chrome;
    (function (Chrome) {
        var ContextMenus;
        (function (ContextMenus) {
            function Create(config) {
                return new Promise((resolve, reject) => {
                    chrome.contextMenus.create(config, () => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve();
                    });
                });
            }
            ContextMenus.Create = Create;
            function Update(itemId, config) {
                return new Promise((resolve, reject) => {
                    chrome.contextMenus.update(itemId, config, () => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve();
                    });
                });
            }
            ContextMenus.Update = Update;
            function Remove(itemId) {
                return new Promise((resolve, reject) => {
                    chrome.contextMenus.remove(itemId, () => {
                        if (chrome.runtime.lastError) {
                            return reject(chrome.runtime.lastError);
                        }
                        resolve();
                    });
                });
            }
            ContextMenus.Remove = Remove;
            function On(name, callback) {
                let event = chrome.contextMenus['on' + name];
                event && !event.hasListener(callback) && event.addListener(callback);
            }
            ContextMenus.On = On;
            function Off(name, callback) {
                let event = chrome.contextMenus['on' + name];
                event && event.removeListener(callback);
            }
            ContextMenus.Off = Off;
        })(ContextMenus = Chrome.ContextMenus || (Chrome.ContextMenus = {}));
    })(Chrome = ResizerAPI.Chrome || (ResizerAPI.Chrome = {}));
})(ResizerAPI || (ResizerAPI = {}));
/// <reference path="../../ResizerAPI/Chrome/Windows.ts" />
/// <reference path="../../ResizerAPI/Chrome/Tabs.ts" />
var ToolsPopup;
(function (ToolsPopup) {
    var Windows = ResizerAPI.Chrome.Windows;
    let _ID = null;
    function ID() {
        return _ID;
    }
    ToolsPopup.ID = ID;
    function Open() {
        let config = {
            url: 'views/popup.html#popup-view',
            type: 'popup',
            width: 360,
            height: 420
        };
        return Windows.Create(config).then(win => {
            _ID = win.id;
            Windows.On('Removed', _OnClose);
            return win;
        });
    }
    ToolsPopup.Open = Open;
    function Focus() {
        return Windows.Update(_ID, { focused: true });
    }
    ToolsPopup.Focus = Focus;
    function Blur() {
        return Windows.Update(_ID, { focused: false });
    }
    ToolsPopup.Blur = Blur;
    function AttachTo(mainWindow) {
        let focusPopup = _ID ? Focus() : Open();
        let newPosition = {
            top: mainWindow.top,
            left: mainWindow.left + mainWindow.width
        };
        return focusPopup.then(win => Windows.Update(win.id, newPosition));
    }
    ToolsPopup.AttachTo = AttachTo;
    function _OnClose(winId) {
        if (winId === _ID) {
            _ID = null;
            Windows.Off('Removed', _OnClose);
        }
    }
})(ToolsPopup || (ToolsPopup = {}));
var Core;
(function (Core) {
    var Utils;
    (function (Utils) {
        class UniqueStack {
            constructor() {
                this._values = [];
            }
            append(value) {
                this.remove(value);
                this._values.push(value);
            }
            remove(value) {
                let existing = this._values.indexOf(value);
                (existing > -1) && this._values.splice(existing, 1);
            }
            current() {
                let last = this._values.length - 1;
                return this._values[last];
            }
        }
        Utils.UniqueStack = UniqueStack;
    })(Utils = Core.Utils || (Core.Utils = {}));
})(Core || (Core = {}));
/// <reference path="../../Core/Utils/UniqueStack.ts" />
/// <reference path="../../ResizerAPI/Chrome/Windows.ts" />
/// <reference path="./ToolsPopup.ts" />
var WindowsStack;
(function (WindowsStack) {
    var Windows = ResizerAPI.Chrome.Windows;
    let winStack = new Core.Utils.UniqueStack();
    function Current() {
        return winStack.current();
    }
    WindowsStack.Current = Current;
    function Append(winId) {
        return winStack.append(winId);
    }
    WindowsStack.Append = Append;
    function Remove(winId) {
        return winStack.remove(winId);
    }
    WindowsStack.Remove = Remove;
    function Init() {
        Windows.On('FocusChanged', winId => {
            if (winId === Windows.NONE || winId === ToolsPopup.ID()) {
                return;
            }
            winStack.append(winId);
        });
        Windows.On('Removed', winId => {
            winStack.remove(winId);
        });
        Windows.All().then(windows => {
            let focused = 0;
            for (let win of windows) {
                win.focused && (focused = win.id);
                winStack.append(win.id);
            }
            focused && winStack.append(focused);
        });
    }
    WindowsStack.Init = Init;
})(WindowsStack || (WindowsStack = {}));
var Core;
(function (Core) {
    var Utils;
    (function (Utils) {
        function IsBeta() {
            const manifest = chrome.runtime.getManifest();
            const isBeta = Boolean(manifest.version_name.match(/beta/i));
            return isBeta;
        }
        Utils.IsBeta = IsBeta;
    })(Utils = Core.Utils || (Core.Utils = {}));
})(Core || (Core = {}));
/// <reference path="../../Core/Utils/Request.ts" />
/// <reference path="../../Core/Utils/Utils.ts" />
/// <reference path="../../ResizerAPI/Settings.ts" />
var Banner;
(function (Banner) {
    var Settings = ResizerAPI.Settings;
    var Utils = Core.Utils;
    function Get(id) {
        let license;
        return Settings.Get('license', false)
            .then(details => {
            license = details;
            return Settings.Get('bannerHidden', null, true);
        })
            .then(hidden => {
            let timestamp = hidden ? new Date(hidden).getTime() : 0;
            let stayHidden = 2 * 24 * 3600 * 1000; // every 2 days
            // only show the banner once a week for non-Pro and non-Beta users
            if (license || Utils.IsBeta() || timestamp + stayHidden > Date.now()) {
                return Promise.resolve(null);
            }
            return fetch(chrome.runtime.getURL('assets/affiliates/banners.json'))
                .then(response => response.json())
                .then((banners) => {
                banners = banners.filter(banner => banner.enabled);
                if (id === undefined) {
                    id = Math.floor(Math.random() * banners.length);
                }
                return Promise.resolve(banners[id]);
            });
        });
    }
    Banner.Get = Get;
    function Status() {
        return Settings.Get('bannerHidden', null, true);
    }
    Banner.Status = Status;
    function Hide() {
        return Settings.Get('bannerHidden', null, true).then(hidden => {
            Settings.Set('bannerHidden', _today(), true);
            return Promise.resolve(!hidden);
        });
    }
    Banner.Hide = Hide;
    function _today() {
        let date = new Date();
        return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
    }
})(Banner || (Banner = {}));
/// <reference path="../../ResizerAPI/Settings.ts" />
var CyclePresets;
(function (CyclePresets) {
    var Settings = ResizerAPI.Settings;
    let previous = -1;
    function GetNext() {
        return _getPreset(1);
    }
    CyclePresets.GetNext = GetNext;
    function GetPrev() {
        return _getPreset(-1);
    }
    CyclePresets.GetPrev = GetPrev;
    function _getPreset(direction) {
        return Settings.Get('presets').then(presets => {
            previous = (previous + direction + presets.length) % presets.length;
            return Promise.resolve(presets[previous]);
        });
    }
})(CyclePresets || (CyclePresets = {}));
var Updater;
(function (Updater) {
    var Runtime = ResizerAPI.Chrome.Runtime;
    var Settings = ResizerAPI.Settings;
    function Init() {
        chrome.runtime.setUninstallURL('http://coolx10.com/window-resizer/good-bye.php');
        Runtime.On('Installed', details => {
            Settings.Get('originalInstallDate').then(originalInstallDate => {
                if (!originalInstallDate) {
                    Settings.Set('originalInstallDate', Date.now());
                }
            });
            switch (details.reason) {
                case 'install':
                    Settings.Get('presets').then(presets => {
                        !presets && Background.SaveSettings(Settings.DefaultSettings);
                    });
                    chrome.tabs.create({
                        url: 'http://coolx10.com/window-resizer/welcome.php',
                        active: true,
                    });
                    break;
                case 'update':
                    let previousVersion = parseInt(details.previousVersion);
                    // TODO Fix version check
                    if (details.previousVersion.match(/^2\.6\.0/)) {
                        break;
                    }
                    Settings.Get({ useMonochromeIcon: null }).then(old => {
                        if (old.useMonochromeIcon !== null) {
                            Settings.Del('useMonochromeIcon');
                            Settings.Set('popupIconStyle', 0);
                        }
                    });
                    Settings.Set('wasUpdated', previousVersion, true).then(() => {
                        ShowBadge();
                    });
                    break;
            }
        });
        chrome.storage.local.get('wasUpdated', flag => {
            if (flag.wasUpdated) {
                ShowBadge();
            }
        });
    }
    Updater.Init = Init;
    function ShowBadge() {
        chrome.action.setBadgeText({ text: 'new' });
        chrome.action.setBadgeBackgroundColor({ color: '#77c35a' });
    }
    Updater.ShowBadge = ShowBadge;
    function HideBadge() {
        chrome.action.setBadgeText({ text: '' });
    }
    Updater.HideBadge = HideBadge;
})(Updater || (Updater = {}));
/// <reference path="../../typings/ExtAPI.d.ts" />
/// <reference path="../Core/Utils/Enums.ts" />
/// <reference path="../Core/Utils/UUID.ts" />
/// <reference path="../Core/Utils/Request.ts" />
/// <reference path="../ResizerAPI/Tooltip.ts" />
/// <reference path="../ResizerAPI/Settings.ts" />
/// <reference path="../ResizerAPI/SettingsPage.ts" />
/// <reference path="../ResizerAPI/Chrome/Windows.ts" />
/// <reference path="../ResizerAPI/Chrome/Tabs.ts" />
/// <reference path="../ResizerAPI/Chrome/Runtime.ts" />
/// <reference path="../ResizerAPI/Chrome/ContextMenus.ts" />
/// <reference path="./background/ToolsPopup.ts" />
/// <reference path="./background/WindowsStack.ts" />
/// <reference path="./background/Banner.ts" />
/// <reference path="./background/CyclePresets.ts" />
/// <reference path="./background/Updater.ts" />
importScripts('../libs/ExtAPI.bundle.js');
var Background;
(function (Background) {
    var EndpointVisibility = ExtAPI.Router.EndpointVisibility;
    var PresetTarget = Core.PresetTarget;
    var PresetPosition = Core.PresetPosition;
    var Tooltip = ResizerAPI.Tooltip;
    var Windows = ResizerAPI.Chrome.Windows;
    var Tabs = ResizerAPI.Chrome.Tabs;
    var Runtime = ResizerAPI.Chrome.Runtime;
    var ContextMenus = ResizerAPI.Chrome.ContextMenus;
    var Settings = ResizerAPI.Settings;
    var SettingsPage = ResizerAPI.SettingsPage;
    var Request = Core.Utils.Request;
    ExtAPI.init();
    ExtAPI.register({
        action: 'resize',
        visibility: EndpointVisibility.Public,
        handler: Resize,
    });
    ExtAPI.register({
        action: 'open-url',
        visibility: EndpointVisibility.Private,
        handler: OpenUrl,
    });
    ExtAPI.register({
        action: 'open-as-popup',
        visibility: EndpointVisibility.Private,
        handler: OpenAsPopup,
    });
    ExtAPI.register({
        action: 'get-banner',
        visibility: EndpointVisibility.Private,
        handler: Banner.Get,
    });
    ExtAPI.register({
        action: 'hide-banner',
        visibility: EndpointVisibility.Private,
        handler: Banner.Hide,
    });
    ExtAPI.register({
        action: 'get-banner-status',
        visibility: EndpointVisibility.Private,
        handler: Banner.Status,
    });
    ExtAPI.register({
        action: 'rotate-viewport',
        visibility: EndpointVisibility.Private,
        handler: RotateViewport,
    });
    ExtAPI.register({
        action: 'open-settings',
        visibility: EndpointVisibility.Private,
        handler: OpenSettings,
    });
    ExtAPI.register({
        action: 'open-presets-settings',
        visibility: EndpointVisibility.Private,
        handler: OpenPresetsSettings,
    });
    ExtAPI.register({
        action: 'open-release-notes',
        visibility: EndpointVisibility.Private,
        handler: OpenReleaseNotes,
    });
    ExtAPI.register({
        action: 'open-pro-page',
        visibility: EndpointVisibility.Private,
        handler: OpenProPage,
    });
    ExtAPI.register({
        action: 'toggle-tooltip',
        visibility: EndpointVisibility.Private,
        handler: ToggleTooltip,
    });
    ExtAPI.register({
        action: 'tooltip-hide-delay',
        visibility: EndpointVisibility.Private,
        handler: GetTooltipHideDelay,
    });
    ExtAPI.register({
        action: 'tooltip-position',
        visibility: EndpointVisibility.Private,
        handler: GetTooltipPosition,
    });
    ExtAPI.register({
        action: 'get-zoom',
        visibility: EndpointVisibility.Private,
        handler: GetZoom,
    });
    ExtAPI.register({
        action: 'limit-popup',
        visibility: EndpointVisibility.Private,
        handler: LimitPopup,
    });
    ExtAPI.register({
        action: 'get-presets',
        visibility: EndpointVisibility.Private,
        handler: GetPresets,
    });
    ExtAPI.register({
        action: 'save-preset',
        visibility: EndpointVisibility.Private,
        handler: SavePreset,
    });
    ExtAPI.register({
        action: 'get-sync-status',
        visibility: EndpointVisibility.Private,
        handler: GetSyncStatus,
    });
    ExtAPI.register({
        action: 'toggle-sync',
        visibility: EndpointVisibility.Private,
        handler: ToggleSync,
    });
    ExtAPI.register({
        action: 'default-settings',
        visibility: EndpointVisibility.Private,
        handler: GetDefaultSettings,
    });
    ExtAPI.register({
        action: 'get-settings',
        visibility: EndpointVisibility.Private,
        handler: GetSettings,
    });
    ExtAPI.register({
        action: 'save-settings',
        visibility: EndpointVisibility.Private,
        handler: SaveSettings,
    });
    ExtAPI.register({
        action: 'import-settings',
        visibility: EndpointVisibility.Private,
        handler: ImportSettings,
    });
    ExtAPI.register({
        action: 'settings:requested-page',
        visibility: EndpointVisibility.Private,
        handler: SettingsGetRequestedPage,
    });
    ExtAPI.register({
        action: 'pro:checkout-url',
        visibility: EndpointVisibility.Private,
        handler: ProCheckoutUrl,
    });
    ExtAPI.register({
        action: 'pro:activate-license',
        visibility: EndpointVisibility.Private,
        handler: ProActivateLicense,
    });
    ExtAPI.register({
        action: '_debug',
        visibility: EndpointVisibility.Private,
        handler: _DEBUG,
    });
    WindowsStack.Init();
    Updater.Init();
    function ProCheckoutUrl(params, sender) {
        return Request.PostJSON('https://coolx10.com/window-resizer/pro/checkout-url', { price: params.price });
    }
    function ProActivateLicense(params, sender) {
        return Request.PostJSON('https://coolx10.com/window-resizer/pro/activate-license', { key: params.key }).then(response => {
            if (!response.error) {
                return SaveSettings({ license: response.data });
            }
            return Promise.resolve(response);
        });
    }
    function _DEBUG(data) {
        console.log(data);
        return Promise.resolve(true);
    }
    function OpenUrl(params) {
        return Tabs.Create({ url: params.url });
    }
    chrome.commands.onCommand.addListener((command) => {
        switch (command) {
            case 'a-manual-tooltip-toggle':
                ToggleTooltip().catch(err => {
                    if (err.INVALID_PROTOCOL) {
                        alert('This feature only works on pages loaded using one of the "http://", "https://" or "file://" protocols!');
                    }
                    if (err.WEBSTORE_PERMISSION) {
                        alert("This feature doesn't work on this tab because extensions are not allowed to alter the Webstore pages!");
                    }
                });
                break;
            case 'b-rotate-viewport':
                RotateViewport();
                break;
            case 'c-cycle-presets':
                CyclePresets.GetNext().then(Resize);
                break;
            case 'd-cycle-presets-reverse':
                CyclePresets.GetPrev().then(Resize);
                break;
            default:
                let match = String(command).match(/presets\-(\d+)/);
                let index = match ? parseInt(match[1], 10) - 1 : -1;
                index > -1 &&
                    Settings.Get('presets').then(presets => {
                        presets[index] && Resize(presets[index]);
                    });
                break;
        }
    });
    Windows.On('FocusChanged', winId => {
        if (winId !== Windows.NONE) {
            Windows.Get(winId).then(win => {
                if (win.type == 'popup' && winId !== ToolsPopup.ID()) {
                    ContextMenus.Create({
                        id: 'context-menu-item',
                        contexts: ['all'],
                        title: 'Show the resizer window',
                    }).catch(_silence);
                }
                else {
                    ContextMenus.Remove('context-menu-item').catch(_silence);
                }
            });
        }
    });
    ContextMenus.On('Clicked', (info, tab) => {
        Windows.Get(tab.windowId).then(_attachToolsPopup);
    });
    function OpenAsPopup(params) {
        params = params || {
            width: 800,
            height: 480,
            target: PresetTarget.VIEWPORT,
            position: PresetPosition.CENTER,
        };
        return new Promise((resolve, reject) => {
            let details;
            _getDetails()
                .then(props => Promise.resolve((details = props)))
                .then(props => Tabs.Duplicate(details.tabId))
                .then(tab => Windows.Create({ tabId: details.tabId, type: 'popup' }))
                .then(win => Resize(params))
                .then(win => _attachToolsPopup(win))
                .then(resolve)
                .catch(err => {
                reject();
            });
        });
    }
    function _attachToolsPopup(mainWindow) {
        return ToolsPopup.AttachTo(mainWindow).then(win => {
            WindowsStack.Remove(ToolsPopup.ID());
            return Promise.resolve(win);
        });
    }
    function GetPresets() {
        return Settings.Get('presets').then(presets => Promise.resolve(presets || []));
    }
    function SavePreset(preset) {
        return GetPresets().then(presets => {
            let existing = presets.findIndex(p => p.id === preset.id);
            if (existing > -1) {
                presets[existing] = preset;
            }
            else {
                presets.unshift(preset);
            }
            return SaveSettings({ presets: presets });
        });
    }
    function GetDefaultSettings() {
        return Promise.resolve(Settings.DefaultSettings);
    }
    function GetSettings(key) {
        return Settings.Get(key);
    }
    function GetSyncStatus() {
        return Settings.Get('disableSync', false, true);
    }
    function ToggleSync(status) {
        return Settings.Set('disableSync', status, true);
    }
    function SaveSettings(data) {
        Runtime.Broadcast({ UpdatedSettings: data }).catch(_silence);
        if ('popupIconStyle' in data) {
            setIconType(data.popupIconStyle);
        }
        if ('hideTooltipDelay' in data) {
            Tabs.Query().then(tabs => {
                tabs.forEach(tab => Tooltip.SetTimeout(tab.id, data.hideTooltipDelay));
            });
        }
        if ('alwaysShowTheTooltip' in data) {
            if (data.alwaysShowTheTooltip) {
                Tooltip.EnableOnAllPages();
            }
            else {
                Tooltip.DisableOnAllPages();
            }
        }
        return Settings.Set(data);
    }
    Background.SaveSettings = SaveSettings;
    function ImportSettings(data) {
        let settings = {};
        if ('settings' in data) {
            data['WindowResizer.Rows'] = JSON.stringify(data.presets);
            if (data.settings) {
                data['WindowResizer.Tooltip'] = data.settings.tooltip;
                data['WindowResizer.TooltipDelay'] = data.settings.tooltipDelay;
                data['WindowResizer.PopupDescription'] = data.settings.popupDescription;
            }
            settings = Settings.ParseV1(data);
        }
        else {
            for (let key in Settings.DefaultSettings) {
                if (key in data) {
                    settings[key] = data[key];
                }
            }
        }
        return Settings.Set(settings);
    }
    function RotateViewport() {
        return _getDetails().then(details => Resize({
            target: PresetTarget.VIEWPORT,
            width: details.innerHeight / details.zoom,
            height: details.innerWidth / details.zoom,
        }));
    }
    function SettingsGetRequestedPage() {
        return SettingsPage.Current();
    }
    function OpenSettings(view = null) {
        return SettingsPage.Open(view);
    }
    function OpenPresetsSettings() {
        return SettingsPage.Open('#presets');
    }
    function OpenReleaseNotes() {
        return SettingsPage.Open('#help/release-notes');
    }
    function OpenProPage() {
        return SettingsPage.Open('#pro');
    }
    function ToggleTooltip() {
        let tab;
        return _getTab()
            .then(t => _validateUrl((tab = t)))
            .then(p => Tooltip.Toggle(tab.id));
    }
    function GetTooltipHideDelay() {
        return Settings.Get('hideTooltipDelay');
    }
    function GetTooltipPosition() {
        return Settings.Get('tooltipPosition');
    }
    function GetZoom(params, sender) {
        let tabId = sender.tab.id;
        let tabs = chrome.tabs;
        return new Promise((resolve, reject) => {
            tabs.getZoom(tabId, zoom => resolve(zoom));
        });
    }
    function _getTab(winId) {
        return Tabs.GetActive(winId || WindowsStack.Current());
    }
    function _getDetails() {
        return Windows.Update(WindowsStack.Current(), { state: 'normal' }).then(win => _getTab(win.id).then(tab => Tabs.GetZoom(tab.id).then(zoom => {
            return Promise.resolve({
                id: win.id,
                tabId: tab.id,
                width: win.width,
                height: win.height,
                top: win.top,
                left: win.left,
                innerWidth: tab.width,
                innerHeight: tab.height,
                url: tab.url,
                zoom: zoom,
            });
        })));
    }
    function _getScreen() {
        return __awaiter(this, void 0, void 0, function* () {
            const screen = yield performOffScreen({ action: 'getScreen' }, 'Get the screen dimensions.');
            return screen;
        });
    }
    function __computeOptions(params, win) {
        let options = {};
        for (let prop of ['width', 'height', 'top', 'left']) {
            isSet(params[prop]) && (options[prop] = params[prop]);
        }
        if (params.target === PresetTarget.VIEWPORT) {
            if (params.width) {
                options.width = win.width - win.innerWidth + Math.round(params.width * win.zoom);
            }
            if (params.height) {
                options.height = win.height - win.innerHeight + Math.round(params.height * win.zoom);
            }
        }
        return Settings.Get({
            alwaysCenterTheWindow: false,
            leftAlignWindow: false,
        }).then((settings) => __awaiter(this, void 0, void 0, function* () {
            let centered = settings.alwaysCenterTheWindow;
            let leftAligned = settings.leftAlignWindow;
            let screen = yield _getScreen();
            if (centered || params.position === PresetPosition.CENTER) {
                // center the window if the global option is set or required by the preset
                options.left = Math.floor((screen.width - options.width) / 2) + screen.left;
                options.top = Math.floor((screen.height - options.height) / 2) + screen.top;
            }
            else if (!leftAligned && isSet(options.width) && !isSet(options.left) && !isSet(options.top)) {
                // if the user hasn't selected the old behavior (window stays left aligned)
                // keep the right side of the window (where the extensions' icons are) in the same place
                options.left = win.left + win.width - options.width;
            }
            return Promise.resolve(options);
        }));
    }
    function Resize(params) {
        let initial;
        let debug = {
            _: new Date().toISOString(),
            desired: {
                width: params.width,
                height: params.height,
                top: params.top,
                left: params.left,
                target: params.target,
            },
        };
        return _getScreen()
            .then(_getDetails)
            .then(current => {
            debug.initial = {
                width: current.width,
                height: current.height,
                innerWidth: current.innerWidth,
                innerHeight: current.innerHeight,
                top: current.top,
                left: current.left,
                zoom: current.zoom,
            };
            return __computeOptions(params, (initial = current));
        })
            .then(options => {
            debug.computed = options;
            return _resize(initial.id, options);
        })
            .catch(errors => {
            let actual = errors && errors.OUT_OF_BOUNDS && errors.OUT_OF_BOUNDS.actual ? errors.OUT_OF_BOUNDS.actual : {};
            debug.actual = {
                width: actual.width,
                height: actual.height,
                top: actual.top,
                left: actual.left,
                type: actual.type,
            };
            return Settings.Get({
                alwaysCenterTheWindow: false,
                leftAlignWindow: false,
            }).then((settings) => __awaiter(this, void 0, void 0, function* () {
                let top = initial.top;
                let left = initial.left - (actual.width - initial.width);
                let centered = settings.alwaysCenterTheWindow;
                let leftAligned = settings.leftAlignWindow;
                let screen = yield _getScreen();
                if (leftAligned) {
                    left = initial.left;
                }
                if (debug.desired.top !== null) {
                    top = debug.desired.top;
                }
                if (debug.desired.left !== null) {
                    left = debug.desired.left;
                }
                if (centered || params.position === PresetPosition.CENTER) {
                    // center the window if the global option is set or required by the preset
                    left = Math.floor((screen.widtg - actual.width) / 2) + screen.left;
                    top = Math.floor((screen.height - actual.height) / 2) + screen.top;
                }
                // reset window in case of failure
                Windows.Update(initial.id, { top, left });
                Settings.Get('debugLog', [], true).then(log => {
                    log.splice(9);
                    log.unshift(debug);
                    Settings.Set('debugLog', log, true);
                });
                return Promise.reject({ errors, debug });
            }));
        });
    }
    function LimitPopup(params) {
        return Windows.Update(ToolsPopup.ID(), params);
    }
    function _executeScript(func, tabId) {
        return new Promise((resolve, reject) => {
            let getTabId = Promise.resolve(tabId);
            if (!tabId) {
                getTabId = _getTab().then(tab => Promise.resolve(tab.id));
            }
            getTabId.then(tabId => {
                chrome.scripting.executeScript({
                    target: { tabId: tabId || null },
                    func,
                }, result => {
                    if (Runtime.Error()) {
                        reject({ INVALID_TAB: Runtime.Error() });
                    }
                    else {
                        resolve(result[0]);
                    }
                });
            });
        });
    }
    function _resize(winId, options) {
        return Windows.Update(winId, options).then(updated => {
            let errors = [];
            if (options.width && options.width < updated.width) {
                errors.push('MIN_WIDTH');
            }
            if (options.height && options.height < updated.height) {
                errors.push('MIN_HEIGHT');
            }
            if (options.width && options.width > updated.width) {
                errors.push('MAX_WIDTH');
            }
            if (options.height && options.height > updated.height) {
                errors.push('MAX_HEIGHT');
            }
            if (errors.length) {
                return Promise.reject({
                    OUT_OF_BOUNDS: { keys: errors, target: options, actual: updated },
                });
            }
            // All good!
            return Promise.resolve(updated);
        });
    }
    function isSet(val) {
        return val !== null && val !== undefined;
    }
    function _validateUrl(tab) {
        let protocol = String(tab.url).split(':').shift();
        let allowed = ['http', 'https', 'file'];
        if (allowed.indexOf(protocol) < 0) {
            return Promise.reject({
                INVALID_PROTOCOL: { protocol: protocol, tab: tab },
            });
        }
        return new Promise((resolve, reject) => {
            _executeScript(() => true, tab.id)
                .then(resolve)
                .catch(err => {
                if (protocol === 'file') {
                    reject({ FILE_PROTOCOL_PERMISSION: { tab: tab, err: err } });
                }
                else {
                    reject({ WEBSTORE_PERMISSION: { tab: tab, err: err } });
                }
            });
        });
    }
    function _silence() { }
    function setIconType(style) {
        __setIcon(style);
    }
    GetSettings().then((settings) => {
        setIconType(settings.popupIconStyle);
        if (settings.alwaysShowTheTooltip) {
            Tooltip.EnableOnAllPages();
        }
    });
    function __setIcon(style) {
        style = String(style);
        if (style.match(/^\d+$/)) {
            const styles = ['grey', 'dark+color', 'light+color'];
            style = ['grey', 'dark+color', 'light+color'][style] || 'dark+color';
        }
        fetch(chrome.runtime.getURL('assets/icons/browser-icon-16.svg'))
            .then(response => response.text())
            .then(svg => _processColors(svg))
            .then((svg) => __awaiter(this, void 0, void 0, function* () {
            const light = style.match(/light/);
            const [icon16, icon32] = yield performOffScreen({ action: 'getIcons', data: { svg, light } }, 'Get icon variations.');
            chrome.action.setIcon({
                imageData: {
                    // @ts-ignore
                    '16': new ImageData(new Uint8ClampedArray(icon16.data), icon16.width, icon16.height, {
                        colorSpace: icon16.colorSpace,
                    }),
                    // @ts-ignore
                    '32': new ImageData(new Uint8ClampedArray(icon32.data), icon32.width, icon32.height, {
                        colorSpace: icon32.colorSpace,
                    }),
                },
            });
        }));
        function _processColors(svg) {
            switch (style) {
                case 'light':
                    svg = svg.replace(/347f2b/, 'eee');
                case 'light+color':
                    svg = svg.replace(/333/, 'eee');
                    break;
                case 'dark':
                    svg = svg.replace(/347f2b/, '333');
                    break;
                case 'neutral':
                    svg = svg.replace(/347f2b/, '666');
                    svg = svg.replace(/333/, '666');
                    break;
            }
            return Promise.resolve(svg);
        }
    }
    function performOffScreen(request, justification) {
        return __awaiter(this, void 0, void 0, function* () {
            yield chrome.offscreen.createDocument({
                url: 'assets/off-screen.html',
                reasons: [chrome.offscreen.Reason.DOM_PARSER],
                justification,
            });
            const response = yield chrome.runtime.sendMessage(request);
            yield chrome.offscreen.closeDocument();
            return response;
        });
    }
})(Background || (Background = {}));

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9Db3JlL1V0aWxzL0VudW1zLnRzIiwic3JjL0NvcmUvVXRpbHMvVVVJRC50cyIsInNyYy9Db3JlL1V0aWxzL1JlcXVlc3QudHMiLCJzcmMvUmVzaXplckFQSS9Ub29sdGlwLnRzIiwic3JjL1Jlc2l6ZXJBUEkvU2V0dGluZ3MudHMiLCJzcmMvUmVzaXplckFQSS9TZXR0aW5nc1BhZ2UudHMiLCJzcmMvUmVzaXplckFQSS9DaHJvbWUvV2luZG93cy50cyIsInNyYy9SZXNpemVyQVBJL0Nocm9tZS9UYWJzLnRzIiwic3JjL1Jlc2l6ZXJBUEkvQ2hyb21lL1J1bnRpbWUudHMiLCJzcmMvUmVzaXplckFQSS9DaHJvbWUvQ29udGV4dE1lbnVzLnRzIiwic3JjL1NjcmlwdHMvYmFja2dyb3VuZC9Ub29sc1BvcHVwLnRzIiwic3JjL0NvcmUvVXRpbHMvVW5pcXVlU3RhY2sudHMiLCJzcmMvU2NyaXB0cy9iYWNrZ3JvdW5kL1dpbmRvd3NTdGFjay50cyIsInNyYy9Db3JlL1V0aWxzL1V0aWxzLnRzIiwic3JjL1NjcmlwdHMvYmFja2dyb3VuZC9CYW5uZXIudHMiLCJzcmMvU2NyaXB0cy9iYWNrZ3JvdW5kL0N5Y2xlUHJlc2V0cy50cyIsInNyYy9TY3JpcHRzL2JhY2tncm91bmQvVXBkYXRlci50cyIsInNyYy9TY3JpcHRzL2JhY2tncm91bmQtcHJvY2Vzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFDQSxJQUFPLElBQUksQ0F3QlY7QUF4QkQsV0FBTyxJQUFJO0lBQ1YsSUFBWSxVQUtYO0lBTEQsV0FBWSxVQUFVO1FBQ3JCLDZDQUFTLENBQUE7UUFDVCwrQ0FBTSxDQUFBO1FBQ04sK0NBQU0sQ0FBQTtRQUNOLGlEQUFPLENBQUE7SUFDUixDQUFDLEVBTFcsVUFBVSxHQUFWLGVBQVUsS0FBVixlQUFVLFFBS3JCO0lBRUQsSUFBWSxZQUdYO0lBSEQsV0FBWSxZQUFZO1FBQ3ZCLG1EQUFVLENBQUE7UUFDVix1REFBUSxDQUFBO0lBQ1Qs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LENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQztnQkFDckMsR0FBRyxFQUFFLHdCQUF3QjtnQkFDN0IsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO2dCQUM3QyxhQUFhO2FBQ2IsQ0FBQyxDQUFBO1lBRUYsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUMxRCxNQUFNLE1BQU0sQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFLENBQUE7WUFFdEMsT0FBTyxRQUFRLENBQUE7UUFDaEIsQ0FBQztLQUFBO0FBQ0YsQ0FBQyxFQXJ5Qk0sVUFBVSxLQUFWLFVBQVUsUUFxeUJoQiIsImZpbGUiOiJzY3JpcHRzL2JhY2tncm91bmQtcHJvY2Vzcy5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxyXG5tb2R1bGUgQ29yZSB7XHJcblx0ZXhwb3J0IGVudW0gUHJlc2V0VHlwZSB7XHJcblx0XHRQSE9ORSA9IDAsXHJcblx0XHRUQUJMRVQsXHJcblx0XHRMQVBUT1AsXHJcblx0XHRERVNLVE9QXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZW51bSBQcmVzZXRUYXJnZXQge1xyXG5cdFx0V0lORE9XID0gMCxcclxuXHRcdFZJRVdQT1JUXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZW51bSBQcmVzZXRQb3NpdGlvbiB7XHJcblx0XHRERUZBVUxUID0gMCxcclxuXHRcdENVU1RPTSxcclxuXHRcdENFTlRFUlxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGVudW0gUG9wdXBJY29uU3R5bGUge1xyXG5cdFx0TU9OT0NIUk9NRSA9IDAsXHJcblx0XHRDT0xPUkVELFxyXG5cdFx0Q09OVFJBU1RcclxuXHR9XHJcbn0iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9odG1sNS5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBDb3JlLlV0aWxzIHtcclxuXHRleHBvcnQgZnVuY3Rpb24gVVVJRCgpOiBzdHJpbmcge1xyXG5cdFx0bGV0IHV1aWQ6IHN0cmluZztcclxuXHRcdGxldCBieXRlcyA9IGNyeXB0by5nZXRSYW5kb21WYWx1ZXMobmV3IFVpbnQ4QXJyYXkoMjEpKTtcclxuXHRcdGxldCBoZXhlZCA9IHZhbCA9PiAodmFsICUgMTYpLnRvU3RyaW5nKDE2KTtcclxuXHJcblx0XHRieXRlc1sxMl0gPSA0O1xyXG5cdFx0Ynl0ZXNbMTZdID0gYnl0ZXNbMTZdICYgMHgzIHwgMHg4O1xyXG5cclxuXHRcdHV1aWQgPSBBcnJheS5mcm9tKGJ5dGVzLCBoZXhlZCkuam9pbignJyk7XHJcblx0XHR1dWlkID0gdXVpZCArIERhdGUubm93KCkudG9TdHJpbmcoMTYpO1xyXG5cdFx0dXVpZCA9IHV1aWQucmVwbGFjZSgvXiguezh9KSguezR9KSguezR9KSguezR9KS8sICckMS0kMi0kMy0kNC0nKTtcclxuXHJcblx0XHRyZXR1cm4gdXVpZC50b1VwcGVyQ2FzZSgpO1xyXG5cdH1cclxufSIsIlxyXG5tb2R1bGUgQ29yZS5VdGlscy5SZXF1ZXN0IHtcclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEdldCh1cmw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcblxyXG5cdFx0XHR4aHIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHJlc29sdmUpO1xyXG5cdFx0XHR4aHIuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCByZWplY3QpO1xyXG5cdFx0XHR4aHIuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCByZWplY3QpO1xyXG5cdFx0XHR4aHIub3BlbignR0VUJywgdXJsKTtcclxuXHRcdFx0eGhyLnNlbmQoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEdldEpTT04odXJsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIEdldCh1cmwpLnRoZW4oZGF0YSA9PiBQcm9taXNlLnJlc29sdmUoSlNPTi5wYXJzZShkYXRhLnRhcmdldC5yZXNwb25zZVRleHQpKSk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gUG9zdCh1cmw6IHN0cmluZywgZGF0YTogYW55KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBfcG9zdCh1cmwsIGRhdGEpLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UudGV4dCgpKTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBQb3N0SlNPTih1cmw6IHN0cmluZywgZGF0YTogYW55KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBfcG9zdCh1cmwsIGRhdGEpLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9wb3N0KHVybDogc3RyaW5nLCBkYXRhOiBhbnkpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0bGV0IHBhcnRzID0gW107XHJcblx0XHRmb3IgKGxldCBrIGluIGRhdGEpIHtcclxuXHRcdFx0bGV0IG5hbWUgPSBlbmNvZGVVUklDb21wb25lbnQoayk7XHJcblx0XHRcdGxldCB2YWx1ZSA9IGVuY29kZVVSSUNvbXBvbmVudChkYXRhW2tdKTtcclxuXHRcdFx0cGFydHMucHVzaChgJHtuYW1lfT0ke3ZhbHVlfWApO1xyXG5cdFx0fVxyXG5cdFx0Y29uc3QgaW5pdCA9IHtcclxuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXHJcblx0XHRcdGJvZHk6IHBhcnRzLmpvaW4oJyYnKSxcclxuXHRcdFx0aGVhZGVyczoge1wiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCJ9XHJcblx0XHR9O1xyXG5cclxuXHRcdHJldHVybiBmZXRjaCh1cmwsIGluaXQpO1xyXG5cdH1cclxufSIsIm1vZHVsZSBSZXNpemVyQVBJLlRvb2x0aXAge1xyXG5cdGZ1bmN0aW9uIF9tZXNzYWdlKHRhYklkOiBudW1iZXIsIG1lc3NhZ2U6IGFueSk6IFByb21pc2U8c3RyaW5nPiB7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRjaHJvbWUudGFicy5zZW5kTWVzc2FnZSh0YWJJZCwgbWVzc2FnZSwgYW5zd2VyID0+IHJlc29sdmUoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yID8gbnVsbCA6IGFuc3dlcikpXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGNvbnN0IEhJRERFTiA9ICdISURERU4nXHJcblx0ZXhwb3J0IGNvbnN0IFZJU0lCTEUgPSAnVklTSUJMRSdcclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEVuYWJsZSh0YWJJZDogbnVtYmVyKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHRcdGNocm9tZS5zY3JpcHRpbmcuZXhlY3V0ZVNjcmlwdChcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHR0YXJnZXQ6IHsgdGFiSWQgfSxcclxuXHRcdFx0XHRcdGZpbGVzOiBbJ3NjcmlwdHMvZW5hYmxlLXRvb2x0aXAuanMnXSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHJlc3VsdCA9PiByZXNvbHZlKCFjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpXHJcblx0XHRcdClcclxuXHRcdH0pXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gRGlzYWJsZSh0YWJJZDogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuXHRcdHJldHVybiBfbWVzc2FnZSh0YWJJZCwgJ0RJU0FCTEUnKVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEdldFN0YXR1cyh0YWJJZDogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuXHRcdHJldHVybiBfbWVzc2FnZSh0YWJJZCwgJ1NUQVRVUycpXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gU2hvdyh0YWJJZDogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuXHRcdHJldHVybiBfbWVzc2FnZSh0YWJJZCwgJ1NIT1cnKVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEhpZGUodGFiSWQ6IG51bWJlcik6IFByb21pc2U8c3RyaW5nPiB7XHJcblx0XHRyZXR1cm4gX21lc3NhZ2UodGFiSWQsICdISURFJylcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBUb2dnbGUodGFiSWQ6IG51bWJlcik6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gX21lc3NhZ2UodGFiSWQsICdTVEFUVVMnKS50aGVuKHN0YXR1cyA9PiB7XHJcblx0XHRcdGlmIChzdGF0dXMgPT09IG51bGwpIHtcclxuXHRcdFx0XHRyZXR1cm4gVG9vbHRpcC5FbmFibGUodGFiSWQpLnRoZW4ocmVzdWx0ID0+IHtcclxuXHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gVG9vbHRpcC5TaG93KHRhYklkKSwgMTAwKVxyXG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdFxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBfbWVzc2FnZSh0YWJJZCwgJ1RPR0dMRScpXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIFNldFRpbWVvdXQodGFiSWQ6IG51bWJlciwgdGltZW91dDogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuXHRcdHJldHVybiBfbWVzc2FnZSh0YWJJZCwgeyBjb21tYW5kOiAnU0VUX0hJREVfREVMQVknLCBkZWxheTogdGltZW91dCB9KVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEVuYWJsZU9uQWxsUGFnZXMoKSB7XHJcblx0XHRpZiAoY2hyb21lLndlYk5hdmlnYXRpb24gJiYgIWNocm9tZS53ZWJOYXZpZ2F0aW9uLm9uRE9NQ29udGVudExvYWRlZC5oYXNMaXN0ZW5lcihlbmFibGVPbk5ld1RhYnMpKSB7XHJcblx0XHRcdGNocm9tZS53ZWJOYXZpZ2F0aW9uLm9uRE9NQ29udGVudExvYWRlZC5hZGRMaXN0ZW5lcihlbmFibGVPbk5ld1RhYnMpXHJcblx0XHR9XHJcblxyXG5cdFx0Y2hyb21lLnRhYnMucXVlcnkoe30sIHRhYnMgPT4ge1xyXG5cdFx0XHRmb3IgKGxldCB0YWIgb2YgdGFicykge1xyXG5cdFx0XHRcdEVuYWJsZSh0YWIuaWQpXHJcblx0XHRcdH1cclxuXHRcdH0pXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gRGlzYWJsZU9uQWxsUGFnZXMoKSB7XHJcblx0XHRpZiAoY2hyb21lLndlYk5hdmlnYXRpb24pIHtcclxuXHRcdFx0d2hpbGUgKGNocm9tZS53ZWJOYXZpZ2F0aW9uLm9uRE9NQ29udGVudExvYWRlZC5oYXNMaXN0ZW5lcihlbmFibGVPbk5ld1RhYnMpKSB7XHJcblx0XHRcdFx0Y2hyb21lLndlYk5hdmlnYXRpb24ub25ET01Db250ZW50TG9hZGVkLnJlbW92ZUxpc3RlbmVyKGVuYWJsZU9uTmV3VGFicylcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGNocm9tZS50YWJzLnF1ZXJ5KHt9LCB0YWJzID0+IHtcclxuXHRcdFx0Zm9yIChsZXQgdGFiIG9mIHRhYnMpIHtcclxuXHRcdFx0XHREaXNhYmxlKHRhYi5pZClcclxuXHRcdFx0fVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVuYWJsZU9uTmV3VGFicyhkZXRhaWxzOiBjaHJvbWUud2ViTmF2aWdhdGlvbi5XZWJOYXZpZ2F0aW9uRnJhbWVkQ2FsbGJhY2tEZXRhaWxzKSB7XHJcblx0XHRpZiAoZGV0YWlscy50YWJJZCAmJiAhZGV0YWlscy5mcmFtZUlkKSB7XHJcblx0XHRcdEVuYWJsZShkZXRhaWxzLnRhYklkKVxyXG5cdFx0fVxyXG5cdH1cclxufVxyXG4iLCJtb2R1bGUgUmVzaXplckFQSS5TZXR0aW5ncyB7XHJcblx0aW1wb3J0IEVuZHBvaW50VmlzaWJpbGl0eSA9IEV4dEFQSS5Sb3V0ZXIuRW5kcG9pbnRWaXNpYmlsaXR5O1xyXG5cdGltcG9ydCBQcmVzZXRUeXBlICAgICAgICAgPSBDb3JlLlByZXNldFR5cGU7XHJcblx0aW1wb3J0IFByZXNldFRhcmdldCAgICAgICA9IENvcmUuUHJlc2V0VGFyZ2V0O1xyXG5cdGltcG9ydCBQcmVzZXRQb3NpdGlvbiAgICAgPSBDb3JlLlByZXNldFBvc2l0aW9uO1xyXG5cclxuXHJcblx0ZXhwb3J0IGludGVyZmFjZSBJS2V5cyB7XHJcblx0XHRhbHdheXNDZW50ZXJUaGVXaW5kb3c/OiBib29sZWFuO1xyXG5cdFx0bGVmdEFsaWduV2luZG93PzogYm9vbGVhbjtcclxuXHRcdGFsd2F5c1Nob3dUaGVUb29sdGlwPzogYm9vbGVhbjtcclxuXHRcdGhpZGVUb29sdGlwRGVsYXk/OiBudW1iZXI7XHJcblx0XHR0b29sdGlwUG9zaXRpb24/OiBzdHJpbmdbXTtcclxuXHRcdHBvcHVwSWNvblN0eWxlPzogc3RyaW5nO1xyXG5cdFx0cHJlc2V0c0ljb25zU3R5bGU/OiBzdHJpbmc7XHJcblx0XHRhbHRlcm5hdGVQcmVzZXRzQmc/OiBib29sZWFuO1xyXG5cdFx0YXV0b0Nsb3NlUG9wdXA/OiBib29sZWFuO1xyXG5cdFx0cHJlc2V0c1ByaW1hcnlMaW5lPzogc3RyaW5nO1xyXG5cdFx0aGlkZVByZXNldHNEZXNjcmlwdGlvbj86IGJvb2xlYW47XHJcblx0XHRoaWRlUG9wdXBUb29sdGlwcz86IGJvb2xlYW47XHJcblx0XHRoaWRlUXVpY2tSZXNpemU/OiBib29sZWFuO1xyXG5cdFx0b3JpZ2luYWxJbnN0YWxsRGF0ZT86IG51bWJlcjtcclxuXHRcdGxpY2Vuc2U/OiBhbnk7XHJcblxyXG5cdFx0cHJlc2V0cz86IGFueVtdO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IHZhciBEZWZhdWx0U2V0dGluZ3M6IElLZXlzID0ge1xyXG5cdFx0YWx3YXlzQ2VudGVyVGhlV2luZG93ICA6IGZhbHNlLFxyXG5cdFx0bGVmdEFsaWduV2luZG93ICAgICAgICA6IGZhbHNlLFxyXG5cdFx0YWx3YXlzU2hvd1RoZVRvb2x0aXAgICA6IGZhbHNlLFxyXG5cdFx0aGlkZVRvb2x0aXBEZWxheSAgICAgICA6IDMwMDAsXHJcblx0XHR0b29sdGlwUG9zaXRpb24gICAgICAgIDogWydib3R0b20nLCAncmlnaHQnXSxcclxuXHRcdHBvcHVwSWNvblN0eWxlICAgICAgICAgOiAnZGFyaytjb2xvcicsXHJcblx0XHRwcmVzZXRzSWNvbnNTdHlsZSAgICAgIDogJ2NsZWFyJyxcclxuXHRcdGFsdGVybmF0ZVByZXNldHNCZyAgICAgOiBmYWxzZSxcclxuXHRcdGF1dG9DbG9zZVBvcHVwICAgICAgICAgOiBmYWxzZSxcclxuXHRcdHByZXNldHNQcmltYXJ5TGluZSAgICAgOiAnJyxcclxuXHRcdGhpZGVQcmVzZXRzRGVzY3JpcHRpb24gOiBmYWxzZSxcclxuXHRcdGhpZGVQb3B1cFRvb2x0aXBzICAgICAgOiBmYWxzZSxcclxuXHRcdGhpZGVRdWlja1Jlc2l6ZSAgICAgICAgOiBmYWxzZSxcclxuXHRcdG9yaWdpbmFsSW5zdGFsbERhdGUgICAgOiBudWxsLFxyXG5cdFx0bGljZW5zZSAgICAgICAgICAgICAgICA6IG51bGwsXHJcblx0XHRwcmVzZXRzICAgICAgICAgICAgICAgIDogW11cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9nZXRTdG9yZShsb2NhbDogYm9vbGVhbiA9IGZhbHNlLCBmb3JjZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxjaHJvbWUuc3RvcmFnZS5TdG9yYWdlQXJlYT4ge1xyXG5cdFx0bGV0IHN0b3JlID0gbG9jYWwgPyBjaHJvbWUuc3RvcmFnZS5sb2NhbCA6IGNocm9tZS5zdG9yYWdlLnN5bmM7XHJcblxyXG5cdFx0aWYgKGZvcmNlKSB7XHJcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoc3RvcmUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHRcdGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCh7ZGlzYWJsZVN5bmM6IGZhbHNlfSwgc2V0dGluZ3MgPT4ge1xyXG5cdFx0XHRcdGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcclxuXHRcdFx0XHRcdHJldHVybiByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxldCBzdG9yZSA9IGxvY2FsIHx8IHNldHRpbmdzLmRpc2FibGVTeW5jID8gY2hyb21lLnN0b3JhZ2UubG9jYWwgOiBjaHJvbWUuc3RvcmFnZS5zeW5jO1xyXG5cclxuXHRcdFx0XHRyZXNvbHZlKHN0b3JlKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9nZXRMaWNlbnNlKCkge1xyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0cmV0dXJuIF9nZXRTdG9yZShmYWxzZSwgdHJ1ZSkudGhlbihzdG9yZSA9PiB7XHJcblx0XHRcdFx0c3RvcmUuZ2V0KHtsaWNlbnNlOiBudWxsfSwgZGF0YSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRyZXNvbHZlKGRhdGEubGljZW5zZSk7XHJcblx0XHRcdFx0fSlcclxuXHRcdFx0fSlcclxuXHRcdH0pXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gU2V0KGtleTogc3RyaW5nfGFueSwgdmFsdWU/OiBhbnksIGxvY2FsOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0bGV0IGRhdGEgPSBfbm9ybWFsaXplKGtleSwgdmFsdWUpO1xyXG5cclxuXHRcdGlmICgnbGljZW5zZScgaW4gZGF0YSApIHtcclxuXHRcdFx0X2dldFN0b3JlKGZhbHNlLCB0cnVlKS50aGVuKHN0b3JlID0+IHtcclxuXHRcdFx0XHRzdG9yZS5zZXQoe2xpY2Vuc2U6IGRhdGEubGljZW5zZX0pO1xyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBfZ2V0U3RvcmUobG9jYWwpLnRoZW4oc3RvcmUgPT4ge1xyXG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRcdHN0b3JlLnNldChkYXRhLCAoKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcclxuXHRcdFx0XHRcdHJlc29sdmUoZGF0YSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBHZXQoa2V5OiBzdHJpbmd8YW55LCBkZWZhdWx0VmFsdWU/OiBhbnksIGxvY2FsOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0bGV0IGtleXMgID0gX25vcm1hbGl6ZShrZXksIGRlZmF1bHRWYWx1ZSk7XHJcblxyXG5cdFx0cmV0dXJuIF9nZXRMaWNlbnNlKCkudGhlbihsaWNlbnNlID0+IF9nZXRTdG9yZShsb2NhbCkudGhlbihzdG9yZSA9PiB7XHJcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHRcdFx0c3RvcmUuZ2V0KGtleXMsIHNldHRpbmdzID0+IHtcclxuXHRcdFx0XHRcdGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHNldHRpbmdzLmxpY2Vuc2UgPSBsaWNlbnNlO1xyXG5cclxuXHRcdFx0XHRcdGlmICh0eXBlb2Yoa2V5KSA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlc29sdmUoc2V0dGluZ3Nba2V5XSk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Zm9yIChsZXQgayBpbiBEZWZhdWx0U2V0dGluZ3MpIHtcclxuXHRcdFx0XHRcdFx0aWYgKCEoayBpbiBzZXR0aW5ncykpIHtcclxuXHRcdFx0XHRcdFx0XHRzZXR0aW5nc1trXSA9IERlZmF1bHRTZXR0aW5nc1trXTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHJldHVybiByZXNvbHZlKHNldHRpbmdzKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KSk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gRGVsKGtleTogc3RyaW5nfHN0cmluZ1tdLCBsb2NhbDogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdGxldCBrZXlzICA9IChrZXkgaW5zdGFuY2VvZiBBcnJheSkgPyBrZXkgOiBba2V5XTtcclxuXHJcblx0XHRyZXR1cm4gX2dldFN0b3JlKGxvY2FsKS50aGVuKHN0b3JlID0+IHtcclxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0XHRzdG9yZS5yZW1vdmUoPHN0cmluZ1tdPiBrZXlzLCAoKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gcmVzb2x2ZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX25vcm1hbGl6ZShrZXk6IHN0cmluZ3xhbnksIGRlZmF1bHRWYWx1ZT86IGFueSk6IGFueSB7XHJcblx0XHRsZXQga2V5czogYW55ID0ge307XHJcblxyXG5cdFx0aWYgKHR5cGVvZihrZXkpID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHRpZiAoZGVmYXVsdFZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHRkZWZhdWx0VmFsdWUgPSBEZWZhdWx0U2V0dGluZ3Nba2V5XTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0a2V5c1trZXldID0gZGVmYXVsdFZhbHVlO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0a2V5cyA9IGtleTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ga2V5cztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9oYW5kbGVyKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKTogYW55IHtcclxuXHRcdHJldHVybiBmdW5jdGlvbihkYXRhKSB7XHJcblx0XHRcdGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcclxuXHRcdFx0XHRyZXR1cm4gcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJlc29sdmUoZGF0YSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gUGFyc2VWMShkYXRhOiBhbnkpOiBJS2V5cyB7XHJcblx0XHRpZiAoIWRhdGEpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBzZXR0aW5nczogYW55ICA9IHt9O1xyXG5cdFx0bGV0IHByZXNldHM6IGFueVtdID0gSlNPTi5wYXJzZShkYXRhWydXaW5kb3dSZXNpemVyLlJvd3MnXSk7XHJcblxyXG5cdFx0c2V0dGluZ3MuYWx3YXlzU2hvd1RoZVRvb2x0aXAgICA9IGRhdGFbJ1dpbmRvd1Jlc2l6ZXIuVG9vbHRpcCddICE9IDE7XHJcblx0XHRzZXR0aW5ncy5oaWRlVG9vbHRpcERlbGF5ICAgICAgID0gcGFyc2VJbnQoZGF0YVsnV2luZG93UmVzaXplci5Ub29sdGlwRGVsYXknXSwgMTApIHx8IERlZmF1bHRTZXR0aW5ncy5oaWRlVG9vbHRpcERlbGF5O1xyXG5cdFx0c2V0dGluZ3MuaGlkZVByZXNldHNEZXNjcmlwdGlvbiA9IGRhdGFbJ1dpbmRvd1Jlc2l6ZXIuUG9wdXBEZXNjcmlwdGlvbiddID09IDE7XHJcblxyXG5cdFx0c2V0dGluZ3MucHJlc2V0cyA9IFtdO1xyXG5cclxuXHRcdGZvciAobGV0IHByZXNldCBvZiBwcmVzZXRzKSB7XHJcblx0XHRcdHNldHRpbmdzLnByZXNldHMucHVzaCh7XHJcblx0XHRcdFx0aWQgICAgICAgICAgOiBDb3JlLlV0aWxzLlVVSUQoKSxcclxuXHRcdFx0XHR3aWR0aCAgICAgICA6IF9wYXJzZU51bWJlcihwcmVzZXQud2lkdGgpLFxyXG5cdFx0XHRcdGhlaWdodCAgICAgIDogX3BhcnNlTnVtYmVyKHByZXNldC5oZWlnaHQpLFxyXG5cdFx0XHRcdHRvcCAgICAgICAgIDogX3BhcnNlTnVtYmVyKHByZXNldC5ZKSxcclxuXHRcdFx0XHRsZWZ0ICAgICAgICA6IF9wYXJzZU51bWJlcihwcmVzZXQuWCksXHJcblx0XHRcdFx0ZGVzY3JpcHRpb24gOiBwcmVzZXQudGl0bGUgfHwgbnVsbCxcclxuXHRcdFx0XHRwb3NpdGlvbiAgICA6IF9wYXJzZVBvc2l0aW9uKHByZXNldC5wb3MpLFxyXG5cdFx0XHRcdHR5cGUgICAgICAgIDogX3BhcnNlVHlwZShwcmVzZXQudHlwZSksXHJcblx0XHRcdFx0dGFyZ2V0ICAgICAgOiBfcGFyc2VUYXJnZXQocHJlc2V0LnRhcmdldClcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gc2V0dGluZ3M7XHJcblxyXG5cdFx0ZnVuY3Rpb24gX3BhcnNlTnVtYmVyKHZhbHVlKSB7XHJcblx0XHRcdHJldHVybiBwYXJzZUludCh2YWx1ZSwgMTApIHx8IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gX3BhcnNlVGFyZ2V0KHZhbHVlKSB7XHJcblx0XHRcdHJldHVybiB2YWx1ZSA9PSAnd2luZG93JyA/IFByZXNldFRhcmdldC5XSU5ET1cgOiBQcmVzZXRUYXJnZXQuVklFV1BPUlQ7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gX3BhcnNlUG9zaXRpb24odmFsdWUpIHtcclxuXHRcdFx0bGV0IHBvcyA9IHBhcnNlSW50KHZhbHVlLCAxMCkgfHwgMDtcclxuXHJcblx0XHRcdHN3aXRjaCAocG9zKSB7XHJcblx0XHRcdFx0Y2FzZSAxOiByZXR1cm4gUHJlc2V0UG9zaXRpb24uQ1VTVE9NO1xyXG5cdFx0XHRcdGNhc2UgMzogcmV0dXJuIFByZXNldFBvc2l0aW9uLkNFTlRFUjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIFByZXNldFBvc2l0aW9uLkRFRkFVTFQ7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gX3BhcnNlVHlwZSh2YWx1ZSkge1xyXG5cdFx0XHRzd2l0Y2ggKHZhbHVlKSB7XHJcblx0XHRcdFx0Y2FzZSAnZGVza3RvcCcgICAgICA6IHJldHVybiBQcmVzZXRUeXBlLkRFU0tUT1A7XHJcblx0XHRcdFx0Y2FzZSAnbGFwdG9wJyAgICAgICA6IHJldHVybiBQcmVzZXRUeXBlLkxBUFRPUDtcclxuXHRcdFx0XHRjYXNlICd0YWJsZXQnICAgICAgIDogcmV0dXJuIFByZXNldFR5cGUuVEFCTEVUO1xyXG5cdFx0XHRcdGNhc2UgJ3NtYXJ0cGhvbmUnICAgOiByZXR1cm4gUHJlc2V0VHlwZS5QSE9ORTtcclxuXHRcdFx0XHRjYXNlICdmZWF0dXJlcGhvbmUnIDogcmV0dXJuIFByZXNldFR5cGUuUEhPTkU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBQcmVzZXRUeXBlLkRFU0tUT1A7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHREZWZhdWx0U2V0dGluZ3MucHJlc2V0cy5wdXNoKHtcclxuXHRcdGlkOiAnRDQ4MkNFQkQtMTJEQy00NTdELThGQ0YtQjE1MjI2REZFREQ4JyxcclxuXHRcdHdpZHRoOiAzMjAsXHJcblx0XHRoZWlnaHQ6IDU2OCxcclxuXHRcdHRhcmdldDogQ29yZS5QcmVzZXRUYXJnZXQuVklFV1BPUlQsXHJcblx0XHRkZXNjcmlwdGlvbjogJ2lQaG9uZSA1JyxcclxuXHRcdHR5cGU6IENvcmUuUHJlc2V0VHlwZS5QSE9ORVxyXG5cdH0pXHJcblxyXG5cdERlZmF1bHRTZXR0aW5ncy5wcmVzZXRzLnB1c2goe1xyXG5cdFx0aWQ6ICdBMUQ3RDA2NS0zM0IwLTQ0QkQtOEYyMC1BMTUyMjZERkYyMzcnLFxyXG5cdFx0d2lkdGg6IDM3NSxcclxuXHRcdGhlaWdodDogNjY3LFxyXG5cdFx0dGFyZ2V0OiBDb3JlLlByZXNldFRhcmdldC5WSUVXUE9SVCxcclxuXHRcdGRlc2NyaXB0aW9uOiAnaVBob25lIDYnLFxyXG5cdFx0dHlwZTogQ29yZS5QcmVzZXRUeXBlLlBIT05FXHJcblx0fSlcclxuXHJcblx0RGVmYXVsdFNldHRpbmdzLnByZXNldHMucHVzaCh7XHJcblx0XHRpZDogJ0ZGM0RFNkNELUY1NjAtNDU3Ni04MTFGLUUxNTIyNkRGRjQ1RicsXHJcblx0XHR3aWR0aDogMTAyNCxcclxuXHRcdGhlaWdodDogNzY4LFxyXG5cdFx0dGFyZ2V0OiBDb3JlLlByZXNldFRhcmdldC5WSUVXUE9SVCxcclxuXHRcdGRlc2NyaXB0aW9uOiAnaVBhZCcsXHJcblx0XHR0eXBlOiBDb3JlLlByZXNldFR5cGUuVEFCTEVUXHJcblx0fSlcclxuXHJcblx0RGVmYXVsdFNldHRpbmdzLnByZXNldHMucHVzaCh7XHJcblx0XHRpZDogJzI3QUNERDlDLTlBOTQtNDRGOC1CMzMzLUMxNTIyNkRGRjVGRicsXHJcblx0XHR3aWR0aDogMTQ0MCxcclxuXHRcdGhlaWdodDogOTAwLFxyXG5cdFx0dGFyZ2V0OiBDb3JlLlByZXNldFRhcmdldC5XSU5ET1csXHJcblx0XHRkZXNjcmlwdGlvbjogJ0xhcHRvcCcsXHJcblx0XHR0eXBlOiBDb3JlLlByZXNldFR5cGUuTEFQVE9QXHJcblx0fSlcclxuXHJcblx0RGVmYXVsdFNldHRpbmdzLnByZXNldHMucHVzaCh7XHJcblx0XHRpZDogJzIyNTZFN0FELUI3QkEtNDBCNy05OTY5LTQxNTIyNkRGRjgxNycsXHJcblx0XHR3aWR0aDogMTY4MCxcclxuXHRcdGhlaWdodDogMTA1MCxcclxuXHRcdHRhcmdldDogQ29yZS5QcmVzZXRUYXJnZXQuV0lORE9XLFxyXG5cdFx0ZGVzY3JpcHRpb246ICdEZXNrdG9wJyxcclxuXHRcdHR5cGU6IENvcmUuUHJlc2V0VHlwZS5ERVNLVE9QXHJcblx0fSlcclxuXHJcblx0RGVmYXVsdFNldHRpbmdzLnByZXNldHMucHVzaCh7XHJcblx0XHRpZDogJzIyNTZFN0FELUI3QkEtNDBCNy05OTY5LTQxNTIyNkRGRjgxOCcsXHJcblx0XHR3aWR0aDogMTkyMCxcclxuXHRcdGhlaWdodDogMTA4MCxcclxuXHRcdHRhcmdldDogQ29yZS5QcmVzZXRUYXJnZXQuV0lORE9XLFxyXG5cdFx0ZGVzY3JpcHRpb246ICdEZXNrdG9wJyxcclxuXHRcdHR5cGU6IENvcmUuUHJlc2V0VHlwZS5ERVNLVE9QXHJcblx0fSlcclxuXHJcblx0RGVmYXVsdFNldHRpbmdzLnByZXNldHMucHVzaCh7XHJcblx0XHRpZDogJ0M3NkY0OERCLUIyRDItNERFQS1CMzVELTYxNTI2MDZGODgzRCcsXHJcblx0XHR3aWR0aDogMjU2MCxcclxuXHRcdGhlaWdodDogMTQ0MCxcclxuXHRcdHRhcmdldDogQ29yZS5QcmVzZXRUYXJnZXQuV0lORE9XLFxyXG5cdFx0ZGVzY3JpcHRpb246ICdEZXNrdG9wJyxcclxuXHRcdHR5cGU6IENvcmUuUHJlc2V0VHlwZS5ERVNLVE9QXHJcblx0fSlcclxufSIsIm1vZHVsZSBSZXNpemVyQVBJLlNldHRpbmdzUGFnZSB7XHJcblx0bGV0IGN1cnJlbnRQYWdlID0gbnVsbDtcclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIE9wZW4ocGFnZTogc3RyaW5nID0gbnVsbCk6IFByb21pc2U8YW55PiB7XHJcblx0XHRwYWdlID0gcGFnZSB8fCAnI3NldHRpbmdzJztcclxuXHRcdGN1cnJlbnRQYWdlID0gcGFnZTtcclxuXHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRjaHJvbWUucnVudGltZS5vcGVuT3B0aW9uc1BhZ2UoKCkgPT4ge1xyXG5cdFx0XHRcdGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtzaG93UGFnZTogcGFnZX0sIChyZXNwb25zZSkgPT4ge1xyXG5cdFx0XHRcdFx0aWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xyXG5cdFx0XHRcdFx0XHQvLyBpdCdzIG9rLCBkb24ndCBuZWVkIHRvIGRvIGFueXRoaW5nXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXNvbHZlKHJlc3BvbnNlKVxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gQ3VycmVudCgpOiBQcm9taXNlPHN0cmluZz4ge1xyXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShjdXJyZW50UGFnZSk7XHJcblx0fVxyXG59IiwibW9kdWxlIFJlc2l6ZXJBUEkuQ2hyb21lLldpbmRvd3Mge1xyXG5cdGV4cG9ydCBjb25zdCBOT05FID0gY2hyb21lLndpbmRvd3MuV0lORE9XX0lEX05PTkU7XHJcblxyXG5cdGV4cG9ydCBpbnRlcmZhY2UgSVdpbmRvdyBleHRlbmRzIGNocm9tZS53aW5kb3dzLldpbmRvdyB7fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gR2V0KHdpbklkOiBudW1iZXIsIGNvbmZpZz86IGNocm9tZS53aW5kb3dzLlF1ZXJ5T3B0aW9ucyk6IFByb21pc2U8SVdpbmRvdz4ge1xyXG5cdFx0Y29uZmlnID0gY29uZmlnIHx8IHtwb3B1bGF0ZTogdHJ1ZX07XHJcblxyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0Y2hyb21lLndpbmRvd3MuZ2V0KHdpbklkLCBjb25maWcsIHdpbiA9PiB7XHJcblx0XHRcdFx0aWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVzb2x2ZSh3aW4pO1xyXG5cdFx0XHR9KVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gQWxsKGNvbmZpZz86IGNocm9tZS53aW5kb3dzLlF1ZXJ5T3B0aW9ucyk6IFByb21pc2U8SVdpbmRvd1tdPiB7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRjaHJvbWUud2luZG93cy5nZXRBbGwoY29uZmlnLCB3aW4gPT4ge1xyXG5cdFx0XHRcdGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcclxuXHRcdFx0XHRcdHJldHVybiByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJlc29sdmUod2luKTtcclxuXHRcdFx0fSlcclxuXHRcdH0pXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gQ3JlYXRlKGNvbmZpZzogY2hyb21lLndpbmRvd3MuQ3JlYXRlRGF0YSk6IFByb21pc2U8SVdpbmRvdz4ge1xyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0Y2hyb21lLndpbmRvd3MuY3JlYXRlKGNvbmZpZywgd2luID0+IHtcclxuXHRcdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXNvbHZlKHdpbik7XHJcblx0XHRcdH0pXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIENyZWF0ZVBvcHVwKHVybDogc3RyaW5nLCBjb25maWc6IGNocm9tZS53aW5kb3dzLkNyZWF0ZURhdGEgPSB7fSk6IFByb21pc2U8SVdpbmRvdz4ge1xyXG5cdFx0Y29uZmlnLnVybCAgPSB1cmw7XHJcblx0XHRjb25maWcudHlwZSA9ICdwb3B1cCc7XHJcblxyXG5cdFx0cmV0dXJuIENyZWF0ZShjb25maWcpO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIFVwZGF0ZSh3aW5JZDogbnVtYmVyLCBjb25maWc6IGNocm9tZS53aW5kb3dzLlVwZGF0ZUluZm8pOiBQcm9taXNlPElXaW5kb3c+IHtcclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHRcdGNocm9tZS53aW5kb3dzLnVwZGF0ZSh3aW5JZCwgY29uZmlnLCB3aW4gPT4ge1xyXG5cdFx0XHRcdGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcclxuXHRcdFx0XHRcdHJldHVybiByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJlc29sdmUod2luKTtcclxuXHRcdFx0fSlcclxuXHRcdH0pXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gT24obmFtZTogc3RyaW5nLCBjYWxsYmFjazogRnVuY3Rpb24pIHtcclxuXHRcdGxldCBldmVudCA9IGNocm9tZS53aW5kb3dzWydvbicgKyBuYW1lXTtcclxuXHJcblx0XHRldmVudCAmJiAhZXZlbnQuaGFzTGlzdGVuZXIoY2FsbGJhY2spICYmIGV2ZW50LmFkZExpc3RlbmVyKGNhbGxiYWNrKTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBPZmYobmFtZTogc3RyaW5nLCBjYWxsYmFjazogRnVuY3Rpb24pIHtcclxuXHRcdGxldCBldmVudCA9IGNocm9tZS53aW5kb3dzWydvbicgKyBuYW1lXTtcclxuXHJcblx0XHRldmVudCAmJiBldmVudC5yZW1vdmVMaXN0ZW5lcihjYWxsYmFjayk7XHJcblx0fVxyXG59IiwibW9kdWxlIFJlc2l6ZXJBUEkuQ2hyb21lLlRhYnMge1xyXG5cdGV4cG9ydCBpbnRlcmZhY2UgSVRhYiBleHRlbmRzIGNocm9tZS50YWJzLlRhYiB7fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gUXVlcnkoZmlsdGVyOiBudW1iZXIgfCBjaHJvbWUudGFicy5RdWVyeUluZm8gPSB7fSk6IFByb21pc2U8SVRhYltdPiB7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRmdW5jdGlvbiBfZG9uZSh0YWJzKSB7XHJcblx0XHRcdFx0aWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCEodGFicyBpbnN0YW5jZW9mIEFycmF5KSkge1xyXG5cdFx0XHRcdFx0dGFicyA9IFt0YWJzXTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJlc29sdmUodGFicyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0eXBlb2YgZmlsdGVyID09PSAnbnVtYmVyJykge1xyXG5cdFx0XHRcdGNocm9tZS50YWJzLmdldCg8bnVtYmVyPmZpbHRlciwgX2RvbmUpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGNocm9tZS50YWJzLnF1ZXJ5KDxjaHJvbWUudGFicy5RdWVyeUluZm8+ZmlsdGVyLCBfZG9uZSk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEdldEFjdGl2ZSh3aW5JZDogbnVtYmVyKTogUHJvbWlzZTxJVGFiPiB7XHJcblx0XHRsZXQgZmlsdGVyID0ge1xyXG5cdFx0XHRhY3RpdmU6IHRydWUsXHJcblx0XHRcdHdpbmRvd0lkIDogd2luSWRcclxuXHRcdH07XHJcblxyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0Y2hyb21lLnRhYnMucXVlcnkoZmlsdGVyLCB0YWJzID0+IHtcclxuXHRcdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXNvbHZlKHRhYnNbMF0pO1xyXG5cdFx0XHR9KVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBDcmVhdGUoY29uZmlnOiBjaHJvbWUud2luZG93cy5DcmVhdGVEYXRhKTogUHJvbWlzZTxjaHJvbWUud2luZG93cy5XaW5kb3c+IHtcclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHRcdGNocm9tZS53aW5kb3dzLmNyZWF0ZShjb25maWcsIHdpbiA9PiB7XHJcblx0XHRcdFx0aWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVzb2x2ZSh3aW4pO1xyXG5cdFx0XHR9KVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBDcmVhdGVQb3B1cCh1cmw6IHN0cmluZywgY29uZmlnPzogY2hyb21lLndpbmRvd3MuQ3JlYXRlRGF0YSk6IFByb21pc2U8Y2hyb21lLndpbmRvd3MuV2luZG93PiB7XHJcblx0XHRjb25maWcudXJsICA9IHVybDtcclxuXHRcdGNvbmZpZy50eXBlID0gJ3BvcHVwJztcclxuXHJcblx0XHRyZXR1cm4gQ3JlYXRlKGNvbmZpZyk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gVXBkYXRlKHdpbklkOiBudW1iZXIsIGNvbmZpZzogY2hyb21lLndpbmRvd3MuQ3JlYXRlRGF0YSk6IFByb21pc2U8Y2hyb21lLndpbmRvd3MuV2luZG93PiB7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRjaHJvbWUud2luZG93cy51cGRhdGUod2luSWQsIGNvbmZpZywgd2luID0+IHtcclxuXHRcdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXNvbHZlKHdpbik7XHJcblx0XHRcdH0pXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIER1cGxpY2F0ZSh0YWJJZDogbnVtYmVyKTogUHJvbWlzZTxJVGFiPiB7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRjaHJvbWUudGFicy5kdXBsaWNhdGUodGFiSWQsIHRhYiA9PiB7XHJcblx0XHRcdFx0aWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVzb2x2ZSh0YWIpO1xyXG5cdFx0XHR9KVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBHZXRab29tKHRhYklkOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj4ge1xyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0Y2hyb21lLnRhYnMuZ2V0Wm9vbSh0YWJJZCwgem9vbSA9PiB7XHJcblx0XHRcdFx0aWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVzb2x2ZSh6b29tKTtcclxuXHRcdFx0fSlcclxuXHRcdH0pO1xyXG5cdH1cclxufSIsIm1vZHVsZSBSZXNpemVyQVBJLkNocm9tZS5SdW50aW1lIHtcclxuXHRleHBvcnQgZnVuY3Rpb24gRXJyb3IoKTogYW55IHtcclxuXHRcdHJldHVybiBjaHJvbWUucnVudGltZS5sYXN0RXJyb3I7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gQnJvYWRjYXN0KG1lc3NhZ2U6IGFueSk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShtZXNzYWdlLCByZXNwb25zZSA9PiB7XHJcblx0XHRcdFx0aWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVzb2x2ZShyZXNwb25zZSk7XHJcblx0XHRcdH0pXHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBPbihuYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbikge1xyXG5cdFx0bGV0IGV2ZW50ID0gY2hyb21lLnJ1bnRpbWVbJ29uJyArIG5hbWVdO1xyXG5cclxuXHRcdGV2ZW50ICYmICFldmVudC5oYXNMaXN0ZW5lcihjYWxsYmFjaykgJiYgZXZlbnQuYWRkTGlzdGVuZXIoY2FsbGJhY2spO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIE9mZihuYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbikge1xyXG5cdFx0bGV0IGV2ZW50ID0gY2hyb21lLnJ1bnRpbWVbJ29uJyArIG5hbWVdO1xyXG5cclxuXHRcdGV2ZW50ICYmIGV2ZW50LnJlbW92ZUxpc3RlbmVyKGNhbGxiYWNrKTtcclxuXHR9XHJcbn0iLCJtb2R1bGUgUmVzaXplckFQSS5DaHJvbWUuQ29udGV4dE1lbnVzIHtcclxuXHRleHBvcnQgZnVuY3Rpb24gQ3JlYXRlKGNvbmZpZzogY2hyb21lLmNvbnRleHRNZW51cy5DcmVhdGVQcm9wZXJ0aWVzKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHRcdGNocm9tZS5jb250ZXh0TWVudXMuY3JlYXRlKGNvbmZpZywgKCkgPT4ge1xyXG5cdFx0XHRcdGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcclxuXHRcdFx0XHRcdHJldHVybiByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJlc29sdmUoKTtcclxuXHRcdFx0fSlcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIFVwZGF0ZShpdGVtSWQ6IHN0cmluZywgY29uZmlnOiBjaHJvbWUuY29udGV4dE1lbnVzLlVwZGF0ZVByb3BlcnRpZXMpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0Y2hyb21lLmNvbnRleHRNZW51cy51cGRhdGUoaXRlbUlkLCBjb25maWcsICgpID0+IHtcclxuXHRcdFx0XHRpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXNvbHZlKCk7XHJcblx0XHRcdH0pXHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBSZW1vdmUoaXRlbUlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdFx0Y2hyb21lLmNvbnRleHRNZW51cy5yZW1vdmUoaXRlbUlkLCAoKSA9PiB7XHJcblx0XHRcdFx0aWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmVzb2x2ZSgpO1xyXG5cdFx0XHR9KVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gT24obmFtZTogc3RyaW5nLCBjYWxsYmFjazogRnVuY3Rpb24pIHtcclxuXHRcdGxldCBldmVudCA9IGNocm9tZS5jb250ZXh0TWVudXNbJ29uJyArIG5hbWVdO1xyXG5cclxuXHRcdGV2ZW50ICYmICFldmVudC5oYXNMaXN0ZW5lcihjYWxsYmFjaykgJiYgZXZlbnQuYWRkTGlzdGVuZXIoY2FsbGJhY2spO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIE9mZihuYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbikge1xyXG5cdFx0bGV0IGV2ZW50ID0gY2hyb21lLmNvbnRleHRNZW51c1snb24nICsgbmFtZV07XHJcblxyXG5cdFx0ZXZlbnQgJiYgZXZlbnQucmVtb3ZlTGlzdGVuZXIoY2FsbGJhY2spO1xyXG5cdH1cclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi9SZXNpemVyQVBJL0Nocm9tZS9XaW5kb3dzLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL1Jlc2l6ZXJBUEkvQ2hyb21lL1RhYnMudHNcIiAvPlxyXG5cclxubW9kdWxlIFRvb2xzUG9wdXAge1xyXG5cdGltcG9ydCBXaW5kb3dzID0gUmVzaXplckFQSS5DaHJvbWUuV2luZG93cztcclxuXHRpbXBvcnQgVGFicyA9IFJlc2l6ZXJBUEkuQ2hyb21lLlRhYnM7XHJcblxyXG5cdGxldCBfSUQgPSBudWxsO1xyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gSUQoKSB7XHJcblx0XHRyZXR1cm4gX0lEO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIE9wZW4oKTogUHJvbWlzZTxjaHJvbWUud2luZG93cy5XaW5kb3c+IHtcclxuXHRcdGxldCBjb25maWcgPSB7XHJcblx0XHRcdHVybCAgICA6ICd2aWV3cy9wb3B1cC5odG1sI3BvcHVwLXZpZXcnLFxyXG5cdFx0XHR0eXBlICAgOiAncG9wdXAnLFxyXG5cdFx0XHR3aWR0aCAgOiAzNjAsXHJcblx0XHRcdGhlaWdodCA6IDQyMFxyXG5cdFx0fSBhcyBjaHJvbWUud2luZG93cy5DcmVhdGVEYXRhO1xyXG5cclxuXHRcdHJldHVybiBXaW5kb3dzLkNyZWF0ZShjb25maWcpLnRoZW4od2luID0+IHtcclxuXHRcdFx0X0lEID0gd2luLmlkO1xyXG5cdFx0XHRXaW5kb3dzLk9uKCdSZW1vdmVkJywgX09uQ2xvc2UpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHdpbjtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEZvY3VzKCk6IFByb21pc2U8Y2hyb21lLndpbmRvd3MuV2luZG93PiB7XHJcblx0XHRyZXR1cm4gV2luZG93cy5VcGRhdGUoX0lELCB7Zm9jdXNlZDogdHJ1ZX0pO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEJsdXIoKTogUHJvbWlzZTxjaHJvbWUud2luZG93cy5XaW5kb3c+IHtcclxuXHRcdHJldHVybiBXaW5kb3dzLlVwZGF0ZShfSUQsIHtmb2N1c2VkOiBmYWxzZX0pO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEF0dGFjaFRvKG1haW5XaW5kb3c6IGNocm9tZS53aW5kb3dzLldpbmRvdyk6IFByb21pc2U8Y2hyb21lLndpbmRvd3MuV2luZG93PiB7XHJcblx0XHRsZXQgZm9jdXNQb3B1cCAgPSBfSUQgPyBGb2N1cygpIDogT3BlbigpO1xyXG5cdFx0bGV0IG5ld1Bvc2l0aW9uID0ge1xyXG5cdFx0XHR0b3A6IG1haW5XaW5kb3cudG9wLFxyXG5cdFx0XHRsZWZ0OiBtYWluV2luZG93LmxlZnQgKyBtYWluV2luZG93LndpZHRoXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZvY3VzUG9wdXAudGhlbih3aW4gPT4gV2luZG93cy5VcGRhdGUod2luLmlkLCBuZXdQb3NpdGlvbikpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX09uQ2xvc2Uod2luSWQpIHtcclxuXHRcdGlmICh3aW5JZCA9PT0gX0lEKSB7XHJcblx0XHRcdF9JRCA9IG51bGw7XHJcblx0XHRcdFdpbmRvd3MuT2ZmKCdSZW1vdmVkJywgX09uQ2xvc2UpO1xyXG5cdFx0fVxyXG5cdH1cclxufSIsIm1vZHVsZSBDb3JlLlV0aWxzIHtcclxuXHRleHBvcnQgY2xhc3MgVW5pcXVlU3RhY2sge1xyXG5cdFx0cHJpdmF0ZSBfdmFsdWVzID0gW107XHJcblxyXG5cdFx0cHVibGljIGFwcGVuZCh2YWx1ZSkge1xyXG5cdFx0XHR0aGlzLnJlbW92ZSh2YWx1ZSk7XHJcblx0XHRcdHRoaXMuX3ZhbHVlcy5wdXNoKHZhbHVlKTtcclxuXHRcdH1cclxuXHJcblx0XHRwdWJsaWMgcmVtb3ZlKHZhbHVlKSB7XHJcblx0XHRcdGxldCBleGlzdGluZyA9IHRoaXMuX3ZhbHVlcy5pbmRleE9mKHZhbHVlKTtcclxuXHRcdFx0KGV4aXN0aW5nID4gLTEpICYmIHRoaXMuX3ZhbHVlcy5zcGxpY2UoZXhpc3RpbmcsIDEpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHB1YmxpYyBjdXJyZW50KCkge1xyXG5cdFx0XHRsZXQgbGFzdCA9IHRoaXMuX3ZhbHVlcy5sZW5ndGggLSAxO1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fdmFsdWVzW2xhc3RdO1xyXG5cdFx0fVxyXG5cdH1cclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi9Db3JlL1V0aWxzL1VuaXF1ZVN0YWNrLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL1Jlc2l6ZXJBUEkvQ2hyb21lL1dpbmRvd3MudHNcIiAvPlxyXG5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vVG9vbHNQb3B1cC50c1wiIC8+XHJcblxyXG5tb2R1bGUgV2luZG93c1N0YWNrIHtcclxuXHRpbXBvcnQgV2luZG93cyA9IFJlc2l6ZXJBUEkuQ2hyb21lLldpbmRvd3M7XHJcblxyXG5cdGxldCB3aW5TdGFjayA9IG5ldyBDb3JlLlV0aWxzLlVuaXF1ZVN0YWNrKCk7XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBDdXJyZW50KCkge1xyXG5cdFx0cmV0dXJuIHdpblN0YWNrLmN1cnJlbnQoKTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBBcHBlbmQod2luSWQpIHtcclxuXHRcdHJldHVybiB3aW5TdGFjay5hcHBlbmQod2luSWQpO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIFJlbW92ZSh3aW5JZCkge1xyXG5cdFx0cmV0dXJuIHdpblN0YWNrLnJlbW92ZSh3aW5JZCk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gSW5pdCgpIHtcclxuXHRcdFdpbmRvd3MuT24oJ0ZvY3VzQ2hhbmdlZCcsIHdpbklkID0+IHtcclxuXHRcdFx0aWYgKHdpbklkID09PSBXaW5kb3dzLk5PTkUgfHwgd2luSWQgPT09IFRvb2xzUG9wdXAuSUQoKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0d2luU3RhY2suYXBwZW5kKHdpbklkKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdFdpbmRvd3MuT24oJ1JlbW92ZWQnLCB3aW5JZCA9PiB7XHJcblx0XHRcdHdpblN0YWNrLnJlbW92ZSh3aW5JZCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRXaW5kb3dzLkFsbCgpLnRoZW4od2luZG93cyA9PiB7XHJcblx0XHRcdGxldCBmb2N1c2VkID0gMDtcclxuXHJcblx0XHRcdGZvciAobGV0IHdpbiBvZiB3aW5kb3dzKSB7XHJcblx0XHRcdFx0d2luLmZvY3VzZWQgJiYgKGZvY3VzZWQgPSB3aW4uaWQpO1xyXG5cdFx0XHRcdHdpblN0YWNrLmFwcGVuZCh3aW4uaWQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb2N1c2VkICYmIHdpblN0YWNrLmFwcGVuZChmb2N1c2VkKTtcclxuXHRcdH0pO1xyXG5cdH1cclxufSIsIm1vZHVsZSBDb3JlLlV0aWxzIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIElzQmV0YSgpOiBib29sZWFuIHtcblx0XHRjb25zdCBtYW5pZmVzdDogYW55ID0gY2hyb21lLnJ1bnRpbWUuZ2V0TWFuaWZlc3QoKTtcblx0XHRjb25zdCBpc0JldGE6IGJvb2xlYW4gPSBCb29sZWFuKG1hbmlmZXN0LnZlcnNpb25fbmFtZS5tYXRjaCgvYmV0YS9pKSk7XG5cblx0XHRyZXR1cm4gaXNCZXRhO1xuXHR9XG59IiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL0NvcmUvVXRpbHMvUmVxdWVzdC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi9Db3JlL1V0aWxzL1V0aWxzLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL1Jlc2l6ZXJBUEkvU2V0dGluZ3MudHNcIiAvPlxyXG5cclxubW9kdWxlIEJhbm5lciB7XHJcblx0aW1wb3J0IFNldHRpbmdzID0gUmVzaXplckFQSS5TZXR0aW5nc1xyXG5cdGltcG9ydCBSZXF1ZXN0ID0gQ29yZS5VdGlscy5SZXF1ZXN0XHJcblx0aW1wb3J0IFV0aWxzID0gQ29yZS5VdGlsc1xyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gR2V0KGlkPzogbnVtYmVyKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdGxldCBsaWNlbnNlXHJcblxyXG5cdFx0cmV0dXJuIFNldHRpbmdzLkdldCgnbGljZW5zZScsIGZhbHNlKVxyXG5cdFx0XHQudGhlbihkZXRhaWxzID0+IHtcclxuXHRcdFx0XHRsaWNlbnNlID0gZGV0YWlsc1xyXG5cdFx0XHRcdHJldHVybiBTZXR0aW5ncy5HZXQoJ2Jhbm5lckhpZGRlbicsIG51bGwsIHRydWUpXHJcblx0XHRcdH0pXHJcblx0XHRcdC50aGVuKGhpZGRlbiA9PiB7XHJcblx0XHRcdFx0bGV0IHRpbWVzdGFtcCA9IGhpZGRlbiA/IG5ldyBEYXRlKGhpZGRlbikuZ2V0VGltZSgpIDogMFxyXG5cdFx0XHRcdGxldCBzdGF5SGlkZGVuID0gMiAqIDI0ICogMzYwMCAqIDEwMDAgLy8gZXZlcnkgMiBkYXlzXHJcblxyXG5cdFx0XHRcdC8vIG9ubHkgc2hvdyB0aGUgYmFubmVyIG9uY2UgYSB3ZWVrIGZvciBub24tUHJvIGFuZCBub24tQmV0YSB1c2Vyc1xyXG5cdFx0XHRcdGlmIChsaWNlbnNlIHx8IFV0aWxzLklzQmV0YSgpIHx8IHRpbWVzdGFtcCArIHN0YXlIaWRkZW4gPiBEYXRlLm5vdygpKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmV0Y2goY2hyb21lLnJ1bnRpbWUuZ2V0VVJMKCdhc3NldHMvYWZmaWxpYXRlcy9iYW5uZXJzLmpzb24nKSlcclxuXHRcdFx0XHRcdC50aGVuKHJlc3BvbnNlID0+IHJlc3BvbnNlLmpzb24oKSlcclxuXHRcdFx0XHRcdC50aGVuKChiYW5uZXJzOiBhbnlbXSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRiYW5uZXJzID0gYmFubmVycy5maWx0ZXIoYmFubmVyID0+IGJhbm5lci5lbmFibGVkKVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGlkID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHRcdFx0XHRpZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGJhbm5lcnMubGVuZ3RoKVxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGJhbm5lcnNbaWRdKVxyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0fSlcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBTdGF0dXMoKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBTZXR0aW5ncy5HZXQoJ2Jhbm5lckhpZGRlbicsIG51bGwsIHRydWUpXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gSGlkZSgpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIFNldHRpbmdzLkdldCgnYmFubmVySGlkZGVuJywgbnVsbCwgdHJ1ZSkudGhlbihoaWRkZW4gPT4ge1xyXG5cdFx0XHRTZXR0aW5ncy5TZXQoJ2Jhbm5lckhpZGRlbicsIF90b2RheSgpLCB0cnVlKVxyXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCFoaWRkZW4pXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3RvZGF5KCk6IHN0cmluZyB7XHJcblx0XHRsZXQgZGF0ZSA9IG5ldyBEYXRlKClcclxuXHJcblx0XHRyZXR1cm4gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nICsgKGRhdGUuZ2V0TW9udGgoKSArIDEpICsgJy0nICsgZGF0ZS5nZXREYXRlKClcclxuXHR9XHJcbn1cclxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL1Jlc2l6ZXJBUEkvU2V0dGluZ3MudHNcIiAvPlxyXG5cclxubW9kdWxlIEN5Y2xlUHJlc2V0cyB7XHJcblx0aW1wb3J0IFNldHRpbmdzID0gUmVzaXplckFQSS5TZXR0aW5ncztcclxuXHJcblx0bGV0IHByZXZpb3VzID0gLTE7XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBHZXROZXh0KCk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gX2dldFByZXNldCgxKTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBHZXRQcmV2KCk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gX2dldFByZXNldCgtMSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfZ2V0UHJlc2V0KGRpcmVjdGlvbjogbnVtYmVyKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBTZXR0aW5ncy5HZXQoJ3ByZXNldHMnKS50aGVuKHByZXNldHMgPT4ge1xyXG5cdFx0XHRwcmV2aW91cyA9IChwcmV2aW91cyArIGRpcmVjdGlvbiArIHByZXNldHMubGVuZ3RoKSAlIHByZXNldHMubGVuZ3RoO1xyXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHByZXNldHNbcHJldmlvdXNdKTtcclxuXHRcdH0pXHJcblx0fVxyXG59IiwibW9kdWxlIFVwZGF0ZXIge1xyXG5cdGltcG9ydCBSdW50aW1lID0gUmVzaXplckFQSS5DaHJvbWUuUnVudGltZVxyXG5cdGltcG9ydCBTZXR0aW5ncyA9IFJlc2l6ZXJBUEkuU2V0dGluZ3NcclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEluaXQoKSB7XHJcblx0XHRjaHJvbWUucnVudGltZS5zZXRVbmluc3RhbGxVUkwoJ2h0dHA6Ly9jb29seDEwLmNvbS93aW5kb3ctcmVzaXplci9nb29kLWJ5ZS5waHAnKVxyXG5cclxuXHRcdFJ1bnRpbWUuT24oJ0luc3RhbGxlZCcsIGRldGFpbHMgPT4ge1xyXG5cdFx0XHRTZXR0aW5ncy5HZXQoJ29yaWdpbmFsSW5zdGFsbERhdGUnKS50aGVuKG9yaWdpbmFsSW5zdGFsbERhdGUgPT4ge1xyXG5cdFx0XHRcdGlmICghb3JpZ2luYWxJbnN0YWxsRGF0ZSkge1xyXG5cdFx0XHRcdFx0U2V0dGluZ3MuU2V0KCdvcmlnaW5hbEluc3RhbGxEYXRlJywgRGF0ZS5ub3coKSlcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblxyXG5cdFx0XHRzd2l0Y2ggKGRldGFpbHMucmVhc29uKSB7XHJcblx0XHRcdFx0Y2FzZSAnaW5zdGFsbCc6XHJcblx0XHRcdFx0XHRTZXR0aW5ncy5HZXQoJ3ByZXNldHMnKS50aGVuKHByZXNldHMgPT4ge1xyXG5cdFx0XHRcdFx0XHQhcHJlc2V0cyAmJiBCYWNrZ3JvdW5kLlNhdmVTZXR0aW5ncyhTZXR0aW5ncy5EZWZhdWx0U2V0dGluZ3MpXHJcblx0XHRcdFx0XHR9KVxyXG5cclxuXHRcdFx0XHRcdGNocm9tZS50YWJzLmNyZWF0ZSh7XHJcblx0XHRcdFx0XHRcdHVybDogJ2h0dHA6Ly9jb29seDEwLmNvbS93aW5kb3ctcmVzaXplci93ZWxjb21lLnBocCcsXHJcblx0XHRcdFx0XHRcdGFjdGl2ZTogdHJ1ZSxcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0XHRicmVha1xyXG5cclxuXHRcdFx0XHRjYXNlICd1cGRhdGUnOlxyXG5cdFx0XHRcdFx0bGV0IHByZXZpb3VzVmVyc2lvbiA9IHBhcnNlSW50KGRldGFpbHMucHJldmlvdXNWZXJzaW9uKVxyXG5cclxuXHRcdFx0XHRcdC8vIFRPRE8gRml4IHZlcnNpb24gY2hlY2tcclxuXHRcdFx0XHRcdGlmIChkZXRhaWxzLnByZXZpb3VzVmVyc2lvbi5tYXRjaCgvXjJcXC42XFwuMC8pKSB7XHJcblx0XHRcdFx0XHRcdGJyZWFrXHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0U2V0dGluZ3MuR2V0KHsgdXNlTW9ub2Nocm9tZUljb246IG51bGwgfSkudGhlbihvbGQgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAob2xkLnVzZU1vbm9jaHJvbWVJY29uICE9PSBudWxsKSB7XHJcblx0XHRcdFx0XHRcdFx0U2V0dGluZ3MuRGVsKCd1c2VNb25vY2hyb21lSWNvbicpXHJcblx0XHRcdFx0XHRcdFx0U2V0dGluZ3MuU2V0KCdwb3B1cEljb25TdHlsZScsIDApXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pXHJcblxyXG5cdFx0XHRcdFx0U2V0dGluZ3MuU2V0KCd3YXNVcGRhdGVkJywgcHJldmlvdXNWZXJzaW9uLCB0cnVlKS50aGVuKCgpID0+IHtcclxuXHRcdFx0XHRcdFx0U2hvd0JhZGdlKClcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0XHRicmVha1xyXG5cdFx0XHR9XHJcblx0XHR9KVxyXG5cclxuXHRcdGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCgnd2FzVXBkYXRlZCcsIGZsYWcgPT4ge1xyXG5cdFx0XHRpZiAoZmxhZy53YXNVcGRhdGVkKSB7XHJcblx0XHRcdFx0U2hvd0JhZGdlKClcclxuXHRcdFx0fVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBTaG93QmFkZ2UoKSB7XHJcblx0XHRjaHJvbWUuYWN0aW9uLnNldEJhZGdlVGV4dCh7IHRleHQ6ICduZXcnIH0pXHJcblx0XHRjaHJvbWUuYWN0aW9uLnNldEJhZGdlQmFja2dyb3VuZENvbG9yKHsgY29sb3I6ICcjNzdjMzVhJyB9KVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEhpZGVCYWRnZSgpIHtcclxuXHRcdGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGV4dDogJycgfSlcclxuXHR9XHJcbn1cclxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL3R5cGluZ3MvRXh0QVBJLmQudHNcIiAvPlxyXG5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL0NvcmUvVXRpbHMvRW51bXMudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vQ29yZS9VdGlscy9VVUlELnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL0NvcmUvVXRpbHMvUmVxdWVzdC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi9SZXNpemVyQVBJL1Rvb2x0aXAudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vUmVzaXplckFQSS9TZXR0aW5ncy50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi9SZXNpemVyQVBJL1NldHRpbmdzUGFnZS50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi9SZXNpemVyQVBJL0Nocm9tZS9XaW5kb3dzLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL1Jlc2l6ZXJBUEkvQ2hyb21lL1RhYnMudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vUmVzaXplckFQSS9DaHJvbWUvUnVudGltZS50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi9SZXNpemVyQVBJL0Nocm9tZS9Db250ZXh0TWVudXMudHNcIiAvPlxyXG5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYmFja2dyb3VuZC9Ub29sc1BvcHVwLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYmFja2dyb3VuZC9XaW5kb3dzU3RhY2sudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9iYWNrZ3JvdW5kL0Jhbm5lci50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2JhY2tncm91bmQvQ3ljbGVQcmVzZXRzLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYmFja2dyb3VuZC9VcGRhdGVyLnRzXCIgLz5cclxuXHJcbmltcG9ydFNjcmlwdHMoJy4uL2xpYnMvRXh0QVBJLmJ1bmRsZS5qcycpXHJcblxyXG5tb2R1bGUgQmFja2dyb3VuZCB7XHJcblx0aW1wb3J0IEVuZHBvaW50VmlzaWJpbGl0eSA9IEV4dEFQSS5Sb3V0ZXIuRW5kcG9pbnRWaXNpYmlsaXR5XHJcblx0aW1wb3J0IFByZXNldFR5cGUgPSBDb3JlLlByZXNldFR5cGVcclxuXHRpbXBvcnQgUHJlc2V0VGFyZ2V0ID0gQ29yZS5QcmVzZXRUYXJnZXRcclxuXHRpbXBvcnQgUHJlc2V0UG9zaXRpb24gPSBDb3JlLlByZXNldFBvc2l0aW9uXHJcblxyXG5cdGltcG9ydCBUb29sdGlwID0gUmVzaXplckFQSS5Ub29sdGlwXHJcblx0aW1wb3J0IFdpbmRvd3MgPSBSZXNpemVyQVBJLkNocm9tZS5XaW5kb3dzXHJcblx0aW1wb3J0IFRhYnMgPSBSZXNpemVyQVBJLkNocm9tZS5UYWJzXHJcblx0aW1wb3J0IFJ1bnRpbWUgPSBSZXNpemVyQVBJLkNocm9tZS5SdW50aW1lXHJcblx0aW1wb3J0IENvbnRleHRNZW51cyA9IFJlc2l6ZXJBUEkuQ2hyb21lLkNvbnRleHRNZW51c1xyXG5cdGltcG9ydCBTZXR0aW5ncyA9IFJlc2l6ZXJBUEkuU2V0dGluZ3NcclxuXHRpbXBvcnQgU2V0dGluZ3NQYWdlID0gUmVzaXplckFQSS5TZXR0aW5nc1BhZ2VcclxuXHJcblx0aW1wb3J0IFJlcXVlc3QgPSBDb3JlLlV0aWxzLlJlcXVlc3RcclxuXHJcblx0RXh0QVBJLmluaXQoKVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAncmVzaXplJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5QdWJsaWMsXHJcblx0XHRoYW5kbGVyOiBSZXNpemUsXHJcblx0fSlcclxuXHJcblx0RXh0QVBJLnJlZ2lzdGVyKHtcclxuXHRcdGFjdGlvbjogJ29wZW4tdXJsJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogT3BlblVybCxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnb3Blbi1hcy1wb3B1cCcsXHJcblx0XHR2aXNpYmlsaXR5OiBFbmRwb2ludFZpc2liaWxpdHkuUHJpdmF0ZSxcclxuXHRcdGhhbmRsZXI6IE9wZW5Bc1BvcHVwLFxyXG5cdH0pXHJcblxyXG5cdEV4dEFQSS5yZWdpc3Rlcih7XHJcblx0XHRhY3Rpb246ICdnZXQtYmFubmVyJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogQmFubmVyLkdldCxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnaGlkZS1iYW5uZXInLFxyXG5cdFx0dmlzaWJpbGl0eTogRW5kcG9pbnRWaXNpYmlsaXR5LlByaXZhdGUsXHJcblx0XHRoYW5kbGVyOiBCYW5uZXIuSGlkZSxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnZ2V0LWJhbm5lci1zdGF0dXMnLFxyXG5cdFx0dmlzaWJpbGl0eTogRW5kcG9pbnRWaXNpYmlsaXR5LlByaXZhdGUsXHJcblx0XHRoYW5kbGVyOiBCYW5uZXIuU3RhdHVzLFxyXG5cdH0pXHJcblxyXG5cdEV4dEFQSS5yZWdpc3Rlcih7XHJcblx0XHRhY3Rpb246ICdyb3RhdGUtdmlld3BvcnQnLFxyXG5cdFx0dmlzaWJpbGl0eTogRW5kcG9pbnRWaXNpYmlsaXR5LlByaXZhdGUsXHJcblx0XHRoYW5kbGVyOiBSb3RhdGVWaWV3cG9ydCxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnb3Blbi1zZXR0aW5ncycsXHJcblx0XHR2aXNpYmlsaXR5OiBFbmRwb2ludFZpc2liaWxpdHkuUHJpdmF0ZSxcclxuXHRcdGhhbmRsZXI6IE9wZW5TZXR0aW5ncyxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnb3Blbi1wcmVzZXRzLXNldHRpbmdzJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogT3BlblByZXNldHNTZXR0aW5ncyxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnb3Blbi1yZWxlYXNlLW5vdGVzJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogT3BlblJlbGVhc2VOb3RlcyxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnb3Blbi1wcm8tcGFnZScsXHJcblx0XHR2aXNpYmlsaXR5OiBFbmRwb2ludFZpc2liaWxpdHkuUHJpdmF0ZSxcclxuXHRcdGhhbmRsZXI6IE9wZW5Qcm9QYWdlLFxyXG5cdH0pXHJcblxyXG5cdEV4dEFQSS5yZWdpc3Rlcih7XHJcblx0XHRhY3Rpb246ICd0b2dnbGUtdG9vbHRpcCcsXHJcblx0XHR2aXNpYmlsaXR5OiBFbmRwb2ludFZpc2liaWxpdHkuUHJpdmF0ZSxcclxuXHRcdGhhbmRsZXI6IFRvZ2dsZVRvb2x0aXAsXHJcblx0fSlcclxuXHJcblx0RXh0QVBJLnJlZ2lzdGVyKHtcclxuXHRcdGFjdGlvbjogJ3Rvb2x0aXAtaGlkZS1kZWxheScsXHJcblx0XHR2aXNpYmlsaXR5OiBFbmRwb2ludFZpc2liaWxpdHkuUHJpdmF0ZSxcclxuXHRcdGhhbmRsZXI6IEdldFRvb2x0aXBIaWRlRGVsYXksXHJcblx0fSlcclxuXHJcblx0RXh0QVBJLnJlZ2lzdGVyKHtcclxuXHRcdGFjdGlvbjogJ3Rvb2x0aXAtcG9zaXRpb24nLFxyXG5cdFx0dmlzaWJpbGl0eTogRW5kcG9pbnRWaXNpYmlsaXR5LlByaXZhdGUsXHJcblx0XHRoYW5kbGVyOiBHZXRUb29sdGlwUG9zaXRpb24sXHJcblx0fSlcclxuXHJcblx0RXh0QVBJLnJlZ2lzdGVyKHtcclxuXHRcdGFjdGlvbjogJ2dldC16b29tJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogR2V0Wm9vbSxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnbGltaXQtcG9wdXAnLFxyXG5cdFx0dmlzaWJpbGl0eTogRW5kcG9pbnRWaXNpYmlsaXR5LlByaXZhdGUsXHJcblx0XHRoYW5kbGVyOiBMaW1pdFBvcHVwLFxyXG5cdH0pXHJcblxyXG5cdEV4dEFQSS5yZWdpc3Rlcih7XHJcblx0XHRhY3Rpb246ICdnZXQtcHJlc2V0cycsXHJcblx0XHR2aXNpYmlsaXR5OiBFbmRwb2ludFZpc2liaWxpdHkuUHJpdmF0ZSxcclxuXHRcdGhhbmRsZXI6IEdldFByZXNldHMsXHJcblx0fSlcclxuXHJcblx0RXh0QVBJLnJlZ2lzdGVyKHtcclxuXHRcdGFjdGlvbjogJ3NhdmUtcHJlc2V0JyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogU2F2ZVByZXNldCxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnZ2V0LXN5bmMtc3RhdHVzJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogR2V0U3luY1N0YXR1cyxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAndG9nZ2xlLXN5bmMnLFxyXG5cdFx0dmlzaWJpbGl0eTogRW5kcG9pbnRWaXNpYmlsaXR5LlByaXZhdGUsXHJcblx0XHRoYW5kbGVyOiBUb2dnbGVTeW5jLFxyXG5cdH0pXHJcblxyXG5cdEV4dEFQSS5yZWdpc3Rlcih7XHJcblx0XHRhY3Rpb246ICdkZWZhdWx0LXNldHRpbmdzJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogR2V0RGVmYXVsdFNldHRpbmdzLFxyXG5cdH0pXHJcblxyXG5cdEV4dEFQSS5yZWdpc3Rlcih7XHJcblx0XHRhY3Rpb246ICdnZXQtc2V0dGluZ3MnLFxyXG5cdFx0dmlzaWJpbGl0eTogRW5kcG9pbnRWaXNpYmlsaXR5LlByaXZhdGUsXHJcblx0XHRoYW5kbGVyOiBHZXRTZXR0aW5ncyxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnc2F2ZS1zZXR0aW5ncycsXHJcblx0XHR2aXNpYmlsaXR5OiBFbmRwb2ludFZpc2liaWxpdHkuUHJpdmF0ZSxcclxuXHRcdGhhbmRsZXI6IFNhdmVTZXR0aW5ncyxcclxuXHR9KVxyXG5cclxuXHRFeHRBUEkucmVnaXN0ZXIoe1xyXG5cdFx0YWN0aW9uOiAnaW1wb3J0LXNldHRpbmdzJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogSW1wb3J0U2V0dGluZ3MsXHJcblx0fSlcclxuXHJcblx0RXh0QVBJLnJlZ2lzdGVyKHtcclxuXHRcdGFjdGlvbjogJ3NldHRpbmdzOnJlcXVlc3RlZC1wYWdlJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogU2V0dGluZ3NHZXRSZXF1ZXN0ZWRQYWdlLFxyXG5cdH0pXHJcblxyXG5cdEV4dEFQSS5yZWdpc3Rlcih7XHJcblx0XHRhY3Rpb246ICdwcm86Y2hlY2tvdXQtdXJsJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogUHJvQ2hlY2tvdXRVcmwsXHJcblx0fSlcclxuXHJcblx0RXh0QVBJLnJlZ2lzdGVyKHtcclxuXHRcdGFjdGlvbjogJ3BybzphY3RpdmF0ZS1saWNlbnNlJyxcclxuXHRcdHZpc2liaWxpdHk6IEVuZHBvaW50VmlzaWJpbGl0eS5Qcml2YXRlLFxyXG5cdFx0aGFuZGxlcjogUHJvQWN0aXZhdGVMaWNlbnNlLFxyXG5cdH0pXHJcblxyXG5cdEV4dEFQSS5yZWdpc3Rlcih7XHJcblx0XHRhY3Rpb246ICdfZGVidWcnLFxyXG5cdFx0dmlzaWJpbGl0eTogRW5kcG9pbnRWaXNpYmlsaXR5LlByaXZhdGUsXHJcblx0XHRoYW5kbGVyOiBfREVCVUcsXHJcblx0fSlcclxuXHJcblx0V2luZG93c1N0YWNrLkluaXQoKVxyXG5cdFVwZGF0ZXIuSW5pdCgpXHJcblxyXG5cdGZ1bmN0aW9uIFByb0NoZWNrb3V0VXJsKHBhcmFtczogYW55LCBzZW5kZXI6IGFueSk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gUmVxdWVzdC5Qb3N0SlNPTignaHR0cHM6Ly9jb29seDEwLmNvbS93aW5kb3ctcmVzaXplci9wcm8vY2hlY2tvdXQtdXJsJywgeyBwcmljZTogcGFyYW1zLnByaWNlIH0pXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBQcm9BY3RpdmF0ZUxpY2Vuc2UocGFyYW1zOiBhbnksIHNlbmRlcjogYW55KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBSZXF1ZXN0LlBvc3RKU09OKCdodHRwczovL2Nvb2x4MTAuY29tL3dpbmRvdy1yZXNpemVyL3Byby9hY3RpdmF0ZS1saWNlbnNlJywgeyBrZXk6IHBhcmFtcy5rZXkgfSkudGhlbihcclxuXHRcdFx0cmVzcG9uc2UgPT4ge1xyXG5cdFx0XHRcdGlmICghcmVzcG9uc2UuZXJyb3IpIHtcclxuXHRcdFx0XHRcdHJldHVybiBTYXZlU2V0dGluZ3MoeyBsaWNlbnNlOiByZXNwb25zZS5kYXRhIH0pXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzcG9uc2UpXHJcblx0XHRcdH1cclxuXHRcdClcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9ERUJVRyhkYXRhOiBhbnkpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0Y29uc29sZS5sb2coZGF0YSlcclxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSlcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIE9wZW5VcmwocGFyYW1zOiBhbnkpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIFRhYnMuQ3JlYXRlKHsgdXJsOiBwYXJhbXMudXJsIH0pXHJcblx0fVxyXG5cclxuXHRjaHJvbWUuY29tbWFuZHMub25Db21tYW5kLmFkZExpc3RlbmVyKChjb21tYW5kOiBzdHJpbmcpID0+IHtcclxuXHRcdHN3aXRjaCAoY29tbWFuZCkge1xyXG5cdFx0XHRjYXNlICdhLW1hbnVhbC10b29sdGlwLXRvZ2dsZSc6XHJcblx0XHRcdFx0VG9nZ2xlVG9vbHRpcCgpLmNhdGNoKGVyciA9PiB7XHJcblx0XHRcdFx0XHRpZiAoZXJyLklOVkFMSURfUFJPVE9DT0wpIHtcclxuXHRcdFx0XHRcdFx0YWxlcnQoXHJcblx0XHRcdFx0XHRcdFx0J1RoaXMgZmVhdHVyZSBvbmx5IHdvcmtzIG9uIHBhZ2VzIGxvYWRlZCB1c2luZyBvbmUgb2YgdGhlIFwiaHR0cDovL1wiLCBcImh0dHBzOi8vXCIgb3IgXCJmaWxlOi8vXCIgcHJvdG9jb2xzISdcclxuXHRcdFx0XHRcdFx0KVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmIChlcnIuV0VCU1RPUkVfUEVSTUlTU0lPTikge1xyXG5cdFx0XHRcdFx0XHRhbGVydChcclxuXHRcdFx0XHRcdFx0XHRcIlRoaXMgZmVhdHVyZSBkb2Vzbid0IHdvcmsgb24gdGhpcyB0YWIgYmVjYXVzZSBleHRlbnNpb25zIGFyZSBub3QgYWxsb3dlZCB0byBhbHRlciB0aGUgV2Vic3RvcmUgcGFnZXMhXCJcclxuXHRcdFx0XHRcdFx0KVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdFx0YnJlYWtcclxuXHJcblx0XHRcdGNhc2UgJ2Itcm90YXRlLXZpZXdwb3J0JzpcclxuXHRcdFx0XHRSb3RhdGVWaWV3cG9ydCgpXHJcblx0XHRcdFx0YnJlYWtcclxuXHJcblx0XHRcdGNhc2UgJ2MtY3ljbGUtcHJlc2V0cyc6XHJcblx0XHRcdFx0Q3ljbGVQcmVzZXRzLkdldE5leHQoKS50aGVuKFJlc2l6ZSlcclxuXHRcdFx0XHRicmVha1xyXG5cclxuXHRcdFx0Y2FzZSAnZC1jeWNsZS1wcmVzZXRzLXJldmVyc2UnOlxyXG5cdFx0XHRcdEN5Y2xlUHJlc2V0cy5HZXRQcmV2KCkudGhlbihSZXNpemUpXHJcblx0XHRcdFx0YnJlYWtcclxuXHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0bGV0IG1hdGNoID0gU3RyaW5nKGNvbW1hbmQpLm1hdGNoKC9wcmVzZXRzXFwtKFxcZCspLylcclxuXHRcdFx0XHRsZXQgaW5kZXggPSBtYXRjaCA/IHBhcnNlSW50KG1hdGNoWzFdLCAxMCkgLSAxIDogLTFcclxuXHJcblx0XHRcdFx0aW5kZXggPiAtMSAmJlxyXG5cdFx0XHRcdFx0U2V0dGluZ3MuR2V0KCdwcmVzZXRzJykudGhlbihwcmVzZXRzID0+IHtcclxuXHRcdFx0XHRcdFx0cHJlc2V0c1tpbmRleF0gJiYgUmVzaXplKHByZXNldHNbaW5kZXhdKVxyXG5cdFx0XHRcdFx0fSlcclxuXHRcdFx0XHRicmVha1xyXG5cdFx0fVxyXG5cdH0pXHJcblxyXG5cdFdpbmRvd3MuT24oJ0ZvY3VzQ2hhbmdlZCcsIHdpbklkID0+IHtcclxuXHRcdGlmICh3aW5JZCAhPT0gV2luZG93cy5OT05FKSB7XHJcblx0XHRcdFdpbmRvd3MuR2V0KHdpbklkKS50aGVuKHdpbiA9PiB7XHJcblx0XHRcdFx0aWYgKHdpbi50eXBlID09ICdwb3B1cCcgJiYgd2luSWQgIT09IFRvb2xzUG9wdXAuSUQoKSkge1xyXG5cdFx0XHRcdFx0Q29udGV4dE1lbnVzLkNyZWF0ZSh7XHJcblx0XHRcdFx0XHRcdGlkOiAnY29udGV4dC1tZW51LWl0ZW0nLFxyXG5cdFx0XHRcdFx0XHRjb250ZXh0czogWydhbGwnXSxcclxuXHRcdFx0XHRcdFx0dGl0bGU6ICdTaG93IHRoZSByZXNpemVyIHdpbmRvdycsXHJcblx0XHRcdFx0XHR9KS5jYXRjaChfc2lsZW5jZSlcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Q29udGV4dE1lbnVzLlJlbW92ZSgnY29udGV4dC1tZW51LWl0ZW0nKS5jYXRjaChfc2lsZW5jZSlcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHR9XHJcblx0fSlcclxuXHJcblx0Q29udGV4dE1lbnVzLk9uKCdDbGlja2VkJywgKGluZm8sIHRhYikgPT4ge1xyXG5cdFx0V2luZG93cy5HZXQodGFiLndpbmRvd0lkKS50aGVuKF9hdHRhY2hUb29sc1BvcHVwKVxyXG5cdH0pXHJcblxyXG5cdGZ1bmN0aW9uIE9wZW5Bc1BvcHVwKHBhcmFtcz86IElSZXNpemVPcHRpb25zKTogUHJvbWlzZTxXaW5kb3dzLklXaW5kb3c+IHtcclxuXHRcdHBhcmFtcyA9IHBhcmFtcyB8fCB7XHJcblx0XHRcdHdpZHRoOiA4MDAsXHJcblx0XHRcdGhlaWdodDogNDgwLFxyXG5cdFx0XHR0YXJnZXQ6IFByZXNldFRhcmdldC5WSUVXUE9SVCxcclxuXHRcdFx0cG9zaXRpb246IFByZXNldFBvc2l0aW9uLkNFTlRFUixcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRsZXQgZGV0YWlsczogSVdpbmRvd0RldGFpbHNcclxuXHJcblx0XHRcdF9nZXREZXRhaWxzKClcclxuXHRcdFx0XHQudGhlbihwcm9wcyA9PiBQcm9taXNlLnJlc29sdmUoKGRldGFpbHMgPSBwcm9wcykpKVxyXG5cdFx0XHRcdC50aGVuKHByb3BzID0+IFRhYnMuRHVwbGljYXRlKGRldGFpbHMudGFiSWQpKVxyXG5cdFx0XHRcdC50aGVuKHRhYiA9PiBXaW5kb3dzLkNyZWF0ZSh7IHRhYklkOiBkZXRhaWxzLnRhYklkLCB0eXBlOiAncG9wdXAnIH0pKVxyXG5cdFx0XHRcdC50aGVuKHdpbiA9PiBSZXNpemUocGFyYW1zKSlcclxuXHRcdFx0XHQudGhlbih3aW4gPT4gX2F0dGFjaFRvb2xzUG9wdXAod2luKSlcclxuXHRcdFx0XHQudGhlbihyZXNvbHZlKVxyXG5cdFx0XHRcdC5jYXRjaChlcnIgPT4ge1xyXG5cdFx0XHRcdFx0cmVqZWN0KClcclxuXHRcdFx0XHR9KVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9hdHRhY2hUb29sc1BvcHVwKG1haW5XaW5kb3c6IFdpbmRvd3MuSVdpbmRvdyk6IFByb21pc2U8V2luZG93cy5JV2luZG93PiB7XHJcblx0XHRyZXR1cm4gVG9vbHNQb3B1cC5BdHRhY2hUbyhtYWluV2luZG93KS50aGVuKHdpbiA9PiB7XHJcblx0XHRcdFdpbmRvd3NTdGFjay5SZW1vdmUoVG9vbHNQb3B1cC5JRCgpKVxyXG5cclxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh3aW4pXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gR2V0UHJlc2V0cygpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIFNldHRpbmdzLkdldCgncHJlc2V0cycpLnRoZW4ocHJlc2V0cyA9PiBQcm9taXNlLnJlc29sdmUocHJlc2V0cyB8fCBbXSkpXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBTYXZlUHJlc2V0KHByZXNldDogYW55KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBHZXRQcmVzZXRzKCkudGhlbihwcmVzZXRzID0+IHtcclxuXHRcdFx0bGV0IGV4aXN0aW5nID0gcHJlc2V0cy5maW5kSW5kZXgocCA9PiBwLmlkID09PSBwcmVzZXQuaWQpXHJcblxyXG5cdFx0XHRpZiAoZXhpc3RpbmcgPiAtMSkge1xyXG5cdFx0XHRcdHByZXNldHNbZXhpc3RpbmddID0gcHJlc2V0XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cHJlc2V0cy51bnNoaWZ0KHByZXNldClcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIFNhdmVTZXR0aW5ncyh7IHByZXNldHM6IHByZXNldHMgfSlcclxuXHRcdH0pXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBHZXREZWZhdWx0U2V0dGluZ3MoKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoU2V0dGluZ3MuRGVmYXVsdFNldHRpbmdzKVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gR2V0U2V0dGluZ3Moa2V5Pzogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBTZXR0aW5ncy5HZXQoa2V5KVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gR2V0U3luY1N0YXR1cygpIHtcclxuXHRcdHJldHVybiBTZXR0aW5ncy5HZXQoJ2Rpc2FibGVTeW5jJywgZmFsc2UsIHRydWUpXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBUb2dnbGVTeW5jKHN0YXR1cykge1xyXG5cdFx0cmV0dXJuIFNldHRpbmdzLlNldCgnZGlzYWJsZVN5bmMnLCBzdGF0dXMsIHRydWUpXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gU2F2ZVNldHRpbmdzKGRhdGE6IFNldHRpbmdzLklLZXlzKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdFJ1bnRpbWUuQnJvYWRjYXN0KHsgVXBkYXRlZFNldHRpbmdzOiBkYXRhIH0pLmNhdGNoKF9zaWxlbmNlKVxyXG5cclxuXHRcdGlmICgncG9wdXBJY29uU3R5bGUnIGluIGRhdGEpIHtcclxuXHRcdFx0c2V0SWNvblR5cGUoZGF0YS5wb3B1cEljb25TdHlsZSlcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoJ2hpZGVUb29sdGlwRGVsYXknIGluIGRhdGEpIHtcclxuXHRcdFx0VGFicy5RdWVyeSgpLnRoZW4odGFicyA9PiB7XHJcblx0XHRcdFx0dGFicy5mb3JFYWNoKHRhYiA9PiBUb29sdGlwLlNldFRpbWVvdXQodGFiLmlkLCBkYXRhLmhpZGVUb29sdGlwRGVsYXkpKVxyXG5cdFx0XHR9KVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmICgnYWx3YXlzU2hvd1RoZVRvb2x0aXAnIGluIGRhdGEpIHtcclxuXHRcdFx0aWYgKGRhdGEuYWx3YXlzU2hvd1RoZVRvb2x0aXApIHtcclxuXHRcdFx0XHRUb29sdGlwLkVuYWJsZU9uQWxsUGFnZXMoKVxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFRvb2x0aXAuRGlzYWJsZU9uQWxsUGFnZXMoKVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFNldHRpbmdzLlNldChkYXRhKVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gSW1wb3J0U2V0dGluZ3MoZGF0YTogYW55KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdGxldCBzZXR0aW5nczogYW55ID0ge31cclxuXHJcblx0XHRpZiAoJ3NldHRpbmdzJyBpbiBkYXRhKSB7XHJcblx0XHRcdGRhdGFbJ1dpbmRvd1Jlc2l6ZXIuUm93cyddID0gSlNPTi5zdHJpbmdpZnkoZGF0YS5wcmVzZXRzKVxyXG5cdFx0XHRpZiAoZGF0YS5zZXR0aW5ncykge1xyXG5cdFx0XHRcdGRhdGFbJ1dpbmRvd1Jlc2l6ZXIuVG9vbHRpcCddID0gZGF0YS5zZXR0aW5ncy50b29sdGlwXHJcblx0XHRcdFx0ZGF0YVsnV2luZG93UmVzaXplci5Ub29sdGlwRGVsYXknXSA9IGRhdGEuc2V0dGluZ3MudG9vbHRpcERlbGF5XHJcblx0XHRcdFx0ZGF0YVsnV2luZG93UmVzaXplci5Qb3B1cERlc2NyaXB0aW9uJ10gPSBkYXRhLnNldHRpbmdzLnBvcHVwRGVzY3JpcHRpb25cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0c2V0dGluZ3MgPSBTZXR0aW5ncy5QYXJzZVYxKGRhdGEpXHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRmb3IgKGxldCBrZXkgaW4gU2V0dGluZ3MuRGVmYXVsdFNldHRpbmdzKSB7XHJcblx0XHRcdFx0aWYgKGtleSBpbiBkYXRhKSB7XHJcblx0XHRcdFx0XHRzZXR0aW5nc1trZXldID0gZGF0YVtrZXldXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFNldHRpbmdzLlNldChzZXR0aW5ncylcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIFJvdGF0ZVZpZXdwb3J0KCk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gX2dldERldGFpbHMoKS50aGVuKGRldGFpbHMgPT5cclxuXHRcdFx0UmVzaXplKHtcclxuXHRcdFx0XHR0YXJnZXQ6IFByZXNldFRhcmdldC5WSUVXUE9SVCxcclxuXHRcdFx0XHR3aWR0aDogZGV0YWlscy5pbm5lckhlaWdodCAvIGRldGFpbHMuem9vbSxcclxuXHRcdFx0XHRoZWlnaHQ6IGRldGFpbHMuaW5uZXJXaWR0aCAvIGRldGFpbHMuem9vbSxcclxuXHRcdFx0fSlcclxuXHRcdClcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIFNldHRpbmdzR2V0UmVxdWVzdGVkUGFnZSgpOiBQcm9taXNlPHN0cmluZz4ge1xyXG5cdFx0cmV0dXJuIFNldHRpbmdzUGFnZS5DdXJyZW50KClcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIE9wZW5TZXR0aW5ncyh2aWV3OiBzdHJpbmcgPSBudWxsKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBTZXR0aW5nc1BhZ2UuT3Blbih2aWV3KVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gT3BlblByZXNldHNTZXR0aW5ncygpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIFNldHRpbmdzUGFnZS5PcGVuKCcjcHJlc2V0cycpXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBPcGVuUmVsZWFzZU5vdGVzKCk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gU2V0dGluZ3NQYWdlLk9wZW4oJyNoZWxwL3JlbGVhc2Utbm90ZXMnKVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gT3BlblByb1BhZ2UoKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBTZXR0aW5nc1BhZ2UuT3BlbignI3BybycpXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBUb2dnbGVUb29sdGlwKCk6IFByb21pc2U8YW55PiB7XHJcblx0XHRsZXQgdGFiOiBUYWJzLklUYWJcclxuXHJcblx0XHRyZXR1cm4gX2dldFRhYigpXHJcblx0XHRcdC50aGVuKHQgPT4gX3ZhbGlkYXRlVXJsKCh0YWIgPSB0KSkpXHJcblx0XHRcdC50aGVuKHAgPT4gVG9vbHRpcC5Ub2dnbGUodGFiLmlkKSlcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIEdldFRvb2x0aXBIaWRlRGVsYXkoKTogUHJvbWlzZTxudW1iZXI+IHtcclxuXHRcdHJldHVybiBTZXR0aW5ncy5HZXQoJ2hpZGVUb29sdGlwRGVsYXknKVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gR2V0VG9vbHRpcFBvc2l0aW9uKCk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gU2V0dGluZ3MuR2V0KCd0b29sdGlwUG9zaXRpb24nKVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gR2V0Wm9vbShwYXJhbXMsIHNlbmRlcik6IFByb21pc2U8bnVtYmVyPiB7XHJcblx0XHRsZXQgdGFiSWQ6IG51bWJlciA9IHNlbmRlci50YWIuaWRcclxuXHRcdGxldCB0YWJzOiBhbnkgPSBjaHJvbWUudGFic1xyXG5cclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHRcdHRhYnMuZ2V0Wm9vbSh0YWJJZCwgem9vbSA9PiByZXNvbHZlKHpvb20pKVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9nZXRUYWIod2luSWQ/OiBudW1iZXIpOiBQcm9taXNlPFRhYnMuSVRhYj4ge1xyXG5cdFx0cmV0dXJuIFRhYnMuR2V0QWN0aXZlKHdpbklkIHx8IFdpbmRvd3NTdGFjay5DdXJyZW50KCkpXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfZ2V0RGV0YWlscygpOiBQcm9taXNlPElXaW5kb3dEZXRhaWxzPiB7XHJcblx0XHRyZXR1cm4gV2luZG93cy5VcGRhdGUoV2luZG93c1N0YWNrLkN1cnJlbnQoKSwgeyBzdGF0ZTogJ25vcm1hbCcgfSkudGhlbih3aW4gPT5cclxuXHRcdFx0X2dldFRhYih3aW4uaWQpLnRoZW4odGFiID0+XHJcblx0XHRcdFx0VGFicy5HZXRab29tKHRhYi5pZCkudGhlbih6b29tID0+IHtcclxuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xyXG5cdFx0XHRcdFx0XHRpZDogd2luLmlkLFxyXG5cdFx0XHRcdFx0XHR0YWJJZDogdGFiLmlkLFxyXG5cdFx0XHRcdFx0XHR3aWR0aDogd2luLndpZHRoLFxyXG5cdFx0XHRcdFx0XHRoZWlnaHQ6IHdpbi5oZWlnaHQsXHJcblx0XHRcdFx0XHRcdHRvcDogd2luLnRvcCxcclxuXHRcdFx0XHRcdFx0bGVmdDogd2luLmxlZnQsXHJcblx0XHRcdFx0XHRcdGlubmVyV2lkdGg6IHRhYi53aWR0aCxcclxuXHRcdFx0XHRcdFx0aW5uZXJIZWlnaHQ6IHRhYi5oZWlnaHQsXHJcblx0XHRcdFx0XHRcdHVybDogdGFiLnVybCxcclxuXHRcdFx0XHRcdFx0em9vbTogem9vbSxcclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0fSlcclxuXHRcdFx0KVxyXG5cdFx0KVxyXG5cdH1cclxuXHJcblx0aW50ZXJmYWNlIElXaW5kb3dEZXRhaWxzIHtcclxuXHRcdGlkOiBudW1iZXJcclxuXHRcdHRhYklkOiBudW1iZXJcclxuXHRcdHdpZHRoOiBudW1iZXJcclxuXHRcdGhlaWdodDogbnVtYmVyXHJcblx0XHRpbm5lcldpZHRoOiBudW1iZXJcclxuXHRcdGlubmVySGVpZ2h0OiBudW1iZXJcclxuXHRcdHRvcDogbnVtYmVyXHJcblx0XHRsZWZ0OiBudW1iZXJcclxuXHRcdHpvb206IG51bWJlclxyXG5cdFx0dXJsPzogc3RyaW5nXHJcblx0fVxyXG5cclxuXHRhc3luYyBmdW5jdGlvbiBfZ2V0U2NyZWVuKCkge1xyXG5cdFx0Y29uc3Qgc2NyZWVuID0gYXdhaXQgcGVyZm9ybU9mZlNjcmVlbih7IGFjdGlvbjogJ2dldFNjcmVlbicgfSwgJ0dldCB0aGUgc2NyZWVuIGRpbWVuc2lvbnMuJylcclxuXHRcdHJldHVybiBzY3JlZW5cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9fY29tcHV0ZU9wdGlvbnMocGFyYW1zOiBJUmVzaXplT3B0aW9ucywgd2luOiBJV2luZG93RGV0YWlscyk6IFByb21pc2U8SVJlc2l6ZU9wdGlvbnM+IHtcclxuXHRcdGxldCBvcHRpb25zOiBJUmVzaXplT3B0aW9ucyA9IHt9XHJcblxyXG5cdFx0Zm9yIChsZXQgcHJvcCBvZiBbJ3dpZHRoJywgJ2hlaWdodCcsICd0b3AnLCAnbGVmdCddKSB7XHJcblx0XHRcdGlzU2V0KHBhcmFtc1twcm9wXSkgJiYgKG9wdGlvbnNbcHJvcF0gPSBwYXJhbXNbcHJvcF0pXHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHBhcmFtcy50YXJnZXQgPT09IFByZXNldFRhcmdldC5WSUVXUE9SVCkge1xyXG5cdFx0XHRpZiAocGFyYW1zLndpZHRoKSB7XHJcblx0XHRcdFx0b3B0aW9ucy53aWR0aCA9IHdpbi53aWR0aCAtIHdpbi5pbm5lcldpZHRoICsgTWF0aC5yb3VuZChwYXJhbXMud2lkdGggKiB3aW4uem9vbSlcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHBhcmFtcy5oZWlnaHQpIHtcclxuXHRcdFx0XHRvcHRpb25zLmhlaWdodCA9IHdpbi5oZWlnaHQgLSB3aW4uaW5uZXJIZWlnaHQgKyBNYXRoLnJvdW5kKHBhcmFtcy5oZWlnaHQgKiB3aW4uem9vbSlcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBTZXR0aW5ncy5HZXQoe1xyXG5cdFx0XHRhbHdheXNDZW50ZXJUaGVXaW5kb3c6IGZhbHNlLFxyXG5cdFx0XHRsZWZ0QWxpZ25XaW5kb3c6IGZhbHNlLFxyXG5cdFx0fSkudGhlbihhc3luYyBzZXR0aW5ncyA9PiB7XHJcblx0XHRcdGxldCBjZW50ZXJlZDogYm9vbGVhbiA9IHNldHRpbmdzLmFsd2F5c0NlbnRlclRoZVdpbmRvd1xyXG5cdFx0XHRsZXQgbGVmdEFsaWduZWQ6IGJvb2xlYW4gPSBzZXR0aW5ncy5sZWZ0QWxpZ25XaW5kb3dcclxuXHRcdFx0bGV0IHNjcmVlbjogYW55ID0gYXdhaXQgX2dldFNjcmVlbigpXHJcblxyXG5cdFx0XHRpZiAoY2VudGVyZWQgfHwgcGFyYW1zLnBvc2l0aW9uID09PSBQcmVzZXRQb3NpdGlvbi5DRU5URVIpIHtcclxuXHRcdFx0XHQvLyBjZW50ZXIgdGhlIHdpbmRvdyBpZiB0aGUgZ2xvYmFsIG9wdGlvbiBpcyBzZXQgb3IgcmVxdWlyZWQgYnkgdGhlIHByZXNldFxyXG5cdFx0XHRcdG9wdGlvbnMubGVmdCA9IE1hdGguZmxvb3IoKHNjcmVlbi53aWR0aCAtIG9wdGlvbnMud2lkdGgpIC8gMikgKyBzY3JlZW4ubGVmdFxyXG5cdFx0XHRcdG9wdGlvbnMudG9wID0gTWF0aC5mbG9vcigoc2NyZWVuLmhlaWdodCAtIG9wdGlvbnMuaGVpZ2h0KSAvIDIpICsgc2NyZWVuLnRvcFxyXG5cdFx0XHR9IGVsc2UgaWYgKCFsZWZ0QWxpZ25lZCAmJiBpc1NldChvcHRpb25zLndpZHRoKSAmJiAhaXNTZXQob3B0aW9ucy5sZWZ0KSAmJiAhaXNTZXQob3B0aW9ucy50b3ApKSB7XHJcblx0XHRcdFx0Ly8gaWYgdGhlIHVzZXIgaGFzbid0IHNlbGVjdGVkIHRoZSBvbGQgYmVoYXZpb3IgKHdpbmRvdyBzdGF5cyBsZWZ0IGFsaWduZWQpXHJcblx0XHRcdFx0Ly8ga2VlcCB0aGUgcmlnaHQgc2lkZSBvZiB0aGUgd2luZG93ICh3aGVyZSB0aGUgZXh0ZW5zaW9ucycgaWNvbnMgYXJlKSBpbiB0aGUgc2FtZSBwbGFjZVxyXG5cdFx0XHRcdG9wdGlvbnMubGVmdCA9IHdpbi5sZWZ0ICsgd2luLndpZHRoIC0gb3B0aW9ucy53aWR0aFxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG9wdGlvbnMpXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gUmVzaXplKHBhcmFtczogSVJlc2l6ZU9wdGlvbnMpOiBQcm9taXNlPFdpbmRvd3MuSVdpbmRvdz4ge1xyXG5cdFx0bGV0IGluaXRpYWw6IElXaW5kb3dEZXRhaWxzXHJcblx0XHRsZXQgZGVidWc6IGFueSA9IHtcclxuXHRcdFx0XzogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG5cdFx0XHRkZXNpcmVkOiB7XHJcblx0XHRcdFx0d2lkdGg6IHBhcmFtcy53aWR0aCxcclxuXHRcdFx0XHRoZWlnaHQ6IHBhcmFtcy5oZWlnaHQsXHJcblx0XHRcdFx0dG9wOiBwYXJhbXMudG9wLFxyXG5cdFx0XHRcdGxlZnQ6IHBhcmFtcy5sZWZ0LFxyXG5cdFx0XHRcdHRhcmdldDogcGFyYW1zLnRhcmdldCxcclxuXHRcdFx0fSxcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gX2dldFNjcmVlbigpXHJcblx0XHRcdC50aGVuKF9nZXREZXRhaWxzKVxyXG5cdFx0XHQudGhlbihjdXJyZW50ID0+IHtcclxuXHRcdFx0XHRkZWJ1Zy5pbml0aWFsID0ge1xyXG5cdFx0XHRcdFx0d2lkdGg6IGN1cnJlbnQud2lkdGgsXHJcblx0XHRcdFx0XHRoZWlnaHQ6IGN1cnJlbnQuaGVpZ2h0LFxyXG5cdFx0XHRcdFx0aW5uZXJXaWR0aDogY3VycmVudC5pbm5lcldpZHRoLFxyXG5cdFx0XHRcdFx0aW5uZXJIZWlnaHQ6IGN1cnJlbnQuaW5uZXJIZWlnaHQsXHJcblx0XHRcdFx0XHR0b3A6IGN1cnJlbnQudG9wLFxyXG5cdFx0XHRcdFx0bGVmdDogY3VycmVudC5sZWZ0LFxyXG5cdFx0XHRcdFx0em9vbTogY3VycmVudC56b29tLFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gX19jb21wdXRlT3B0aW9ucyhwYXJhbXMsIChpbml0aWFsID0gY3VycmVudCkpXHJcblx0XHRcdH0pXHJcblx0XHRcdC50aGVuKG9wdGlvbnMgPT4ge1xyXG5cdFx0XHRcdGRlYnVnLmNvbXB1dGVkID0gb3B0aW9uc1xyXG5cdFx0XHRcdHJldHVybiBfcmVzaXplKGluaXRpYWwuaWQsIG9wdGlvbnMpXHJcblx0XHRcdH0pXHJcblx0XHRcdC5jYXRjaChlcnJvcnMgPT4ge1xyXG5cdFx0XHRcdGxldCBhY3R1YWwgPSBlcnJvcnMgJiYgZXJyb3JzLk9VVF9PRl9CT1VORFMgJiYgZXJyb3JzLk9VVF9PRl9CT1VORFMuYWN0dWFsID8gZXJyb3JzLk9VVF9PRl9CT1VORFMuYWN0dWFsIDoge31cclxuXHJcblx0XHRcdFx0ZGVidWcuYWN0dWFsID0ge1xyXG5cdFx0XHRcdFx0d2lkdGg6IGFjdHVhbC53aWR0aCxcclxuXHRcdFx0XHRcdGhlaWdodDogYWN0dWFsLmhlaWdodCxcclxuXHRcdFx0XHRcdHRvcDogYWN0dWFsLnRvcCxcclxuXHRcdFx0XHRcdGxlZnQ6IGFjdHVhbC5sZWZ0LFxyXG5cdFx0XHRcdFx0dHlwZTogYWN0dWFsLnR5cGUsXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gU2V0dGluZ3MuR2V0KHtcclxuXHRcdFx0XHRcdGFsd2F5c0NlbnRlclRoZVdpbmRvdzogZmFsc2UsXHJcblx0XHRcdFx0XHRsZWZ0QWxpZ25XaW5kb3c6IGZhbHNlLFxyXG5cdFx0XHRcdH0pLnRoZW4oYXN5bmMgc2V0dGluZ3MgPT4ge1xyXG5cdFx0XHRcdFx0bGV0IHRvcCA9IGluaXRpYWwudG9wXHJcblx0XHRcdFx0XHRsZXQgbGVmdCA9IGluaXRpYWwubGVmdCAtIChhY3R1YWwud2lkdGggLSBpbml0aWFsLndpZHRoKVxyXG5cclxuXHRcdFx0XHRcdGxldCBjZW50ZXJlZDogYm9vbGVhbiA9IHNldHRpbmdzLmFsd2F5c0NlbnRlclRoZVdpbmRvd1xyXG5cdFx0XHRcdFx0bGV0IGxlZnRBbGlnbmVkOiBib29sZWFuID0gc2V0dGluZ3MubGVmdEFsaWduV2luZG93XHJcblx0XHRcdFx0XHRsZXQgc2NyZWVuOiBhbnkgPSBhd2FpdCBfZ2V0U2NyZWVuKClcclxuXHJcblx0XHRcdFx0XHRpZiAobGVmdEFsaWduZWQpIHtcclxuXHRcdFx0XHRcdFx0bGVmdCA9IGluaXRpYWwubGVmdFxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmIChkZWJ1Zy5kZXNpcmVkLnRvcCAhPT0gbnVsbCkge1xyXG5cdFx0XHRcdFx0XHR0b3AgPSBkZWJ1Zy5kZXNpcmVkLnRvcFxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmIChkZWJ1Zy5kZXNpcmVkLmxlZnQgIT09IG51bGwpIHtcclxuXHRcdFx0XHRcdFx0bGVmdCA9IGRlYnVnLmRlc2lyZWQubGVmdFxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmIChjZW50ZXJlZCB8fCBwYXJhbXMucG9zaXRpb24gPT09IFByZXNldFBvc2l0aW9uLkNFTlRFUikge1xyXG5cdFx0XHRcdFx0XHQvLyBjZW50ZXIgdGhlIHdpbmRvdyBpZiB0aGUgZ2xvYmFsIG9wdGlvbiBpcyBzZXQgb3IgcmVxdWlyZWQgYnkgdGhlIHByZXNldFxyXG5cdFx0XHRcdFx0XHRsZWZ0ID0gTWF0aC5mbG9vcigoc2NyZWVuLndpZHRnIC0gYWN0dWFsLndpZHRoKSAvIDIpICsgc2NyZWVuLmxlZnRcclxuXHRcdFx0XHRcdFx0dG9wID0gTWF0aC5mbG9vcigoc2NyZWVuLmhlaWdodCAtIGFjdHVhbC5oZWlnaHQpIC8gMikgKyBzY3JlZW4udG9wXHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gcmVzZXQgd2luZG93IGluIGNhc2Ugb2YgZmFpbHVyZVxyXG5cdFx0XHRcdFx0V2luZG93cy5VcGRhdGUoaW5pdGlhbC5pZCwgeyB0b3AsIGxlZnQgfSlcclxuXHJcblx0XHRcdFx0XHRTZXR0aW5ncy5HZXQoJ2RlYnVnTG9nJywgW10sIHRydWUpLnRoZW4obG9nID0+IHtcclxuXHRcdFx0XHRcdFx0bG9nLnNwbGljZSg5KVxyXG5cdFx0XHRcdFx0XHRsb2cudW5zaGlmdChkZWJ1ZylcclxuXHJcblx0XHRcdFx0XHRcdFNldHRpbmdzLlNldCgnZGVidWdMb2cnLCBsb2csIHRydWUpXHJcblx0XHRcdFx0XHR9KVxyXG5cclxuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdCh7IGVycm9ycywgZGVidWcgfSlcclxuXHRcdFx0XHR9KVxyXG5cdFx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gTGltaXRQb3B1cChwYXJhbXM6IGFueSk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gV2luZG93cy5VcGRhdGUoVG9vbHNQb3B1cC5JRCgpLCBwYXJhbXMpXHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfZXhlY3V0ZVNjcmlwdChmdW5jOiBhbnksIHRhYklkPzogbnVtYmVyKTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHRcdGxldCBnZXRUYWJJZCA9IFByb21pc2UucmVzb2x2ZSh0YWJJZClcclxuXHJcblx0XHRcdGlmICghdGFiSWQpIHtcclxuXHRcdFx0XHRnZXRUYWJJZCA9IF9nZXRUYWIoKS50aGVuKHRhYiA9PiBQcm9taXNlLnJlc29sdmUodGFiLmlkKSlcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Z2V0VGFiSWQudGhlbih0YWJJZCA9PiB7XHJcblx0XHRcdFx0Y2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0YXJnZXQ6IHsgdGFiSWQ6IHRhYklkIHx8IG51bGwgfSxcclxuXHRcdFx0XHRcdFx0ZnVuYyxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRyZXN1bHQgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoUnVudGltZS5FcnJvcigpKSB7XHJcblx0XHRcdFx0XHRcdFx0cmVqZWN0KHsgSU5WQUxJRF9UQUI6IFJ1bnRpbWUuRXJyb3IoKSB9KVxyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHJlc29sdmUocmVzdWx0WzBdKVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KVxyXG5cdFx0XHR9KVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9yZXNpemUod2luSWQsIG9wdGlvbnMpOiBQcm9taXNlPFdpbmRvd3MuSVdpbmRvdz4ge1xyXG5cdFx0cmV0dXJuIFdpbmRvd3MuVXBkYXRlKHdpbklkLCBvcHRpb25zKS50aGVuKHVwZGF0ZWQgPT4ge1xyXG5cdFx0XHRsZXQgZXJyb3JzOiBzdHJpbmdbXSA9IFtdXHJcblxyXG5cdFx0XHRpZiAob3B0aW9ucy53aWR0aCAmJiBvcHRpb25zLndpZHRoIDwgdXBkYXRlZC53aWR0aCkge1xyXG5cdFx0XHRcdGVycm9ycy5wdXNoKCdNSU5fV0lEVEgnKVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAob3B0aW9ucy5oZWlnaHQgJiYgb3B0aW9ucy5oZWlnaHQgPCB1cGRhdGVkLmhlaWdodCkge1xyXG5cdFx0XHRcdGVycm9ycy5wdXNoKCdNSU5fSEVJR0hUJylcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKG9wdGlvbnMud2lkdGggJiYgb3B0aW9ucy53aWR0aCA+IHVwZGF0ZWQud2lkdGgpIHtcclxuXHRcdFx0XHRlcnJvcnMucHVzaCgnTUFYX1dJRFRIJylcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKG9wdGlvbnMuaGVpZ2h0ICYmIG9wdGlvbnMuaGVpZ2h0ID4gdXBkYXRlZC5oZWlnaHQpIHtcclxuXHRcdFx0XHRlcnJvcnMucHVzaCgnTUFYX0hFSUdIVCcpXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChlcnJvcnMubGVuZ3RoKSB7XHJcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KHtcclxuXHRcdFx0XHRcdE9VVF9PRl9CT1VORFM6IHsga2V5czogZXJyb3JzLCB0YXJnZXQ6IG9wdGlvbnMsIGFjdHVhbDogdXBkYXRlZCB9LFxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEFsbCBnb29kIVxyXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVwZGF0ZWQpXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNTZXQodmFsOiBhbnkpOiBib29sZWFuIHtcclxuXHRcdHJldHVybiB2YWwgIT09IG51bGwgJiYgdmFsICE9PSB1bmRlZmluZWRcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF92YWxpZGF0ZVVybCh0YWI6IFRhYnMuSVRhYik6IFByb21pc2U8c3RyaW5nPiB7XHJcblx0XHRsZXQgcHJvdG9jb2wgPSBTdHJpbmcodGFiLnVybCkuc3BsaXQoJzonKS5zaGlmdCgpXHJcblx0XHRsZXQgYWxsb3dlZCA9IFsnaHR0cCcsICdodHRwcycsICdmaWxlJ11cclxuXHJcblx0XHRpZiAoYWxsb3dlZC5pbmRleE9mKHByb3RvY29sKSA8IDApIHtcclxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KHtcclxuXHRcdFx0XHRJTlZBTElEX1BST1RPQ09MOiB7IHByb3RvY29sOiBwcm90b2NvbCwgdGFiOiB0YWIgfSxcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRfZXhlY3V0ZVNjcmlwdCgoKSA9PiB0cnVlLCB0YWIuaWQpXHJcblx0XHRcdFx0LnRoZW4ocmVzb2x2ZSlcclxuXHRcdFx0XHQuY2F0Y2goZXJyID0+IHtcclxuXHRcdFx0XHRcdGlmIChwcm90b2NvbCA9PT0gJ2ZpbGUnKSB7XHJcblx0XHRcdFx0XHRcdHJlamVjdCh7IEZJTEVfUFJPVE9DT0xfUEVSTUlTU0lPTjogeyB0YWI6IHRhYiwgZXJyOiBlcnIgfSB9KVxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0cmVqZWN0KHsgV0VCU1RPUkVfUEVSTUlTU0lPTjogeyB0YWI6IHRhYiwgZXJyOiBlcnIgfSB9KVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pXHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3NpbGVuY2UoKSB7fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRJY29uVHlwZShzdHlsZTogc3RyaW5nKTogdm9pZCB7XHJcblx0XHRfX3NldEljb24oc3R5bGUpXHJcblx0fVxyXG5cclxuXHRpbnRlcmZhY2UgSVZpZXdwb3J0IHtcclxuXHRcdHdpZHRoOiBudW1iZXJcclxuXHRcdGhlaWdodDogbnVtYmVyXHJcblx0XHRkcHI6IG51bWJlclxyXG5cdFx0em9vbTogbnVtYmVyXHJcblx0XHRzY3JlZW46IHtcclxuXHRcdFx0YXZhaWxIZWlnaHQ6IG51bWJlclxyXG5cdFx0XHRhdmFpbFdpZHRoOiBudW1iZXJcclxuXHRcdFx0YXZhaWxMZWZ0OiBudW1iZXJcclxuXHRcdFx0YXZhaWxUb3A6IG51bWJlclxyXG5cdFx0XHRoZWlnaHQ6IG51bWJlclxyXG5cdFx0XHR3aWR0aDogbnVtYmVyXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpbnRlcmZhY2UgSVJlc2l6ZU9wdGlvbnMge1xyXG5cdFx0dGFyZ2V0PzogUHJlc2V0VGFyZ2V0XHJcblx0XHR3aWR0aD86IG51bWJlclxyXG5cdFx0aGVpZ2h0PzogbnVtYmVyXHJcblx0XHRwb3NpdGlvbj86IFByZXNldFBvc2l0aW9uXHJcblx0XHR0b3A/OiBudW1iZXJcclxuXHRcdGxlZnQ/OiBudW1iZXJcclxuXHRcdHNldHRpbmdzPzogYW55XHJcblx0fVxyXG5cclxuXHRHZXRTZXR0aW5ncygpLnRoZW4oKHNldHRpbmdzOiBTZXR0aW5ncy5JS2V5cykgPT4ge1xyXG5cdFx0c2V0SWNvblR5cGUoc2V0dGluZ3MucG9wdXBJY29uU3R5bGUpXHJcblxyXG5cdFx0aWYgKHNldHRpbmdzLmFsd2F5c1Nob3dUaGVUb29sdGlwKSB7XHJcblx0XHRcdFRvb2x0aXAuRW5hYmxlT25BbGxQYWdlcygpXHJcblx0XHR9XHJcblx0fSlcclxuXHJcblx0ZnVuY3Rpb24gX19zZXRJY29uKHN0eWxlOiBzdHJpbmcpIHtcclxuXHRcdHN0eWxlID0gU3RyaW5nKHN0eWxlKVxyXG5cclxuXHRcdGlmIChzdHlsZS5tYXRjaCgvXlxcZCskLykpIHtcclxuXHRcdFx0Y29uc3Qgc3R5bGVzID0gWydncmV5JywgJ2RhcmsrY29sb3InLCAnbGlnaHQrY29sb3InXVxyXG5cdFx0XHRzdHlsZSA9IFsnZ3JleScsICdkYXJrK2NvbG9yJywgJ2xpZ2h0K2NvbG9yJ11bc3R5bGVdIHx8ICdkYXJrK2NvbG9yJ1xyXG5cdFx0fVxyXG5cclxuXHRcdGZldGNoKGNocm9tZS5ydW50aW1lLmdldFVSTCgnYXNzZXRzL2ljb25zL2Jyb3dzZXItaWNvbi0xNi5zdmcnKSlcclxuXHRcdFx0LnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UudGV4dCgpKVxyXG5cdFx0XHQudGhlbihzdmcgPT4gX3Byb2Nlc3NDb2xvcnMoc3ZnKSlcclxuXHRcdFx0LnRoZW4oYXN5bmMgc3ZnID0+IHtcclxuXHRcdFx0XHRjb25zdCBsaWdodCA9IHN0eWxlLm1hdGNoKC9saWdodC8pXHJcblxyXG5cdFx0XHRcdGNvbnN0IFtpY29uMTYsIGljb24zMl0gPSBhd2FpdCBwZXJmb3JtT2ZmU2NyZWVuKFxyXG5cdFx0XHRcdFx0eyBhY3Rpb246ICdnZXRJY29ucycsIGRhdGE6IHsgc3ZnLCBsaWdodCB9IH0sXHJcblx0XHRcdFx0XHQnR2V0IGljb24gdmFyaWF0aW9ucy4nXHJcblx0XHRcdFx0KVxyXG5cclxuXHRcdFx0XHRjaHJvbWUuYWN0aW9uLnNldEljb24oe1xyXG5cdFx0XHRcdFx0aW1hZ2VEYXRhOiB7XHJcblx0XHRcdFx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0XHRcdFx0JzE2JzogbmV3IEltYWdlRGF0YShuZXcgVWludDhDbGFtcGVkQXJyYXkoaWNvbjE2LmRhdGEpLCBpY29uMTYud2lkdGgsIGljb24xNi5oZWlnaHQsIHtcclxuXHRcdFx0XHRcdFx0XHRjb2xvclNwYWNlOiBpY29uMTYuY29sb3JTcGFjZSxcclxuXHRcdFx0XHRcdFx0fSksXHJcblx0XHRcdFx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0XHRcdFx0JzMyJzogbmV3IEltYWdlRGF0YShuZXcgVWludDhDbGFtcGVkQXJyYXkoaWNvbjMyLmRhdGEpLCBpY29uMzIud2lkdGgsIGljb24zMi5oZWlnaHQsIHtcclxuXHRcdFx0XHRcdFx0XHRjb2xvclNwYWNlOiBpY29uMzIuY29sb3JTcGFjZSxcclxuXHRcdFx0XHRcdFx0fSksXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0pXHJcblx0XHRcdH0pXHJcblxyXG5cdFx0ZnVuY3Rpb24gX3Byb2Nlc3NDb2xvcnMoc3ZnKSB7XHJcblx0XHRcdHN3aXRjaCAoc3R5bGUpIHtcclxuXHRcdFx0XHRjYXNlICdsaWdodCc6XHJcblx0XHRcdFx0XHRzdmcgPSBzdmcucmVwbGFjZSgvMzQ3ZjJiLywgJ2VlZScpXHJcblx0XHRcdFx0Y2FzZSAnbGlnaHQrY29sb3InOlxyXG5cdFx0XHRcdFx0c3ZnID0gc3ZnLnJlcGxhY2UoLzMzMy8sICdlZWUnKVxyXG5cdFx0XHRcdFx0YnJlYWtcclxuXHJcblx0XHRcdFx0Y2FzZSAnZGFyayc6XHJcblx0XHRcdFx0XHRzdmcgPSBzdmcucmVwbGFjZSgvMzQ3ZjJiLywgJzMzMycpXHJcblx0XHRcdFx0XHRicmVha1xyXG5cclxuXHRcdFx0XHRjYXNlICduZXV0cmFsJzpcclxuXHRcdFx0XHRcdHN2ZyA9IHN2Zy5yZXBsYWNlKC8zNDdmMmIvLCAnNjY2JylcclxuXHRcdFx0XHRcdHN2ZyA9IHN2Zy5yZXBsYWNlKC8zMzMvLCAnNjY2JylcclxuXHRcdFx0XHRcdGJyZWFrXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoc3ZnKVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0YXN5bmMgZnVuY3Rpb24gcGVyZm9ybU9mZlNjcmVlbihyZXF1ZXN0OiBhbnksIGp1c3RpZmljYXRpb246IHN0cmluZykge1xyXG5cdFx0YXdhaXQgY2hyb21lLm9mZnNjcmVlbi5jcmVhdGVEb2N1bWVudCh7XHJcblx0XHRcdHVybDogJ2Fzc2V0cy9vZmYtc2NyZWVuLmh0bWwnLFxyXG5cdFx0XHRyZWFzb25zOiBbY2hyb21lLm9mZnNjcmVlbi5SZWFzb24uRE9NX1BBUlNFUl0sXHJcblx0XHRcdGp1c3RpZmljYXRpb24sXHJcblx0XHR9KVxyXG5cclxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UocmVxdWVzdClcclxuXHRcdGF3YWl0IGNocm9tZS5vZmZzY3JlZW4uY2xvc2VEb2N1bWVudCgpXHJcblxyXG5cdFx0cmV0dXJuIHJlc3BvbnNlXHJcblx0fVxyXG59XHJcbiJdfQ==
