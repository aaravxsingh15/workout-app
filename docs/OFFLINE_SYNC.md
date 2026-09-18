# Offline-first sync

1. **Write locally first.** Every mutation updates SQLite and sets `sync_status = 'pending'`. Nothing waits on the network.
2. **Trigger**: after data changes (debounced), on app foreground, when connectivity returns, after sign-in, and manually ("Sync now"). Failures back off exponentially (15 s → 5 min).
3. **Pass = pull then push**, parents before children (FK order):
   - *Pull*: per table, rows with `server_updated_at > cursor` (server clock, immune to phone clock skew), paged 500. An unsynced local row that is as new as or newer than the remote (`updated_at`) wins (last-write-wins); otherwise the remote applies.
   - *Push*: `pending` rows upserted in batches; marked `synced` only if `updated_at` did not change while in flight.
4. **Safe deletions**: soft delete (`deleted_at`) so deletions propagate to other devices. Discarding an *active* workout hard-deletes because it was never synced.
5. **Active workouts are never pushed** — only completed workouts (and their children) sync, so half-finished sessions don't churn the cloud.
6. **Error classes**: offline (banner, retry later), auth expired (banner; local data untouched), server error (banner + retry). Nothing is ever dropped on failure.
7. **New device**: the remote profile is fetched before a default local profile is created, so defaults can't overwrite an existing account.
8. **Known limitation (V1)**: single-user, LWW at row granularity; simultaneous edits of the same row on two devices keep the later edit.
