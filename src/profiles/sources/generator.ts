// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { generateFingerprints } from "../fingerprint-generator";

export function loadFromGenerator(count: number) {
  return generateFingerprints(count).map((profile: any) => ({
    id: profile.id,
    name: profile.name ?? profile.id,
    source: "generator" as const,
    patchrightProfile: profile,
    sessionStatePolicy: "cache-only" as const,
    mostloginProxy: undefined,
  }));
}
