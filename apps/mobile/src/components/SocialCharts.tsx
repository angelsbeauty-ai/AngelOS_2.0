import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { tokens } from '../design/theme';

/** Hand-rolled react-native-svg charts (no extra native deps). Style: 2.2 pt round lines, rose 22%→0% area, two hairlines, end dot. */
export const ROSE = '#8C5547';
const INK50 = 'rgba(42,39,37,0.5)';

function points(values: number[], w: number, h: number, pad = 4) {
  const max = Math.max(...values, 1); const min = Math.min(...values, 0); const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => [pad + i * step, pad + (h - pad * 2) * (1 - (v - min) / span)] as const);
}
const pathOf = (pts: ReadonlyArray<readonly [number, number]>) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export function Sparkline({ values, width = 70, height = 26, color = ROSE }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  return <Svg width={width} height={height}><Path d={pathOf(points(values, width, height, 2))} stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" /></Svg>;
}

export function AreaLine({ values, width, height = 120, labels, area = true }: { values: number[]; width: number; height?: number; labels?: string[]; area?: boolean }) {
  if (values.length < 2) return null;
  const pts = points(values, width, height, 8); const d = pathOf(pts); const last = pts[pts.length - 1];
  return <View>
    <Svg width={width} height={height}>
      <Defs><LinearGradient id="g" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={ROSE} stopOpacity={0.22} /><Stop offset="1" stopColor={ROSE} stopOpacity={0} /></LinearGradient></Defs>
      <Line x1={0} x2={width} y1={height * 0.33} y2={height * 0.33} stroke="rgba(42,39,37,0.08)" strokeWidth={1} />
      <Line x1={0} x2={width} y1={height * 0.66} y2={height * 0.66} stroke="rgba(42,39,37,0.08)" strokeWidth={1} />
      {area ? <Path d={`${d} L${last[0]},${height} L${pts[0][0]},${height} Z`} fill="url(#g)" /> : null}
      <Path d={d} stroke={ROSE} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={4.5} fill="#FFF" stroke={ROSE} strokeWidth={2} />
    </Svg>
    {labels ? <AxisLabels labels={labels} /> : null}
  </View>;
}

export function Bars({ values, width, height = 110, labels }: { values: number[]; width: number; height?: number; labels?: string[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1); const best = values.indexOf(Math.max(...values)); const slot = width / values.length; const bw = Math.max(2, slot * 0.62);
  return <View>
    <Svg width={width} height={height}>
      <Line x1={0} x2={width} y1={height * 0.5} y2={height * 0.5} stroke="rgba(42,39,37,0.08)" strokeWidth={1} />
      {values.map((v, i) => { const h = Math.max(v > 0 ? 3 : 1, (height - 4) * (v / max)); return <Rect key={i} x={i * slot + (slot - bw) / 2} y={height - h} width={bw} height={h} rx={Math.min(3, bw / 2)} fill={ROSE} opacity={i === best && v > 0 ? 1 : 0.35} />; })}
    </Svg>
    {labels ? <AxisLabels labels={labels} /> : null}
  </View>;
}

function AxisLabels({ labels }: { labels: string[] }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>{labels.map((l, i) => <Text key={i} style={{ fontFamily: tokens.font.ui, fontSize: 11, color: INK50, fontVariant: ['tabular-nums'] }}>{l}</Text>)}</View>;
}

/** 7 × 8 heatmap, rose at 6–94% opacity, best slot outlined in ink. */
export function Heatmap({ grid, best, dayLabels, slotLabels, width }: { grid: number[][]; best: { day: number; slot: number } | null; dayLabels: string[]; slotLabels: string[]; width: number }) {
  const max = Math.max(...grid.flat(), 1); const left = 26; const cell = (width - left) / 8; const gap = 3;
  return <View>
    <View style={{ flexDirection: 'row', marginLeft: left }}>{slotLabels.map((l, i) => <Text key={i} style={{ width: cell, textAlign: 'center', fontFamily: tokens.font.ui, fontSize: 10, color: INK50 }}>{l}</Text>)}</View>
    {grid.map((row, d) => <View key={d} style={{ flexDirection: 'row', alignItems: 'center', marginTop: gap }}>
      <Text style={{ width: left, fontFamily: tokens.font.ui, fontSize: 11, color: INK50 }}>{dayLabels[d]}</Text>
      {row.map((v, s) => { const isBest = best && best.day === d && best.slot === s;
        return <View key={s} style={{ width: cell - gap, height: cell * 0.62, marginRight: gap, borderRadius: 6, backgroundColor: `rgba(140,85,71,${(0.06 + 0.88 * (v / max)).toFixed(2)})`, borderWidth: isBest ? 2 : 0, borderColor: '#262626' }} />; })}
    </View>)}
  </View>;
}
