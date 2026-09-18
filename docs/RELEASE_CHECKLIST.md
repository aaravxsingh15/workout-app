# Release checklist (Google Play)

## Done in the repo
- [x] App icon, adaptive icon, monochrome icon, splash (`npm run` script: `node scripts/gen-icons.js`)
- [x] `app.json`: package `com.aaravxsingh.ironlog`, versionCode/version, blocked storage permissions, backups off
- [x] `eas.json`: `development`, `preview` (APK), `production` (AAB, auto-increment)
- [x] `expo-doctor` 21/21, typecheck, lint, unit tests, bundle export green
- [x] In-app account deletion, privacy policy + store listing drafts (`docs/PRIVACY_POLICY.md`, `docs/PLAY_STORE_LISTING.md`)

## You must do (accounts / keys — cannot be done for you)
1. **Expo account** (free) → `npx expo login`, then `npx eas-cli login`.
2. `npx eas-cli init` (links the project; adds `extra.eas.projectId` to app.json — commit it).
3. **Give the cloud build your Supabase values** (`.env` is not uploaded):
   ```
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://hytwulfrgyupasdezpkw.supabase.co" --environment production --visibility plaintext
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<publishable key>" --environment production --visibility plaintext
   ```
   (repeat with `--environment preview` for the test APK)
4. **Test build first:** `npx eas-cli build --platform android --profile preview` → install the APK on your phone and re-run the full journey (this also tests deep links and rest-timer notifications, which Expo Go cannot).
5. **Supabase → Authentication → URL Configuration:** Site URL `ironlog://`, Redirect URLs `ironlog://**`. Re-enable "Confirm email" if you want it in production, and set up custom SMTP (the built-in mailer is heavily rate-limited).
6. **Google Play Developer account** ($25 one-time, identity verification takes days). Personal accounts created after Nov 2023 must run a **closed test with 12+ testers for 14 days** before production access.
7. Host `docs/PRIVACY_POLICY.md` at a public URL (GitHub Pages works); fill in the bracketed contact details.
8. Play Console → create app → fill store listing (`docs/PLAY_STORE_LISTING.md`), Data safety, Content rating, Target audience. Upload screenshots + 1024×500 feature graphic.
9. **Production build:** `npx eas-cli build --platform android --profile production` → upload the AAB to an internal/closed testing track. (EAS can generate and store the signing key for you; let it.)
10. Replace the placeholder `LICENSE`.

## Before promoting to production
- [ ] Two-user test: confirm user A cannot see user B's data (RLS)
- [ ] Airplane-mode test: full workout offline, then reconnect and confirm sync
- [ ] Rotate the Supabase database password (it was shared in chat)
- [ ] Bump `expo.version` for user-visible releases; `versionCode` auto-increments on EAS
