# Design review fixes — 20 Oct 2026

Branch: feat/design-a1. No push to main. No EAS build started from this pass.

## Fixed in code

1. **Night white slabs** — Shared `Card`, `ListRow`, `TextField` and `SilkBackground` follow the night palette. New `NightSafe` helper for search bars and menus.
2. **One title** — `PushedHeader`: one Messages-style title, no ghost.
3. **Back chevron** — 36pt glass button, bold chevron, visible Day and Night.
4. **Friendly errors** — Login, Signup, Assistant and Messages use `toFriendly` / `humanMessage`.
5. **Login / Signup Night** — Both follow the theme and use the shiny rose-gold logo.
6. **Assistant and Plan** — Both render content or a clear fallback. Not blank.
7. **Calendar** — Plain + (no circle). Booking blocks are neutral (`#151515`). Week/Month already apply night glass. Contrast still needs a device check.
8. **Privacy** — No `[FILL IN]` in the live text.

## Still open (needs device proof or per-screen wiring)

- 390pt Day + Night screenshots beside mockups, saved in this folder.
- Wire `NightSafe` into Messages search/menu, Analytics picker, and any screen that still hardcodes `#FFFFFF` in its own StyleSheet.
- Chip row inset snap on Messages and Founder (first chip whole, 20pt inset).
- JP copy review and VoiceOver labels on every icon-only button.

## Locked and not touched

Profile and Analytics layouts, Messages title style, fonts/sizes/weights, neutral colours, logo button, plain Calendar +, Messages platform tabs, voice orb, react-native-webrtc 124.0.8, reanimated/worklets pins, LiveKit removed.
