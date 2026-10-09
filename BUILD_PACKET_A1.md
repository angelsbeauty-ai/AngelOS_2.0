# BUILD PACKET A1 — AngelOS design Option A, batch 1

**For:** Gordon (coding agent on Angel's Windows laptop)
**Project folder:** `C:\Users\angelica borac\OneDrive\Documents\GitHub\ANGELOS_PHASE6`
**Written:** 7 Oct 2026, ~12:15 JST, by Grok Bot (designer). Repo was only read (no edits, no pushes).
**Branch to create:** `feat/design-a1`. Commit locally only. **Do not push.**

---

## For Angel — in plain words (5 lines)

1. The app gets the calm Option A look, with four tabs at the bottom: Today, Clients, Calendar, Academy. Every screen gets a normal name.
2. When something goes wrong, the app explains it kindly and offers "Try again". If your login runs out, it takes you back to sign in with a gentle note. Notes and treatments will no longer fail without telling you.
3. Hold a client or a booking and a small menu appears. Cancelling always asks first ("Keep it" / "Cancel appointment"), and the phone gives small taps.
4. The login screen gets "Forgot password?" and an eye button to show or hide your password.
5. This needs **one new test version of the app** on your phone. Gordon will ask you before he starts that build.

---

## 0. Read first: facts checked today (7 Oct 2026)

| Check | Result |
|---|---|
| Which GitHub repo the laptop folder uses | The folder is named `ANGELOS_PHASE6`, but the SDK 57 handoff (`ANGELOS_SDK57_DEVBUILD_HANDOFF.md`, 2 Oct) says its remote is **`angelsbeauty-ai/AngelOS_2.0`**. `chore/sdk57-dev-build` exists **only** in `AngelOS_2.0`. The other repo, `ANGELOS_PHASE6` on GitHub, is still on SDK 52 with a different screen set. **This packet is written for `AngelOS_2.0` + `chore/sdk57-dev-build`.** |
| `chore/sdk57-dev-build` | Exists on GitHub (`AngelOS_2.0`), head `a544313` "chore: add EAS projectId to app.json (U1)", 2 Oct 17:08 JST. **Not merged into `main` yet** (`main` is still `f3e387c`, 30 Aug). |
| Versions on that branch | `apps/mobile/package.json`: `expo ~57.0.26`, `react-native 0.86.3`, `react 19.2.3`, `expo-router ~57.0.24`, `expo-linking ~57.0.11`. Matches what you were told. |
| `main` of `AngelOS_2.0` | Still old (pre-SDK 57). Do not start until the merge is done (step 0). |
| Staging API the app talks to | `https://angelosapi-staging.up.railway.app/health` reports release `cbf2338…`, a commit in the `ANGELOS_PHASE6` repo. Every endpoint this packet uses exists at that commit (checked in source, listed in §5). |
| Leftover merge markers in `package-lock.json` | **0** in `AngelOS_2.0` `chore/sdk57-dev-build`. They exist only in the other repo. Step 1 still checks your local copy. |
| `expo-blur` import, `system-check.tsx` | **Not present** in `AngelOS_2.0`. They exist only in the other repo. Step 7 checks your local copy and handles them if they are there. |

### Package versions

**Verified** against the npm registry and the `bundledNativeModules.json` inside `expo@57.0.26` (that file is the list `npx expo install` uses):

| Package | SDK 57 (expo 57.0.26) range | npm latest today | Use in A1 |
|---|---|---|---|
| expo | 57.0.26 | 57.0.27 | keep 57.0.26 (no SDK bump in A1) |
| react-native / react | 0.86.3 / 19.2.3 | — | keep |
| expo-router | ~57.0.24 | 57.0.25 | keep (has `expo-router/unstable-native-tabs`) |
| **expo-glass-effect** | **~57.0.4** | 57.0.4 | **add** |
| **@expo/ui** | **~57.0.21** | 57.0.22 | **add** (menu + date picker) |
| **expo-haptics** | **~57.0.3** | 57.0.3 | **add** (not on the branch yet) |
| **expo-blur** | **~57.0.3** | 57.0.3 | **add** (glass fallback for iOS before 26) |
| **expo-symbols** | **~57.0.3** | 57.0.3 | **add** (icons; needs `expo-font` as a peer) |
| **expo-font** | **~57.0.4** | — | **add** as a direct dependency (peer of expo-symbols) |
| expo-linking | ~57.0.11 | 57.0.12 | already there (reset-password deep link) |
| react-native-gesture-handler / reanimated | ~2.32.0 / 4.5.1 (npm latest is 3.3.0 / 4.7.1) | | **not needed in A1**. If ever added, use the SDK versions, **not** npm latest. |

Also verified from inside the packages:
- `expo-glass-effect@57.0.4` exports `GlassView`, `GlassContainer`, `isLiquidGlassAvailable`, `isGlassEffectAPIAvailable`.
- `@expo/ui@57.0.22` exports `@expo/ui/community/menu` (`MenuView` with `actions`, `shouldOpenOnLongPress`, `onPressAction`, `attributes.destructive/disabled`, `displayInline`). On iOS it uses SwiftUI `ContextMenu`; on Android, Compose `DropdownMenu`. It also exports `@expo/ui/community/datetime-picker`. `react-native-worklets` is an **optional** peer, so it is not needed.
- `expo-router@57.0.25` exports `NativeTabs` with `.Trigger`, `.Trigger.Label`, `.Trigger.Icon` (`sf`, `md`, `drawable`, `src`), `.Trigger.Badge`, plus props `tintColor` and `minimizeBehavior` ('automatic' | 'never' | 'onScrollDown' | 'onScrollUp'). It also exports `Tabs` (JS tabs, no extra package), `ThemeProvider` and `DefaultTheme`.
- All SF Symbol names used below exist in `sf-symbols-typescript@2.2.0`.

**Not verified** (check on the phone, see §9):
- Whether `MenuView` with long-press still lets a normal tap open the row.
- What `Linking.createURL('reset-password')` returns inside the dev build.
- Which Xcode version the EAS image uses (liquid glass needs Xcode 26).
- The iOS version on Angel's iPhone.
- Android icons for native tabs.
- The Supabase dashboard settings.
- Whether a working SDK 57 dev build was ever installed. The handoff said "nothing built".

**Always install with `npx expo install <pkg>` from `apps/mobile`. Never plain `npm install <pkg>@latest`.**

---

## 1. Rules (copy into your notes)

- Branch `feat/design-a1` from `main` **after** `chore/sdk57-dev-build` is merged. No force push. **No push at all** unless Angel says so in words. Commit locally.
- Don't touch `.env` / `.env.*` (never print, copy or commit). Don't touch production, billing, payments, `subscription.tsx`, the payment code in `clients/[id].tsx`, `finance.tsx`, Railway, Supabase settings, or `eas submit` / TestFlight.
- **EAS build:** ask Angel first, every time (it uses her Expo build quota). Only `--profile development --platform ios`.
- If the same error happens twice, stop and report: the command, the full error, and what you tried.
- No Swift. No native code edits. Config plugins only if a step says so (none do).
- Sample names only in tests and screenshots (Hana Sato, Mei Nakamura, Yui Tanaka). No real client data.
- Do not delete screens. If something is fake, label it.

---

## 2. Step 0 — Preflight (no commit)

From the project folder (PowerShell):
```powershell
git remote -v                      # expect angelsbeauty-ai/AngelOS_2.0
git fetch origin
git log --oneline -3 origin/main   # must contain the merge of chore/sdk57-dev-build (a544313 or a merge commit)
git status                         # must be clean (apps/mobile/.env is ignored, fine)
node -v                            # >= 22.13.0
```
- If the remote is `ANGELOS_PHASE6` instead: **STOP and report.** That repo has a different screen set and this packet's paths won't match.
- If `chore/sdk57-dev-build` is not merged into `main`: **STOP and report.** Don't merge it yourself.
- Then:
```powershell
git checkout main; git pull --ff-only
git checkout -b feat/design-a1
cd apps\mobile
Select-String -Path package.json -Pattern '"expo"|"react-native"|"expo-router"'   # expect ~57.0.26, 0.86.3, ~57.0.24
npx expo-doctor
npm run typecheck
```
Write down the results. If expo-doctor or typecheck fail **before** you change anything, report it and continue only with Angel's or Grok's OK.

---

## 3. Steps, with one commit each

| Step | What | New native code? | Commit message |
|---|---|---|---|
| 1 | Clean the lockfile + add packages + light mode | **YES, triggers the new build** | `chore(mobile): add SDK 57 UI modules for design A1` |
| 2 | Design tokens (one theme file) + Glass surface + update ui/Screen | no | `feat(design): Option A tokens and glass surface` |
| 3 | Tab bar + human titles on every screen | no (router already native) | `feat(nav): Today/Clients/Calendar/Academy tabs and screen titles` |
| 4 | Friendly errors, toast, session expiry, silent-failure fixes | no | `feat(ux): friendly errors, toast and session expiry` |
| 5 | Long-press menus + haptics + reschedule screen | no (uses step 1 modules) | `feat(ux): long-press menus for clients and bookings` |
| 6 | Forgot password + set new password + show/hide eye | no | `feat(auth): forgot password and show/hide password` |
| 7 | Repo hygiene checks (expo-blur import, system-check label) | no | `chore: hygiene for design A1` (skip if nothing changed) |
| 8 | Final checks + report | — | none |

### Is a new native/dev build needed? **YES.**
`expo-glass-effect`, `@expo/ui`, `expo-haptics`, `expo-blur`, `expo-symbols` and `expo-font` add native code, and `userInterfaceStyle` changes native config. **Step 1 is the trigger.**

Plan:
1. Finish and commit step 1.
2. Run `npx expo-doctor`.
3. **Ask Angel:** "May I start one EAS development build for iPhone?"
4. When she says yes, from `apps\mobile` run `eas build --profile development --platform ios`. This uploads your local commit, so no push is needed.
5. While it builds, continue with steps 2–7 (JavaScript only).
6. Once Angel installs the new build, run `npx expo start --dev-client -c` and test everything.

In the build log, note the **Xcode version**. If it is below 26, glass shows the fallback; report it, but don't change `eas.json` without Angel's OK. Before step 1, use the existing build only to check that the app still opens. After step 1, the old build **will crash** on the new imports, so don't test steps 2–7 on it.

---

## 4. Step-by-step details

### Step 1 — Lockfile + packages + light mode
1. Look for merge markers:
   `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)( |$)" -- package-lock.json apps/mobile/package-lock.json package.json apps/mobile/package.json`
   - If **none** (expected): skip to 2.
   - If any are found: at the repo root, delete `package-lock.json` and all `node_modules` folders (root and `apps\*`), then run `npm install` at the root with no legacy flags. If peer errors appear, report them; don't add `--legacy-peer-deps` on your own. Then re-run the grep (must be empty). Then prove a clean install: copy the repo (without any `node_modules`) to `%TEMP%\a1check` and run `npm ci` there. It must exit 0.
2. From `apps\mobile`:
   `npx expo install expo-glass-effect @expo/ui expo-haptics expo-blur expo-symbols expo-font`
   Then confirm `package.json` shows the ranges in §0 (glass ~57.0.4, ui ~57.0.21, haptics/blur/symbols ~57.0.3, font ~57.0.4).
3. `apps/mobile/app.json`: change `"userInterfaceStyle": "automatic"` to `"light"`. **Why:** Option A is light-first, and the native tab bar follows the phone's dark mode, which would clash with light screens. Dark mode comes later.
4. Run `npx expo install --check`, `npx expo-doctor` and `npm run typecheck`. All must pass.
5. Commit (package.json files + root `package-lock.json` + app.json). Then ask Angel about the build (see §3).

### Step 2 — Design tokens, in ONE file
**File:** `apps/mobile/src/design/theme.ts`. This is the repo's existing theme path, imported by `ui.tsx`, `Screen.tsx` and `_layout.tsx`. Replace its contents. Keep the old export names (`colors`, `spacing`, `radius`, `typography`, `shadow`) so the 28 screens still compile, and add `tokens`, `glass` and `motion`.

Values come from `design-system.md` §1–6, Option A light. Contents:
```ts
// Option A "Liquid Glass" – light first. Source: angelos-designer/design-system.md
const charcoal = '#1E2122';
export const tokens = {
  color: {
    charcoal,                                  // text, logo, main buttons
    charcoal2: 'rgba(30,33,34,0.64)',          // secondary text (~4.9:1 on ivory)
    charcoal3: 'rgba(30,33,34,0.42)',          // hints, disabled
    ivory: 'rgba(251,249,244,0.84)',           // cards and lists (#FBF9F4 @84%)
    ivorySolid: 'rgba(251,249,244,0.94)',      // Reduce Transparency / Android fallback
    pearl: '#EFE6DA',                          // subtle fills, avatars; A1 backdrop until the silk image lands
    tide: '#0C6264',                           // selected tab, Confirmed, links (~6:1)
    coral: '#A03B26',                          // needs attention, Cancel (~5.2:1)
    seaGlass: '#88A8A2',
    hairline: 'rgba(30,33,34,0.14)',
    onCharcoal: '#FBF9F4',
  },
  dark: { // defined for later, NOT wired in A1
    backdropTop: '#0E1F21', backdropBottom: '#27403F', ivory: '#EDE6DA',
    ivory2: 'rgba(237,230,218,0.66)', surface: 'rgba(23,25,26,0.86)',
    hairline: 'rgba(237,230,218,0.12)', tide: '#6CC6C0', coral: '#F08C74',
  },
  type: { // size / lineHeight / weight
    largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
    heroTime:   { fontSize: 60, lineHeight: 64, fontWeight: '300' },
    title2:     { fontSize: 22, lineHeight: 28, fontWeight: '600' },
    headline:   { fontSize: 17, lineHeight: 22, fontWeight: '600' },
    body:       { fontSize: 17, lineHeight: 22, fontWeight: '400' },
    subhead:    { fontSize: 15, lineHeight: 20, fontWeight: '400' },
    footnote:   { fontSize: 13, lineHeight: 18, fontWeight: '500' },
    overline:   { fontSize: 12, lineHeight: 14, fontWeight: '500', letterSpacing: 0.9, textTransform: 'uppercase' },
    maxFontScale: 1.3,           // allow phone text size up to ~130%
    tabularNums: ['tabular-nums'] as const, // times and money
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, screen: 20, tap: 44 },
  row: { client: 64, booking: 68, menuItem: 48, control: 44 },
  radius: { pill: 999, block: 20, card: 28, hero: 32, menu: 26, sheet: 38 },
  shadow: { // design token "0 14 30 -16 tinted charcoal"; RN has no spread, tune by eye
    shadowColor: charcoal, shadowOpacity: 0.16, shadowRadius: 15, shadowOffset: { width: 0, height: 14 }, elevation: 3,
  },
} as const;

export const glass = { // rule of three: max 3 glass layers on screen, never glass on glass, never per row
  maxLayersOnScreen: 3,
  roundButton: { style: 'clear' as const, interactive: true, fallbackBlur: 60 },
  toast:       { style: 'regular' as const, fallbackBlur: 70 },
  menu:        { style: 'regular' as const, fallbackBlur: 80 },   // custom menus only (fallback path)
  sheet:       { style: 'regular' as const, fallbackBlur: 80 },
  blurTint: 'systemThinMaterialLight' as const,                   // expo-blur fallback on iOS < 26
  highlightTop: 'rgba(255,255,255,0.85)', highlightAll: 'rgba(255,255,255,0.45)',
};

export const motion = { // RN Animated.spring accepts damping/stiffness/mass
  instant: 100, quick: 200, standard: 320, emphasis: 450,
  snap:   { damping: 20, stiffness: 300, mass: 1 },   // press 0.97, toggles
  smooth: { damping: 24, stiffness: 220, mass: 1 },   // sheets, menus, layout
  lift:   { damping: 18, stiffness: 260, mass: 0.9 }, // long-press lift
  pressScale: 0.97, liftScale: 1.035, longPressMs: 350, toastMs: 4000,
  reducedFadeMs: 150,                                 // Reduce Motion: fades only
};

// --- compatibility for existing screens (do not add new uses) ---
const lightCompat = {
  background: tokens.color.pearl, elevated: tokens.color.ivory, warmSurface: tokens.color.pearl,
  primaryText: charcoal, secondaryText: tokens.color.charcoal2, border: tokens.color.hairline,
  gold: tokens.color.tide,            // old accent → tide (links, chevrons, selected)
  softGold: 'rgba(12,98,100,0.12)',
  success: tokens.color.tide, warning: tokens.color.coral, critical: tokens.color.coral,
};
export const colors = { light: lightCompat, dark: lightCompat }; // A1 is light only
export const spacing = { xs: 8, sm: 16, md: 24 };
export const radius = { card: tokens.radius.card, control: tokens.radius.block, pill: 999 };
export const typography = { display: 34, screenTitle: 34, section: 17, body: 17, support: 15, metadata: 13 };
export const shadow = { soft: tokens.shadow };
```
(There's no amber in the Option A spec, so "warning" uses coral. Don't invent a colour.)

**Also in step 2:**
- `src/components/ui.tsx`:
  - `PrimaryActionLabel` → charcoal fill with `onCharcoal` text, pill radius, min height 44.
  - `SecondaryActionLabel` → ivory fill with a hairline border.
  - Every `<Text>` gets `maxFontSizeMultiplier={tokens.type.maxFontScale}`.
  - `ScreenTitle` uses `largeTitle`.
- `src/components/Screen.tsx`: background `tokens.color.pearl`, side padding 20, and add `keyboardShouldPersistTaps="handled"` to the ScrollView.
- **New** `src/components/Glass.tsx` exports `GlassSurface`:
  ```tsx
  // iOS 26+ with the API → GlassView; iOS < 26 → BlurView; Android or Reduce Transparency → solid ivory.
  import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
  import { BlurView } from 'expo-blur';
  // useReduceTransparency(): AccessibilityInfo.isReduceTransparencyEnabled() + 'reduceTransparencyChanged' listener
  const canGlass = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  // never set opacity 0 on a GlassView or its parents (glass stops rendering) – animate with transform/fade on a wrapper sibling instead
  ```
  Fallback order: `canGlass && !reduceTransparency` → `<GlassView glassEffectStyle=… isInteractive=…>`; `Platform.OS === 'ios' && !reduceTransparency` → `<BlurView tint={glass.blurTint} intensity={…} style={{overflow:'hidden'}}>`; otherwise → `<View>` with `ivorySolid` + 0.5 px `highlightAll` border + `tokens.shadow`.
  Use it only for the round header button, the toast and the fallback menu sheet. The tab bar is drawn by the system.

### Step 3 — Tabs and titles

**Choice: `expo-router/unstable-native-tabs` (NativeTabs).**
- **Why:** Option A's tab bar is the system liquid-glass bar (`option-A-dashboard.png`, `states-A.png`). NativeTabs gets it from iOS itself on iOS 26. On iOS 18–25 it shows the normal iOS tab bar, and on Android the Material bar. No custom drawing, best feel, least code.
- **Risks (from the Expo docs, see feasibility.md):**
  - The API is "unstable". It moves to `expo-router/native-tabs` in SDK 58.
  - Limited FlatList support.
  - White flash between tabs unless wrapped in `ThemeProvider`.
  - Tabs can't be added or removed at runtime.
- **Fallback (one-file swap):** if any of these happen, replace `app/(tabs)/_layout.tsx` with expo-router's JS `Tabs`. It's already exported by `expo-router` 57, so no new package is needed. The code is at the end of this step.
  - Native tabs crash.
  - The white flash persists even with `ThemeProvider`.
  - The Clients list stops scrolling or jumps.
  - `typecheck` fails on the NativeTabs API.

**Move files with `git mv`** (URLs stay the same because `(tabs)` is a group, so existing `Link`s keep working):

| From | To |
|---|---|
| `app/index.tsx` | `app/(tabs)/index.tsx` |
| `app/clients/index.tsx` | `app/(tabs)/clients/index.tsx` |
| `app/clients/[id].tsx` | `app/(tabs)/clients/[id].tsx` |
| `app/clients/new.tsx` | `app/(tabs)/clients/new.tsx` |
| `app/calendar.tsx` | `app/(tabs)/calendar/index.tsx` |

Fix the relative imports in moved files (`'../src/…'` becomes `'../../src/…'` or `'../../../src/…'`). The `@/*` → `src/*` path alias already exists in `tsconfig.json`, so you may use `@/components/...` instead.

**New files:**
- `app/(tabs)/_layout.tsx`:
  ```tsx
  import { NativeTabs } from 'expo-router/unstable-native-tabs';
  import { tokens } from '@/design/theme';
  export default function TabsLayout() {
    return (
      <NativeTabs tintColor={tokens.color.tide} minimizeBehavior="never">
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="clients">
          <NativeTabs.Trigger.Label>Clients</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="calendar">
          <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="academy">
          <NativeTabs.Trigger.Label>Academy</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'graduationcap', selected: 'graduationcap.fill' }} md="school" />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  ```
  Check the prop names against `node_modules/expo-router/build/native-tabs/types.d.ts`. If an Android `md` name is rejected by the types, use the name the types suggest (Android isn't Angel's phone). The search tab in the mockups is **later**.
- `app/(tabs)/clients/_layout.tsx` and `app/(tabs)/calendar/_layout.tsx`: a `Stack` with `index` set to `headerShown: false` (the screen shows its own large title, like the mockups), and other screens showing the header.
- `app/(tabs)/academy.tsx`: an honest empty state, with no fake students: title "Academy", card "Academy is coming", text "Your courses and students will live here.", no buttons. Design copy for later: "No students yet" (`design-system.md` §8).
- `app/_layout.tsx` (root):
  - Wrap in `ThemeProvider` from `expo-router` with `DefaultTheme` colours set to `background: pearl`, `card: ivorySolid`, `text: charcoal`, `primary: tide`, `border: hairline`.
  - Add `<StatusBar style="dark" />` (`expo-status-bar` is already a dependency).
  - Root `Stack` with `screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerStyle: { backgroundColor: pearl }, headerTintColor: charcoal }}`.
  - `(tabs)` set to `headerShown: false`, plus every title below.
  - Keep `<UsageTracker />`. Add `<ToastProvider>` and `<AuthGate>` (step 4).

**Every route file and its title.** "Header" = the title in the top bar; "In-screen" = the big title inside the page.

| Route file (after step 3) | Header title | In-screen title (change if different now) |
|---|---|---|
| `app/(tabs)/index.tsx` | (none, tab root) | **Today** (was "AngelOS") |
| `app/(tabs)/clients/index.tsx` | (none) | Clients |
| `app/(tabs)/clients/[id].tsx` | the client's name (`<Stack.Screen options={{ title: client.display_name }} />`; "Client" while loading) | client's name |
| `app/(tabs)/clients/new.tsx` | New client | New client |
| `app/(tabs)/calendar/index.tsx` | (none) | Calendar |
| `app/(tabs)/academy.tsx` | (none) | Academy |
| `app/bookings/new.tsx` | New booking | New booking |
| `app/bookings/reschedule.tsx` (new, step 5) | Change time | Change time |
| `app/login.tsx` | (hidden) | Welcome to AngelOS |
| `app/forgot-password.tsx` (new, step 6) | Reset password | Reset your password |
| `app/reset-password.tsx` (new, step 6) | New password | Choose a new password |
| `app/onboarding.tsx` | Set up your studio | (keep) |
| `app/ai.tsx` | Ask AngelOS | (keep, assistant name) |
| `app/ai-settings.tsx` | Assistant settings | Assistant settings |
| `app/analytics.tsx` | Insights | Insights |
| `app/automations.tsx` | Reminders & follow-ups | Reminders & follow-ups |
| `app/beta-feedback.tsx` | Send feedback | (keep "Help shape AngelOS") |
| `app/content/index.tsx` | Posts | Posts |
| `app/content/new.tsx` | New post | New post |
| `app/content/[id].tsx` | the post's title (Stack.Screen), "Post" while loading | (keep) |
| `app/finance.tsx` | Money | (do not edit the file; header title only, via root `_layout`) |
| `app/founder-admin.tsx` | Founder controls | (keep) |
| `app/marketing-profile.tsx` | Marketing profile | Marketing profile |
| `app/media/index.tsx` | Photos & videos | Photos & videos |
| `app/media/import.tsx` | Add photos | Add photos |
| `app/messages/index.tsx` | Messages | Messages |
| `app/messages/[id].tsx` | the client's name (Stack.Screen), "Conversation" while loading | (keep) |
| `app/services.tsx` | Services & hours | Services & hours |
| `app/settings.tsx` | Settings | Settings |
| `app/subscription.tsx` | Your plan | (do not edit the file; header title only, via root `_layout`) |
| `app/system-health.tsx` | Needs attention | Needs attention |

**Today screen (`(tabs)/index.tsx`):**
- Keep the existing auth redirect and the health card.
- Remove the "Run Today" rows for Calendar and Clients (they are tabs now).
- Keep the "Tools & Controls" links, since that's how to reach Messages, Posts, Media, Insights, Reminders, Feedback and Settings.
- Add a round `GlassSurface` button (44×44, `SymbolView name="gearshape"`) at the top right that opens `/settings`, with `accessibilityLabel="Settings"`.

**JS fallback for `app/(tabs)/_layout.tsx`** (use only if needed):
```tsx
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { GlassSurface } from '@/components/Glass';
// <Tabs screenOptions={{ headerShown:false, tabBarActiveTintColor: tide,
//   tabBarStyle:{ position:'absolute', borderTopWidth:0, backgroundColor:'transparent' },
//   tabBarBackground: () => <GlassSurface kind="toast" style={StyleSheet.absoluteFill} /> }}>
//   <Tabs.Screen name="index" options={{ title:'Today', tabBarIcon:({color}) => <SymbolView name="house" tintColor={color} size={24}/> }} />
//   ...clients / calendar / academy the same
```

### Step 4 — Friendly errors, toast, session expiry, silent failures

**New `src/lib/friendly-error.ts`:** `toFriendly(error, ctx)` returns `{ title, message, retry: boolean, kind }`.
- `ctx` is `{ action: 'load' | 'save' | 'send' | 'signin', thing?: string }`, for example `{ action: 'load', thing: 'clients' }`.
- The raw text goes only to `if (__DEV__) console.warn(...)`. It is never shown.

| Cause (how to detect) | Title | Message |
|---|---|---|
| Network down: `TypeError` "Network request failed", or `ApiError.status === 0` / timeout | You're offline | Check your connection and try again. Nothing has been lost. |
| Load failed (any other, `action: 'load'`) | We couldn't load your {thing} | Check your connection and try again. Nothing has been lost. |
| Save failed (`action: 'save'`) | That didn't save | We kept what you typed. Try again in a moment. |
| 401 | (no toast; session flow below) | |
| 403 | This isn't available yet | Your account doesn't have access to this. Nothing has changed. |
| 404 | We couldn't find that | It may have been removed. Pull down to refresh. |
| 409 with `code: 'HARD_CONFLICT'` | That time is taken | Please choose another time. |
| 409 with `code: 'SOFT_CONFLICT'` | (the caller asks "Book anyway?", already done in `bookings/new.tsx`) | |
| 409 other | This changed a moment ago | Refresh and try again. |
| 400 / 422 | Some details need a look | Please check the fields and try again. |
| 429 | Too many tries | Please wait a minute and try again. |
| 5xx | Something went wrong on our side | Nothing has been lost. Try again in a moment. |
| Supabase `invalid_credentials` | That didn't match | Check your email and password, or tap "Forgot password?". |
| Supabase `email_not_confirmed` | Please confirm your email | Open the email we sent you, then sign in. |
| Supabase `over_email_send_rate_limit` | Too many emails | Please wait a few minutes before asking again. |

Detect Supabase errors by `error.code` (an `AuthError`), not by message text. Note that the staging API returns `{ code, message }` objects for conflicts (checked in the `bookings.service.ts` source).

**`src/lib/api.ts`:**
- Add a 15 s timeout (AbortController) that throws `ApiError(0, …)`. There's none now; the other repo had 5 s, which is too short for salon Wi-Fi.
- On `response.status === 401`, call `handleSessionExpired()` before throwing.

**New `src/lib/session.ts`:**
- `handleSessionExpired()`:
  - Uses a module flag so it runs only once at a time.
  - If there was a session: set `signedOutReason = 'expired'` and `await supabase.auth.signOut({ scope: 'local' })`.
  - Then `router.replace('/login')`.
- `consumeSignedOutReason()` returns the reason and clears it.
- In `app/_layout.tsx`, the `AuthGate` listens to `supabase.auth.onAuthStateChange`. On `SIGNED_OUT` it calls `router.replace('/login')`, unless the current path is `/login`, `/forgot-password` or `/reset-password`.
- `login.tsx` calls `consumeSignedOutReason()` on mount. If the result is `'expired'`, it shows an inline card (not an alert): **"You were signed out to keep your account safe. Please sign in again."**
- Dev-only test hook: in `settings.tsx`, `{__DEV__ ? <row "Test: end my session" onPress={() => supabase.auth.signOut({ scope:'local' }).then(() => apiFetch('/workspaces').catch(()=>{}))} /> : null}`. It never ships in release builds.

**New `src/components/Toast.tsx`:**
- `ToastProvider` + `useToast()` with `show({ title, message?, tone: 'success'|'info'|'error', action?: { label, onPress } })`.
- Sits at the bottom above the tab bar, on a `GlassSurface`.
- Slides up 320 ms with `motion.smooth`, stays 4 s. With Reduce Motion on, it fades in over 150 ms (`AccessibilityInfo.isReduceMotionEnabled()`).
- `accessibilityLiveRegion="polite"` and `AccessibilityInfo.announceForAccessibility(title)`.

**New `src/components/ErrorState.tsx`:**
- Inline card: an icon in a circle (`wifi.slash` for offline, `exclamationmark.triangle` otherwise), the title, the message, and a charcoal **Try again** button.
- Follows the "Couldn't load" panel in `states-A.png`.
- Haptic `error` only when Try again fails a second time.

**Replace the "Unknown error" fallbacks.** There are 59 in 24 files on `chore/sdk57-dev-build` (check with `Select-String -Path app\**\*.tsx -Pattern 'Unknown error'`).
- **Load failures on main screens** (clients index, client detail load, calendar load, messages index, bookings/new setup): replace the `Alert.alert` with an `ErrorState` shown in the page plus a **Try again** button that calls `load()` again.
- **All other `Alert.alert(…, error instanceof Error ? error.message : 'Unknown error')`:** replace with `toast.show(toFriendly(error, { action, thing }))`.
- **Excluded (payments/billing rule):** `subscription.tsx` (×5), `finance.tsx` (×1), and the `savePayment` catch in `clients/[id].tsx` (×1). Leave these 7 exactly as they are and list them in your report as "left for Angel's decision".
- In `login.tsx`, replace `Alert.alert('Sign in failed', error.message)` and `('Account could not be created', error.message)` with an inline message from `toFriendly(error, { action: 'signin' })`.

**Silent failures** in `app/(tabs)/clients/[id].tsx`: `saveNote()` (was lines 46–51) and `saveTreatment()` (was lines 73–78) call `await` with no try/catch.
- Wrap each in try/catch/finally with a `savingNote` / `savingTreatment` busy flag.
- On success: haptic `success` + toast "Note added" / "Treatment added", then clear the input.
- On failure: **keep the typed text**, then toast "That didn't save" + "We kept what you typed. Try again in a moment."
- Disable the button while saving and show "Saving…".

### Step 5 — Long-press menus + haptics

**New `src/lib/haptics.ts`** (wraps `expo-haptics`; every call is wrapped in `.catch(() => {})`). From `design-system.md` §9:
- `tap()` → `impactAsync(Light)`
- `lift()` → `impactAsync(Medium)`
- `select()` → `selectionAsync()`
- `success()` → `notificationAsync(Success)`
- `warning()` → `notificationAsync(Warning)`
- `error()` → `notificationAsync(Error)`

No haptics for loading, scrolling or background errors.

**Menu library: `MenuView` from `@expo/ui/community/menu`** (verified in 57.0.22: iOS uses the SwiftUI `ContextMenu` on long-press, Android uses Compose `DropdownMenu`). It gives the native lifted row with blurred background shown in `option-A-menus.png`.

**New `src/components/RowMenu.tsx`:**
```tsx
type RowAction = { id: string; title: string; sf: SFSymbol; destructive?: boolean; later?: boolean; separateBefore?: boolean };
// <RowMenu actions={...} onAction={(id) => ...} accessibilityHint="Hold for options">{row}</RowMenu>
```
- **Native path:** `<MenuView shouldOpenOnLongPress actions={…} onPressAction={({nativeEvent}) => { haptics.tap(); onAction(nativeEvent.event); }}>`.
  - `later` actions get `attributes: { disabled: true }` and the title "{title} · later".
  - The destructive item goes last, in its own inline group (`displayInline` subactions) with `attributes.destructive`.
  - On iOS, `onOpenMenu` isn't fired, so the system's own long-press feedback stands in for the "lift" haptic.
- **JS fallback path,** used if `USE_NATIVE_MENU = false` or the test in §9 fails:
  - Wrap the row in `Pressable` with `onLongPress` and `delayLongPress={motion.longPressMs}`.
  - On long-press: `haptics.lift()`, a scale animation to `motion.liftScale` with `motion.lift`, then:
    - iOS: `ActionSheetIOS.showActionSheetWithOptions` with `destructiveButtonIndex`, `cancelButtonIndex` and `disabledButtonIndices` for `later` items.
    - Android: a `Modal` sheet on `GlassSurface`.
  - This needs no new package.
- **Must keep:** a normal tap on the row still opens the client or booking, exactly as now. Also add `accessibilityActions` with the same items, so VoiceOver users can reach the menu without holding.

**Clients rows** (`app/(tabs)/clients/index.tsx`): the menu wraps each client card.

| Item | What it does | Endpoint / file | Status |
|---|---|---|---|
| Message | Find this client's conversation: `listMessageThreads(workspaceId)` and pick the thread where `thread.client?.id === client.id`, then `router.push('/messages/' + thread.id)`. If there's none, show the toast "No conversation with {name} yet" / "Messages from LINE or Instagram will appear here." | `GET /workspaces/:workspaceId/messaging/threads` (`src/lib/messaging.ts` `listMessageThreads`, existing; `client.id` is in the response, checked in the API source) | build |
| Book | `router.push({ pathname: '/bookings/new', params: { clientId: client.id } })`. In `bookings/new.tsx`, read `useLocalSearchParams<{ clientId?: string }>()` and preselect it. | `POST /workspaces/:workspaceId/appointments` (existing `createAppointment`) | build |
| Add note | `router.push({ pathname: '/clients/[id]', params: { id: client.id, focus: 'note' } })`. In `[id].tsx`, `autoFocus` the note input when `focus === 'note'`. | `POST /workspaces/:workspaceId/clients/:clientId/notes` (existing `addClientNote`) | build |
| Send aftercare | — | No endpoint sends aftercare directly to a client. Sending needs a conversation plus approval. | **later** (disabled item) |
| Archive (separate group) | — | No "archived" status exists. Allowed values are lead, warm, booking_intent, booked, active, returning, inactive, and the list doesn't hide any of them. **Do not fake it with "inactive".** | **later** (disabled item) |

**Booking rows** (`app/(tabs)/calendar/index.tsx`): only appointments get the menu, not blocks. First add to `CalendarItem` the fields `appointmentId`, `status` and `client`, which are already in the `getCalendar` response type (`CalendarAppointment`).

| Item | When shown | What it does | Endpoint / file | Status |
|---|---|---|---|---|
| Reschedule | status not cancelled/completed/no_show | Open `/bookings/reschedule?appointmentId=…` (new screen below) | `POST /workspaces/:workspaceId/appointments/:appointmentId/reschedule` with body `{ startAt: ISO, overrideSoftConflict?: boolean }` (DTO checked). **Add** `rescheduleAppointment()` to `src/lib/bookings.ts`. | build |
| Confirm | status `request` or `confirmation_pending` (disabled otherwise) | `confirmAppointment()`, then haptic `success`, toast "Booking confirmed", reload | `POST …/appointments/:appointmentId/confirm` (existing `confirmAppointment`) | build |
| Message | always | Same thread lookup as for clients, using `appointment.client.id` | `GET …/messaging/threads` | build |
| Cancel (separate, destructive) | status `request`, `confirmation_pending`, `confirmed`, `arrival_info_sent`, `checked_in` | Confirm first (below), then `cancelAppointment()`, haptic `lift` (medium), toast "Appointment cancelled", reload. The design's "Undo" is **later**: there's no un-cancel endpoint. | `POST …/appointments/:appointmentId/cancel`. **Add** `cancelAppointment()` to `src/lib/bookings.ts`. | build (Undo later) |

**Cancel confirmation** (`option-A-menus.png` panel 3). Use the native `Alert.alert` (no new package):
```ts
haptics.warning();
Alert.alert(
  `Cancel ${name}'s appointment?`,               // name = client.display_name (full name; avoids wrong first/last order for Japanese names)
  `${formatWhen(start)} · ${serviceName}. The slot opens up again. You can message ${name} afterwards.`,
  [
    { text: 'Keep it', style: 'cancel', onPress: () => haptics.tap() },
    { text: 'Cancel appointment', style: 'destructive', onPress: () => void doCancel() },
  ]
);
```
Nobody is messaged automatically.

**New `app/bookings/reschedule.tsx`:**
- Reads `appointmentId` (and the current start, client name and service via params).
- Shows the current time, then `DateTimePicker` from `@expo/ui/community/datetime-picker` (`mode="datetime"`, `minimumDate={new Date()}`, `is24Hour`), then a charcoal **Save new time** button.
- On a 409 `SOFT_CONFLICT`, ask "This time overlaps a flexible block. Book anyway?" (Keep looking / Book anyway, which re-sends with `overrideSoftConflict: true`).
- On a 409 `HARD_CONFLICT`, show the friendly "That time is taken".
- On success: haptic `success`, toast "Time changed", then `router.back()` and reload the calendar.

Also add `src/lib/bookings.ts` → `completeAppointment()` only if you need it for the status list. Don't add new menu items beyond the table.

### Step 6 — Forgot password, set new password, show/hide eye

**`app/login.tsx`:**
- **Eye button** inside the password field: `Pressable` (44×44) with `SymbolView name={visible ? 'eye.slash' : 'eye'}` and `accessibilityLabel={visible ? 'Hide password' : 'Show password'}`. It toggles `secureTextEntry={!visible}`.
- Add autofill hints:
  - email: `textContentType="emailAddress"`, `autoComplete="email"`, `returnKeyType="next"`
  - password: `textContentType="password"`, `autoComplete="current-password"`, `returnKeyType="go"`, `onSubmitEditing={signIn}`
- **"Forgot password?"** link under the password field: `router.push({ pathname: '/forgot-password', params: { email } })`.
- Errors are inline, via `toFriendly` (step 4).

**New `app/forgot-password.tsx`:**
- Email field, prefilled from the param.
- **Send reset link** button calls:
  ```ts
  import * as Linking from 'expo-linking';
  const redirectTo = Linking.createURL('reset-password');
  if (__DEV__) console.log('reset redirectTo =', redirectTo); // must match the Supabase allow-list entry
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  ```
- Whether or not the account exists, show the same text: **"If there's an account for that email, we've sent a link. Open it on this iPhone."** (Don't reveal which emails have accounts.) Then haptic `success`.
- Errors go through `toFriendly`; a 429 rate limit gets the friendly message.

**New `app/reset-password.tsx`** (public route, allowed by AuthGate):
- Get the full URL including the `#fragment` with `Linking.useURL()`, plus `Linking.getInitialURL()` for a cold start. The `useLocalSearchParams` hook does not include the fragment.
- If there's a `code` query param, call `await supabase.auth.exchangeCodeForSession(code)` (PKCE).
- Else parse the fragment with `new URLSearchParams(url.split('#')[1] ?? '')`:
  - If it has `access_token` and `refresh_token`, call `await supabase.auth.setSession({ access_token, refresh_token })`. This is the supabase-js default (implicit) flow; `detectSessionInUrl` is false in `src/lib/supabase.ts`, so it must be done by hand.
  - If it has `error_code` (for example `otp_expired`), show **"This link has expired. Ask for a new one."** with a button to `/forgot-password`.
- Then a form with **New password** + **Repeat new password** (each with the eye button), minimum 8 characters, and inline messages ("Passwords don't match", "Use at least 8 characters").
- **Save** calls `await supabase.auth.updateUser({ password })`, then haptic `success`, toast "Password changed", then `router.replace('/')`.
- Never log tokens.

**Supabase dashboard (Angel or Grok must do this; Gordon must NOT touch Supabase settings or `.env`):**
- In the staging Supabase project the app uses: **Authentication → URL Configuration → Redirect URLs**.
- Add `angelos-staging://reset-password`. This is what the current dev build uses: `eas.json` profile `development` sets `EXPO_PUBLIC_APP_ENV=staging`, and `app.config.js` maps that to scheme `angelos-staging`.
- Also add `angelos-dev://reset-password` (local development env).
- Later, for the store build: `angelos://reset-password`.
- If the `console.log` in forgot-password prints something different (for example with three slashes), add that exact value too.
- Without this, Supabase sends the link to its default Site URL and the app won't open.
- Note: Supabase's built-in email sender is rate-limited. If emails stop arriving during testing, wait or ask Grok.

### Step 7 — Repo hygiene checks
1. `Select-String -Path app\**\*.tsx,src\**\*.ts* -Pattern "expo-blur"`. `expo-blur` is now a real dependency (step 1) used by `Glass.tsx`. If any **other** file imports `expo-blur` without using it, remove that import.
2. If `app/system-check.tsx` exists (it doesn't on `AngelOS_2.0`; it does in the old repo):
   - **Don't delete it.**
   - Add a visible coral banner at the top: **"Demo screen — these checks are not real yet."**
   - Add `// TODO(design-a1): results are hard-coded; replace with /system-health data or remove after Angel decides.`
   - Rename its tile or link label to "System check (demo)".
3. Re-run the merge-marker grep from step 1. It must be empty.

### Step 8 — Final checks (no commit) and report
From `apps\mobile`:
- `npm run typecheck`
- `npx expo-doctor`
- `npx expo install --check`
- `npx expo config --type public` (scheme should be `angelos-staging` with `EXPO_PUBLIC_APP_ENV=staging`; userInterfaceStyle `light`)

Then `git log --oneline main..feat/design-a1` should show up to 7 commits.

Report to Grok/Angel:
- the commit list
- the EAS build link (if Angel allowed it) and the Xcode version from the log
- results of each acceptance test (§9)
- the 7 excluded "Unknown error" spots
- anything marked "later"
- anything you couldn't verify

**Do not push.**

---

## 5. Endpoints used (all exist in the live staging API, release `cbf2338`)

| Use | Method + path | App function (file) |
|---|---|---|
| List clients | `GET /workspaces/:workspaceId/clients?search=` | `listClients` (`src/lib/clients.ts`, existing) |
| Add note | `POST /workspaces/:workspaceId/clients/:clientId/notes` `{ noteType, content }` | `addClientNote` (existing) |
| Add treatment | `POST /workspaces/:workspaceId/clients/:clientId/treatments` | `addTreatment` (existing) |
| Find conversation | `GET /workspaces/:workspaceId/messaging/threads` | `listMessageThreads` (`src/lib/messaging.ts`, existing) |
| New booking | `POST /workspaces/:workspaceId/appointments` | `createAppointment` (`src/lib/bookings.ts`, existing) |
| Calendar | `GET /workspaces/:workspaceId/calendar?start&end` | `getCalendar` (existing) |
| Confirm | `POST /workspaces/:workspaceId/appointments/:appointmentId/confirm` | `confirmAppointment` (existing) |
| Cancel | `POST /workspaces/:workspaceId/appointments/:appointmentId/cancel` | **add** `cancelAppointment` |
| Reschedule | `POST /workspaces/:workspaceId/appointments/:appointmentId/reschedule` `{ startAt, overrideSoftConflict? }` | **add** `rescheduleAppointment` |
| Password reset / new password / sign out | Supabase Auth (`resetPasswordForEmail`, `setSession` / `exchangeCodeForSession`, `updateUser`, `signOut`) | `src/lib/supabase.ts` client |

**Later (no endpoint, not built, not faked):**
- Send aftercare
- Archive client
- Undo after cancel
- Search tab
- Silk backdrop image
- Dark mode
- Japanese text (separate batch)

---

## 6. File-by-file plan (`apps/mobile/…`)

| File | Step | Change |
|---|---|---|
| `package.json` (+ root `package-lock.json`) | 1 | add 6 packages via `npx expo install` |
| `app.json` | 1 | `userInterfaceStyle: "light"` |
| `src/design/theme.ts` | 2 | Option A tokens, glass, motion (+ compatibility exports) |
| `src/components/ui.tsx` | 2 | buttons/titles on tokens, font-scale cap |
| `src/components/Screen.tsx` | 2 | pearl background, padding 20, keyboard taps |
| `src/components/Glass.tsx` | 2 | **new** — GlassView / BlurView / solid fallback |
| `app/_layout.tsx` | 3,4 | ThemeProvider, StatusBar, all titles, ToastProvider, AuthGate |
| `app/(tabs)/_layout.tsx` | 3 | **new** — NativeTabs (JS Tabs fallback) |
| `app/(tabs)/index.tsx` | 3 | moved from `app/index.tsx`; "Today"; settings glass button |
| `app/(tabs)/clients/_layout.tsx`, `app/(tabs)/calendar/_layout.tsx` | 3 | **new** — Stacks |
| `app/(tabs)/clients/index.tsx` | 3,4,5 | moved; ErrorState; RowMenu |
| `app/(tabs)/clients/[id].tsx` | 3,4,5 | moved; title; saveNote/saveTreatment fixed; `focus=note`; (payment untouched) |
| `app/(tabs)/clients/new.tsx` | 3,4 | moved; title; friendly errors |
| `app/(tabs)/calendar/index.tsx` | 3,4,5 | moved from `app/calendar.tsx`; ErrorState; RowMenu; cancel dialog |
| `app/(tabs)/academy.tsx` | 3 | **new** — honest empty state |
| `app/bookings/new.tsx` | 3,4,5 | title; friendly errors; `clientId` param preselect |
| `app/bookings/reschedule.tsx` | 5 | **new** |
| `app/login.tsx` | 4,6 | inline errors, expired note, eye, autofill, Forgot link |
| `app/forgot-password.tsx`, `app/reset-password.tsx` | 6 | **new** |
| `app/settings.tsx` | 4 | `__DEV__`-only "end my session" test row |
| other `app/*.tsx` with "Unknown error" (except subscription, finance, payment) | 4 | toast via `toFriendly` |
| `src/lib/api.ts` | 4 | 15 s timeout, 401 → `handleSessionExpired` |
| `src/lib/session.ts`, `src/lib/friendly-error.ts`, `src/lib/haptics.ts` | 4,5 | **new** |
| `src/components/Toast.tsx`, `src/components/ErrorState.tsx`, `src/components/RowMenu.tsx` | 4,5 | **new** |
| `src/lib/bookings.ts` | 5 | add `cancelAppointment`, `rescheduleAppointment` |
| `app/system-check.tsx` (only if it exists) | 7 | demo banner + TODO, not deleted |

---

## 7. What the result should look like
Reference pictures (in Grok's designer folder; ask Angel to share them if you need to see them):
- `option-A-dashboard.png` (Today + tab bar)
- `option-A-clients.png`
- `option-A-calendar.png`
- `option-A-menus.png` (hold menus + cancel question)
- `states-A.png` (couldn't load, loading, no clients, quiet day)
- `option-A-overview.png`

A1 delivers the tokens, tabs, titles, menus, errors and login parts of these pictures. The silk backdrop, skeleton shimmer, hero time card and logo splash are **later batches**. Use solid pearl until then.

---

## 8. Known risks
- **NativeTabs is "unstable"** in SDK 57. The fallback is ready (step 3).
- **Glass needs iOS 26 and Xcode 26** (feasibility.md). On older iOS, users see the blur fallback; with Reduce Transparency, solid surfaces. All of these are correct behaviour.
- **MenuView tap-through is unverified.** If tapping a row stops opening it, switch `USE_NATIVE_MENU` off (the JS fallback is ready).
- **Never put opacity 0 on a GlassView or its parent.** The glass silently stops rendering (Expo docs).
- **The laptop app is older than the staging API.** All A1 endpoints exist in both, but don't widen scope to other screens.

---

## 9. Acceptance tests for Angel (on her iPhone, after installing the new test build)
Use sample clients only: create **Hana Sato** and **Mei Nakamura** in the app first, and book Hana for tomorrow at 15:30.

1. **Opens:** Open AngelOS. You see four tabs at the bottom: Today, Clients, Calendar, Academy. Tap each one. Each shows a normal name at the top, never something like `clients/index`.
2. **Titles:** Open Clients → tap Hana Sato. The top says "Hana Sato". Go back, tap "New client". The top says "New client".
3. **Hold a client:** On Clients, press and hold Hana's row.
   - A menu appears with Message, Book, Add note, then greyed "Send aftercare · later" and "Archive · later".
   - Tap **Book**: the booking screen opens with Hana already chosen. Go back.
   - Hold again → **Add note**: Hana's page opens with the cursor in the note box.
4. **Normal tap still works:** Tap (don't hold) Mei's row. Her page opens.
5. **Note can't fail silently:** Turn on Airplane Mode. On Hana's page, type a note and tap Add Note.
   - A kind message appears ("That didn't save … We kept what you typed").
   - Your text is still there.
   - Turn Airplane Mode off, tap Add Note again: "Note added", with a small tap felt in the phone.
6. **Hold a booking:** On Calendar, press and hold Hana's booking. The menu shows Reschedule, Confirm, Message, and Cancel at the bottom in red.
   - Tap **Confirm**: you feel a success tap and see "Booking confirmed".
7. **Cancel asks first:** Hold Hana's booking → **Cancel**.
   - The question says "Cancel Hana Sato's appointment?" with **Keep it** and **Cancel appointment**.
   - Tap **Keep it**: nothing changes.
   - Do it again and tap **Cancel appointment**: you see "Appointment cancelled", and the booking shows as cancelled.
8. **Reschedule:** Book Mei for tomorrow, hold it → **Reschedule**, pick a new time, Save. You see "Time changed" and the new time on the Calendar.
9. **Friendly loading error:** Turn on Airplane Mode and open the Clients tab. You see "You're offline" or "We couldn't load your clients" with a **Try again** button. There's no technical text and no pop-up box. Turn it off and tap Try again: the list appears.
10. **Eye button:** Sign out (Settings → Sign out). On the login screen, type a password and tap the eye. The password shows; tap again and it hides.
11. **Forgot password** (only after Grok or Angel has added the redirect link in Supabase):
    - Tap "Forgot password?", enter your test email, tap Send reset link.
    - On this iPhone, open the email and tap the link. AngelOS opens on "Choose a new password".
    - Enter a new password twice and Save. You are signed in, and you see "Password changed".
12. **Signed out kindly:** Gordon runs the developer-only "end my session" test in front of you. The app goes to the login screen with "You were signed out to keep your account safe. Please sign in again."
13. **Glass:**
    - On iPhone with iOS 26: the tab bar and the round settings button on Today look like glass.
    - On older iOS: they look frosted.
    - With Settings → Accessibility → Display & Text Size → Reduce Transparency on: they look solid. All three are OK.

Pass = all 13 behave as written. Write down any step that doesn't, with a screenshot (sample names only).
