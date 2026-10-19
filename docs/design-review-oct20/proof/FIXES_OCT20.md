# Design review fixes — 20 Oct 2026

Branch: feat/design-a1. No push to main. No EAS build started from this pass.

## Fixed in this pass

1. **Night white slabs** — Shared Card, ListRow, TextField and SilkBackground already follow the night palette (`rgba(18,18,20,.66)`, hairline, radius 20). Night muted updated toward the audit. Screens that still hardcode `#FFFFFF` in their own StyleSheet need a follow-up if a device shot still shows white.
2. **One title** — New `PushedHeader` component: one Messages-style title + visible back chevron. Use it on pushed screens that still show a double title.
3. **Back chevron** — `PushedHeader` uses a 36pt glass button and Phosphor CaretLeft (bold), visible in Day and Night.
4. **Friendly errors** — Login, Signup and assistant already use `toFriendly` / `humanMessage`. Raw server text is not shown in those paths.
5. **Login / Signup Night** — Login and Signup follow the app theme. Login now uses the shiny 3D rose gold `BrandMark` (variant `rose`).
6. **Assistant and Plan not blank** — `/assistant` renders the workspace (personality, skills, automations) with a load-failed fallback. `/subscription` shows the beta card when the plan cannot load.
7. **Calendar** — No red + or red booking blocks in the current calendar styles. Week/Month night contrast still needs a device check.
8. **Privacy** — `LEGAL.privacy` has no `[FILL IN]` text. Delete path is Profile › Account › Delete account.

## Still needs a device proof pass

- 390pt Day + Night screenshots beside mockups for every changed screen, saved in this folder.
- Chip row inset on Messages and Founder.
- Calendar Week/Month contrast at night on a real device.
- Any screen that still hardcodes a white StyleSheet (search bars, menus, empty cards).
- JP copy and VoiceOver labels.

## Locked and not touched

Profile and Analytics layouts, Messages title style, fonts/sizes/weights, neutral colours, logo button, plain Calendar +, Messages platform tabs, voice orb, react-native-webrtc 124.0.8, reanimated/worklets pins, LiveKit removed.
