-- Huurklaar: basisschema.
-- Bewust minimaal: geen dossiergegevens, geen documenten en geen advertentieteksten op de server.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  stripe_customer_id text unique,
  dossier_paid_at timestamptz,
  zoekpas_status text,                -- Stripe-status: active, trialing, past_due, canceled, ...
  zoekpas_subscription_id text unique,
  zoekpas_period_end timestamptz,
  zoekpas_cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Teller voor advertentie-checks. Bewaart alleen het tijdstip, niet de inhoud.
create table if not exists public.listing_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists listing_checks_user_time on public.listing_checks (user_id, created_at desc);

-- Verwerkte Stripe-events, zodat een webhook die twee keer binnenkomt maar één keer telt.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.listing_checks enable row level security;
alter table public.stripe_events enable row level security;

-- Gebruikers mogen alleen hun eigen profiel en tellers lezen. Schrijven gebeurt enkel server-side (service role).
drop policy if exists "eigen profiel lezen" on public.profiles;
create policy "eigen profiel lezen" on public.profiles for select using (auth.uid() = id);

drop policy if exists "eigen checks lezen" on public.listing_checks;
create policy "eigen checks lezen" on public.listing_checks for select using (auth.uid() = user_id);
-- stripe_events: geen policies = niemand behalve de service role.

-- Profiel automatisch aanmaken bij registratie.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Atomisch: tel en registreer een check in één transactie, zodat gelijktijdige aanvragen de limiet niet omzeilen.
create or replace function public.claim_listing_check(p_user uuid, p_free int, p_daily int, p_unlimited boolean)
returns table (allowed boolean, reason text, used_total int, used_today int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_total int;
  v_today int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  select count(*) into v_total from listing_checks where user_id = p_user;
  select count(*) into v_today from listing_checks where user_id = p_user and created_at > now() - interval '24 hours';

  if p_unlimited then
    if v_today >= p_daily then
      return query select false, 'day_limit'::text, v_total, v_today; return;
    end if;
  elsif v_total >= p_free then
    return query select false, 'out_of_free'::text, v_total, v_today; return;
  end if;

  insert into listing_checks (user_id) values (p_user);
  return query select true, 'ok'::text, v_total + 1, v_today + 1;
end;
$$;

-- Teruggave als de AI-analyse faalt, zodat de gebruiker geen check verliest.
create or replace function public.refund_listing_check(p_user uuid)
returns void
language sql
security definer set search_path = public
as $$
  delete from listing_checks
  where id = (select id from listing_checks where user_id = p_user order by created_at desc limit 1);
$$;

revoke all on function public.claim_listing_check(uuid, int, int, boolean) from public, anon, authenticated;
revoke all on function public.refund_listing_check(uuid) from public, anon, authenticated;
