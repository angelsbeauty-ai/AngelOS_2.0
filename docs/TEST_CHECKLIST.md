# AngelOS — Angel's test checklist

Branch `feat/design-a1`. Test on laptop Chrome and iPhone Safari.
Before testing: the database updates listed at the bottom must be approved and applied first. Until then, those screens say "needs database update".

## DONE vs LEFT (kept up to date)
**DONE:** Messages inbox (LINE ready but off) · AI learns your reply style · AngelOS suggests · AngelOS memory (summaries only) · B0 Social: campaigns, 30-day plan, ideas, hashtag sets, before/after maker (web), LINE broadcast drafts, "Copy caption & open" + "Mark as posted", Social insights basics
**LEFT (in order):** B3 Clients · B2 Bookings · B1 Calendar · B4 Services · B5 Money · B6 Insights · B7 Reminders · C1–C3 AI assistant + live voice · B9 Academy/students · B10 Setup/invites · B11 Settings/日本語 · B12 Plan · Design polish + smaller web bundle

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

## Database updates waiting for Angel's yes (written, NOT applied)
- 0015_v1_messaging_inbox.sql — saved replies; unread and archive for conversations.
- 0016_v1_ai_reply_style.sql — your reply style settings and suggested saved replies.
- 0017_v1_ai_suggestion_dismissals.sql — remembers "Dismiss" on suggestions for the day.
- 0018_v1_ai_brain_summaries.sql — summaries-only memory; private per studio; anonymous counts for the founder.
- 0019_v1_social_campaigns.sql — campaigns and saved hashtag sets.

## Needs Angel's accounts
- LINE: set LINE_MESSAGING_ENABLED=true, LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN on the API host; webhook `<API>/webhooks/line`; then Settings → Connections → Connect LINE.
- Instagram/Facebook posting and DMs: Meta app + approval. Until then: "Copy caption & open Instagram" and "Mark as posted".
