# Design review fixes — 20 Oct 2026

Branch: feat/design-a1. No push to main. No EAS build started from this pass.

## Fixed in code (ready for rebuild)

1. **Night white slabs** — Shared Card, ListRow, TextField, SilkBackground follow night. NightSafe for search, menus, error text.
2. **Messages** — Search, menus, chips and empty states use NightSafe. Chip row starts at the 20pt inset.
3. **Analytics** — Picker, menu, cards, tabs and tiles follow night.
4. **One title + back chevron** — PushedHeader on Account, Help, Feedback, Privacy, Terms, Edit profile and Founder.
5. **Friendly errors** — Login, Signup, Assistant, Messages, Clients use toFriendly.
6. **Login / Signup** — Night theme + shiny rose-gold logo.
7. **Assistant and Plan** — Both render content or a clear fallback.
8. **Calendar** — Plain + , neutral blocks, night glass on Week/Month.
9. **Privacy** — No [FILL IN] text. Long text, no white card.
10. **Clients** — Search and rows already night-aware.

## Still open

- 390pt Day + Night screenshots beside mockups in this folder.
- JP copy review and VoiceOver labels on every icon-only button.

## Locked and not touched

Profile and Analytics layouts, Messages title style, fonts/sizes/weights, neutral colours, logo button, plain Calendar +, Messages platform tabs, voice orb, react-native-webrtc 124.0.8, reanimated/worklets pins, LiveKit removed.
