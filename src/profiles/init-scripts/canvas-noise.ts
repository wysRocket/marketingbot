export function buildCanvasNoise(opts: { noiseLevel?: number }): string {
  const level = opts.noiseLevel ?? 0.05;
  return `(function(){
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(...args) {
    const data = origGetImageData.apply(this, args);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i]   = Math.max(0, Math.min(255, data.data[i]   + Math.floor((Math.random() - 0.5) * ${level} * 255)));
      data.data[i+1] = Math.max(0, Math.min(255, data.data[i+1] + Math.floor((Math.random() - 0.5) * ${level} * 255)));
      data.data[i+2] = Math.max(0, Math.min(255, data.data[i+2] + Math.floor((Math.random() - 0.5) * ${level} * 255)));
    }
    return data;
  };
})();`;
}
