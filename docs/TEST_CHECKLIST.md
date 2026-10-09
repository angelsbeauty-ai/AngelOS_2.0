# AngelOS — Angel's test checklist

Branch `feat/design-a1`. Test on laptop Chrome and iPhone Safari.
Before testing: the database updates listed at the bottom must be approved and applied first. Until then, those screens say "needs database update".

## DONE vs LEFT (kept up to date)
**DONE:** Messages inbox (LINE ready but off) · AI learns your reply style · AngelOS suggests · AngelOS memory (summaries only) · B0 Social: campaigns, 30-day plan, ideas, hashtag sets, before/after maker (web), LINE broadcast drafts, "Copy caption & open" + "Mark as posted", Social insights basics · B1–B7: Clients (filters, health form, consent, archive), Bookings (detail, no-show, reschedule, payments/deposits), Calendar day/week + hours + days off, Services edit/hide, Money (income, expenses, who owes, CSV), Business insights, Reminder messages (suggest only) + server task schedule · C1 AngelOS tools with approval cards · C2 your voice used everywhere · C3 "Ask" button on every screen · Live voice (web, off until the OpenAI key is set) · B9 Student role + Academy (courses, lessons, video, checklist, progress, practice photos, review, student invites)
**Also DONE:** B10 setup wizard + invite links · B11 Settings + English/日本語 · B12 honest Beta plan screen
**LEFT (in order):** Design polish + smaller web bundle

---

## 1. Messages (inbox)
1. Open **Messages** → tap **+ New conversation**. Pick a client, choose LINE, paste a Japanese message, save.
2. Open it and tap **Draft reply**. The Japanese draft shows its **English meaning** next to it.
3. Change one word. **Approve** stays grey until you tap **Update English meaning**. Then tap **Approve**.
4. Tap **Copy & open LINE**, send it in LINE yourself, then tap **I sent it**. It now shows as sent.
5. Tap **Translate** on a message. Add a private note. Tap **Mark done**, then **Archive**. Try the filters All / Unread / Needs reply / Done / Archived.
6. **Saved replies**: add the starter replies, edit one, translate English → Japanese.
7. Tap **Book this person** in a conversation → the booking form opens with the client filled in.
8. **Settings → Connections**: LINE says "Not connected yet"; Instagram and Facebook say "Needs Meta approval".

## 2. AngelOS learns your replies
1. **Settings → Assistant settings → Replies to clients**: pick a tone, emoji level and length; type a style note.
2. After about 3 approved replies, tap **Learn now** and read what AngelOS learned.
3. Send a similar reply 3 times (e.g. aftercare). It appears under **Repeated replies AngelOS noticed**. Approve it; it is now a saved reply.

## 3. AngelOS suggests
1. On **Today**, the **AngelOS suggests** card shows "Draft a reply" for unanswered messages and "Draft a post" if nothing is planned for 3 days.
2. Tap **Approve** on one: a draft opens. Nothing is sent or posted.
3. Tap **Dismiss** on another: it stays hidden for today.

## 4. AngelOS memory (summaries only)
1. **Assistant settings → What AngelOS remembers**: short sentences with counts, no message text.
2. Founder only: **Founder controls → AngelOS brain · anonymised**: topics with studio and request counts only.

## 5. Social (B0)
1. **Social → Campaigns** → **Plan 30 days** → confirm. About 12 drafts appear on the Social calendar on different days.
2. Create a campaign "Academy January intake" (goal Academy students, 2 weeks). Tap **Create & plan with AngelOS**. Several drafts appear on the calendar plus one LINE broadcast draft.
3. Open the LINE broadcast draft: Japanese text with the English meaning beside it. You see "Connect LINE to see how many friends this reaches" (or a real number if LINE is connected).
4. Open a post draft: see the Instagram-style preview. Tap **Approve post**. Pick a date and time with the pickers (no typing) and tap **Schedule**.
5. Tap **Copy caption & open Instagram**: Instagram opens and the caption is in your clipboard. Post it yourself, paste the post link, tap **Mark as posted**. It shows "Posted".
6. **Ideas for you**: tap **Make draft** on an idea → the composer opens with the title filled in.
7. **Saved hashtag sets**: save a set; in **New post** tap **+ set name** to add the tags.
8. **Before & after** (laptop Chrome): pick a client with photo consent and photos marked "OK for marketing", pick 2 photos, choose Side by side, 4:5, labels 日本語, logo on → **Make image** → **Use in a new post**. A client without consent shows "Needs photo consent".
9. **Insights**: the Social card shows posted/scheduled counts, new clients from social and their bookings, and "Connect Instagram to see this" for reach/likes.

---

## 6. Clients, bookings, calendar, money, reminders (B1–B7)
Clients
1. Clients → type part of a name, phone or email: the list filters as you type.
2. Tap the chips New / Active / Touch-up due / Archived: the list changes.
3. Open a client → tabs Overview / Visits / Notes / Money / Forms. Tap Call / Email / Instagram / LINE (if saved): the right app opens.
4. Edit → add LINE ID, Instagram, birthday (1990-05-21) → Save: shows on Overview.
5. Forms → Fill health form → answer every question (Japanese for the client, English for you) → type the name → Save. A "Yes" on blood thinners etc. shows "Health: check before treatment".
6. Forms → Add consent → choose Yes/No → type name → Save: consent list shows "signed <name>".
7. Visits → add a treatment with area, pigments, needle, numbing, reaction → it shows in history.
8. Overview → Archive client → it moves to the Archived chip; Unarchive brings it back.
Bookings and calendar
9. Calendar → Day view shows 08:00–21:00; grey = closed or outside hours. Tap Week, then Back/Today/Next.
10. Business hours → turn Sunday off, set Monday 10:00–19:00 → Save. Try booking outside hours: it asks "Book anyway?".
11. Days off & blocks → add a whole day off: that day can't be booked. Delete it: bookable again.
12. Tap a booking → Confirm (if a request) → Reschedule to a new time → it moves.
13. After the start time: Mark done, or No-show (asks first). Cancel asks first and sends nothing to the client.
14. Booking → Record deposit / Record payment (Cash, Card, PayPay, Bank transfer) → "Still to pay" goes down.
Services
15. Services → Edit → change price, add a deposit, turn "Show for new bookings" off → it disappears from New booking.
Money
16. Money → Today / This week / This month show only money received.
17. Record expense → pick Supplies + Cash → Save: shows in Recent with a minus.
18. "Who still owes" lists finished bookings not fully paid. Export CSV downloads a file (opens in Excel/Numbers).
Insights
19. Insights → "Your business": bookings, no-shows, new vs returning, rebook rate, money vs before (7/30/90 days).
Reminders (suggest only, never auto-sent)
20. Reminders → Today: day-before, aftercare (day 0/3/7), healing check, touch-up due, colour boost, birthday cards appear when due. Japanese ones show the English meaning.
21. Approve → opens the conversation with the message as a draft. Nothing is sent until you approve it there and copy/send it.
22. Message types → switch types on/off; Edit wording → change the English meaning → "Make Japanese version" → Save.
23. Home "AngelOS suggests" also shows these reminders, plus "Time to post" when a scheduled post's time has come.
24. Tasks tab: these run by themselves every 15 minutes and only make tasks for you (no "Process due" button anymore).

## 7. AngelOS assistant: tools, your voice, Ask everywhere, live voice (C1–C3)
1. Any screen → bottom-right "✦ Ask" → AngelOS opens knowing which screen you came from (on a client, it knows the client).
2. Tap an example chip, e.g. "What's on today?" → answer comes straight from your bookings (no approval needed, only reading).
3. "Who still owes me?" and "How much did I make this week?" → answers from your money records.
4. "Block tomorrow 2-4pm" → approval card → Approve → Calendar shows the block; Cancel instead → nothing changes.
5. "I spent 3000 yen on pigments" → approval card → Approve → Money → Recent shows the expense.
6. "Make a post about lip blush healing" → Approve → the post draft opens. It is NOT posted.
7. "Message Yuki Tanaka that her touch-up is due" → Approve → the conversation opens with a draft in her language (Japanese clients: Japanese only, English meaning shown for you). Nothing is sent until you approve it there.
8. Assistant settings → "Your voice": change tone/emoji → new captions, LINE drafts and message drafts follow it.
9. Live voice (laptop Chrome): AngelOS screen → "Talk to AngelOS" → Start talking → allow the microphone → talk → Stop. Until the OpenAI key is set on the server it says "Live voice is off". Voice is never recorded or saved and there is no transcript. iPhone app: says "works in the web app for now".

## 8. Academy and students (B9)
Owner
1. Academy tab → "New course" → title → Create → add lessons → open a lesson → add a YouTube/Vimeo link, text, checklist (one step per line) → Save.
2. Course → ↑ / ↓ moves lessons. Turn "Published" on (students only see published courses).
3. Academy → Students → "Make invite link" → send the link to a test student (use a second, throwaway email).
4. When they have joined: Students → tap a course chip under their name to add them to it.
5. Academy → "Practice photos to review" → Approve, or write a comment and tap "Try again".
Student (second account)
6. Open the invite link → sign up → enter the invite → you only see Academy and Settings tabs. Typing /clients in the address bar sends you back to the Academy.
7. Open the course → progress bar → open a lesson → watch the video → tick checklist steps → "Mark lesson done": progress goes up.
8. "Choose photo and send" → the teacher sees it; their reply shows under the lesson (Waiting / Approved / Try again).

## 9. Setup, settings, language, plan (B10–B12)
1. Sign up with a new email → the **setup wizard** opens: Business → Services → Hours → Done. Pick yen, Asia/Tokyo, a language.
2. In Services edit a preset price, tap Next; set opening hours; tap Finish. You land on Today.
3. **Settings → Founder Control Center → Invites**: choose **Business owner** or **Student**, tap Create. The link is copied/shared. Open it in a private window: the wizard (owner) or Academy (student) opens.
4. **Settings → Account**: change your name → Save. Switch **English / 日本語**: tabs and Settings change language and it stays after reload.
5. **Account → New password**: set one (8+ characters). **Delete account**: type DELETE, confirm. (Founder accounts can't be deleted here.)
6. **Settings → Business**: change business name, currency, time zone → Save.
7. **Settings → Help / Privacy policy / Terms**: they open. They are DRAFTS and still need legal review + your privacy contact email.
8. **Settings → Subscription** says "Beta: free during testing". No prices, no checkout, nothing can be charged.
9. Only the main tabs, Settings and a few screens are translated so far; other screens are English (LEFT).

## Database updates waiting for Angel's yes (written, NOT applied)
- 0015_v1_messaging_inbox.sql — saved replies; unread and archive for conversations.
- 0016_v1_ai_reply_style.sql — your reply style settings and suggested saved replies.
- 0017_v1_ai_suggestion_dismissals.sql — remembers "Dismiss" on suggestions for the day.
- 0018_v1_ai_brain_summaries.sql — summaries-only memory; private per studio; anonymous counts for the founder.
- 0019_v1_social_campaigns.sql — campaigns and saved hashtag sets.
- 0021_v1_roles_academy.sql — student role, Academy tables, private practice-photo storage, invite types; studio data (clients, bookings, money, messages, posts…) becomes owner-only (students can't see it). Current owners see no change.
- 0020_v1_clients_bookings_money.sql — client LINE/Instagram/birthday/archive, health forms, treatment details, deposits, service descriptions, expenses.

## Needs Angel's accounts
- Live voice: on the API host set AI_PROVIDER_MODE=openai and OPENAI_API_KEY (optional OPENAI_REALTIME_MODEL, default gpt-realtime). The key stays on the server; the browser only gets a 2-minute key.
- LINE: set LINE_MESSAGING_ENABLED=true, LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN on the API host; webhook `<API>/webhooks/line`; then Settings → Connections → Connect LINE.
- Instagram/Facebook posting and DMs: Meta app + approval. Until then: "Copy caption & open Instagram" and "Mark as posted".
