# AngelOS v9.1 — Profile area, Night mode audit
Source: Angel's iPhone screenshots (1125×2436, measured in pt at ÷2.885). Tokens: assistant-orb-hd/GLASS_HD_TOKENS.md §1 (Night), the same tokens as the Analytics dark hairline cards.
Mockups: `png/*-night@3x.png` (1170×2532). Before/after: `contact-sheet.png`. Generator: `build/gen.py`.
Locks kept: fonts, sizes, weights and strokes; the shared title; the Profile/Analytics layouts; the logo button; the plain +; the Messages tabs; the frosted neutral background; neutral colours. No new elements, and Angel's real content is kept. Copy marked **(suggestion)** needs her OK.

## Global consistency rules (Night)
1. **One card.** Fill `rgba(18,18,20,.66)` + blur 24, saturate 1.15; 1 pt hairline `rgba(255,255,255,.11)`; 1 pt inner top rim `rgba(255,255,255,.14)`; **radius 20**; padding 18; gap 12. No white cards at night.
2. **One field.** 48 pt high (multiline 96), radius 14, fill `rgba(255,255,255,.05)`, 1 pt `rgba(255,255,255,.14)`, text `#F4F4F5` 17/400, placeholder `#9A9A9F`. The label goes above it, 15/600 `#C7C7CC`, with an 8 pt gap. The hint goes below, 13/400 `#9A9A9F`. Search bars use this same field with a 20 pt magnifier.
3. **One primary button.** 48 pt, radius 24, fill `#F4F4F5`, text `#0A0A0A` 600 16. **One secondary button.** 48 pt, radius 24, transparent, 1 pt `rgba(255,255,255,.24)`, text `#F4F4F5` (full contrast, never grey). **Disabled** = the same button at 40 % opacity, used only when the action really can't run. Header actions (Save) = a compact primary pill, 36 pt.
4. **One chip.** 38 pt, radius 19, 500 15. **Selected:** `#F4F4F5` fill, `#0A0A0A` text, 600. **Unselected:** card fill, 1 pt `rgba(255,255,255,.14)`, text `#E5E5E7`. This is the same rule on Messages, Analytics, Clients, Account language and Founder. Status tags (New Enquiry) are 24 pt, taupe `rgba(184,164,138,.16)`, text `#D9CBB7`.
5. **One header.**
   - Tab roots (Messages, Profile…) use the shared title, 700 28/36 at left 20.
   - Pushed screens add **a 36 pt glass back button with a 20 pt bold chevron** at (16, 52), with the same title below at top 96.
   - **No small centred nav title and no faded ghost title.** One title per screen.
   - Right actions sit on the title line (plain +) or on the back-button line (Save).
6. **Empty state.** No card. A 32 pt outline icon `#9A9A9F`, title 19/600 `#F4F4F5`, line 16/400 `#9A9A9F`, centred, 96 pt below the last control.
7. **Text colours (AA on #050505 and on the card).**
   - Primary `#F4F4F5` (≈18:1); secondary `#C7C7CC` (≈12:1); muted `#9A9A9F` (≈7:1).
   - **Never** `#151515`–`#5C564E` on black. The ghost titles measure 1.1:1, and the chip text `#5C564E` measures ≈2.6:1.
8. **Horizontal rows** (tabs, chips): start at the 20 pt inset. When scrolled, snap so the first visible chip is whole; only the trailing edge may be cut.
9. **Long text** (legal, help): line length ≤ 40 em on phone (24 pt side padding), 16/25, headings 19/700, 22 pt above each section, no card.

## Screen by screen
| Screen | Issue | Measured (from pixels) | Correct token | Fix |
|---|---|---|---|---|
| Account | White cards at night | fill #FFFFFF, radius ≈28, x 16.6–373 | Card (rule 1) | Dark hairline card, r 20 |
| Account | Double title | nav "Account" + ghost "Your account" #151515 (1.1:1) | Header (rule 5) | Single title "Your account" + back chevron |
| Account | Empty back circle | 36 pt circle, no glyph | Back button | Add the chevron (20 bold) |
| Account | Field / button heights differ | field ≈53 pt, Save ≈46 pt | 48 / 48 | Field 48, primary 48 |
| Account | "Change password" looks disabled | text #CACACA on white (1.6:1), border ≈#F0F0F0 | Secondary button | Full-contrast secondary; 40 % only while < 8 chars |
| Account | Email line low contrast | #302D29 on #050505 (≈1.5:1) | Muted #9A9A9F | Recolour |
| Edit profile | White card + white fields | #FFFFFF, fields ≈48 pt | Card + field | Dark card, dark fields |
| Edit profile | Empty top-left and top-right circles | 2 blank 44 pt circles | Back + header Save pill | Chevron on the left; "Save" primary pill on the right (assumed to be the save action, **confirm**) |
| Edit profile | No large title | nav title only | Rule 5 | "Edit profile" as the shared title |
| Connections | Double title | nav "Accounts" + ghost "Connections" | Rule 5 | One title: "Connections" (**confirm** the name; Profile row label may say "Accounts") |
| Connections | White cards; subtitle #302D29 | — | Card; muted | Dark cards; "Connected" as a 14/600 status with a taupe dot |
| Clients | Double title | nav + ghost "Clients" | Rule 5 | One title + chevron; plain + on the title line (no circle) |
| Clients | White search bar + rows | search ≈50 pt; rows ≈82 pt, r ≈28 | Field 48; card r 20 | Dark |
| Clients | Chip logic: selected "All" #E9E9E9-on-black but unselected outlined with #5C564E text | ≈2.6:1 | Chip (rule 4) | Selected light, unselected dark hairline, text #E5E5E7 |
| Clients | Handles as names ("__yk1119", "0201chi"); avatar shows "_" | — | Same 17/600 name style | Keep the data. Avatar initial = first letter or digit, skipping symbols ("Y", "0") **(suggestion)** |
| Messages (TikTok empty) | Tabs row clipped at left ("am") | first chip cut at x≈0 | Rule 8 | Snap so Facebook starts at 20 pt |
| Messages | White search + white empty card | search #F2F2F2, ≈41 pt | Field 44 (search); empty state rule 6 | Dark field; empty state without a card |
| Analytics picker (colour-only fix, mocked: `png/analytics-picker-night@3x.png`) | White menu on Night | #FFFFFF, 208×208 pt at (165, 146), rows 54/50/49.5/54.5 pt, light separators | Floating card: `#161618` (the card token, opaque so nothing shows through), 1 pt hairline `rgba(255,255,255,.11)`, inner rim `.14`, shadow `0 16 40 rgba(0,0,0,.55)`, separators `rgba(255,255,255,.10)`, text `#F4F4F5` 500 15 (size unchanged), logos 20 pt | Same position, size, rows and logos; checkmark on the selected row (All). Built over her screenshot, so the rest of the screen is unchanged pixels |
| Privacy policy | **MUST-FIX CONTENT BLOCKER:** raw draft shows "[FILL IN: …]" ×5, "> Draft for review. This is not legal advice…", Markdown "-" bullets and quote marks | — | — | Fill in the real details and lawyer-check before release; render the Markdown (headings, bullets) |
| Privacy policy | White full-width card, 17 pt text edge to edge | card #FFF, ≈58 chars/line | Rule 9 | No card, 24 pt padding, 16/25, headings 19/700. Final wording in PRIVACY_POLICY_FINAL.md; only the ⟦ANGEL: …⟧ items remain as gaps |
| Help | Ghost title + nav title; white cards | — | Rules 1, 5 | One title, one grouped card as an accordion (question 17/600, answer 16/400 #C7C7CC, chevrons) |
| Help | Wrong path "Settings → Account → Delete account" | — | — | **(suggestion)** "Go to Profile › Account › Delete account." Confirm this path exists |
| Feedback | Ghost large title "Help shape AngelOS" + nav "Feedback" | ghost #151515 | Rule 5 | One title: "Help shape AngelOS" (or "Feedback", **her choice**) |
| Feedback | White option rows; selected = grey #F1F1F1 + black outline (weak) | — | Selected = light fill + check; unselected = dark field | As mocked |
| Founder | Ghost "Founder controls" + eyebrow "FOUNDER ONLY" + nav "Founder" | 3 titles | Rule 5 | One title "Founder"; drop the eyebrow (**confirm**) |
| Founder | Jargon: "OpenAI did not share the credit left. A project key cannot read it. An admin key is required. AngelOS will not guess it." | — | — | **(suggestion)** "Credit left isn't available yet." |
| Founder | "Each amount is that person's share of this bill, based on how many times AngelOS used the assistant." | — | — | **(suggestion)** "Split by how often each person used the assistant." |
| Founder | Chips row wraps to 2 lines and is clipped under the tab bar | 2nd row y≈945 | Rule 8 | One horizontally scrolling row under the subtitle |
| Founder 2 | White cards; stat labels indented 20 pt more than the card title | label x≈61 vs title x≈41 | Card padding 18 | Align everything to the card padding |
| Plan | Text cut under the header ("Beta: free during testing" half hidden) | the header band overlaps content at y≈130 | Header with no opaque band; content starts below the title | Scroll content starts under the title; the header is transparent |
| Plan | "Apply Student Discount" looks disabled (white on white, Title Case) | border ≈#EEE | Secondary button, sentence case | "Apply student discount" **(suggestion: sentence case)** |
| Plan | White cards; mixed body sizes | 17 vs 15 pt | Card; body 16 / small 14 | As mocked |
| All pushed screens | Tab bar keeps "Profile" active (correct); the bottom fade hides the last card | — | — | Add 24 pt of bottom padding above the tab bar |

## Unverified and decisions for Angel
- Title names where the nav and ghost titles differ (Account vs Your account, Accounts vs Connections, Feedback vs Help shape AngelOS): I used the ghost (large) wording.
- I assumed the empty right circle on Edit profile is Save.
- Help delete path and suggested copy: confirm with the builder.
- The Privacy mock shows the [FILL IN] fields with a dashed outline and a design-note banner. These are annotations; the shipped screen needs the real values.
- Daylight versions are not made in this pass. The same rules apply with the Daylight tokens in GLASS_HD_TOKENS §1.
- Contrast ratios are computed from sampled pixels, not from code tokens.
