import { getGlobalSingleton } from "../carrier.js";
import { createLogEnvelope } from "./envelope.js";
//#region node_modules/@sentry/core/build/esm/logs/internal.js
/**
* Flushes the logs buffer to Sentry.
*
* @param client - A client.
* @param maybeLogBuffer - A log buffer. Uses the log buffer for the given client if not provided.
*
* @experimental This method will experience breaking changes. This is not yet part of
* the stable Sentry SDK API and can be changed or removed without warning.
*/
function _INTERNAL_flushLogsBuffer(client, maybeLogBuffer) {
	const logBuffer = maybeLogBuffer ?? _INTERNAL_getLogBuffer(client) ?? [];
	if (logBuffer.length === 0) return;
	const clientOptions = client.getOptions();
	const envelope = createLogEnvelope(logBuffer, clientOptions._metadata, clientOptions.tunnel, client.getDsn());
	_getBufferMap().set(client, []);
	client.emit("flushLogs");
	client.sendEnvelope(envelope);
}
/**
* Returns the log buffer for a given client.
*
* Exported for testing purposes.
*
* @param client - The client to get the log buffer for.
* @returns The log buffer for the given client.
*/
function _INTERNAL_getLogBuffer(client) {
	return _getBufferMap().get(client);
}
function _getBufferMap() {
	return getGlobalSingleton("clientToLogBufferMap", () => /* @__PURE__ */ new WeakMap());
}
//#endregion
export { _INTERNAL_flushLogsBuffer };
