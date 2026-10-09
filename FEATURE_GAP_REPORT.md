# AngelOS: feature-gap review (what a professional app would have that AngelOS doesn't yet)

For Angelica (Angel) Borac, Angels Beauty, Okinawa · 9 Oct 2026 (JST) · **Read only. No code was changed, pushed or opened as a pull request.**

**What I read:** GitHub `angelsbeauty-ai/AngelOS_2.0`, branch `main`, commit `a544313` ("chore: add EAS projectId…"). I made a read-only copy in `/workspace/angelos-review/repo`. App: `apps/mobile` (Expo SDK 57, 27 screens in `app/`). Server: `apps/api` (NestJS, 16 controllers). Database: `supabase/migrations` 0001–0013.
**Already-known lists (not repeated in detail here, referenced by code):**
- `UX` = `/workspace/angelos-designer/ux-gap-audit.md` (2 Oct, items A1…H5). Note: it describes the older PHASE6 app; some of its points differ on `AngelOS_2.0` (see notes below).
- `CHK` = `/workspace/angelos-designer/PRELAUNCH_UX_CHECKLIST.md` (9 Oct, "Must-have" #1–13).
- `A1` = `/workspace/angelos-designer/BUILD_PACKET_A1.md` (the design work on Angel's laptop: 4 tabs Today/Clients/Calendar/Academy, screen names, hold menus, forgot password, show/hide eye, friendly errors, login-expired handling). **Not on GitHub, so treated as "in progress locally".**
- `SAP` = `/workspace/angelos-v2-planning/STUDENT_AREA_PLAN.md` (student area, batches 1–3).

**Key: Real** = the screen talks to the AngelOS server and shows saved data. **Demo** = the button makes test data or pretends. **Fake** = text is typed into the screen and never changes. **Priority:** Must before launch / Should / Later. **Size:** S = under a day, M = 1–3 days, L = a week or more.

---

## Things that are true on EVERY screen (so they're not repeated in each row)
- **No press-and-hold menus, no swipe actions, no pull-down-to-refresh** anywhere on GitHub (0 uses). Lists refresh only with small "Refresh"/"Search" buttons. The hold menu on client rows exists only on the laptop (`A1`).
- **Loading** = a plain text card ("Loading clients…"). No spinners or grey placeholder rows.
- **Errors** = a pop-up with the raw server text or "Unknown error" (every screen). Kind wording is in progress locally (`A1`, `UX` D1).
- **Screen names:** only 3 screens have a proper title (Home "AngelOS", "Sign In", "Founder"); the other 24 show technical names like `clients/[id]` (`UX` B4, fixed locally in `A1`).
- **No haptics (small taps), no date pickers, no keyboard handling, English only, no VoiceOver labels** (`UX` D7, E1, E3, H1, G1).
- **No time limit on server calls:** `src/lib/api.ts` has no timeout, so on weak signal a screen can sit on "Loading…" forever. (The old app had a 5-second limit; this one has none.)
- Every screen silently reports "screen viewed / time spent" to the server (`UsageTracker`). This must be declared in Apple's privacy answers.

**Correction to the older audit:** on `AngelOS_2.0`, Home **does** link to Calendar, Clients, Messages, Content, Media, Analytics, Finance, Automations, Subscription, Feedback and Settings, and there is no broken "Planner" tile or fake "System check" screen. Those items in `UX` B1/B2/D10 apply to the old PHASE6 app only.

---

## (A) Screen-by-screen (27 screens on GitHub)

| # | Screen (file) | What works: every tap | States (loading / empty / error) | What's missing | Real or fake |
|---|---|---|---|---|---|
| 1 | **Home** (`index.tsx`) | Checks you're signed in, else goes to Sign In. Taps: "Ask AngelOS" → AI chat; "Open System Health"; rows Calendar, Clients, Messages, Content; chips Media, Analytics, Finance, Automations, Subscription, Feedback, Settings. Shows a "needs attention" count. | Loading text. If health check fails it quietly shows "--". | **No real "today" information**: no list of today's appointments, no new messages, no money this week. No bottom tabs (local `A1` adds them). Services and Marketing Profile are not reachable from Home. | Mixed. Attention count is **real**. The "Appointments: **Today**" card is **fake** (the word "Today" is typed in, not a number). "AI ready" label is **fake**. |
| 2 | **Sign In** (`login.tsx`) | Email, Password, "Sign In", "Create Account" (uses the same two boxes). After sign-in goes to Home or Setup. | Button shows "Working…". Raw error pop-up. | Forgot password, show/hide eye (both **local `A1`**), confirm password, password rules, resend verification email, iPhone password autofill (`UX` A1–A6). "Private Beta" label must go before launch. | **Real** (Supabase login). |
| 3 | **Setup** (`onboarding.tsx`) | Without access: "Beta invite" box + "Verify Invite". With access: Business name, Currency (type 3 letters), "Create Workspace". Shows device language and time zone. | "Checking beta access…" text; raw error pop-ups. | **After "Create Workspace" you stay stuck on the same screen**: it only shows a pop-up, with no move to Home or Services. Currency should be a picker. Needs a short guided setup (services → hours → first client). Requires a private invite, which won't work for a public paid app. | **Real.** |
| 4 | **Settings** (`settings.tsx`) | Links: AI Assistant, Marketing Profile, Subscription, System Health; "Founder Control Center" (only for you); shows your email; "Sign out" (no "are you sure?"). | No loading or error states. | Profile, business info, language, notifications, privacy, terms, delete account, change password, help, about/version, data export. Full list in (B) Settings. | **Real** (reads login + founder flag). |
| 5 | **Subscription** (`subscription.tsx`) | Status card; Monthly/Yearly switch; price; "Upgrade or Reactivate" / "Manage Plan"; "Activate Demo Plan" (shows when no payment system); student-token box + "Apply Student Discount"; "Cancel subscription" (asks first). | "Loading subscription…" text; raw error pop-ups. | **No real payment.** "Upgrade" only says "Payment setup coming next". No Apple purchase, no Restore Purchases, no Apple "manage subscription" link, no terms/privacy links. Price shown in US dollars. | **Mixed.** Status comes from the server (**real**), but payment is **not connected**. "Activate Demo Plan" is **demo**. "14-day trial \| $49/month or $490/year" is **fake** typed text. |
| 6 | **Clients** (`clients/index.tsx`) | Search box + "Search" button (does not search as you type); "New Client"; tap a row → client page. Rows show first letter, name, status, language, phone/email, "manual only" label. | Loading text; empty: "No clients yet…"; raw error pop-up. | Hold menu (**local `A1`**), swipe to call/message, filters (new, active, due for touch-up), sort, A–Z index, client photo. Status shown as database words ("lead"). | **Real.** |
| 7 | **New Client** (`clients/new.tsx`) | Name, Phone, Email, Language (free text "en / ja"), "Create Client" → opens the new client. | "Saving…"; raw error pop-up. | No message saying why the button is grey. Language should be a 日本語/English switch. Missing fields: birthday, Instagram/LINE, how they found you, health form. No "import from phone contacts". | **Real.** |
| 8 | **Client page** (`clients/[id].tsx`) | "Ask AI"; phone/email shown (not tappable); Treatment history (last 8) + "Add Treatment" (name only); "Add Client Photos / Media" → Add Media; Notes (last 8) + "Add Note"; Consent list (read only); Payments list + amount + typed method + "Record Received Payment"; Follow-ups list. | "Loading client…"; "Client not found". **Add Note and Add Treatment fail silently** if the server errors. | **No Edit client** (server can do it). **Client photos are never shown here**, not even photos linked to this client. No before/after/healed timeline. No past/upcoming bookings for this client. No health form, no way to add a consent, no signature. Treatment record has no pigment, needle or technique fields. No tap-to-call / LINE. No archive/delete. | **Real.** |
| 9 | **Calendar** (`calendar.tsx`) | One list of the next 7 days (appointments + blocked time); "New Booking"; "Manage Services"; "Refresh". Shows a "Checking availability" banner when opened from a message. | Loading text; empty: "No bookings yet"; raw error pop-up. | **Appointments can't be tapped**: no booking detail, Confirm, Reschedule, Cancel, Mark done or No-show (the server supports all of these). No day/week/month view, no going back or forward in time, no business hours screen, no "block time off" screen (server has both). No colours by status. | **Real** (read only). |
| 10 | **New Booking** (`bookings/new.tsx`) | Pick a client (**only the first 12 clients are shown**, no search); pick a service; date typed as `YYYY-MM-DD`; time typed as `HH:mm`; "Check & Create Booking"; if there's a soft clash → "Book Anyway". | "Checking…"; raw pop-ups. | Date and time pickers, client search, "new client" from inside booking, notes, price change, deposit, repeat booking, send confirmation to client. | **Real** (with a clash check). |
| 11 | **Services** (`services.tsx`) | List of services (name, minutes, price, prep/clean-up time); form to add one (name, minutes, price, before/after minutes) + "Add Service". | Loading text; empty text; friendly checks on numbers. | **No edit, hide or delete of a service** (the server has no route for it either). No description, photo, category, deposit amount, or "touch-up included". Business hours not here. | **Real.** |
| 12 | **Messages** (`messages/index.tsx`) | "Refresh"; **"Create Demo Inquiry"** (adds a pretend client message "Are you available Saturday…"); tap a conversation → open it. Rows show sender, channel, topic, urgency, "needs owner review". | Loading text; empty text; raw pop-ups. | **No real LINE, Instagram or Facebook connection.** Only a "manual" test channel exists. No unread dots, no last-message preview or time, no search, no archive. | **Real data store, demo input.** The only way to get a message in is the demo button. |
| 13 | **Conversation** (`messages/[id].tsx`) | "Ask AI"; "Check Calendar" (for booking topics); message bubbles with translation; "Translate Latest"; "AI Draft Reply"; reply box; "Approve AI Draft & Send"; "Send As Owner"; private note + "Save Note". | Loading; "Conversation not found"; raw pop-ups. | **"Send" doesn't reach a real client** (no channel connected). No photos, no saved replies, no "book this person" button that fills in the booking, no link to the client page, no mark-as-done. | **Real** saving, AI and translation; **no real delivery**. |
| 14 | **Content** (`content/index.tsx`) | "Create"; "Refresh"; tap a post → post page. Shows status, format, goal, AI reason. | Loading; empty: "No drafts yet"; raw pop-up. | No content calendar (month view), no filters, no photo thumbnails. | **Real.** |
| 15 | **New Post** (`content/new.tsx`) | Goal chips (bookings, reach…); title (pre-filled "Next recommended post"); details; "Review My Media" (AI picks photos); platform chips (instagram, facebook, tiktok, manual); "Create Strongest Draft"; "Cancel". | "Reviewing…"; pop-ups. | **Effectively blocked:** AI only uses photos marked "OK for marketing", and **the app has no way to mark a photo that way** (every import is saved as "unknown"). So the AI will keep saying there's nothing suitable. No manual "choose these photos". | **Real** (AI on the server), but not usable end to end. |
| 16 | **Post page** (`content/[id].tsx`) | Edit Hook, Caption, Call to action (saves when you leave the box); hashtags shown; schedule box typed like `2026-08-22T19:00:00+09:00` + "Schedule This Version"; "Publish With Safe Demo" (manual only); "Approve Post"; "Ask AI About This Post". | "Loading content…" (forever if it fails). | Date/time picker, preview that looks like Instagram, real publishing to Instagram/Facebook/TikTok, "copy caption + open Instagram" for manual posting, a reminder when it's time to post. | **Real** saving; publishing is **demo**. |
| 17 | **Media** (`media/index.tsx`) | "Import"; "Refresh"; grid of photos (up to 24 previews) with name, linked client and marketing label. | Loading; empty: "No media yet"; raw pop-up. | **Photos can't be tapped**: no full-screen view, delete, link to client, before/after tag, or "OK for marketing" switch (the server supports it). No albums or filters. | **Real.** |
| 18 | **Add Media** (`media/import.tsx`) | "Choose From Photos" (up to 20 photos/videos); "Take a Photo"; "Cancel". Asks for photo/camera permission only when used. Can link to a client. | "Saving…"; permission and error pop-ups. | Choose type (before / after / healed / consultation); marketing permission; progress bar for big videos; compress photos. Always saves as "other / unknown". | **Real** (uploads). |
| 19 | **Analytics** (`analytics.tsx`) | "Refresh"; 30-day Views, Saves, Inquiries, Bookings; "evidence quality"; best posting time; best post; "Give Me One Next Move" (AI coach); "Edit Marketing Profile". | Loading; "—" for no data; raw pop-up. | Numbers only come in if something sends them to the server. **No Instagram/Facebook data connection**, so it stays mostly empty. No business numbers (new clients, rebook rate, no-shows, income trend). No charts, no date range, no monthly report. | **Real** server; little real data. |
| 20 | **Marketing Profile** (`marketing-profile.tsx`) | Goal chips, experience chips, ideal client, service area, city, country, "Save Marketing Profile". | No loading state; pop-ups. | Fine for now. Could hold your Instagram/LINE handles and brand words. | **Real.** |
| 21 | **Finance** (`finance.tsx`) | "Refresh"; 30-day income; by payment method; last 10 ledger entries. | Loading; empty texts; raw pop-up. | Read only: no way to add an expense, deposit or refund here. No monthly view, no export for your tax accountant, no "who still owes me". Two cards are explanation text only. | **Real.** |
| 22 | **Automations** (`automations.tsx`) | Switch each rule on/off (Booking confirmation, Aftercare follow-up, Healing follow-up are auto-created); "Process Due Jobs" (labelled "prototype"); recent jobs. | Loading; pop-ups. | Rules only create a to-do for you; **nothing is actually sent to clients**. No appointment reminders, no "edit the message", no EN/JP templates, no touch-up reminder. "Process Due Jobs" is a test button. | **Real** rules; sending not connected. |
| 23 | **Ask AngelOS** (`ai.tsx`) | "Settings" link; chat; "Send to AngelOS"; when the AI proposes an action: "Approve" / "Cancel". | "Working…"; pop-ups. | The 3 shortcut chips ("What needs attention?", "Draft a reply", "Prepare content") **do nothing when tapped**. No voice ("waiting on the device adapter"). No past chats. | **Real** AI. Shortcut chips are **fake**. |
| 24 | **AI Assistant settings** (`ai-settings.tsx`) | Name, personality (save when you leave the box); Low/Balanced/High; 6 role switches; 2 guidance switches; floating button On/Compact/Off. | Loading text; pop-ups. | "Floating AI button" setting exists but **no floating button exists** in the app. AI language not set here. | **Real** saving. Floating button option is **fake** in effect. |
| 25 | **System Health** (`system-health.tsx`) | "Run Health Check"; 3 emergency switches (Pause AI, Pause automations, Emergency read-only); "Acknowledge" on items; list of connected parts. | "Checking…"; pop-ups. | Technical for a beauty owner; should become a simple "Needs attention" list, with the emergency switches tucked away. | **Real.** |
| 26 | **Send feedback** (`beta-feedback.tsx`) | 5 feedback types; message; 1–5 rating; "Angel may contact me" and "Allow a public quote" switches; "Send Private Feedback". | "Sending…"; pop-ups. | Rename to "Help & feedback"; add contact email and app version. | **Real.** |
| 27 | **Founder controls** (`founder-admin.tsx`, only you) | Platform numbers; beta-launch checklist; create beta invite (email, label, region, group) and copy the code once; revoke invite or access; read feedback; usage; feature switches; create 20% student discount code; recent workspaces. | No loading state; one error pop-up. | This is a business-owner admin tool. Better on a private web page than inside the App Store app. Invite codes must be copied by hand, with no share button. | **Real.** |

**Screens that don't exist yet (on GitHub):** booking detail, set new password / forgot password (local `A1`), profile, business info, business hours, time off, language, notifications, privacy, terms, delete account, help/about, paywall, academy (tab placeholder local `A1`), student screens (`SAP` §E), health/consent form, photo viewer, content calendar.

---

## (B) Missing features by area

Ref = where it's already listed (so it isn't new). "local" = being built on the laptop (`A1`).

### 1. Settings
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| S1 | A language switch (English / 日本語) that changes the whole app | Must before launch | L | UX H1, CHK "decide" |
| S2 | A business info page to change business name, address, phone, time zone and currency after setup (today it can only be set once) | Must before launch | M | UX F1 |
| S3 | Privacy policy and terms links inside Settings | Must before launch | S | UX A10, CHK 3 |
| S4 | "Delete my account" that really removes your login and data | Must before launch | M | UX A9, CHK 4 |
| S5 | A profile page with your name, photo and email | Should | M | UX F1 |
| S6 | Change password while signed in | Should | S | UX F2 |
| S7 | "Sign out" that asks "Are you sure?" and is easy to find | Should | S | UX A8 |
| S8 | Notification settings (what to be alerted about, quiet hours) | Should | S | UX F3 |
| S9 | Download all your data (clients, bookings, money) as a file. The cancel screen already promises "export", but no export exists | Should | M | new |
| S10 | Help & contact, app version, "What's new" | Should | S | UX F5 |
| S11 | Settings grouped in plain words: Account, Business, Plan, Notifications, Help, Legal (no "workspace" or "system health") | Should | S | UX F4 |
| S12 | Face ID / passcode lock, because client photos and health notes are private | Should | M | new |
| S13 | Light or dark look choice | Later | M | CHK "decide", UX F6 |

### 2. Users & Roles
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| U1 | A "student" member type that only sees the academy, never your clients or money | Should (must be done before the first student joins) | L | SAP batch 1 |
| U2 | Lock all studio data (clients, bookings, money, messages) to the owner only. Today the database knows only "owner" | Should (must be done before the first student or staff joins) | L | SAP §C |
| U3 | Invite someone from inside the app with a share link that opens the app. Today it's a code copied from the Founder screen | Should | M | new |
| U4 | A "People" list: who has access, their role, remove access | Should | M | new |
| U5 | A staff role (assistant artist or receptionist: calendar and clients, but no money or settings) | Later | L | SAP "room for staff" |
| U6 | One calendar per artist and booking a specific artist | Later | L | new |
| U7 | Move Founder controls to a private web page instead of the store app | Later | M | new |
| U8 | Sign in with Apple / LINE / Google (Apple sign-in becomes required if any social login is added) | Later | M | UX A11 |

### 3. Membership & Subscriptions
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| M1 | Real payment for the AngelOS plan through Apple in-app purchase. Today "Upgrade" just says "coming next" | Must before launch | L | new |
| M2 | Plans set up in App Store Connect in Japanese yen (monthly, yearly, free trial). Today prices are US dollars typed into the screen | Must before launch | M | new |
| M3 | A proper plan screen: what's included, price, trial length, "renews automatically" wording, links to terms and privacy (Apple checks this) | Must before launch | M | new |
| M4 | A "Restore purchases" button | Must before launch | S | new |
| M5 | Our server checks every Apple purchase and hears about renewals, cancellations and refunds from Apple automatically | Must before launch | L | new |
| M6 | Features open or lock based on the real Apple plan status (the server already has the full / read-only switch to connect to) | Must before launch | M | new |
| M7 | "Manage or cancel" opens Apple's own subscription page. Today's "Cancel subscription" button only changes our records and wouldn't stop Apple billing | Must before launch | S | new |
| M8 | Student 20% discount through Apple offer codes. Today's private code typed into the app can't discount an Apple purchase | Should | M | new |
| M9 | Decide plan tiers: Artist plan (business tools) and Student/Academy membership | Should | S | new |
| M10 | "Payment problem" notice with a link to fix it in Apple settings, plus a short grace period | Should | S | new |
| M11 | Selling courses to the public inside the app (Apple takes a share for digital courses) | Later | L | SAP "not in v1" |

### 4. Clients & Booking
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| C1 | Booking detail screen: tap a booking to Confirm, Reschedule, Cancel, Mark done or No-show (server already supports this) | Must before launch | M | UX B7, CHK §1 #13, local hold menu |
| C2 | Date and time pickers when booking (no more typing `2026-10-03`) | Must before launch | M | UX E3 |
| C3 | Search clients when booking (only the first 12 show today), and "add new client" from the booking screen | Must before launch | S | new |
| C4 | Edit a client's details (server already supports it) | Must before launch | S | UX B7 |
| C5 | Health & allergy questionnaire per client (medicines, pregnancy, skin conditions, past PMU) | Must before launch | M | new |
| C6 | Digital consent form the client signs on the phone, saved with the date (today consents can only be viewed, not added) | Must before launch | M | new |
| C7 | Before / after / healed photo timeline on each client's page (the database has these photo types; the client page shows no photos at all) | Must before launch | M | new |
| C8 | Record a deposit when booking (cash or bank), with the balance due on the day | Must before launch | S | new |
| C9 | PMU treatment record: area, pigment colours, needle, technique, numbing, reaction, per session | Should | M | new |
| C10 | Touch-up tracking: "due for touch-up" list 6–8 weeks after the first session, plus a yearly colour-boost reminder | Should | M | new |
| C11 | Aftercare instructions (EN/JP) sent to the client after the appointment, with day-by-day care tips | Should | M | CHK "later: send aftercare" |
| C12 | No-show and late-cancel policy: mark no-show, count per client, optional fee | Should | M | new |
| C13 | Edit, hide or delete a service; add description, photo, category and deposit amount | Should | M | new |
| C14 | Client list filters (new enquiry, active, due for touch-up) and search as you type | Should | S | new |
| C15 | Payment method picked from a list (cash, card, PayPay, bank transfer) instead of typed | Should | S | new |
| C16 | Tap to call, LINE or email a client from their page | Should | S | new |
| C17 | Past and upcoming bookings on each client's page | Should | S | new |
| C18 | Archive or delete a client | Should | M | CHK "later" |
| C19 | Online booking page clients open from your Instagram bio or LINE: pick a service and time, pay a deposit, fill in the health form | Should | L | new |
| C20 | Card deposits online with automatic refund rules | Later | L | new |
| C21 | Gift cards / vouchers | Later | M | new |
| C22 | Package prices (e.g. first session + touch-up) | Later | M | new |
| C23 | Ask for a Google review after the healed check | Later | S | new |
| C24 | Waitlist for cancelled slots | Later | M | new |
| C25 | Import clients from phone contacts or a spreadsheet | Later | M | new |
| C26 | Receipts for clients (PDF or LINE) | Later | M | new |

### 5. Calendar
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| K1 | Day, week and month views, moving forward and back in time (today: one list of the next 7 days only) | Must before launch | M | new |
| K2 | Opening hours screen (server already supports it) | Must before launch | S | new |
| K3 | Block time off: holidays, personal time, academy class days, model days (server already supports it) | Must before launch | S | new |
| K4 | Real "Today" on Home: today's appointments, the next client and the time | Must before launch | S | new |
| K5 | Colours by status (confirmed, waiting, done, cancelled) and by service | Should | S | UX G3 |
| K6 | Tap an empty time to start a booking | Should | M | new |
| K7 | Show your AngelOS bookings in your iPhone calendar | Later | M | new |
| K8 | Drag a booking to move it | Later | M | new |

### 6. Messaging (LINE / Instagram / Facebook)
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| G1 | Connect your LINE Official Account so real client messages arrive and replies really send | Should | L | new |
| G2 | Connect Instagram DMs and Facebook Messenger (needs Meta business approval) | Should | L | new |
| G3 | Unread dots, last message and time on each conversation, newest first | Should | S | new |
| G4 | Saved replies in English and Japanese (prices, directions, aftercare, deposit policy) | Should | S | new |
| G5 | "Book this person" button in a chat that opens booking with the client already filled in | Should | M | new |
| G6 | Mark a conversation done or archive it (server already supports it) | Should | S | new |
| G7 | Appointment reminders sent to the client (day before, 2 hours before) via LINE or email | Should | M | new |
| G8 | Send and receive photos in chat | Later | M | new |
| G9 | Email or text message for clients without LINE | Later | M | new |

### 7. Content & Social (Metricool-style)
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| X1 | Mark each photo "OK for marketing" or "private" (without it, AI post creation can never pick a photo) | Should | S | new |
| X2 | Tap a photo to see it full screen, tag it before/after/healed, link it to a client, delete it | Should | S | new |
| X3 | Content calendar: a month view of planned and posted content | Should | M | new |
| X4 | Date/time picker for scheduling posts (today typed like `2026-08-22T19:00:00+09:00`) | Should | S | new |
| X5 | Post preview that looks like Instagram (photo + caption) | Should | M | new |
| X6 | "Time to post" reminder, then copy caption and open Instagram in one tap (for Reels/Stories you post yourself) | Should | S | new |
| X7 | Saved hashtag sets in English and Japanese | Should | S | new |
| X8 | Choose your own photos for a post (not only AI's choice) | Should | S | new |
| X9 | Real automatic publishing to Instagram/Facebook (and later TikTok) | Later | L | new |
| X10 | Instagram/Facebook numbers flow in automatically (reach, saves, follows), plus best time to post from real data | Later | L | new |
| X11 | Business numbers in Insights: new clients, rebooking rate, no-shows, income trend, with charts | Should | M | new |
| X12 | Monthly report you can save or share | Later | M | new |
| X13 | Link-in-bio page (book, academy, LINE, Instagram) | Later | M | new |
| X14 | Watch other local studios' public posts | Later | L | new |
| X15 | Logo watermark on before/after photos | Later | S | new |

### 8. Academy & Students (Kajabi / Teachable / Skool-style)
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| A1 | Academy tab with your courses and a course builder (lessons with video, photos, written steps) | Should | L | SAP batch 2, local tab placeholder |
| A2 | Student "My courses", lesson screen and practice checklist with a progress bar | Should | M | SAP batch 2 |
| A3 | Students send practice photos and you reply with feedback ("approved" / "try again") | Should | M | SAP batch 3 |
| A4 | Student progress at a glance for you (who is behind, who finished) | Should | S | SAP §3 |
| A5 | Class schedule for students (in-person training dates, model days) | Should | S | new |
| A6 | Certificate (PDF with name, course, date, your signature) when a student finishes | Later | M | SAP "not in v1" |
| A7 | Student community feed or group chat | Later | L | SAP "not in v1" |
| A8 | Short quizzes on theory (hygiene, colour theory) | Later | M | SAP "not in v1" |
| A9 | Lessons unlock by date or after your approval | Later | S | SAP open question |
| A10 | Student documents: training contract, payment plan, signed agreement | Later | M | new |
| A11 | Alumni area with refresher videos after the course ends | Later | M | new |
| A12 | Live class link (video call) inside the lesson | Later | S | new |

### 9. Notifications
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| N1 | Push notifications at all: ask permission at the right moment, save the phone, send from the server (none of this exists today) | Should | L | UX F3 |
| N2 | Alerts for a new client message, a new booking request and items needing attention | Should | M | new |
| N3 | Evening summary of tomorrow's appointments, or morning agenda | Should | M | new |
| N4 | "Payment problem" alert for your AngelOS plan | Should | S | new |
| N5 | In-app list of recent alerts (bell) | Later | M | new |
| N6 | Number badge on the app icon | Later | S | new |
| N7 | Student alerts: new lesson, feedback ready | Later | S | SAP |

### 10. Apple App Store must-haves
| # | Missing feature | Priority | Size | Ref |
|---|---|---|---|---|
| P1 | Remove every demo/test item from the store version: "Activate Demo Plan", "Create Demo Inquiry", "Publish With Safe Demo", "Process Due Jobs (prototype)", "Private Beta" labels | Must before launch | S | new |
| P2 | Open sign-up for paying customers. Today nobody can use the app without your private invite code; keep invites for students only | Must before launch | M | new |
| P3 | Apple privacy answers (what data is collected, including screen-usage tracking and AI processing) and the required privacy file in the app | Must before launch | S | new |
| P4 | Reviewer test account with sample data | Must before launch | S | CHK 5 |
| P5 | App icon, splash and store screenshots | Must before launch | M | CHK 1, 2 |
| P6 | iPad decision: the app says it supports iPad, so Apple will test it there and need iPad screenshots. Design for iPad or switch it off | Must before launch | S | new |
| P7 | Support web page, contact email, age rating and category (Business) | Must before launch | S | new |
| P8 | Kind error messages and a clear "You're offline" message; server calls give up after a sensible wait instead of loading forever | Must before launch | S | UX D1, CHK 10–11, local |
| P9 | Proper screen names, hold menus confirmed on the phone, forgot password | Must before launch | S | UX B4, A1; CHK 8; local |
| P10 | Every button readable by VoiceOver and large text works | Must before launch | M | UX G1–G2, CHK 12–13 |
| P11 | Keyboard doesn't cover the fields you type in | Must before launch | S | UX E1 |
| P12 | Setup moves you on after "Create Workspace" (today it leaves you stuck on the same screen) | Must before launch | S | new |
| P13 | Make sure the app ID `com.angelos.app` and the name "AngelOS" are yours on the App Store | Must before launch | S | new |
| P14 | Japanese App Store listing (name, description, screenshots) | Should | M | new |

### Counts
| Priority | Items |
|---|---|
| Must before launch | **36** |
| Should | **54** |
| Later | **33** |
| **Total** | **123** |

---

## (C) Top 15 "build next", in order

| # | Build next | Why now | Covers | Size |
|---|---|---|---|---|
| 1 | **Put the laptop design work (A1) on GitHub**: tabs, screen names, forgot password, eye button, kind errors, hold menus | It's the base for everything else, and today it exists on one laptop only | P8, P9, local A1 | S |
| 2 | **Booking detail + booking actions** (confirm, reschedule, cancel, done, no-show) with date/time pickers and client search | Booking is the daily job, and the server is already ready | C1, C2, C3 | M |
| 3 | **Real calendar**: day/week/month, opening hours, time off; real "Today" on Home | A studio app's heart. The server already has hours and blocks | K1–K4 | M |
| 4 | **Client essentials**: edit client, health questionnaire, signed consent form | Needed for PMU safety and protection; professional booking apps all have it | C4, C5, C6 | M |
| 5 | **Before/after/healed photos** on the client page, plus "OK for marketing" per photo | Your work *is* the photos; this also unblocks AI post creation | C7, X1, X2 | M |
| 6 | **Remove demo/beta items, open sign-up, fix the Setup dead-end** | Apple rejects apps with demo buttons, and a paid app can't need a private code | P1, P2, P12 | S–M |
| 7 | **Apple subscriptions**: yen plans, plan screen, buy, restore, manage via Apple, server check, features open/lock | No income without it, and Apple requires its own payment system for this | M1–M7 | L |
| 8 | **Account & legal**: delete account, privacy & terms, data download | Apple will reject without delete account and privacy | S3, S4, S9 | M |
| 9 | **Business info + profile in Settings**, plus deposit recording | You can't change your business name or currency today; deposits are standard in PMU | S2, S5, C8 | M |
| 10 | **English / 日本語 switch** (main screens first) | Your clients, students and store are in Japan | S1, P14 | L |
| 11 | **App Store package**: privacy answers, icon/screenshots, reviewer account, iPad decision, support page, VoiceOver, large text, keyboard | The final launch checklist | P3–P7, P10, P11, P13 | M |
| 12 | **Push notifications**: new message, new booking, tomorrow's agenda, notification settings | Premium apps tell you what matters without opening them | N1–N4, S8 | L |
| 13 | **LINE Official Account connection** + appointment reminders + aftercare messages | LINE is how Japan talks; it makes Messages and reminders real | G1, G7, C11 | L |
| 14 | **Student area batch 1**: student role, in-app invite link, studio data locked to owner | Must come before any student logs in | U1–U4, SAP batch 1 | L |
| 15 | **Academy batches 2–3**: courses, lessons, checklist, practice photos and feedback | Turns the Academy tab into a real product for your students | A1–A4, SAP batches 2–3 | L |

---

## Method and limits
- Every file in `apps/mobile/app/` (27 screens + layout) was read in full, plus `src/lib` helpers, `app.json`, `package.json`, all 16 server controllers and the key database rules. Static reading only: I didn't run the app or see it on a phone.
- The laptop work (`feat/design-a1`) is not on GitHub, so I could not check it; items it covers are marked "local".
- Benchmarks (Metricool, Fresha, Vagaro, Booksy, Square Appointments, Kajabi, Teachable, Skool) are based on their well-known standard features; only items that fit a PMU studio + academy were kept. Ads management and multi-location features were left out on purpose.
- Japan rules about other payment methods in apps are changing; Apple in-app purchase is assumed as the safe default. Confirm with an adviser before choosing anything else.
