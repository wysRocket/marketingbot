export function buildAudioNoise(opts: { noiseLevel?: number }): string {
  const level = opts.noiseLevel ?? 0.002;
  return `(function(){
  const origGetChannelData = AudioBuffer.prototype.getChannelData;
  AudioBuffer.prototype.getChannelData = function(channel) {
    const data = origGetChannelData.call(this, channel);
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i] + (Math.random() - 0.5) * ${level};
    }
    return data;
  };
})();`;
}
