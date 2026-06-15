import "dotenv/config";
import path from "node:path";

export const config = {
  nstbrowser: {
    apiKey: process.env.NSTBROWSER_API_KEY ?? "",
    host: process.env.NSTBROWSER_HOST ?? "localhost:8848",
  },
  mostlogin: {
    apiKey: process.env.MOSTLOGIN_API_KEY ?? "",
    host: process.env.MOSTLOGIN_HOST ?? "127.0.0.1:30898",
    tunnelUrl: process.env.MOSTLOGIN_TUNNEL_URL ?? "",
    tunnelBearer: process.env.MOSTLOGIN_TUNNEL_BEARER ?? "",
  },
  proxy: {
    user: process.env.DI_USER ?? "",
    pass: process.env.DI_PASS ?? "",
    host: "gw.dataimpulse.com",
    port: 10000,
  },
  patchright: {
    cacheDir:
      process.env.PATCHRIGHT_CACHE_DIR ??
      (process.env.RAILWAY_ENVIRONMENT
        ? "/data/marketingbot-patchright"
        : path.join(process.cwd(), ".profile-cache", "patchright")),
    profileSource: (process.env.PROFILE_SOURCE ?? "generator") as
      | "mostlogin"
      | "snapshot"
      | "generator",
    allowGeneratorFallback: process.env.ALLOW_GENERATOR_FALLBACK === "1",
    sessionStatePolicy: (process.env.SESSION_STATE_POLICY ?? "cache-only") as
      | "cache-only"
      | "identity-sticky",
    networkDebug: process.env.NETWORK_DEBUG === "1",
  },
};
