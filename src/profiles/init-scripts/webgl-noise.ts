export function buildWebGLNoise(opts: { noiseLevel?: number }): string {
  const level = opts.noiseLevel ?? 0.01;
  return `(function(){
  const origReadPixels = WebGLRenderingContext.prototype.readPixels;
  WebGLRenderingContext.prototype.readPixels = function(...args) {
    origReadPixels.apply(this, args);
    const pixels = args[6];
    if (pixels instanceof Uint8Array) {
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = Math.max(0, Math.min(255, pixels[i] + Math.floor((Math.random() - 0.5) * ${level} * 255)));
      }
    }
  };
})();`;
}
