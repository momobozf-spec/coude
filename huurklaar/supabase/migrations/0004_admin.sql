-- Huurklaar: beheerplatform. Rollen, betalingen, AI-kosten, vaste kosten, auditlog.
-- Alle tabellen hier zijn alleen bereikbaar via de server (service role). Geen policies = geen toegang voor gebruikers.

-- Teamrollen
create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'support', 'analyst')),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Betalingen (één rij per Stripe-charge), gevuld door de webhook.
create table if not exists public.payments (
  charge_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  customer_id text,
  product text not null check (product in ('dossier', 'zoekpas', 'onbekend')),
  amount_cents integer not null,           -- bruto, inclusief btw
  refunded_cents integer not null default 0,
  fee_cents integer,                       -- Stripe-kosten; null zolang Stripe ze nog niet kent
  currency text not null,
  status text not null,
  created_at timestamptz not null
);
create index if not exists payments_created on public.payments (created_at desc);
create index if not exists payments_user on public.payments (user_id);

-- AI-gebruik per aanroep (tokens). De prijs wordt pas bij weergave berekend met de ingestelde tarieven.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('listing_check', 'inbound_extract')),
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_created on public.ai_usage (created_at desc);

-- Vaste kosten die je zelf invoert (hosting, domein, Postmark, boekhouder, ...), per maand.
create table if not exists public.fixed_costs (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('hosting', 'software', 'marketing', 'diensten', 'andere')),
  monthly_eur numeric(10, 2) not null check (monthly_eur >= 0),
  starts_on date not null,
  ends_on date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

-- Auditlog: elke beheeractie.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  target_user_id uuid,
  target_email text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_created on public.audit_log (created_at desc);

-- Extra gratis checks en gratis toegang, toe te kennen door support.
alter table public.profiles add column if not exists bonus_checks integer not null default 0 check (bonus_checks between 0 and 1000);
alter table public.profiles add column if not exists dossier_comp boolean not null default false;

alter table public.staff_roles enable row level security;
alter table public.payments enable row level security;
alter table public.ai_usage enable row level security;
alter table public.fixed_costs enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.staff_roles, public.payments, public.ai_usage, public.fixed_costs, public.audit_log from anon, authenticated;

-- Auditlog is alleen-toevoegen: ook de server kan niets wijzigen of wissen.
create or replace function public.audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is alleen-toevoegen';
end;
$$;
drop trigger if exists audit_log_no_change on public.audit_log;
create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- Minstens één eigenaar moet blijven bestaan.
create or replace function public.keep_one_owner()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE' and old.role = 'owner') or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    if (select count(*) from staff_roles where role = 'owner' and user_id <> old.user_id) = 0 then
      raise exception 'Er moet minstens één eigenaar blijven';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists staff_keep_owner on public.staff_roles;
create trigger staff_keep_owner before update or delete on public.staff_roles
  for each row execute function public.keep_one_owner();

-- De teller houdt nu rekening met bonuschecks.
create or replace function public.claim_listing_check(p_user uuid, p_free int, p_daily int, p_unlimited boolean)
returns table (allowed boolean, reason text, used_total int, used_today int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_total int;
  v_today int;
  v_bonus int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  select count(*) into v_total from listing_checks where user_id = p_user;
  select count(*) into v_today from listing_checks where user_id = p_user and created_at > now() - interval '24 hours';
  select coalesce(bonus_checks, 0) into v_bonus from profiles where id = p_user;

  if p_unlimited then
    if v_today >= p_daily then
      return query select false, 'day_limit'::text, v_total, v_today; return;
    end if;
  elsif v_total >= p_free + coalesce(v_bonus, 0) then
    return query select false, 'out_of_free'::text, v_total, v_today; return;
  end if;

  insert into listing_checks (user_id) values (p_user);
  return query select true, 'ok'::text, v_total + 1, v_today + 1;
end;
$$;
revoke all on function public.claim_listing_check(uuid, int, int, boolean) from public, anon, authenticated;

-- Eerste eigenaar instellen (eenmalig, na je eerste login):
--   insert into public.staff_roles (user_id, role)
--   select id, 'owner' from auth.users where email = 'jouw@email.be';
