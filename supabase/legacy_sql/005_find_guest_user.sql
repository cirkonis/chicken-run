-- Find an existing guest auth user by their real email address.
-- Used by join-guest endpoint to reuse guest accounts instead of
-- creating a new auth user every time the same person joins a hunt.
create or replace function public.find_guest_by_real_email(p_email text)
returns uuid
language sql
security definer set search_path = ''
as $$
  select id
  from auth.users
  where raw_user_meta_data->>'is_guest' = 'true'
    and lower(raw_user_meta_data->>'real_email') = lower(p_email)
  limit 1;
$$;
