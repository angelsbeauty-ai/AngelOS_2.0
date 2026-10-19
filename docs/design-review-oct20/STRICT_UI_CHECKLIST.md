# AngelOS V1 — Strict UI/UX Checklist (pass/fail)

Every AngelOS V1 screen must pass every row here before Angel sees it. Each row is pass or fail. There is no "mostly". One failed row means the screen fails.
Sources: profile-night-audit/AUDIT.md (newest, Oct 17), assistant-orb-hd/GLASS_HD_TOKENS.md, premium-research/PREMIUM_FINDINGS.md, research/CALM_PSYCHOLOGY.md, final-D2/TOKENS.md, orb/ORB_SPEC.md, logo-final-v2/NOTES.md, angelos-review/full-audit/AUDIT.md. Conflicts are resolved in §5.

Mark each box `[x]` for pass. Write **FAIL + one line of why** next to any box that fails.

---

## 1. How to use it

**Who checks what**
| Role | Checks | Signs |
|---|---|---|
| Builder | All of §2 and the screen's §3 rows on a real build, before handing it over | Builder column |
| Designer | Compares the screenshots to the approved mockup, pixel by pixel, for every §2 design row and every lock | Designer column |
| Grok | Re-checks every row on its own and owns the JP copy, the content rows and the final call | Grok column |

**What counts as proof**
- [ ] Every changed screen has a **phone-width screenshot: iPhone, 390 pt wide, @3x (1170 × 2532 px)**, in **Daylight and Night**.
- [ ] Each screenshot sits **side by side with its approved mockup** in one image, with the file names and build number written on it.
- [ ] Each state the screen has (empty, loading, error, success) has its own screenshot pair.
- [ ] Interaction rows (haptics, gestures, back swipe, keyboard, VoiceOver, Reduce Motion) are proven with a screen recording from a real iPhone, or a written device note with the device model and iOS version.
- [ ] **Code checks, diffs or "it matches the tokens" alone never count as proof.** No screenshot means the row fails.
- [ ] Measurements are taken from the @3x pixels (px ÷ 3 = pt) and written next to the row when asked.

---

## 2. Global checks (every screen)

### 2.1 Angel's locks
- [ ] **Shared title:** the Messages-style title, Manrope 700, 28/36, left inset 20 pt. Same font, size and position on every screen. On pushed screens it sits at top 96 pt, under the back button.
- [ ] **One title per screen:** exactly one large title. No small centred nav title above it, no faded ghost title, no duplicate title, and no extra eyebrow (e.g. "PROFILE & SETTINGS").
- [ ] **Fonts, sizes, weights and stroke thickness are unchanged** from the current app. A side-by-side with the last approved build shows zero difference in type or icon stroke.
- [ ] **Profile and Analytics layouts are unchanged:** same elements, same order, same positions as the approved mockups (± 1 pt).
- [ ] **Soft neutral frosted background** in both modes. Daylight: `#F3F3F3` with soft white frost blobs. Night: `#050505` with soft frost blobs at 7.5 % white. No flat, coloured or warm-tinted background.
- [ ] **Liquid-glass AngelOS logo button** at the bottom right, on every screen that has it in the screen map, in the same position (± 1 pt), crisp glass, not blurred.
- [ ] **Calendar +** is a plain + glyph with **no circle, ring or fill** behind it.
- [ ] **Messages platform tabs** are present and unchanged: same order, icons and labels.
- [ ] **Neutral colours only.** No blue, no violet, no other hue in any UI element, text, chip, link or focus ring. The only colour allowed: **the 3D shiny rose gold AngelOS logo / app icon (the ONE brand colour)** and the platform brand logos (IG, FB, Messenger, LINE).
- [ ] **No elements outside the screen map.** Nothing is added that the approved screen map does not list.
- [ ] **Night has no white slabs.** No `#FFFFFF` (or near-white) card, field, search bar, chip, dialog or sheet in Night.
- [ ] **No red for business numbers.** Revenue, counts, drops and analytics are never red. Red (`#B3261E`) appears only on delete and cancel actions.
- [ ] **Logo / app icon is the approved asset:** `logo-final-v2/icon.png` (3D shiny rose gold, variation B) for the app icon, `splash-icon.png` for the splash, `angelos-mark-rosegold-3d.png` for the in-app splash.
- [ ] **Logo is bright, complete and premium:** shiny rose gold metal (not dull, brown, grey or washed out); full shape with no missing fold, tail tip or band (matches `shape-proof.png`); crisp at 40, 60 and 120 px; not blurry, pixelated or stretched.
- [ ] **Logo checked on a real iPhone** in all three places: home screen icon, splash screen, and the in-app logo button. One photo or screenshot of each, with the device model.
- [ ] **iOS 26 dark icon mode:** icon screenshot on a real iPhone; mark is bright, complete and readable.
- [ ] **iOS 26 tinted icon mode:** icon screenshot on a real iPhone; mark still reads clearly and completely (whole outline visible, no part lost to the tint).

### 2.2 Design system match
- [ ] **Night card:** fill `rgba(18,18,20,.66)` (reads as about `#161618`), blur 24, 1 pt hairline `rgba(255,255,255,.11)`, 1 pt inner top rim, **radius 20**, padding 18, gap 12.
- [ ] **Daylight card:** fill `rgba(255,255,255,.80)`, blur 24, hairline `rgba(0,0,0,.06)`, radius 20.
- [ ] **Field:** 48 pt high (multiline 96), radius 14. Label above (15/600) with an 8 pt gap, hint below (13/400). Search bars use the same field with a 20 pt magnifier.
- [ ] **Buttons:** primary and secondary are 48 pt, radius 24. Header Save is a 36 pt compact pill. Secondary text is full contrast, never grey.
- [ ] **Chips:** 38 pt, radius 19, 500 15. Selected is the strongest contrast (Night: `#F4F4F5` fill, `#0A0A0A` text 600); unselected is quiet (card fill, hairline, `#E5E5E7` text). Same rule on Messages, Analytics, Clients, Account language and Founder.
- [ ] **Night text greys:** primary `#F4F4F5`, secondary `#C7C7CC`, muted `#9A9A9F`. No text between `#151515` and `#5C564E` on black.
- [ ] **Daylight text:** primary `#151515`, muted `#76767A` or darker.
- [ ] **Spacing on the 8 pt grid:** every gap and margin is one of 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 pt (20 pt is the screen inset). Measure 5 gaps per screen; all 5 must match.
- [ ] **Glass is crisp at device pixel ratio:** at 100 % zoom of the @3x shot, glass edges, rims and the orb have a sharp 1–2 px edge. No smeared edge wider than 3 px, no stair-stepping, no banding.
- [ ] **Icons are one set** (Phosphor) at a consistent stroke: the same weight for the same size across the screen. No mixed icon families.
- [ ] **Status tags:** 24 pt, taupe fill `rgba(184,164,138,.16)`, text `#D9CBB7` (Night).

### 2.3 iPhone feel
- [ ] **Safe areas:** nothing sits under the notch / Dynamic Island or the home indicator. Checked on a notch device.
- [ ] **Tap targets ≥ 44 × 44 pt** for every tappable element (measure the hit area, not the glyph).
- [ ] **Haptics per spec, and only these:** light selection tick on tab, chip and segment changes; one success haptic for "booking confirmed" and "post scheduled"; `impactMedium` after a 450 ms long-press. **No** haptics on scrolling or plain list taps, and never continuous.
- [ ] **Motion:** springs `snappy` (damping 26, stiffness 380) or `gentle` (damping 20, stiffness 180). Chip/segment cross-fades 150–250 ms. No bounce overshoot on routine actions.
- [ ] **Reduce Motion on:** springs and cross-fades become plain fades or instant; the orb follows its Reduce Motion spec. Proven by recording.
- [ ] **Gestures:** every swipe, pull and long-press in the spec works; none fires by accident during scroll.
- [ ] **Back swipe** from the left edge works on every pushed screen.
- [ ] **Back chevron present and visible** on every pushed screen: 36 pt glass button, 20 pt bold chevron at (16, 52), visible in Daylight **and** Night (≥ 3:1). No empty circle.
- [ ] **Keyboard never covers the focused input** or its primary button. Checked on the lowest field of the screen.

### 2.4 Content
- [ ] No demo, placeholder, `[FILL IN]`, "lorem", "Sample ·", "Fixture" or "TODO" text.
- [ ] No raw route names, keys or server text (e.g. "clients/c1", "not in fixture", raw API errors) visible anywhere.
- [ ] No letters stacked vertically, no word wrapped mid-word, no text cut off or truncated without an ellipsis.
- [ ] No clipped chip or tab rows: the row starts at the 20 pt inset and the first visible chip is whole; only the trailing edge may be cut.
- [ ] Every number and list is real data, or an honest state (empty, loading, error). No fake numbers.
- [ ] Numbers use tabular figures (no jitter when they update).

### 2.5 States
- [ ] **Empty:** no card; 32 pt outline icon `#9A9A9F` (Night), title 19/600, one line 16/400, centred, 96 pt below the last control.
- [ ] **Loading:** a skeleton in the shape of the real layout. No bare spinner on a blank screen.
- [ ] **Error:** friendly copy plus a working **Try again** button. Text readable in both modes. Dialogs are dark glass in Night.
- [ ] **Offline:** a clear offline message; no infinite spinner; actions that need the network are disabled or queued, as the spec says.
- [ ] **Success toast:** short, warm ("Booked ✓"), auto-dismisses, no confetti for routine tasks.
- [ ] **Disabled vs enabled:** disabled = the same button at 40 % opacity, used only when the action really can't run. Side by side, the two are clearly different.

### 2.6 JP / EN
- [ ] No garbled text, mojibake or tofu (□) in either language.
- [ ] Every string exists in both JP and EN. Switching language leaves no untranslated string.
- [ ] JP is casual and natural (です/ます at most, no stiff keigo such as いたします / ございます in UI copy).
- [ ] JP fits without clipping, wrapping mid-word or overlapping in every element.
- [ ] For every JP string shown to Angel, the English meaning is written next to it in the review.

### 2.7 Accessibility
- [ ] Text contrast ≥ **4.5:1**; UI parts (icons, borders of controls, chevrons) ≥ **3:1**, in both modes. Lowest pair measured and written down.
- [ ] Dynamic Type up to at least **XL**: no clipping, overlap or cut-off text. Screenshot at XL.
- [ ] Every icon-only button has a VoiceOver label that says what it does (e.g. "Back", "New event", "Open assistant").

### 2.8 Function
- [ ] Every button, link, menu item and long-press does what it says, or it is removed. Each one tapped once on the build.
- [ ] **Nothing sends, posts, books or messages a client without an explicit Approve tap.**

---

## 3. Per-screen checklists
Each screen also passes all of §2. Rows below are extra.

### 3.1 Today / Home
- [ ] Greeting, subline and card grid use one spacing step; card row and column gaps are equal (± 1 pt).
- [ ] Home cards are 204 pt high with ≥ 8 pt clear above the arrow button.
- [ ] No white cards in Night; numbers are never red.
- [ ] Proof: Daylight + Night screenshots beside the mockup, including empty and loading.
- [ ] Sign-off: §4 table complete.

### 3.2 Clients
- [ ] One title "Clients", back chevron if pushed, plain + on the title line (no circle).
- [ ] Search bar = the 48 pt field; rows are dark hairline cards, radius 20, in Night.
- [ ] Filter chips follow the chip rule ("All" selected = strongest contrast).
- [ ] Empty state matches §2.5.
- [ ] Proof: Daylight + Night, list and empty.
- [ ] Sign-off: §4 table complete.

### 3.3 Client detail
- [ ] Loads real client data (not the error state); verified on real data, not the fixture.
- [ ] Status tags follow the taupe tag rule.
- [ ] Call / message actions require Approve before sending.
- [ ] Proof: Daylight + Night, loaded and error.
- [ ] Sign-off: §4 table complete.

### 3.4 Calendar (Day / Week / Month)
- [ ] Plain + with no circle; + and logo button kept as they are, with one spacing step between them and the tab bar.
- [ ] Day: event block tops snap to the hour lines (± 1 pt); one spacing step between segment, date header and the first hour row.
- [ ] Month: legend swatches match the grid marks exactly; every dot has a meaning in the legend or is removed.
- [ ] Segment switch: selection haptic + 150–250 ms cross-fade.
- [ ] Booking needs Approve; "booking confirmed" plays one success haptic.
- [ ] Proof: Daylight + Night for Day, Week, Month and empty.
- [ ] Sign-off: §4 table complete.

### 3.5 Social home
- [ ] No white chips or cards in Night; brand logos are the only colour.
- [ ] Proof: Daylight + Night.  - [ ] Sign-off: §4 table complete.

### 3.6 Social composer
- [ ] Text box is the dark field in Night; keyboard does not cover it or the action button.
- [ ] Nothing posts without Approve; "post scheduled" plays one success haptic and a toast.
- [ ] Proof: Daylight + Night, empty and filled, keyboard up.  - [ ] Sign-off: §4 table complete.

### 3.7 Social grid
- [ ] Images are sharp at @3x (no upscaled blur); grid gaps equal.
- [ ] Proof: Daylight + Night.  - [ ] Sign-off: §4 table complete.

### 3.8 Social analytics
- [ ] Layout identical to the locked Analytics mockup.
- [ ] Chips: selected = strongest contrast in both modes (no flipped logic at night).
- [ ] Empty metric (e.g. Link clicks "—") sits on the same baseline as its siblings.
- [ ] No red on any number or trend.
- [ ] Proof: Daylight + Night.  - [ ] Sign-off: §4 table complete.

### 3.9 Social accounts / connect
- [ ] One title (the agreed name, "Connections" or "Accounts", not both).
- [ ] "Connected" shown as a 14/600 status with a taupe dot; dark cards in Night.
- [ ] Connect opens the real provider flow or is removed.
- [ ] Proof: Daylight + Night, connected and not connected.  - [ ] Sign-off: §4 table complete.

### 3.10 Messages (incl. empty state)
- [ ] Title is the reference shared title; platform tabs unchanged.
- [ ] Facebook message rows use the Messenger badge; IG and LINE use their own badges.
- [ ] Filtered line ("Instagram · clear"): "clear" is a text button with a 44 pt hit area, or the line is removed (as approved).
- [ ] Empty state follows §2.5, no white card in Night.
- [ ] No reply sends without Approve.
- [ ] Proof: Daylight + Night, list, filtered and empty.  - [ ] Sign-off: §4 table complete.

### 3.11 AI assistant chat
- [ ] Follows the app theme: Night uses the Night palette (not hard-coded light).
- [ ] Her bubble: Night `rgba(255,255,255,.10)` + `#F4F4F5`; Daylight `#151515` + `#FFF`. Ask bar radius 28.
- [ ] Any action the assistant suggests (send, post, book) needs Approve.
- [ ] Proof: Daylight + Night, empty and with messages, keyboard up.  - [ ] Sign-off: §4 table complete.

### 3.12 Voice orb
- [ ] Orb centred at (195, 340), ring radius 100 pt; Mute and End 66 pt at top 660, gap 52.
- [ ] Orb is crisp at @3x: sharp rim 1–2 px, no smeared edge, no banding.
- [ ] Orb colours neutral only (pearl / beige / stone / taupe); no blue or violet.
- [ ] Haptics only on the events in ORB_SPEC §10, never driven by the audio level.
- [ ] Reduce Motion: orb follows ORB_SPEC §9.
- [ ] Close X has a 44 × 44 hit box and a VoiceOver label.
- [ ] Proof: Daylight + Night recording of idle, listening and speaking.  - [ ] Sign-off: §4 table complete.

### 3.13 Meters / AI uses
- [ ] Uses and limits show real numbers; tabular figures.
- [ ] Progress bars are taupe/neutral, never red (even near the limit).
- [ ] Proof: Daylight + Night.  - [ ] Sign-off: §4 table complete.

### 3.14 Profile, account, edit profile, help, feedback, privacy, plan, founder
- [ ] Profile layout identical to the locked mockup; no "PROFILE & SETTINGS" eyebrow.
- [ ] Account: one title "Your account", chevron visible; fields and Save are 48 pt; "Change password" is a full-contrast secondary (40 % only while < 8 chars).
- [ ] Edit profile: one title "Edit profile"; chevron on the left and a "Save" pill on the right; no empty circles.
- [ ] Help, privacy (and terms): long-text rule: 24 pt side padding, 16/25 body, headings 19/700, 22 pt above each section, no card.
- [ ] Feedback: sends only after tapping Send/Approve; success toast shown.
- [ ] Plan: real plan and price; no fake upgrade buttons.
- [ ] Founder: chips follow the chip rule; real data or honest state.
- [ ] Proof: Daylight + Night for each of the 8 screens.  - [ ] Sign-off: §4 table complete for each.

### 3.15 Login, signup, forgot password
- [ ] Fields are the dark 48 pt field in Night (no white inputs).
- [ ] One signup route only reaches the user (no visible duplicate screens).
- [ ] Wrong password / unknown email shows friendly copy, not server text.
- [ ] Forgot password shows a success state after sending.
- [ ] Keyboard never covers the field or the main button; password field has show/hide with a VoiceOver label.
- [ ] Proof: Daylight + Night, logged out, including error states.  - [ ] Sign-off: §4 table complete for each.

---

## 4. Sign-off table (copy one per screen)
A screen goes to Angel **only when all three rows say PASS on the same build number.**

**Screen:** ________________  **Mockup file:** ________________

| Role | Name | Date (JST) | Build number | Result (PASS / FAIL) | Failed rows / notes |
|---|---|---|---|---|---|
| Builder | | | | | |
| Designer | | | | | |
| Grok | | | | | |

- [ ] All three PASS, same build number → ready for Angel.

---

## 5. Conflicts resolved (newest wins)
1. **Fonts:** final-D2/TOKENS.md lists Space Grotesk + Inter; ORB_SPEC and GLASS_HD (newer) say the current app uses Manrope and lock it. → **Manrope, unchanged.**
2. **Title size:** final-D2 `title1` 34/40 vs AUDIT.md (newest) shared title 700 28/36 at left 20. → **28/36.**
3. **Daylight background:** final-D2 `#F7F5F1` and CALM_PSYCHOLOGY `#FAF7F2` (warm) vs GLASS_HD `#F3F3F3` frosted neutral, which matches Angel's lock. → **`#F3F3F3` frosted.**
4. **Night cards:** CALM_PSYCHOLOGY suggests white cards; GLASS_HD, PREMIUM #1 and AUDIT.md say dark hairline cards. → **dark hairline, no white slabs.**
5. **Radius:** GLASS_HD rows 18 vs AUDIT.md cards 20. → **cards 20.**
6. **Muted grey (Night):** GLASS_HD `#8E8E93` vs AUDIT.md `#9A9A9F`. → **`#9A9A9F`.**
7. **Voice screen colours:** ORB_SPEC warm stone gradient vs the newer GLASS_HD shared frosted background. → **shared frosted background**; orb itself stays neutral per spec.
8. **Calendar +:** final-D2 gives the + an accent ring; Angel's lock says no circle. → **plain +, no ring.**
9. **Logo colour (decided by Grok, Oct 20):** the 3D shiny rose gold logo / app icon is the ONE allowed brand colour in the neutral app. It must be bright, complete and premium, and is checked on a real iPhone and in iOS 26 dark and tinted icon modes (rows in §2.1). The flat charcoal/ivory marks stay print/web only.
10. **20 pt side margin:** approved by Grok (Oct 20); it is part of the spacing list in §2.2. No open assumptions remain.
