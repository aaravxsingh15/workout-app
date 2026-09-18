# Version 1.0 scope and status

V1 = **complete workout diary**. V2 = intelligent training (out of scope: AI trainer, auto-programming, recommended weights/reps, plateau/fatigue/deload detection, adaptive routines, ML). V1 only records factual data.

## Status (checkpoint 2)

All V1 screens now exist and typecheck/lint/bundle cleanly (tsc, eslint, 22 unit tests, Android bundle export). **None of it has been run on a device or emulator yet** — the first on-device pass will surface bugs. Supabase migrations are applied to the project; sign-in/sync are untested end to end.

| Area | Status |
|---|---|
| Data layer, repositories, sync engine, Supabase schema/RLS (applied) | built |
| Auth, onboarding, Home, Profile/Settings | built |
| Active workout (sets, types, RPE/RIR, notes, prefill, previous performance, supersets, replace/reorder/remove, rest timer, resume, discard) | built, untested on device |
| Workout summary (+ update routine / save as routine) | built |
| Diary: timeline, calendar, search, filters, detail, edit past workout, delete, repeat | built, untested on device |
| Routines: list, folders, editor, duplicate/archive/reorder/delete | built, untested on device |
| Exercise library, custom exercises, favorites, recents, history/stats/PRs | built, untested on device |
| Progress (ranges, charts, muscle sets, PRs), Bodyweight diary, Plate calculator | built, untested on device |
| Repository integration tests against SQLite | not done |
| Cloud sync verified against live Supabase | not done |

Known gaps: drag-to-reorder uses up/down buttons; diary exercise filter is via search text; system exercises have no instruction text; default Expo icons.

## Decisions worth knowing
- Weights stored in **kg**, distance in **m**, time in **s**; converted only at the UI edge.
- Completed workouts are **snapshots** (exercise name/muscle/mode copied in); routine or exercise edits never rewrite history.
- PRs and stats are **derived** from history on demand, so historical edits recalculate automatically.
- Exercise reordering during a workout uses up/down controls (not drag) for reliability.
- System exercises have no instruction text in the seed yet; custom exercises support instructions.
