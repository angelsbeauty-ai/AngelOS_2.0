# Messages fix pass — 20 Oct 2026

Branch: feat/design-a1. No push to main. No EAS. No migrations. META_MESSAGING_SEND_ENABLED stays off.

## Fixed

1. Night mode — no white chips, search, pressed rows or cards in Messages. Bell dot has no white ring.
2. First platform tab starts fully at the 20 pt inset (not cut off on the left).
3. Conversation is a real chat: shared title (28/36), newest at the bottom, reply box pinned above the keyboard, dark cards in Night.
4. TikTok tab stays and says honestly that TikTok messages aren't connected.
5. "Updated … · Instagram and Messenger refresh every 5 minutes." line in the inbox.
6. Unread dot and a separate "Needs reply" tag.
7. Day separators (Today / Yesterday).
8. Photos render in the thread when the message has an image URL.
9. "Open client" link on a conversation that has a client.
10. Hard-coded English in the thread and new-conversation screens now goes through i18n (EN + JP).
11. Text can grow past 1.3× (the cap is removed on these screens).
12. Translate link uses a neutral muted colour, not blue.
13. LINE send stays off: confirm copy says nothing is sent, and the bubble shows "Not sent".

## Proof

Day and Night 390 pt (@3x, 1170×2532) screenshots in this folder:
- inbox-day@3x.png / inbox-night@3x.png
- inbox-tiktok-day@3x.png / inbox-tiktok-night@3x.png
- conversation-day@3x.png / conversation-night@3x.png
- new-conversation-day@3x.png / new-conversation-night@3x.png

## Not built — marked NEW on the screen map

- Pin / important on a row.
- Link an unknown sender to a new or existing client from the thread.
- Full photo viewer (photos show inline only).
- Swipe actions and long-press menus on rows or bubbles.

## Left

- Real-device screenshots beside the night mockups (these proofs are layout proofs at 390 pt).
- VoiceOver labels on every icon-only control.
- Dynamic Type XL device check.
