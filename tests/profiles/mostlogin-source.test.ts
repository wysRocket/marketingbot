import { beforeEach, describe, expect, it, vi } from "vitest";

const listProfilesMock = vi.fn();
const getProfileDetailMock = vi.fn();
const mapMostLoginProfileMock = vi.fn();

vi.mock("../../src/mcp/mostlogin/tools/profiles", () => ({
  listProfiles: listProfilesMock,
  getProfileDetail: getProfileDetailMock,
}));

vi.mock("../../src/profiles/fingerprint-mapper", () => ({
  mapMostLoginProfile: mapMostLoginProfileMock,
}));

describe("mostlogin source", () => {
  beforeEach(() => {
    vi.resetModules();
    listProfilesMock.mockReset();
    getProfileDetailMock.mockReset();
    mapMostLoginProfileMock.mockReset();
  });

  it("loads catalog entries from existing MostLogin POST helpers and detail mapping", async () => {
    listProfilesMock.mockResolvedValue({
      list: [
        { id: "ml-1", title: "Profile 1" },
        { id: "ml-2", title: "Profile 2" },
      ],
    });

    getProfileDetailMock
      .mockResolvedValueOnce({
        id: "ml-1",
        title: "Profile 1",
        fingerprint: { userAgent: "ua-1" },
        proxy: { protocol: "http", host: "proxy-1", port: 8001 },
      })
      .mockResolvedValueOnce({
        id: "ml-2",
        title: "Profile 2",
        fingerprint: { userAgent: "ua-2" },
        proxy: { protocol: "http", host: "proxy-2", port: 8002 },
      });

    mapMostLoginProfileMock
      .mockReturnValueOnce({
        patchrightProfile: {
          id: "ml-1",
          name: "Profile 1",
          config: { userAgent: "ua-1", locale: "en-US" },
        },
        launchArgs: ["--flag-1"],
        initScriptFlags: { canvasNoise: true },
        initScript: "window.__profile='ml-1';",
      })
      .mockReturnValueOnce({
        patchrightProfile: {
          id: "ml-2",
          name: "Profile 2",
          config: { userAgent: "ua-2", locale: "de-DE" },
        },
        launchArgs: ["--flag-2"],
        initScriptFlags: { canvasNoise: false },
        initScript: "window.__profile='ml-2';",
      });

    const { loadFromMostLogin } = await import(
      "../../src/profiles/sources/mostlogin"
    );
    const result = await loadFromMostLogin();

    expect(listProfilesMock).toHaveBeenCalledWith(1, 100);
    expect(getProfileDetailMock).toHaveBeenCalledTimes(2);
    expect(getProfileDetailMock).toHaveBeenNthCalledWith(1, "ml-1");
    expect(getProfileDetailMock).toHaveBeenNthCalledWith(2, "ml-2");
    expect(mapMostLoginProfileMock).toHaveBeenCalledTimes(2);
    expect(result.catalog.source).toBe("mostlogin");
    expect(result.catalog.profiles[0]).toMatchObject({
      id: "ml-1",
      name: "Profile 1",
      source: "mostlogin",
      sessionStatePolicy: "identity-sticky",
      mostloginProxy: { protocol: "http", host: "proxy-1", port: 8001 },
      launchArgs: ["--flag-1"],
      initScript: "window.__profile='ml-1';",
    });
    expect(result.catalog.profiles[1]).toMatchObject({
      id: "ml-2",
      mostloginProxy: { protocol: "http", host: "proxy-2", port: 8002 },
      launchArgs: ["--flag-2"],
    });
  });
});
