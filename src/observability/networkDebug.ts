const REPORTING_PATTERNS = [
  "similarweb",
  "joinhoney",
  "hola",
  "keywordseverywhere",
];

export function shouldCaptureRequest(url: string): boolean {
  const lower = url.toLowerCase();
  return REPORTING_PATTERNS.some((pattern) => lower.includes(pattern));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function attachNetworkDebugger(context: any): Promise<void> {
  if (!context.browser) return;

  try {
    const cdpSession = await context.newCDPSession(await context.newPage());
    await cdpSession.send("Network.enable");
    cdpSession.on("Network.requestWillBeSent", (event: any) => {
      if (shouldCaptureRequest(event.request.url)) {
        console.log("[networkDebug] extension request:", event.request.url);
      }
    });
  } catch {
    // CDP not available or page already closed — skip silently.
  }
}
