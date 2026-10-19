# AngelOS — Messages deep review (20 Oct 2026, JST)
Review only. No code changed. Judged against `STRICT_UI_CHECKLIST.md` and `SCREEN_REVIEW_OCT20.md`.

## What I looked at
- **Screenshots, newest first:**
  - Angel's 17 Oct iPhone shot of Messages (Night, filtered to TikTok, empty).
  - `full-fix/iter2` (Day and Night: inbox, thread, new conversation, saved replies, empty).
  - `full-fix/iter1` and `full-audit` (16 Oct).
  - `data-fix` (needs-permission and reconnect error).
  - `messages-fix` (Facebook error).
  - `nav-v1` (filter menu, Comments tab, empty).
  - `t257-build` and `premium-high` (All and Instagram).
  - Older `ui-oct16b/c/d` and `home-cc` builds.
- **Code:** read-only on `feat/design-a1`:
  - `app/(tabs)/messages.tsx` (inbox)
  - `app/messages/[id].tsx` (thread, AI draft, reply, notes)
  - `app/messages/new.tsx` (new conversation)
  - `app/messages/saved-replies.tsx` is listed in the branch, but I didn't open its code.
  - I didn't open the shared components (`MessagingBits`, `NightSafe`, `ui`) or `lib/messaging`, so anything that depends on them is marked "not verified".
- **Mockups:** `final-d2-build/02-messages.png` (the D2 inbox) and `profile-night-audit/png/messages-empty-night@3x.png`.
- **Caveat:** web shots use fixture data ("Sample · …"). In every web shot the **thread screen is only in its error state** ("We couldn't load this conversation"), so the loaded thread view has **no screenshot proof**. For the thread I can only report what the code does.

Legend: ✅ pass · ❌ fail · ⚠️ partial · **N/C** = not checkable from a screenshot · **No proof** = no screenshot.

---

## 1. Screens and states

### 1.1 Inbox (All)
Proof: iter2 Day + Night, D2 mockup.
| Section | Result | Evidence |
|---|---|---|
| Locks | ✅ | Shared title "Messages" at left. Platform tabs present (All · Instagram · Facebook · LINE · TikTok) with brand logos only. Neutral colours. Logo button bottom right. iter2 Night list is a dark hairline card ✅ |
| Design system | ⚠️ | Row: 56 pt avatar, 16/600 name, 14 preview. Tab chips are 36 pt vs the 38 pt chip token. Selected chip OK in both modes (code forces `#F4F4F5` at night). The "Done" tag is 12 pt taupe text with no pill, which differs from the status-tag rule |
| iPhone feel | N/C | Pull to refresh exists in code (`onRefresh` → sync). No swipe or long-press (see gaps) |
| Content | ❌ | Fixture names. The tab row runs past the right edge on web ("LINE" cut, TikTok off-screen) — allowed on the trailing edge, but on the phone the first chip is cut at the left ❌ |
| States | ✅ | Skeleton, error with Try again, no-studio and empty all exist in code |
| JP/EN | N/C | No JP shot. Strings go through `t()` |
| Accessibility | ⚠️ | Rows have a label ("name, platform, unread"). The dot carries `accessibilityLabel="Unread"` even when it means "needs reply" |
| Function | N/C | |

### 1.2 Inbox filtered by platform (Instagram / Facebook / LINE / TikTok)
Proof: t257 + premium-high (Instagram); Angel's phone (TikTok, Night).
- **Locks:** ❌ on the phone. The empty card is a **white slab at night**, and the search bar is white.
- **Content:** ❌ On the TikTok tab the phone shows "Nothing here · Try another filter", even though TikTok has no message sync. That isn't honest.
- **States:** ⚠️ LINE has its own empty copy in code; TikTok does not.
- Others N/C.

### 1.3 Filter menu (Unread, Unanswered, Booked, Follow-up, Done)
Proof: `nav-v1/02b` only (older build, cream style). **No current-build proof.**
- **Code:** one modal holds Platform + Filter; an active filter shows a "Unread · clear" text line.
- **Design:** ⚠️ The "clear" line is body text with no 44 pt hit area (PREMIUM #9).
- **Night menu:** not verified (`safe.menu`).

### 1.4 Search
**No proof** (no screenshot with search open).
- **Code:** a plain text field appears under the tabs. It only matches the name and the **last preview line**, not the message history.

### 1.5 Empty states
Proof: iter2 Day + Night ("No conversations yet …" with no card ✅), Angel's phone (white card ❌), night-audit mockup (no card, dark field ✅).
- **Locks:** ⚠️ The web build passes, but the phone build fails.
- **Design:** ✅ The web version matches rule 6.
- **Content:** ✅ Honest copy.
- **Not connected:** a "Connect your accounts" empty state exists in code. **No proof.**

### 1.6 Connection problem states (needs permission / reconnect failed / LINE issue)
Proof: `data-fix` and `messages-fix` (older cream build with a "MOCK DATA" banner).
- **Content:** ✅ Plain-English reasons and one clear button (Reconnect / Retry / Open LINE settings).
- **Locks:** N/C in the current build. **No current Day/Night proof.**
- **Code risk:** for reconnect errors the code shows `e.message` (raw) instead of friendly copy.

### 1.7 Thread / conversation (loaded)
**No proof.** All screenshots show only the error state. Review from code:
- **Locks:** ❌
  - The name header uses `font.display` 32/36, not the shared title (700 28/36).
  - Colours come from static `ui.colors` / `tokens.color.raised` / `charcoal`, not the theme palette. That points to **light cards and inputs in Night** (not verified).
  - The "Translate" link uses `tokens.color.tide`. **Check that it isn't blue.**
- **Layout:** ⚠️ It's a long scroll of cards (actions → bubbles → paste-in → AI draft → reply → notes), not a chat. The reply box isn't pinned to the bottom, and the newest message isn't anchored above the keyboard.
- **JP/EN:** ❌ Many strings are hard-coded in English ("Approve", "Archive", "Writes in 日本語", "Did {name} write again?", "Copy & open …", "Draft reply with AI"), so the JP UI will mix languages.

### 1.8 Thread error state
Proof: iter2 Day + Night.
- Locks ✅ (one back chevron, dark card at night).
- Content ✅ ("Check your connection and try again. Nothing has been lost.").
- States ✅ (Try again).
- ⚠️ The error shows the nav title "Conversation" in code, not in the shot. Check for a double title.

### 1.9 New conversation (log a message by hand)
Proof: iter2 Day + Night.
- **Locks:** ✅ One title, dark cards at night.
- **Design:** ⚠️ Inputs are radius 20 (the field token is 14). Step labels "1 · Client / 2 · Where did they message you?" are clear.
- **Content:** ✅
- **JP/EN:** ❌ "Add conversation" and "Saving…" are hard-coded English.
- **Function:** N/C.

### 1.10 Saved replies
Proof: iter2 Day + Night, **error state only**. The loaded list has **no proof**.

### 1.11 Unread badges (Messages tab and bell)
Proof: iter2 shows a small count on the Messages tab icon.
- **Code:** the bell dot = "any thread unread", in taupe `#8C7A64` with a 1.5 pt white ring. **The white ring will show as a white halo at night** (not verified).
- Count accuracy: N/C.

### 1.12 Comments / Mentions tabs
Proof: `nav-v1/02c` (old). In the current code `seg` is fixed to `messages`, so these tabs are **removed**. ✅ Consistent with the screen map. Confirm nothing links to them.

---

## 2. Gap list vs a professional unified inbox (V1 scope)
Status: **MISSING / PARTIAL / OK**. **NEW** = would add an element outside the current screen map, so Angel and Grok need to approve it first.

| # | Capability | Status | Evidence / note |
|---|---|---|---|
| 1 | Unread vs read styling | PARTIAL | Bold preview for unread, muted when read ✅. But the same dot means "unread" **or** "needs reply", so Angel can't tell them apart |
| 2 | Unread count accuracy | PARTIAL / N/C | Tab count shows in the shots; opening a thread calls `markThreadRead` ✅. Accuracy across the 5-min sync, and between the tab, the bell and Home "3 unread", is unproven |
| 3 | Pinned / important | MISSING | No field or UI. **NEW** if added; "Follow-up" filter partly covers it |
| 4 | "Needs reply" status | PARTIAL | Exists as the "Unanswered" filter and a `needs_owner` banner in the thread. No visible label on the row |
| 5 | Per-platform badges | OK (code) | `ContactAvatar` gets a platform badge; FB uses the **Messenger** logo in tabs and menu ✅ (matches D2). Row badge rendering not verified at @3x |
| 6 | Sync status line ("Updated 2 min ago") | MISSING | Nothing shows the last sync time, even though IG/FB sync only every 5 min. Without it Angel can't tell a quiet inbox from a stale one. Small text line, likely **NEW** |
| 7 | Pull to refresh | OK (code) / no proof | `Screen onRefresh` → `syncMessages`. No recording |
| 8 | Thread timestamps | OK (code) | `timeLabel` under each bubble |
| 9 | Day separators ("Today", "Yesterday") | MISSING | None in the bubble list |
| 10 | Media / photos in thread | MISSING | The bubble renders text only. IG/LINE photos (brow/lip reference pics) would be lost. Showing them is in scope; a photo viewer would be **NEW** |
| 11 | Link to client record | MISSING | The header shows the name but has no "Open client" link. Only an indirect "Book" button when a client is linked |
| 12 | Link unknown sender to a client | MISSING | If `thread.client` is empty there's no way to attach or create a client from the thread. **NEW** (small) |
| 13 | Booking shortcut | PARTIAL | "Book" (`msgd.s16`) → `/bookings/new?clientId` ✅, but **only if a client is linked** |
| 14 | AI draft → Approve / Edit / Copy (IG/FB, sending off) | OK (code) | Draft is editable. Approve asks to confirm ("AngelOS does not send it for you"), then the bubble offers **Copy & open Instagram/Messenger** + "I sent it" ✅. Approve is blocked until a JP draft has its English meaning ✅ |
| 15 | Nothing sent without Approve | OK (code) | Both the AI draft and her own reply go through `dialog.confirm` → `approveReply`. Needs a device test |
| 16 | LINE send path | PARTIAL | If the LINE thread is not `manual`, the confirm says "AngelOS will send it to {name} on LINE" ✅. **No proof** of a real LINE send, its "Sent" state or its failure state ("Not sent" exists in code) |
| 17 | Swipe actions (read / important / archive) | MISSING | No swipe in the inbox. Archive and Done exist only inside the thread. Swipe gestures are standard iOS; check the screen map |
| 18 | Long-press menu | MISSING | None on rows or bubbles (spec: 450 ms → impactMedium + context menu). No "copy message" on a bubble |
| 19 | Search inside messages | PARTIAL | Searches only names and the last preview, not the message bodies |
| 20 | Loading state | OK (code) | 4-row skeleton in the inbox. **Thread loading is a card with text, not a skeleton** |
| 21 | Error state | OK | Inbox and thread both have Try again (iter2 proof) |
| 22 | Offline state | MISSING | No offline detection; you only get the generic error |
| 23 | Disconnected / needs-permission | OK (code) / old proof | Per-platform cards with Reconnect / Open LINE. Reconnect error can show raw `e.message` |
| 24 | Not connected at all | OK (code) / no proof | "Connect" empty state with a button |
| 25 | TikTok tab honesty | MISSING | TikTok is always a tab, and the phone shows "Try another filter". It should say plainly that TikTok messages aren't connected / not available yet. **Remove the tab or label it**, per Angel's lock (the tab must stay → honest copy) |
| 26 | JP casual drafts + EN meaning | OK (code) | Copy: "friendly Japanese, with the English meaning next to it". `BilingualBlock` shows JP + EN, and EN is required before Approve ✅. Tone itself unverified (no JP output seen) |
| 27 | JP UI strings | MISSING | Many hard-coded English strings in the thread and new-conversation screens (see 1.7, 1.9) |
| 28 | Translate client message | OK (code) | "Translate" link on JP bubbles; the link colour `tide` needs a neutral check |
| 29 | Internal notes | OK (code) | Notes card with time |
| 30 | Saved replies | PARTIAL | Insert with the name filled ✅; the loaded list screen has no proof |
| 31 | VoiceOver | PARTIAL | Inbox icons and rows are labelled ✅. Thread action buttons rely on their text. Bubbles have no "from client / from you, time" label. The dot is always labelled "Unread" |
| 32 | Keyboard | PARTIAL / N/C | Search autofocuses. In the thread the reply box sits mid-scroll with no keyboard-avoiding layout seen in this file. Risk that the Approve button sits under the keyboard |
| 33 | Dynamic Type | PARTIAL | Rows cap at 1.3×, which is below the checklist's XL requirement → ❌ at XL |
| 34 | Haptics | MISSING | None in these files (tab change should tick; Approve should give one success haptic) |
| 35 | Done / archive | OK (code) | Inside the thread only; no undo toast |
| 36 | Tab-bar badge vs bell dot | PARTIAL | Two unread signals (tab count + bell dot) on one screen. Pick one meaning for each |

---

## 3. Top 10 (ranked by impact)
1. **Night white slabs on the phone build.** Empty card and search bar on Messages. The web iter2 already fixes this, so ship the same component to the phone and re-shoot.
2. **Make the thread a real chat, themed for Night.** Name in the shared title style, palette colours instead of static light ones, bubbles anchored at the bottom, the reply/AI draft box pinned above the keyboard. Prove it with a loaded Day + Night screenshot (none exists today).
3. **Honest TikTok tab.** Replace "Try another filter" with a plain line ("TikTok messages aren't connected yet"). Keep the tab (it's locked).
4. **Sync status line + pull-to-refresh proof.** "Updated 2 min ago · Instagram and Messenger refresh every 5 minutes." Most important for trust, since sending is off and sync is delayed. *New small element: needs approval.*
5. **Split "unread" from "needs reply"** on the row (dot = unread; a small taupe "Needs reply" tag), and fix the VoiceOver label.
6. **Client link in the thread:** an "Open client" link on the name, and "Link to a client / New client" when none is linked. That unlocks the Book shortcut for every thread.
7. **Photos in the thread.** Show inbound images; without them Angel loses reference pics clients send.
8. **Translate every hard-coded string** in the thread and new-conversation screens, and check the JP UI with an EN meaning for Angel.
9. **Swipe + long-press on rows** (Done, Archive, Mark unread) and "Copy" on a bubble, with the specified haptics, plus day separators in the thread.
10. **Device proof for the full send flow:** IG/FB Approve → Copy & open → I sent it, and LINE Approve → Sent / Not sent. Also offline, the reconnect states in the current build, Dynamic Type at XL (raise the 1.3× cap), and a check that the `tide` link colour and the bell's white ring are neutral at night.

**No proof at all:** loaded thread, search open, current filter menu, saved replies list, not-connected empty state, reconnect states in the current build, LINE sent/failed, JP UI, any interaction (haptics, swipe, keyboard, VoiceOver).
