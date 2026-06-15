import http, {
  IncomingHttpHeaders,
  IncomingMessage,
  RequestOptions,
  ServerResponse,
} from "node:http";

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function parseMostLoginHost(
  rawHost: string,
): { hostname: string; port: number } {
  const [hostname, portRaw] = rawHost.split(":");
  const port = Number.parseInt(portRaw ?? "30898", 10);

  if (!hostname || !Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid MOSTLOGIN_HOST value: ${rawHost}`);
  }

  return { hostname, port };
}

export function hasValidTunnelBearer(
  headers: IncomingHttpHeaders,
  expectedBearer: string,
): boolean {
  const value = headers["x-tunnel-bearer"];
  if (Array.isArray(value)) {
    return value.includes(expectedBearer);
  }
  return value === expectedBearer;
}

export function buildUpstreamRequestOptions(input: {
  upstreamHost: string;
  upstreamPort: number;
  upstreamApiKey: string;
  request: IncomingMessage;
}): RequestOptions {
  const headers: Record<string, string | string[] | undefined> = {
    ...input.request.headers,
    authorization: input.upstreamApiKey,
    host: `${input.upstreamHost}:${input.upstreamPort}`,
  };

  delete headers["x-tunnel-bearer"];

  return {
    protocol: "http:",
    hostname: input.upstreamHost,
    port: input.upstreamPort,
    method: input.request.method,
    path: input.request.url,
    headers,
  };
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function createMostLoginTunnelProxyServer(input: {
  expectedBearer: string;
  upstreamHost: string;
  upstreamPort: number;
  upstreamApiKey: string;
}): http.Server {
  return http.createServer((request, response) => {
    if (!hasValidTunnelBearer(request.headers, input.expectedBearer)) {
      writeJson(response, 401, { error: "invalid tunnel bearer" });
      return;
    }

    const upstreamRequest = http.request(
      buildUpstreamRequestOptions({
        upstreamHost: input.upstreamHost,
        upstreamPort: input.upstreamPort,
        upstreamApiKey: input.upstreamApiKey,
        request,
      }),
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, {
          ...upstreamResponse.headers,
        });
        upstreamResponse.pipe(response);
      },
    );

    upstreamRequest.on("error", (error) => {
      writeJson(response, 502, {
        error: "upstream request failed",
        message: error.message,
      });
    });

    request.pipe(upstreamRequest);
  });
}

async function main(): Promise<void> {
  const expectedBearer = readRequiredEnv("MOSTLOGIN_TUNNEL_BEARER");
  const upstreamApiKey = readRequiredEnv("MOSTLOGIN_API_KEY");
  const listenPort = Number.parseInt(
    process.env.MOSTLOGIN_TUNNEL_PORT ?? "30908",
    10,
  );

  if (!Number.isFinite(listenPort) || listenPort <= 0) {
    throw new Error(
      `Invalid MOSTLOGIN_TUNNEL_PORT value: ${process.env.MOSTLOGIN_TUNNEL_PORT ?? ""}`,
    );
  }

  const upstream = parseMostLoginHost(
    process.env.MOSTLOGIN_HOST ?? "127.0.0.1:30898",
  );

  const server = createMostLoginTunnelProxyServer({
    expectedBearer,
    upstreamHost: upstream.hostname,
    upstreamPort: upstream.port,
    upstreamApiKey,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, "127.0.0.1", () => resolve());
  });

  console.log(
    `[mostlogin-tunnel-proxy] Listening on http://127.0.0.1:${listenPort} -> http://${upstream.hostname}:${upstream.port}`,
  );
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(
      `[mostlogin-tunnel-proxy] Failed to start: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
