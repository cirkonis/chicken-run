-- ONE-TIME CLEANUP: Remove duplicate guest participants and orphaned guest auth users.
-- Run this AFTER applying 005_find_guest_user.sql.
--
-- Step 1: For each real_email, keep only the NEWEST guest participant per hunt,
--         delete the rest.
-- Step 2: Delete orphaned guest auth users that no longer have any hunt_participants rows.

-- Step 1: Delete duplicate hunt_participants rows for guest users.
-- Keeps the row with the latest joined_at for each (hunt_id, real_email) combo.
delete from public.hunt_participants
where id in (
  select hp.id
  from public.hunt_participants hp
  join auth.users u on u.id = hp.user_id
  where u.raw_user_meta_data->>'is_guest' = 'true'
    and hp.id not in (
      -- For each (hunt_id, real_email), keep the most recent participant row
      select distinct on (hp2.hunt_id, u2.raw_user_meta_data->>'real_email')
             hp2.id
      from public.hunt_participants hp2
      join auth.users u2 on u2.id = hp2.user_id
      where u2.raw_user_meta_data->>'is_guest' = 'true'
      order by hp2.hunt_id,
               u2.raw_user_meta_data->>'real_email',
               hp2.joined_at desc
    )
);

-- Step 2: Delete orphaned guest auth users (no remaining hunt_participants rows).
-- NOTE: This deletes from auth.users which will cascade-delete profiles.
--       Run with care. You may prefer to do this manually via Supabase dashboard.
-- delete from auth.users
-- where raw_user_meta_data->>'is_guest' = 'true'
--   and id not in (select user_id from public.hunt_participants);
