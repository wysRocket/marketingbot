import { describe, expect, it } from "vitest";
import {
  buildCanvasNoise,
  buildWebGLNoise,
  buildAudioNoise,
  buildHardwareConcurrency,
  buildWebRTCGuard,
  buildInitScript,
} from "../../src/profiles/init-scripts/index";

describe("buildCanvasNoise", () => {
  it("returns a non-empty JS string", () => {
    const script = buildCanvasNoise({ noiseLevel: 0.05 });
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(10);
  });
});

describe("buildWebGLNoise", () => {
  it("returns a non-empty JS string", () => {
    const script = buildWebGLNoise({ noiseLevel: 0.01 });
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(10);
  });
});

describe("buildAudioNoise", () => {
  it("returns a non-empty JS string", () => {
    const script = buildAudioNoise({ noiseLevel: 0.002 });
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(10);
  });
});

describe("buildHardwareConcurrency", () => {
  it("overrides hardwareConcurrency to a fixed value", () => {
    const script = buildHardwareConcurrency({ value: 8 });
    expect(script).toContain("8");
  });
});

describe("buildWebRTCGuard", () => {
  it("returns a non-empty JS string", () => {
    const script = buildWebRTCGuard({});
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(10);
  });
});

describe("buildInitScript", () => {
  it("concatenates all component scripts", () => {
    const flags = {
      canvasNoise: true,
      webglNoise: false,
      audioNoise: true,
      hardwareConcurrency: 4,
      webrtcGuard: true,
    };
    const script = buildInitScript(flags);
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(20);
  });

  it("returns empty string when no flags are set", () => {
    const script = buildInitScript({});
    expect(script).toBe("");
  });
});
