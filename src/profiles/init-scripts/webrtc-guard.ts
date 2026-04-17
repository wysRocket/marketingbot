export function buildWebRTCGuard(_opts: Record<string, unknown>): string {
  return `(function(){
  const OrigRTCPeerConnection = window.RTCPeerConnection;
  if (!OrigRTCPeerConnection) return;
  window.RTCPeerConnection = function(config) {
    if (config && config.iceServers) {
      config.iceServers = [];
    }
    return new OrigRTCPeerConnection(config);
  };
  window.RTCPeerConnection.prototype = OrigRTCPeerConnection.prototype;
})();`;
}
