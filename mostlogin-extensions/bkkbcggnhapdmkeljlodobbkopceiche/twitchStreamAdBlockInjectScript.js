/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 348);
/******/ })
/************************************************************************/
/******/ ({

/***/ 348:
/***/ (function(module, exports) {

var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
const ourTwitchAdSolutionsVersion = 20;
console.log("loading twitch ad blocking script");
window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;
function declareOptions(scope) {
  scope.AdSignifier = "stitched";
  scope.ClientID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
  scope.BackupPlayerTypes = [
    "embed",
    //Source
    "popout",
    //Source
    "autoplay"
    //360p
    //'picture-by-picture-CACHED'//360p (-CACHED is an internal suffix and is removed)
  ];
  scope.FallbackPlayerType = "embed";
  scope.ForceAccessTokenPlayerType = "popout";
  scope.SkipPlayerReloadOnHevc = false;
  scope.AlwaysReloadPlayerOnAd = false;
  scope.ReloadPlayerAfterAd = true;
  scope.PlayerReloadMinimalRequestsTime = 1500;
  scope.PlayerReloadMinimalRequestsPlayerIndex = 2;
  scope.HasTriggeredPlayerReload = false;
  scope.StreamInfos = [];
  scope.StreamInfosByUrl = [];
  scope.GQLDeviceID = null;
  scope.ClientVersion = null;
  scope.ClientSession = null;
  scope.ClientIntegrityHeader = null;
  scope.AuthorizationHeader = void 0;
  scope.SimulatedAdsDepth = 0;
  scope.PlayerBufferingFix = true;
  scope.PlayerBufferingDelay = 500;
  scope.PlayerBufferingSameStateCount = 3;
  scope.PlayerBufferingDangerZone = 1;
  scope.PlayerBufferingDoPlayerReload = false;
  scope.PlayerBufferingMinRepeatDelay = 5e3;
  scope.V2API = false;
  scope.IsAdStrippingEnabled = true;
  scope.AdSegmentCache = /* @__PURE__ */ new Map();
  scope.AllSegmentsAreAdSegments = false;
}
let isActivelyStrippingAds = false;
let localStorageHookFailed = false;
const twitchWorkers = [];
const workerStringConflicts = [
  "twitch",
  "isVariantA"
  // TwitchNoSub
];
const workerStringAllow = [];
const workerStringReinsert = [
  "isVariantA",
  // TwitchNoSub (prior to (0.9))
  "besuper/",
  // TwitchNoSub (0.9)
  "${patch_url}"
  // TwitchNoSub (0.9.1)
];
function getCleanWorker(worker) {
  let root = null;
  let parent = null;
  let proto = worker;
  while (proto) {
    const workerString = proto.toString();
    if (workerStringConflicts.some((x) => workerString.includes(x)) && !workerStringAllow.some((x) => workerString.includes(x))) {
      if (parent !== null) {
        Object.setPrototypeOf(parent, Object.getPrototypeOf(proto));
      }
    } else {
      if (root === null) {
        root = proto;
      }
      parent = proto;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return root;
}
function getWorkersForReinsert(worker) {
  const result = [];
  let proto = worker;
  while (proto) {
    const workerString = proto.toString();
    if (workerStringReinsert.some((x) => workerString.includes(x))) {
      result.push(proto);
    } else {
    }
    proto = Object.getPrototypeOf(proto);
  }
  return result;
}
function reinsertWorkers(worker, reinsert) {
  let parent = worker;
  for (let i = 0; i < reinsert.length; i++) {
    Object.setPrototypeOf(reinsert[i], parent);
    parent = reinsert[i];
  }
  return parent;
}
function isValidWorker(worker) {
  const workerString = worker.toString();
  return !workerStringConflicts.some((x) => workerString.includes(x)) || workerStringAllow.some((x) => workerString.includes(x)) || workerStringReinsert.some((x) => workerString.includes(x));
}
function hookWindowWorker() {
  const reinsert = getWorkersForReinsert(window.Worker);
  const newWorker = class Worker extends getCleanWorker(window.Worker) {
    constructor(twitchBlobUrl, options) {
      let isTwitchWorker = false;
      try {
        isTwitchWorker = new URL(twitchBlobUrl).origin.endsWith(".twitch.tv");
      } catch (e) {
      }
      if (!isTwitchWorker) {
        super(twitchBlobUrl, options);
        return;
      }
      const newBlobStr = `
                  const pendingFetchRequests = new Map();
                  ${stripAdSegments.toString()}
                  ${getStreamUrlForResolution.toString()}
                  ${processM3U8.toString()}
                  ${hookWorkerFetch.toString()}
                  ${declareOptions.toString()}
                  ${getAccessToken.toString()}
                  ${gqlRequest.toString()}
                  ${parseAttributes.toString()}
                  ${getWasmWorkerJs.toString()}
                  ${getServerTimeFromM3u8.toString()}
                  ${replaceServerTimeInM3u8.toString()}
                  const workerString = getWasmWorkerJs('${twitchBlobUrl.replaceAll("'", "%27")}');
                  declareOptions(self);
                  GQLDeviceID = ${GQLDeviceID ? "'" + GQLDeviceID + "'" : null};
                  AuthorizationHeader = ${AuthorizationHeader ? "'" + AuthorizationHeader + "'" : void 0};
                  ClientIntegrityHeader = ${ClientIntegrityHeader ? "'" + ClientIntegrityHeader + "'" : null};
                  ClientVersion = ${ClientVersion ? "'" + ClientVersion + "'" : null};
                  ClientSession = ${ClientSession ? "'" + ClientSession + "'" : null};
                  self.addEventListener('message', function(e) {
                      if (e.data.key == 'UpdateClientVersion') {
                          ClientVersion = e.data.value;
                      } else if (e.data.key == 'UpdateClientSession') {
                          ClientSession = e.data.value;
                      } else if (e.data.key == 'UpdateClientId') {
                          ClientID = e.data.value;
                      } else if (e.data.key == 'UpdateDeviceId') {
                          GQLDeviceID = e.data.value;
                      } else if (e.data.key == 'UpdateClientIntegrityHeader') {
                          ClientIntegrityHeader = e.data.value;
                      } else if (e.data.key == 'UpdateAuthorizationHeader') {
                          AuthorizationHeader = e.data.value;
                      } else if (e.data.key == 'FetchResponse') {
                          const responseData = e.data.value;
                          if (pendingFetchRequests.has(responseData.id)) {
                              const { resolve, reject } = pendingFetchRequests.get(responseData.id);
                              pendingFetchRequests.delete(responseData.id);
                              if (responseData.error) {
                                  reject(new Error(responseData.error));
                              } else {
                                  // Create a Response object from the response data
                                  const response = new Response(responseData.body, {
                                      status: responseData.status,
                                      statusText: responseData.statusText,
                                      headers: responseData.headers
                                  });
                                  resolve(response);
                              }
                          }
                      } else if (e.data.key == 'TriggeredPlayerReload') {
                          HasTriggeredPlayerReload = true;
                      } else if (e.data.key == 'SimulateAds') {
                          SimulatedAdsDepth = e.data.value;
                          console.log('SimulatedAdsDepth: ' + SimulatedAdsDepth);
                      } else if (e.data.key == 'AllSegmentsAreAdSegments') {
                          AllSegmentsAreAdSegments = !AllSegmentsAreAdSegments;
                          console.log('AllSegmentsAreAdSegments: ' + AllSegmentsAreAdSegments);
                      }
                  });
                  hookWorkerFetch();
                  eval(workerString);
              `;
      super(URL.createObjectURL(new Blob([newBlobStr])), options);
      twitchWorkers.push(this);
      this.addEventListener("message", (e) => {
        if (e.data.key == "UpdateAdBlockBanner") {
          updateAdblockBanner(e.data);
          if (e.data.isStrippingAdSegments || e.data.isMidroll) {
            window.postMessage({ type: "twitchStreamAdBlocked" }, "*");
          }
        } else if (e.data.key == "PauseResumePlayer") {
          doTwitchPlayerTask(true, false);
        } else if (e.data.key == "ReloadPlayer") {
          doTwitchPlayerTask(false, true);
        }
      });
      this.addEventListener("message", async (event) => {
        if (event.data.key == "FetchRequest") {
          const fetchRequest = event.data.value;
          const responseData = await handleWorkerFetchRequest(fetchRequest);
          this.postMessage({
            key: "FetchResponse",
            value: responseData
          });
        }
      });
    }
  };
  let workerInstance = reinsertWorkers(newWorker, reinsert);
  Object.defineProperty(window, "Worker", {
    get: function() {
      return workerInstance;
    },
    set: function(value) {
      if (isValidWorker(value)) {
        workerInstance = value;
      } else {
        console.log("Attempt to set twitch worker denied");
      }
    }
  });
}
function getWasmWorkerJs(twitchBlobUrl) {
  const req = new XMLHttpRequest();
  req.open("GET", twitchBlobUrl, false);
  req.overrideMimeType("text/javascript");
  req.send();
  return req.responseText;
}
function hookWorkerFetch() {
  console.log("hookWorkerFetch (vaft)");
  const realFetch = fetch;
  fetch = async function(url, options) {
    if (typeof url === "string") {
      if (AdSegmentCache.has(url)) {
        return new Promise(function(resolve, reject) {
          const send = function() {
            return realFetch(
              "data:video/mp4;base64,AAAAKGZ0eXBtcDQyAAAAAWlzb21tcDQyZGFzaGF2YzFpc282aGxzZgAABEltb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAYagAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAABqHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAURtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAALuAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAADvbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAACzc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAALuAAAAAAAAzZXNkcwAAAAADgICAIgABAASAgIAUQBUAAAAAAAAAAAAAAAWAgIACEZAGgICAAQIAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAeV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAoAAAAFoAAAAAAGBbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAA9CQAAAAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABLG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAOxzdGJsAAAAoHN0c2QAAAAAAAAAAQAAAJBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAOmF2Y0MBTUAe/+EAI2dNQB6WUoFAX/LgLUBAQFAAAD6AAA6mDgAAHoQAA9CW7y4KAQAEaOuPIAAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAAAAAASG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAC4AAAAAAoAAAAAAACB0cmV4AAAAAAAAAAIAAAABAACCNQAAAAACQAAA",
              options
            ).then(function(response) {
              resolve(response);
            })["catch"](function(err) {
              reject(err);
            });
          };
          send();
        });
      }
      url = url.trimEnd();
      if (url.endsWith("m3u8")) {
        return new Promise(function(resolve, reject) {
          const processAfter = async function(response) {
            if (response.status === 200) {
              resolve(new Response(await processM3U8(url, await response.text(), realFetch)));
            } else {
              resolve(response);
            }
          };
          const send = function() {
            return realFetch(url, options).then(function(response) {
              processAfter(response);
            })["catch"](function(err) {
              reject(err);
            });
          };
          send();
        });
      } else if (url.includes("/channel/hls/") && !url.includes("picture-by-picture")) {
        V2API = url.includes("/api/v2/");
        const channelName = new URL(url).pathname.match(/([^\/]+)(?=\.\w+$)/)[0];
        if (ForceAccessTokenPlayerType) {
          const tempUrl = new URL(url);
          tempUrl.searchParams.delete("parent_domains");
          url = tempUrl.toString();
        }
        return new Promise(function(resolve, reject) {
          const processAfter = async function(response) {
            if (response.status == 200) {
              const encodingsM3u8 = await response.text();
              const serverTime = getServerTimeFromM3u8(encodingsM3u8);
              let streamInfo = StreamInfos[channelName];
              if (streamInfo != null && streamInfo.EncodingsM3U8 != null && (await realFetch(streamInfo.EncodingsM3U8.match(/^https:.*\.m3u8$/m)[0])).status !== 200) {
                streamInfo = null;
              }
              if (streamInfo == null || streamInfo.EncodingsM3U8 == null) {
                StreamInfos[channelName] = streamInfo = {
                  ChannelName: channelName,
                  IsShowingAd: false,
                  LastPlayerReload: 0,
                  EncodingsM3U8: encodingsM3u8,
                  ModifiedM3U8: null,
                  IsUsingModifiedM3U8: false,
                  UsherParams: new URL(url).search,
                  RequestedAds: /* @__PURE__ */ new Set(),
                  Urls: [],
                  // xxx.m3u8 -> { Resolution: "284x160", FrameRate: 30.0 }
                  ResolutionList: [],
                  BackupEncodingsM3U8Cache: [],
                  ActiveBackupPlayerType: null,
                  IsMidroll: false,
                  IsStrippingAdSegments: false,
                  NumStrippedAdSegments: 0
                };
                const lines = encodingsM3u8.replaceAll("\r", "").split("\n");
                for (let i = 0; i < lines.length - 1; i++) {
                  if (lines[i].startsWith("#EXT-X-STREAM-INF") && lines[i + 1].includes(".m3u8")) {
                    const attributes = parseAttributes(lines[i]);
                    const resolution = attributes["RESOLUTION"];
                    if (resolution) {
                      const resolutionInfo = {
                        Resolution: resolution,
                        FrameRate: attributes["FRAME-RATE"],
                        Codecs: attributes["CODECS"],
                        Url: lines[i + 1]
                      };
                      streamInfo.Urls[lines[i + 1]] = resolutionInfo;
                      streamInfo.ResolutionList.push(resolutionInfo);
                    }
                    StreamInfosByUrl[lines[i + 1]] = streamInfo;
                  }
                }
                const nonHevcResolutionList = streamInfo.ResolutionList.filter(
                  (element) => element.Codecs.startsWith("avc") || element.Codecs.startsWith("av0")
                );
                if (AlwaysReloadPlayerOnAd || nonHevcResolutionList.length > 0 && streamInfo.ResolutionList.some(
                  (element) => element.Codecs.startsWith("hev") || element.Codecs.startsWith("hvc")
                ) && !SkipPlayerReloadOnHevc) {
                  if (nonHevcResolutionList.length > 0) {
                    for (let i = 0; i < lines.length - 1; i++) {
                      if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
                        const resSettings = parseAttributes(lines[i].substring(lines[i].indexOf(":") + 1));
                        const codecsKey = "CODECS";
                        if (resSettings[codecsKey].startsWith("hev") || resSettings[codecsKey].startsWith("hvc")) {
                          const oldResolution = resSettings["RESOLUTION"];
                          const [targetWidth, targetHeight] = oldResolution.split("x").map(Number);
                          const newResolutionInfo = nonHevcResolutionList.sort((a, b) => {
                            const [streamWidthA, streamHeightA] = a.Resolution.split("x").map(Number);
                            const [streamWidthB, streamHeightB] = b.Resolution.split("x").map(Number);
                            return Math.abs(streamWidthA * streamHeightA - targetWidth * targetHeight) - Math.abs(streamWidthB * streamHeightB - targetWidth * targetHeight);
                          })[0];
                          console.log(
                            "ModifiedM3U8 swap " + resSettings[codecsKey] + " to " + newResolutionInfo.Codecs + " oldRes:" + oldResolution + " newRes:" + newResolutionInfo.Resolution
                          );
                          lines[i] = lines[i].replace(/CODECS="[^"]+"/, `CODECS="${newResolutionInfo.Codecs}"`);
                          lines[i + 1] = newResolutionInfo.Url + " ".repeat(i + 1);
                        }
                      }
                    }
                  }
                  if (nonHevcResolutionList.length > 0 || AlwaysReloadPlayerOnAd) {
                    streamInfo.ModifiedM3U8 = lines.join("\n");
                  }
                }
              }
              streamInfo.LastPlayerReload = Date.now();
              resolve(
                new Response(
                  replaceServerTimeInM3u8(
                    streamInfo.IsUsingModifiedM3U8 ? streamInfo.ModifiedM3U8 : streamInfo.EncodingsM3U8,
                    serverTime
                  )
                )
              );
            } else {
              resolve(response);
            }
          };
          const send = function() {
            return realFetch(url, options).then(function(response) {
              processAfter(response);
            })["catch"](function(err) {
              reject(err);
            });
          };
          send();
        });
      }
    }
    return realFetch.apply(this, arguments);
  };
}
function getServerTimeFromM3u8(encodingsM3u8) {
  if (V2API) {
    const matches2 = encodingsM3u8.match(/#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="([^"]+)"/);
    return matches2.length > 1 ? matches2[1] : null;
  }
  const matches = encodingsM3u8.match('SERVER-TIME="([0-9.]+)"');
  return matches.length > 1 ? matches[1] : null;
}
function replaceServerTimeInM3u8(encodingsM3u8, newServerTime) {
  if (V2API) {
    return newServerTime ? encodingsM3u8.replace(/(#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE=")[^"]+(")/, `$1${newServerTime}$2`) : encodingsM3u8;
  }
  return newServerTime ? encodingsM3u8.replace(new RegExp('(SERVER-TIME=")[0-9.]+"'), `SERVER-TIME="${newServerTime}"`) : encodingsM3u8;
}
function stripAdSegments(textStr, stripAllSegments, streamInfo) {
  let hasStrippedAdSegments = false;
  const lines = textStr.replaceAll("\r", "").split("\n");
  const newAdUrl = "https://twitch.tv";
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    line = line.replaceAll(/(X-TV-TWITCH-AD-URL=")(?:[^"]*)(")/g, `$1${newAdUrl}$2`).replaceAll(/(X-TV-TWITCH-AD-CLICK-TRACKING-URL=")(?:[^"]*)(")/g, `$1${newAdUrl}$2`);
    if (i < lines.length - 1 && line.startsWith("#EXTINF") && (!line.includes(",live") || stripAllSegments || AllSegmentsAreAdSegments)) {
      const segmentUrl = lines[i + 1];
      if (!AdSegmentCache.has(segmentUrl)) {
        streamInfo.NumStrippedAdSegments++;
      }
      AdSegmentCache.set(segmentUrl, Date.now());
      hasStrippedAdSegments = true;
    }
    if (line.includes(AdSignifier)) {
      hasStrippedAdSegments = true;
    }
  }
  if (hasStrippedAdSegments) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXT-X-TWITCH-PREFETCH:")) {
        lines[i] = "";
      }
    }
  } else {
    streamInfo.NumStrippedAdSegments = 0;
  }
  streamInfo.IsStrippingAdSegments = hasStrippedAdSegments;
  AdSegmentCache.forEach((key, value, map) => {
    if (value < Date.now() - 12e4) {
      map.delete(key);
    }
  });
  return lines.join("\n");
}
function getStreamUrlForResolution(encodingsM3u8, resolutionInfo) {
  const encodingsLines = encodingsM3u8.replaceAll("\r", "").split("\n");
  const [targetWidth, targetHeight] = resolutionInfo.Resolution.split("x").map(Number);
  let matchedResolutionUrl = null;
  let matchedFrameRate = false;
  let closestResolutionUrl = null;
  let closestResolutionDifference = Infinity;
  for (let i = 0; i < encodingsLines.length - 1; i++) {
    if (encodingsLines[i].startsWith("#EXT-X-STREAM-INF") && encodingsLines[i + 1].includes(".m3u8")) {
      const attributes = parseAttributes(encodingsLines[i]);
      const resolution = attributes["RESOLUTION"];
      const frameRate = attributes["FRAME-RATE"];
      if (resolution) {
        if (resolution == resolutionInfo.Resolution && (!matchedResolutionUrl || !matchedFrameRate && frameRate == resolutionInfo.FrameRate)) {
          matchedResolutionUrl = encodingsLines[i + 1];
          matchedFrameRate = frameRate == resolutionInfo.FrameRate;
          if (matchedFrameRate) {
            return matchedResolutionUrl;
          }
        }
        const [width, height] = resolution.split("x").map(Number);
        const difference = Math.abs(width * height - targetWidth * targetHeight);
        if (difference < closestResolutionDifference) {
          closestResolutionUrl = encodingsLines[i + 1];
          closestResolutionDifference = difference;
        }
      }
    }
  }
  return closestResolutionUrl;
}
async function processM3U8(url, textStr, realFetch) {
  const streamInfo = StreamInfosByUrl[url];
  if (!streamInfo) {
    return textStr;
  }
  if (HasTriggeredPlayerReload) {
    HasTriggeredPlayerReload = false;
    streamInfo.LastPlayerReload = Date.now();
  }
  const haveAdTags = textStr.includes(AdSignifier) || SimulatedAdsDepth > 0;
  if (haveAdTags) {
    streamInfo.IsMidroll = textStr.includes('"MIDROLL"') || textStr.includes('"midroll"');
    if (!streamInfo.IsShowingAd) {
      streamInfo.IsShowingAd = true;
      postMessage({
        key: "UpdateAdBlockBanner",
        isMidroll: streamInfo.IsMidroll,
        hasAds: streamInfo.IsShowingAd,
        isStrippingAdSegments: false
      });
    }
    if (!streamInfo.IsMidroll) {
      const lines = textStr.replaceAll("\r", "").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("#EXTINF") && lines.length > i + 1) {
          if (!line.includes(",live") && !streamInfo.RequestedAds.has(lines[i + 1])) {
            streamInfo.RequestedAds.add(lines[i + 1]);
            fetch(lines[i + 1]).then((response) => {
              response.blob();
            });
            break;
          }
        }
      }
    }
    const currentResolution = streamInfo.Urls[url];
    if (!currentResolution) {
      console.log("Ads will leak due to missing resolution info for " + url);
      return textStr;
    }
    const isHevc = currentResolution.Codecs.startsWith("hev") || currentResolution.Codecs.startsWith("hvc");
    if ((isHevc && !SkipPlayerReloadOnHevc || AlwaysReloadPlayerOnAd) && streamInfo.ModifiedM3U8 && !streamInfo.IsUsingModifiedM3U8) {
      streamInfo.IsUsingModifiedM3U8 = true;
      streamInfo.LastPlayerReload = Date.now();
      postMessage({
        key: "ReloadPlayer"
      });
    }
    let backupPlayerType = null;
    let backupM3u8 = null;
    let fallbackM3u8 = null;
    let startIndex = 0;
    let isDoingMinimalRequests = false;
    if (streamInfo.LastPlayerReload > Date.now() - PlayerReloadMinimalRequestsTime) {
      startIndex = PlayerReloadMinimalRequestsPlayerIndex;
      isDoingMinimalRequests = true;
    }
    for (let playerTypeIndex = startIndex; !backupM3u8 && playerTypeIndex < BackupPlayerTypes.length; playerTypeIndex++) {
      const playerType = BackupPlayerTypes[playerTypeIndex];
      const realPlayerType = playerType.replace("-CACHED", "");
      const isFullyCachedPlayerType = playerType != realPlayerType;
      for (let i = 0; i < 2; i++) {
        let isFreshM3u8 = false;
        let encodingsM3u8 = streamInfo.BackupEncodingsM3U8Cache[playerType];
        if (!encodingsM3u8) {
          isFreshM3u8 = true;
          try {
            const accessTokenResponse = await getAccessToken(streamInfo.ChannelName, realPlayerType);
            if (accessTokenResponse.status === 200) {
              const accessToken = await accessTokenResponse.json();
              const urlInfo = new URL(
                "https://usher.ttvnw.net/api/" + (V2API ? "v2/" : "") + "channel/hls/" + streamInfo.ChannelName + ".m3u8" + streamInfo.UsherParams
              );
              urlInfo.searchParams.set("sig", accessToken.data.streamPlaybackAccessToken.signature);
              urlInfo.searchParams.set("token", accessToken.data.streamPlaybackAccessToken.value);
              const encodingsM3u8Response = await realFetch(urlInfo.href);
              if (encodingsM3u8Response.status === 200) {
                encodingsM3u8 = streamInfo.BackupEncodingsM3U8Cache[playerType] = await encodingsM3u8Response.text();
              }
            }
          } catch (err) {
          }
        }
        if (encodingsM3u8) {
          try {
            const streamM3u8Url = getStreamUrlForResolution(encodingsM3u8, currentResolution);
            const streamM3u8Response = await realFetch(streamM3u8Url);
            if (streamM3u8Response.status == 200) {
              const m3u8Text = await streamM3u8Response.text();
              if (m3u8Text) {
                if (playerType == FallbackPlayerType) {
                  fallbackM3u8 = m3u8Text;
                }
                if (!m3u8Text.includes(AdSignifier) && (SimulatedAdsDepth == 0 || playerTypeIndex >= SimulatedAdsDepth - 1) || !fallbackM3u8 && playerTypeIndex >= BackupPlayerTypes.length - 1) {
                  backupPlayerType = playerType;
                  backupM3u8 = m3u8Text;
                  break;
                }
                if (isFullyCachedPlayerType) {
                  break;
                }
                if (isDoingMinimalRequests) {
                  backupPlayerType = playerType;
                  backupM3u8 = m3u8Text;
                  break;
                }
              }
            }
          } catch (err) {
          }
        }
        streamInfo.BackupEncodingsM3U8Cache[playerType] = null;
        if (isFreshM3u8) {
          break;
        }
      }
    }
    if (!backupM3u8 && fallbackM3u8) {
      backupPlayerType = FallbackPlayerType;
      backupM3u8 = fallbackM3u8;
    }
    if (backupM3u8) {
      textStr = backupM3u8;
      if (streamInfo.ActiveBackupPlayerType != backupPlayerType) {
        streamInfo.ActiveBackupPlayerType = backupPlayerType;
        console.log(`Blocking${streamInfo.IsMidroll ? " midroll " : " "}ads (${backupPlayerType})`);
      }
    }
    const stripHevc = isHevc && streamInfo.ModifiedM3U8;
    if (IsAdStrippingEnabled || stripHevc) {
      textStr = stripAdSegments(textStr, stripHevc, streamInfo);
    }
  } else if (streamInfo.IsShowingAd) {
    console.log("Finished blocking ads");
    streamInfo.IsShowingAd = false;
    streamInfo.IsStrippingAdSegments = false;
    streamInfo.NumStrippedAdSegments = 0;
    streamInfo.ActiveBackupPlayerType = null;
    if (streamInfo.IsUsingModifiedM3U8 || ReloadPlayerAfterAd) {
      streamInfo.IsUsingModifiedM3U8 = false;
      streamInfo.LastPlayerReload = Date.now();
      postMessage({
        key: "ReloadPlayer"
      });
    } else {
      postMessage({
        key: "PauseResumePlayer"
      });
    }
  }
  postMessage({
    key: "UpdateAdBlockBanner",
    isMidroll: streamInfo.IsMidroll,
    hasAds: streamInfo.IsShowingAd,
    isStrippingAdSegments: streamInfo.IsStrippingAdSegments,
    numStrippedAdSegments: streamInfo.NumStrippedAdSegments
  });
  return textStr;
}
function parseAttributes(str) {
  return Object.fromEntries(
    str.split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/).filter(Boolean).map((x) => {
      const idx = x.indexOf("=");
      const key = x.substring(0, idx);
      const value = x.substring(idx + 1);
      const num = Number(value);
      return [key, Number.isNaN(num) ? value.startsWith('"') ? JSON.parse(value) : value : num];
    })
  );
}
function getAccessToken(channelName, playerType) {
  const body = {
    operationName: "PlaybackAccessToken",
    variables: {
      isLive: true,
      login: channelName,
      isVod: false,
      vodID: "",
      playerType,
      platform: playerType == "autoplay" ? "android" : "web"
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: "ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9"
      }
    }
  };
  return gqlRequest(body, playerType);
}
function gqlRequest(body, playerType) {
  if (!GQLDeviceID) {
    const dcharacters = "abcdefghijklmnopqrstuvwxyz0123456789";
    const dcharactersLength = dcharacters.length;
    for (let i = 0; i < 32; i++) {
      GQLDeviceID += dcharacters.charAt(Math.floor(Math.random() * dcharactersLength));
    }
  }
  let headers = __spreadValues(__spreadValues(__spreadValues({
    "Client-ID": ClientID,
    "X-Device-Id": GQLDeviceID,
    Authorization: AuthorizationHeader
  }, ClientIntegrityHeader && { "Client-Integrity": ClientIntegrityHeader }), ClientVersion && { "Client-Version": ClientVersion }), ClientSession && { "Client-Session-Id": ClientSession });
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    const fetchRequest = {
      id: requestId,
      url: "https://gql.twitch.tv/gql",
      options: {
        method: "POST",
        body: JSON.stringify(body),
        headers
      }
    };
    pendingFetchRequests.set(requestId, {
      resolve,
      reject
    });
    postMessage({
      key: "FetchRequest",
      value: fetchRequest
    });
  });
}
let playerForMonitoringBuffering = null;
const playerBufferState = {
  position: 0,
  bufferedPosition: 0,
  bufferDuration: 0,
  numSame: 0,
  lastFixTime: 0,
  isLive: true
};
function monitorPlayerBuffering() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (playerForMonitoringBuffering) {
    try {
      const player = playerForMonitoringBuffering.player;
      const state = playerForMonitoringBuffering.state;
      if (!player.core) {
        playerForMonitoringBuffering = null;
      } else if (((_b = (_a = state.props) == null ? void 0 : _a.content) == null ? void 0 : _b.type) === "live" && !player.isPaused() && !((_c = player.getHTMLVideoElement()) == null ? void 0 : _c.ended) && playerBufferState.lastFixTime <= Date.now() - PlayerBufferingMinRepeatDelay && !isActivelyStrippingAds) {
        const position = (_e = (_d = player.core) == null ? void 0 : _d.state) == null ? void 0 : _e.position;
        const bufferedPosition = (_g = (_f = player.core) == null ? void 0 : _f.state) == null ? void 0 : _g.bufferedPosition;
        const bufferDuration = player.getBufferDuration();
        if (position > 5 && // changed from >0 to >5 due to issues with prerolls. TODO: Improve this, player could get stuck
        (playerBufferState.position == position || bufferDuration < PlayerBufferingDangerZone) && playerBufferState.bufferedPosition == bufferedPosition && playerBufferState.bufferDuration >= bufferDuration && (position != 0 || bufferedPosition != 0 || bufferDuration != 0)) {
          playerBufferState.numSame++;
          if (playerBufferState.numSame == PlayerBufferingSameStateCount) {
            console.log(
              "Attempt to fix buffering position:" + playerBufferState.position + " bufferedPosition:" + playerBufferState.bufferedPosition + " bufferDuration:" + playerBufferState.bufferDuration
            );
            doTwitchPlayerTask(!PlayerBufferingDoPlayerReload, PlayerBufferingDoPlayerReload, false);
            const isPausePlay = !PlayerBufferingDoPlayerReload;
            const isReload = PlayerBufferingDoPlayerReload;
            doTwitchPlayerTask(isPausePlay, isReload);
            playerBufferState.lastFixTime = Date.now();
          }
        } else {
          playerBufferState.numSame = 0;
        }
        playerBufferState.position = position;
        playerBufferState.bufferedPosition = bufferedPosition;
        playerBufferState.bufferDuration = bufferDuration;
      }
    } catch (err) {
      console.error("error when monitoring player for buffering: " + err);
      playerForMonitoringBuffering = null;
    }
  }
  if (!playerForMonitoringBuffering) {
    const playerAndState = getPlayerAndState();
    if (playerAndState && playerAndState.player && playerAndState.state) {
      playerForMonitoringBuffering = {
        player: playerAndState.player,
        state: playerAndState.state
      };
    }
  }
  const isLive = ((_j = (_i = (_h = playerForMonitoringBuffering == null ? void 0 : playerForMonitoringBuffering.state) == null ? void 0 : _h.props) == null ? void 0 : _i.content) == null ? void 0 : _j.type) === "live";
  if (playerBufferState.isLive && !isLive) {
    updateAdblockBanner({
      hasAds: false
    });
  }
  playerBufferState.isLive = isLive;
  setTimeout(monitorPlayerBuffering, PlayerBufferingDelay);
}
function updateAdblockBanner(data) {
  const playerRootDiv = document.querySelector(".video-player");
  if (playerRootDiv != null) {
    let adBlockDiv = null;
    adBlockDiv = playerRootDiv.querySelector(".adblock-overlay");
    if (adBlockDiv == null) {
      adBlockDiv = document.createElement("div");
      adBlockDiv.className = "adblock-overlay";
      adBlockDiv.innerHTML = '<div class="player-adblock-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 5px;"><p></p></div>';
      adBlockDiv.style.display = "none";
      adBlockDiv.P = adBlockDiv.querySelector("p");
      playerRootDiv.appendChild(adBlockDiv);
    }
    if (adBlockDiv != null) {
      isActivelyStrippingAds = data.isStrippingAdSegments;
      adBlockDiv.P.textContent = "Blocking" + (data.isMidroll ? " midroll" : "") + " ads" + (data.isStrippingAdSegments ? " (stripping)" : "");
      adBlockDiv.style.display = data.hasAds && playerBufferState.isLive ? "block" : "none";
    }
  }
}
function getPlayerAndState() {
  function findReactNode(root, constraint) {
    if (root.stateNode && constraint(root.stateNode)) {
      return root.stateNode;
    }
    let node = root.child;
    while (node) {
      const result = findReactNode(node, constraint);
      if (result) {
        return result;
      }
      node = node.sibling;
    }
    return null;
  }
  function findReactRootNode() {
    let reactRootNode2 = null;
    const rootNode = document.querySelector("#root");
    if (rootNode && rootNode._reactRootContainer && rootNode._reactRootContainer._internalRoot && rootNode._reactRootContainer._internalRoot.current) {
      reactRootNode2 = rootNode._reactRootContainer._internalRoot.current;
    }
    if (reactRootNode2 == null && rootNode != null) {
      const containerName = Object.keys(rootNode).find((x) => x.startsWith("__reactContainer"));
      if (containerName != null) {
        reactRootNode2 = rootNode[containerName];
      }
    }
    return reactRootNode2;
  }
  const reactRootNode = findReactRootNode();
  if (!reactRootNode) {
    return null;
  }
  let player = findReactNode(
    reactRootNode,
    (node) => node.setPlayerActive && node.props && node.props.mediaPlayerInstance
  );
  player = player && player.props && player.props.mediaPlayerInstance ? player.props.mediaPlayerInstance : null;
  const playerState = findReactNode(reactRootNode, (node) => node.setSrc && node.setInitialPlaybackSettings);
  return {
    player,
    state: playerState
  };
}
function doTwitchPlayerTask(isPausePlay, isReload) {
  var _a, _b, _c, _d, _e;
  const playerAndState = getPlayerAndState();
  if (!playerAndState) {
    console.log("Could not find react root");
    return;
  }
  const player = playerAndState.player;
  const playerState = playerAndState.state;
  if (!player) {
    console.log("Could not find player");
    return;
  }
  if (!playerState) {
    console.log("Could not find player state");
    return;
  }
  if (player.isPaused() || ((_a = player.core) == null ? void 0 : _a.paused)) {
    return;
  }
  if (isPausePlay) {
    player.pause();
    player.play();
    return;
  }
  if (isReload) {
    const lsKeyQuality = "video-quality";
    const lsKeyMuted = "video-muted";
    const lsKeyVolume = "volume";
    let currentQualityLS = null;
    let currentMutedLS = null;
    let currentVolumeLS = null;
    try {
      currentQualityLS = localStorage.getItem(lsKeyQuality);
      currentMutedLS = localStorage.getItem(lsKeyMuted);
      currentVolumeLS = localStorage.getItem(lsKeyVolume);
      if (localStorageHookFailed && ((_b = player == null ? void 0 : player.core) == null ? void 0 : _b.state)) {
        localStorage.setItem(lsKeyMuted, JSON.stringify({ default: player.core.state.muted }));
        localStorage.setItem(lsKeyVolume, player.core.state.volume);
      }
      if (localStorageHookFailed && ((_e = (_d = (_c = player == null ? void 0 : player.core) == null ? void 0 : _c.state) == null ? void 0 : _d.quality) == null ? void 0 : _e.group)) {
        localStorage.setItem(lsKeyQuality, JSON.stringify({ default: player.core.state.quality.group }));
      }
    } catch (e) {
    }
    console.log("Reloading Twitch player");
    playerState.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });
    postTwitchWorkerMessage("TriggeredPlayerReload");
    player.play();
    if (localStorageHookFailed && (currentQualityLS || currentMutedLS || currentVolumeLS)) {
      setTimeout(() => {
        try {
          if (currentQualityLS) {
            localStorage.setItem(lsKeyQuality, currentQualityLS);
          }
          if (currentMutedLS) {
            localStorage.setItem(lsKeyMuted, currentMutedLS);
          }
          if (currentVolumeLS) {
            localStorage.setItem(lsKeyVolume, currentVolumeLS);
          }
        } catch (e) {
        }
      }, 3e3);
    }
    return;
  }
}
window.reloadTwitchPlayer = () => {
  doTwitchPlayerTask(false, true);
};
function postTwitchWorkerMessage(key, value) {
  twitchWorkers.forEach((worker) => {
    worker.postMessage({ key, value });
  });
}
async function handleWorkerFetchRequest(fetchRequest) {
  try {
    const response = await window.realFetch(fetchRequest.url, fetchRequest.options);
    const responseBody = await response.text();
    const responseObject = {
      id: fetchRequest.id,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody
    };
    return responseObject;
  } catch (error) {
    return {
      id: fetchRequest.id,
      error: error.message
    };
  }
}
function hookFetch() {
  const realFetch = window.fetch;
  window.realFetch = realFetch;
  window.fetch = function(url, init, ...args) {
    var _a, _b, _c, _d, _e, _f;
    if (typeof url === "string") {
      if (url.includes("gql")) {
        let deviceId = init.headers["X-Device-Id"];
        if (typeof deviceId !== "string") {
          deviceId = init.headers["Device-ID"];
        }
        if (typeof deviceId === "string" && GQLDeviceID != deviceId) {
          GQLDeviceID = deviceId;
          postTwitchWorkerMessage("UpdateDeviceId", GQLDeviceID);
        }
        if (typeof init.headers["Client-Version"] === "string" && init.headers["Client-Version"] !== ClientVersion) {
          postTwitchWorkerMessage("UpdateClientVersion", ClientVersion = init.headers["Client-Version"]);
        }
        if (typeof init.headers["Client-Session-Id"] === "string" && init.headers["Client-Session-Id"] !== ClientSession) {
          postTwitchWorkerMessage("UpdateClientSession", ClientSession = init.headers["Client-Session-Id"]);
        }
        if (typeof init.headers["Client-Integrity"] === "string" && init.headers["Client-Integrity"] !== ClientIntegrityHeader) {
          postTwitchWorkerMessage(
            "UpdateClientIntegrityHeader",
            ClientIntegrityHeader = init.headers["Client-Integrity"]
          );
        }
        if (typeof init.headers["Authorization"] === "string" && init.headers["Authorization"] !== AuthorizationHeader) {
          postTwitchWorkerMessage("UpdateAuthorizationHeader", AuthorizationHeader = init.headers["Authorization"]);
        }
        if (ForceAccessTokenPlayerType && typeof init.body === "string" && init.body.includes("PlaybackAccessToken")) {
          let replacedPlayerType = "";
          const newBody = JSON.parse(init.body);
          if (Array.isArray(newBody)) {
            for (let i = 0; i < newBody.length; i++) {
              if (((_b = (_a = newBody[i]) == null ? void 0 : _a.variables) == null ? void 0 : _b.playerType) && ((_d = (_c = newBody[i]) == null ? void 0 : _c.variables) == null ? void 0 : _d.playerType) !== ForceAccessTokenPlayerType) {
                replacedPlayerType = newBody[i].variables.playerType;
                newBody[i].variables.playerType = ForceAccessTokenPlayerType;
              }
            }
          } else {
            if (((_e = newBody == null ? void 0 : newBody.variables) == null ? void 0 : _e.playerType) && ((_f = newBody == null ? void 0 : newBody.variables) == null ? void 0 : _f.playerType) !== ForceAccessTokenPlayerType) {
              replacedPlayerType = newBody.variables.playerType;
              newBody.variables.playerType = ForceAccessTokenPlayerType;
            }
          }
          if (replacedPlayerType) {
            console.log(
              `Replaced '${replacedPlayerType}' player type with '${ForceAccessTokenPlayerType}' player type`
            );
            init.body = JSON.stringify(newBody);
          }
        }
        if (init && typeof init.body === "string" && init.body.includes("PlaybackAccessToken") && init.body.includes("picture-by-picture")) {
          init.body = "";
        }
      }
    }
    return realFetch.apply(this, arguments);
  };
}
function onContentLoaded() {
  try {
    Object.defineProperty(document, "visibilityState", {
      get() {
        return "visible";
      }
    });
  } catch (e) {
  }
  let hidden = document.__lookupGetter__("hidden");
  let webkitHidden = document.__lookupGetter__("webkitHidden");
  try {
    Object.defineProperty(document, "hidden", {
      get() {
        return false;
      }
    });
  } catch (e) {
  }
  const block = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };
  let wasVideoPlaying = true;
  const visibilityChange = (e) => {
    if (typeof chrome !== "undefined") {
      const videos = document.getElementsByTagName("video");
      if (videos.length > 0) {
        if (hidden.apply(document) === true || webkitHidden && webkitHidden.apply(document) === true) {
          wasVideoPlaying = !videos[0].paused && !videos[0].ended;
        } else if (wasVideoPlaying && !videos[0].ended && videos[0].paused && videos[0].muted) {
          videos[0].play();
        }
      }
    }
    block(e);
  };
  document.addEventListener("visibilitychange", visibilityChange, true);
  document.addEventListener("webkitvisibilitychange", visibilityChange, true);
  document.addEventListener("mozvisibilitychange", visibilityChange, true);
  document.addEventListener("hasFocus", block, true);
  try {
    if (/Firefox/.test(navigator.userAgent)) {
      Object.defineProperty(document, "mozHidden", {
        get() {
          return false;
        }
      });
    } else {
      Object.defineProperty(document, "webkitHidden", {
        get() {
          return false;
        }
      });
    }
  } catch (e) {
  }
  try {
    const keysToCache = [
      "video-quality",
      "video-muted",
      "volume",
      "lowLatencyModeEnabled",
      // Low Latency
      "persistenceEnabled"
      // Mini Player
    ];
    const cachedValues = /* @__PURE__ */ new Map();
    for (let i = 0; i < keysToCache.length; i++) {
      cachedValues.set(keysToCache[i], localStorage.getItem(keysToCache[i]));
    }
    const realSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      if (cachedValues.has(key)) {
        cachedValues.set(key, value);
      }
      realSetItem.apply(this, arguments);
    };
    const realGetItem = localStorage.getItem;
    localStorage.getItem = function(key) {
      if (cachedValues.has(key)) {
        return cachedValues.get(key);
      }
      return realGetItem.apply(this, arguments);
    };
    if (!localStorage.getItem.toString().includes(Object.keys({ cachedValues })[0])) {
      localStorageHookFailed = true;
    }
  } catch (err) {
    console.log("localStorageHooks failed " + err);
    localStorageHookFailed = true;
  }
}
declareOptions(window);
hookWindowWorker();
hookFetch();
if (PlayerBufferingFix) {
  monitorPlayerBuffering();
}
if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
  onContentLoaded();
} else {
  window.addEventListener("DOMContentLoaded", function() {
    onContentLoaded();
  });
}
window.simulateAds = (depth) => {
  if (depth === void 0 || depth < 0) {
    console.log("Ad depth paramter required (0 = no simulated ad, 1+ = use backup player for given depth)");
    return;
  }
  postTwitchWorkerMessage("SimulateAds", depth);
};
window.allSegmentsAreAdSegments = () => {
  postTwitchWorkerMessage("AllSegmentsAreAdSegments");
};


/***/ })

/******/ });