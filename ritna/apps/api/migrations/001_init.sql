-- Ritna initieel schema. Bedragen in eurocenten (integer), percentages in basispunten.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Gebruikers en rollen
-- ---------------------------------------------------------------------------
create table users (
  id              uuid primary key default gen_random_uuid(),
  role            text not null check (role in ('customer','driver','operator_admin','platform_admin')),
  email           text not null unique,
  phone           text,
  full_name       text not null,
  password_hash   text not null,
  locale          text not null default 'nl' check (locale in ('nl','fr','en')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Vervoerders (taxibedrijven / exploitanten)
-- ---------------------------------------------------------------------------
create table operators (
  id                         uuid primary key default gen_random_uuid(),
  legal_name                 text not null,
  trade_name                 text not null,
  slug                       text not null unique,
  enterprise_number          text not null unique,         -- KBO-nummer
  exploitation_license_ref   text,                         -- referentie vergunning exploitant
  status                     text not null default 'pending' check (status in ('pending','active','suspended')),
  description                text,
  phone                      text,
  email                      text,
  service_center_lat         double precision not null,
  service_center_lng         double precision not null,
  service_radius_m           integer not null check (service_radius_m > 0),
  -- commerciële afspraak (snapshot gaat mee op elke rit)
  commission_platform_bps    integer not null default 1200 check (commission_platform_bps between 0 and 5000),
  commission_own_channel_bps integer not null default 500  check (commission_own_channel_bps between 0 and 5000),
  -- annuleringsvoorwaarden
  cancel_free_until_min      integer not null default 120 check (cancel_free_until_min >= 0),
  cancel_late_bps            integer not null default 5000 check (cancel_late_bps between 0 and 10000),
  no_show_bps                integer not null default 10000 check (no_show_bps between 0 and 10000),
  no_show_wait_min           integer not null default 10 check (no_show_wait_min >= 0),
  -- reactietijd op aanvragen
  accept_timeout_sec         integer not null default 600 check (accept_timeout_sec between 30 and 86400),
  min_lead_time_min          integer not null default 60 check (min_lead_time_min >= 0),
  payout_account_ref         text,                         -- account-id bij betaalprovider, geen rekeningnummer
  verified_at                timestamptz,
  verified_by                uuid references users(id),
  created_at                 timestamptz not null default now()
);

create table operator_users (
  operator_id  uuid not null references operators(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  primary key (operator_id, user_id)
);

create table vehicle_categories (
  code      text primary key,
  label_nl  text not null,
  label_fr  text not null,
  label_en  text not null,
  max_seats integer not null
);

insert into vehicle_categories (code, label_nl, label_fr, label_en, max_seats) values
  ('standard',   'Standaard',          'Standard',            'Standard',   4),
  ('comfort',    'Comfort',            'Confort',             'Comfort',    4),
  ('van',        'Busje',              'Van',                 'Van',        8),
  ('accessible', 'Rolstoeltoegankelijk','Accessible PMR',     'Wheelchair accessible', 4);

create table operator_tariffs (
  operator_id              uuid not null references operators(id) on delete cascade,
  category                 text not null references vehicle_categories(code),
  base_fare                integer not null check (base_fare >= 0),
  per_km                   integer not null check (per_km >= 0),
  per_minute               integer not null check (per_minute >= 0),
  minimum_fare             integer not null check (minimum_fare >= 0),
  night_surcharge          integer not null default 0 check (night_surcharge >= 0),
  luggage_surcharge_item   integer not null default 0 check (luggage_surcharge_item >= 0),
  free_luggage_items       integer not null default 2 check (free_luggage_items >= 0),
  is_active                boolean not null default true,
  updated_at               timestamptz not null default now(),
  primary key (operator_id, category)
);

create table vehicles (
  id                     uuid primary key default gen_random_uuid(),
  operator_id            uuid not null references operators(id) on delete cascade,
  plate                  text not null,
  make                   text,
  model                  text,
  category               text not null references vehicle_categories(code),
  seats                  integer not null check (seats > 0),
  luggage_capacity       integer not null default 2,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  unique (operator_id, plate)
);

-- Chauffeur en exploitant zijn apart gemodelleerd: de vervoerder is contractpartij
-- en ontvangt uitbetalingen, de chauffeur voert uit.
create table drivers (
  id                     uuid primary key default gen_random_uuid(),
  operator_id            uuid not null references operators(id) on delete cascade,
  user_id                uuid not null unique references users(id),
  status                 text not null default 'pending' check (status in ('pending','active','suspended')),
  is_available           boolean not null default false,
  current_vehicle_id     uuid references vehicles(id),
  can_accept_requests    boolean not null default false,  -- mag aanvragen aanvaarden namens vervoerder
  created_at             timestamptz not null default now()
);

create table documents (
  id            uuid primary key default gen_random_uuid(),
  owner_type    text not null check (owner_type in ('operator','driver','vehicle')),
  owner_id      uuid not null,
  doc_type      text not null,   -- bv. exploitatievergunning, bestuurderspas, verzekering, keuring
  expires_on    date,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  file_ref      text,
  reviewed_by   uuid references users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index documents_owner_idx on documents (owner_type, owner_id);
create index documents_expiry_idx on documents (expires_on) where status = 'approved';

-- ---------------------------------------------------------------------------
-- Ritten
-- ---------------------------------------------------------------------------
create table rides (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references users(id),
  operator_id         uuid references operators(id),     -- leeg zolang open aanvraag niet aanvaard is
  booking_mode        text not null check (booking_mode in ('chosen_operator','open_dispatch')),
  source              text not null check (source in ('platform','operator_channel')),
  category            text not null references vehicle_categories(code),
  pickup_address      text not null,
  pickup_lat          double precision not null,
  pickup_lng          double precision not null,
  dropoff_address     text not null,
  dropoff_lat         double precision not null,
  dropoff_lng         double precision not null,
  pickup_at           timestamptz not null,
  passengers          integer not null check (passengers between 1 and 8),
  luggage_items       integer not null default 0 check (luggage_items between 0 and 20),
  notes               text,
  distance_m          integer not null,
  duration_s          integer not null,
  max_price_cents     integer not null check (max_price_cents >= 0),  -- geautoriseerd bedrag
  price_cents         integer check (price_cents >= 0),              -- definitieve vaste prijs (na aanvaarding)
  quote_lines         jsonb,
  cancellation_policy jsonb not null,
  commission_terms    jsonb,
  status              text not null default 'requested',
  driver_id           uuid references drivers(id),
  vehicle_id          uuid references vehicles(id),
  accepted_at         timestamptz,
  arrived_at          timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  ended_at            timestamptz,
  fee_cents           integer not null default 0,
  refund_cents        integer not null default 0,
  idempotency_key     text,
  version             integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (customer_id, idempotency_key)
);
create index rides_operator_idx on rides (operator_id, pickup_at);
create index rides_driver_idx on rides (driver_id, pickup_at);
create index rides_customer_idx on rides (customer_id, created_at desc);
create index rides_status_idx on rides (status);

create table ride_offers (
  id            uuid primary key default gen_random_uuid(),
  ride_id       uuid not null references rides(id) on delete cascade,
  operator_id   uuid not null references operators(id),
  sequence      integer not null,
  price_cents   integer not null,
  quote_lines   jsonb not null,
  status        text not null default 'queued' check (status in ('queued','pending','accepted','declined','expired','superseded')),
  offered_at    timestamptz,
  expires_at    timestamptz,
  responded_at  timestamptz,
  unique (ride_id, sequence),
  unique (ride_id, operator_id)
);
create index ride_offers_pending_idx on ride_offers (status, expires_at) where status = 'pending';
create index ride_offers_operator_idx on ride_offers (operator_id, status);

create table ride_events (
  id           bigserial primary key,
  ride_id      uuid not null references rides(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  actor_type   text not null,
  actor_id     uuid,
  data         jsonb,
  at           timestamptz not null default now()
);
create index ride_events_ride_idx on ride_events (ride_id, id);

-- ---------------------------------------------------------------------------
-- Geld
-- ---------------------------------------------------------------------------
create table payments (
  id                uuid primary key default gen_random_uuid(),
  ride_id           uuid not null unique references rides(id),
  provider          text not null,
  provider_ref      text not null,
  authorized_cents  integer not null,
  captured_cents    integer not null default 0,
  refunded_cents    integer not null default 0,
  status            text not null check (status in ('authorized','captured','partially_refunded','refunded','voided','failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table payouts (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id),
  amount_cents  integer not null,
  status        text not null default 'pending' check (status in ('pending','paid','failed')),
  provider_ref  text,
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);

-- Grootboek per rit. Per afgerekende rit geldt:
-- customer_charge = platform_commission + commission_vat + operator_payable
create table ledger_entries (
  id            bigserial primary key,
  ride_id       uuid not null references rides(id),
  operator_id   uuid not null references operators(id),
  entry_type    text not null check (entry_type in ('customer_charge','platform_commission','commission_vat','operator_payable')),
  amount_cents  integer not null,
  payout_id     uuid references payouts(id),
  created_at    timestamptz not null default now(),
  unique (ride_id, entry_type)
);
create index ledger_unpaid_idx on ledger_entries (operator_id) where entry_type = 'operator_payable' and payout_id is null;

-- ---------------------------------------------------------------------------
-- Kwaliteit en klantrelatie
-- ---------------------------------------------------------------------------
create table reviews (
  id           uuid primary key default gen_random_uuid(),
  ride_id      uuid not null unique references rides(id),
  customer_id  uuid not null references users(id),
  operator_id  uuid not null references operators(id),
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now()
);
create index reviews_operator_idx on reviews (operator_id);

create table favorites (
  customer_id  uuid not null references users(id) on delete cascade,
  operator_id  uuid not null references operators(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (customer_id, operator_id)
);

create table incidents (
  id           uuid primary key default gen_random_uuid(),
  ride_id      uuid not null references rides(id),
  opened_by    uuid not null references users(id),
  kind         text not null check (kind in ('driver_no_show','complaint','lost_item','safety','waiting_time','other')),
  description  text not null,
  status       text not null default 'open' check (status in ('open','in_progress','resolved')),
  resolution   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index incidents_open_idx on incidents (status) where status <> 'resolved';

create table notifications (
  id          bigserial primary key,
  user_id     uuid not null references users(id),
  channel     text not null,
  template    text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, id desc);
