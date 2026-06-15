import { dismissAllConsents } from "./consents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContext = any;

/**
 * @deprecated Use dismissAllConsents from ./consents instead.
 * Kept for backward compatibility with existing call sites.
 */
export async function dismissSimilarWebConsents(
  context: AnyContext,
): Promise<void> {
  await dismissAllConsents(context);
}
