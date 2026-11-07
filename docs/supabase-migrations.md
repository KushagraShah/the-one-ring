# Supabase migrations and sync testing

## Status and safety

Two SQL files in `supabase/migrations/` implement an initial schema and an experimental per-record sync protocol. They have been tested locally with PGlite, including two-user read isolation, cross-owner references, retry idempotency, optimistic concurrency and a simulated two-device conflict. The owner reports applying both to the `the-one-ring` Supabase project and that an initial authenticated sync appeared to work. Anonymous requests to the live sync table and RPC returned permission denied. Real two-device sync, two-user isolation and conflict behavior **have not yet been verified end to end**.

The app's sync UI is experimental. Do not rely on it as the only copy of workout data. Export a backup first. For initial validation, use a disposable Supabase project and disposable test accounts. The owner's existing project may already contain authentication users; the migration does not intentionally modify or delete them, but always verify the target project before running SQL.

The relational tables from migration 001 are a read-only domain foundation. The current experimental sync client instead uses `tor_sync_records` and `tor_apply_sync_batch` from migration 002; **it does not populate the relational tables**. Sync records are per exercise, routine, workout, current session and settings, with JSON bodies, not one whole-account JSON blob. RLS scopes reads to the authenticated user and direct client writes are revoked; the RPC derives ownership from the session and checks revisions. Domain-level relational constraints do not validate the JSON bodies. A later migration is required if we move to the normalized tables.

## Run the migrations in a disposable project

1. In the Supabase dashboard, verify the project name and open **SQL Editor → New query**. Back up any existing data first.
2. Copy the **entire contents** of `supabase/migrations/202611060001_workout_schema.sql` and run it once. It runs in a transaction. If it fails, record the error and stop; do not run fragments or continue to migration 002.
3. In a new query, copy the **entire contents** of `supabase/migrations/202611060002_sync_protocol.sql` and run it once. If it fails, stop and share the error. Migration 001 is then already applied; do not rerun it.
4. Verify the tables and RLS:

   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public' and tablename like 'tor\_%' escape '\'
   order by tablename;
   ```

   There should be 18 `tor_` tables and `rowsecurity` should be `true` for each.
5. Verify policies and grants:

   ```sql
   select tablename, policyname, cmd, roles, qual
   from pg_policies
   where schemaname = 'public' and tablename like 'tor\_%' escape '\'
   order by tablename, policyname;

   select table_name, grantee, privilege_type
   from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name like 'tor\_%' escape '\'
     and grantee in ('anon', 'authenticated')
   order by table_name, grantee, privilege_type;

   select routine_name, grantee, privilege_type
   from information_schema.routine_privileges
   where specific_schema = 'public' and routine_name = 'tor_apply_sync_batch'
   order by grantee;
   ```

   The 16 domain tables and `tor_sync_records` should have an authenticated `owner_read` policy and authenticated `SELECT` only. `tor_sync_batches` has no client grant or policy. The `tor_apply_sync_batch` function should be executable by `authenticated`, not `anon` or `PUBLIC`. Dashboard query results can also show owner/administrative grants; check the client roles specifically.
6. Configure this test project's URL and publishable key in `.env.local`, restart the dev server, and use disposable test accounts. The project's Auth redirect URLs must allow the local preview URL. In **Settings → Cloud sync**, choose **Set up sync**. A first device can upload its local data; another device must explicitly confirm before replacing its local data with the cloud copy.
7. Test offline changes, restart, reconnect, a deliberately conflicting edit on two devices, and different accounts. Confirm that pending changes remain visible and that a conflicting update is not silently overwritten. Do not assume SQL Editor tests prove real-user isolation: the editor uses an administrative role and bypasses RLS.

These migrations are not designed to be rerun on top of themselves. The SQL Editor does not automatically track them as Supabase CLI migrations: record which files were applied to which project. The owner removed Supabase's GitHub integration after a deployment attempted to create an existing table (`tor_exercises`); manually applied schema and migration history may be out of sync. Before enabling automated database migrations or repairing history, verify the target database, its actual schema, and migration history. Do not assume a history repair is safe, mask mismatches with `IF NOT EXISTS`, or reset a branch without explicit approval. Never paste a service-role key, database password, or access token into the app, Git, or a support message.
