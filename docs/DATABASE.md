# Database

Canonical units: **kg**, **meters**, **seconds**. Timestamps are ISO-8601 UTC.

## Tables (Postgres = SQLite, same column names)
`profiles`, `exercises` (+ `exercise_secondary_muscles` in cloud; JSON column locally), `favorites`, `routine_folders`, `routines`, `exercise_groups` (superset/tri-set/circuit; owned by a routine *or* a workout), `routine_exercises`, `routine_sets`, `workouts`, `workout_exercises`, `workout_sets`, `bodyweight_entries`.

- **Tracking modes** are a list of atomic fields (`weight`, `added_weight`, `assistance`, `reps`, `duration`, `distance`). `workout_sets` carries a column for each, so a new mode is a code-only change; `custom` lets the user choose fields per exercise (`custom_fields`).
- **Set data**: type (warmup/normal/drop/failure/backoff/top/amrap/other), weight/reps/…, RPE, RIR, `side` (both/left/right for unilateral), completion + timestamp, note, `rest_sec`, and `plan_*` values copied from the routine or last session.
- **Sync columns** on every table: `created_at`, `updated_at` (client clock, conflict resolution), `deleted_at` (tombstone), locally `sync_status`; cloud adds `server_updated_at` (server clock, pull cursor).
- `exercise_id` on routine/workout rows is intentionally **not** a foreign key so history survives exercise edits/deletes.
- **RLS**: every private table `user_id = auth.uid()`; system exercises (`is_system`) are readable by all signed-in users; custom exercises only by the owner. `delete_my_account()` (security definer) deletes the caller's `auth.users` row, cascading everything.
- Migrations: `supabase/migrations/0001_init.sql`, `0002_seed_system_exercises.sql` (generated). Local migrations: `src/database/db.ts` (`PRAGMA user_version`).
