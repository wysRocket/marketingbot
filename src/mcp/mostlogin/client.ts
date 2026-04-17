import axios, { type AxiosRequestConfig } from "axios";
import "dotenv/config";

export function buildMostLoginClientConfig(
  env: Record<string, string | undefined> = process.env,
): AxiosRequestConfig {
  const tunnelUrl = env.MOSTLOGIN_TUNNEL_URL;
  const localHost = env.MOSTLOGIN_HOST ?? "127.0.0.1:30898";

  if (tunnelUrl) {
    return {
      baseURL: tunnelUrl,
      headers: env.MOSTLOGIN_TUNNEL_BEARER
        ? { "X-Tunnel-Bearer": env.MOSTLOGIN_TUNNEL_BEARER }
        : {},
      timeout: 30_000,
    };
  }

  return {
    baseURL: `http://${localHost}`,
    headers: { Authorization: env.MOSTLOGIN_API_KEY ?? "" },
    timeout: 30_000,
  };
}

export const ml = axios.create(buildMostLoginClientConfig());

export async function withMostLoginRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}
