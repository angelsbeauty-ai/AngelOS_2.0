import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { tokens } from '../design/theme';

/** Official-style brand marks drawn as SVG (not generic icons). `messenger` is used for Facebook conversations. */
export function BrandLogo({ platform, size = 20 }: { platform: string; size?: number }) {
  const id = `g${platform}${size}`;
  if (platform === 'instagram') return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Defs><LinearGradient id={id} x1="0.1" y1="1" x2="0.9" y2="0"><Stop offset="0" stopColor="#FEDA75" /><Stop offset="0.3" stopColor="#FA7E1E" /><Stop offset="0.6" stopColor="#D62976" /><Stop offset="0.8" stopColor="#962FBF" /><Stop offset="1" stopColor="#4F5BD5" /></LinearGradient></Defs>
    <Rect x="0" y="0" width="24" height="24" rx="6.5" fill={`url(#${id})`} />
    <Rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#FFF" strokeWidth="1.9" />
    <Circle cx="12" cy="12" r="3.3" fill="none" stroke="#FFF" strokeWidth="1.9" /><Circle cx="16.4" cy="7.6" r="1.05" fill="#FFF" /></Svg>;
  if (platform === 'messenger') return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Defs><LinearGradient id={id} x1="0.2" y1="1" x2="0.8" y2="0"><Stop offset="0" stopColor="#0099FF" /><Stop offset="0.6" stopColor="#A033FF" /><Stop offset="0.9" stopColor="#FF5280" /><Stop offset="1" stopColor="#FF7061" /></LinearGradient></Defs>
    <Path d="M12 1.5C6.1 1.5 1.5 5.8 1.5 11.6c0 3 1.2 5.7 3.3 7.5v3.4l3.1-1.7c1.3.4 2.6.6 4.1.6 5.9 0 10.5-4.3 10.5-10.1S17.9 1.5 12 1.5z" fill={`url(#${id})`} />
    <Path d="M5.7 14.6l3.4-5.4c.5-.9 1.7-1.1 2.5-.5l2.7 2 2.7-2.1c.4-.3.9.2.6.6l-3.4 5.4c-.5.9-1.7 1.1-2.5.5l-2.7-2-2.7 2.1c-.4.3-.9-.2-.6-.6z" fill="#FFF" /></Svg>;
  if (platform === 'facebook') return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="12" fill="#0866FF" />
    <Path d="M13.4 24v-8.4h2.8l.5-3.3h-3.3v-2.1c0-.9.5-1.8 1.9-1.8h1.5V5.6s-1.3-.2-2.6-.2c-2.7 0-4.4 1.6-4.4 4.6v2.3H6.9v3.3h2.9V24z" fill="#FFF" /></Svg>;
  if (platform === 'line') return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 1.6C5.6 1.6.6 5.7.6 10.8c0 4.5 4 8.3 9.4 9.1.4.1.9.3 1 .6.1.3.1.7 0 1l-.2 1c0 .3-.2 1.2 1 .6 1.3-.5 6.8-4 9.3-6.9 1.7-1.9 2.5-3.8 2.5-5.4 0-5.1-5-9.2-11.6-9.2z" fill="#06C755" />
    <SvgText x="12" y="13.6" fontSize="6.6" fontWeight="bold" fill="#FFF" textAnchor="middle" fontFamily="Arial">LINE</SvgText></Svg>;
  if (platform === 'tiktok') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="12" fill="#000" />
    <Path d="M15.6 5.5c.4 1.6 1.5 2.7 3.1 2.9v2.4c-1.1 0-2.2-.3-3.1-.9v4.7c0 2.6-2.1 4.6-4.7 4.6s-4.6-2-4.6-4.6 2.3-4.8 5-4.5v2.5c-1.2-.4-2.6.5-2.6 2 0 1.2.9 2.1 2.2 2.1 1.2 0 2.2-.9 2.2-2.2V5.5z" fill="#FFF" /></Svg>;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#766E64' }} />;
}

/** Brand logo with a thin white ring, for the bottom-right of avatars. Facebook threads are Messenger conversations. */
export function BrandBadge({ platform, size = 20 }: { platform: string; size?: number }) {
  return <View style={[styles.ring, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}><BrandLogo platform={platform === 'facebook' ? 'messenger' : platform} size={size} /></View>;
}

/** Round profile photo with an initial fallback and the platform badge bottom-right. */
export function ContactAvatar({ name, uri, platform, size = 64 }: { name: string; uri?: string | null; platform?: string; size?: number }) {
  const parts = name.replace(/^[^\p{L}]+/u, '').trim().split(/\s+/).filter(Boolean);
  const initial = (parts.length > 1 ? (parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '') : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
  return <View style={{ width: size, height: size }} accessibilityElementsHidden>
    {uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F2F2F2' }} />
      : <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#EDEDED' }]}><Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text></View>}
    {platform ? <View style={{ position: 'absolute', right: -3, bottom: -3 }}><BrandBadge platform={platform} size={Math.round(size * 0.32)} /></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  ring: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  line: { color: '#FFF', fontFamily: tokens.font.uiBold, letterSpacing: -0.3 },
  initial: { fontFamily: tokens.font.uiSemibold, color: '#151515' }
});
