const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/** LiveKit's WebRTC builds an NSDictionary with dataChannel.protocol. The default is nil, and iOS kills the app. */
const FILE = 'node_modules/@livekit/react-native-webrtc/ios/RCTWebRTC/WebRTCModule+RTCDataChannel.m';

function patch(source) {
  return source
    .replace('@"protocol" : dataChannel.protocol,', '@"protocol" : dataChannel.protocol ?: @"",')
    .replace('@"label" : dataChannel.label,', '@"label" : dataChannel.label ?: @"",')
    .replace('@"state" : [self stringForDataChannelState:channel.readyState]', '@"state" : [self stringForDataChannelState:channel.readyState] ?: @"connecting"')
    .replace('return nil;\n}\n\n#pragma mark - DataChannelWrapperDelegate methods', 'return @"connecting";\n}\n\n#pragma mark - DataChannelWrapperDelegate methods');
}

function withWebRtcDataChannelFix(config) {
  return withDangerousMod(config, ['ios', (config) => {
    const roots = [config.modRequest.projectRoot, path.resolve(config.modRequest.projectRoot, '../..')];
    for (const root of roots) {
      const file = path.join(root, FILE);
      if (!fs.existsSync(file)) continue;
      const source = fs.readFileSync(file, 'utf8');
      const next = patch(source);
      if (next !== source) fs.writeFileSync(file, next);
      break;
    }
    return config;
  }]);
}

module.exports = withWebRtcDataChannelFix;
