# AngelOS — Senior UI/UX screen review (20 Oct 2026, JST)
Review only. No code changed. Judged against `STRICT_UI_CHECKLIST.md` (updated 20 Oct).

## Sources and what counts as "current"
- **Folder dates:** every folder in `angelos-review/` has the same timestamp (17 Oct 13:24 JST, copied in together), so I ranked them by what they contain. **No Oct 18 phone builds exist on the box.**
- **Main web proof:** `full-audit/` (feat/design-a1 @ 1151482, 16 Oct, 71 screens × Day/Night at 390 × 844 @3x), plus `full-fix/iter3/` (the later re-shots of 10 screens) and `hd-build/` (Home, Analytics, AI and Voice in Night).
- **Main device proof:** Angel's **17 Oct iPhone screenshots** (12 at 1125 × 2436, all Night): Messages, Account, Plan, Privacy, Feedback, Help, Founder (×2), Analytics (platform picker open), Edit profile, Accounts/Connections, Clients. Where the phone and the web disagree, **the phone wins**: it is newer and it is what Angel sees.
- **Older and not used for verdicts:** `ui-oct16d/` and `home-cc/` show an older design (serif "Today", red + button, red/brick calendar blocks, "Powered by Netlify" pill). I list them only as a regression risk.
- **Routes:** branch `feat/design-a1` read through GitHub, read-only (head 4aa83a4). The route list matches the 66 routes in full-audit. The local `angelos-review/repo` is `main` @ a544313 (2 Oct) and is out of date.
- **Data caveat:** web shots use staging fixture data ("Sample ·", "Fixture …"), so detail screens (Client detail, Founder, AI) show "not in fixture" errors. That is harness data, but **the raw server text showing in a dialog is a real bug**.

**Legend:** ✅ pass · ❌ fail · ⚠️ partial · **N/C** = not checkable from a screenshot (haptics, motion, Reduce Motion, VoiceOver, Dynamic Type, keyboard, offline, function). No screen can fully pass the checklist yet, because **no device recording or Day/Night pair beside a mockup exists for any screen**.

---

## 1. Today / Home
Proof: full-audit day + night, hd-build night.
| Section | Result | Note |
|---|---|---|
| Locks | ⚠️ | Title and background OK, logo button bottom right, neutral colours. "Hi, Sample / Welcome back" eyebrow above "Good morning!" is a second title-like line |
| Design system | ⚠️ | Night cards are dark hairline (good). Card text is very small and the arrow buttons crowd the card corners |
| iPhone feel | N/C | |
| Content | ❌ | Fixture names; "Today" card copy was flagged earlier as fixed text |
| States | ❌ | No empty or loading proof |
| JP/EN | N/C | No JP shot |
| Accessibility | ⚠️ | Card sub-lines look below 13 pt; contrast in Night looks OK |
| Function | N/C | |
- **Missing (in scope):** empty and loading state; tap-through from each card to its screen, proven.
- **Improve (by impact):** 1) Pick one greeting line and drop the eyebrow. 2) Bigger card body text and one spacing step (16) between rows. 3) Even out the empty lower third (PREMIUM #5).

## 2. Clients
Proof: full-audit day/night/empty; Angel's phone (Night).
| Section | Result | Note |
|---|---|---|
| Locks | ❌ | Phone: small nav "Clients" plus a ghost large "Clients" (double title). Night has **white slabs** (search bar, rows) |
| Design system | ❌ | Unselected chips are dark text on black (≈2.6:1); row radius ≈28, not 20 |
| iPhone feel | ⚠️ | Back chevron missing or invisible at night (S2); the + is plain (good) |
| Content | ⚠️ | Real names on the phone (good). "__yk1119" and "0201chi" are handles shown as names |
| States | ⚠️ | Empty state exists, but at night its text is near-invisible |
| JP/EN | N/C | |
| Accessibility | ❌ | Chip and ghost-title contrast fail |
| Function | N/C | |
- **Missing:** a loaded Client detail (see 3); the status filters (New, Active, Touch-up due) need proof that they really filter.
- **Improve:** 1) One title + chevron. 2) Dark search bar and rows at night. 3) Use the chip rule. 4) Show the display name, with the handle as the secondary line.

## 3. Client detail
Proof: full-audit + full-fix/iter3 (error state only).
| Section | Result | Note |
|---|---|---|
| Locks | ⚠️ | iter3 has one header; still a **white dialog** in Night |
| Design system | ❌ | The disabled-looking "Client not found" field sits above a modal |
| iPhone feel | ⚠️ | Back chevron visible in iter3 |
| Content | ❌ | full-audit showed raw "not in fixture"; iter3 shows "Please try again in a moment." (better) |
| States | ⚠️ | Error state OK, but the dialog has **OK only, no Try again** |
| Others | N/C | |
- **No proof of the loaded layout.** Visuals not reviewed.
- **Missing:** a real-data pass; Try again.
- **Improve:** 1) Error inline on the screen, with Try again, instead of a modal. 2) Dark glass dialog at night.

## 4. Calendar (Day / Week / Month)
Proof: full-audit day/night for Day, Week, Month and empty.
| Section | Result | Note |
|---|---|---|
| Locks | ⚠️ | Plain + with no circle ✅; logo button ✅. The "October" title is a different style from the shared title (smaller, with icons on the line) — measure it |
| Design system | ❌ | Week grid at night: the hour labels and grid lines are near-invisible; the event blocks are tiny and grey |
| iPhone feel | N/C | |
| Content | ⚠️ | Day: blocks don't sit on the hour lines (PREMIUM #13). Month legend swatches don't match the grid marks (PREMIUM #14) |
| States | ⚠️ | Empty view exists; no loading proof |
| Accessibility | ❌ | Week and Month text at night is well under 4.5:1 |
| JP/EN, Function | N/C | |
- **Regression risk:** `ui-oct16d/calendar.png` shows red blocks and a red + button. That breaks the "no red" and "plain +" locks, so make sure it never ships.
- **Missing:** booking actions (confirm, move, cancel) from a block — in the screen map per FEATURE_GAP_REPORT; opening hours and days off shown on the grid.
- **Improve:** 1) Night contrast on the Week and Month grids. 2) Snap blocks to the hour lines. 3) Make the legend match the grid. 4) One spacing step between +, the logo button and the tab bar.

## 5. Social home
Proof: full-audit day/night (`social`, `content`).
| Section | Result | Note |
|---|---|---|
| Locks | ❌ | **White slabs at night** (numbers card, date strip, post card). `content` has a small "Social" nav title plus a large "Social" (double title). Big "Social" on `social` sits under an "OCTOBER 2026" eyebrow |
| Design system | ❌ | Selected date is a black block on white at night |
| Content | ⚠️ | "Sample · New lash lift results" is fixture |
| States, others | N/C / no proof | |
- **Missing:** none beyond the screen map.
- **Improve:** 1) Dark cards at night. 2) One title. 3) Decide which route is the real Social home (`social` vs `content`) and remove the duplicate.

## 6. Social composer (New post)
Proof: full-audit day/night.
| Section | Result | Note |
|---|---|---|
| Locks | ⚠️ | One title "New Post" (good). Night: **white text box and white chips** |
| Design system | ❌ | Chips and fields are not the Night field/chip tokens |
| iPhone feel | N/C | Keyboard overlap unproven |
| Content | ✅ | Clear labels (Content type, Platform) |
| Function | ❌ (risk) | Earlier report: posts "publish" as demo only. Approve before posting is unproven |
| Others | N/C | |
- **Missing:** an Approve-before-post confirmation and a "post scheduled" toast.
- **Improve:** 1) Night field and chips. 2) Prove the Approve step. 3) Pin the primary action above the keyboard.

## 7. Social grid (Instagram grid)
Proof: full-audit day/night.
- Locks ❌ (white tile at night); content ❌ (one placeholder tile only); states ⚠️ (no real empty copy); others N/C.
- **Improve:** 1) An honest empty state ("Connect Instagram to see your grid"). 2) A dark placeholder at night.

## 8. Social analytics (Analytics tab)
Proof: full-audit day/night, hd-build night, Angel's phone.
| Section | Result | Note |
|---|---|---|
| Locks | ⚠️ | Layout matches the locked one; IG/FB/LINE logos are the only colour ✅. **Phone: the platform picker is a white menu at night** |
| Design system | ⚠️ | Chips: on the phone, "Follows" selected = white (strongest) ✅ |
| Content | ⚠️ | Phone: "No views recorded…" text is cut off by the open menu; "Link clicks" empty state OK |
| States | ⚠️ | Honest empty states shown (good) |
| Accessibility | ⚠️ | Overline "LAST 30 DAYS · VS YOUR…" is truncated |
| Function | N/C | |
- No red numbers seen ✅.
- **Improve:** 1) Dark glass picker menu at night. 2) Fix the truncated overline. 3) Line up the Link clicks empty state with its neighbours.

## 9. Social accounts / connect (Accounts · Connections)
Proof: full-audit (`social_accounts`, `content_accounts`, `settings_connections`) and Angel's phone.
| Section | Result | Note |
|---|---|---|
| Locks | ❌ | Phone: small "Accounts" plus ghost "Connections" (double title, two names). **White cards at night** |
| Design system | ❌ | White cards; low-contrast subtitle |
| Content | ✅ | Phone copy is honest ("Sending replies from AngelOS is off; copy replies yourself") |
| Function | ⚠️ | Three routes show the same screen |
- **Missing:** none.
- **Improve:** 1) One name and one title. 2) Dark cards with the taupe "Connected" status. 3) Merge the duplicate routes.

## 10. Messages (incl. empty state)
Proof: full-audit day/night/empty; Angel's phone (filtered, Night).
| Section | Result | Note |
|---|---|---|
| Locks | ⚠️ | Shared title ✅, platform tabs ✅. **Phone: the empty "Nothing here" card is a white slab at night**; the tab row starts clipped (first chip cut at the left) |
| Design system | ❌ | White empty card; white search bar on the phone |
| Content | ✅ | "Nothing here / Try another filter" is honest |
| States | ⚠️ | Empty ✅, loading not shown |
| Accessibility | ⚠️ | "Try another filter" grey on white is low |
| Function | N/C | Approve-before-send unproven |
- **Missing:** none.
- **Improve:** 1) Empty state with no card (rule 6). 2) Start the tab row at the 20 pt inset with the first chip whole. 3) Dark search field at night.

## 11. AI assistant chat
Proof: full-audit (`ai`, `assistant`), hd-build night, gb-verify.
| Section | Result | Note |
|---|---|---|
| Locks | ⚠️ | `ai` reads the theme in Night ✅. **`assistant` route renders blank** in full-audit (Day and Night); gb-verify shows it filled — unstable |
| Design system | ✅/⚠️ | Rows are dark glass at night; the suggestion chips at the bottom are clipped at the right edge |
| Content | ⚠️ | "3 things are waiting for you, Sample" (fixture); the **"AI setup needs attention / not in fixture" dialog** in the after-tap shot shows raw server text |
| Function | N/C | Approve for drafts is shown as a row ("Approve 2 drafts") ✅ in concept |
- **Missing:** none.
- **Improve:** 1) Fix the blank `assistant` route or remove it. 2) Friendly error copy. 3) Make the chip row scroll with the first chip whole and only the trailing edge cut.

## 12. Voice orb
Proof: full-audit voice day/night, hd-build voice-speaking-sim night.
| Section | Result | Note |
|---|---|---|
| Locks | ✅ | Neutral orb; top-row layout as specified |
| Design system | ⚠️ | hd-build ring is crisp with fine filaments ✅. full-audit Day orb is a soft grey blob (the old look) |
| iPhone feel, motion, haptics, Reduce Motion | N/C | Needs a device recording |
| Content | ✅ | "Tap the orb to start" |
| Accessibility | ⚠️ | The Mute and close icons are small, grey-on-grey in Day |
- **Missing:** a speaking/listening state label (spec flag, awaiting Angel).
- **Improve:** 1) Ship the HD ring in both modes. 2) Device recording at 60 fps. 3) Stronger contrast on the button glyphs.

## 13. Meters / AI uses
Proof: **only `home-cc/sample-ai-meter.png` and `sample-profile-meter.png`** (older design, sample data, plus a raw "not in fixture" dialog).
- **No current proof.** Visuals not reviewed against the current design.
- From the old shot: green progress bars (❌ neutral only) and a "PROFILE & SETTINGS" eyebrow (❌ title lock).

## 14. Profile
Proof: full-audit day/night.
| Section | Result | Note |
|---|---|---|
| Locks | ⚠️ | Shared title "Profile" ✅. The layout looks like the locked one, but compare it to the mockup pixel by pixel |
| Design system | ✅ | Night rows are dark hairline |
| Content | ⚠️ | "TEST Studio", "Studio plan / FOUNDER" pills; "Clients" sits under BUSINESS |
| Others | N/C | |
- **Improve:** 1) Real account name and studio. 2) A pixel compare against the locked mockup.

## 15. Account
Proof: full-audit; Angel's phone.
- **Locks ❌:** small "Account" plus ghost "Your account" (double title); **white cards at night**; empty back circle on the phone.
- **Design ❌:** "Change password" looks disabled (grey on white).
- **Content ⚠️:** email line nearly invisible on black.
- **Accessibility ❌.** JP: the language toggle shows 日本語 ✅ (no JP screen shot). Others N/C.
- **Missing:** Delete account (needed for Apple; Help says it is under Account — **check it exists**).
- **Improve:** apply the profile-night-audit mockup exactly.

## 16. Edit profile
Proof: full-audit; Angel's phone.
- **Locks ❌:** no large title, white card and fields at night, **two empty circles** at the top on the phone.
- **Function ❌:** Save is unclear (web shows "Save" text; the phone shows a blank circle).
- **Improve:** chevron left, "Save" pill right, one title "Edit profile", dark card.

## 17. Help
Proof: full-audit; Angel's phone.
- **Locks ❌:** ghost "Help" title plus nav title; **white Q&A cards at night**.
- **Content ✅:** clear, honest answers.
- **Design ❌:** cards instead of the long-text rule (no card, 16/25).
- **Improve:** long-text layout; one title.

## 18. Feedback
Proof: full-audit; Angel's phone.
- **Locks ❌:** ghost "Help shape AngelOS" title plus nav "Feedback"; white cards and choices at night.
- **Design ⚠️:** the selected option is only an outline — weak state.
- **Function N/C:** send and success unproven.
- **Improve:** one title; chip-rule selection; dark field.

## 19. Privacy
Proof: full-audit, full-fix/iter3, Angel's phone.
- **Content ❌ (critical):** the phone and full-audit show **"[FILL IN: effective date]"** and other [FILL IN] lines and "Draft for review. This is not legal advice." iter3 (web) has clean text — **the phone build is behind.**
- **Locks ❌ on the phone:** white slab at night. iter3 Night: dark long-text ✅.
- **Improve:** ship the iter3 version; legal review of the JP/EN text.

## 20. Plan (Subscription)
Proof: full-audit (blank screen ❌), full-fix/iter3, Angel's phone.
- **Locks ❌ on the phone:** ghost header remnant; white cards; "Apply Student Discount" button and a private-token field at night on white.
- **Content ⚠️:** "Beta: free during testing" is honest ✅. The student discount code **can't work with Apple IAP** (FEATURE_GAP) — risk.
- iter3: clean single title, dark at night ✅.
- **Missing:** Restore Purchases (Apple requirement once paid plans exist — **would be new**; flag only).
- **Improve:** ship iter3; hide the discount until IAP is decided.

## 21. Founder
Proof: full-audit (error dialog), home-cc (old), Angel's phone ×2.
- **Locks ❌:** ghost "Founder controls" plus nav "Founder"; **white cards at night**.
- **Content ✅/⚠️:** real numbers (Workspaces 4, Paid 1, OpenAI $0.01), honest "Not Ready" gate ✅. Long dense paragraphs.
- **Design ⚠️:** chips (Overview / Invites & testers / Feedback) are clipped at the right edge.
- **Improve:** one title; dark cards; chip rule; shorter copy.

## 22. Login
Proof: full-audit day/night.
- **Locks ❌:** **Night shows a full white screen** (it ignores the theme). The logo is the flat charcoal mark, not the rose gold — confirm which mark belongs on Login.
- **Design ✅ in Day:** clean, 48 pt fields, a black primary button.
- **Content ✅.** Others N/C.
- **Improve:** a Night theme; decide the logo on Login.

## 23. Signup (also `register`)
Proof: full-audit day/night.
- **Locks ❌:** white at night.
- **Function ⚠️:** `signup` and `register` are duplicate screens. Earlier report: invite-only sign-up (Apple wants open sign-up or a reviewer login).
- **Improve:** one route; Night theme.

## 24. Forgot password
Proof: full-audit day/night.
- **Locks ⚠️:** Night is dark ✅ but has a **ghost large title** behind a small nav title.
- **Design ⚠️:** "Send reset link" looks disabled at night (grey on grey).
- **States:** no success proof.
- **Improve:** one title; a clear enabled state; a "Check your email" success state.

## 25. Other routes in the branch (not in the checklist's screen list)
academy (5 screens), ai-settings, automations, bookings (1/new/week), business-hours, finance, marketing-profile, media (3), messages/new, saved-replies, t1, notifications, onboarding, reports, reset-password, services (2), settings (+business), suggestions, system-health, terms, time-off.
- full-audit shows them in Day and Night. I did not review them screen by screen in this pass.
- full-audit/AUDIT.md lists the same systemic faults across them (S1 double title, S2 invisible title and chevron at night, S3 white cards at night).
- Treat them as **fail on locks** until re-shot.
- **Flag:** several (academy, finance, founder-admin, reports) may be outside the V1 screen map — Grok to confirm they stay.

---

## Overall top 10 (ranked by impact)
1. **Night white slabs everywhere on Angel's phone.** Cards, fields, search bars, menus, the empty-state card and dialogs on Clients, Account, Edit profile, Help, Feedback, Privacy, Plan, Founder, Connections, Messages empty and the Analytics picker. One shared Card/Field/Chip/Dialog component fix clears most of it.
2. **Double and ghost titles on every pushed screen.** Small nav title plus faded large title: Clients, Account, Connections, Help, Feedback, Founder, Forgot password, Social. One shared header with a back chevron.
3. **Invisible or empty back chevrons at night** (blank circles on the phone). People can get stuck.
4. **[FILL IN] placeholders in Privacy on the phone build.** Unshippable, and the phone build lags the web fix (iter3).
5. **Raw server text in error dialogs** ("not in fixture"), white modals, and no Try again (Client detail, AI, Founder, Meters).
6. **Login, Signup and Register ignore Night** (full white).
7. **Blank screens:** `assistant` and `subscription` render empty in full-audit.
8. **Calendar Week/Month at night is unreadable**, the blocks are off the grid, and the legend doesn't match. Also make sure the red blocks and red + in the old ui-oct16d build never return.
9. **Chip rule not applied:** dark-on-black unselected chips; clipped chip and tab rows (Messages, Founder, AI suggestions).
10. **No device proof at all.** No Day + Night pair beside a mockup, and no checks of the haptics, Reduce Motion, VoiceOver, Dynamic Type or JP. Also the app icon, splash and logo button are not checked on a real iPhone or in iOS 26 dark/tinted modes. Every screen fails §1 of the checklist until this exists.

## Screens with no proof (visuals not reviewed)
- **Client detail, loaded state:** only the error state exists.
- **Meters / AI uses, current design:** only an old sample build.
- **Every screen in Daylight on a real iPhone:** Angel's phone shots are Night only.
- **Every screen in Japanese:** no JP screenshots anywhere.
- **Loading, offline and success-toast states:** none captured for any screen.
- **Logo on device:** home screen icon, splash, in-app logo button on a real iPhone, iOS 26 dark and tinted icon modes.
- **Social composer:** keyboard-up state and the Approve/scheduled flow.
- **Forgot password:** success state.
- **Voice orb:** device recording (motion, haptics, Reduce Motion).
