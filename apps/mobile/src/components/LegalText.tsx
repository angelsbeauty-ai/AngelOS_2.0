import { Text, View } from 'react-native';
import { Screen } from './Screen';
import { ScreenTitle, ui } from './ui';
import { PushedHeader } from './PushedHeader';
import { useAppearance } from '../design/appearance';

/** Minimal markdown display (headings, bullets, paragraphs) for the legal pages. */
export function LegalText({ markdown, title }: { markdown: string; title: string }) {
  const { mode, palette } = useAppearance();
  const color = mode === 'night' ? '#F4F4F5' : ui.colors.primaryText;
  const blocks = markdown.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return <Screen>
    <PushedHeader title={title} />
    <View style={{ paddingHorizontal: 4, gap: 16 }}>
      {blocks.map((block, i) => {
        const heading = /^#{1,6}\s+/.exec(block);
        const text = block.replace(/^#{1,6}\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1');
        return <View key={i}><Text selectable style={heading ? { fontSize: 19, fontWeight: '700', color, marginTop: 6 } : { fontSize: 16, lineHeight: 25, color: mode === 'night' ? '#C7C7CC' : color }}>{text}</Text></View>;
      })}
    </View>
  </Screen>;
}
