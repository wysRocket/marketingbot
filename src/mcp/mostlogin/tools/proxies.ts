import { z } from "zod";
import { ml } from "../client";

// ── Schemas ──────────────────────────────────────────────────────────

export const ListProxiesSchema = {
  page: z.number().int().min(1).optional().default(1).describe("Page number"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Items per page"),
};

export const ProxyDetectSchema = {
  protocol: z
    .enum(["socks5", "http", "https", "ssh"])
    .optional()
    .default("socks5")
    .describe("Proxy protocol"),
  host: z.string().describe("Proxy host"),
  port: z.number().int().describe("Proxy port"),
  proxyUsername: z.string().describe("Proxy username"),
  proxyPassword: z.string().describe("Proxy password"),
};

export const CreateBaseProxySchema = {
  host: z.string().describe("Proxy host"),
  port: z.number().int().describe("Proxy port"),
  protocol: z
    .enum(["socks5", "http", "https", "ssh"])
    .optional()
    .default("socks5")
    .describe("Proxy protocol"),
  proxyUsername: z.string().describe("Proxy username"),
  proxyPassword: z.string().describe("Proxy password"),
  publicViewing: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .default(0)
    .describe("0=me only, 1=team view, 2=team edit"),
  repeatItem: z
    .boolean()
    .optional()
    .default(false)
    .describe("Block duplicate proxies"),
  rotateUrl: z.string().optional().default("").describe("IP rotation URL"),
  proxyMethod: z.number().int().optional().default(0),
};

export const UpdateBaseProxySchema = {
  id: z.string().describe("Proxy ID"),
  host: z.string().describe("Proxy host"),
  port: z.number().int().describe("Proxy port"),
  protocol: z
    .enum(["socks5", "http", "https", "ssh"])
    .describe("Proxy protocol"),
  proxyUsername: z.string().describe("Proxy username"),
  proxyPassword: z.string().describe("Proxy password"),
  publicViewing: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .default(0)
    .describe("0=me only, 1=team view, 2=team edit"),
  rotateUrl: z.string().optional().default("").describe("IP rotation URL"),
};

export const AddApiExtractionProxySchema = {
  protocol: z
    .enum(["socks5", "http", "https", "ssh"])
    .describe("Proxy protocol"),
  extractionUrl: z.string().describe("Proxy extraction API URL"),
  extractMethod: z
    .number()
    .int()
    .min(0)
    .max(1)
    .describe("0=new IP each open, 1=new IP when prior expires"),
  publicViewing: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .default(0)
    .describe("0=me only, 1=team view, 2=team edit"),
  duplicateCheck: z.boolean().optional().default(false),
  repeatItem: z.boolean().optional().default(false),
};

export const UpdateApiExtractionProxySchema = {
  id: z.string().describe("Proxy ID"),
  protocol: z
    .enum(["socks5", "http", "https", "ssh"])
    .describe("Proxy protocol"),
  extractionUrl: z.string().describe("Proxy extraction API URL"),
  extractMethod: z
    .number()
    .int()
    .min(0)
    .max(1)
    .describe("0=new IP each open, 1=new IP when prior expires"),
  publicViewing: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .default(0)
    .describe("0=me only, 1=team view, 2=team edit"),
};

export const DeleteProxiesSchema = {
  ids: z.array(z.string()).min(1).describe("Proxy IDs to delete"),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function listProxies(page = 1, pageSize = 10) {
  const res = await ml.post("/api/proxy/getProxies", { page, pageSize });
  return res.data;
}

export async function proxyDetect(params: {
  protocol: string;
  host: string;
  port: number;
  proxyUsername: string;
  proxyPassword: string;
}) {
  const res = await ml.post("/api/proxy/proxyDetect", params);
  return res.data;
}

export async function createBaseProxy(params: Record<string, unknown>) {
  const res = await ml.post("/api/proxy/createBaseProxy", params);
  return res.data;
}

export async function updateBaseProxy(params: Record<string, unknown>) {
  const res = await ml.post("/api/proxy/updateBaseProxy", params);
  return res.data;
}

export async function addApiExtractionProxy(params: Record<string, unknown>) {
  const res = await ml.post("/api/proxy/addApiExtractionProxy", params);
  return res.data;
}

export async function updateApiExtractionProxy(
  params: Record<string, unknown>,
) {
  const res = await ml.post("/api/proxy/updateApiExtractionProxy", params);
  return res.data;
}

export async function deleteProxies(ids: string[]) {
  const res = await ml.post("/api/proxy/delProxies", { ids });
  return res.data;
}
