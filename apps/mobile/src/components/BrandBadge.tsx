import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { InstagramLogo } from 'phosphor-react-native/src/icons/InstagramLogo';
import { MessengerLogo } from 'phosphor-react-native/src/icons/MessengerLogo';
import { FacebookLogo } from 'phosphor-react-native/src/icons/FacebookLogo';
import { TiktokLogo } from 'phosphor-react-native/src/icons/TiktokLogo';
import { tokens } from '../design/theme';

/** Small brand-colored platform badge (Instagram gradient, Messenger blue, LINE green, TikTok black). */
export function BrandBadge({ platform, size = 20 }: { platform: string; size?: number }) {
  const g = Math.round(size * 0.62);
  const ring = { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 };
  if (platform === 'instagram') return <View style={[styles.ring, ring]}><View style={{ width: size, height: size }}>
    <Svg width={size} height={size} style={StyleSheet.absoluteFill as never}><Defs><LinearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor="#FEDA75" /><Stop offset="0.35" stopColor="#FA7E1E" /><Stop offset="0.6" stopColor="#D62976" /><Stop offset="0.85" stopColor="#962FBF" /><Stop offset="1" stopColor="#4F5BD5" /></LinearGradient></Defs><Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#ig)" /></Svg>
    <View style={styles.overlay}><InstagramLogo size={g} color="#FFF" weight="bold" /></View></View></View>;
  const bg = platform === 'facebook' ? '#0084FF' : platform === 'line' ? '#06C755' : platform === 'tiktok' ? '#000000' : '#8E8E8E';
  return <View style={[styles.ring, ring]}><View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
    {platform === 'facebook' ? <MessengerLogo size={g} color="#FFF" weight="fill" /> : platform === 'tiktok' ? <TiktokLogo size={g} color="#FFF" weight="fill" /> : platform === 'line' ? <Text style={[styles.line, { fontSize: size * 0.32 }]}>LINE</Text> : <FacebookLogo size={g} color="#FFF" weight="fill" />}
  </View></View>;
}

/** Round profile photo with an initial fallback and the platform badge bottom-right. */
export function ContactAvatar({ name, uri, platform, size = 64 }: { name: string; uri?: string | null; platform?: string; size?: number }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return <View style={{ width: size, height: size }} accessibilityElementsHidden>
    {uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#EFEFEF' }} />
      : <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#EFEFEF' }]}><Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text></View>}
    {platform ? <View style={{ position: 'absolute', right: -4, bottom: -4 }}><BrandBadge platform={platform} /></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  ring: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  line: { color: '#FFF', fontFamily: tokens.font.uiBold, letterSpacing: -0.3 },
  initial: { fontFamily: tokens.font.uiSemibold, color: '#262626' }
});
