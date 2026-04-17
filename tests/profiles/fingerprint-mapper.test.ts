import { describe, expect, it } from "vitest";
import { mapMostLoginProfile } from "../../src/profiles/fingerprint-mapper";

describe("mapMostLoginProfile", () => {
  it("maps resolution, locale, timezone, and geolocation", () => {
    const mapped = mapMostLoginProfile({
      id: "ml-001",
      title: "US desktop",
      fingerprint: {
        userAgent: "Mozilla/5.0 test",
        resolution: "1920x1080",
        languages: "en-US,en",
        timeZone: "America/New_York",
        geolocation: 2,
        latitude: 40.71,
        longitude: -74.0,
      },
    } as any);

    expect(mapped.patchrightProfile.config.viewport).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(mapped.patchrightProfile.config.locale).toBe("en-US");
    expect(mapped.patchrightProfile.config.timezoneId).toBe("America/New_York");
    expect(mapped.patchrightProfile.config.geolocation).toEqual({
      latitude: 40.71,
      longitude: -74.0,
    });
  });

  it("omits geolocation when not enabled", () => {
    const mapped = mapMostLoginProfile({
      id: "ml-002",
      title: "No geo",
      fingerprint: {
        userAgent: "Mozilla/5.0 test",
        geolocation: 0,
      },
    } as any);

    expect(mapped.patchrightProfile.config.geolocation).toBeUndefined();
  });

  it("adds webrtc disable launch arg when webRTC is disabled", () => {
    const mapped = mapMostLoginProfile({
      id: "ml-003",
      title: "No WebRTC",
      fingerprint: {
        userAgent: "Mozilla/5.0 test",
        webRTC: "disable",
      },
    } as any);

    expect(mapped.launchArgs).toContain(
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    );
  });
});
