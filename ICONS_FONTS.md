# Icons and fonts for AngelOS (greige palette 2)

Same Option A layout and the same palette. Only the icons or the fonts change. All names are sample names.

Pictures: `icons-1.png`, `icons-2.png`, `icons-3.png`, `fonts-1.png`, `fonts-2.png`, `fonts-3.png`, and the recommended combination `combo-recommended.png`.

---

## Icons: three styles
All three come from **Phosphor Icons**: one family with six weights and 1,500+ icons, **MIT licence** (free for App Store apps). In React Native: **`phosphor-react-native`** (npm 3.0.6, MIT), which draws with **`react-native-svg`**. Its README documents `weight="duotone"`, `duotoneColor` and `duotoneOpacity`.

| # | Style | Feel | How |
|---|---|---|---|
| 1 | **Refined duotone** | Charcoal outline with a soft rose-gold inner tone. Calm, precise, a little jewellery-like. | `weight="duotone"`, `color={charcoal}`, `duotoneColor="#B98474"`, `duotoneOpacity={0.45}`. Active: `color={accent}`, opacity 0.6 |
| 2 | **Filled-soft, rose-gold active** | Soft filled shapes in warm taupe; the active tab fills in rose gold. Friendly and tactile. | `weight="fill"`, inactive `#A0968F`, active `accent #8C5547` |
| 3 | **Beauty line** | Fine-line icons with beauty meanings: sunrise for Today, lotus for Clients, a heart calendar, the PMU pen for Academy, plus eye (brows), drop (aftercare), sparkle (touch-up). | `weight="light"`, charcoal; active accent |

I picked "beauty line" over "SF Symbols with glass". The native glass tab bar already gives SF Symbols with glass for free, and it would look like every other iOS app. Beauty line is more distinctive and still buildable from the same MIT set.

**Recommendation: 1, Refined duotone.** It is the most premium and distinctive. The rose-gold inner tone ties the icons to the accent and the rose-gold logo without shouting, and every icon stays clear at small sizes. Option 3's metaphors are charming, but a lotus for "Clients" or a pen for "Academy" is less obvious to new users. Use beauty icons as accents instead (service chips: brows, lips, aftercare), not for navigation.

**Where icons can and can't change (important):**
- **Inside screens** (header buttons, empty states, lists, the custom fallback menus): Phosphor works fully.
- **Native tab bar** (Expo Router native tabs, used in BUILD_PACKET_A1): it takes SF Symbol names (`sf`) or images (`src`). It cannot draw SVG components. To use duotone there, export each icon as PNG at 3x and pass `src={{ default, selected }}` with `renderingMode="original"` (both are documented for SDK 55-57). Otherwise iOS tints them one colour and the duotone is lost. Alternative: keep SF Symbols in the native tab bar (most native) and use duotone everywhere else.
- **Native context menus** (`@expo/ui` ContextMenu) use SF Symbol names only. Phosphor can't go there.

## Fonts: three pairings
All are Google Fonts under the **SIL Open Font License 1.1** (free to embed in App Store apps). The `@expo-google-fonts/*` npm packages are "MIT AND OFL-1.1" (the code is MIT, the fonts OFL). Load them with `useFonts` from **`expo-font`**, which A1 step 1 already adds.

| # | Pairing | Feel | Packages (npm versions checked during this work) |
|---|---|---|---|
| 1 | **Couture: Cormorant Garamond + Manrope** | Classic, couture, very feminine. Fine high-contrast serif titles; a soft geometric sans for everything you read. | `@expo-google-fonts/cormorant-garamond` 0.4.1, `@expo-google-fonts/manrope` 0.4.2 |
| 2 | **Soft editorial: Fraunces + DM Sans** | Warm and modern; a soft, rounded serif with a friendly sans. | `@expo-google-fonts/fraunces` 0.4.1, `@expo-google-fonts/dm-sans` 0.4.2 |
| 3 | **Fashion: Bodoni Moda + Jost** | Magazine-cover glamour; a crisp Didone serif with a clean geometric sans. | `@expo-google-fonts/bodoni-moda` 0.4.2, `@expo-google-fonts/jost` 0.4.2 |

**Recommendation: 1, Cormorant Garamond + Manrope.** It is the most feminine and high-end, and clearly not the "Inter look". The `@expo-google-fonts` static files look the same as in the mockup. Manrope is very readable for names, times and money.

Caveats:
- Cormorant is delicate, so use it only at 22 pt and up (titles, hero time, section headers, greeting). Never use it for body text.
- Turn on lining numbers (`fontVariant: ['lining-nums', 'tabular-nums']`). Otherwise "10:00" shows old-style figures. That bug was visible in the first render and is fixed.
- Pairing 2: the mockup used Fraunces's "SOFT" axis, but **the expo-google-fonts package only ships static weights (no SOFT or optical-size axes)**, so the app would look sharper than `fonts-2.png`.
- Pairing 3: Bodoni Moda's static files (BodoniModa_400Regular to 900Black) don't use the display optical size, so thin lines may look heavier or less refined than in `fonts-3.png`. Not verified on a device.

**Japanese text:** none of these fonts include Japanese glyphs. On iOS, missing characters normally fall back to the system Japanese font (Hiragino Sans). On Android they fall back to Noto Sans CJK. The mockup shows such a fallback sample (田中 優希). The result works, but its weight and baseline won't match exactly. If Angel writes many names in kanji, two options:
- Render name fields in the system font.
- Add a matching Japanese font: e.g. `@expo-google-fonts/zen-kaku-gothic-new` (sans) or `@expo-google-fonts/shippori-mincho` (serif), both OFL. These files are several MB each, which affects app size. Package names not checked on npm.

Fallback behaviour inside React Native `Text` with a custom `fontFamily` was not tested on a device.

---

## Exact changes for Gordon (all in `apps/mobile/src/design/theme.ts`, plus font loading)

**1. Packages** (from `apps\mobile`):
```
npx expo install @expo-google-fonts/cormorant-garamond @expo-google-fonts/manrope phosphor-react-native react-native-svg
```

**2. Add to `tokens` in theme.ts:**
```ts
  font: {
    display: 'CormorantGaramond_600SemiBold',        // titles 34+, hero time, section headers
    displayMedium: 'CormorantGaramond_500Medium',
    displayItalic: 'CormorantGaramond_500Medium_Italic', // greeting name
    ui: 'Manrope_400Regular',
    uiMedium: 'Manrope_500Medium',
    uiSemibold: 'Manrope_600SemiBold',
    uiBold: 'Manrope_700Bold',
  },
  numerals: ['lining-nums', 'tabular-nums'] as const,
  icon: { weight: 'duotone' as const, duotoneColor: '#B98474', duotoneOpacity: 0.45, activeDuotoneOpacity: 0.6, size: 24 },
```
And update the type styles in the same file. With custom fonts, `fontWeight` does not pick the weight; the family name does.
```ts
    largeTitle: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 40, lineHeight: 44 },
    heroTime:   { fontFamily: 'CormorantGaramond_500Medium',   fontSize: 60, lineHeight: 64, fontVariant: ['lining-nums','tabular-nums'] },
    title2:     { fontFamily: 'Manrope_600SemiBold', fontSize: 22, lineHeight: 28 },
    headline:   { fontFamily: 'Manrope_600SemiBold', fontSize: 17, lineHeight: 22 },
    body:       { fontFamily: 'Manrope_400Regular',  fontSize: 17, lineHeight: 22 },
    subhead:    { fontFamily: 'Manrope_400Regular',  fontSize: 15, lineHeight: 20 },
    footnote:   { fontFamily: 'Manrope_500Medium',   fontSize: 13, lineHeight: 18 },
    overline:   { fontFamily: 'Manrope_600SemiBold', fontSize: 12, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
```
Large title goes from 34 to 40 because Cormorant has a small x-height. Check that titles still fit at 130% text size.

**3. Load fonts once in `app/_layout.tsx`:**
```tsx
import { useFonts, CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
// const [loaded] = useFonts({ ...all of the above }); keep the splash screen up until `loaded`.
```

**4. Icons in screens:**
```tsx
import { House, UsersThree, CalendarBlank, GraduationCap, ChatCircle, UserPlus } from 'phosphor-react-native';
<ChatCircle size={tokens.icon.size} weight="duotone" color={tokens.color.charcoal} duotoneColor={tokens.icon.duotoneColor} duotoneOpacity={tokens.icon.duotoneOpacity} />
```
Tab bar: keep `sf` names, or use exported PNGs (see above).

## Does it need a new build?
- **Fonts: no**, if the A1 build (with `expo-font`) is installed. Google font files are JS assets loaded at runtime with `useFonts`, so a JS reload is enough. (They would need a build only if embedded with the expo-font config plugin.)
- **Icons: yes, unless `react-native-svg` is already in the installed build.** It is native code, and BUILD_PACKET_A1 does not list it. I could not check the repo. **Best:** if the A1 development build hasn't been made yet, add `react-native-svg` and `phosphor-react-native` to step 1 so there's only one build. `phosphor-react-native` itself is JS.
- **Icon PNGs in the native tab bar:** images in the JS bundle; JS reload. (`xcasset` icons would need a build.)
- **Metal app icon and splash:** `app.json`, so a new build.

## Recommended combo (`combo-recommended.png`)
Option A layout + Greige & Rose Gold (palette 2) + **rose-gold metal logo on the icon and splash only** (flat charcoal in the app) + **refined duotone icons** + **Cormorant Garamond / Manrope**.

## Not verified
- Japanese fallback inside RN `Text` with custom fonts (not tested on a device). Zen Kaku / Shippori package names were not checked.
- That Bodoni Moda and Fraunces static files look like the variable-font mockups (they probably won't exactly).
- Whether `react-native-svg` is already in the repo or build.
- How Phosphor PNGs look in the iOS 26 native glass tab bar with `renderingMode="original"` (the selected-state contrast on glass).
