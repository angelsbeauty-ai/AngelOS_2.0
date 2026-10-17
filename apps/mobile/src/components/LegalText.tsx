import { Text, View } from 'react-native';
import { Screen } from './Screen';
import { Card, ScreenTitle, ui } from './ui';
import { useAppearance } from '../design/appearance';

/** Minimal markdown display (headings, bullets, paragraphs) for the legal pages. */
export function LegalText({ markdown, title }: { markdown: string; title: string }) {
  const { mode } = useAppearance();
  const color = mode === 'night' ? '#F4F4F5' : ui.colors.primaryText;
  const blocks = markdown.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return <Screen><ScreenTitle>{title}</ScreenTitle><Card>{blocks.map((block, i) => {
    const heading = /^#{1,6}\s+/.exec(block);
    const text = block.replace(/^#{1,6}\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1');
    return <View key={i} style={{ marginBottom: ui.spacing.sm }}><Text selectable style={heading ? { fontSize: 18, fontWeight: '700', color } : { fontSize: 15, lineHeight: 22, color }}>{text}</Text></View>;
  })}</Card></Screen>;
}
