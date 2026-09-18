# Release checklist (Google Play)

- [ ] Definition-of-Done journey passes on a physical Android device (see README / VERSION_1_SCOPE)
- [ ] `npm run typecheck && npm run lint && npm test && npm run bundle:check` green
- [ ] Supabase: migrations applied, RLS verified with two test users, redirect URL `ironlog://reset-password` configured, email templates/SMTP set
- [ ] App icon/adaptive icon/splash replaced with final artwork (current assets are Expo defaults)
- [ ] `app.json`: name, `android.package` (com.aaravxsingh.ironlog), `versionCode` bumped, permissions reviewed (VIBRATE, POST_NOTIFICATIONS)
- [ ] Privacy policy URL + Data Safety form (account email, workout data; deletion available in-app via Profile → Delete account)
- [ ] `eas build --platform android --profile production` (AAB), upload to Play Console internal testing
- [ ] Replace placeholder LICENSE
- [ ] Verify offline flow in airplane mode; verify rest-timer notification with screen locked
