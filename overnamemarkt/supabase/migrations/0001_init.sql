-- Overnamemarkt: schema, toegangsregels (RLS) en beveiligde functies.
-- Uitvoeren in Supabase: SQL Editor -> plak dit bestand -> Run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- types
do $$ begin
  create type public.listing_status as enum ('pending','published','rejected','under_offer','sold','withdrawn');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------- listings
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 120),
  type text not null check (type in ('SaaS','Website','App','E-commerce','Online dienst')),
  country text not null check (country in ('BE','NL')),
  founded_year int check (founded_year between 1990 and 2100),
  asking_price numeric(14,2) not null check (asking_price > 0),
  revenue_12m numeric(14,2) not null check (revenue_12m >= 0),
  profit_12m numeric(14,2) not null,
  customers int check (customers >= 0),
  tech_stack text not null default '' check (char_length(tech_stack) <= 200),
  sale_reason text not null default '' check (char_length(sale_reason) <= 300),
  description text not null check (char_length(description) between 20 and 4000),
  consent_accuracy boolean not null check (consent_accuracy),
  consent_publish boolean not null check (consent_publish),
  status public.listing_status not null default 'pending',
  rejection_note text not null default '' check (char_length(rejection_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists listings_status_idx on public.listings (status, published_at desc);
create index if not exists listings_owner_idx on public.listings (owner_id);

-- Contactgegevens apart: nooit publiek leesbaar.
create table if not exists public.listing_contacts (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254)
);

-- ---------------------------------------------------------------- interests
create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  budget text check (budget in ('Tot €50.000','€50.000 – €150.000','€150.000 – €500.000','Meer dan €500.000')),
  consent_confidential boolean not null check (consent_confidential),
  consent_share boolean not null check (consent_share),
  status text not null default 'new' check (status in ('new','forwarded','closed')),
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index if not exists interests_listing_idx on public.interests (listing_id);

-- ---------------------------------------------------------------- triggers
create or replace function public.listings_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.owner_id := auth.uid();
      new.status := 'pending';
      new.published_at := null;
      new.rejection_note := '';
      if (select count(*) from public.listings where owner_id = auth.uid() and status = 'pending') >= 5 then
        raise exception 'Je hebt al 5 aanbiedingen ter controle. Wacht tot ze beoordeeld zijn.' using errcode = 'P0001';
      end if;
    end if;
    new.created_at := now();
  end if;
  new.updated_at := now();
  if new.status in ('published','under_offer','sold') and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists listings_guard on public.listings;
create trigger listings_guard before insert or update on public.listings
  for each row execute function public.listings_guard();

create or replace function public.interests_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    new.buyer_id := auth.uid();
    new.status := 'new';
    if (select count(*) from public.interests where buyer_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
      raise exception 'Je hebt vandaag al 20 keer interesse getoond. Probeer morgen opnieuw.' using errcode = 'P0001';
    end if;
  end if;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists interests_guard on public.interests;
create trigger interests_guard before insert on public.interests
  for each row execute function public.interests_guard();

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_contacts enable row level security;
alter table public.interests enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
-- Geen insert/update/delete voor gewone gebruikers: niemand kan zichzelf admin maken.

drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select
  using (status in ('published','under_offer','sold') or owner_id = auth.uid() or public.is_admin());

drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert to authenticated
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists listings_update_admin on public.listings;
create policy listings_update_admin on public.listings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists listings_delete_admin on public.listings;
create policy listings_delete_admin on public.listings for delete to authenticated
  using (public.is_admin());

drop policy if exists contacts_select on public.listing_contacts;
create policy contacts_select on public.listing_contacts for select to authenticated
  using (public.is_admin() or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));

drop policy if exists contacts_insert on public.listing_contacts;
create policy contacts_insert on public.listing_contacts for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()) or public.is_admin());

drop policy if exists interests_select on public.interests;
create policy interests_select on public.interests for select to authenticated
  using (buyer_id = auth.uid() or public.is_admin());

drop policy if exists interests_insert on public.interests;
create policy interests_insert on public.interests for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status in ('published','under_offer') and l.owner_id <> auth.uid()
    )
  );

drop policy if exists interests_update_admin on public.interests;
create policy interests_update_admin on public.interests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists interests_delete_admin on public.interests;
create policy interests_delete_admin on public.interests for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------- functies
-- Aanbieding + contact in één transactie.
create or replace function public.submit_listing(
  p_title text, p_type text, p_country text, p_founded_year int,
  p_asking_price numeric, p_revenue_12m numeric, p_profit_12m numeric, p_customers int,
  p_tech_stack text, p_sale_reason text, p_description text, p_contact_email text,
  p_consent_accuracy boolean, p_consent_publish boolean
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Niet aangemeld.' using errcode = '42501';
  end if;
  insert into public.listings (owner_id, title, type, country, founded_year, asking_price, revenue_12m, profit_12m,
    customers, tech_stack, sale_reason, description, consent_accuracy, consent_publish)
  values (auth.uid(), p_title, p_type, p_country, p_founded_year, p_asking_price, p_revenue_12m, p_profit_12m,
    p_customers, coalesce(p_tech_stack,''), coalesce(p_sale_reason,''), p_description, p_consent_accuracy, p_consent_publish)
  returning id into v_id;
  insert into public.listing_contacts (listing_id, email) values (v_id, p_contact_email);
  return v_id;
end $$;

-- Verkoper trekt eigen aanbieding in (alleen zolang niet verkocht).
create or replace function public.withdraw_listing(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.listings set status = 'withdrawn'
  where id = p_id and owner_id = auth.uid() and status in ('pending','published','under_offer');
  if not found then
    raise exception 'Deze aanbieding kan niet ingetrokken worden.' using errcode = 'P0001';
  end if;
end $$;

-- Aantal geïnteresseerden: alleen voor de eigenaar of admin, zonder kopersgegevens.
create or replace function public.interest_count(p_listing uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.listings l where l.id = p_listing and (l.owner_id = auth.uid() or public.is_admin()))
    then (select count(*)::int from public.interests i where i.listing_id = p_listing)
    else 0 end;
$$;

revoke all on function public.withdraw_listing(uuid) from public, anon;
revoke all on function public.interest_count(uuid) from public, anon;
revoke all on function public.submit_listing(text,text,text,int,numeric,numeric,numeric,int,text,text,text,text,boolean,boolean) from public, anon;
grant execute on function public.withdraw_listing(uuid) to authenticated;
grant execute on function public.interest_count(uuid) to authenticated;
grant execute on function public.submit_listing(text,text,text,int,numeric,numeric,numeric,int,text,text,text,text,boolean,boolean) to authenticated;

-- Gewone gebruikers lezen enkel de kolommen die ze nodig hebben; admins krijgen alles via dezelfde rol + RLS.
grant select on public.listings to anon, authenticated;
grant insert on public.listings to authenticated;
grant update, delete on public.listings to authenticated;
grant select, insert on public.listing_contacts to authenticated;
grant select, insert, update, delete on public.interests to authenticated;
grant select on public.profiles to authenticated;
