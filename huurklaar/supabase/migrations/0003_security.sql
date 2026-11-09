-- Huurklaar: beveiliging bovenop RLS.

-- 1) Kolomrechten: een ingelogde gebruiker mag via de publieke API alleen de eigen, onschuldige kolommen schrijven.
--    (match_id en tijdstempels worden alleen server-side gezet.)
revoke insert, update on public.applications from authenticated, anon;
grant insert (user_id, title, url, status, applied_on, next_action_on, note) on public.applications to authenticated;
grant update (title, url, status, applied_on, next_action_on, note) on public.applications to authenticated;
grant select, delete on public.applications to authenticated;

-- Profielen, matches, zoekprofielen: geen schrijfrechten voor gebruikers (alleen server met service role).
revoke insert, update, delete on public.profiles from authenticated, anon;
revoke insert, update, delete on public.matches from authenticated, anon;
revoke insert, update, delete on public.search_profiles from authenticated, anon;
revoke insert, update, delete on public.listing_checks from authenticated, anon;
revoke all on public.stripe_events from authenticated, anon;
revoke all on public.inbound_mails from authenticated, anon;

-- Anonieme bezoekers lezen niets.
revoke select on public.profiles, public.matches, public.search_profiles, public.listing_checks, public.applications from anon;

-- 2) Generieke rate limiter (vast tijdvenster). Alleen aanroepbaar door de server.
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from authenticated, anon;

create or replace function public.rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  -- Oude vensters af en toe opruimen.
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_max;
end;
$$;
revoke all on function public.rate_limit(text, int, int) from public, anon, authenticated;
