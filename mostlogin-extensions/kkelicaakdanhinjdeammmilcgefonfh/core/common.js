var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/// <reference path="./Utils/Dictionaries.ts" />
var Core;
(function (Core) {
    class TemplateRegistry {
        static getTemplate(id) {
            if (!TemplateRegistry._cache[id]) {
                TemplateRegistry._cache[id] = document.getElementById(id);
            }
            return TemplateRegistry._cache[id].cloneNode(true);
        }
    }
    TemplateRegistry._cache = {};
    Core.TemplateRegistry = TemplateRegistry;
})(Core || (Core = {}));
/// <reference path="../../typings/rivets.d.ts" />
/// <reference path="./TemplateRegistry.ts" />
var Core;
(function (Core) {
    var Components;
    (function (Components) {
        // function template(): string {
        // 	return Core.TemplateRegistry.getTemplate(this.component.name);
        // }
        function initialize(element, data) {
            return data;
        }
        function create(name, config) {
            config = config || {
                name: null,
                static: null,
                template: null,
                initialize: null,
            };
            return rivets.components[name] = {
                name: name,
                static: config.static || [],
                template: config.template || function (el) {
                    el = el || this.el;
                    let children = [].slice.call(el ? el.children : []);
                    let template = Core.TemplateRegistry.getTemplate(name);
                    let content = template.content.querySelector('content');
                    if (children && content) {
                        for (let node of children) {
                            content.parentNode.insertBefore(node, content);
                        }
                    }
                    content && content.parentNode.removeChild(content);
                    return template.innerHTML;
                },
                initialize: config.initialize || initialize
            };
        }
        Components.create = create;
    })(Components = Core.Components || (Core.Components = {}));
})(Core || (Core = {}));
var Core;
(function (Core) {
    class CustomElement {
        constructor(node, data) {
            node._data = node._data || {};
            this._node = node;
            for (let key in data) {
                if (node._data[key] === undefined) {
                    node._data[key] = data[key];
                }
                this[key] = this.getData(key);
            }
            let self = this.constructor;
            for (let attr of self._attributes) {
                this._linkAttr(attr);
            }
        }
        getData(key) {
            return this._node._data[key];
        }
        setData(key, val) {
            if (this._node._data[key] !== val) {
                this._node._data[key] = val;
                this._node.dispatchEvent(new CustomEvent(key + '-change'));
            }
        }
        _linkAttr(key) {
            this[key] = this.getData(key);
            this._node.addEventListener(key + '-update', (e) => {
                this[key] = this.getData(key);
            }, false);
        }
    }
    CustomElement._attributes = [];
    Core.CustomElement = CustomElement;
})(Core || (Core = {}));
var Core;
(function (Core) {
    var Decorators;
    (function (Decorators) {
        function ComputedFrom(...keys) {
            return function ComputedFrom(target, key, descriptor) {
                target.__dependencies = target.__dependencies || {};
                target.__dependencies[key] = keys;
            };
        }
        Decorators.ComputedFrom = ComputedFrom;
        var Observe = rivets._.Binding.prototype.observe;
        rivets._.Binding.prototype.observe = function (obj, keypath, callback) {
            var path = keypath.split('.');
            var root, prop;
            if (path.length < 2) {
                root = obj;
                prop = path[0];
            }
            else {
                root = obj[path[0]];
                prop = path[1];
            }
            if (root && root.__dependencies) {
                this.options = this.options || {};
                this.options.dependencies = this.options.dependencies || root.__dependencies[prop];
            }
            return Observe.call(this, obj, keypath, callback);
        };
    })(Decorators = Core.Decorators || (Core.Decorators = {}));
})(Core || (Core = {}));
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
/// <reference path="./Decorators/ComputedFrom.ts" />
/// <reference path="./Utils/Enums.ts" />
/// <reference path="./Utils/UUID.ts" />
var Core;
(function (Core) {
    var ComputedFrom = Core.Decorators.ComputedFrom;
    class Preset {
        constructor(data) {
            this.id = data.id || Core.Utils.UUID();
            this.width = data.width || null;
            this.height = data.height || null;
            this.top = isNaN(parseInt(data.top, 10)) ? null : data.top;
            this.left = isNaN(parseInt(data.left, 10)) ? null : data.left;
            this.description = data.description || null;
            this.position = data.position || Core.PresetPosition.DEFAULT;
            this.type = parseInt(data.type, 10) == data.type ? data.type : Core.PresetType.DESKTOP;
            this.target = data.target || Core.PresetTarget.WINDOW;
        }
        title() {
            let title = this.width + ' &times; ' + this.height;
            if (!this.width) {
                title = '<em>Height:</em> ' + this.height;
            }
            if (!this.height) {
                title = '<em>Width:</em> ' + this.width;
            }
            return title;
        }
        icon() {
            let icon = '';
            switch (this.type) {
                case Core.PresetType.PHONE:
                    icon = '#icon-phone';
                    break;
                case Core.PresetType.TABLET:
                    icon = '#icon-tablet';
                    break;
                case Core.PresetType.LAPTOP:
                    icon = '#icon-laptop';
                    break;
                default:
                    icon = '#icon-desktop';
                    break;
            }
            return icon;
        }
    }
    __decorate([
        ComputedFrom('width', 'height'),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], Preset.prototype, "title", null);
    __decorate([
        ComputedFrom('type'),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0)
    ], Preset.prototype, "icon", null);
    Core.Preset = Preset;
})(Core || (Core = {}));
var Core;
(function (Core) {
    var Utils;
    (function (Utils) {
        var DOM;
        (function (DOM) {
            function q(selector, context) {
                if (typeof selector !== 'string') {
                    return selector;
                }
                return (context || document).querySelector(selector);
            }
            DOM.q = q;
            function qAll(selector, context) {
                let result = selector;
                if (typeof selector === 'string') {
                    result = (context || document).querySelectorAll(selector);
                }
                return [].slice.call(result);
            }
            DOM.qAll = qAll;
            function on(event, target, listener, capture) {
                let node = q(target);
                capture = !!capture;
                if (node) {
                    node.addEventListener(event, listener, capture);
                }
            }
            DOM.on = on;
            function trigger(event, target, config) {
                let node = q(target);
                if (node) {
                    node.dispatchEvent(new CustomEvent(event, config));
                }
            }
            DOM.trigger = trigger;
            function remove(selector, context) {
                let node = q(selector);
                node && node.parentNode.removeChild(node);
                return node;
            }
            DOM.remove = remove;
            function addClass(target, className) {
                let node = q(target);
                if (node) {
                    node.classList.add(className);
                }
            }
            DOM.addClass = addClass;
            function removeClass(target, className) {
                let node = q(target);
                if (node) {
                    node.classList.remove(className);
                }
            }
            DOM.removeClass = removeClass;
            function toggleClass(target, className) {
                let node = q(target);
                if (node) {
                    node.classList.toggle(className);
                }
                return hasClass(node, className);
            }
            DOM.toggleClass = toggleClass;
            function hasClass(target, className) {
                let node = q(target);
                if (node) {
                    return node.classList.contains(className);
                }
            }
            DOM.hasClass = hasClass;
            function empty(target) {
                let node = q(target);
                while (node.firstChild) {
                    node.removeChild(node.firstChild);
                }
            }
            DOM.empty = empty;
            function hide(target, className, waitFor) {
                return _toggleClass(target, false, className, waitFor);
            }
            DOM.hide = hide;
            function show(target, className, waitFor) {
                return _toggleClass(target, true, className, waitFor);
            }
            DOM.show = show;
            function animate(target, className, propertyName) {
                return _toggleClass(target, true, className, null, propertyName);
            }
            DOM.animate = animate;
            function _hasTransition(node) {
                let duration = window.getComputedStyle(node).transitionDuration.split(',');
                for (let part of duration) {
                    if (parseFloat(part) > 0) {
                        return true;
                    }
                }
                return false;
            }
            function _toggleClass(target, state, className = 'visible', waitFor, propertyName) {
                var node = q(target);
                var action = state ? 'add' : 'remove';
                waitFor = waitFor || node;
                if (!node) {
                    return Promise.resolve(null);
                }
                if (!_hasTransition(waitFor)) {
                    node.classList[action](className);
                    return Promise.resolve(node);
                }
                return new Promise((resolve, reject) => {
                    function transitionEnded(evt) {
                        if ((!propertyName || propertyName === evt.propertyName) && waitFor === evt.target) {
                            waitFor.removeEventListener('transitionend', transitionEnded);
                            resolve(waitFor);
                        }
                    }
                    waitFor.addEventListener('transitionend', transitionEnded);
                    node.classList[action](className);
                });
            }
            function eventPath(evt) {
                let node = evt.relatedTarget;
                let path = [];
                while (node = node.parentNode) {
                    path.push(node);
                }
                return path;
            }
            DOM.eventPath = eventPath;
        })(DOM = Utils.DOM || (Utils.DOM = {}));
    })(Utils = Core.Utils || (Core.Utils = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/tab-nav.d.ts" />
/// <reference path="../../Core/Utils/DOM.ts" />
var Views;
(function (Views) {
    var Common;
    (function (Common) {
        var $ = Core.Utils.DOM;
        const KEY_ESC = 27;
        class ModalMessage {
            constructor(title, message, blocking = false, actions = [], options = {}) {
                this.title = title;
                this.message = message;
                this.blocking = blocking;
                this.actions = actions;
                this.options = options;
                this.visible = false;
                this.onClose = new ModalEventRegistry();
                this.show();
            }
            show() {
                return $.show(document.body, 'wr_modal_visible').then(_ => {
                    let modal = $.q('.WR_modal');
                    let action = $.q('.WR_modal_actions .main', modal) || $.q('.WR_modal_actions button:last-child', modal);
                    if (this.options.class) {
                        $.addClass(modal, this.options.class);
                    }
                    action && action.focus();
                    this.visible = true;
                    TabNav.limitTo(modal);
                    if (!this.blocking) {
                        this._dismiss = (evt) => {
                            if (evt.keyCode === KEY_ESC) {
                                evt.preventDefault();
                                evt.stopPropagation();
                                for (let action of this.actions) {
                                    action.onDismiss && action.handler();
                                }
                                this.hide();
                                return false;
                            }
                        };
                        document.addEventListener('keyup', this._dismiss);
                    }
                    return Promise.resolve();
                });
            }
            hide() {
                return $.hide(document.body, 'wr_modal_visible', $.q('.WR_modal')).then(_ => {
                    this.visible = false;
                    document.removeEventListener('keyup', this._dismiss);
                    TabNav.reset();
                    this.onClose.trigger();
                    return Promise.resolve();
                });
            }
        }
        Common.ModalMessage = ModalMessage;
        class ModalEventRegistry {
            constructor() {
                this._handlers = [];
            }
            addListener(handler) {
                let handlers = this._handlers;
                let existing = handlers.indexOf(handler);
                if (existing > -1) {
                    return false;
                }
                handlers.push(handler);
                return true;
            }
            removeListener(handler) {
                let handlers = this._handlers;
                let existing = handlers.indexOf(handler);
                if (existing === -1) {
                    return false;
                }
                handlers.splice(existing, 1);
                return true;
            }
            removeAllListeners() {
                this._handlers = [];
            }
            trigger(context, data) {
                return __awaiter(this, void 0, void 0, function* () {
                    for (let handler of this._handlers) {
                        yield handler.call(context, data);
                    }
                });
            }
        }
        Common.ModalEventRegistry = ModalEventRegistry;
    })(Common = Views.Common || (Views.Common = {}));
})(Views || (Views = {}));
/// <reference path="../../Core/CustomElement.ts" />
var Views;
(function (Views) {
    var Common;
    (function (Common) {
        class Icon extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
                this.src = data.src;
            }
            get src() {
                return this.getData('src');
            }
            set src(val) {
                this.setData('src', val);
                this._setSrc(val);
            }
            _setSrc(val) {
                var svg, use;
                svg = this._node.querySelector('svg');
                if (val && val[0] == '#') {
                    val = '../assets/icons/sprite.svg' + val;
                }
                while (svg.firstChild) {
                    svg.removeChild(svg.firstChild);
                }
                if (val) {
                    use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', val);
                    svg.appendChild(use);
                }
            }
        }
        Icon._attributes = [];
        Common.Icon = Icon;
        Core.Components.create('wr-icon', {
            static: ['class', 'src'],
            initialize: function (el, data) {
                data.src = data.src || el.getAttribute('src');
                return new Icon(el, data);
            }
        });
    })(Common = Views.Common || (Views.Common = {}));
})(Views || (Views = {}));
var Core;
(function (Core) {
    var Input;
    (function (Input) {
        Input.Keys = {
            BACKSPACE: 8,
            TAB: 9,
            ENTER: 13,
            SHIFT: 16,
            ALT: 18,
            ESCAPE: 27,
            SPACE: 32,
            END: 35,
            HOME: 36,
            LEFT: 37,
            UP: 38,
            RIGHT: 39,
            DOWN: 40,
            DELETE: 46,
            ARROWS: [37, 40],
            DIGITS: [48, 57],
            NUMPAD: [96, 105],
            FUNC: [112, 123]
        };
    })(Input = Core.Input || (Core.Input = {}));
})(Core || (Core = {}));
/// <reference path="../../Core/CustomElement.ts" />
/// <reference path="../../Core/Components.ts" />
/// <reference path="../../Core/Input/Keys.ts" />
var Views;
(function (Views) {
    var Common;
    (function (Common) {
        var Keys = Core.Input.Keys;
        class NumericInput extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
                node.onkeydown = filterKeys;
            }
            get val() {
                return this.getData('val');
            }
            set val(val) {
                this.setData('val', val);
            }
        }
        NumericInput._attributes = ['val'];
        Common.NumericInput = NumericInput;
        function filterKeys(e) {
            var key = e.keyCode;
            switch (true) {
                case !e.shiftKey && (key >= Keys.DIGITS[0] && key <= Keys.DIGITS[1]):
                case (key >= Keys.NUMPAD[0] && key <= Keys.NUMPAD[1]):
                case (key >= Keys.FUNC[0] && key <= Keys.FUNC[1]):
                case key == Keys.LEFT:
                case key == Keys.RIGHT:
                case key == Keys.TAB:
                case key == Keys.BACKSPACE:
                case key == Keys.DELETE:
                case key == Keys.ENTER:
                case key == Keys.HOME:
                case key == Keys.END:
                case key == Keys.ESCAPE:
                case e.ctrlKey || e.metaKey:
                    // allowed
                    break;
                default:
                    return _cancel(e);
                    break;
            }
        }
        function _cancel(e) {
            e.preventDefault();
            return false;
        }
        Core.Components.create('wr-numeric-input', {
            static: ['maxlength', 'placeholder', 'val'],
            initialize: function (el, data) {
                return new NumericInput(el, data);
            }
        });
    })(Common = Views.Common || (Views.Common = {}));
})(Views || (Views = {}));
var Views;
(function (Views) {
    var Common;
    (function (Common) {
        Core.Components.create('wr-preset', {
            static: [],
            initialize: function (el, data) {
                if (!(data.preset instanceof Core.Preset)) {
                    data.preset = new Core.Preset(data.preset);
                }
                return data;
            }
        });
    })(Common = Views.Common || (Views.Common = {}));
})(Views || (Views = {}));
/// <reference path="../../Core/CustomElement.ts" />
/// <reference path="../../Core/Components.ts" />
var Views;
(function (Views) {
    var Common;
    (function (Common) {
        class StatusToggle extends Core.CustomElement {
            constructor(node, data) {
                super(node, data);
            }
            get ischecked() {
                return this.getData('ischecked');
            }
            set ischecked(val) {
                this.setData('ischecked', val);
            }
        }
        StatusToggle._attributes = ['ischecked'];
        Common.StatusToggle = StatusToggle;
        Core.Components.create('wr-status-toggle', {
            static: ['on', 'off', 'ischecked'],
            initialize: function (el, data) {
                return new StatusToggle(el, data);
            }
        });
    })(Common = Views.Common || (Views.Common = {}));
})(Views || (Views = {}));
var Core;
(function (Core) {
    var Binders;
    (function (Binders) {
        class BaseBinding {
            publish() {
            }
            formattedValue(val) {
            }
        }
        Binders.BaseBinding = BaseBinding;
    })(Binders = Core.Binders || (Core.Binders = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
/// <reference path="./BaseBinding.ts" />
var Core;
(function (Core) {
    var Binders;
    (function (Binders) {
        function AttributeBinding(el, value) {
            let bindings = this.view.bindings;
            for (let i = 0, l = bindings.length; i < l; i++) {
                if (el === bindings[i].el && bindings[i].componentView) {
                    let view = bindings[i].componentView;
                    view.models = view.models || [];
                    view.models[this.type] = value;
                }
            }
            if (value) {
                el.setAttribute(this.type, value);
            }
            else {
                el.removeAttribute(this.type);
            }
        }
        Binders.AttributeBinding = AttributeBinding;
        rivets.binders['*'] = AttributeBinding;
    })(Binders = Core.Binders || (Core.Binders = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
/// <reference path="./BaseBinding.ts" />
var Core;
(function (Core) {
    var Binders;
    (function (Binders) {
        class DeepBinding extends Binders.BaseBinding {
            constructor() {
                super(...arguments);
                this.publishes = true;
                this.priority = 3000;
            }
            bind(el) {
                this.model && el.addEventListener(this.args[0] + '-change', this.publish, false);
            }
            unbind(el) {
                el.removeEventListener(this.args[0] + '-change', this.publish, false);
            }
            routine(el, value) {
                if (!this.model) {
                    return false;
                }
                el._data = el._data || {};
                el._data[this.args[0]] = this.formattedValue(value);
                el.dispatchEvent(new CustomEvent(this.args[0] + '-update'));
            }
            getValue(el) {
                return this.formattedValue(el._data ? el._data[this.args[0]] : null);
            }
        }
        Binders.DeepBinding = DeepBinding;
        rivets.binders['deep-*'] = new DeepBinding();
    })(Binders = Core.Binders || (Core.Binders = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        function FriendlyCmdShortcut(value) {
            return String(value).replace(/\+/g, ' + ').replace('Command', 'Cmd').replace(' Arrow', '') || '<not set>';
        }
        Formatters.FriendlyCmdShortcut = FriendlyCmdShortcut;
        function FriendlyCmdDescription(cmd) {
            if (cmd.name === '_execute_action') {
                return 'Show extension popup';
            }
            return cmd.description || cmd.shortcut;
        }
        Formatters.FriendlyCmdDescription = FriendlyCmdDescription;
        rivets.formatters['FriendlyCmdShortcut'] = FriendlyCmdShortcut;
        rivets.formatters['FriendlyCmdDescription'] = FriendlyCmdDescription;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        function FriendlyDate(value) {
            var d = new Date(`${value} +00:00`);
            return d.toLocaleString();
        }
        Formatters.FriendlyDate = FriendlyDate;
        rivets.formatters['FriendlyDate'] = FriendlyDate;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        Formatters.IntAndNull = {
            read: function (value) {
                let val = parseInt(value, 10);
                return isNaN(val) ? null : val;
            },
            publish: function (value) {
                let val = parseInt(value, 10);
                return isNaN(val) ? null : val;
            }
        };
        rivets.formatters['IntAndNull'] = Formatters.IntAndNull;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        Formatters.IntOrNull = {
            read: function (value) {
                return parseInt(value, 10) || null;
            },
            publish: function (value) {
                return parseInt(value, 10) || null;
            }
        };
        rivets.formatters['IntOrNull'] = Formatters.IntOrNull;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        function Negate(value) {
            return !value;
        }
        Formatters.Negate = Negate;
        rivets.formatters['Negate'] = Negate;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        Formatters.Nullify = {
            read: function (value) {
                return value || null;
            },
            publish: function (value) {
                return value || null;
            }
        };
        rivets.formatters['Nullify'] = Formatters.Nullify;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        function Stringify(value) {
            return JSON.stringify(value);
        }
        Formatters.Stringify = Stringify;
        rivets.formatters['Stringify'] = Stringify;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        function ToBool(value) {
            return !!value;
        }
        Formatters.ToBool = ToBool;
        function ArrayNotEmpty(value) {
            return value && value.length;
        }
        Formatters.ArrayNotEmpty = ArrayNotEmpty;
        Formatters.IntToBool = {
            read: function (value) {
                return !!value;
            },
            publish: function (value) {
                return value ? 1 : 0;
            }
        };
        rivets.formatters['ToBool'] = ToBool;
        rivets.formatters['IntToBool'] = Formatters.IntToBool;
        rivets.formatters['ArrayNotEmpty'] = ArrayNotEmpty;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
})(Core || (Core = {}));
/// <reference path="../../../typings/rivets.d.ts" />
var Core;
(function (Core) {
    var Formatters;
    (function (Formatters) {
        Formatters.ToInt = {
            read: function (value) {
                return parseInt(value, 10) || 0;
            },
            publish: function (value) {
                return parseInt(value, 10) || 0;
            }
        };
        rivets.formatters['ToInt'] = Formatters.ToInt;
    })(Formatters = Core.Formatters || (Core.Formatters = {}));
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9jb3JlL1RlbXBsYXRlUmVnaXN0cnkudHMiLCJzcmMvY29yZS9Db21wb25lbnRzLnRzIiwic3JjL2NvcmUvQ3VzdG9tRWxlbWVudC50cyIsInNyYy9jb3JlL0RlY29yYXRvcnMvQ29tcHV0ZWRGcm9tLnRzIiwic3JjL2NvcmUvVXRpbHMvRW51bXMudHMiLCJzcmMvY29yZS9VdGlscy9VVUlELnRzIiwic3JjL2NvcmUvUHJlc2V0LnRzIiwic3JjL0NvcmUvVXRpbHMvRE9NLnRzIiwic3JjL3ZpZXdzL2NvbW1vbi9Nb2RhbC50cyIsInNyYy92aWV3cy9jb21tb24vaWNvbi50cyIsInNyYy9Db3JlL0lucHV0L0tleXMudHMiLCJzcmMvdmlld3MvY29tbW9uL251bWVyaWMtaW5wdXQudHMiLCJzcmMvdmlld3MvY29tbW9uL3ByZXNldC50cyIsInNyYy92aWV3cy9jb21tb24vc3RhdHVzLXRvZ2dsZS50cyIsInNyYy9jb3JlL0JpbmRlcnMvQmFzZUJpbmRpbmcudHMiLCJzcmMvY29yZS9CaW5kZXJzL0F0dHJpYnV0ZUJpbmRpbmcudHMiLCJzcmMvY29yZS9CaW5kZXJzL0RlZXBCaW5kaW5nLnRzIiwic3JjL2NvcmUvRm9ybWF0dGVycy9GcmllbmRseUNvbW1hbmRzLnRzIiwic3JjL2NvcmUvRm9ybWF0dGVycy9GcmllbmRseURhdGUudHMiLCJzcmMvY29yZS9Gb3JtYXR0ZXJzL0ludEFuZE51bGwudHMiLCJzcmMvY29yZS9Gb3JtYXR0ZXJzL0ludE9yTnVsbC50cyIsInNyYy9jb3JlL0Zvcm1hdHRlcnMvTmVnYXRlLnRzIiwic3JjL2NvcmUvRm9ybWF0dGVycy9OdWxsaWZ5LnRzIiwic3JjL2NvcmUvRm9ybWF0dGVycy9TdHJpbmdpZnkudHMiLCJzcmMvY29yZS9Gb3JtYXR0ZXJzL1RvQm9vbC50cyIsInNyYy9jb3JlL0Zvcm1hdHRlcnMvVG9JbnQudHMiLCJzcmMvY29yZS9VdGlscy9SZXF1ZXN0LnRzIiwic3JjL2NvcmUvVXRpbHMvVW5pcXVlU3RhY2sudHMiLCJzcmMvY29yZS9VdGlscy9VdGlscy50cyIsInNyYy9jb3JlL1V0aWxzL0RpY3Rpb25hcmllcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxnREFBZ0Q7QUFFaEQsSUFBTyxJQUFJLENBY1Y7QUFkRCxXQUFPLElBQUk7SUFHVixNQUFhLGdCQUFnQjtRQUc1QixNQUFNLENBQUMsV0FBVyxDQUFDLEVBQVU7WUFDNUIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDakMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDMUQ7WUFFRCxPQUFxQixnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xFLENBQUM7O0lBUk0sdUJBQU0sR0FBdUIsRUFBRSxDQUFDO0lBRDNCLHFCQUFnQixtQkFVNUIsQ0FBQTtBQUNGLENBQUMsRUFkTSxJQUFJLEtBQUosSUFBSSxRQWNWO0FDaEJELGtEQUFrRDtBQUNsRCw4Q0FBOEM7QUFFOUMsSUFBTyxJQUFJLENBd0NWO0FBeENELFdBQU8sSUFBSTtJQUFDLElBQUEsVUFBVSxDQXdDckI7SUF4Q1csV0FBQSxVQUFVO1FBQ3JCLGdDQUFnQztRQUNoQyxrRUFBa0U7UUFDbEUsSUFBSTtRQUVKLFNBQVMsVUFBVSxDQUFDLE9BQW9CLEVBQUUsSUFBUztZQUNsRCxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxTQUFnQixNQUFNLENBQUMsSUFBWSxFQUFFLE1BQVk7WUFDaEQsTUFBTSxHQUFHLE1BQU0sSUFBSTtnQkFDbEIsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsTUFBTSxFQUFFLElBQUk7Z0JBQ1osUUFBUSxFQUFFLElBQUk7Z0JBQ2QsVUFBVSxFQUFFLElBQUk7YUFDaEIsQ0FBQTtZQUVELE9BQU8sTUFBTSxDQUFDLFVBQVUs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LFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUV0RSxPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUM7UUFMZSxZQUFNLFNBS3JCLENBQUE7SUFDRixDQUFDLEVBUFcsS0FBSyxHQUFMLFVBQUssS0FBTCxVQUFLLFFBT2hCO0FBQUQsQ0FBQyxFQVBNLElBQUksS0FBSixJQUFJLFFBT1YiLCJmaWxlIjoiY29yZS9jb21tb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9VdGlscy9EaWN0aW9uYXJpZXMudHNcIiAvPlxyXG5cclxubW9kdWxlIENvcmUge1xyXG5cdGltcG9ydCBJRGljdCA9IENvcmUuVXRpbHMuSURpY3Q7XHJcblxyXG5cdGV4cG9ydCBjbGFzcyBUZW1wbGF0ZVJlZ2lzdHJ5IHtcclxuXHRcdHN0YXRpYyBfY2FjaGU6IElEaWN0PEhUTUxFbGVtZW50PiA9IHt9O1xyXG5cclxuXHRcdHN0YXRpYyBnZXRUZW1wbGF0ZShpZDogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xyXG5cdFx0XHRpZiAoIVRlbXBsYXRlUmVnaXN0cnkuX2NhY2hlW2lkXSkge1xyXG5cdFx0XHRcdFRlbXBsYXRlUmVnaXN0cnkuX2NhY2hlW2lkXSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIDxIVE1MRWxlbWVudD4gVGVtcGxhdGVSZWdpc3RyeS5fY2FjaGVbaWRdLmNsb25lTm9kZSh0cnVlKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL3R5cGluZ3Mvcml2ZXRzLmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9UZW1wbGF0ZVJlZ2lzdHJ5LnRzXCIgLz5cclxuXHJcbm1vZHVsZSBDb3JlLkNvbXBvbmVudHMge1xyXG5cdC8vIGZ1bmN0aW9uIHRlbXBsYXRlKCk6IHN0cmluZyB7XHJcblx0Ly8gXHRyZXR1cm4gQ29yZS5UZW1wbGF0ZVJlZ2lzdHJ5LmdldFRlbXBsYXRlKHRoaXMuY29tcG9uZW50Lm5hbWUpO1xyXG5cdC8vIH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdGlhbGl6ZShlbGVtZW50OiBIVE1MRWxlbWVudCwgZGF0YTogYW55KTogYW55IHtcclxuXHRcdHJldHVybiBkYXRhO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZShuYW1lOiBzdHJpbmcsIGNvbmZpZz86IGFueSk6IHJpdmV0cy5Db21wb25lbnQge1xyXG5cdFx0Y29uZmlnID0gY29uZmlnIHx8IHtcclxuXHRcdFx0bmFtZTogbnVsbCxcclxuXHRcdFx0c3RhdGljOiBudWxsLFxyXG5cdFx0XHR0ZW1wbGF0ZTogbnVsbCxcclxuXHRcdFx0aW5pdGlhbGl6ZTogbnVsbCxcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcml2ZXRzLmNvbXBvbmVudHNbbmFtZV0gPSB7XHJcblx0XHRcdG5hbWU6IG5hbWUsXHJcblx0XHRcdHN0YXRpYzogY29uZmlnLnN0YXRpYyB8fCBbXSxcclxuXHRcdFx0dGVtcGxhdGU6IGNvbmZpZy50ZW1wbGF0ZSB8fCBmdW5jdGlvbihlbCkge1xyXG5cdFx0XHRcdGVsID0gZWwgfHwgdGhpcy5lbDtcclxuXHJcblx0XHRcdFx0bGV0IGNoaWxkcmVuOiBOb2RlW10gPSBbXS5zbGljZS5jYWxsKGVsID8gZWwuY2hpbGRyZW4gOiBbXSk7XHJcblx0XHRcdFx0bGV0IHRlbXBsYXRlOiBhbnkgICAgPSBDb3JlLlRlbXBsYXRlUmVnaXN0cnkuZ2V0VGVtcGxhdGUobmFtZSk7XHJcblx0XHRcdFx0bGV0IGNvbnRlbnQ6IE5vZGUgICAgPSB0ZW1wbGF0ZS5jb250ZW50LnF1ZXJ5U2VsZWN0b3IoJ2NvbnRlbnQnKTtcclxuXHJcblx0XHRcdFx0aWYgKGNoaWxkcmVuICYmIGNvbnRlbnQpIHtcclxuXHRcdFx0XHRcdGZvciAobGV0IG5vZGUgb2YgY2hpbGRyZW4pIHtcclxuXHRcdFx0XHRcdFx0Y29udGVudC5wYXJlbnROb2RlLmluc2VydEJlZm9yZShub2RlLCBjb250ZW50KTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnRlbnQgJiYgY29udGVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGNvbnRlbnQpO1xyXG5cclxuXHRcdFx0XHRyZXR1cm4gdGVtcGxhdGUuaW5uZXJIVE1MO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRpbml0aWFsaXplOiBjb25maWcuaW5pdGlhbGl6ZSB8fCBpbml0aWFsaXplXHJcblx0XHR9XHJcblx0fVxyXG59XHJcbiIsIlxyXG5tb2R1bGUgQ29yZSB7XHJcblx0ZXhwb3J0IGludGVyZmFjZSBFbmhhbmNlZEhUTUxFbGVtZW50IGV4dGVuZHMgSFRNTEVsZW1lbnQge1xyXG5cdFx0X2RhdGE6IGFueTtcclxuXHR9XHJcblxyXG5cdGludGVyZmFjZSBJQ3VzdG9tRWxlbWVudCB7XHJcblx0XHRfYXR0cmlidXRlczogc3RyaW5nW107XHJcblx0fVxyXG5cclxuXHRleHBvcnQgY2xhc3MgQ3VzdG9tRWxlbWVudCB7XHJcblx0XHRwcm90ZWN0ZWQgX25vZGU6IEVuaGFuY2VkSFRNTEVsZW1lbnQ7XHJcblx0XHRzdGF0aWMgX2F0dHJpYnV0ZXM6IHN0cmluZ1tdID0gW107XHJcblxyXG5cdFx0Y29uc3RydWN0b3Iobm9kZSwgZGF0YSkge1xyXG5cdFx0XHRub2RlLl9kYXRhID0gbm9kZS5fZGF0YSB8fCB7fTtcclxuXHRcdFx0dGhpcy5fbm9kZSA9IG5vZGU7XHJcblxyXG5cdFx0XHRmb3IgKGxldCBrZXkgaW4gZGF0YSkge1xyXG5cdFx0XHRcdGlmIChub2RlLl9kYXRhW2tleV0gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRcdFx0bm9kZS5fZGF0YVtrZXldID0gZGF0YVtrZXldO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dGhpc1trZXldID0gdGhpcy5nZXREYXRhKGtleSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBzZWxmOiBJQ3VzdG9tRWxlbWVudCA9IDxhbnk+IHRoaXMuY29uc3RydWN0b3I7XHJcblx0XHRcdGZvciAobGV0IGF0dHIgb2Ygc2VsZi5fYXR0cmlidXRlcykge1xyXG5cdFx0XHRcdHRoaXMuX2xpbmtBdHRyKGF0dHIpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Z2V0RGF0YShrZXkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX25vZGUuX2RhdGFba2V5XTtcclxuXHRcdH1cclxuXHJcblx0XHRzZXREYXRhKGtleSwgdmFsKSB7XHJcblx0XHRcdGlmICh0aGlzLl9ub2RlLl9kYXRhW2tleV0gIT09IHZhbCkge1xyXG5cdFx0XHRcdHRoaXMuX25vZGUuX2RhdGFba2V5XSA9IHZhbDtcclxuXHRcdFx0XHR0aGlzLl9ub2RlLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KGtleSArICctY2hhbmdlJykpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X2xpbmtBdHRyKGtleSkge1xyXG5cdFx0XHR0aGlzW2tleV0gPSB0aGlzLmdldERhdGEoa2V5KTtcclxuXHJcblx0XHRcdHRoaXMuX25vZGUuYWRkRXZlbnRMaXN0ZW5lcihrZXkgKyAnLXVwZGF0ZScsIChlKSA9PiB7XHJcblx0XHRcdFx0dGhpc1trZXldID0gdGhpcy5nZXREYXRhKGtleSk7XHJcblx0XHRcdH0sIGZhbHNlKTtcclxuXHRcdH1cclxuXHR9XHJcbn0iLCJcclxuXHJcbm1vZHVsZSBDb3JlLkRlY29yYXRvcnMge1xyXG5cdGV4cG9ydCBmdW5jdGlvbiBDb21wdXRlZEZyb20oLi4ua2V5czogc3RyaW5nW10pOiBNZXRob2REZWNvcmF0b3Ige1xyXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIENvbXB1dGVkRnJvbSh0YXJnZXQ6IGFueSwga2V5OiBzdHJpbmcsIGRlc2NyaXB0b3I6IGFueSk6IHZvaWQge1xyXG5cdFx0XHR0YXJnZXQuX19kZXBlbmRlbmNpZXMgPSB0YXJnZXQuX19kZXBlbmRlbmNpZXMgfHwge307XHJcblx0XHRcdHRhcmdldC5fX2RlcGVuZGVuY2llc1trZXldID0ga2V5cztcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciBPYnNlcnZlID0gcml2ZXRzLl8uQmluZGluZy5wcm90b3R5cGUub2JzZXJ2ZTtcclxuXHRyaXZldHMuXy5CaW5kaW5nLnByb3RvdHlwZS5vYnNlcnZlID0gZnVuY3Rpb24ob2JqOiBhbnksIGtleXBhdGg6IGFueSwgY2FsbGJhY2s6IGFueSk6IGFueSB7XHJcblx0XHR2YXIgcGF0aCA9IGtleXBhdGguc3BsaXQoJy4nKTtcclxuXHRcdHZhciByb290LCBwcm9wO1xyXG5cclxuXHRcdGlmIChwYXRoLmxlbmd0aCA8IDIpIHtcclxuXHRcdFx0cm9vdCA9IG9iajtcclxuXHRcdFx0cHJvcCA9IHBhdGhbMF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyb290ID0gb2JqW3BhdGhbMF1dO1xyXG5cdFx0XHRwcm9wID0gcGF0aFsxXTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAocm9vdCAmJiByb290Ll9fZGVwZW5kZW5jaWVzKSB7XHJcblx0XHRcdHRoaXMub3B0aW9ucyA9IHRoaXMub3B0aW9ucyB8fCB7fTtcclxuXHRcdFx0dGhpcy5vcHRpb25zLmRlcGVuZGVuY2llcyA9IHRoaXMub3B0aW9ucy5kZXBlbmRlbmNpZXMgfHwgcm9vdC5fX2RlcGVuZGVuY2llc1twcm9wXTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBPYnNlcnZlLmNhbGwodGhpcywgb2JqLCBrZXlwYXRoLCBjYWxsYmFjayk7XHJcblx0fVxyXG59XHJcbiIsIlxyXG5tb2R1bGUgQ29yZSB7XHJcblx0ZXhwb3J0IGVudW0gUHJlc2V0VHlwZSB7XHJcblx0XHRQSE9ORSA9IDAsXHJcblx0XHRUQUJMRVQsXHJcblx0XHRMQVBUT1AsXHJcblx0XHRERVNLVE9QXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZW51bSBQcmVzZXRUYXJnZXQge1xyXG5cdFx0V0lORE9XID0gMCxcclxuXHRcdFZJRVdQT1JUXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZW51bSBQcmVzZXRQb3NpdGlvbiB7XHJcblx0XHRERUZBVUxUID0gMCxcclxuXHRcdENVU1RPTSxcclxuXHRcdENFTlRFUlxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGVudW0gUG9wdXBJY29uU3R5bGUge1xyXG5cdFx0TU9OT0NIUk9NRSA9IDAsXHJcblx0XHRDT0xPUkVELFxyXG5cdFx0Q09OVFJBU1RcclxuXHR9XHJcbn0iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9odG1sNS5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBDb3JlLlV0aWxzIHtcclxuXHRleHBvcnQgZnVuY3Rpb24gVVVJRCgpOiBzdHJpbmcge1xyXG5cdFx0bGV0IHV1aWQ6IHN0cmluZztcclxuXHRcdGxldCBieXRlcyA9IGNyeXB0by5nZXRSYW5kb21WYWx1ZXMobmV3IFVpbnQ4QXJyYXkoMjEpKTtcclxuXHRcdGxldCBoZXhlZCA9IHZhbCA9PiAodmFsICUgMTYpLnRvU3RyaW5nKDE2KTtcclxuXHJcblx0XHRieXRlc1sxMl0gPSA0O1xyXG5cdFx0Ynl0ZXNbMTZdID0gYnl0ZXNbMTZdICYgMHgzIHwgMHg4O1xyXG5cclxuXHRcdHV1aWQgPSBBcnJheS5mcm9tKGJ5dGVzLCBoZXhlZCkuam9pbignJyk7XHJcblx0XHR1dWlkID0gdXVpZCArIERhdGUubm93KCkudG9TdHJpbmcoMTYpO1xyXG5cdFx0dXVpZCA9IHV1aWQucmVwbGFjZSgvXiguezh9KSguezR9KSguezR9KSguezR9KS8sICckMS0kMi0kMy0kNC0nKTtcclxuXHJcblx0XHRyZXR1cm4gdXVpZC50b1VwcGVyQ2FzZSgpO1xyXG5cdH1cclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL0RlY29yYXRvcnMvQ29tcHV0ZWRGcm9tLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL1V0aWxzL0VudW1zLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL1V0aWxzL1VVSUQudHNcIiAvPlxuXG5tb2R1bGUgQ29yZSB7XG5cdGltcG9ydCBDb21wdXRlZEZyb20gPSBDb3JlLkRlY29yYXRvcnMuQ29tcHV0ZWRGcm9tO1xuXG5cdGV4cG9ydCBjbGFzcyBQcmVzZXQge1xuXHRcdGlkOiBzdHJpbmc7XG5cdFx0d2lkdGg6IG51bWJlcjtcblx0XHRoZWlnaHQ6IG51bWJlcjtcblx0XHR0b3A6IG51bWJlcjtcblx0XHRsZWZ0OiBudW1iZXI7XG5cdFx0ZGVzY3JpcHRpb246IHN0cmluZztcblx0XHRwb3NpdGlvbjogUHJlc2V0UG9zaXRpb247XG5cdFx0dHlwZTogUHJlc2V0VHlwZTtcblx0XHR0YXJnZXQ6IFByZXNldFRhcmdldDtcblxuXHRcdGNvbnN0cnVjdG9yKGRhdGE6IGFueSkge1xuXHRcdFx0dGhpcy5pZCA9IGRhdGEuaWQgfHwgQ29yZS5VdGlscy5VVUlEKCk7XG5cdFx0XHR0aGlzLndpZHRoID0gZGF0YS53aWR0aCB8fCBudWxsO1xuXHRcdFx0dGhpcy5oZWlnaHQgPSBkYXRhLmhlaWdodCB8fCBudWxsO1xuXHRcdFx0dGhpcy50b3AgPSBpc05hTihwYXJzZUludChkYXRhLnRvcCwgMTApKSA/IG51bGwgOiBkYXRhLnRvcDtcblx0XHRcdHRoaXMubGVmdCA9IGlzTmFOKHBhcnNlSW50KGRhdGEubGVmdCwgMTApKSA/IG51bGwgOiBkYXRhLmxlZnQ7XG5cdFx0XHR0aGlzLmRlc2NyaXB0aW9uID0gZGF0YS5kZXNjcmlwdGlvbiB8fCBudWxsO1xuXHRcdFx0dGhpcy5wb3NpdGlvbiA9IGRhdGEucG9zaXRpb24gfHwgUHJlc2V0UG9zaXRpb24uREVGQVVMVDtcblx0XHRcdHRoaXMudHlwZSA9IHBhcnNlSW50KGRhdGEudHlwZSwgMTApID09IGRhdGEudHlwZSA/IGRhdGEudHlwZSA6IFByZXNldFR5cGUuREVTS1RPUDtcblx0XHRcdHRoaXMudGFyZ2V0ID0gZGF0YS50YXJnZXQgfHwgUHJlc2V0VGFyZ2V0LldJTkRPVztcblx0XHR9XG5cblx0XHRAQ29tcHV0ZWRGcm9tKCd3aWR0aCcsICdoZWlnaHQnKVxuXHRcdHRpdGxlKCkge1xuXHRcdFx0bGV0IHRpdGxlOiBzdHJpbmcgPSB0aGlzLndpZHRoICsgJyAmdGltZXM7ICcgKyB0aGlzLmhlaWdodDtcblxuXHRcdFx0aWYgKCF0aGlzLndpZHRoKSB7XG5cdFx0XHRcdHRpdGxlID0gJzxlbT5IZWlnaHQ6PC9lbT4gJyArIHRoaXMuaGVpZ2h0O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuaGVpZ2h0KSB7XG5cdFx0XHRcdHRpdGxlID0gJzxlbT5XaWR0aDo8L2VtPiAnICsgdGhpcy53aWR0aDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRpdGxlO1xuXHRcdH1cblxuXHRcdEBDb21wdXRlZEZyb20oJ3R5cGUnKVxuXHRcdGljb24oKSB7XG5cdFx0XHRsZXQgaWNvbiA9ICcnO1xuXG5cdFx0XHRzd2l0Y2ggKHRoaXMudHlwZSkge1xuXHRcdFx0XHRjYXNlIFByZXNldFR5cGUuUEhPTkUgOlxuXHRcdFx0XHRcdGljb24gPSAnI2ljb24tcGhvbmUnO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIFByZXNldFR5cGUuVEFCTEVUIDpcblx0XHRcdFx0XHRpY29uID0gJyNpY29uLXRhYmxldCc7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2UgUHJlc2V0VHlwZS5MQVBUT1AgOlxuXHRcdFx0XHRcdGljb24gPSAnI2ljb24tbGFwdG9wJztcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRpY29uID0gJyNpY29uLWRlc2t0b3AnO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGljb247XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGludGVyZmFjZSBJUHJlc2V0IHtcblx0XHRpZD86IHN0cmluZztcblx0XHR3aWR0aD86IG51bWJlcjtcblx0XHRoZWlnaHQ/OiBudW1iZXI7XG5cdFx0ZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdFx0cG9zaXRpb24/OiBQcmVzZXRQb3NpdGlvbjtcblx0XHR0eXBlPzogUHJlc2V0VHlwZTtcblx0XHR0YXJnZXQ/OiBQcmVzZXRUYXJnZXQ7XG5cdH1cbn0iLCJtb2R1bGUgQ29yZS5VdGlscy5ET00ge1xyXG5cdGV4cG9ydCBmdW5jdGlvbiBxKHNlbGVjdG9yOiBzdHJpbmcgfCBIVE1MRWxlbWVudCwgY29udGV4dD86IEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XHJcblx0XHRpZiAodHlwZW9mIHNlbGVjdG9yICE9PSAnc3RyaW5nJykge1xyXG5cdFx0XHRyZXR1cm4gc2VsZWN0b3I7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIDxIVE1MRWxlbWVudD4gKGNvbnRleHQgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3IoPHN0cmluZz4gc2VsZWN0b3IpO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIHFBbGwoc2VsZWN0b3I6IHN0cmluZyB8IE5vZGVMaXN0IHwgSFRNTEVsZW1lbnRbXSwgY29udGV4dD86IEVsZW1lbnQpOiBIVE1MRWxlbWVudFtdIHtcclxuXHRcdGxldCByZXN1bHQgPSBzZWxlY3RvcjtcclxuXHJcblx0XHRpZiAodHlwZW9mIHNlbGVjdG9yID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHRyZXN1bHQgPSAoY29udGV4dCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbCg8c3RyaW5nPiBzZWxlY3Rvcik7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFtdLnNsaWNlLmNhbGwocmVzdWx0KTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBvbihldmVudDogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZyB8IE5vZGUsIGxpc3RlbmVyOiBGdW5jdGlvbiwgY2FwdHVyZT86IGJvb2xlYW4pIHtcclxuXHRcdGxldCBub2RlID0gcSg8SFRNTEVsZW1lbnQ+IHRhcmdldCk7XHJcblx0XHRjYXB0dXJlID0gISFjYXB0dXJlO1xyXG5cclxuXHRcdGlmIChub2RlKSB7XHJcblx0XHRcdG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgPEV2ZW50TGlzdGVuZXI+IGxpc3RlbmVyLCBjYXB0dXJlKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50OiBzdHJpbmcsIHRhcmdldDogc3RyaW5nIHwgTm9kZSwgY29uZmlnPzogYW55KSB7XHJcblx0XHRsZXQgbm9kZSA9IHEoPEhUTUxFbGVtZW50PiB0YXJnZXQpO1xyXG5cclxuXHRcdGlmIChub2RlKSB7XHJcblx0XHRcdG5vZGUuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoZXZlbnQsIGNvbmZpZykpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZShzZWxlY3Rvcjogc3RyaW5nIHwgSFRNTEVsZW1lbnQsIGNvbnRleHQ/OiBFbGVtZW50KTogSFRNTEVsZW1lbnQge1xyXG5cdFx0bGV0IG5vZGUgPSBxKDxIVE1MRWxlbWVudD4gc2VsZWN0b3IpO1xyXG5cclxuXHRcdG5vZGUgJiYgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xyXG5cclxuXHRcdHJldHVybiBub2RlO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIGFkZENsYXNzKHRhcmdldDogc3RyaW5nIHwgSFRNTEVsZW1lbnQsIGNsYXNzTmFtZTogc3RyaW5nKSB7XHJcblx0XHRsZXQgbm9kZSA9IHEodGFyZ2V0KTtcclxuXHJcblx0XHRpZiAobm9kZSkge1xyXG5cdFx0XHRub2RlLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiByZW1vdmVDbGFzcyh0YXJnZXQ6IHN0cmluZyB8IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZykge1xyXG5cdFx0bGV0IG5vZGUgPSBxKHRhcmdldCk7XHJcblxyXG5cdFx0aWYgKG5vZGUpIHtcclxuXHRcdFx0bm9kZS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gdG9nZ2xlQ2xhc3ModGFyZ2V0OiBzdHJpbmcgfCBIVE1MRWxlbWVudCwgY2xhc3NOYW1lOiBzdHJpbmcpIHtcclxuXHRcdGxldCBub2RlID0gcSh0YXJnZXQpO1xyXG5cclxuXHRcdGlmIChub2RlKSB7XHJcblx0XHRcdG5vZGUuY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBoYXNDbGFzcyhub2RlLCBjbGFzc05hbWUpO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIGhhc0NsYXNzKHRhcmdldDogc3RyaW5nIHwgSFRNTEVsZW1lbnQsIGNsYXNzTmFtZTogc3RyaW5nKSB7XHJcblx0XHRsZXQgbm9kZSA9IHEodGFyZ2V0KTtcclxuXHJcblx0XHRpZiAobm9kZSkge1xyXG5cdFx0XHRyZXR1cm4gbm9kZS5jbGFzc0xpc3QuY29udGFpbnMoY2xhc3NOYW1lKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBlbXB0eSh0YXJnZXQ6IHN0cmluZyB8IEhUTUxFbGVtZW50KSB7XHJcblx0XHRsZXQgbm9kZSA9IHEodGFyZ2V0KTtcclxuXHJcblx0XHR3aGlsZSAobm9kZS5maXJzdENoaWxkKSB7XHJcblx0XHRcdG5vZGUucmVtb3ZlQ2hpbGQobm9kZS5maXJzdENoaWxkKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBoaWRlKHRhcmdldDogc3RyaW5nIHwgSFRNTEVsZW1lbnQsIGNsYXNzTmFtZT86IHN0cmluZywgd2FpdEZvcj86IEhUTUxFbGVtZW50KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBfdG9nZ2xlQ2xhc3ModGFyZ2V0LCBmYWxzZSwgY2xhc3NOYW1lLCB3YWl0Rm9yKTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBzaG93KHRhcmdldDogc3RyaW5nIHwgSFRNTEVsZW1lbnQsIGNsYXNzTmFtZT86IHN0cmluZywgd2FpdEZvcj86IEhUTUxFbGVtZW50KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBfdG9nZ2xlQ2xhc3ModGFyZ2V0LCB0cnVlLCBjbGFzc05hbWUsIHdhaXRGb3IpO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIGFuaW1hdGUodGFyZ2V0OiBzdHJpbmcgfCBIVE1MRWxlbWVudCwgY2xhc3NOYW1lPzogc3RyaW5nLCBwcm9wZXJ0eU5hbWU/OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIF90b2dnbGVDbGFzcyh0YXJnZXQsIHRydWUsIGNsYXNzTmFtZSwgbnVsbCwgcHJvcGVydHlOYW1lKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9oYXNUcmFuc2l0aW9uKG5vZGU6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XHJcblx0XHRsZXQgZHVyYXRpb24gPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShub2RlKS50cmFuc2l0aW9uRHVyYXRpb24uc3BsaXQoJywnKTtcclxuXHJcblx0XHRmb3IgKGxldCBwYXJ0IG9mIGR1cmF0aW9uKSB7XHJcblx0XHRcdGlmIChwYXJzZUZsb2F0KHBhcnQpID4gMCkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gX3RvZ2dsZUNsYXNzKHRhcmdldDogc3RyaW5nIHwgSFRNTEVsZW1lbnQsIHN0YXRlOiBib29sZWFuLCBjbGFzc05hbWU6IHN0cmluZyA9ICd2aXNpYmxlJywgd2FpdEZvcj86IEhUTUxFbGVtZW50LCBwcm9wZXJ0eU5hbWU/OiBzdHJpbmcpOiBQcm9taXNlPEhUTUxFbGVtZW50PiB7XHJcblx0XHR2YXIgbm9kZSA9IHEodGFyZ2V0KTtcclxuXHRcdHZhciBhY3Rpb24gPSBzdGF0ZSA/ICdhZGQnIDogJ3JlbW92ZSc7XHJcblxyXG5cdFx0d2FpdEZvciA9IHdhaXRGb3IgfHwgbm9kZTtcclxuXHJcblx0XHRpZiAoIW5vZGUpIHtcclxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIV9oYXNUcmFuc2l0aW9uKHdhaXRGb3IpKSB7XHJcblx0XHRcdG5vZGUuY2xhc3NMaXN0W2FjdGlvbl0oY2xhc3NOYW1lKTtcclxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShub2RlKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHRmdW5jdGlvbiB0cmFuc2l0aW9uRW5kZWQoZXZ0KSB7XHJcblx0XHRcdFx0aWYgKCghcHJvcGVydHlOYW1lIHx8IHByb3BlcnR5TmFtZSA9PT0gZXZ0LnByb3BlcnR5TmFtZSkgJiYgd2FpdEZvciA9PT0gZXZ0LnRhcmdldCkge1xyXG5cdFx0XHRcdFx0d2FpdEZvci5yZW1vdmVFdmVudExpc3RlbmVyKCd0cmFuc2l0aW9uZW5kJywgdHJhbnNpdGlvbkVuZGVkKTtcclxuXHRcdFx0XHRcdHJlc29sdmUod2FpdEZvcik7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3YWl0Rm9yLmFkZEV2ZW50TGlzdGVuZXIoJ3RyYW5zaXRpb25lbmQnLCB0cmFuc2l0aW9uRW5kZWQpO1xyXG5cdFx0XHRub2RlLmNsYXNzTGlzdFthY3Rpb25dKGNsYXNzTmFtZSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBldmVudFBhdGgoZXZ0OiBFdmVudCk6IEhUTUxFbGVtZW50W10ge1xyXG5cdFx0bGV0IG5vZGU6Tm9kZSA9IDxOb2RlPiAoPE1vdXNlRXZlbnQ+IGV2dCkucmVsYXRlZFRhcmdldDtcclxuXHRcdGxldCBwYXRoOk5vZGVbXSA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChub2RlID0gbm9kZS5wYXJlbnROb2RlKSB7XHJcblx0XHRcdHBhdGgucHVzaChub2RlKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gPEhUTUxFbGVtZW50W10+IHBhdGg7XHJcblx0fVxyXG59IiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uL3R5cGluZ3MvdGFiLW5hdi5kLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL0NvcmUvVXRpbHMvRE9NLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBWaWV3cy5Db21tb24ge1xyXG5cdGltcG9ydCAkID0gQ29yZS5VdGlscy5ET01cclxuXHJcblx0Y29uc3QgS0VZX0VTQyA9IDI3XHJcblxyXG5cdGV4cG9ydCBjbGFzcyBNb2RhbE1lc3NhZ2Uge1xyXG5cdFx0cHVibGljIHZpc2libGU6IGJvb2xlYW4gPSBmYWxzZVxyXG5cdFx0cHJpdmF0ZSBfZGlzbWlzczogRXZlbnRMaXN0ZW5lclxyXG5cclxuXHRcdGNvbnN0cnVjdG9yKFxyXG5cdFx0XHRwdWJsaWMgdGl0bGU6IHN0cmluZyxcclxuXHRcdFx0cHVibGljIG1lc3NhZ2U6IHN0cmluZyxcclxuXHRcdFx0cHVibGljIGJsb2NraW5nOiBib29sZWFuID0gZmFsc2UsXHJcblx0XHRcdHB1YmxpYyBhY3Rpb25zOiBNb2RhbE1lc3NhZ2VBY3Rpb25bXSA9IFtdLFxyXG5cdFx0XHRwdWJsaWMgb3B0aW9uczogYW55ID0ge31cclxuXHRcdCkge1xyXG5cdFx0XHR0aGlzLnNob3coKVxyXG5cdFx0fVxyXG5cclxuXHRcdG9uQ2xvc2UgPSBuZXcgTW9kYWxFdmVudFJlZ2lzdHJ5KClcclxuXHJcblx0XHRzaG93KCk6IFByb21pc2U8YW55PiB7XHJcblx0XHRcdHJldHVybiAkLnNob3coZG9jdW1lbnQuYm9keSwgJ3dyX21vZGFsX3Zpc2libGUnKS50aGVuKF8gPT4ge1xyXG5cdFx0XHRcdGxldCBtb2RhbCA9ICQucSgnLldSX21vZGFsJylcclxuXHRcdFx0XHRsZXQgYWN0aW9uID0gJC5xKCcuV1JfbW9kYWxfYWN0aW9ucyAubWFpbicsIG1vZGFsKSB8fCAkLnEoJy5XUl9tb2RhbF9hY3Rpb25zIGJ1dHRvbjpsYXN0LWNoaWxkJywgbW9kYWwpXHJcblxyXG5cdFx0XHRcdGlmICh0aGlzLm9wdGlvbnMuY2xhc3MpIHtcclxuXHRcdFx0XHRcdCQuYWRkQ2xhc3MobW9kYWwsIHRoaXMub3B0aW9ucy5jbGFzcylcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGFjdGlvbiAmJiBhY3Rpb24uZm9jdXMoKVxyXG5cdFx0XHRcdHRoaXMudmlzaWJsZSA9IHRydWVcclxuXHRcdFx0XHRUYWJOYXYubGltaXRUbyhtb2RhbClcclxuXHJcblx0XHRcdFx0aWYgKCF0aGlzLmJsb2NraW5nKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9kaXNtaXNzID0gKGV2dDogS2V5Ym9hcmRFdmVudCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoZXZ0LmtleUNvZGUgPT09IEtFWV9FU0MpIHtcclxuXHRcdFx0XHRcdFx0XHRldnQucHJldmVudERlZmF1bHQoKVxyXG5cdFx0XHRcdFx0XHRcdGV2dC5zdG9wUHJvcGFnYXRpb24oKVxyXG5cclxuXHRcdFx0XHRcdFx0XHRmb3IgKGxldCBhY3Rpb24gb2YgdGhpcy5hY3Rpb25zKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRhY3Rpb24ub25EaXNtaXNzICYmIGFjdGlvbi5oYW5kbGVyKClcclxuXHRcdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRcdHRoaXMuaGlkZSgpXHJcblxyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLl9kaXNtaXNzKVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXHJcblx0XHRcdH0pXHJcblx0XHR9XHJcblxyXG5cdFx0aGlkZSgpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0XHRyZXR1cm4gJC5oaWRlKGRvY3VtZW50LmJvZHksICd3cl9tb2RhbF92aXNpYmxlJywgJC5xKCcuV1JfbW9kYWwnKSkudGhlbihfID0+IHtcclxuXHRcdFx0XHR0aGlzLnZpc2libGUgPSBmYWxzZVxyXG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5fZGlzbWlzcylcclxuXHRcdFx0XHRUYWJOYXYucmVzZXQoKVxyXG5cdFx0XHRcdHRoaXMub25DbG9zZS50cmlnZ2VyKClcclxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcclxuXHRcdFx0fSlcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGV4cG9ydCBpbnRlcmZhY2UgTW9kYWxFdmVudEhhbmRsZXIge1xyXG5cdFx0KGRhdGE/OiBhbnkpOiBhbnlcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBjbGFzcyBNb2RhbEV2ZW50UmVnaXN0cnkge1xyXG5cdFx0cHJpdmF0ZSBfaGFuZGxlcnM6IE1vZGFsRXZlbnRIYW5kbGVyW10gPSBbXVxyXG5cclxuXHRcdGNvbnN0cnVjdG9yKCkge31cclxuXHJcblx0XHRhZGRMaXN0ZW5lcihoYW5kbGVyOiBNb2RhbEV2ZW50SGFuZGxlcik6IGJvb2xlYW4ge1xyXG5cdFx0XHRsZXQgaGFuZGxlcnMgPSB0aGlzLl9oYW5kbGVyc1xyXG5cdFx0XHRsZXQgZXhpc3RpbmcgPSBoYW5kbGVycy5pbmRleE9mKGhhbmRsZXIpXHJcblxyXG5cdFx0XHRpZiAoZXhpc3RpbmcgPiAtMSkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRoYW5kbGVycy5wdXNoKGhhbmRsZXIpXHJcblxyXG5cdFx0XHRyZXR1cm4gdHJ1ZVxyXG5cdFx0fVxyXG5cclxuXHRcdHJlbW92ZUxpc3RlbmVyKGhhbmRsZXI6IE1vZGFsRXZlbnRIYW5kbGVyKTogYm9vbGVhbiB7XHJcblx0XHRcdGxldCBoYW5kbGVycyA9IHRoaXMuX2hhbmRsZXJzXHJcblx0XHRcdGxldCBleGlzdGluZyA9IGhhbmRsZXJzLmluZGV4T2YoaGFuZGxlcilcclxuXHJcblx0XHRcdGlmIChleGlzdGluZyA9PT0gLTEpIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2VcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aGFuZGxlcnMuc3BsaWNlKGV4aXN0aW5nLCAxKVxyXG5cclxuXHRcdFx0cmV0dXJuIHRydWVcclxuXHRcdH1cclxuXHJcblx0XHRyZW1vdmVBbGxMaXN0ZW5lcnMoKSB7XHJcblx0XHRcdHRoaXMuX2hhbmRsZXJzID0gW11cclxuXHRcdH1cclxuXHJcblx0XHRhc3luYyB0cmlnZ2VyKGNvbnRleHQ/OiBhbnksIGRhdGE/OiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcclxuXHRcdFx0Zm9yIChsZXQgaGFuZGxlciBvZiB0aGlzLl9oYW5kbGVycykge1xyXG5cdFx0XHRcdGF3YWl0IGhhbmRsZXIuY2FsbChjb250ZXh0LCBkYXRhKVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRleHBvcnQgaW50ZXJmYWNlIE1vZGFsTWVzc2FnZUFjdGlvbiB7XHJcblx0XHR0aXRsZTogc3RyaW5nXHJcblx0XHRpY29uPzogc3RyaW5nXHJcblx0XHRoYW5kbGVyOiBGdW5jdGlvblxyXG5cdFx0bWFpbj86IGJvb2xlYW5cclxuXHRcdG9uRGlzbWlzcz86IGJvb2xlYW5cclxuXHR9XHJcbn1cclxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL0NvcmUvQ3VzdG9tRWxlbWVudC50c1wiIC8+XHJcblxyXG5tb2R1bGUgVmlld3MuQ29tbW9uIHtcclxuXHRleHBvcnQgY2xhc3MgSWNvbiBleHRlbmRzIENvcmUuQ3VzdG9tRWxlbWVudCB7XHJcblx0XHRzdGF0aWMgX2F0dHJpYnV0ZXMgPSBbXTtcclxuXHJcblx0XHRjb25zdHJ1Y3Rvcihub2RlLCBkYXRhKSB7XHJcblx0XHRcdHN1cGVyKG5vZGUsIGRhdGEpO1xyXG5cdFx0XHR0aGlzLnNyYyA9IGRhdGEuc3JjO1xyXG5cdFx0fVxyXG5cclxuXHRcdGdldCBzcmMoKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLmdldERhdGEoJ3NyYycpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNldCBzcmModmFsKSB7XHJcblx0XHRcdHRoaXMuc2V0RGF0YSgnc3JjJywgdmFsKTtcclxuXHRcdFx0dGhpcy5fc2V0U3JjKHZhbCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cHJpdmF0ZSBfc2V0U3JjKHZhbCkge1xyXG5cdFx0XHR2YXIgc3ZnLCB1c2U7XHJcblxyXG5cdFx0XHRzdmcgPSB0aGlzLl9ub2RlLnF1ZXJ5U2VsZWN0b3IoJ3N2ZycpO1xyXG5cclxuXHRcdFx0aWYgKHZhbCAmJiB2YWxbMF0gPT0gJyMnKSB7XHJcblx0XHRcdFx0dmFsID0gJy4uL2Fzc2V0cy9pY29ucy9zcHJpdGUuc3ZnJyArIHZhbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0d2hpbGUgKHN2Zy5maXJzdENoaWxkKSB7XHJcblx0XHRcdFx0c3ZnLnJlbW92ZUNoaWxkKHN2Zy5maXJzdENoaWxkKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHZhbCkge1xyXG5cdFx0XHRcdHVzZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCAndXNlJyk7XHJcblx0XHRcdFx0dXNlLnNldEF0dHJpYnV0ZU5TKCdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJywgJ2hyZWYnLCB2YWwpO1xyXG5cdFx0XHRcdHN2Zy5hcHBlbmRDaGlsZCh1c2UpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRDb3JlLkNvbXBvbmVudHMuY3JlYXRlKCd3ci1pY29uJywge1xyXG5cdFx0c3RhdGljOiBbJ2NsYXNzJywgJ3NyYyddLFxyXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oZWwsIGRhdGEpIHtcclxuXHRcdFx0ZGF0YS5zcmMgPSBkYXRhLnNyYyB8fCBlbC5nZXRBdHRyaWJ1dGUoJ3NyYycpO1xyXG5cdFx0XHRyZXR1cm4gbmV3IEljb24oZWwsIGRhdGEpO1xyXG5cdFx0fVxyXG5cdH0pXHJcbn0iLCJcclxubW9kdWxlIENvcmUuSW5wdXQge1xyXG5cdGV4cG9ydCBjb25zdCBLZXlzID0ge1xyXG5cdFx0QkFDS1NQQUNFIDogOCxcclxuXHRcdFRBQiAgICAgICA6IDksXHJcblx0XHRFTlRFUiAgICAgOiAxMyxcclxuXHRcdFNISUZUICAgICA6IDE2LFxyXG5cdFx0QUxUICAgICAgIDogMTgsXHJcblx0XHRFU0NBUEUgICAgOiAyNyxcclxuXHRcdFNQQUNFICAgICA6IDMyLFxyXG5cdFx0RU5EICAgICAgIDogMzUsXHJcblx0XHRIT01FICAgICAgOiAzNixcclxuXHRcdExFRlQgICAgICA6IDM3LFxyXG5cdFx0VVAgICAgICAgIDogMzgsXHJcblx0XHRSSUdIVCAgICAgOiAzOSxcclxuXHRcdERPV04gICAgICA6IDQwLFxyXG5cdFx0REVMRVRFICAgIDogNDYsXHJcblx0XHRBUlJPV1MgICAgOiBbMzcsIDQwXSxcclxuXHRcdERJR0lUUyAgICA6IFs0OCwgNTddLFxyXG5cdFx0TlVNUEFEICAgIDogWzk2LCAxMDVdLFxyXG5cdFx0RlVOQyAgICAgIDogWzExMiwgMTIzXVxyXG5cdH1cclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi9Db3JlL0N1c3RvbUVsZW1lbnQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vQ29yZS9Db21wb25lbnRzLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL0NvcmUvSW5wdXQvS2V5cy50c1wiIC8+XHJcblxyXG5tb2R1bGUgVmlld3MuQ29tbW9uIHtcclxuXHRpbXBvcnQgS2V5cyA9IENvcmUuSW5wdXQuS2V5cztcclxuXHJcblx0ZXhwb3J0IGNsYXNzIE51bWVyaWNJbnB1dCBleHRlbmRzIENvcmUuQ3VzdG9tRWxlbWVudCB7XHJcblx0XHRzdGF0aWMgX2F0dHJpYnV0ZXMgPSBbJ3ZhbCddO1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5vZGUsIGRhdGEpIHtcclxuXHRcdFx0c3VwZXIobm9kZSwgZGF0YSk7XHJcblxyXG5cdFx0XHRub2RlLm9ua2V5ZG93biA9IGZpbHRlcktleXM7XHJcblx0XHR9XHJcblxyXG5cdFx0Z2V0IHZhbCgpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0RGF0YSgndmFsJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0c2V0IHZhbCh2YWwpIHtcclxuXHRcdFx0dGhpcy5zZXREYXRhKCd2YWwnLCB2YWwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZmlsdGVyS2V5cyhlKSB7XHJcblx0XHR2YXIga2V5ID0gZS5rZXlDb2RlO1xyXG5cclxuXHRcdHN3aXRjaCAodHJ1ZSkge1xyXG5cdFx0XHRjYXNlICFlLnNoaWZ0S2V5ICYmIChrZXkgPj0gS2V5cy5ESUdJVFNbMF0gJiYga2V5IDw9IEtleXMuRElHSVRTWzFdKTpcclxuXHRcdFx0Y2FzZSAoa2V5ID49IEtleXMuTlVNUEFEWzBdICYmIGtleSA8PSBLZXlzLk5VTVBBRFsxXSk6XHJcblx0XHRcdGNhc2UgKGtleSA+PSBLZXlzLkZVTkNbMF0gJiYga2V5IDw9IEtleXMuRlVOQ1sxXSk6XHJcblx0XHRcdGNhc2Uga2V5ID09IEtleXMuTEVGVDpcclxuXHRcdFx0Y2FzZSBrZXkgPT0gS2V5cy5SSUdIVDpcclxuXHRcdFx0Y2FzZSBrZXkgPT0gS2V5cy5UQUI6XHJcblx0XHRcdGNhc2Uga2V5ID09IEtleXMuQkFDS1NQQUNFOlxyXG5cdFx0XHRjYXNlIGtleSA9PSBLZXlzLkRFTEVURTpcclxuXHRcdFx0Y2FzZSBrZXkgPT0gS2V5cy5FTlRFUjpcclxuXHRcdFx0Y2FzZSBrZXkgPT0gS2V5cy5IT01FOlxyXG5cdFx0XHRjYXNlIGtleSA9PSBLZXlzLkVORDpcclxuXHRcdFx0Y2FzZSBrZXkgPT0gS2V5cy5FU0NBUEU6XHJcblx0XHRcdGNhc2UgZS5jdHJsS2V5IHx8IGUubWV0YUtleTpcclxuXHRcdFx0XHQvLyBhbGxvd2VkXHJcblx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRyZXR1cm4gX2NhbmNlbChlKTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBfY2FuY2VsKGUpIHtcclxuXHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdENvcmUuQ29tcG9uZW50cy5jcmVhdGUoJ3dyLW51bWVyaWMtaW5wdXQnLCB7XHJcblx0XHRzdGF0aWM6IFsnbWF4bGVuZ3RoJywgJ3BsYWNlaG9sZGVyJywgJ3ZhbCddLFxyXG5cdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oZWwsIGRhdGEpIHtcclxuXHRcdFx0cmV0dXJuIG5ldyBOdW1lcmljSW5wdXQoZWwsIGRhdGEpO1xyXG5cdFx0fVxyXG5cdH0pXHJcbn0iLCJcclxubW9kdWxlIFZpZXdzLkNvbW1vbiB7XHJcblx0Q29yZS5Db21wb25lbnRzLmNyZWF0ZSgnd3ItcHJlc2V0Jywge1xyXG5cdFx0c3RhdGljOiBbXSxcclxuXHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uKGVsLCBkYXRhKSB7XHJcblx0XHRcdGlmICghKGRhdGEucHJlc2V0IGluc3RhbmNlb2YgQ29yZS5QcmVzZXQpKSB7XHJcblx0XHRcdFx0ZGF0YS5wcmVzZXQgPSBuZXcgQ29yZS5QcmVzZXQoZGF0YS5wcmVzZXQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gZGF0YTtcclxuXHRcdH1cclxuXHR9KVxyXG59IiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL0NvcmUvQ3VzdG9tRWxlbWVudC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi9Db3JlL0NvbXBvbmVudHMudHNcIiAvPlxyXG5cclxubW9kdWxlIFZpZXdzLkNvbW1vbiB7XHJcblx0ZXhwb3J0IGNsYXNzIFN0YXR1c1RvZ2dsZSBleHRlbmRzIENvcmUuQ3VzdG9tRWxlbWVudCB7XHJcblx0XHRzdGF0aWMgX2F0dHJpYnV0ZXMgPSBbJ2lzY2hlY2tlZCddO1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKG5vZGUsIGRhdGEpIHtcclxuXHRcdFx0c3VwZXIobm9kZSwgZGF0YSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Z2V0IGlzY2hlY2tlZCgpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0RGF0YSgnaXNjaGVja2VkJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0c2V0IGlzY2hlY2tlZCh2YWwpIHtcclxuXHRcdFx0dGhpcy5zZXREYXRhKCdpc2NoZWNrZWQnLCB2YWwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Q29yZS5Db21wb25lbnRzLmNyZWF0ZSgnd3Itc3RhdHVzLXRvZ2dsZScsIHtcclxuXHRcdHN0YXRpYzogWydvbicsICdvZmYnLCAnaXNjaGVja2VkJ10sXHJcblx0XHRpbml0aWFsaXplOiBmdW5jdGlvbihlbCwgZGF0YSkge1xyXG5cdFx0XHRyZXR1cm4gbmV3IFN0YXR1c1RvZ2dsZShlbCwgZGF0YSk7XHJcblx0XHR9XHJcblx0fSlcclxufSIsIlxyXG5cclxubW9kdWxlIENvcmUuQmluZGVycyB7XHJcblx0ZXhwb3J0IGNsYXNzIEJhc2VCaW5kaW5nIHtcclxuXHRcdG1vZGVsOiBhbnk7XHJcblx0XHRhcmdzOiBzdHJpbmdbXTtcclxuXHJcblx0XHRwdWJsaXNoKCkge1xyXG5cclxuXHRcdH1cclxuXHJcblx0XHRmb3JtYXR0ZWRWYWx1ZSh2YWw6IGFueSk6IGFueSB7XHJcblxyXG5cdFx0fVxyXG5cdH1cclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi90eXBpbmdzL3JpdmV0cy5kLnRzXCIgLz5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vQmFzZUJpbmRpbmcudHNcIiAvPlxyXG5cclxubW9kdWxlIENvcmUuQmluZGVycyB7XHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEF0dHJpYnV0ZUJpbmRpbmcoZWw6IEhUTUxFbGVtZW50LCB2YWx1ZTogYW55KSB7XHJcblx0XHRsZXQgYmluZGluZ3MgPSB0aGlzLnZpZXcuYmluZGluZ3M7XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGwgPSBiaW5kaW5ncy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdFx0aWYgKGVsID09PSBiaW5kaW5nc1tpXS5lbCAmJiBiaW5kaW5nc1tpXS5jb21wb25lbnRWaWV3KSB7XHJcblx0XHRcdFx0bGV0IHZpZXcgPSBiaW5kaW5nc1tpXS5jb21wb25lbnRWaWV3O1xyXG5cdFx0XHRcdHZpZXcubW9kZWxzID0gdmlldy5tb2RlbHMgfHwgW107XHJcblx0XHRcdFx0dmlldy5tb2RlbHNbdGhpcy50eXBlXSA9IHZhbHVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHZhbHVlKSB7XHJcblx0XHRcdGVsLnNldEF0dHJpYnV0ZSh0aGlzLnR5cGUsIHZhbHVlKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGVsLnJlbW92ZUF0dHJpYnV0ZSh0aGlzLnR5cGUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cml2ZXRzLmJpbmRlcnNbJyonXSA9IEF0dHJpYnV0ZUJpbmRpbmc7XHJcbn0iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9yaXZldHMuZC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL0Jhc2VCaW5kaW5nLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBDb3JlLkJpbmRlcnMge1xyXG5cdGV4cG9ydCBjbGFzcyBEZWVwQmluZGluZyBleHRlbmRzIEJhc2VCaW5kaW5nIHtcclxuXHRcdHB1Ymxpc2hlczogYm9vbGVhbiA9IHRydWU7XHJcblx0XHRwcmlvcml0eTogbnVtYmVyID0gMzAwMDtcclxuXHJcblx0XHRiaW5kKGVsKSB7XHJcblx0XHRcdHRoaXMubW9kZWwgJiYgZWwuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLmFyZ3NbMF0gKyAnLWNoYW5nZScsIHRoaXMucHVibGlzaCwgZmFsc2UpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHVuYmluZChlbCkge1xyXG5cdFx0XHRlbC5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMuYXJnc1swXSArICctY2hhbmdlJywgdGhpcy5wdWJsaXNoLCBmYWxzZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cm91dGluZShlbCwgdmFsdWUpIHtcclxuXHRcdFx0aWYgKCF0aGlzLm1vZGVsKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRlbC5fZGF0YSA9IGVsLl9kYXRhIHx8IHt9O1xyXG5cdFx0XHRlbC5fZGF0YVt0aGlzLmFyZ3NbMF1dID0gdGhpcy5mb3JtYXR0ZWRWYWx1ZSh2YWx1ZSk7XHJcblxyXG5cdFx0XHRlbC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCh0aGlzLmFyZ3NbMF0gKyAnLXVwZGF0ZScpKTtcclxuXHRcdH1cclxuXHJcblx0XHRnZXRWYWx1ZShlbCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5mb3JtYXR0ZWRWYWx1ZShlbC5fZGF0YSA/IGVsLl9kYXRhW3RoaXMuYXJnc1swXV0gOiBudWxsKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJpdmV0cy5iaW5kZXJzWydkZWVwLSonXSA9IG5ldyBEZWVwQmluZGluZygpO1xyXG59IiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uL3R5cGluZ3Mvcml2ZXRzLmQudHNcIiAvPlxyXG5cclxubW9kdWxlIENvcmUuRm9ybWF0dGVycyB7XHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEZyaWVuZGx5Q21kU2hvcnRjdXQodmFsdWU6IGFueSk6IHN0cmluZyB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKHZhbHVlKS5yZXBsYWNlKC9cXCsvZywgJyArICcpLnJlcGxhY2UoJ0NvbW1hbmQnLCAnQ21kJykucmVwbGFjZSgnIEFycm93JywgJycpIHx8ICc8bm90IHNldD4nXHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gRnJpZW5kbHlDbWREZXNjcmlwdGlvbihjbWQ6IGFueSk6IHN0cmluZyB7XHJcblx0XHRpZiAoY21kLm5hbWUgPT09ICdfZXhlY3V0ZV9hY3Rpb24nKSB7XHJcblx0XHRcdHJldHVybiAnU2hvdyBleHRlbnNpb24gcG9wdXAnXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGNtZC5kZXNjcmlwdGlvbiB8fCBjbWQuc2hvcnRjdXRcclxuXHR9XHJcblxyXG5cdHJpdmV0cy5mb3JtYXR0ZXJzWydGcmllbmRseUNtZFNob3J0Y3V0J10gPSBGcmllbmRseUNtZFNob3J0Y3V0XHJcblx0cml2ZXRzLmZvcm1hdHRlcnNbJ0ZyaWVuZGx5Q21kRGVzY3JpcHRpb24nXSA9IEZyaWVuZGx5Q21kRGVzY3JpcHRpb25cclxufVxyXG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9yaXZldHMuZC50c1wiIC8+XG5cbm1vZHVsZSBDb3JlLkZvcm1hdHRlcnMge1xuXHRleHBvcnQgZnVuY3Rpb24gRnJpZW5kbHlEYXRlKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHZhciBkID0gbmV3IERhdGUoYCR7dmFsdWV9ICswMDowMGApO1xuXHRcdHJldHVybiBkLnRvTG9jYWxlU3RyaW5nKCk7XG5cdH1cblxuXHRyaXZldHMuZm9ybWF0dGVyc1snRnJpZW5kbHlEYXRlJ10gPSBGcmllbmRseURhdGU7XG59IiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uLy4uL3R5cGluZ3Mvcml2ZXRzLmQudHNcIiAvPlxyXG5cclxubW9kdWxlIENvcmUuRm9ybWF0dGVycyB7XHJcblx0ZXhwb3J0IGNvbnN0IEludEFuZE51bGwgPSB7XHJcblx0XHRyZWFkOiBmdW5jdGlvbih2YWx1ZSkge1xyXG5cdFx0XHRsZXQgdmFsID0gcGFyc2VJbnQodmFsdWUsIDEwKTtcclxuXHRcdFx0cmV0dXJuIGlzTmFOKHZhbCkgPyBudWxsIDogdmFsO1xyXG5cdFx0fSxcclxuXHJcblx0XHRwdWJsaXNoOiBmdW5jdGlvbih2YWx1ZSkge1xyXG5cdFx0XHRsZXQgdmFsID0gcGFyc2VJbnQodmFsdWUsIDEwKTtcclxuXHRcdFx0cmV0dXJuIGlzTmFOKHZhbCkgPyBudWxsIDogdmFsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cml2ZXRzLmZvcm1hdHRlcnNbJ0ludEFuZE51bGwnXSA9IEludEFuZE51bGw7XHJcbn0iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9yaXZldHMuZC50c1wiIC8+XHJcblxyXG5tb2R1bGUgQ29yZS5Gb3JtYXR0ZXJzIHtcclxuXHRleHBvcnQgY29uc3QgSW50T3JOdWxsID0ge1xyXG5cdFx0cmVhZDogZnVuY3Rpb24odmFsdWUpIHtcclxuXHRcdFx0cmV0dXJuIHBhcnNlSW50KHZhbHVlLCAxMCkgfHwgbnVsbDtcclxuXHRcdH0sXHJcblxyXG5cdFx0cHVibGlzaDogZnVuY3Rpb24odmFsdWUpIHtcclxuXHRcdFx0cmV0dXJuIHBhcnNlSW50KHZhbHVlLCAxMCkgfHwgbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJpdmV0cy5mb3JtYXR0ZXJzWydJbnRPck51bGwnXSA9IEludE9yTnVsbDtcclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi90eXBpbmdzL3JpdmV0cy5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBDb3JlLkZvcm1hdHRlcnMge1xyXG5cdGV4cG9ydCBmdW5jdGlvbiBOZWdhdGUodmFsdWU6IGFueSk6IGJvb2xlYW4ge1xyXG5cdFx0cmV0dXJuICF2YWx1ZTtcclxuXHR9XHJcblxyXG5cdHJpdmV0cy5mb3JtYXR0ZXJzWydOZWdhdGUnXSA9IE5lZ2F0ZTtcclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi90eXBpbmdzL3JpdmV0cy5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBDb3JlLkZvcm1hdHRlcnMge1xyXG5cdGV4cG9ydCBjb25zdCBOdWxsaWZ5ID0ge1xyXG5cdFx0cmVhZDogZnVuY3Rpb24odmFsdWUpIHtcclxuXHRcdFx0cmV0dXJuIHZhbHVlIHx8IG51bGw7XHJcblx0XHR9LFxyXG5cclxuXHRcdHB1Ymxpc2g6IGZ1bmN0aW9uKHZhbHVlKSB7XHJcblx0XHRcdHJldHVybiB2YWx1ZSB8fCBudWxsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cml2ZXRzLmZvcm1hdHRlcnNbJ051bGxpZnknXSA9IE51bGxpZnk7XHJcbn0iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9yaXZldHMuZC50c1wiIC8+XHJcblxyXG5tb2R1bGUgQ29yZS5Gb3JtYXR0ZXJzIHtcclxuXHRleHBvcnQgZnVuY3Rpb24gU3RyaW5naWZ5KHZhbHVlOiBhbnkpOiBzdHJpbmcge1xyXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcclxuXHR9XHJcblxyXG5cdHJpdmV0cy5mb3JtYXR0ZXJzWydTdHJpbmdpZnknXSA9IFN0cmluZ2lmeTtcclxufSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi8uLi90eXBpbmdzL3JpdmV0cy5kLnRzXCIgLz5cclxuXHJcbm1vZHVsZSBDb3JlLkZvcm1hdHRlcnMge1xyXG5cdGV4cG9ydCBmdW5jdGlvbiBUb0Jvb2wodmFsdWU6IGFueSk6IGJvb2xlYW4ge1xyXG5cdFx0cmV0dXJuICEhdmFsdWU7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gQXJyYXlOb3RFbXB0eSh2YWx1ZTogYW55KTogYm9vbGVhbiB7XHJcblx0XHRyZXR1cm4gdmFsdWUgJiYgdmFsdWUubGVuZ3RoO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGNvbnN0IEludFRvQm9vbCA9IHtcclxuXHRcdHJlYWQ6IGZ1bmN0aW9uKHZhbHVlKSB7XHJcblx0XHRcdHJldHVybiAhIXZhbHVlO1xyXG5cdFx0fSxcclxuXHJcblx0XHRwdWJsaXNoOiBmdW5jdGlvbih2YWx1ZSkge1xyXG5cdFx0XHRyZXR1cm4gdmFsdWUgPyAxIDogMDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJpdmV0cy5mb3JtYXR0ZXJzWydUb0Jvb2wnXSA9IFRvQm9vbDtcclxuXHRyaXZldHMuZm9ybWF0dGVyc1snSW50VG9Cb29sJ10gPSBJbnRUb0Jvb2w7XHJcblx0cml2ZXRzLmZvcm1hdHRlcnNbJ0FycmF5Tm90RW1wdHknXSA9IEFycmF5Tm90RW1wdHk7XHJcbn0iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vLi4vdHlwaW5ncy9yaXZldHMuZC50c1wiIC8+XHJcblxyXG5tb2R1bGUgQ29yZS5Gb3JtYXR0ZXJzIHtcclxuXHRleHBvcnQgY29uc3QgVG9JbnQgPSB7XHJcblx0XHRyZWFkOiBmdW5jdGlvbih2YWx1ZSkge1xyXG5cdFx0XHRyZXR1cm4gcGFyc2VJbnQodmFsdWUsIDEwKSB8fCAwO1xyXG5cdFx0fSxcclxuXHJcblx0XHRwdWJsaXNoOiBmdW5jdGlvbih2YWx1ZSkge1xyXG5cdFx0XHRyZXR1cm4gcGFyc2VJbnQodmFsdWUsIDEwKSB8fCAwO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cml2ZXRzLmZvcm1hdHRlcnNbJ1RvSW50J10gPSBUb0ludDtcclxufSIsIlxyXG5tb2R1bGUgQ29yZS5VdGlscy5SZXF1ZXN0IHtcclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEdldCh1cmw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcblxyXG5cdFx0XHR4aHIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHJlc29sdmUpO1xyXG5cdFx0XHR4aHIuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCByZWplY3QpO1xyXG5cdFx0XHR4aHIuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCByZWplY3QpO1xyXG5cdFx0XHR4aHIub3BlbignR0VUJywgdXJsKTtcclxuXHRcdFx0eGhyLnNlbmQoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIEdldEpTT04odXJsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0cmV0dXJuIEdldCh1cmwpLnRoZW4oZGF0YSA9PiBQcm9taXNlLnJlc29sdmUoSlNPTi5wYXJzZShkYXRhLnRhcmdldC5yZXNwb25zZVRleHQpKSk7XHJcblx0fVxyXG5cclxuXHRleHBvcnQgZnVuY3Rpb24gUG9zdCh1cmw6IHN0cmluZywgZGF0YTogYW55KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBfcG9zdCh1cmwsIGRhdGEpLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UudGV4dCgpKTtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBQb3N0SlNPTih1cmw6IHN0cmluZywgZGF0YTogYW55KTogUHJvbWlzZTxhbnk+IHtcclxuXHRcdHJldHVybiBfcG9zdCh1cmwsIGRhdGEpLnRoZW4ocmVzcG9uc2UgPT4gcmVzcG9uc2UuanNvbigpKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIF9wb3N0KHVybDogc3RyaW5nLCBkYXRhOiBhbnkpOiBQcm9taXNlPGFueT4ge1xyXG5cdFx0bGV0IHBhcnRzID0gW107XHJcblx0XHRmb3IgKGxldCBrIGluIGRhdGEpIHtcclxuXHRcdFx0bGV0IG5hbWUgPSBlbmNvZGVVUklDb21wb25lbnQoayk7XHJcblx0XHRcdGxldCB2YWx1ZSA9IGVuY29kZVVSSUNvbXBvbmVudChkYXRhW2tdKTtcclxuXHRcdFx0cGFydHMucHVzaChgJHtuYW1lfT0ke3ZhbHVlfWApO1xyXG5cdFx0fVxyXG5cdFx0Y29uc3QgaW5pdCA9IHtcclxuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXHJcblx0XHRcdGJvZHk6IHBhcnRzLmpvaW4oJyYnKSxcclxuXHRcdFx0aGVhZGVyczoge1wiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCJ9XHJcblx0XHR9O1xyXG5cclxuXHRcdHJldHVybiBmZXRjaCh1cmwsIGluaXQpO1xyXG5cdH1cclxufSIsIm1vZHVsZSBDb3JlLlV0aWxzIHtcclxuXHRleHBvcnQgY2xhc3MgVW5pcXVlU3RhY2sge1xyXG5cdFx0cHJpdmF0ZSBfdmFsdWVzID0gW107XHJcblxyXG5cdFx0cHVibGljIGFwcGVuZCh2YWx1ZSkge1xyXG5cdFx0XHR0aGlzLnJlbW92ZSh2YWx1ZSk7XHJcblx0XHRcdHRoaXMuX3ZhbHVlcy5wdXNoKHZhbHVlKTtcclxuXHRcdH1cclxuXHJcblx0XHRwdWJsaWMgcmVtb3ZlKHZhbHVlKSB7XHJcblx0XHRcdGxldCBleGlzdGluZyA9IHRoaXMuX3ZhbHVlcy5pbmRleE9mKHZhbHVlKTtcclxuXHRcdFx0KGV4aXN0aW5nID4gLTEpICYmIHRoaXMuX3ZhbHVlcy5zcGxpY2UoZXhpc3RpbmcsIDEpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHB1YmxpYyBjdXJyZW50KCkge1xyXG5cdFx0XHRsZXQgbGFzdCA9IHRoaXMuX3ZhbHVlcy5sZW5ndGggLSAxO1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fdmFsdWVzW2xhc3RdO1xyXG5cdFx0fVxyXG5cdH1cclxufSIsIm1vZHVsZSBDb3JlLlV0aWxzIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIElzQmV0YSgpOiBib29sZWFuIHtcblx0XHRjb25zdCBtYW5pZmVzdDogYW55ID0gY2hyb21lLnJ1bnRpbWUuZ2V0TWFuaWZlc3QoKTtcblx0XHRjb25zdCBpc0JldGE6IGJvb2xlYW4gPSBCb29sZWFuKG1hbmlmZXN0LnZlcnNpb25fbmFtZS5tYXRjaCgvYmV0YS9pKSk7XG5cblx0XHRyZXR1cm4gaXNCZXRhO1xuXHR9XG59IiwibW9kdWxlIENvcmUuVXRpbHMge1xyXG5cdGV4cG9ydCBpbnRlcmZhY2UgSURpY3Q8VD4ge1xyXG5cdFx0W2luZGV4OiBzdHJpbmddOiBUO1xyXG5cdH1cclxufSJdfQ==
