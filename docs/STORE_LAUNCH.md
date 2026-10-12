# Store launch checklist (App Store + Google Play)

Status as of 2026-10-12: both developer accounts exist. Android ships to the Play **internal** track
via `eas submit`. iOS has never had a store/TestFlight build.

Legend: 🔴 blocker · 🟡 needed before submit · 🟢 nice to have

---

## 0. Decisions to make first

- 🔴 **Store name.** "afk" alone is almost certainly taken on both stores. Pick one name for both,
  e.g. `afk – agents on your phone` (App Store name ≤ 30 chars, Play title ≤ 30 chars).
  Keep **"Zed"** out of the name/subtitle/icon (trademark, Apple 5.2.1); "works with Zed" in the
  description is fine.
- 🟡 **iPad.** `ios.supportsTablet: true` means iPad screenshots are required and Apple reviews on iPad.
  Either keep it and test on iPad, or set it to `false` for v1.
- 🟡 **ATS.** `NSAllowsArbitraryLoads: true` needs a written justification in review. `NSAllowsLocalNetworking`
  already covers LAN IPs, `.local` and Tailscale 100.x IPs; Tailscale hostnames go over HTTPS.
  Recommended: drop `NSAllowsArbitraryLoads` and test pairing over Wi-Fi + Tailscale on a real iPhone.
- 🟡 **Category:** Developer Tools (both stores). **Price:** free.

## 1. iOS – technical (afk-app)

- 🔴 **First iOS production build:** `eas build -p ios --profile production`. Let EAS create the
  distribution cert + provisioning profile + **APNs push key** (answer yes to push setup).
- 🔴 **Test on a real iPhone via TestFlight** (`eas submit -p ios`). The app has only ever run on
  Android, so go through: pairing by QR, pairing by link, Wi-Fi + Tailscale, push arrives,
  notification actions (approve/deny), Face ID lock, photo attach, demo mode, keyboard/composer,
  dark mode, deep link `zedthreads://demo`.
- 🟡 **Silent progress pushes** need the `remote-notification` background mode (added to app.json
  in this change). Check that `kind: "progress"` pushes don't show up as empty notifications on iOS.
- 🟡 Android-only features (widgets, Live Updates/`afk-live`, share intent) are simply absent on iOS.
  Make sure no screen links to them on iOS (settings toggles etc.).
- 🟡 **Privacy manifest:** Expo builds include the SDK manifests; check that the build has no
  "missing required reason API" warning email from App Store Connect (AsyncStorage → UserDefaults).
- 🟡 `eas.json` → `submit.production.ios`: add `ascAppId` once the app record exists.

## 2. Android – technical

- 🔴 **12 testers / 14 days rule:** if the Play developer account is a *personal* account created
  after Nov 2023, Google requires a **closed test with ≥12 opted-in testers for 14 continuous days**
  before you can apply for production. Start this **now**: it's the longest lead time in the whole
  plan. Use the launch-email list / GitHub / friends for testers.
- 🟡 Move the `eas submit` track from `internal` → `alpha` (closed testing) for that period.
- 🟡 The Play API only works after **one manual AAB upload** in the Console; make sure that's done and the
  service-account JSON for `eas submit` is set up.
- 🟢 `android.permissions` listed `POST_NOTIFICATIONS` four times (cleaned up in this change).
- 🟡 `usesCleartextTraffic: true` is fine (LAN hub), but say so in the review notes.

## 3. Reviewer access (both stores, most common rejection)

Reviewers have no Mac running the afk hub. **Demo mode is the answer**; make it obvious:
- 🔴 Review notes (Apple "App Review Information" / Play "App access"): *"afk is a companion to a
  free open-source program on the user's Mac. To try it without a Mac, tap **Try the demo** on
  the first screen: it simulates projects and agents."* Plus a link to the README / launch film.
- 🟡 Check that demo mode is reachable from the very first screen, with no permission prompts in the way.
- 🟢 Optional: a short screen recording of the real Mac → phone flow, linked in the notes.

## 4. Store listings and assets

| Item | App Store | Google Play |
|---|---|---|
| Icon | 1024×1024, no alpha (from `assets/icon.png`) | 512×512 |
| Screenshots | 6.9" iPhone (1320×2868), + 13" iPad if supportsTablet | phone ≥ 2 (1080×1920+), optional 7"/10" tablet |
| Feature graphic | – | 🔴 1024×500 |
| Short text | Subtitle ≤ 30 | Short description ≤ 80 |
| Long text | Description ≤ 4000, keywords ≤ 100 | Full description ≤ 4000 |
| Promo | Promotional text ≤ 170 | – |
| Video | App preview (optional) | YouTube URL (optional, could be the launch film) |

- 🟡 Screenshots: use demo mode on device. Show inbox, a thread with a tool card/diff,
  approving from a notification, the pairing screen. On Android, also widgets + Live Updates.
- 🟡 Copy: reuse the README/website wording. Lead with "Answer your coding agents from your phone."

## 5. Policy forms

- 🟡 **Privacy policy URL:** `https://goafk.dev/privacy` (exists). Update it: change "iPhone" wording once
  live, and say that photos you attach go only to your own Mac.
- 🟡 **Support URL** (Apple requires one): GitHub issues, or add `goafk.dev/support`.
- 🟡 **Apple App Privacy:** "Data Not Collected" (no backend, no analytics; push goes through
  Expo/Apple as a service provider). Double-check against the policy text before answering.
- 🟡 **Play Data safety:** no data collected/shared; data encrypted in transit = "Yes" only for
  Tailscale (HTTPS). LAN is plain HTTP, so answer honestly, which probably means "No" for "all data encrypted".
- 🟡 **Play content rating** questionnaire (IARC), **target audience** 18+, **ads:** none,
  **government/financial/health:** no.
- 🟡 **Apple age rating** questionnaire, **export compliance** already answered (`usesNonExemptEncryption: false`).
- 🟢 Apple 5.1.2(i) (sharing data with third-party AI): the app talks only to the user's own
  agents on their own Mac. Say so in the review notes up front.

## 6. Launch-side work (afk + website)

- 🟢 Website: swap "iPhone coming" / waitlist for store badges; README line 61 in `afk`.
- 🟢 Send the one announcement to the launch-email list, then delete the list (as the privacy policy says).
- 🟢 OTA: `runtimeVersion` = appVersion, channel `production`: JS-only fixes can ship via
  `eas update --channel production` after launch; bump `version` for native changes.

## Suggested order

1. **Today:** decide name, start the Play closed test (14-day clock), and run the first iOS build + TestFlight.
2. **Week 1:** iOS device QA fixes, screenshots (demo mode), listing copy, privacy/support pages.
3. **Week 2:** fill the policy forms and submit iOS for review (≈1–3 days).
4. **Day 15+:** apply for Play production access, then promote to production.
5. **Launch day:** website badges, announcement email, README.
