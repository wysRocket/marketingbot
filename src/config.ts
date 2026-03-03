import "dotenv/config";

function require_env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  nstbrowser: {
    apiKey: require_env("NSTBROWSER_API_KEY"),
    host: process.env.NSTBROWSER_HOST ?? "localhost:8848",
  },
  proxy: {
    user: process.env.DI_USER ?? "",
    pass: process.env.DI_PASS ?? "",
    host: "gw.dataimpulse.com",
    port: 10000,
  },
};
