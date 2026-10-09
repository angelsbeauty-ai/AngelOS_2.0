# GORDON PACKET: AngelOS V1 FULL (supersedes Batches 2–5 of GORDON_PACKET.md)
From Grok (review) to Gordon (build). Angel = human testing only. 9 Oct 2026 JST.
Base: `angelsbeauty-ai/AngelOS_2.0`, branch **`feat/design-a1` @ `b7af2e7`** (Batch 1 done).

## MISSION (3 lines)
1. AngelOS V1 is Angel's **AI business assistant** that runs Angels Beauty: clients, bookings and calendar, LINE/IG/FB messages, content and social, finance, reminders and automations. **The AI does the work; Angel taps Approve.**
2. Her **students** (Academy tab stays; student role) and **other beauty businesses** use the same app; **Angel also has founder controls**.
3. "Fully useful" = **everything works** + **final premium A1 design** on every screen (Greige & Rose Gold, liquid glass, iPhone feel, light mode, EN/JA) + **real AI ops**. Web first (Expo web), the same code then runs on iPhone.

**Main user and tester = Angel running Angels Beauty (PMU studio, Okinawa).** Build in this **priority order**:
**① Social media management + marketing (biggest)** → **② CRM (clients)** → **③ Booking & calendar** → **④ Messages inbox** → **⑤ AI assistant tying it all together**. Section A (design) and A0 fixes apply across all of them. If time runs short, finish the higher priority completely before starting the next.

## STANDING RULES
1. Branch **`feat/design-a1` only**. Normal commits and normal push. **No force push, no rebase or amend of pushed commits, no merge to main, no PR to main.**
2. **Do not touch `.env*`, Railway/EAS/Supabase settings, production, or billing.** If a step needs one, write the exact change under "ANGEL MUST DO" in your final report.
3. **DB migrations: write the files only.** Do **not** apply them to staging until Angel says yes (list them in the report).
4. **Ask Angel before any build, deploy or account that may cost money** (EAS builds, hosting plans, higher AI usage).
5. **Same error twice → stop** and report the command, the error and what you tried.
6. **Commit after each numbered section** (A1, A2 … B1 …) with message `feat(v1): <section> <short>`. Push after each commit.
7. **Report once at the end:** sections done or not done, commits, migrations waiting, ANGEL MUST DO list, and the Section D test checklist with ✅/❌.
8. After every section, the gate must be green: `npm --workspace @angelos/mobile run typecheck` · `npm run build:api` · `npm --workspace @angelos/mobile run export:web`. Typecheck through the workspace script (TS 6); the hoisted `npx tsc` 5.9 fails on `ignoreDeprecations`.
9. No fake data shown as real. Anything not connected says **"Not connected yet"** or **"Coming soon"**, never a pretend success.
10. Don't commit review docs into the repo root (see A0).

---
## A0. Review of Batch 1 (`b7af2e7`): fix these first
Verified read-only: typecheck ✅, web export ✅, Today now uses the real calendar ✅, phosphor duotone tab icons ✅, forgot-password web redirect ✅.
| # | Problem | File | Fix |
|---|---|---|---|
| 1 | **`notify()` does nothing on web** (`return;`), so on web "Sign in failed" and every error are invisible | `apps/mobile/src/lib/dialog.ts` | Build `src/components/DialogHost.tsx`: one app-level glass modal mounted in `app/_layout.tsx` and driven by `dialog.ts` (a promise queue). Used on **web and native** for a consistent A1 look (`11-cancel-dialog.png`). Keep native `Alert` only as a fallback if the host isn't mounted. Errors use Toast + `toFriendly()` |
| 2 | **64 `Alert.alert` left in 22 screens** | `ai-settings, ai, analytics, automations, beta-feedback, bookings/new, clients/[id], clients/new, content/[id], content/index, content/new, finance, founder-admin, marketing-profile, media/import, media/index, messages/[id], messages/index, onboarding, services, subscription, system-health` | Replace all of them. Check: `git grep -n "Alert.alert" apps/mobile` returns only `dialog.ts` |
| 3 | **Web bundle grew 1.7 MB → 7.2 MB** (965 → 4015 modules) because `phosphor-react-native` barrel imports pull in every icon | `(tabs)/_layout.tsx`, `(tabs)/index.tsx` | Create `src/components/icons.tsx` that re-exports only the icons used, through **deep imports** (e.g. `phosphor-react-native/lib/module/icons/House`; check the real path in `node_modules`) or as hand-made SVGs with `react-native-svg`. Target bundle < 2.5 MB |
| 4 | `signUp()` still has no `emailRedirectTo` | `app/login.tsx` | Same `redirectTo` helper as forgot-password → move it to `src/lib/auth-redirect.ts` |
| 5 | `app.json` web favicon points to `./assets/icon.png`, which **doesn't exist** | `apps/mobile/app.json` | Add the A1 icon (`/workspace/angelos-designer/logo-final-v2` → Angel provides the file) or remove the favicon line for now |
| 6 | Unused 171-byte placeholder PNGs and generator scripts | `apps/mobile/assets/tabs/*.png`, `scripts/gen-tab-icons*.mjs`, `scripts/convert-icons.mjs` | Delete if unused |
| 7 | Review docs committed into the repo root | `BUILD_PACKET_A1.md, FEATURE_GAP_REPORT.md, GORDON_PACKET.md, ICONS_FONTS.md, PALETTES.md` | `git mv` to `docs/design/` (normal commit, no history rewrite) |
| 8 | "Private Beta" still shown | `login.tsx:44`, `beta-feedback.tsx:15`, `onboarding.tsx:42` | → "Beta" pill on login only; remove elsewhere |
| 9 | Typography: success/critical tones dropped from forgot-password messages | `app/forgot-password.tsx` | Restore `tone="success"` / `tone="critical"` |

---
## SECTION A: DESIGN (every screen premium A1)
Source of truth: `/workspace/angelos-designer/final-A1/*.png` + `prototype/index.html` (clickable), and tokens in `apps/mobile/src/design/theme.ts` (already Palette 2). Rules: `/workspace/angelos-designer/BUILD_PACKET_A1.md` §2–§6, `design-system.md`, `ICONS_FONTS.md`.

### A1. Design system components (build once, use everywhere): `apps/mobile/src/components/`
- `ui.tsx`: finalize `ScreenTitle` (Cormorant 40), `SectionTitle`/`Overline`, `Card` (raised white, radius 28, `tokens.shadow`, 0.5 px highlight), `PrimaryButton` (charcoal pill, min 44), `SecondaryButton` (outline), `TextField` (label, error text, eye toggle for passwords, `autoComplete`), `Chip`/`Segmented`, `ListRow` (avatar initial, title, subtitle, chevron, press scale 0.97), `Avatar`, `Badge` (status colours: confirmed=success, request=warning, cancelled=charcoal3, no_show=error, done=tide), `StatTile` (Cormorant tabular numbers), `EmptyState` (duotone icon + one line + one action), `Skeleton` rows (pulse, reduced-motion = static).
- `Glass.tsx`: glass is only for the **tab bar, round header buttons, toasts, menus, sheets and dialogs** (max 3 layers, never per row, never glass on glass). Web: use CSS `backdropFilter: 'blur(20px) saturate(1.4)'` via style on web, with `ivory` tint + `highlightAll` border. iOS 26: `GlassView`; older iOS: `BlurView`.
- `Sheet.tsx` (bottom sheet, glass, radius 38, spring `motion.smooth`), `DialogHost.tsx` (A0#1), `Toast.tsx` (already there; add tones and the reduced-motion fade).
- `RowMenu.tsx`: long-press 350 ms → haptic `lift` (native only) + scale 1.035 + glass menu. **Web: also open on right-click (`onContextMenu`) and through a visible "⋯" button on each row** (hover users and touch users on web can't discover long-press).
- `DateField.tsx` / `TimeField.tsx`: web uses `<input type="date|time">` styled as `TextField`; native uses chips (today/tomorrow/+day) plus a time grid. **No typed `YYYY-MM-DD` anywhere.**
- `Header.tsx`: large-title header that collapses on scroll; glass round back/settings buttons (`04-today.png` top right).
- Motion: `src/lib/motion.ts` with press scale, list items fading in (stagger 30 ms, max 8), and screen transitions using the native stack defaults. Respect `AccessibilityInfo.isReduceMotionEnabled()`.
- Every interactive element gets `accessibilityRole` + `accessibilityLabel`; `maxFontSizeMultiplier={1.3}` on text.
- States on **every** data screen: `Skeleton` while loading → `EmptyState` → `ErrorState` (already there) with "Try again". Pull-to-refresh on native (`RefreshControl`), plus a refresh icon button on web.

### A2. Screen map (40 screens). M = mockup to match; R = no mockup, build with A1 rules from the closest mockup
| # | Route / file | Design source | Notes |
|---|---|---|---|
| 1 | Splash (`app/_layout.tsx` font gate) | M `00-splash.png` | Metal logo centred on pearl; web shows the same while fonts load (no blank screen) |
| 2 | `app/login.tsx` | M `01-login.png` | Eye toggle, "Forgot password?", separate **Create account** screen |
| 3 | `app/signup.tsx` **new** | R ← 01 | Name, email, password + confirm, rules hint, invite code field (prefilled from `?invite=`), terms/privacy links |
| 4 | `app/forgot-password.tsx` | M `02-forgot-password.png` | |
| 5 | `app/reset-link-sent` (state inside 4) | M `02b-reset-link-sent.png` | |
| 6 | `app/reset-password.tsx` | M `03-set-new-password.png` | Eye toggles, strength hint |
| 7 | `app/session-expired` (state on login) | M `15-session-expired.png` | Uses `consumeSignedOutReason()` in `src/lib/session.ts` |
| 8 | `app/onboarding.tsx` → **setup wizard** | R ← 13 | Steps: business → services → hours → done (B10) |
| 9 | `app/(tabs)/index.tsx` Today | M `04-today.png` | Real data only (A3) |
| 10 | `app/(tabs)/clients.tsx` → `clients/index.tsx` | M `05-clients.png` | Live search, filter chips (All · New · Active · Touch-up due), A–Z |
| 11 | `app/clients/[id].tsx` | M `06-client-detail.png` | Tabs inside: Overview · Photos · Forms · History · Money |
| 12 | Client long-press menu | M `07-client-menu.png` | Message, Book, Add note, Send aftercare, Archive (now real, see B3) |
| 13 | `app/clients/new.tsx` + `app/clients/[id]/edit.tsx` **new** | R ← 06 | Same form, EN/日本語 segmented |
| 14 | `app/clients/[id]/health.tsx` **new** | R ← 06 | Health questionnaire (B3) |
| 15 | `app/clients/[id]/consent.tsx` **new** | R ← 11 | Consent + typed-name signature |
| 16 | `app/media/[id].tsx` **new** photo viewer | R ← 06 | Full screen, tag, marketing toggle, link client, delete |
| 17 | `app/(tabs)/calendar.tsx` → `calendar.tsx` | M `08-calendar.png` | Day + Week (B1) |
| 18 | `app/bookings/[id].tsx` **new** | M `09-booking-detail.png` | |
| 19 | Booking long-press menu | M `10-booking-menu.png` | |
| 20 | Cancel dialog | M `11-cancel-dialog.png` | Via DialogHost |
| 21 | `app/bookings/new.tsx` | R ← 09 | Sheet-style, client search, DateField/TimeField, deposit |
| 22 | `app/business-hours.tsx` **new** | R ← 13 | Per weekday toggle + open/close |
| 23 | `app/time-off.tsx` **new** | R ← 08 | Holiday, personal, class day, model day |
| 24 | `app/services.tsx` + `app/services/[id].tsx` **new** | R ← 05 | List + edit/hide |
| 25 | `app/(tabs)/academy.tsx` | M `12-academy-empty.png` | Owner: course list + "New course"; student: My courses (B9) |
| 26 | `app/academy/[courseId].tsx` + `app/academy/lesson/[id].tsx` **new** | R ← 12 | |
| 27 | `app/settings.tsx` | M `13-settings.png` | Groups: Account · Business · AI · Plan · Notifications · Language · Help · Legal |
| 28 | `app/settings/profile.tsx`, `settings/business.tsx`, `settings/password.tsx`, `settings/delete-account.tsx`, `legal/privacy.tsx`, `legal/terms.tsx` **new** | R ← 13 | |
| 29 | Error state (all screens) | M `14-error.png` | `ErrorState` |
| 30 | `app/ai.tsx` Ask AngelOS | R ← 04 + 09 | Central assistant (C3) |
| 31 | `app/ai-settings.tsx` "Assistant settings" | R ← 13 | Remove the "floating button" option (no such button) |
| 32 | `app/messages/index.tsx` Inbox | R ← 05 | Rows: avatar, name, channel badge (LINE/IG/FB/Manual), last line, time, unread dot |
| 33 | `app/messages/[id].tsx` Conversation | R ← 06 | Bubbles, AI draft card, Approve & send, "Book this person" |
| 34 | `app/(tabs)/social.tsx` → `content/index.tsx` **Social hub** (5th tab) | R ← 08 | Month calendar, week list, drafts, ideas (B0.1) |
| 34b | `app/content/before-after.tsx` **new**, `app/content/campaigns.tsx` **new**, `app/settings/connections.tsx` **new** | R ← 06 / 08 / 13 | B0.3, B0.5, B0.4 |
| 35 | `app/content/new.tsx`, `app/content/[id].tsx` composer | R ← 09 | EN/JA caption tabs, platform variants, IG-like preview, schedule (B0.2) |
| 36 | `app/media/index.tsx`, `app/media/import.tsx` Photos | R ← 05 | 3-column grid, tag chips |
| 37 | `app/finance.tsx` Money | R ← 04 | StatTiles + list + "Record" sheet |
| 38 | `app/analytics.tsx` Insights | R ← 04 | Business numbers first, then content |
| 39 | `app/automations.tsx` Reminders & follow-ups | R ← 13 | |
| 40 | `app/marketing-profile.tsx`, `app/subscription.tsx` "Your plan", `app/system-health.tsx` "Needs attention", `app/beta-feedback.tsx` "Help & feedback", `app/founder-admin.tsx` "Founder controls", `app/+not-found.tsx` | R ← 13 | Founder controls: only when `/founder/me` = true |
Header titles: set a human title for every route in `app/_layout.tsx` (no `clients/[id]`, no `forgot-password`).

### A3. Today = real data only (`app/(tabs)/index.tsx`)
Hero: date + "Good morning, {firstName}". **Next appointment** card (time in Cormorant hero numbers, client, service, status badge, Confirm/Message buttons). Tiles: today's bookings count · unread messages (`/messaging/threads` where needs_owner) · this week's income (`/finance/overview?days=7`) · touch-ups due. **"AngelOS suggests"** card from C4 (3–5 items, Approve). "Later today" list. Remove "AI preview" (already gone). Empty day → EmptyState "No bookings today · New booking".

### A4. Labels clean-up
Remove from owner/student view: "Create Demo Inquiry", "Publish With Safe Demo", "Process Due Jobs (prototype)", "Activate Demo Plan", typed "$49/month · 14-day trial" (read price from `/subscription`), "Private Beta". Founder-only "Test tools" section in Founder controls keeps the demo buttons.

---
## SECTION B: FEATURES (in Angel's priority order)
Order: **B0 Social & marketing → B3 CRM → B1/B2/B4 Booking, calendar, services → B8 Messages → (Section C AI)**, then B5 Finance, B6 Analytics, B7 Automations, B9 Academy/students, B10 Setup/invites/founder, B11 Settings/EN-JA, B12 Plan.
Migrations go to `supabase/migrations/0014_v1_*.sql` onward. Follow the RLS pattern in `0003_crm.sql` (`is_workspace_member`). **Write the files only; Angel's yes is needed before applying to staging.** Update `scripts/verify-migrations.mjs` if it lists files.

### B0. SOCIAL MEDIA MANAGEMENT + MARKETING (priority ①, Metricool-style for a PMU studio)
Existing base: `apps/api/src/content/*` (drafts, variants, `review-media`, schedule, `publishing-adapter.ts` = `ManualDemoPublishingAdapter`), `apps/api/src/analytics/*` (content metrics, marketing coach, marketing profile), `apps/api/src/media/*`, app `app/content/*`, `app/media/*`, `app/analytics.tsx`, `app/marketing-profile.tsx`.

**B0.1 Content hub (new tab-level screen `app/content/index.tsx` → "Social")**
- Reach it from a Today tile "Social" and a glass shortcut. Add a 5th tab **"Social"** in `app/(tabs)/_layout.tsx` (Today · Clients · Calendar · Social · Academy); route file `app/(tabs)/social.tsx` re-exports `content/index`. Students don't see it.
- Views: **Month calendar** (dots per platform, colour by status: idea / draft / approved / scheduled / posted / failed), **Week list**, **Drafts**, **Ideas**. Tap a day → create a post for that date. Drag to move on web (later; for now "Move date" in the ⋯ menu).
- Filters: platform (IG feed, IG Reel, IG Story, FB, LINE, TikTok), goal (bookings, academy students, trust, reach), language (EN/JA/both).

**B0.2 Post composer (`app/content/new.tsx` + `app/content/[id].tsx`)**
- Pick media yourself (grid from the library, multi-select, reorder) **or** "Let AngelOS choose" (existing `review-media`).
- **AI caption EN + JA side by side** (a tab per language): hook, caption, CTA, hashtags. Buttons: Shorter · Warmer · More professional · Add price · Add booking link · Regenerate. Japanese = friendly salon tone (see C2).
- **Per-platform variants** from one post: IG feed (2,200 chars, 30 hashtags max), Reel caption + on-screen text ideas, Story text (3 frames), FB post, LINE broadcast text (short + link), TikTok caption. Character counters and warnings.
- **Preview** that looks like Instagram (square/4:5 crop, avatar, caption fold "…more"), FB and LINE bubble.
- **Schedule** with DateField/TimeField + "Best time" suggestion (from analytics, or default JST 19:00–21:00 until there is data). Status flow: draft → approved (Angel taps) → scheduled → posted.
- **Saved hashtag sets** EN/JA (migration below), brand words from `marketing-profile`.

**B0.3 Before/after post maker (`app/content/before-after.tsx` new)**
- Pick a client → photos tagged before/after/healed (only `marketing_permission = granted` + a client photo consent on file; otherwise show "Needs photo consent", linking to B3 consent).
- Layouts: side-by-side, top/bottom, 3-step (before · after · healed), slider-style carousel pair. Options: Angels Beauty logo watermark (corner, 40% opacity), "Before / After" labels EN/JA, crop 1:1 / 4:5 / 9:16, face-blur toggle (eyes-only crop as the simple version).
- Rendering: on web use a `<canvas>`; on native use `react-native-view-shot` (needs a native module, so **ask Angel before any EAS build**; web first). Upload the result as a new media asset (`role = content_source`) and open it in the composer with an AI caption.

**B0.4 Publishing (real where the APIs allow)**
| Platform | What's possible | What Gordon builds | Needs from Angel |
|---|---|---|---|
| **Instagram (feed, carousel, Reels)** | Instagram Graph API Content Publishing works for **Business/Creator accounts linked to a FB Page**. In **Meta app Development mode it works for accounts with a role on the app (Angel's own IG) without App Review**. Other studios need App Review later | `MetaPublishingAdapter` in `apps/api/src/content/publishing-adapter.ts`: create media container → publish; Reels via `media_type=REELS` + `video_url` (signed URL from `media/:id/export-url`); poll status; store `providerPostId`, permalink. OAuth connect flow `GET /connections/meta/start` + callback; tokens stored encrypted server-side (new table `social_connections`) | Meta developer app, IG Business account linked to FB Page, App ID/secret set in Railway env by Angel (`META_APP_ID`, `META_APP_SECRET`) |
| **Instagram Stories** | API story publishing is limited, so treat it as **manual** | "Story kit": download images + copy text + reminder at the scheduled time | — |
| **Facebook Page** | Pages API posting works with page token (same Meta app) | Same adapter, `/{page-id}/feed` and `/photos` | Same as above |
| **LINE Official Account** | **Broadcast / narrowcast** via Messaging API (counts toward the OA monthly free message quota) | `LineBroadcastAdapter` (`POST /v2/bot/message/broadcast`), text + image; schedule via cron. **Always show the estimated message count before Approve** | LINE OA + Messaging API channel; token in Railway env by Angel |
| **TikTok** | Direct posting needs an app audit | Manual: download video + copy caption + reminder | — |
- The scheduler: `@nestjs/schedule` cron every 5 min publishes `scheduled` variants whose time has passed **only if approved**; idempotency key = variant id; on failure, status `failed` + a Needs-attention item + a "Post manually" fallback.
- Until connected: the button says **"Copy caption & open Instagram"** (web: clipboard + `https://instagram.com`; native: `instagram://` deep link) plus "Mark as posted" (asks for the permalink so analytics can match it). No fake "published".
- `app/settings/connections.tsx`: Instagram, Facebook, LINE, TikTok cards with honest status, a Connect button and what each needs.

**B0.5 Campaigns & ideas (`app/content/campaigns.tsx` new)**
- Campaign = goal + dates + offer + posts (e.g. "November brows model days", "Academy January intake", "Year-end touch-up push"). The AI proposes a 2–4 week plan: N posts across platforms + 1 LINE broadcast + Story kit, all as drafts on the calendar for approval.
- **Ideas bank:** AI-generated weekly ideas from Angel's real data (newest healed results, top services, slow days in the calendar, seasonal Japan dates: 成人式, Golden Week, お盆, 年末). Each idea → "Make draft".
- 30-day plan generator: one tap fills the next 30 days with a balanced mix (results 40% / education 25% / behind-the-scenes 15% / testimonials 10% / offers & academy 10%), editable.

**B0.6 Social analytics (Metricool-like) in `app/analytics.tsx` → "Insights › Social"**
- When Meta is connected: pull IG insights (reach, impressions/views, likes, comments, saves, shares, profile visits, follows) per post + account follower trend via a daily cron → existing `RecordContentMetricsDto` path. FB Page insights likewise. LINE: friends count and broadcast stats if available.
- Screens: overview (followers trend, reach, engagement rate, best posts), per-post table (sortable), **best time to post heat-map** (day × hour from her own data), content-type comparison (Reel vs carousel vs photo), **"bookings from social"** = inquiries/bookings whose client `source` is IG/FB/LINE in the same period. Not connected → "Connect Instagram to see this" (no fake charts).
- Monthly report image/PDF (later idea #12).

**Migration `0018_v1_social.sql`:** `social_connections` (workspace_id, provider, account_id, account_name, token_ciphertext, expires_at, status, scopes), `hashtag_sets` (workspace_id, name, language, tags text[]), `content_campaigns` (workspace_id, name, goal, starts_on, ends_on, offer, status), `content_posts.campaign_id`, `content_variants.platform` check extended to `instagram_feed, instagram_reel, instagram_story, facebook, line, tiktok, manual`, `content_variants.permalink`, `content_ideas` (workspace_id, title, angle, source, status). Token encryption: use a server-only key `SOCIAL_TOKEN_KEY` (**Angel sets it in Railway**).

### B1. Calendar: day/week, hours, days off
- `app/calendar.tsx`: segmented **Day | Week**, ‹ Today ›, a time grid 08:00–21:00 with appointment blocks coloured by status and time-off blocks hatched. Tap a block → `bookings/[id]`; tap an empty slot → `bookings/new?start=`. Web week view uses 7 columns at ≥ 768 px, otherwise a day list.
- `GET /workspaces/:id/calendar?start&end` exists. Add `GET business-hours` (exists) to shade closed hours.
- `app/business-hours.tsx` → `PUT /workspaces/:id/business-hours` (exists, DTO `set-business-hours.dto.ts`).
- `app/time-off.tsx` → `POST /calendar/blocks` (exists). **Add** `DELETE /workspaces/:id/calendar/blocks/:blockId` in `bookings.controller.ts`/`service.ts`.

### B2. Bookings
- `app/bookings/[id].tsx`: client (tap → client), service, time, status, price, deposit, notes, health form status. Actions: **Confirm** (`POST appointments/:id/confirm`), **Reschedule** (sheet with DateField/TimeField → `POST …/reschedule`, conflict → "Book anyway?" dialog with `overrideSoftConflict`), **Mark done** (`POST …/complete`), **No-show** (new), **Cancel** (dialog → `POST …/cancel`), **Message** (open the thread or create a manual one), **Record payment** (`POST finance/entries`).
- **Add API:** `GET /workspaces/:id/appointments/:appointmentId` (detail with client + service + finance via `finance/appointments/:id`), `POST …/no-show`, `PATCH …` (notes, price, deposit).
- **Migration `0014_v1_bookings.sql`:** add `no_show` to the appointment status check if missing; columns `notes text`, `deposit_amount numeric`, `deposit_method text`.
- `bookings/new.tsx`: client search over all clients (`GET clients?search=`), "+ New client" inline sheet, service picker, DateField/TimeField, notes, deposit. Uses `POST availability` first (exists). Prefill from `?clientId=&start=`.

### B3. Clients
- Edit: `app/clients/[id]/edit.tsx` → `PATCH clients/:id` (exists). Fields: name, phone, email, LINE ID, Instagram, birthday, language EN/JA, source, `do_not_auto_message`.
- **Migration `0015_v1_clients.sql`:** add `line_id, instagram_handle, birthday date, source text, archived_at timestamptz` to `clients`; table **`client_health_forms`** (id, workspace_id, client_id, answers jsonb, signed_name text, signed_at timestamptz, created_by, RLS member-only); add `signed_name, signature_method` to `client_consents` if absent.
- API: `GET/POST clients/:id/health-forms`, `GET clients/:id/consents` (in detail already), `POST clients/:id/archive`. Client list filters: `?status=&touchUpDue=true&archived=false`.
- Health form questions (EN/JA): medicines (blood thinners, Accutane in the last 12 months), allergies (lidocaine, pigments, latex), pregnant/breastfeeding, diabetes, skin conditions (eczema, psoriasis in the area), keloids, cold sores (lips), past PMU (when, where), recent botox/filler, chemo. Any "yes" on a red flag → orange "Check before treatment" badge on the client and the booking.
- Consent: checkboxes per `consent_type` (`treatment, photo_video, marketing, model_student, policy_acknowledgement`) + typed full name + auto date.
- Photo timeline: on the client page, group photos by booking/date with tags before/after/healed/touch_up (`media_assets.role` exists in `0006`). `GET media?clientId=` (add the filter in `media.service.ts` if missing). Viewer `app/media/[id].tsx` → `PATCH media/:id` (exists): role, `marketing_permission`, client link. Signed URL via `GET media/:id/view-url` (exists).
- PMU treatment record: extend `POST clients/:id/treatments` DTO with `area, pigments, needle, technique, numbing, reaction` (if columns are missing, add them in 0015).
- Tap-to-contact: `tel:`, `mailto:`, `https://line.me/R/ti/p/~{line_id}`, `https://instagram.com/{handle}`.

### B4. Services
`app/services/[id].tsx` edit/hide. **Add API** `PATCH /workspaces/:id/services/:serviceId` (name, duration, price, buffers, description, deposit_amount, active). **Migration in 0014:** `services.active bool default true, description text, deposit_amount numeric`.

### B5. Finance
`app/finance.tsx`: tiles for today, week and month; by method; list; **Record** sheet (income / expense / deposit / refund, method picker: cash, card, PayPay, bank transfer) → `POST finance/entries` (check `record-finance-entry.dto.ts`; extend for expense/refund). "Who still owes" = completed bookings without full payment. **CSV export** (web: download a file; native: share sheet).

### B6. Analytics (Insights)
`app/analytics.tsx`: business numbers first. **Add API** `GET /workspaces/:id/analytics/business?days=30`: new vs returning clients, bookings, no-show rate, rebook rate (client booked again within 90 days), income by service, month vs last month. Simple bar charts with `react-native-svg`. Keep the content metrics and Marketing Coach below. Content metrics stay "Not connected yet" until Meta is connected.

### B7. Automations and reminders
`app/automations.tsx`: rules with editable EN/JA message templates: booking confirmation, **day-before reminder**, aftercare (day 0/3/7), healing check (week 4), **touch-up due (week 6–8)**, yearly colour boost, birthday. Each rule creates a **suggested message** in AngelOS suggests (C4) for approval. Delivery: LINE when connected; until then the "Copy message" + "Open LINE" deep link (web: copy + `https://line.me/R/`). Move the "process due" step to a server schedule: add `@nestjs/schedule` cron every 15 min in `automations.service.ts` (no extra cost on Railway). Remove the prototype button from the owner view.

### B8. Messages inbox (real where possible)
- **Works without new accounts:** inbox UI, manual conversations ("+ New conversation": pick a client, paste their message), AI draft, translate, internal notes, saved replies, "Book this person" (C1), mark done/archive (`PATCH threads/:id` exists), unread dot, last message, time, sorting.
- **Needs Angel's accounts (label "Not connected yet · Connect in Settings → Connections"):**
  - **LINE Official Account:** needs a LINE OA + Messaging API channel (Angel creates it; free tier has a monthly message limit). Build `LineMessagingAdapter implements MessagingProviderAdapter` (`apps/api/src/messaging/provider-adapter.ts`), a webhook `POST /webhooks/line` (verify `x-line-signature`), and push via the Messaging API. Env `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` (**Angel sets them in Railway; Gordon never touches env**). Build it behind a feature flag; it's OK to ship code that stays disabled.
  - **Instagram / Facebook DMs:** need a Meta Business account, an app, and App Review (weeks). Build only the `MetaMessagingAdapter` interface stub plus the "Connect" screen saying "Needs Meta approval"; **do not claim it works**.
- `app/settings/connections.tsx` **new**: LINE / Instagram / Facebook / TikTok cards with honest status.
- Saved replies: **migration `0016_v1_messaging.sql`** table `saved_replies` (workspace_id, title, body_en, body_ja). Seed: prices, address/directions, deposit policy, aftercare, cancellation policy.

### B9. Student role + Academy
- **Migration `0017_v1_roles_academy.sql`:** widen `workspace_memberships.role` check to `('owner','student')` (`0001_foundation.sql:20`); helper `is_workspace_owner(ws)`; **change the RLS on studio tables** (`clients, client_*, appointments, calendar_blocks, services, finance_*, message_*, client_messages, media_assets, content_*, automation_*`) to owner-only; tables `academy_courses` (workspace_id, title, description, cover_media_id, published), `academy_lessons` (course_id, position, title, body, video_url, checklist jsonb), `academy_enrollments` (course_id, user_id), `academy_progress` (lesson_id, user_id, done_at), `academy_submissions` (lesson_id, user_id, media_asset_id, status pending|approved|try_again, feedback).
- API module `apps/api/src/academy/*`: owner = CRUD courses and lessons, enrol a student, review submissions; student = my courses, lessons, mark done, submit a practice photo. `GET /me` → `{userId, email, founder, memberships:[{workspaceId, role}]}`.
- App: `src/lib/me.ts` + a `useRole()` hook. **Student layout:** tabs = Academy + Settings only. Hide Clients/Calendar/Today. Route guard redirects student hits on studio routes to `/academy`.
- Academy owner screens: course list, course editor (lessons reorder, video URL, checklist), students list with progress, submission review (approve / try again + comment). Student screens: My courses, lesson (video via `<video>` on web / `expo-video` on native, *ask Angel before adding a native module that needs a new build*), checklist, progress bar, "Send practice photo".

### B10. Setup flow + invites + founder
- `app/onboarding.tsx` → 4-step wizard: **Business** (name, currency picker JPY default, time zone default Asia/Tokyo, language) → **Services** (3 PMU presets: Brows / Lips / Eyeliner, editable) → **Hours** → **Done** → `router.replace('/(tabs)')`. Fixes the dead end.
- Invites: Founder controls → "Invite" with type **Business owner / Student**, then **Copy link** + Share (`navigator.share` on web) → `{origin}/signup?invite=CODE`. Studio owners can invite their own students from Academy → Students (creates a student membership in *their* workspace). Extend `create-beta-invite.dto.ts` with `inviteType` + `workspaceId?`; migration adds `invite_type` to the invite table.
- Founder controls (`app/founder-admin.tsx`): restyle; sections Overview · Invites · Testers · Feedback · Feature flags · Discount codes · Test tools. Founder-only via `/founder/me`.

### B11. Settings + EN/JA
- Settings pages (A2 #27–28): profile (`PATCH /me` new: display name), business (`PATCH /workspaces/:id` new: name, currency, time zone, address, phone), password (`supabase.auth.updateUser`), **delete account** (`DELETE /me` new: deletes the user's owned workspace data + `auth.admin.deleteUser` via the service role; typed "DELETE" confirm; **Angel tests on a throwaway account only**), privacy and terms (render `/workspace/angelos-legal/PRIVACY_POLICY.md` and `TERMS.md` content as in-app pages; contact email placeholder stays until Angel fills it in), Help & feedback, app version, sign out with confirm.
- **EN/JA:** add `i18next`, `react-i18next`, `expo-localization` (pure JS on web; `expo-localization` is already supported in Expo Go/dev builds, so check whether a new iOS build is needed and **ask Angel before any EAS build**). Files `src/i18n/index.ts`, `src/i18n/en.json`, `src/i18n/ja.json`. **All** user-visible strings go through `t()`. Language switch in Settings; default = device language; saved per user. Dates via `Intl.DateTimeFormat(locale)`; yen without decimals.

### B12. Subscriptions (web V1 honest state)
Web testers use it free. `app/subscription.tsx` shows the plan status from the server, "Beta: free during testing", and no fake price text. **No payment provider work** (Stripe on web or Apple IAP on iOS = Angel's later decision; billing is off-limits now).

---
## SECTION C: AI OPS (server-side, OpenAI already wired)
Provider: `apps/api/src/ai/ai-provider.service.ts` (OpenAI Responses API, `AI_PROVIDER_MODE`, `OPENAI_API_KEY`, `OPENAI_MODEL`). **No new keys, no new providers.** Keep a deterministic `mock` mode so all tests run free.

### C0. The assistant's job, in Angel's priority order
1) **Marketing manager**: keeps the content calendar full, writes EN/JA captions, makes before/after posts, plans campaigns, reads the analytics and says what to post next. 2) **CRM helper**: notes, follow-ups, touch-ups. 3) **Booking desk**: fills slots, confirms, reschedules. 4) **Inbox**: drafts replies. Everything is proposed as cards; Angel approves.

### C1. Tools (replace the regex `action-planner.ts`)
- New `apps/api/src/ai/tools/registry.ts`: each tool = `{ key, description, inputSchema (JSON schema), risk, execute(ctx,input), verify(ctx,input,result) }`. Call OpenAI with **function tools / structured output** (Responses API `tools`) so the model returns `{reply, proposals:[{key,input,summary}]}`. Validate inputs with class-validator DTOs and check every id belongs to the workspace.
- Tools (all `requiresApproval: true`; execute reuses the existing services, so no duplicate logic):
  | key | input | executes via |
  |---|---|---|
  | `create_post_draft` | goal, platforms[], language(s), mediaIds?, date? | `ContentService.createDraft` (captions EN+JA) |
  | `make_before_after` | clientId, mediaIds, layout | B0.3 render job → media asset + draft |
  | `schedule_post` | variantId, scheduledFor | `ContentService.schedule` (publishes only after approval) |
  | `plan_campaign` | goal, startsOn, endsOn, offer? | creates campaign + N draft posts + LINE broadcast draft |
  | `line_broadcast_draft` | text, imageMediaId?, sendAt? | B0.4 LINE draft with message-count estimate |
  | `create_booking` | clientId, serviceId, startAt, notes? | `BookingsService.checkAvailability` + `createAppointment` |
  | `confirm_booking` | appointmentId | `BookingsService.confirm` |
  | `reschedule_booking` | appointmentId, startAt | `BookingsService.reschedule` |
  | `cancel_booking` | appointmentId, reason? | `BookingsService.cancel` |
  | `create_client` | displayName, phone?, email?, lineId?, language | `ClientsService.create` |
  | `add_client_note` | clientId, content | `ClientsService.addNote` |
  | `draft_reply` | threadId, body, language | `MessagingService.createReply` as a **draft** (no send) |
  | `send_approved_reply` | messageId | `MessagingService.approveAndSend` (real only when LINE is connected; otherwise "Copy & open LINE") |
  | `schedule_follow_up` | clientId, dueAt, kind (aftercare/touch_up/rebook/birthday), message | automation job row |
  | `record_payment` | appointmentId/clientId, amount, method | `FinanceService.record` |
  | `remember` / `rename_assistant` | (existing) | existing |
- Keep `ai_action_runs`, `approveAction`, `verifyAction` and the pause/read-only controls; move the per-key `if/else` into the registry. **Approve executes exactly once** (`Idempotency-Key` = action id).
- Context builder (`loadAuthorizedContextFacts`): when there is no entity, add today's and tomorrow's bookings, threads needing the owner (last message), touch-ups due, unpaid completed bookings, last post date, and the service list with ids. Keep under ~3k tokens.
- Cost guard: log `usage` tokens in `ai_messages.metadata`; per-workspace daily cap from env `AI_DAILY_CALL_LIMIT` (default 200 in code; **Angel sets env if she wants a different value**).

### C2. Voice and tone (`angelos-operating-contract.ts`)
- Talking to Angel: short, calm, English or Japanese as chosen.
- **Client message drafts in Japanese: friendly-casual salon tone** (です/ます, soft, warm, light emoji allowed: ✨🌸, no stiff keigo, no slang). Example: 「〇〇さん、こんにちは✨ 先日はありがとうございました！その後の眉の調子はいかがですか？気になることがあればいつでも聞いてくださいね🌸」. English drafts: warm, short, first name.
- Always uses the client's language field; never gives medical advice (refers to aftercare and "please consult a doctor" for health issues); never promises a time without checking availability.

### C3. Ask AngelOS = the central assistant (`app/ai.tsx`)
- Full-screen chat, glass input bar with suggestion chips (real: "Plan this week's posts", "Make a before/after from today", "What should I post tonight?", "Fill my free slots", "Reply to new messages", "Who's due for touch-up?").
- Assistant messages can carry **proposal cards**: icon, one-line summary, details (client, time, message preview), buttons **Approve · Edit · Not now**. Approve → spinner → ✅ result with a link ("Booking created · Open"). Edit opens the prefilled form (booking sheet or reply editor).
- Entry points: Today "Ask AngelOS" bar; "Ask AI" on client, booking, thread and post (passes `context.entityType/entityId`). A floating glass button only if it fits A1 (otherwise remove the setting).
- Past conversations list (`GET conversations` — add it if missing).

### C4. "AngelOS suggests" (daily brief)
- `GET /workspaces/:id/ai/suggestions`: rule-based candidates first (free), **marketing first**: no post scheduled in the next 3 days → `create_post_draft`; new healed/after photo with consent → `make_before_after`; slow day in the next 7 days → "model day / last-minute slot" post + LINE broadcast draft; best post last week → "make a follow-up post"; then unanswered threads → `draft_reply`; tomorrow's unconfirmed bookings → `confirm_booking` + reminder draft; touch-ups due → `schedule_follow_up`; completed today → aftercare draft; no post in 7 days → `create_post_draft`; unpaid → `record_payment`. Then **one** model call writes the texts (cached per workspace per day, refreshed on demand).
- Shown on Today (top 3–5) and in an "All suggestions" list; each has Approve / Edit / Dismiss. Dismiss is remembered for the day.

### C5. Labels
Once C1–C4 work, remove every "preview" wording. Messages that can't be delivered show "Ready to send · Copy & open LINE" (honest).

---
## SECTION D: ACCEPTANCE + WHAT ANGEL TESTS

### D1. Acceptance (Gordon checks before the final report)
- **A0:** `git grep -n "Alert.alert" apps/mobile` → only `dialog.ts`; web sign-in with a wrong password shows an A1 dialog; web bundle < 2.5 MB; favicon is OK or removed; review docs moved to `docs/design/`.
- **A:** every route in A2 renders on web at 390 px and 1280 px wide with A1 fonts and colours, a human header title, skeleton → empty → error states, and no raw ids or route names. Long-press **and** right-click **and** ⋯ open the menus. Reduced motion is respected. No glass on list rows.
- **B0 (first):** Social tab month calendar shows drafts/scheduled/posted; a composer makes IG + FB + LINE variants with EN and JA captions and an IG-like preview; the before/after maker produces a watermarked image from 2 consented photos and opens it in the composer; schedule → approve → (Meta connected in dev mode) the post appears on Angel's IG with a stored permalink, or (not connected) "Copy caption & open Instagram" + "Mark as posted"; the campaign planner puts ≥ 6 drafts on the calendar; Insights › Social shows real IG numbers when connected, an honest "Connect Instagram" otherwise; the LINE broadcast shows a message-count estimate before Approve.
- **B1–B2:** create, confirm, reschedule (incl. "Book anyway"), complete, no-show and cancel a booking from both the detail and the menu; the week view shows it in the right slot; a closed day is shaded; time off blocks booking.
- **B3:** edit client, health form red flag → badge on client + booking; consent signed and listed with date; 2 photos tagged before/after show in the timeline; marketing toggle saved.
- **B4–B7:** edit/hide a service; record income/expense; CSV downloads; business analytics show non-zero numbers from test data; the cron creates a touch-up suggestion for a test client with a treatment 7 weeks ago.
- **B8:** manual conversation → AI draft → approve → "Copy & open LINE"; Connections screen says "Not connected yet" honestly. The LINE adapter code is behind a flag, with unit tests for signature verification.
- **B9:** a student account sees Academy + Settings only; the API returns 403/empty for `/clients` with a student token (add `scripts/verify-tenant-isolation.mjs`: owner A, owner B, student → no cross reads).
- **B10:** a new account via invite link → wizard → Today with 3 services. Founder controls are hidden for non-founders (UI + API 403).
- **B11:** switching to 日本語 changes 100% of visible strings on the main flows (login, Today, Clients, Calendar, booking, Settings, AI chat, dialogs). Delete account works on a throwaway account.
- **C:** "Book Yuna brows next Tue 14:00" → card → Approve → appointment exists, `ai_action_runs.status = succeeded` with verification. "Reply to the newest message" → Japanese casual draft created, not sent. Pause AI → Approve is refused kindly. Mock mode passes everything offline. Suggestions show ≥ 3 real items from seeded test data.
- **Gates:** typecheck, `build:api`, `export:web` all green on the last commit. Native compile is not broken (no web-only APIs without a `Platform.OS` guard).

### D2. WHAT ANGEL TESTS (real Angels Beauty days: laptop Chrome + iPhone Safari)
**Monday morning: plan the week's social (priority ①)**
- [ ] Open Social → month calendar. Ask AngelOS "Plan this week's posts": 4–5 drafts appear on the right days
- [ ] Open one draft: pick 3 brows photos yourself, read the EN and JA captions, tap "Warmer" on the Japanese one, add the booking link
- [ ] Preview looks like Instagram; schedule it for Wednesday 20:00; tap Approve
- [ ] Make a **before/after** of yesterday's combo-brows client: side-by-side, logo on, crop 4:5 → it opens in a new draft with a caption
- [ ] (If Instagram is connected) the scheduled post really appears on @angelsbeauty at the time; (if not) "Copy caption & open Instagram" works and you can mark it posted
- [ ] Create a campaign "Academy January intake" → AngelOS fills 2 weeks with posts + one LINE broadcast draft; check the message-count estimate before approving
- [ ] Insights › Social: see last month's reach, best post, best time to post (or an honest "Connect Instagram")

**A client day (CRM ②)**
- [ ] New client from an Instagram DM: add her name, LINE ID, source "Instagram", language 日本語
- [ ] Send her the health questions on your phone; answer "yes" to blood thinners → orange warning on her page and booking
- [ ] She signs the treatment + photo consent (types her name)
- [ ] After the session: add before/after photos, tag them, turn on "OK for marketing"; add a treatment note (pigment, needle, technique)
- [ ] Her page shows photos by visit, notes, bookings and payments

**Bookings (③)**
- [ ] Book her touch-up 6 weeks out using the date picker; see it in Week view
- [ ] Block Sunday and next Thursday (academy class day); try booking Thursday → warning
- [ ] Open tomorrow's booking: Confirm → reschedule to 15:00 → on the day Mark done → Record ¥ payment (PayPay)
- [ ] Mark a no-show on a test booking; Today updates

**Messages (④)**
- [ ] Paste a LINE message from a new lead into a new conversation → AI draft in friendly Japanese with price + deposit info → edit one word → Approve → "Copy & open LINE"
- [ ] Tap "Book this person" from the chat → booking form is prefilled
- [ ] Saved reply "Aftercare (JA)" inserts correctly

**AngelOS runs the day (⑤)**
- [ ] Morning: Today shows "AngelOS suggests": tonight's post, a before/after from a new healed photo, tomorrow's confirmations, a touch-up reminder. Approve two
- [ ] Ask "Fill my free slots next week": it proposes a model-day post + LINE broadcast; approve the post only
- [ ] Ask "Book Yuna for brows next Tuesday 2pm" → card → Approve → in the calendar
- [ ] Pause AI in Needs attention → Approve is politely refused

**Students & other studios**
- [ ] Invite one student by link → she sees only Academy; course with 2 lessons; she sends a practice photo; you approve it
- [ ] Invite a beauty-business friend → she gets her own empty studio and can't see yours
- [ ] Founder controls only on your account

**Every day, everywhere**
- [ ] Every screen looks like the A1 pictures (greige, rose gold, glass menus); 日本語 switch works everywhere
- [ ] Wrong password, wifi off, forgot password: all give kind messages and work

---
## TOP IDEAS (after the above; ranked)
1. **Online booking page** `/book/<studio>` (Fresha/Booksy): services, free slots, health form, request → Angel approves via AngelOS suggests. Put it in the IG bio and LINE rich menu.
2. **LINE rich menu + auto-replies** once the OA is connected: "Book", "Prices", "Aftercare", handled by the AI with approval.
3. **UGC & testimonials**: after the healed check, ask the client for a review/photo via LINE and turn it into a testimonial post draft.
3b. **Touch-up engine** (PMU-unique): automatic 6–8 week and 12-month reminders with AI-drafted Japanese messages.
4. **Competitor watch**: follow 5 local Okinawa PMU accounts' public posts and get a weekly "what worked for them" note.
5. **Link-in-bio page** (book, academy, LINE, IG) with click tracking into Insights.
6. **Deposit + no-show policy** with per-client no-show count (Vagaro).
7. **Rebook at checkout** ("Book your touch-up now?") with a suggested date (Fresha).
8. **Waitlist**: when a booking is cancelled, the AI proposes who to offer the slot to.
9. **Google review request** after the healed check.
10. **Packages and gift cards** (session + touch-up bundle).
11. **Student certificates (PDF)** and practice-photo history (Kajabi/Skool-style).
12. **Monthly report** (income, new clients, best post) shareable as an image.
