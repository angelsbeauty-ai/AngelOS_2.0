# Messages — BUILD COPY SPEC (copy LINE / IG DM / iMessage)
Oct 20 2026 · branch feat/design-a1 · read-only audit, no code changed.
Mockups: `out/*.png` (1170x2532, Day + Night). Side-by-side: `compare/*.png`. Source HTML: `html/`, generator `gen.py`.
Refs + URLs: `refs/` and `refs/SOURCES.txt`.

## 0. Angel's hard rule (overrides everything)
The messages fill the screen. Under the messages there is ONE slim input bar: 44–52pt plus the home-indicator safe area (34pt).
Nothing else sits above it. No Saved replies button, no Approve button, no cards, no banners, no action-button row.
The AI draft shows only as one small chip (30pt) just above the bar, plus the draft text inside the field. It can be closed (×).
With the keyboard open, at least 4–5 messages stay visible. The mockup shows 7 bubbles (`out/chat-keyboard-*.png`).

Space budget on a 390x844pt iPhone, keyboard open: status 47 + header 52 + bar 48 + keyboard with suggestions 336 = 483 → **361pt for messages** (5–7 bubbles).

## 1. Measurements (pt). These are estimates from the store screenshots, give or take 2–3pt, scaled to a 390pt-wide screen.
| Item | AngelOS value | Source / evidence |
|---|---|---|
| Chat header (below the status bar) | **52**, hairline bottom border 0.5 | IG DM thread ≈ 50–56 (refs/ig_dm_thread.png); WhatsApp ≈ 52 (refs/whatsapp_thread.png); LINE ≈ 48 (refs/line_chatroom.png) |
| Header contents | back chevron 26 inside a 44 hit box · avatar **36** · platform logo **15** as a badge on the avatar · name 16/700 · one line below 12/500 muted · info (i) 24 inside a 44 hit box | IG DM: back, avatar, name, then actions (ig_dm_thread); WhatsApp: name plus subline (whatsapp_thread) |
| Inbox large title | "Messages" 24/800 in a 52 row, compose icon on the right | WhatsApp "Chats" (whatsapp_chats.png) |
| Inbox search | height **36**, radius 10, 16pt placeholder | LINE 検索 bar ≈ 36 (refs/line_chatlist.jpg); WhatsApp |
| Platform tabs | chips 32 tall, radius 16, 13/600, 4 gap, selected one filled. Order: All / Instagram / Facebook / LINE / TikTok | WhatsApp All/Unread/Groups chips (whatsapp_chats) |
| Inbox row | **72** tall, avatar **56**, platform badge 18 at bottom right, name 16/600 (700 when unread), preview 14/500 one line, time 12 top right | WhatsApp row ≈ 72–76, avatar ≈ 52–56 (whatsapp_chats); LINE row ≈ 64–68, avatar ≈ 48 (line_chatlist) |
| Unread badge | 20 tall, at least 20 wide, radius 10, 12/700, neutral (text colour on bg colour), right-aligned under the time | WhatsApp green count badge (whatsapp_chats), made neutral here |
| Bubble | radius **18**, padding 8 top/bottom and 12 left/right, 16/500 with 21 line height, **max width 264** (about 68% of 390) | IG ≈ radius 18–20, max width ≈ 70% (ig_dm_thread); iMessage ≈ 18 (imessage_keyboard) |
| Grouping | **2** between bubbles from the same sender, **8** when the sender changes. Small 28 avatar only on the last incoming bubble of a group | IG DM "It was so good!"/"Wanna go…" pair (ig_dm_thread) |
| Day separator | 12/600 muted, centred, 6 above and 10 below | LINE "Today" pill (line_chatroom) |
| Read status | "Seen 10:31", 11/500, under Angel's last bubble on the right | IG "Seen by…" (ig_dm_thread) |
| Input bar | **48** = field 36 plus 6+6 padding, then 34 safe area when the keyboard is closed | LINE ≈ 44–48 (line_chatroom); IG ≈ 44 (ig_dm_thread); iMessage field ≈ 36 (imessage_keyboard) |
| Bar icons, keyboard closed | **+** at x≈24, **camera** at x≈64, field from x≈88 to x≈350, **mic** at x≈366 | LINE: + / camera / image / field / mic (line_chatroom); WhatsApp: + / field / camera / mic (whatsapp_thread) |
| Bar icons while typing | camera hidden, **+** stays on the left, mic turns into a **send** arrow (36 circle, filled) | iMessage: + / field / send (imessage_keyboard) |
| Keyboard | the bar sits directly on the keyboard (336 including the QuickType row). The list stays pinned to the newest message. Header always stays visible. Dragging the list down closes the keyboard (interactive dismiss) | iMessage (imessage_keyboard); standard iOS behaviour |
| Long press | the background blurs (6) and dims. The chosen bubble lifts in place, reactions pill above it, menu 250 wide, rows 44, radius 14: **Translate / Copy / Reply / Link to client** | iOS context menu (iMessage / WhatsApp) |
| AI draft | chip 30 tall, radius 15, 13/600: "✦ AI suggestion · tap send to approve" plus ×. The draft text goes inside the field (field can grow to about 3 lines), with a muted 12pt English meaning under Japanese. **One send arrow = approve and send** | IG / Gmail-style suggested reply. No direct ref, so this is our pattern made to look like it |

## 2. Colours and type (locked)
Manrope everywhere, with Noto Sans CJK JP as the fallback for Japanese.
Night: page #000, bars #0B0B0C, other person's bubble #262628 with #F5F5F7 text, Angel's bubble #E5E5E7 with #111 text, field #1C1C1E.
Day: page #F3F3F3, bars #FFF, other person's bubble #FFF, Angel's bubble #E5E5E7 with #111 text, field #EDEDEF.
Neutral colours only. The only colours are the brand logos (IG gradient, LINE #06C755, FB #0866FF, TikTok).
Note: in Day, the #E5E5E7 bubble on #F3F3F3 is soft but still readable (see compare/chat-empty-day.png). If Angel wants more contrast, use #DCDCDF, but only with her yes.

## 3. Components
- **`src/components/ChatBar.tsx` exists but nothing uses it.** It is the right base: TextInput (minHeight 40, maxHeight 120, radius 20) plus send. Changes needed:
  - minHeight 36, radius 18, no border
  - add `+` and camera on the left; camera hides while typing
  - mic when the field is empty, send when it has text
  - add a `suggestion?: {text, meaning?, onDismiss}` prop that draws the chip above the bar and fills the field
  - Night bar #0B0B0C (now #0C0C0E), and use the palette instead of hard-coded #FFF and #151515
  - bottom padding = safe-area inset
  - the triangle arrow should become an up-arrow icon
- Header: a new `ChatHeader` (back · avatar with PlatformBadge · name plus one subline · info). Use it as the only header.
- List: replace the ScrollView with an inverted `FlatList` so it stays pinned to the newest message, with `keyboardDismissMode="interactive"`. Add `KeyboardAvoidingView behavior="padding"` with an offset equal to the header height, or use react-native-keyboard-controller.
- Bubble: keep `Bubble` and change the styles: radius 18, padding 8/12, max width 264, gaps 2/8, Angel's bubble #E5E5E7 with dark text (now #151515 with light text), other person #262628 (Night) or #FFF (Day), no borders.
- Long-press menu: one shared context-menu component (Translate / Copy / Reply / Link to client), used for both incoming and outgoing bubbles.

## 4. Delete from `apps/mobile/app/messages/[id].tsx`
1. **Double header.** The root Stack in `app/_layout.tsx` shows `ChromeHeader` with the title "Conversation" (`Stack.Screen name="messages/[id]"`), AND `[id].tsx` draws its own `styles.top` with a 28pt name plus "Open client". Set `headerShown:false` for messages/[id] and use only ChatHeader (52pt). Remove `paddingTop:56`.
2. **Tab bar in the chat.** `AppTabBar` is rendered globally, and `NO_BAR` in `src/components/AppTabBar.tsx` does not exclude `/messages/[id]`. Add `messages/(?!new$)[^/]+` to NO_BAR, or equivalent.
3. The action-button row at the top of the ScrollView (`styles.actions`: Done/Reopen, Archive, Book, Ask AI). Move it to the info (i) sheet.
4. The `Banner`s (needs_owner, LINE off). Move them into the info sheet, or show them as one line of muted subline text in the header.
5. The `manual` paste `Card` ("Did {name} write…"). Move it to the + menu ("Paste client's message").
6. The **AI draft `Card`** (title, bilingual block, TextInput, Approve/Redo buttons). Replace it with the ChatBar suggestion chip plus the field.
7. The **Internal notes `Card`**. Move it to the info sheet.
8. The **Saved replies `ActionButton`** and its list in the composer. Move it into the + menu.
9. The **"Approve my reply" `ActionButton`** (`msgd.approveMine`), the separate "check meaning" button, and the warning lines stacked under the field. Send = approve. Show meaning and warnings as one muted line inside the field.
10. "Copy & open {app}" / "Mark sent" buttons under bubbles. Make them a single small status line under the bubble ("Not sent · tap to copy & open LINE").
Result: the screen is header, then the message list, then ChatBar. Nothing else.

## 5. Opened from Clients
`clients/[id].tsx:76` pushes `/messages/new?clientId=…`. It should go straight to `/messages/{threadId}` when a thread already exists. Same screen, the single 52pt header, no tab bar, and back returns to the client (out/chat-from-clients-*.png).

## 6. Proof required before "done"
Real phone captures, not simulator mockups, on an iPhone (390pt wide or similar), **Day AND Night**, each placed next to the matching `compare/` reference:
inbox · chat empty · typing with keyboard open (count the visible bubbles: 4 or more) · long-press menu · AI suggestion chip then send · chat opened from Clients (one header, no tab bar).
Also a screen recording: long press, keyboard open and close by dragging, send that approves, and back from Clients.
Code alone does not count.
