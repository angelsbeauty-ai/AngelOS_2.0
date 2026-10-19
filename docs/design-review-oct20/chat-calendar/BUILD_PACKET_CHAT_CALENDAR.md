# BUILD PACKET: Chat + Calendar (Oct 20, 2026)
For the Builder. Branch feat/design-a1. No push to main, no EAS, no migrations without sign-off, and META_MESSAGING_SEND_ENABLED stays off.
Mockups: 01-thread-day.png, 02-thread-night.png, 03-thread-keyboard-night.png, 04-inbox-night.png, 05-calendar-month-night.png (HTML source in src/). Measurements and sources: research/CHAT_CALENDAR_PATTERNS.md. Flow verdicts: WORKING_CHECK_MESSAGES_CALENDAR.md.
Goal: it should feel like a normal app. The thread follows iMessage / IG DM / LINE, and the calendar follows Apple Calendar / Buffer.

## Design tokens (add to src/design/theme.ts as `chat` and `cal`)
Fonts unchanged (Manrope; theme.ts:28-43). Header name = headline 17/22 600. Bubble text 16/22 400 (existing bubbleText). Meaning 12/16 400. Timestamp 11/14 500. Day separator 12/16 500, with the day word in 600.
```
chat.day   = { bg:'#F3F3F3', inc:'#E4E4E6', incText:'#151515', out:'#1C1C1E', outText:'#F4F4F5', muted:'#8A8A8E', hair:'rgba(0,0,0,0.08)', field:'#FFFFFF', dock:'rgba(243,243,243,0.94)' }
chat.night = { bg:'#050505', card:'#161618', inc:'#26262A', incText:'#F4F4F5', out:'#E9E9EB', outText:'#151515', t1:'#F4F4F5', t2:'#C7C7CC', t3:'#9A9A9F', hair:'rgba(255,255,255,0.10)', field:'#161618', dock:'rgba(5,5,5,0.92)' }
chat.size  = { header:52, avatarHeader:32, avatarBubble:28, bubbleMax:280, padV:9, padH:14, radius:20, radiusGrouped:6, gapInCluster:2, gapCluster:10, photo:220, photoRadius:18, inputBar:52, field:36, fieldRadius:18, send:36, side:12 }
cal.size   = { cellH:66, dateCircle:26, thumb:22, thumbRadius:5, maxThumbs:2, listRow:68, listThumb:48 }
```
No blue, violet or red anywhere. Only BrandLogo is coloured.

## 1. Component and file changes (ranked)
1. **M/app/messages/[id].tsx: rebuild as a chat** (mockups 01-03)
   - Replace the header (:153-169) with `<ChatHeader>`: 52 pt, back 44×44, 32-pt avatar, name 17/22, subline `BrandLogo 13 + "LINE · Writes in Japanese"`, right icon button (person) → `/clients/:id`. Delete the 28/36 title.
   - Replace the ScrollView (:170) with `FlatList inverted` (data reversed) so it opens at the newest message and scrolls smoothly. Delete `onContentSizeChange scrollToEnd`.
   - Delete from the scroll: the action chip row (:171-178), banners (:179-180), the "Did she write?" Card (:189-193), the draft Card (:194-210) and the Notes Card (:211-217). Move them: Done/Archive/Book/Ask AI/Notes → the header "…" ActionSheet. Paste-inbound → the ActionSheet. Notes → the client profile.
   - New `src/components/chat/Bubble.tsx`: cluster logic (same sender, < 3 min apart → one cluster). Radius 20, grouped corners 6. 28-pt avatar only on the last incoming bubble of a cluster. Timestamp/status only under the cluster's last bubble. Photo 220×220 radius 18 without padding. Translation goes *under* the bubble as a muted 12/16 line (no divider inside the bubble). Remove the bubble borders (:277-278).
   - New `src/components/chat/DraftDock.tsx` above the input: card radius 16, label "AI draft · in Japanese", text, English meaning, and one row of 32-pt buttons: **Approve** (primary), **Edit** (moves the text into the field), **Copy & open** (BrandLogo). Show the dock only when `pendingDraft`.
   - New `src/components/chat/InputBar.tsx`: AI-draft sparkle button 44 → createAiReplyDraft, a pill field (36, radius 18, grows to 120), send ↑ 36-pt circle (disabled grey until there's text). Show the English meaning line above the field while typing Japanese. Replace the "Saved replies" button and "Approve my reply" (:220,:231) with: long-press the sparkle → saved replies sheet; send → the same confirm as Approve.
   - LINE: delete `LINE_SEND_OFF` (:23). `const live = thread.platform==='line' && thread.delivery==='live'`. If live: Approve sends via approve-send and the bubble shows "Sent" / "Read". If not: Approve queues it and offers Copy & open. IG/FB: always Copy & open.
2. **M/src/lib/messaging.ts copyAndOpen**: on native use `Clipboard.setStringAsync(text)` then `Linking.openURL(PLATFORM_OPEN_URL[platform])` (LINE `line://`, IG `instagram://direct-inbox`, falling back to https). Keep Share only as the fallback.
3. **API + M/src/lib/content.ts: delete a post**: `POST /workspaces/:ws/content/:postId/archive` (status archived on post + variants, scheduled → cancelled) and `archiveContentPost()`. Add a destructive "Delete post" to the calendar post sheet (calendar.tsx:361-376) and content/[id].tsx.
4. **M/app/(tabs)/calendar.tsx: month like Apple Calendar + Buffer** (mockup 05)
   - :246: drop the `thisWeek ?` branch. Every cell shows ≤2 22-pt post thumbnails (PostThumb) with a 9-pt platform badge, "+N" overflow, and bookings as one neutral dot.
   - Tapping a day selects it and shows the **list under the grid** (title "Tuesday, Oct 20", segmented All/Drafts/Scheduled/Posted/Ideas using content/index.tsx GROUP, 68-pt rows: 48 thumb, time + logos, title, status pill). It doesn't jump to the day view (:244 `setMode('day')`). Double-tap or the Week segment opens the timeline.
   - Header: month title + search + **+** (44). + opens `/content/new?date=<selected>` directly (no menu). Booking creation moves to the long-press menu.
   - Segment: Month | Week (Day reached from week). Remove the legend (:252-255) and change COLORS/categories (:29,:32) to neutrals.
   - Post status label: "Posts automatically at HH:MM" vs "Reminder at HH:MM" (packet B #13).
5. **M/app/(tabs)/messages.tsx: inbox** (mockup 04): 5 equal tabs (logo 22 over a 12/16 label), all visible at 390 pt. Rows flat (no Card wrapper), 76-pt rows, 52 avatar with an 18-pt brand badge, time on the right, an 8-pt unread dot. The line reads just "Updated 2 min ago" (drop the "· refresh every 5 minutes" hint, :142, which is truncated). Turn the reconnect Cards (:112-128) into one 44-pt inline banner row.

## 2. "Not like a normal app" list → fix
| Where | What feels wrong | Normal-app fix |
|---|---|---|
| Thread header [id].tsx:158 | 28-pt page title + "Open client" text button | Compact 52-pt header, avatar, 17-pt name, profile icon |
| Thread top :171-178 | a row of action chips above the chat | "…" menu in the header |
| Thread :179-180 | banners stacked in the chat | one-line system notice centred among the messages, or nothing |
| Thread :189-217 | three Cards (paste, AI draft, notes) inside the conversation, so it reads like a dashboard | no cards in the scroll; draft docks above the input; paste/notes in menus |
| Bubbles :276-278 | bordered translucent bubbles, every bubble timestamped, translation divider inside the bubble | filled neutral bubbles, clusters, one timestamp per cluster, meaning under the bubble |
| Bubble :256-259 | big Copy/Mark-sent buttons under messages | a "Not sent · Copy & open" status link under the last bubble |
| Composer :219-231 | "Saved replies" button + field + full-width "Approve my reply" slab (white in Night) | single-line pill + sparkle + send ↑ |
| Scroll :170 | scrollToEnd on every content change (jumps) | inverted FlatList |
| Inbox :105-109 | chips cut off at the right ("TikTo…") | equal-width icon tabs |
| Inbox :142 | long truncated "Updated … · refresh" line | "Updated 2 min ago" |
| Inbox :112-128 | full Cards for reconnect errors push the list down | one inline banner row |
| Inbox list | rows grouped inside a big rounded Card (proof inbox-night) | edge-to-edge list with inset hairlines |
| Calendar :246 | only this week shows items; other weeks show dots | thumbnails in every cell |
| Calendar :244 | tapping a day jumps to a day timeline | select the day and show its list under the month |
| Calendar :266-267 | + opens a menu with Booking/Content | + creates a post at the selected date |
| Calendar :252 | legend row under the grid | remove (thumbnails explain themselves) |
| Calendar :29,:32 | blue/violet/red category colours | neutrals |
| Post sheet :367 | raw status strings ("scheduled") and 7 "None" fields | status pill, show only filled fields |
| Post status | doesn't say whether the app posts or just reminds | "Posts automatically" / "Reminder – you post it" |

## 3. Fix list ranked
1. LINE send mismatch (remove LINE_SEND_OFF, use server delivery). 2. Thread rebuild (chat look). 3. Delete post (API + UI). 4. Calendar thumbnails in every cell + day list + direct +. 5. Copy & open copies on native. 6. Auto-post vs reminder labels. 7. Inbox tabs/rows. 8. Colour cleanup.

## 4. Proof required
Real device or simulator captures at 390 pt (@3x 1170×2532), Day and Night, with sample client names only (Yuki Sato, Mika Tanaka …):
- docs/design-review-oct20/proof/messages/: inbox-{day,night}, thread-{day,night}, thread-keyboard-{day,night}, thread-ai-draft-{day,night}, thread-line-sent-{day,night}, thread-copy-open-{day,night}
- docs/design-review-oct20/proof/calendar/: month-{day,night}, week-{day,night}, day-list-{day,night}, create-from-plus-{day,night}, post-sheet-{day,night}, post-deleted-{day,night}
- Plus a short recording: thread opens at the newest message, and a scheduled IG test post goes Scheduled → Posted on staging (or shows "Reminder" when the cron is off).
- Each PNG must match the code on the branch. Layout-only renders are not accepted as proof.
