import type { ProfileSource, ResolveProfileSourceInput } from "./types";

export function resolveProfileSource(
  input: ResolveProfileSourceInput,
): ProfileSource {
  if (input.requestedSource === "generator") {
    return "generator";
  }

  if (input.mostloginAvailable) {
    return "mostlogin";
  }

  if (input.snapshotAvailable) {
    return "snapshot";
  }

  if (input.environment === "production" && !input.allowGeneratorFallback) {
    throw new Error(
      "Refusing silent generator fallback in production without ALLOW_GENERATOR_FALLBACK=1",
    );
  }

  return "generator";
}
