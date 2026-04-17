export function buildHardwareConcurrency(opts: { value: number }): string {
  return `(function(){
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => ${opts.value},
    configurable: true,
  });
})();`;
}
