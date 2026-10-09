# AngelOS: three softer palettes for Option A

Same Option A layout. **Only the colour tokens change.** All names in the pictures are sample names.

Pictures: `palette-1.png`, `palette-2.png`, `palette-3.png` (each shows Splash, Today, Clients, Calendar).

**Logo:** the original **charcoal** logo reads best on all three. It is the strongest contrast, and it keeps the brand mark unchanged. A tinted cocoa version looked muddy on the nude backdrops, so no tinted logo is used.

**Status colours** are the same in all three palettes, so they always mean the same thing: sage green = success, ochre amber = warning, true red = error. Each one has a clearly different hue. The accent is a soft, muted rose or nude. The error red is much brighter, so the two are not mixed up. Status is never shown by colour alone: there is always a word ("Confirmed", "Unconfirmed") or an icon too.

**Recommendation: Palette 1, Blush Nude.** It is feminine but still neutral, it feels like the nude pigments and skin tones of Angel's own work, and the charcoal logo and text stay crisp. Palette 3 is the most romantic. Palette 2 is the most "quiet luxury".

---

## Palette 1: Blush Nude
*Warm skin-tone nude with a soft blush glow, like a clean beauty studio.*

| Role | Hex |
|---|---|
| Background (screen / backdrop base) | `#F3E9E3` |
| Surface (cards, lists, used at 84%) | `#FCF8F5` |
| Raised surface (menus, sheets, solid fallback) | `#FFFDFB` |
| Text primary | `#2E2421` |
| Text secondary | `#685750` |
| Hairline / border | `rgba(46,36,33,0.14)` |
| Accent (selected tab, links, today marker) | `#8C5A52` |
| Accent pressed | `#71463F` |
| Glass tint (floating glass, about 32-56% over blur) | `#FAEDE6` |
| Success | `#366A49` |
| Warning | `#8A5A00` |
| Error | `#B3261E` |

Contrast (surface = `#FCF8F5` at 84% over the background, i.e. about `#FBF6F2`):

| Pair | Ratio | WCAG |
|---|---|---|
| Text primary on surface | 14.1:1 | pass (AA 4.5) |
| Text secondary on surface | 6.4:1 | pass (AA 4.5) |
| Text primary on background | 12.6:1 | pass (AA 4.5) |
| Text secondary on background | 5.7:1 | pass (AA 4.5) |
| Accent text on surface | 5.3:1 | pass (AA 4.5) |
| Button label (surface colour) on text-primary fill | 14.3:1 | pass (AA 4.5) |
| Success text on its 10% tag tint | 5.1:1 | pass (AA 4.5) |
| Warning text on its 10% tag tint | 4.8:1 | pass (AA 4.5) |
| Error text on its 10% tag tint | 5.2:1 | pass (AA 4.5) |
| Accent text on its 10% tint | 4.6:1 | pass (AA 4.5) |

Hints and disabled text (text primary at 45%) are decorative and exempt from AA. Text sitting directly on the silk backdrop (date line, "42 people") was not measured, because the backdrop changes from place to place. The silk image is a later batch anyway (A1 uses a solid background).

**Drop-in for `apps/mobile/src/design/theme.ts`** (BUILD_PACKET_A1, step 2). Replace the line `const charcoal = '#1E2122';` and the whole `color: { ... },` object inside `tokens` with this:
```ts
// Palette 1 "Blush Nude" – source: angelos-designer/PALETTES.md
const charcoal = '#2E2421';                     // text primary (key name kept so other files compile)
// inside `export const tokens = {`:
  color: {
    charcoal,                                    // text, main buttons
    charcoal2: '#685750',                     // text secondary
    charcoal3: 'rgba(46,36,33,0.45)',          // hints, disabled
    ivory: 'rgba(252,248,245,0.84)',         // surface: cards and lists
    ivorySolid: 'rgba(252,248,245,0.94)',    // Reduce Transparency / Android fallback
    raised: '#FFFDFB',                     // menus, sheets (solid)
    pearl: '#F3E9E3',                          // screen background
    tide: '#8C5A52',                          // ACCENT: selected tab, links (key name kept)
    accentPressed: '#71463F',
    coral: '#B3261E',                         // ERROR / destructive: Cancel (key name kept)
    success: '#366A49',
    warning: '#8A5A00',
    error: '#B3261E',
    glassTint: '#FAEDE6',                   // tint for GlassView/BlurView fallback
    seaGlass: '#685750',                      // legacy key, neutral now
    hairline: 'rgba(46,36,33,0.14)',
    onCharcoal: '#FCF8F5',                // text on charcoal buttons
  },
```
And in the same file, replace the two compatibility lines inside `lightCompat`:
```ts
  softGold: 'rgba(140,90,82,0.12)',
  success: tokens.color.success, warning: tokens.color.warning, critical: tokens.color.error,
```

---

## Palette 2: Greige & Rose Gold
*Soft stone greige with a warm rose-gold accent, quiet and expensive.*

| Role | Hex |
|---|---|
| Background (screen / backdrop base) | `#ECE7E1` |
| Surface (cards, lists, used at 84%) | `#FAF8F5` |
| Raised surface (menus, sheets, solid fallback) | `#FFFFFF` |
| Text primary | `#2A2725` |
| Text secondary | `#625B56` |
| Hairline / border | `rgba(42,39,37,0.14)` |
| Accent (selected tab, links, today marker) | `#8C5547` |
| Accent pressed | `#72443A` |
| Glass tint (floating glass, about 32-56% over blur) | `#F3EDE7` |
| Success | `#366A49` |
| Warning | `#8A5A00` |
| Error | `#B3261E` |

Contrast (surface = `#FAF8F5` at 84% over the background, i.e. about `#F8F5F2`):

| Pair | Ratio | WCAG |
|---|---|---|
| Text primary on surface | 13.7:1 | pass (AA 4.5) |
| Text secondary on surface | 6.1:1 | pass (AA 4.5) |
| Text primary on background | 12.1:1 | pass (AA 4.5) |
| Text secondary on background | 5.4:1 | pass (AA 4.5) |
| Accent text on surface | 5.5:1 | pass (AA 4.5) |
| Button label (surface colour) on text-primary fill | 14.0:1 | pass (AA 4.5) |
| Success text on its 10% tag tint | 5.1:1 | pass (AA 4.5) |
| Warning text on its 10% tag tint | 4.8:1 | pass (AA 4.5) |
| Error text on its 10% tag tint | 5.1:1 | pass (AA 4.5) |
| Accent text on its 10% tint | 4.8:1 | pass (AA 4.5) |

Hints and disabled text (text primary at 45%) are decorative and exempt from AA. Text sitting directly on the silk backdrop (date line, "42 people") was not measured, because the backdrop changes from place to place. The silk image is a later batch anyway (A1 uses a solid background).

**Drop-in for `apps/mobile/src/design/theme.ts`** (BUILD_PACKET_A1, step 2). Replace the line `const charcoal = '#1E2122';` and the whole `color: { ... },` object inside `tokens` with this:
```ts
// Palette 2 "Greige & Rose Gold" – source: angelos-designer/PALETTES.md
const charcoal = '#2A2725';                     // text primary (key name kept so other files compile)
// inside `export const tokens = {`:
  color: {
    charcoal,                                    // text, main buttons
    charcoal2: '#625B56',                     // text secondary
    charcoal3: 'rgba(42,39,37,0.45)',          // hints, disabled
    ivory: 'rgba(250,248,245,0.84)',         // surface: cards and lists
    ivorySolid: 'rgba(250,248,245,0.94)',    // Reduce Transparency / Android fallback
    raised: '#FFFFFF',                     // menus, sheets (solid)
    pearl: '#ECE7E1',                          // screen background
    tide: '#8C5547',                          // ACCENT: selected tab, links (key name kept)
    accentPressed: '#72443A',
    coral: '#B3261E',                         // ERROR / destructive: Cancel (key name kept)
    success: '#366A49',
    warning: '#8A5A00',
    error: '#B3261E',
    glassTint: '#F3EDE7',                   // tint for GlassView/BlurView fallback
    seaGlass: '#625B56',                      // legacy key, neutral now
    hairline: 'rgba(42,39,37,0.14)',
    onCharcoal: '#FAF8F5',                // text on charcoal buttons
  },
```
And in the same file, replace the two compatibility lines inside `lightCompat`:
```ts
  softGold: 'rgba(140,85,71,0.12)',
  success: tokens.color.success, warning: tokens.color.warning, critical: tokens.color.error,
```

---

## Palette 3: Pearl Rose
*Luminous pearl and ivory with a dusty-rose accent, gentle and bridal-clean.*

| Role | Hex |
|---|---|
| Background (screen / backdrop base) | `#F5EFEC` |
| Surface (cards, lists, used at 84%) | `#FDFBF9` |
| Raised surface (menus, sheets, solid fallback) | `#FFFFFF` |
| Text primary | `#2C2527` |
| Text secondary | `#665A5E` |
| Hairline / border | `rgba(44,37,39,0.13)` |
| Accent (selected tab, links, today marker) | `#94566A` |
| Accent pressed | `#7A4557` |
| Glass tint (floating glass, about 32-56% over blur) | `#F8EEEE` |
| Success | `#366A49` |
| Warning | `#8A5A00` |
| Error | `#B3261E` |

Contrast (surface = `#FDFBF9` at 84% over the background, i.e. about `#FCF9F7`):

| Pair | Ratio | WCAG |
|---|---|---|
| Text primary on surface | 14.3:1 | pass (AA 4.5) |
| Text secondary on surface | 6.3:1 | pass (AA 4.5) |
| Text primary on background | 13.2:1 | pass (AA 4.5) |
| Text secondary on background | 5.8:1 | pass (AA 4.5) |
| Accent text on surface | 5.3:1 | pass (AA 4.5) |
| Button label (surface colour) on text-primary fill | 14.5:1 | pass (AA 4.5) |
| Success text on its 10% tag tint | 5.3:1 | pass (AA 4.5) |
| Warning text on its 10% tag tint | 4.9:1 | pass (AA 4.5) |
| Error text on its 10% tag tint | 5.3:1 | pass (AA 4.5) |
| Accent text on its 10% tint | 4.6:1 | pass (AA 4.5) |

Hints and disabled text (text primary at 45%) are decorative and exempt from AA. Text sitting directly on the silk backdrop (date line, "42 people") was not measured, because the backdrop changes from place to place. The silk image is a later batch anyway (A1 uses a solid background).

**Drop-in for `apps/mobile/src/design/theme.ts`** (BUILD_PACKET_A1, step 2). Replace the line `const charcoal = '#1E2122';` and the whole `color: { ... },` object inside `tokens` with this:
```ts
// Palette 3 "Pearl Rose" – source: angelos-designer/PALETTES.md
const charcoal = '#2C2527';                     // text primary (key name kept so other files compile)
// inside `export const tokens = {`:
  color: {
    charcoal,                                    // text, main buttons
    charcoal2: '#665A5E',                     // text secondary
    charcoal3: 'rgba(44,37,39,0.45)',          // hints, disabled
    ivory: 'rgba(253,251,249,0.84)',         // surface: cards and lists
    ivorySolid: 'rgba(253,251,249,0.94)',    // Reduce Transparency / Android fallback
    raised: '#FFFFFF',                     // menus, sheets (solid)
    pearl: '#F5EFEC',                          // screen background
    tide: '#94566A',                          // ACCENT: selected tab, links (key name kept)
    accentPressed: '#7A4557',
    coral: '#B3261E',                         // ERROR / destructive: Cancel (key name kept)
    success: '#366A49',
    warning: '#8A5A00',
    error: '#B3261E',
    glassTint: '#F8EEEE',                   // tint for GlassView/BlurView fallback
    seaGlass: '#665A5E',                      // legacy key, neutral now
    hairline: 'rgba(44,37,39,0.13)',
    onCharcoal: '#FDFBF9',                // text on charcoal buttons
  },
```
And in the same file, replace the two compatibility lines inside `lightCompat`:
```ts
  softGold: 'rgba(148,86,106,0.12)',
  success: tokens.color.success, warning: tokens.color.warning, critical: tokens.color.error,
```

---

## How to swap (for Gordon)
- Edit **only** `apps/mobile/src/design/theme.ts`. Pick one palette block above and keep every other line (type, space, radius, shadow, glass, motion, dark block) as it is.
- Keys keep their old names (`tide`, `coral`, `charcoal`, `pearl`, `ivory`), so the other files (`ui.tsx`, `Screen.tsx`, `_layout.tsx`, the tabs `tintColor`) compile untouched. What changes is the meaning: `tide` is now the accent, and `coral` is now the error/destructive colour. New keys added: `raised`, `accentPressed`, `success`, `warning`, `error`, `glassTint`.
- **No new native build, just a JS reload** (`r` in the Expo terminal, or a restart with `npx expo start --dev-client -c`). `theme.ts` is plain JavaScript and the tab `tintColor` is a JS prop. This holds **once the A1 development build (step 1) is installed**. The swap adds no packages and does not touch `app.json`.
- Things the swap does **not** change (they would need native config, so a new build): the native splash screen background and the app icon in `app.json`. On iOS 26 the system tab bar takes its glass colour from what is behind it, so it will pick up the new background by itself.
- BUILD_PACKET_A1 says "there's no amber, so warning uses coral, don't invent a colour". These palettes **add a real warning colour on purpose** (Angel asked for distinct status colours), so that note no longer applies once a palette is chosen. The packet's "coral banner" on the demo screen will show in the error red, which is fine.
- Optional, still the same file: set `glass.highlightTop` and `highlightAll` to white as they are now (no change needed).

## Not verified
- I only read the token block in BUILD_PACKET_A1.md, not the real `theme.ts` in the repo. If Gordon's file differs from the packet, match the key names by hand.
- If any screen used `tokens.color.coral` to mean "warning" (for example "Unconfirmed"), it will now show error red. Search for `coral` and switch those uses to `tokens.color.warning`. That would be a small edit outside `theme.ts`.
- I did not check how the glass tint looks through the real GlassView (the system mixes it); the tints are subtle starting points.
- Contrast was calculated from flat colours, not measured on a phone.
