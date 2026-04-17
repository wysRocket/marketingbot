import type { PatchrightProfile } from "./patchright-profiles";
import { buildInitScript, type InitScriptFlags } from "./init-scripts/index";

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
  initScriptFlags: InitScriptFlags;
  initScript: string;
} {
  const viewport = parseResolution(detail.fingerprint?.resolution);
  const locale = detail.fingerprint?.languages?.split(",")[0];

  const hwConcurrency =
    typeof detail.hardware_concurrency === "number" ? detail.hardware_concurrency : 4;
  const isResidential =
    detail.proxy?.type === "residential" || Boolean(detail.real_ip);
  const initScriptFlags: InitScriptFlags = {
    canvasNoise: true,
    webglNoise: true,
    audioNoise: true,
    hardwareConcurrency: hwConcurrency,
    webrtcGuard: isResidential,
  };
  const initScript = buildInitScript(initScriptFlags);

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
    initScriptFlags,
    initScript,
  };
}
