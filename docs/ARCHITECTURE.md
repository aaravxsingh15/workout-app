# Architecture

**Local-first.** The UI only ever reads/writes SQLite through repositories. Supabase is a sync target, never a dependency of logging a set.

```
UI (app/, components)  ->  stores (Zustand)  ->  repositories  ->  Expo SQLite (per-account file)
                                                        ^
                                       sync engine <--> Supabase (Postgres + RLS + Auth)
```

- **calculations/** — pure functions (no I/O): units, volume, Epley 1RM, PR detection, stats, progress aggregation, routine→workout cloning, prefill. All unit-tested.
- **database/schema.ts** — one definition per table (columns, JSON/bool columns) drives DDL, upserts and the sync engine.
- **stores/workoutSession.ts** — normalized in-memory mirror of one workout with write-through persistence: structural edits are written immediately, typing is coalesced ~250 ms and flushed on completion/background/finish; failed writes stay queued and surface `saveError`.
- **stores/restTimer.ts** — wall-clock (`endsAt`) timer persisted in SQLite meta + a scheduled local notification; correct across backgrounding, lock and restart.
- **Auth** — Supabase Auth, session in SecureStore (chunked), `Stack.Protected` route guards; offline cold start falls back to the cached user id so training never blocks on connectivity.
- **One SQLite file per account** — sign-out closes it; another account on the same phone never sees it.
- **Historical accuracy** — `workout_exercises` snapshots name/muscle/mode; `routine_id` on a workout is provenance only.
- **PRs/stats are derived, not stored** — editing or deleting history recalculates everything.
