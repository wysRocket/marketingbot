/**
 * checkProxyIsp — Determine what ISP/proxy provider our current session
 * routes through. This is critical for SimilarWeb estimation, because
 * traffic only counts if the proxy IP belongs to an ISP that SimilarWeb
 * partners with (Comcast, Verizon, Deutsche Telekom, etc.).
 *
 * DataImpulse residential IPs may or may not route through partner ISPs.
 * This check lets us verify per-session and log it to telemetry.
 */

import axios from "axios";

export interface IspInfo {
  ip: string;
  isp: string;
  org: string;
  country: string;
  city: string;
  /** true if the ISP is a major residential provider */ 
  isResidential: boolean;
  /** true if the ISP is a known SimilarWeb partner */ 
  isPartnerIsp: boolean;
  asn: string | null;
}

// Rough list of ISPs that likely feed data to SimilarWeb (based on their
// "global ISP partnerships" claims). Not exhaustive — SimilarWeb doesn't
// publish their partner list.
const PARTNER_ISPS = [
  "comcast",
  "xfinity",
  "verizon",
  "at&t",
  "att",
  "deutsche telekom",
  "telekom",
  "bt",
  "british telecom",
  "orange",
  "vodafone",
  "kpn",
  "telecom italia",
  "tim",
  "swisscom",
  "telia",
  "telenor",
  "telstra",
  "bell canada",
  "rogers",
  "charter",
  "spectrum",
  "centurylink",
  "frontier",
  "cogeco",
  "shaw",
  "cox",
  "t-mobile",
  "singtel",
  "kddi",
  "nuro",
  "softbank",
  "telefonica",
  "movistar",
  "proximus",
  "telenet",
  "free",
  "numericable",
  "bouygues",
  "sfr",
  "sky",
  "virgin media",
  "talktalk",
  "ee",
  "three",
  "o2",
];

// Datacenter / VPS / hosting ISPs — NOT residential
const DATACENTER_ISPS = [
  "datacenter",
  "digitalocean",
  "aws",
  "amazon web services",
  "amazon.com",
  "google cloud",
  "google cloud platform",
  "microsoft azure",
  "azure",
  "oracle cloud",
  "linode",
  "vultr",
  "hetzner",
  "ovh",
  "scaleway",
  "contabo",
  "ionos",
  "dreamhost",
  "namecheap",
  "hostinger",
  "godaddy",
  "bluehost",
  "siteground",
  "cloudflare",
  "akamai",
  "fastly",
  "incapsula",
  "dataimpulse",
  "bestproxy",
  "oxylabs",
  "brightdata",
  "luminati",
  "ray",
  "soax",
  "iproxy",
];

function normalizeIspName(name: string): string {
  return name.toLowerCase().replace(/[,.]/g, "").trim();
}

function isResidential(isp: string, org: string): boolean {
  const normalizedIsp = normalizeIspName(isp);
  const normalizedOrg = normalizeIspName(org);

  // If org contains a datacenter keyword, it's not residential
  for (const dc of DATACENTER_ISPS) {
    if (normalizedOrg.includes(dc) || normalizedIsp.includes(dc)) {
      return false;
    }
  }

  // If org looks like a mobile/isp provider, it's residential
  for (const partner of PARTNER_ISPS) {
    if (normalizedOrg.includes(partner) || normalizedIsp.includes(partner)) {
      return true;
    }
  }

  // Unknown — ambiguous. Could be a datacenter or a small ISP.
  return false;
}

function isPartnerIsp(isp: string, org: string): boolean {
  const normalizedIsp = normalizeIspName(isp);
  const normalizedOrg = normalizeIspName(org);

  for (const partner of PARTNER_ISPS) {
    if (normalizedOrg.includes(partner) || normalizedIsp.includes(partner)) {
      return true;
    }
  }
  return false;
}

/**
 * Check what ISP our current proxy routes through.
 * Uses ipinfo.io — available without auth for basic lookups.
 * Prefer checkProxyIspFromPage() which goes through the browser's proxy.
 */
export async function checkProxyIsp(
  options?: {
    proxyUrl?: string; // e.g. "socks5://user:pass@host:port"
  },
): Promise<IspInfo> {
  // Node-side check only works without proxy or with explicit agent.
  // For proxied sessions, use checkProxyIspFromPage() instead.
  // Fallback: return unknown.
  return {
    ip: "use-page-check",
    isp: "use checkProxyIspFromPage() for proxied sessions",
    org: "use checkProxyIspFromPage() for proxied sessions",
    country: "unknown",
    city: "unknown",
    isResidential: false,
    isPartnerIsp: false,
    asn: null,
  };
}

/**
 * Check proxy ISP using a browser page context (works through any proxy
 * Patchright already set up). Much more reliable than Node-side checks
 * because it automatically uses whatever proxy the page is on.
 */
export async function checkProxyIspFromPage(
  page: any, // Patchright Page
): Promise<IspInfo> {
  try {
    const info = await page.evaluate(async () => {
      try {
        const resp = await fetch("https://ipinfo.io/json");
        const data = await resp.json();
        return data as Record<string, string>;
      } catch {
        return null;
      }
    });

    if (!info || !info.ip) {
      return {
        ip: "unknown",
        isp: "unknown",
        org: "unknown",
        country: "unknown",
        city: "unknown",
        isResidential: false,
        isPartnerIsp: false,
        asn: null,
      };
    }

    const asnMatch = (info.org ?? "").match(/AS(\d+)/i);

    const result: IspInfo = {
      ip: info.ip ?? "unknown",
      isp: info.org ?? "unknown",
      org: info.org ?? "unknown",
      country: info.country ?? "unknown",
      city: info.city ?? "unknown",
      isResidential: false,
      isPartnerIsp: false,
      asn: asnMatch ? `AS${asnMatch[1]}` : null,
    };

    result.isResidential = isResidential(result.isp, result.org);
    result.isPartnerIsp = isPartnerIsp(result.isp, result.org);

    console.log(
      `  [proxy-isp] ${result.ip} (${result.city}, ${result.country}) ` +
        `org=${result.org} ` +
        `residential=${result.isResidential} ` +
        `partner=${result.isPartnerIsp}`,
    );

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  [proxy-isp] ✗ Failed to check from page: ${msg}`);
    return {
      ip: "error",
      isp: `error: ${msg}`,
      org: "error",
      country: "error",
      city: "error",
      isResidential: false,
      isPartnerIsp: false,
      asn: null,
    };
  }
}
