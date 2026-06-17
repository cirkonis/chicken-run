-- Migration: create the private 'hunt-media' storage bucket in code.
--
-- Why: the bucket holds every check-in / hint / arrival photo, but until now it
-- only existed because someone created it by hand in the Supabase dashboard. A
-- "real production thing" should be reproducible, so we declare it here.
--
-- Idempotent: prod already has this bucket, so `on conflict do nothing` makes
-- this a no-op there; locally (and on any fresh project) it creates the bucket
-- so direct uploads work.
insert into storage.buckets (id, name, public, file_size_limit)
values (
  'hunt-media',
  'hunt-media',
  false,        -- PRIVATE: no public URLs. Access only via signed URLs (GDPR-friendly).
  10485760      -- 10 MiB hard cap per object (compressed photos are ~100–400 KB).
)
on conflict (id) do nothing;
