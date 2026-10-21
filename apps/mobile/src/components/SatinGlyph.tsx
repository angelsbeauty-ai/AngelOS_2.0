import { SvgXml } from 'react-native-svg';

/** Satin Line utility glyphs (same drawing rules as TabGlyph: 24pt grid, stroke 1.6, round caps and joins). */
const S = 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const PATHS = {
  clock: `<circle cx="12" cy="12" r="7.6" ${S}/><path d="M12 8v4.2l2.8 1.8" ${S}/>`,
  play: `<path d="M8.6 6.4v11.2c0 .6.7 1 1.2.7l8.4-5.6c.5-.3.5-1 0-1.4L9.8 5.7c-.5-.3-1.2.1-1.2.7z" ${S}/>`,
  carousel: `<rect x="4" y="7.4" width="11.6" height="12.4" rx="2.6" ${S}/><path d="M8.4 4.2h8.8a2.8 2.8 0 0 1 2.8 2.8v9" ${S}/>`,
  story: `<path d="M12 4.4a7.6 7.6 0 1 1-7.1 4.9" ${S}/><path d="M6.3 6.3" ${S}/><circle cx="12" cy="12" r="3.2" ${S}/>`,
  grid: `<rect x="4.4" y="4.4" width="6.2" height="6.2" rx="1.6" ${S}/><rect x="13.4" y="4.4" width="6.2" height="6.2" rx="1.6" ${S}/><rect x="4.4" y="13.4" width="6.2" height="6.2" rx="1.6" ${S}/><rect x="13.4" y="13.4" width="6.2" height="6.2" rx="1.6" ${S}/>`,
  list: `<path d="M9 7h10.4M9 12h10.4M9 17h10.4" ${S}/><circle cx="5" cy="7" r=".9" fill="currentColor"/><circle cx="5" cy="12" r=".9" fill="currentColor"/><circle cx="5" cy="17" r=".9" fill="currentColor"/>`,
  caretDown: `<path d="M7 10l5 5 5-5" ${S}/>`,
  pencil: `<path d="M15.4 5.6l3 3L9 18H6v-3z" ${S}/>`
} as const;
export type SatinGlyphName = keyof typeof PATHS;

export function SatinGlyph({ name, color, size = 20 }: { name: SatinGlyphName; color: string; size?: number }) {
  return <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${PATHS[name]}</svg>`} width={size} height={size} color={color} />;
}
