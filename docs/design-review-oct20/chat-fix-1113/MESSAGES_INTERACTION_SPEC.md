# Messages: Interaction Spec (Oct 20, 2026)
Goal: Messages works like a normal chat app, exactly like LINE / Instagram DM. This file says how each part **behaves**. Looks are in `chat-rebuild/BUILD_PACKET_CHAT_CALENDAR.md` and the mockups (01–04); this file does not change them.

Based on: `chat-rebuild/BUILD_PACKET_CHAT_CALENDAR.md` (incl. CHANGE 2026-10-20, Translate on long-press), `chat-rebuild/research/CHAT_CALENDAR_PATTERNS.md`, mockups 01–04, and the code on `feat/design-a1` @ b0910ba: `apps/mobile/app/messages/[id].tsx` (305 lines), `app/(tabs)/messages.tsx` (220), `src/lib/messaging.ts` (168).

Rules: neutral colours only (packet tokens `chat.day` / `chat.night`; only BrandLogo is coloured). Fonts and sizes unchanged (Manrope, theme.ts). Nothing goes to a client without an explicit Approve or Send tap. Every row is proven per STRICT_UI_CHECKLIST §2.9 (390 pt recording or screenshot sequence, Day and Night, real build).

Shared timing: press feedback ≤ 100 ms; springs `snappy` (damping 26, stiffness 380); cross-fades 150–250 ms; Reduce Motion → plain fades. Haptics: light impact on long-press, selection tick on tab change, success on message sent. Nothing else.

---

## A. Inbox — `app/(tabs)/messages.tsx`

| # | Interaction | Trigger | What happens | Timing / animation | Haptic | States | How to prove |
|---|---|---|---|---|---|---|---|
| A1 | Open a thread | Tap a row (whole 76 pt row) | Opens `/messages/[id]` (push). Row's unread dot clears on return (server `markThreadRead`). | Row highlight grey on press; push slide 350 ms native | none | unread / read | Recording: tap → thread → back, dot gone |
| A2 | Swipe left: Done / Archive | Drag row left | Two actions show under the row: **Done** and **Archive**. Full swipe (> 60 % width) runs Done. Row slides out; toast "Marked done · Undo" (5 s). Uses `updateThread({status:'done'})` / `({archived:true})`. | Follows finger; snaps back if < threshold; row collapse 200 ms | light tick when passing the threshold | idle / open / done / failed (row comes back + "Couldn't save · Try again") | Recording: partial swipe snaps back, full swipe + Undo restores |
| A3 | Swipe right: Read / Unread | Drag row right | One action: **Unread** (if read) or **Read** (if unread). Dot toggles at once, saved via `updateThread({unread})`. | Same as A2 | light tick at threshold | read / unread / failed (reverts) | Recording: toggle, leave tab, come back, still right |
| A4 | Row menu | Long-press a row 450 ms | Native context menu, row lifts, background blurs: **Pin**, **Mute**, **Mark unread**, **Link to client** (or "Open client" if linked). Tap outside closes. | Lift 200 ms spring | light impact on open | — | Recording of each item working |
| A5 | Pull to refresh | Pull list down | System spinner; calls the existing pull-to-refresh import (messaging.ts:117, read only) + reload. Line under the title then reads **"Updated just now"**, later "Updated 2 min ago" (ticks each minute). Drop the "· refresh every 5 minutes" text. | Native RefreshControl; stops when done or after 15 s with an error line | none | refreshing / done / failed ("Couldn't update · Try again") / offline (no spinner, offline line) | Recording: pull, line changes |
| A6 | Platform tabs | Tap a tab (All, LINE, Instagram, Facebook, TikTok; 5 equal) | List filters at once; selected tab shown. A tab whose platform is **not connected** shows an honest empty state: "Instagram isn't connected" + **Connect** button. TikTok: "TikTok doesn't share DMs with apps" (no fake list). A connected-but-broken platform shows one 44 pt inline banner "Needs reconnect · Fix". | Cross-fade 150 ms | selection tick | connected / not connected / needs reconnect | Screenshot per tab, Day + Night |
| A7 | Search | Tap search icon | Field opens under the header with keyboard up. Results filter live on each letter (name + last message), matched text in 600 weight. Clear (×) empties; Cancel closes and restores the list. No results: "No messages match 'xx'". | Field slides in 200 ms; results ≤ 150 ms after typing | none | empty query / results / no results | Recording: type "Yu" → Yuki Sato shows |
| A8 | Empty | No threads at all | Existing EmptyState: "No messages yet" + Connect (if no accounts). No card. | — | none | — | Screenshot |
| A9 | Loading | First open | Skeleton of 76 pt rows (existing Skeleton, height 76). | Fade to content 150 ms | none | — | Recording of first open |
| A10 | Error | Load fails | ErrorState with friendly words + **Try again** that reloads. | — | none | — | Recording with API down |
| A11 | Offline | No network | Last loaded list stays visible; one line "You're offline · showing last update". Pull shows no endless spinner. Swipes and menu that need network are disabled and say why. | — | none | — | Recording in airplane mode, then back online |

## B. Thread — `app/messages/[id].tsx`

| # | Interaction | Trigger | What happens | Timing / animation | Haptic | States | How to prove |
|---|---|---|---|---|---|---|---|
| B1 | Opens at newest | Open thread | Inverted FlatList: newest message at the bottom, no jump (delete `onContentSizeChange scrollToEnd`, :171). | No visible scroll on open | none | loading (bubble skeleton) / ready / error | Recording: open a 50-message thread, no jump |
| B2 | Load older | Scroll to top | Loads the next 30 older messages; small spinner at top; position kept (no jump). "Start of conversation" at the very top. | — | none | loading older / end / failed ("Couldn't load older · Retry") | Recording |
| B3 | Bubble grouping | — | Same sender < 3 min apart = one cluster: 2 pt gap, grouped corners 6, avatar + time only on last bubble. Day separator "Today" / "Yesterday" / date. | — | — | — | Screenshot of a mixed thread |
| B4 | Photo full screen | Tap a photo bubble | Opens full-screen viewer on black: pinch-zoom (to 4×), double-tap zoom, swipe down to close, Save / Share in "…". | Zoom-from-bubble 250 ms; drag-down to dismiss | none | loading (blur) / failed ("Photo unavailable") | Recording: open, pinch, swipe down |
| B5 | Bubble menu | Long-press a bubble 450 ms | Native context menu, bubble lifts, background blurs: **Translate**, **Copy**, **Reply**, **Link to client**. | Lift 200 ms spring | light impact | — | Recording each item |
| B6 | Translate | Menu → Translate | Translates into the **app language** (EN UI → English, JP UI → Japanese) via `translateClientMessage(ws, id, appLang)` (code now hard-codes `'en'`, :187 — must change). Shows a 12/16 muted line under that bubble with **"Show original"** / "Show translation" toggle. Only that message; stays until toggled. No automatic translation lines anymore (remove the auto block :257 and the "Translate" link :261). | Line fades in 150 ms; "Translating…" placeholder | none | translating / shown / original / failed ("Couldn't translate · Retry") | Recording in EN and in JP UI |
| B7 | Copy | Menu → Copy | Copies bubble text; toast "Copied". | Toast 1.5 s | none | — | Recording + paste in Notes |
| B8 | Reply (quote) | Menu → Reply, or swipe a bubble right | Reply box gets a quote bar ("Replying to Yuki: …", ×) and focuses; keyboard opens. | Swipe: bubble follows finger, a reply arrow appears; runs past 60 pt; snaps back 200 ms | light tick at threshold | quoting / cancelled | Recording of both ways |
| B9 | Link to client | Menu → Link to client | Sheet to pick/create a client; header avatar/name updates; person icon then opens `/clients/:id`. | Sheet 300 ms | success on linked | — | Recording |
| B10 | Swipe back | Swipe from left edge, or back chevron (44×44) | Back to inbox; draft text in the reply box is kept for that thread. | Follows finger; half swipe cancels | none | — | Recording incl. half swipe |
| B11 | Keyboard | Tap reply box | Keyboard rises; reply bar pinned right above it; list stays at the same message (bottom stays bottom). Tap on the list or drag down closes the keyboard (interactive dismiss). | Moves with the keyboard curve (no lag, no gap) | none | — | Recording at 390 pt, Day + Night |
| B12 | Reply box grows | Type long text | Field grows 36 pt → max 5 lines (≈120 pt), then scrolls inside. Return adds a new line (does not send). | Height animates with the text | none | — | Recording |
| B13 | Send button | — | Grey disabled until there is non-space text; active neutral circle ↑ then. Tap = the same confirm as Approve (code: `dialog.confirm`, :122). Shows the meaning first if the text is in another language (B17). | Press dim; text clears on send | success when the server says sent | disabled / ready / sending | Recording |
| B14 | Message status | After send | Under Angel's last bubble only: **Sending…** → **Sent** (→ **Read hh:mm** when the server has it). On failure: **Not sent · Retry** (tap Retry re-sends). Uses the real server result (`approve-send` returns `delivery: 'sent' \| 'manual'`, message `status`). **LINE is ON in staging:** remove `LINE_SEND_OFF` (:23) and its banner (:181) so LINE goes live when `thread.delivery === 'live'`. IG/FB stay manual: status "Ready · Copy & open". | Status fades 150 ms | success on Sent; none on failure | sending / sent / read / not sent / manual-ready | Recording on staging with a test LINE contact: Sending → Sent; and airplane mode → Not sent → Retry → Sent |
| B15 | AI draft card | Tap sparkle (or a draft exists) | Card docked above the reply box ("AI draft · in Japanese"). **Approve** → confirm → sends (same path as B14). **Edit** → puts the text in the reply box, card closes. **Copy & open** → copies then opens IG / FB / LINE app (fix `copyAndOpen`, messaging.ts:132: native must copy with Clipboard then `Linking.openURL`, not the Share sheet). | Card slides up 250 ms; collapses on use | success on sent | writing ("Writing…") / ready / failed ("Couldn't write a draft · Retry") | Recording of each button |
| B16 | Draft translation | Long-press draft or tap "Translate" | Shows its meaning in the app language (as B6). | as B6 | light impact | — | Recording |
| B17 | Japanese approval safety | Approve / Send when the text is in another language than the app | The confirm shows the meaning **before** sending: "You'll send: [JP text] · Means: [EN]". If the meaning isn't loaded yet, it loads first; Approve is disabled until it shows. | — | — | loading meaning / ready | Recording EN UI with JP draft |
| B18 | New message arrives | Incoming while open | At bottom: bubble appears, stays at bottom. Scrolled up: list does not move; a **"New messages ↓"** pill shows above the reply bar; tap scrolls to newest and hides it. Thread marked read only when seen. | Bubble fade+rise 200 ms; pill fade 150 ms | none | at bottom / scrolled up | Recording with a test message from staging |
| B19 | Error | Thread fails to load | ErrorState + Try again (exists, :89). | — | none | — | Recording |
| B20 | Offline | No network | "You're offline" line under the header; history stays; Send works as **queued**: bubble shows "Waiting for connection", sends on reconnect (or Not sent · Retry). AI draft, Translate disabled with reason. | — | none | offline / reconnecting | Airplane-mode recording |
| B21 | JP / EN strings | Switch app language | Every new string has JP and EN (Sending… / 送信中…, Sent / 送信済み, Not sent · Retry / 未送信・再送信, Translate / 翻訳, Show original / 原文を表示, Copy / コピー, Reply / 返信, Link to client / お客様にリンク, New messages / 新着メッセージ, Updated 2 min ago / 2分前に更新, You're offline / オフラインです). Casual natural JP. | — | — | — | Screenshots in both languages |
| B22 | VoiceOver | VoiceOver on | Bubble reads "Yuki Sato, 10:14, [text], Sent". Custom actions on bubble: Translate, Copy, Reply, Link to client. Rows: Done, Archive, Read/Unread, Pin, Mute. Icon buttons labelled (Back, Client profile, AI draft, Send). Pill: "New messages, button". | — | — | — | VoiceOver recording |
| B23 | Dynamic Type | XL / AX1 | Bubbles grow, reply bar grows, nothing cut. | — | — | — | Screenshots |

## C. New to the screen map — needs Angel's approval
1. Full-screen photo viewer (B4) — new screen/modal.
2. "Link to client" picker sheet (A4, B9) — new sheet.
3. Inbox row long-press menu with **Pin** and **Mute** (A4) — Pin/Mute are new features; the API (`updateThread`) has only status / archived / unread. Needs server fields.
4. Reply quote bar (B8) — new; server has no reply-to field yet.
5. "New messages" pill (B18), Undo toast (A2), offline line (A11, B20) — new small elements.
6. Load older messages (B2) — needs a paged messages endpoint (today the thread loads all at once).
7. Offline send queue (B20) — new behaviour.

## D. Gaps found in the code (for the Builder, not done here)
- `LINE_SEND_OFF = true` ([id].tsx:23) blocks LINE even though staging is live. Remove; use `thread.delivery`.
- Translate is hard-coded to English (:187); must use the app language. Auto translation block (:257) must go.
- `copyAndOpen` on native opens the Share sheet; it doesn't copy and open (messaging.ts:141).
- `scrollToEnd` on content change (:171) causes jumps; use inverted FlatList.
- Inbox uses `ScrollView` + Card rows; no swipe or long-press exists yet.
- package.json has `expo-haptics` and `react-native-reanimated`, but no `@react-native-community/netinfo` (offline), no `expo-clipboard` (copy), no explicit `react-native-gesture-handler` (swipes) and no zoom viewer. Adding them is a new dependency → needs sign-off.
