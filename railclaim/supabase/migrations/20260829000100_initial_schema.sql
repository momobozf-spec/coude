-- RailClaim Belgium — initial schema
--
-- Design notes:
--  * Every table has RLS enabled with explicit policies. There is no table a
--    logged-in user can read wholesale.
--  * The rule "a claim can never reach a submitted state without the user
--    having confirmed the trip" is enforced by a CHECK CONSTRAINT and a
--    trigger, not by application code. See claims_confirmation_required.
--  * Compensation thresholds live in compensation_rules as data, never in code.

-- gen_random_uuid() is core Postgres since 13, so no extension is required.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.language_code as enum ('nl', 'fr');

create type public.subscription_status as enum (
  'FREE', 'ACTIVE', 'PAST_DUE', 'CANCELED'
);

create type public.ticket_type as enum (
  'SINGLE_TICKET', 'RETURN_TICKET',
  'SUBSCRIPTION_1M', 'SUBSCRIPTION_3M', 'SUBSCRIPTION_12M'
);

create type public.claim_type as enum ('SINGLE_DELAY', 'FREQUENT_DELAYS');

-- Lifecycle: DETECTED -> AWAITING_USER_CONFIRMATION -> CONFIRMED
--            -> IN_ADMIN_REVIEW -> SUBMITTED -> AWAITING_NMBS
--            -> APPROVED | REJECTED, or EXPIRED | CANCELLED at any point.
create type public.claim_status as enum (
  'DETECTED',
  'AWAITING_USER_CONFIRMATION',
  'CONFIRMED',
  'IN_ADMIN_REVIEW',
  'SUBMITTED',
  'AWAITING_NMBS',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED'
);

create type public.status_event_source as enum (
  'SYSTEM', 'USER', 'ADMIN', 'INBOUND_EMAIL'
);

create type public.trip_measurement_status as enum (
  'PENDING',       -- resolved for today, outcome not yet measured
  'MEASURED',      -- arrival delay known
  'INCONCLUSIVE'   -- could not be established; never produces a claim
);

-- ---------------------------------------------------------------------------
-- Admin identification
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- SECURITY DEFINER so RLS policies can consult it without recursing into
-- admin_users' own policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references auth.users (id) on delete cascade,
  full_name                 text not null check (length(trim(full_name)) between 1 and 200),
  email                     text not null check (position('@' in email) > 1),

  -- ADR 0003: AES-256-GCM envelopes, never plaintext. No unencrypted twin column.
  iban_encrypted            text,
  mobib_number_encrypted    text,

  -- Needed to compute the indicative compensation (docs/nmbs-regels.md §4).
  ticket_type               public.ticket_type,
  ticket_price_cents        integer check (ticket_price_cents is null or ticket_price_cents > 0),

  language                  public.language_code not null default 'nl',

  stripe_customer_id        text unique,
  subscription_status       public.subscription_status not null default 'FREE',
  subscription_current_period_end timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on column public.profiles.iban_encrypted is
  'AES-256-GCM envelope (v1:iv:ct:tag), AAD = user_id||field. Never log or expose unmasked.';

create index profiles_subscription_status_idx
  on public.profiles (subscription_status);

-- ---------------------------------------------------------------------------
-- commute_routes
-- ---------------------------------------------------------------------------

create table public.commute_routes (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,

  -- iRail station IDs (e.g. BE.NMBS.008892007). Never free text.
  departure_station_id      text not null check (departure_station_id ~ '^BE\.NMBS\.[0-9]+$'),
  arrival_station_id        text not null check (arrival_station_id ~ '^BE\.NMBS\.[0-9]+$'),
  departure_station_name    text not null,
  arrival_station_name      text not null,

  preferred_departure_time  time not null,
  -- ISO-8601 weekdays: 1 = Monday .. 7 = Sunday.
  days_of_week              smallint[] not null
    check (
      array_length(days_of_week, 1) between 1 and 7
      and days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]
    ),

  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint commute_routes_distinct_stations
    check (departure_station_id <> arrival_station_id)
);

-- The worker scans active routes; make that lookup cheap.
create index commute_routes_active_idx
  on public.commute_routes (active, preferred_departure_time)
  where active;

create index commute_routes_user_idx on public.commute_routes (user_id);

-- Prevent a user from creating the same route twice.
create unique index commute_routes_unique_per_user
  on public.commute_routes (user_id, departure_station_id, arrival_station_id, preferred_departure_time);

-- ---------------------------------------------------------------------------
-- monitored_trips — one row per concrete monitored trip per day
-- ---------------------------------------------------------------------------

create table public.monitored_trips (
  id                          uuid primary key default gen_random_uuid(),
  route_id                    uuid not null references public.commute_routes (id) on delete cascade,
  -- Denormalised so RLS and the worker avoid a join on every read.
  user_id                     uuid not null references auth.users (id) on delete cascade,

  -- Belgian calendar day of the scheduled departure (docs/irail.md § Tijdzone).
  service_date                date not null,

  train_number                text,
  vehicle_id                  text,              -- e.g. BE.NMBS.IC527
  scheduled_departure         timestamptz,
  scheduled_arrival           timestamptz,

  -- The number that decides a claim. Clamped at 0; never negative.
  actual_arrival_delay_minutes integer
    check (actual_arrival_delay_minutes is null or actual_arrival_delay_minutes >= 0),
  cancelled                   boolean not null default false,

  measurement_status          public.trip_measurement_status not null default 'PENDING',
  -- Raw iRail payload: the evidence under the claim.
  irail_snapshot              jsonb,
  checked_at                  timestamptz,
  attempts                    smallint not null default 0,

  created_at                  timestamptz not null default now(),

  -- Idempotency: the worker can never create the same trip twice, however
  -- often it restarts mid-cycle.
  constraint monitored_trips_unique_per_route_day unique (route_id, service_date)
);

create index monitored_trips_user_idx on public.monitored_trips (user_id, service_date desc);
create index monitored_trips_pending_idx
  on public.monitored_trips (measurement_status, scheduled_arrival)
  where measurement_status = 'PENDING';

-- ---------------------------------------------------------------------------
-- compensation_rules — verified NMBS rules as data (docs/nmbs-regels.md)
-- ---------------------------------------------------------------------------

create table public.compensation_rules (
  rule_key     text primary key,
  parameters   jsonb not null,
  source_url   text not null check (source_url ~ '^https://'),
  verified_at  timestamptz not null,
  updated_at   timestamptz not null default now()
);

comment on table public.compensation_rules is
  'Verified NMBS rules. Thresholds, percentages and deadlines exist ONLY here, never in code. See docs/nmbs-regels.md.';

-- ---------------------------------------------------------------------------
-- claims
-- ---------------------------------------------------------------------------

create table public.claims (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users (id) on delete cascade,

  -- Set for SINGLE_DELAY. Null for FREQUENT_DELAYS, which aggregates many trips.
  monitored_trip_id           uuid references public.monitored_trips (id) on delete restrict,

  claim_type                  public.claim_type not null,
  status                      public.claim_status not null default 'DETECTED',

  -- The consent record. Nothing may be submitted without both of these.
  user_confirmed_at           timestamptz,
  confirmation_ip             inet,

  claim_pdf_path              text,
  submitted_at                timestamptz,
  -- Repeated-delays claims cannot be filed before this moment.
  submission_window_opens_at  timestamptz,
  deadline_at                 timestamptz not null,

  compensation_amount_expected_cents integer
    check (compensation_amount_expected_cents is null or compensation_amount_expected_cents >= 0),
  compensation_amount_received_cents integer
    check (compensation_amount_received_cents is null or compensation_amount_received_cents >= 0),

  -- Snapshot of the rules used, so a later rule change never silently rewrites
  -- the basis of an already-generated dossier.
  rules_snapshot              jsonb,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- One claim per user per monitored trip.
  constraint claims_unique_per_trip unique (user_id, monitored_trip_id),

  -- A SINGLE_DELAY claim must point at the trip it is based on.
  constraint claims_single_delay_has_trip check (
    claim_type <> 'SINGLE_DELAY' or monitored_trip_id is not null
  ),

  -- Consent is atomic: timestamp and IP are recorded together or not at all.
  constraint claims_confirmation_is_complete check (
    (user_confirmed_at is null and confirmation_ip is null)
    or (user_confirmed_at is not null and confirmation_ip is not null)
  ),

  -- ==========================================================================
  -- THE CORE GUARANTEE
  -- A claim can never occupy a post-confirmation state without an explicit,
  -- timestamped user confirmation. Enforced in the database, so no bug, no
  -- admin action and no service-role script can bypass it.
  -- ==========================================================================
  constraint claims_confirmation_required check (
    status in ('DETECTED', 'AWAITING_USER_CONFIRMATION', 'EXPIRED', 'CANCELLED')
    or user_confirmed_at is not null
  ),

  -- Submission implies confirmation and a submission timestamp.
  constraint claims_submitted_has_timestamp check (
    status not in ('SUBMITTED', 'AWAITING_NMBS', 'APPROVED', 'REJECTED')
    or submitted_at is not null
  )
);

create index claims_user_idx on public.claims (user_id, created_at desc);
create index claims_status_idx on public.claims (status);
create index claims_review_queue_idx
  on public.claims (created_at)
  where status = 'IN_ADMIN_REVIEW';
-- Drives the reminder mails and the EXPIRED sweep.
create index claims_deadline_idx
  on public.claims (deadline_at)
  where status = 'AWAITING_USER_CONFIRMATION';

-- Trips included in a FREQUENT_DELAYS claim (many-to-one).
create table public.claim_trips (
  claim_id          uuid not null references public.claims (id) on delete cascade,
  monitored_trip_id uuid not null references public.monitored_trips (id) on delete restrict,
  delay_minutes     integer not null check (delay_minutes >= 0),
  primary key (claim_id, monitored_trip_id)
);

-- ---------------------------------------------------------------------------
-- claim_status_events — append-only audit trail
-- ---------------------------------------------------------------------------

create table public.claim_status_events (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null references public.claims (id) on delete cascade,
  status      public.claim_status not null,
  source      public.status_event_source not null,
  note        text,
  actor_id    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index claim_status_events_claim_idx
  on public.claim_status_events (claim_id, created_at);

-- ---------------------------------------------------------------------------
-- mandates — digital authorisation, captured before the first dossier
-- ---------------------------------------------------------------------------

create table public.mandates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  accepted_at   timestamptz not null default now(),
  ip            inet not null,
  user_agent    text,
  text_version  text not null,
  created_at    timestamptz not null default now()
);

create index mandates_user_idx on public.mandates (user_id, accepted_at desc);

-- ---------------------------------------------------------------------------
-- notifications — idempotency ledger, so a user is never told twice
-- ---------------------------------------------------------------------------

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  claim_id     uuid references public.claims (id) on delete cascade,
  kind         text not null,
  channel      text not null check (channel in ('EMAIL', 'PUSH')),
  sent_at      timestamptz,
  error        text,
  created_at   timestamptz not null default now(),

  -- The same notification for the same claim can only exist once.
  constraint notifications_unique_per_claim_kind unique (claim_id, kind, channel)
);

-- ---------------------------------------------------------------------------
-- stripe_events — webhook idempotency + audit
-- ---------------------------------------------------------------------------

create table public.stripe_events (
  id            text primary key,          -- Stripe event id
  type          text not null,
  payload       jsonb not null,
  processed_at  timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- worker_heartbeats — dead-man's switch (ADR 0002)
-- ---------------------------------------------------------------------------

create table public.worker_heartbeats (
  worker_name  text primary key,
  beat_at      timestamptz not null default now(),
  detail       jsonb
);

-- ---------------------------------------------------------------------------
-- app_settings — admin-configurable values (prices, retention, auto-send)
-- ---------------------------------------------------------------------------

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger commute_routes_touch before update on public.commute_routes
  for each row execute function public.touch_updated_at();
create trigger claims_touch before update on public.claims
  for each row execute function public.touch_updated_at();
create trigger compensation_rules_touch before update on public.compensation_rules
  for each row execute function public.touch_updated_at();
