import { buildCanvasNoise } from "./canvas-noise";
import { buildWebGLNoise } from "./webgl-noise";
import { buildAudioNoise } from "./audio-noise";
import { buildHardwareConcurrency } from "./hardware-concurrency";
import { buildWebRTCGuard } from "./webrtc-guard";

export {
  buildCanvasNoise,
  buildWebGLNoise,
  buildAudioNoise,
  buildHardwareConcurrency,
  buildWebRTCGuard,
};

export interface InitScriptFlags {
  canvasNoise?: boolean;
  webglNoise?: boolean;
  audioNoise?: boolean;
  hardwareConcurrency?: number;
  webrtcGuard?: boolean;
}

export function buildInitScript(flags: InitScriptFlags): string {
  const parts: string[] = [];

  if (flags.canvasNoise) {
    parts.push(buildCanvasNoise({ noiseLevel: 0.05 }));
  }
  if (flags.webglNoise) {
    parts.push(buildWebGLNoise({ noiseLevel: 0.01 }));
  }
  if (flags.audioNoise) {
    parts.push(buildAudioNoise({ noiseLevel: 0.002 }));
  }
  if (typeof flags.hardwareConcurrency === "number" && flags.hardwareConcurrency > 0) {
    parts.push(buildHardwareConcurrency({ value: flags.hardwareConcurrency }));
  }
  if (flags.webrtcGuard) {
    parts.push(buildWebRTCGuard({}));
  }

  return parts.join("\n");
}
