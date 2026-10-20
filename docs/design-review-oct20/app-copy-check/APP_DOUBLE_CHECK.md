# AngelOS V1 — double check of every screen except Messages (Oct 20 2026, 11:45 JST)
Repo: angelsbeauty-ai/AngelOS_2.0 `feat/design-a1` @ aeafb90 (pulled, read only). No code was changed.
Paths below are relative to `apps/mobile/`.
Evidence comes from 3 places:
- Angel's phone screenshots (agent attachments, 11:12 and 6:5x), shown as **[phone]**
- full-audit renders of every route, Day and Night, from Oct 17, shown as **[audit]**. Since then the only changes are to chat, the client header and the Academy tab (git log).
- the code (file:line)
Real-app references are in `refs/`, with every source link in `refs/SOURCES.txt` (App Store screenshots plus the Apple iPhone User Guide).
Side-by-side PNGs are in `compare/`: real app on the left, AngelOS fix on the right. Each is 1170x2532, Night and Day. I opened every one with Read.

**What I could not do (honest):** I had no device or simulator, so I could not physically perform any gesture. Every gesture result below comes from the code plus screenshots. Per the rules, "Code alone never counts as done", so every **Works** below still needs a screen recording on the phone.

## Ranked fix list (top first)
| # | Screen(s) | Problem (proof) | Reference | Exact fix |
|---|---|---|---|---|
| 1 | Every pushed screen: Clients, Client detail, Account, Plan, Help, Founder, Privacy, Feedback, Edit profile, Accounts, Settings, Notifications, New booking, New post | **White slabs in Night.** [phone] Clients, Plan, Account, Accounts, Edit profile, Help, Founder and Privacy all show #FFF cards on black. Hard-coded white is in 40+ files (grep `#FFF`/`webGlass`: clients/index.tsx, content/new.tsx, bookings/new.tsx, Field.tsx…). | iOS Settings dark (`refs/ios_settings_*`), `compare/profile-settings-night.png` | Shared Card, List, Field and Chip use palette.card: #161618 in Night and #FFF in Day, with a 0.5pt hairline. Remove every hard-coded #FFF/#F2F2F2 (for example content/new.tsx:297 trackColor '#F2F2F2'). |
| 2 | Same ~40 screens | **Double header**: a small nav title sits above a big ghost title ("Accounts" over "Connections", "Clients" over "Clients", "Plan", "Settings"/"Profile"). Shown in [phone] Accounts and Clients and in [audit]. A blank circle sits where the back button should be: [phone] Clients, Plan. | iOS large title (Apple Calendar, WhatsApp Business `refs/wabiz_5.png`) | Use ONE title. Root screens get a large title. Pushed screens get "< Back label" + a centred title. Remove the ghost ScreenTitle where ChromeHeader already shows one, and render a real chevron in the circle. |
| 3 | Calendar | **Drag is Missing.** You cannot move a booking or post to another day or time. The only pan resizes the length of a new appointment: `app/(tabs)/calendar.tsx:80-84`. Long-press on an empty hour adds an appointment (`:220`), but long-press on an existing item does nothing. | Apple Calendar (`refs/applecal_1-3.png`), Buffer queue | Long-press an item to lift it (haptic), drag it to another slot or day, drop, then show "Move to Thu 14:00?" (or Undo), then PATCH the booking or post time. In Month view, drag onto a day cell. |
| 4 | Clients, Messages inbox, Drafts, Ideas, Notifications list | **No swipe actions on any row.** No Swipeable anywhere (grep). Long-press menu exists only on Clients (`src/components/RowMenu.tsx:21`, used by clients/index.tsx:63) and Drafts (`app/content/index.tsx:136`). Ideas have no long-press (`content/index.tsx:133`). | WhatsApp Business / LINE (swipe left: Archive/Delete; swipe right: Read/Pin), iOS Mail | Add a react-native-gesture-handler Swipeable row. Clients: swipe left = Archive. Drafts: swipe left = Delete. Ideas: swipe left = Delete, swipe right = Make post. Inbox: swipe left = Done/Archive, swipe right = Read/Unread. Every row gets the same long-press menu. |
| 5 | Notifications settings, Reminders "stop" toggle, New post "Comments" toggle | **Fake toggles.** Notifications only save to the phone (`app/notifications.tsx:24-27`, AsyncStorage) and no push is registered: there is no expo-notifications at all. Reminders works the same way (`app/automations.tsx:22-25`), so the server keeps sending. The comments switch `content/new.tsx:297` is never passed into save (`:206-231`). | iOS Settings toggles (`refs/ios_settings_2.png`), `compare/notifications-night.png` | Save every toggle to the server, then re-read it on focus so it survives a restart. Register Expo push. Add a haptic `Haptics.selectionAsync()` on change (expo-haptics is installed but never used: zero calls). Send commentsOn with the post. |
| 6 | New post composer, New booking, New client, Edit client, AI assistant | **The tab bar shows on full-screen tasks.** `src/components/AppTabBar.tsx:16-22` hides it only on tab roots, the auth screens, voice and the chat thread, so it still shows on content/new, bookings/new, clients/new and ai ([audit] content_new, bookings_new, ai). There is no swipe-down to dismiss: only voice is a modal (`app/_layout.tsx:36`). | Buffer composer (`refs/buffer_2.png`), Square booking | Present these as modal sheets (`presentation:'modal'`) with Cancel / Title / Save and no tab bar. Add `/content/new`, `/bookings/new`, `/clients/new`, `/clients/*/edit` and `/ai` to NO_BAR. Swipe-down on unsaved changes asks "Save draft?". See `compare/composer-night.png` and `compare/booking-new-night.png`. |
| 7 | Clients list + Client detail | [phone] List: raw handles as names ("__yk1119", "0201chi") with "_" and "0" as avatar letters, **taupe "New Enquiry" pills** (locked out), and the orb covers the rows. Detail: taupe chip, a stray "Edit" text, and white "Add a treatment". | WhatsApp Business labels + contact info (`refs/wabiz_5.png`, `wabiz_6.png`), Fresha client list | Label = grey text "Lead · Instagram". Letters come from the first letter of the name; for a handle, show "@yk1119" with an @ avatar. Use 3 equal action tiles (Message / Book / Note) and grouped sections. See `compare/clients-night.png` and `compare/client-detail-night.png`. |
| 8 | Calendar month/week/day | Month view is a grid with no list of the selected day. A floating + and the orb are stacked bottom right ([audit] calendar). Week chips cut off ("Lash ext…", "Brow lamin…"). Swipe works in code (`calendar.tsx:116-126`: horizontal = next/prev view, vertical = month). | Apple Calendar (`refs/applecal_3.png`) | Put the selected-day list under the grid and use one + top right. Put "Today" bottom left. Week chips show the start time + the first name only, on 2 lines max. See `compare/calendar-month-night.png`. |
| 9 | Analytics | [phone] The platform menu covers the headline. The headline itself is cut off ("No views recor… days yet."). The tiles show "0" and "—". | Apple Stocks / Metricool (`refs/stocks_2.png`, `metricool_3.png`) | One big number + change + one chart, a 7D/30D/90D segment, and a platform chip with an anchored menu. Empty state = one card: "No numbers yet. They appear after your first post." See `compare/analytics-night.png`. |
| 10 | Privacy, Terms | [phone] Privacy shows "[FILL IN: effective date]", "[FILL IN: business address]"… This is not in app code (grep), so the text is served. | — | Fill in the real text or hide the screen until it is ready. No placeholders may ship. |
| 11 | Profile vs Settings | There are two lists of the same things: Profile (Account, Password, Language, Appearance, Clients, Money) and Settings (Account, Business, Connections…), both [audit]. | iOS Settings | Merge them into one Profile grouped list (`compare/profile-settings-night.png`), delete `settings.tsx` as a separate page, and keep the Founder rows founder-only. |
| 12 | Login / Sign-up / Forgot | [audit] Night login renders as a Day white page. Forgot password has a double title and a white card. There are 4 sign-up routes (sign-up, sign_up, signup, register). | Instagram / LINE login (single column, one button) | One sign-up route. Night palette on auth screens, a single title, and the keyboard pushes the button up (KeyboardAvoidingView exists in login/signup but not in forgot-password.tsx). |
| 13 | Today/Home | [audit] Triple greeting ("Hi, Sample / Welcome back / Good morning!"). Tiles are OK, and there is no Finance link (lock kept). | Apple Health Summary (`refs/health_1.png`) | One greeting line + date, then the tiles. Swipe-up-at-end opens the report (`(tabs)/index.tsx:68`); make it a visible "Full report >" row as well, because hidden gestures are not discoverable. |
| 14 | Social accounts connect | [audit] "Fixture…" pages, a white slab, the tab bar, and a double title ("Accounts"/"Connections"). | Buffer channels (`refs/buffer_2.png`), Metricool (`metricool_2.png`) | List each platform logo, the account name, and Connected / Reconnect / Connect. One screen; route `social/accounts.tsx` already re-exports content/accounts. |
| 15 | Drafts / Scheduled / Posted / Ideas | Tabs exist (`content/index.tsx:30-31`). Drafts have long-press (`:136`); Ideas do not (`:133`). There is no reorder of drafts or ideas and no pinned items. | Buffer Publish (`refs/buffer_5.png`, `buffer_6.png`) | Long-press = menu + drag to reorder (Ideas and Drafts); swipe actions as in #4. |
| 16 | AI assistant / voice | Voice is OK: full screen with no tab bar ([audit] voice). The /ai chat shows the tab bar with chips + bar + footer text stacked ([audit] ai). | ChatGPT / iMessage | Hide the tab bar on /ai, keep ONE slim bar, and remove the footer sentence (move it into the empty state). |
| 17 | All lists | There is no offline state anywhere: no NetInfo (grep). | iOS Mail "Offline" banner | A shared offline banner and cached last data. |

## Gestures & toggles, per screen (Works = in code, not yet recorded on device)
### Inbox list (Messages tab)
| Gesture | Real app | AngelOS | Evidence |
|---|---|---|---|
| Long-press row menu | WhatsApp/LINE: Pin, Read, Archive, Delete | **Missing** | `(tabs)/messages.tsx`: no onLongPress/RowMenu |
| Swipe row actions | WhatsApp: Archive / Read | **Missing** | no Swipeable in repo |
| Pull to refresh | yes | Works | `(tabs)/messages.tsx:102` Screen onRefresh |
| Reorder / pin | WhatsApp pin | **Missing** | — |
### Chat bubbles (already covered by chat-copy; checked again here)
| Long-press bubble | Works | `messages/[id].tsx:103,148` |
| Swipe-to-reply | **Missing** | no pan in messages/[id].tsx |
### Calendar (month / week / day)
| Swipe between weeks/months | Apple: yes | Works | `(tabs)/calendar.tsx:116-126` |
| Long-press empty slot = new | Apple: yes | Works | `calendar.tsx:220` |
| Long-press existing booking/post | Apple: lift + menu | **Missing** | only onPress |
| Drag post/booking to new day/time | Apple, Buffer | **Missing** | only lengthPan `calendar.tsx:80-84` (new appt length) |
| Drag edge to change length | Apple | Partly (new appt sheet only) | `calendar.tsx:80-84` |
| All-day toggle | saves with event | Works on save | `calendar.tsx:279` |
| Pull to refresh | — | Works | `calendar.tsx:190` |
### Composer (New post)
| Swipe-down to dismiss + save prompt | Buffer/Instagram | **Missing** (stack push, tab bar visible) | `_layout.tsx:36`, `AppTabBar.tsx:22` |
| Keyboard not covering text | yes | **Broken risk**: no KeyboardAvoidingView in content/new.tsx (Screen only) | grep |
| Comments toggle | saves with post | **Fake**: never sent | `content/new.tsx:297` vs `:206-231` |
| Drag to reorder photos | Instagram | **Missing** | — |
### Drafts / Scheduled / Posted / Ideas
| Long-press draft | Works | `content/index.tsx:136` |
| Long-press idea | **Missing** | `content/index.tsx:133` |
| Swipe delete / Make post | **Missing** | — |
| Drag reorder ideas/drafts, pin | **Missing** | — |
### Social accounts connect
| Pull to refresh status | **Missing** (not checked on device) | content/accounts.tsx no onRefresh in grep list |
### Clients list + Client detail
| Long-press row (Book/Edit/Archive) | Works | `clients/index.tsx:63`, `RowMenu.tsx:21` |
| Swipe left Archive | **Missing** | — |
| Swipe-back from detail | Works (native stack, iOS default) | `_layout.tsx:36` Stack, needs a recording |
| Tab bar on detail | OK (WhatsApp hides, Fresha shows); hide on edit | `AppTabBar.tsx:22` |
### Booking (new / detail / week)
| Date/time picker | Square: wheels | **Broken** on web render: raw HTML date boxes [audit] bookings_new | bookings/new.tsx |
| Drag to dismiss | **Missing** | not modal |
| Separate "Bookings" week screen duplicates Calendar week | — | **Duplicate** | `bookings/week.tsx` |
### Today/Home
| Pull to refresh | Works | `(tabs)/index.tsx:68` |
| Swipe up at end = report | Works, but hidden | `(tabs)/index.tsx:68` |
### Analytics
| Pull to refresh | Works | `(tabs)/analytics.tsx:50` |
| Platform menu | **Broken**: covers the headline [phone] | |
| Chart scrub (Stocks press-and-hold) | **Missing** | |
### Notifications / Profile / Settings toggles
| Toggle | Instant | Server | Survives restart | Haptic | Verdict |
|---|---|---|---|---|---|
| Notifications ×3 `notifications.tsx:39` | yes | **no** (phone only) | yes on this phone | **no** | **Fake** (no push exists) |
| Stop reminders `automations.tsx:36` | yes | **no** | this phone only | no | **Fake** |
| AI learn / roles `ai-settings.tsx:118,161,178-179` | yes | yes (API) | yes | no | Works minus haptic |
| Rule on/off `assistant.tsx:115` | yes | yes | yes | no | Works minus haptic |
| Marketing permission `media/[id].tsx:71` | yes | yes | yes | no | Works minus haptic |
| Appearance `src/design/appearance.tsx:75` | yes | no (phone) | yes | no | OK (a device setting, like iOS) |
| Haptics anywhere | — | — | — | **0 calls**, expo-haptics in package.json:29 | **Missing** |
### Login / Sign-up / Forgot
| Keyboard avoid | login/signup Works (KeyboardAvoidingView); forgot-password **Missing** |
| Swipe-back to login | Works (stack) |
### AI assistant / voice
| Voice: swipe-down dismiss | Works (`presentation:'modal'`, `_layout.tsx:36`) |
| /ai keyboard | Works (KeyboardAvoidingView in ai.tsx) |

## Locks check
- Manrope, sizes unchanged. Palette: Night #000/#161618, Day #F3F3F3. Red is used only for "today" and Notifications.
- No Finance link on Today, no taupe tags in any fix, and no Academy tab (`(tabs)/_layout.tsx:43` href:null: **done**). Only sample names are used.

## New to the screen map: needs Angel's one yes
1. Merge Settings into Profile (one grouped list) and drop the separate `settings.tsx` page.
2. Remove the separate Bookings week screen (`bookings/week.tsx`) and use the Calendar Week view instead.
3. A selected-day list under Calendar Month.
4. A Quiet hours row + master switch on Notifications (needs push on the server).
5. Swipe actions + drag-to-move/reorder on calendar, lists, ideas and drafts.
6. Composer, New booking and New client become modal sheets with no tab bar.
7. A shared offline banner.

## DESIGNER_RULES checklist (honest)
- [x] I did the design myself; Angel was given no tasks.
- [~] Phone-width shots, Day AND Night: fix mocks are Day + Night. The current-app shots are the Oct 17 audit + Angel's phone. **I did not re-render the current build.**
- [x] Compared side by side with real apps (8 compare PNGs ×2 modes).
- [ ] No demo data: **FAIL in the app** (Fixture/Sample accounts, [FILL IN] privacy, raw handles). The mocks use sample names only.
- [ ] Back/title/tap targets: **FAIL** (double titles, blank back circle).
- [~] Loading/empty/error: present on Clients (`clients/index.tsx:57-60`); empty Analytics cut off; **offline missing everywhere**.
- [ ] Logo: not re-checked in this pass.
- [ ] Every toggle saves: **FAIL** (3 fake toggles, no haptics).
- [ ] Long press / swipe / pull tested **on screen**: **NOT DONE** (no device). Code-checked only.
- [~] Keyboard: OK on login/signup/ai/chat; risk on composer and forgot-password.
- [x] Copied real apps first: refs saved with links before designing.
- [x] Real app vs AngelOS image.
- [x] Plain English, with a Works/Broken/Missing/Fake verdict and proof.
- [x] New screen-map items listed above.

## Calendar v2 (2026-10-20) — copy Apple Calendar (iOS 18/26)
Generator: `gen_v2.py` (screen 390×844 pt @3x = 1170×2532 px). Font: Manrope. Palette: Night `#000` bg / `#161618` card / `#2C2C2E` chip; Day `#F3F3F3` / `#FFFFFF` / `#E5E5EA`. Red (`#FF453A` Night / `#FF3B30` Day) is used only for today and the current-time line. Brand logos are in colour. Sample names only. The tab bar is visible.

| Element | Exact size | Source |
|---|---|---|
| Nav: "< 2026" back + list / search / + | 44 pt row, 17 pt/600 label, 24–26 pt icons | Apple Calendar `refs/applecal_3.png` |
| Large title "October" | 34 pt/800 | `refs/applecal_3.png` |
| Filter row All / Appointments / Posts / Tasks | 32 pt chips, 14 pt/600, 8 pt gap | Google Calendar `refs/gcal_1.png` (calendar filters) |
| Weekday letters | 12 pt/600 muted | `refs/applecal_3.png` |
| Month day cell | full width ÷ 7 (55.7 pt) × **96 pt**, 0.5 pt hairlines, no margins | `refs/applecal_3.png` |
| Day number / today circle | 17 pt/600; today = 28 pt red circle, white 800 | `refs/applecal_3.png` |
| Month chip | 15 pt high, 10 pt/700, 4 pt radius, 2 pt gap, max 3 + "+N" (10 pt muted) | `refs/applecal_3.png` |
| Appointment marker | 2.5 pt left bar in text colour + "Name HH" | Apple chip bar `refs/applecal_1.png` |
| Post marker | 11 pt thumbnail + 11 pt colour platform logo + time | Buffer `refs/buffer_*.png`, Metricool `refs/metricool_*.png` |
| Task marker | 9–11 pt outlined checkbox, transparent chip with hairline | Apple reminders in calendar `refs/applecal_1.png`, Fantastical `refs/fantastical_1.png` |
| Bottom bar "Today / Filter" (Apple has Today / Calendars / Inbox) | 44 pt, 17 pt/600, above the 83 pt tab bar | `refs/applecal_1.png`, `refs/applecal_3.png` |
| Week / Day hour grid | **60 pt per hour**, 50 pt time gutter, 11 pt/600 hour labels | `refs/applecal_1.png`, `refs/fantastical_3.png` |
| Week/day strip | 11 pt letter + 30 pt date circle, 17 pt | `refs/applecal_1.png` |
| All-day row | ≥26 pt, "all-day" 11 pt | `refs/applecal_1.png` |
| Current-time line | 1.5 pt red line + red 11 pt/700 "11:41" pill | `refs/applecal_1.png` |
| Overlapping items | split the column into equal lanes side by side, 2 pt gap; narrow lane = initials + hour, or thumbnail + logo | `refs/applecal_1.png`, `refs/notioncal_1.png` |
| Day-view item | 12 pt/700 title + 12 pt/600 muted subtitle, 5 pt radius | `refs/applecal_1.png` |
| Drag (long-press) | item lifts at scale 1.02 with a 0 12 28 shadow and a dashed ghost at the original slot; snaps every 15 min; time pill 11 pt; "Move to Tue 13:15? Undo / Move" toast 44 pt | Apple Calendar drag behaviour (not in App Store shots); Notion Calendar `refs/notioncal_2.png` |
| Year grid | 3 × 4 months, 17 pt/700 month name, 8 pt days in 14 pt cells, today red | Apple Calendar year view (no screenshot found; built from iOS layout) |

Screens: `out/calendar-v2-{month,week,day,drag,year}-{night,day}.png`. Compares (real app vs AngelOS, Night): `compare/calendar-v2-{month,week,day,drag,year}-night.png`, plus `compare/calendar-v2-night.png` (month).
Gaps: the App Store has no screenshots of Apple's portrait week view or year view, so the week compare uses Fantastical and the year compare uses Apple's month view.
