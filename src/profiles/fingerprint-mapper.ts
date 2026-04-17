import type { PatchrightProfile } from "./patchright-profiles";

function parseResolution(
  value?: string,
): { width: number; height: number } | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) return undefined;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function mapMostLoginProfile(detail: any): {
  patchrightProfile: PatchrightProfile;
  launchArgs: string[];
  initScriptFlags: Record<string, boolean | number>;
} {
  const viewport = parseResolution(detail.fingerprint?.resolution);
  const locale = detail.fingerprint?.languages?.split(",")[0];

  return {
    patchrightProfile: {
      id: detail.id,
      name: detail.title ?? detail.name ?? detail.id,
      config: {
        ignoreHTTPSErrors: true,
        userAgent: detail.fingerprint?.userAgent,
        viewport,
        locale,
        timezoneId: detail.fingerprint?.timeZone,
        geolocation:
          detail.fingerprint?.geolocation === 2 &&
          typeof detail.fingerprint?.latitude === "number" &&
          typeof detail.fingerprint?.longitude === "number"
            ? {
                latitude: detail.fingerprint.latitude,
                longitude: detail.fingerprint.longitude,
              }
            : undefined,
        permissions:
          detail.fingerprint?.geolocation === 2 ? ["geolocation"] : undefined,
      },
    },
    launchArgs:
      detail.fingerprint?.webRTC === "disable"
        ? ["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"]
        : [],
    initScriptFlags: {
      canvasNoise: Boolean(detail.fingerprint?.canvasNoise),
      webglNoise: Boolean(detail.fingerprint?.webglNoise),
      audioContextNoise: Boolean(detail.fingerprint?.audioContextNoise),
      hardwareConcurrency: detail.fingerprint?.hardwareConcurrency ?? 0,
    },
  };
}
