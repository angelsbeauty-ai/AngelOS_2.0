import { Text, View } from 'react-native';
import { Screen } from './Screen';
import { Card, ui } from './ui';

/** Minimal markdown display (headings, bullets, paragraphs) for the bundled legal drafts. */
export function LegalText({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return <Screen><Card>{blocks.map((block, i) => {
    const heading = /^#{1,6}\s+/.exec(block);
    const text = block.replace(/^#{1,6}\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1');
    return <View key={i} style={{ marginBottom: ui.spacing.sm }}><Text selectable style={heading ? { fontSize: 18, fontWeight: '700', color: ui.colors.primaryText } : { fontSize: 15, lineHeight: 22, color: ui.colors.primaryText }}>{text}</Text></View>;
  })}</Card></Screen>;
}
