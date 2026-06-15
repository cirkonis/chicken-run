-- Migration: drop the per-hunt storage quota counter.
--
-- The `storage_used_bytes` column tracked a soft 50 MB/hunt quota back when the
-- server received image bytes and could measure them. Uploads now go straight
-- from the browser to Storage, so the server never sees the bytes — the column
-- is dead. Abuse is covered by the bucket's 10 MB/object limit + the 90-day
-- auto-cleanup, so we drop the counter rather than carry vestigial state.
alter table public.hunts drop column if exists storage_used_bytes;
