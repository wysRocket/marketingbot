import { Page } from "patchright";

export interface ExtensionTelemetryEvent {
  timestamp: number;
  type: "request" | "response";
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  statusCode?: number;
  resourceType: string;
  extensionId?: string;
  matchedDomain: string;
}

export interface ExtensionTelemetryConfig {
  domains: string[];
  captureRequestBody: boolean;
  captureResponseBody: boolean;
  maxBodySize: number;
  onEvent: (event: ExtensionTelemetryEvent) => void;
}

const DEFAULT_CONFIG: Partial<ExtensionTelemetryConfig> = {
  domains: [
    "similarweb.com",
    "sw-extension.s3.amazonaws.com",
    "data.similarweb.com",
    "rank.similarweb.com",
    "cdn.growthbook.io",
    "api.mixpanel.com",
    "mixpanel.com",
  ],
  captureRequestBody: true,
  captureResponseBody: true,
  maxBodySize: 100 * 1024, // 100KB
};

const EXTENSION_SCHEMES = ["chrome-extension:", "moz-extension:", "safari-extension:"];

function isExtensionRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    return EXTENSION_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function matchesDomain(url: string, domains: string[]): string | null {
  try {
    const hostname = new URL(url).hostname;
    for (const domain of domains) {
      if (hostname === domain || hostname.endsWith("." + domain)) {
        return domain;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function decodeBody(body: string | undefined, encoding?: string): string | undefined {
  if (!body) return undefined;
  // Playwright CDP returns base64 encoded bodies for binary content
  // For JSON/text, it's usually plain text
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // Return as-is if not JSON
    return body.length > 5000 ? body.slice(0, 5000) + "... [truncated]" : body;
  }
}

export class ExtensionTelemetryInterceptor {
  private config: ExtensionTelemetryConfig;
  private cdp: {
    send: (method: string, params: unknown) => Promise<unknown>;
    on: (event: string, listener: (data: unknown) => void) => void;
    detach: () => Promise<void>;
  } | null = null;
  private requestBodies = new Map<string, string>();
  private requestIdToMeta = new Map<string, { url: string; method: string; matchedDomain: string }>();

  constructor(config: Partial<ExtensionTelemetryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as ExtensionTelemetryConfig;
  }

  async attach(page: Page): Promise<void> {
    this.cdp = await page.context().newCDPSession(page) as typeof this.cdp;
    if (!this.cdp) return;
    await this.cdp.send("Network.enable", {});

    // Get response bodies for relevant requests
    await this.cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

    this.cdp!.on("Network.requestWillBeSent", this.onRequestWillBeSent.bind(this));
    this.cdp!.on("Network.responseReceived", this.onResponseReceived.bind(this));
    this.cdp!.on("Network.loadingFinished", this.onLoadingFinished.bind(this));
    this.cdp!.on("Network.loadingFailed", this.onLoadingFailed.bind(this));
  }

  private onRequestWillBeSent(event: any): void {
    const { requestId, request, type } = event;
    if (!request) return;

    const url = request.url;
    const hostname = new URL(url).hostname;

    // Capture ALL requests — filter by domain on the dashboard side
    // This ensures we don't miss any extension traffic
    this.requestIdToMeta.set(requestId, {
      url,
      method: request.method,
      matchedDomain: hostname,
    });

    if (this.config.captureRequestBody && request.postData) {
      this.requestBodies.set(requestId, request.postData);
    }
  }

  private async onResponseReceived(event: any): Promise<void> {
    const { requestId, response } = event;
    if (!response) return;

    const meta = this.requestIdToMeta.get(requestId);
    if (!meta) return;

    // Request response body for relevant requests
    try {
      await this.cdp?.send("Network.getResponseBody", { requestId });
    } catch {
      // Body might not be available (e.g., streaming, empty, or binary)
    }
  }

  private onLoadingFinished(event: any): void {
    const { requestId, encodedDataLength } = event;
    this.finalizeRequest(requestId, encodedDataLength, null);
  }

  private onLoadingFailed(event: any): void {
    const { requestId, errorText } = event;
    this.finalizeRequest(requestId, 0, errorText);
  }

  private async finalizeRequest(
    requestId: string,
    encodedDataLength: number,
    errorText: string | null
  ): Promise<void> {
    const meta = this.requestIdToMeta.get(requestId);
    if (!meta) return;

    // Get response body if available
    let responseBody: string | undefined;
    if (this.config.captureResponseBody && !errorText) {
      try {
        const result = await this.cdp?.send("Network.getResponseBody", { requestId });
        if (result && typeof result === "object" && "body" in result) {
          responseBody = decodeBody(
            (result as { body: string }).body,
            (result as { base64Encoded?: boolean }).base64Encoded ? "base64" : undefined
          );
        }
      } catch {
        // Ignore - body not available
      }
    }

    const requestBody = this.requestBodies.get(requestId);

    const telemetryEvent: ExtensionTelemetryEvent = {
      timestamp: Date.now(),
      type: errorText ? "request" : "response",
      url: meta.url,
      method: meta.method,
      requestHeaders: {}, // Would need Network.requestWillBeSentExtraInfo for full headers
      responseHeaders: {},
      requestBody: requestBody ? decodeBody(requestBody) : undefined,
      responseBody,
      statusCode: errorText ? undefined : 200, // We don't have status code here without extra instrumentation
      resourceType: "xhr", // Simplified
      matchedDomain: meta.matchedDomain,
    };

    this.config.onEvent(telemetryEvent);

    // Cleanup
    this.requestIdToMeta.delete(requestId);
    this.requestBodies.delete(requestId);
  }

  async detach(): Promise<void> {
    if (this.cdp) {
      await this.cdp.detach().catch(() => {});
      this.cdp = null;
    }
    this.requestIdToMeta.clear();
    this.requestBodies.clear();
  }
}

// Factory function for easy integration
export function createExtensionTelemetryInterceptor(
  onEvent: (event: ExtensionTelemetryEvent) => void,
  options: Partial<ExtensionTelemetryConfig> = {}
): ExtensionTelemetryInterceptor {
  return new ExtensionTelemetryInterceptor({ ...options, onEvent });
}