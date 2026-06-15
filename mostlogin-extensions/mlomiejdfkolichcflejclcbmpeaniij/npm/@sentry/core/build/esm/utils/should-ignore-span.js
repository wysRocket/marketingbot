import { DEBUG_BUILD } from "../debug-build.js";
import { debug } from "./debug-logger.js";
import { isMatchingPattern } from "./string.js";
//#region node_modules/@sentry/core/build/esm/utils/should-ignore-span.js
function logIgnoredSpan(droppedSpan) {
	debug.log(`Ignoring span ${droppedSpan.op} - ${droppedSpan.description} because it matches \`ignoreSpans\`.`);
}
/**
* Check if a span should be ignored based on the ignoreSpans configuration.
*/
function shouldIgnoreSpan(span, ignoreSpans) {
	if (!ignoreSpans?.length || !span.description) return false;
	for (const pattern of ignoreSpans) {
		if (isStringOrRegExp(pattern)) {
			if (isMatchingPattern(span.description, pattern)) {
				DEBUG_BUILD && logIgnoredSpan(span);
				return true;
			}
			continue;
		}
		if (!pattern.name && !pattern.op) continue;
		const nameMatches = pattern.name ? isMatchingPattern(span.description, pattern.name) : true;
		const opMatches = pattern.op ? span.op && isMatchingPattern(span.op, pattern.op) : true;
		if (nameMatches && opMatches) {
			DEBUG_BUILD && logIgnoredSpan(span);
			return true;
		}
	}
	return false;
}
/**
* Takes a list of spans, and a span that was dropped, and re-parents the child spans of the dropped span to the parent of the dropped span, if possible.
* This mutates the spans array in place!
*/
function reparentChildSpans(spans, dropSpan) {
	const droppedSpanParentId = dropSpan.parent_span_id;
	const droppedSpanId = dropSpan.span_id;
	if (!droppedSpanParentId) return;
	for (const span of spans) if (span.parent_span_id === droppedSpanId) span.parent_span_id = droppedSpanParentId;
}
function isStringOrRegExp(value) {
	return typeof value === "string" || value instanceof RegExp;
}
//#endregion
export { reparentChildSpans, shouldIgnoreSpan };
