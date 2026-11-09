-- Huurklaar: zoekprofiel, matches uit doorgestuurde zoekmeldingen, kandidaturen-opvolging.

create table if not exists public.search_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  max_monthly integer,                       -- hoogste totale maandlast (huur + kosten) in euro
  municipalities text[] not null default '{}', -- gemeenten of postcodes, kleine letters
  min_bedrooms integer not null default 0,
  pets boolean not null default false,
  inbound_token text not null unique,          -- wordt server-side gegenereerd
  forward_verification text,                   -- bevestigingsmail van Gmail/Outlook bij het instellen van doorsturen
  forward_verification_at timestamptz,
  last_mail_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,                      -- immoweb, zimmo, immovlan, andere
  url text not null,
  title text not null,
  municipality text,
  rent_eur integer,
  charges_eur integer,
  bedrooms integer,
  pets_allowed boolean,
  score integer not null,
  reasons jsonb not null default '[]',
  status text not null default 'new' check (status in ('new', 'seen', 'dismissed', 'applied')),
  received_at timestamptz not null default now(),
  unique (user_id, url)
);
create index if not exists matches_user_score on public.matches (user_id, status, score desc, received_at desc);

create table if not exists public.applications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  url text check (url is null or char_length(url) <= 1000),
  status text not null default 'sent' check (status in ('visit', 'sent', 'waiting', 'accepted', 'rejected', 'withdrawn')),
  applied_on date not null default current_date,
  next_action_on date,
  note text check (note is null or char_length(note) <= 2000),
  match_id bigint references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_user on public.applications (user_id, updated_at desc);

alter table public.search_profiles enable row level security;
alter table public.matches enable row level security;
alter table public.applications enable row level security;

-- Zoekprofiel: eigen rij lezen en bijwerken. Aanmaken en het token gebeuren server-side.
drop policy if exists "eigen zoekprofiel lezen" on public.search_profiles;
create policy "eigen zoekprofiel lezen" on public.search_profiles for select using (auth.uid() = user_id);

-- Matches: alleen lezen; status wijzigen gebeurt via de server.
drop policy if exists "eigen matches lezen" on public.matches;
create policy "eigen matches lezen" on public.matches for select using (auth.uid() = user_id);

-- Kandidaturen: volledig beheer van eigen rijen.
drop policy if exists "eigen kandidaturen" on public.applications;
create policy "eigen kandidaturen" on public.applications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists search_profiles_touch on public.search_profiles;
create trigger search_profiles_touch before update on public.search_profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();

-- Teller voor inkomende meldingsmails (misbruikrem), alleen tijdstip.
create table if not exists public.inbound_mails (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  listings_found integer not null default 0,
  received_at timestamptz not null default now()
);
create index if not exists inbound_mails_user_time on public.inbound_mails (user_id, received_at desc);
alter table public.inbound_mails enable row level security;

-- Bewaartermijn: matches ouder dan 6 maanden en oude bevestigingsmails opruimen.
-- Draai dagelijks via Supabase Cron (Database > Cron) of pg_cron:
--   select cron.schedule('huurklaar-cleanup', '17 3 * * *', 'select public.cleanup_old_data()');
create or replace function public.cleanup_old_data()
returns void
language sql
security definer set search_path = public
as $$
  delete from matches where received_at < now() - interval '6 months' and status <> 'applied';
  delete from inbound_mails where received_at < now() - interval '6 months';
  update search_profiles set forward_verification = null
    where forward_verification_at < now() - interval '14 days';
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;
