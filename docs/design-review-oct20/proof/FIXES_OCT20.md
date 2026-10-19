# Design review fixes — 20 Oct 2026

Branch: feat/design-a1. No push to main. No EAS build started from this pass.

## Fixed in code (ready for rebuild)

1. **Night white slabs** — Shared Card, ListRow, TextField, SilkBackground follow night. NightSafe helper for search, menus, error text.
2. **Messages** — Search bar, filter menu, more menu, chips and empty states use NightSafe. Chip row starts at the 20pt inset.
3. **Analytics** — Picker button, platform menu, cards, tabs and top-content tiles follow night. No white slabs.
4. **One title + back chevron** — PushedHeader ready for pushed screens.
5. **Friendly errors** — Login, Signup, Assistant, Messages, Clients use toFriendly.
6. **Login / Signup** — Night theme + shiny rose-gold logo.
7. **Assistant and Plan** — Both render content or a clear fallback.
8. **Calendar** — Plain + , neutral blocks, night glass on Week/Month.
9. **Privacy** — No [FILL IN] text.
10. **Clients** — Search and rows already night-aware.

## Still open

- 390pt Day + Night screenshots beside mockups in this folder.
- Wire PushedHeader into remaining pushed screens that still show a double title.
- JP copy review and VoiceOver labels on every icon-only button.

## Locked and not touched

Profile and Analytics layouts, Messages title style, fonts/sizes/weights, neutral colours, logo button, plain Calendar +, Messages platform tabs, voice orb, react-native-webrtc 124.0.8, reanimated/worklets pins, LiveKit removed.
