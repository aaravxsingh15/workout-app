# Version 1.0 scope and status

V1 = **complete workout diary**. V2 = intelligent training (out of scope: AI trainer, auto-programming, recommended weights/reps, plateau/fatigue/deload detection, adaptive routines, ML). V1 only records factual data.

## Status (checkpoint 1)

Legend: ✅ built and verified (typecheck + lint + Android bundle + unit tests) · 🟡 data/logic layer built, screen not built yet · ⬜ not started

| Area | Status | Notes |
|---|---|---|
| Project, theme (dark default + light), design primitives | ✅ | |
| Local SQLite schema + migrations, per-account DB file | ✅ | `src/database` |
| Repositories (profile, exercises, routines, workouts, bodyweight) | ✅ | not yet exercised on a device/emulator |
| 203-exercise seed library, all tracking modes | ✅ | cloud seed generated from same source |
| Calculations: kg/lb, volume, Epley 1RM, PRs, stats, duration, cloning, prefill | ✅ | 19 unit tests passing |
| Supabase schema + RLS + account-deletion RPC | ✅ | migrations written; not yet applied to a live project (needs your credentials) |
| Sync engine (pull→push, LWW, tombstones, retry/backoff) | ✅ code | untested against a live Supabase |
| Auth (sign up/in/out, session, forgot/reset, protected routes, delete account) | ✅ code | needs Supabase credentials to run end to end |
| Onboarding, Home, Profile/Settings | ✅ | |
| Rest timer (timestamp-based, persisted, notification) | 🟡 | store + notifications done; no UI yet |
| Active-workout session store (write-through persistence, prefill, supersets) | 🟡 | store done; **Active Workout screen not built** |
| Exercise picker, custom exercise editor, exercise library screen | ⬜ | repo layer done |
| Routines list/editor/folders | ⬜ | repo layer done |
| Workout summary, Diary (timeline/calendar/search/filters), workout detail + edit | ⬜ | queries + PR/stat services done |
| Exercise history / stats / PR history screens | ⬜ | `getExerciseInsights` done |
| Progress screen + charts | ⬜ | `getProgress` done |
| Bodyweight diary screen, plate calculator | ⬜ | repo done |
| Repository integration tests (SQLite) | ⬜ | |

**Definition of Done (end-to-end journey) is NOT yet met.** The remaining work is mostly UI on top of the finished data layer.

## Decisions worth knowing
- Weights stored in **kg**, distance in **m**, time in **s**; converted only at the UI edge.
- Completed workouts are **snapshots** (exercise name/muscle/mode copied in); routine or exercise edits never rewrite history.
- PRs and stats are **derived** from history on demand, so historical edits recalculate automatically.
- Exercise reordering during a workout uses up/down controls (not drag) for reliability.
- System exercises have no instruction text in the seed yet; custom exercises support instructions.
