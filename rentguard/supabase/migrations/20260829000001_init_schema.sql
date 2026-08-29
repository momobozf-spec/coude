-- RentGuard Brussels — basisschema
-- Alle tabellen krijgen RLS in migratie 20260829000002_rls.sql.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type app_language as enum ('nl', 'fr');
create type app_role as enum ('USER', 'ADMIN');

create type subscription_status as enum (
  'NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'
);

-- Vormen van huurwaarborg volgens art. 248 Brusselse Huisvestingscode
-- (gewijzigd door de Ordonnantie van 04/04/2024). Zie docs/juridisch.md §1.
create type deposit_type as enum (
  'INDIVIDUAL_ACCOUNT',
  'BANK_GUARANTEE_CPAS',
  'PROGRESSIVE_BANK_GUARANTEE',
  'REAL_SECURITY',
  'PERSONAL_SURETY',
  'OTHER',
  'UNKNOWN'
);

create type inspection_type as enum ('CHECK_IN', 'CHECK_OUT');
create type inspection_status as enum ('DRAFT', 'COMPLETED', 'SIGNED_BY_LANDLORD');

-- Zowel de AI-classificatie als het gebruikersoordeel gebruiken deze schaal.
create type damage_classification as enum ('WEAR_AND_TEAR', 'DAMAGE', 'UNCLEAR');

create type legal_rule_status as enum ('VERIFIED', 'UNVERIFIED', 'STALE');
create type letter_review_status as enum ('PLACEHOLDER', 'REVIEWED');

create type notice_type as enum (
  'DEPOSIT_CLAIM',
  'INDEXATION_DISPUTE',
  'DEFECT_NOTICE',
  'RENT_GRID_DISCUSSION'
);

create type notice_status as enum (
  'DRAFT', 'USER_APPROVED', 'SENT', 'DELIVERED', 'FAILED'
);

-- SELF_SERVICE  = gebruiker verstuurt zelf aangetekend via het bpost-loket
-- EMAIL_PLAIN   = gewone e-mail, GEEN aangetekende zending
-- QERDS         = gekwalificeerde elektronische aangetekende zending (eIDAS)
-- HYBRID_POST   = digitaal aangeleverd, fysiek aangetekend bezorgd
create type send_channel as enum (
  'SELF_SERVICE', 'EMAIL_PLAIN', 'QERDS', 'HYBRID_POST'
);

create type finding_severity as enum ('INFO', 'WARNING', 'CRITICAL');
create type audit_action as enum (
  'DOCUMENT_VIEW', 'DOCUMENT_DOWNLOAD', 'PHOTO_VIEW',
  'NOTICE_SENT', 'NOTICE_APPROVED', 'DATA_EXPORT', 'DATA_DELETION',
  'LANDLORD_REPORT_VIEW', 'LANDLORD_SIGNED'
);

-- ---------------------------------------------------------------------------
-- Hulpfunctie: updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  email citext not null,
  language app_language not null default 'fr',
  role app_role not null default 'USER',
  stripe_customer_id text unique,
  subscription_status subscription_status not null default 'NONE',
  subscription_current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

create table properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  -- Brussels Hoofdstedelijk Gewest: postcodes 1000-1299.
  postal_code text not null,
  municipality text not null,
  monthly_rent numeric(10, 2) check (monthly_rent >= 0),
  monthly_charges numeric(10, 2) check (monthly_charges >= 0),
  deposit_amount numeric(10, 2) check (deposit_amount >= 0),
  deposit_type deposit_type not null default 'UNKNOWN',
  lease_signed_on date,
  lease_start date,
  lease_end date,
  lease_registered boolean,
  peb_certificate_provided boolean,
  peb_rating text check (peb_rating in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  surface_m2 numeric(7, 2) check (surface_m2 > 0),
  bedrooms smallint check (bedrooms >= 0),
  -- Gegevens van de verhuurder: uitsluitend verwerkt om brieven te kunnen
  -- adresseren en versturen. Zie docs/privacy.md.
  landlord_name text,
  landlord_address text,
  landlord_email citext,
  -- Retentie: standaard 2 jaar na einde huurcontract, door de gebruiker
  -- verlengbaar tot 10 jaar. Zie docs/juridisch.md §6.
  retention_years smallint not null default 2
    check (retention_years between 1 and 10),
  retention_notice_sent_at timestamptz,
  scheduled_deletion_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_postal_code_brussels
    check (postal_code ~ '^1[0-2][0-9]{2}$'),
  constraint properties_lease_dates_ordered
    check (lease_end is null or lease_start is null or lease_end >= lease_start)
);

create index properties_user_id_idx on properties (user_id);
create index properties_scheduled_deletion_idx
  on properties (scheduled_deletion_at)
  where scheduled_deletion_at is not null;

create trigger properties_set_updated_at
  before update on properties
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- inspections
-- ---------------------------------------------------------------------------

create table inspections (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  type inspection_type not null,
  status inspection_status not null default 'DRAFT',
  inspection_date date not null,
  pdf_path text,
  pdf_generated_at timestamptz,
  -- Medeondertekening door de verhuurder. Het token wordt enkel gehasht
  -- bewaard; de klare waarde bestaat alleen in de uitnodigingslink.
  landlord_invite_token_hash text unique,
  landlord_invite_sent_at timestamptz,
  landlord_invite_expires_at timestamptz,
  landlord_signed_at timestamptz,
  landlord_signature_name text,
  landlord_signature_ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspections_signed_requires_name
    check (landlord_signed_at is null or landlord_signature_name is not null)
);

create index inspections_property_id_idx on inspections (property_id);
create unique index inspections_one_per_type_idx
  on inspections (property_id, type);

create trigger inspections_set_updated_at
  before update on inspections
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- inspection_rooms — de kamerstructuur die check-out van check-in overneemt
-- ---------------------------------------------------------------------------

create table inspection_rooms (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  -- Sleutel die check-in en check-out aan elkaar koppelt, bv. 'living_room'
  -- of 'custom:zolderkamer'.
  room_key text not null,
  display_name text not null,
  position smallint not null default 0,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (inspection_id, room_key)
);

create index inspection_rooms_inspection_idx on inspection_rooms (inspection_id);

-- ---------------------------------------------------------------------------
-- inspection_photos — bewijsintegriteit: hash + servertijdstempel + EXIF
-- ---------------------------------------------------------------------------

create table inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  room_id uuid references inspection_rooms(id) on delete set null,
  room text not null,
  -- Vaste labels uit de checklist ('overview', 'floor', 'walls', 'windows',
  -- 'damage_closeup') of een eigen label.
  label text not null,
  storage_path text not null unique,
  -- SHA-256 van de bytes zoals ontvangen, hex, lowercase.
  sha256 char(64) not null,
  byte_size bigint not null check (byte_size > 0),
  content_type text not null,
  exif jsonb,
  -- captured_at komt uit EXIF en is NIET betrouwbaar (door de gebruiker te
  -- beinvloeden). uploaded_at is de servertijd en is dat wel.
  captured_at timestamptz,
  uploaded_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  constraint inspection_photos_sha256_lower
    check (sha256 = lower(sha256) and sha256 ~ '^[0-9a-f]{64}$')
);

create index inspection_photos_inspection_idx on inspection_photos (inspection_id);
create index inspection_photos_room_label_idx
  on inspection_photos (inspection_id, room, label);
create index inspection_photos_sha256_idx on inspection_photos (sha256);

-- ---------------------------------------------------------------------------
-- photo_comparisons — AI analyseert, de gebruiker beslist
-- ---------------------------------------------------------------------------

create table photo_comparisons (
  id uuid primary key default gen_random_uuid(),
  checkin_photo_id uuid not null
    references inspection_photos(id) on delete cascade,
  checkout_photo_id uuid not null
    references inspection_photos(id) on delete cascade,
  ai_classification damage_classification,
  ai_confidence numeric(4, 3) check (ai_confidence between 0 and 1),
  ai_notes text,
  ai_provider text,
  ai_model text,
  ai_analyzed_at timestamptz,
  -- Bedragen komen uitsluitend uit repair_cost_reference, nooit uit het model.
  estimated_cost_low numeric(10, 2) check (estimated_cost_low >= 0),
  estimated_cost_high numeric(10, 2) check (estimated_cost_high >= 0),
  cost_reference_id uuid,
  -- Het gebruikersoordeel is leidend in het rapport.
  user_verdict damage_classification,
  user_note text,
  user_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkin_photo_id, checkout_photo_id),
  constraint photo_comparisons_cost_range
    check (
      estimated_cost_low is null
      or estimated_cost_high is null
      or estimated_cost_high >= estimated_cost_low
    ),
  constraint photo_comparisons_verdict_requires_timestamp
    check (user_verdict is null or user_reviewed_at is not null)
);

create index photo_comparisons_checkin_idx on photo_comparisons (checkin_photo_id);
create index photo_comparisons_checkout_idx on photo_comparisons (checkout_photo_id);

create trigger photo_comparisons_set_updated_at
  before update on photo_comparisons
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Referentiedata (leesbaar voor iedereen, schrijfbaar voor ADMIN)
-- ---------------------------------------------------------------------------

create table legal_rules (
  rule_key text primary key,
  description_nl text not null,
  description_fr text not null,
  parameters jsonb not null default '{}'::jsonb,
  source_url text not null,
  source_name text not null,
  source_is_official boolean not null default false,
  verified_at date not null,
  status legal_rule_status not null default 'UNVERIFIED',
  -- Toepassingsgebied in de tijd: veel Brusselse regels gelden alleen op
  -- contracten gesloten vanaf een bepaalde datum.
  applies_from date,
  applies_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger legal_rules_set_updated_at
  before update on legal_rules
  for each row execute function set_updated_at();

-- Berekende status: VERIFIED wordt STALE na 6 maanden.
create or replace function legal_rule_effective_status(
  p_status legal_rule_status,
  p_verified_at date
)
returns legal_rule_status
language sql
immutable
as $$
  select case
    when p_status = 'VERIFIED' and p_verified_at < (current_date - interval '6 months')
      then 'STALE'::legal_rule_status
    else p_status
  end;
$$;

create table letter_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  language app_language not null,
  version integer not null default 1,
  title text not null,
  body text not null,
  -- rule_keys waarop deze brief steunt; de app weigert te versturen als een
  -- daarvan UNVERIFIED is en de brief die regel als grondslag aanhaalt.
  required_rule_keys text[] not null default '{}',
  legal_review_status letter_review_status not null default 'PLACEHOLDER',
  legal_reviewed_by text,
  legal_reviewed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_key, language, version)
);

create index letter_templates_lookup_idx
  on letter_templates (template_key, language, is_active);

create trigger letter_templates_set_updated_at
  before update on letter_templates
  for each row execute function set_updated_at();

create table repair_cost_reference (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  item_key text not null unique,
  label_nl text not null,
  label_fr text not null,
  unit text not null,
  cost_low numeric(10, 2) not null check (cost_low >= 0),
  cost_high numeric(10, 2) not null check (cost_high >= 0),
  source_name text not null,
  source_url text,
  valid_from date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repair_cost_range check (cost_high >= cost_low)
);

create trigger repair_cost_set_updated_at
  before update on repair_cost_reference
  for each row execute function set_updated_at();

-- Waalse indicatieve slijtagegrille, gebruikt als NIET-BINDENDE referentie.
-- Zie docs/juridisch.md §5.
create table vetuste_reference (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  category text not null,
  label_source_fr text not null,
  label_nl text not null,
  label_fr text not null,
  lifetime_years numeric(4, 1) not null check (lifetime_years > 0),
  -- Het afschrijvingspercentage zoals de bron het afdrukt. Dit is 100 gedeeld
  -- door de levensduur, maar afgerond zoals in het officiële document; wij
  -- nemen de gepubliceerde waarde over in plaats van te herrekenen.
  abattement_pct numeric(5, 2) not null check (abattement_pct > 0),
  franchise_years numeric(4, 1) not null default 0,
  residual_value_pct numeric(5, 2) not null default 0,
  source_name text not null,
  source_url text,
  source_region text not null default 'WALLONIA',
  is_binding_in_brussels boolean not null default false,
  created_at timestamptz not null default now()
);

create index vetuste_reference_category_idx on vetuste_reference (category);

-- Gezondheidsindex. Basisjaren mogen nooit gemengd worden in een berekening.
create table health_index_values (
  id uuid primary key default gen_random_uuid(),
  year smallint not null,
  month smallint not null check (month between 1 and 12),
  base_year smallint not null,
  value numeric(10, 4) not null check (value > 0),
  source_name text not null default 'Statbel',
  source_url text,
  published_at date,
  created_at timestamptz not null default now(),
  unique (year, month, base_year)
);

create index health_index_lookup_idx on health_index_values (base_year, year, month);

-- ---------------------------------------------------------------------------
-- deposit_cases — waarborg-terugeis
-- ---------------------------------------------------------------------------

create table deposit_cases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references properties(id) on delete cascade,
  keys_returned_on date not null,
  deposit_amount numeric(10, 2) not null check (deposit_amount >= 0),
  landlord_claimed_amount numeric(10, 2) check (landlord_claimed_amount >= 0),
  landlord_claim_reason text,
  landlord_claim_received_on date,
  amount_refunded numeric(10, 2) check (amount_refunded >= 0),
  refunded_on date,
  -- Berekend uit legal_rules op het moment van aanmaken, met de gebruikte
  -- rule_key erbij zodat het dossier reproduceerbaar blijft.
  deadline_date date,
  deadline_rule_key text references legal_rules(rule_key),
  iban text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deposit_cases_deadline_idx on deposit_cases (deadline_date)
  where resolved_at is null;

create trigger deposit_cases_set_updated_at
  before update on deposit_cases
  for each row execute function set_updated_at();

create table deposit_reminders (
  id uuid primary key default gen_random_uuid(),
  deposit_case_id uuid not null references deposit_cases(id) on delete cascade,
  remind_at timestamptz not null,
  kind text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (deposit_case_id, kind)
);

create index deposit_reminders_due_idx on deposit_reminders (remind_at)
  where sent_at is null;

-- ---------------------------------------------------------------------------
-- legal_notices — brieven
-- ---------------------------------------------------------------------------

create table legal_notices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  deposit_case_id uuid references deposit_cases(id) on delete set null,
  type notice_type not null,
  language app_language not null,
  template_id uuid not null references letter_templates(id),
  template_key text not null,
  template_version integer not null,
  -- Momentopname van de regels waarop deze brief steunt, inclusief hun status
  -- op het moment van opstellen.
  rule_snapshot jsonb not null default '{}'::jsonb,
  -- Ingevulde velden; de brieftekst zelf komt uit de template.
  merge_fields jsonb not null default '{}'::jsonb,
  status notice_status not null default 'DRAFT',
  amount_claimed numeric(10, 2) check (amount_claimed >= 0),
  pdf_path text,
  pdf_sha256 char(64),
  -- Verplichte eindcontrole door de gebruiker.
  user_approved_at timestamptz,
  user_approval_ip inet,
  sent_via send_channel,
  provider_reference text,
  provider_proof jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Een brief kan de status SENT nooit bereiken zonder expliciete
  -- gebruikersgoedkeuring. Zie ook de trigger hieronder.
  constraint legal_notices_sent_requires_approval
    check (
      status in ('DRAFT', 'USER_APPROVED')
      or user_approved_at is not null
    ),
  constraint legal_notices_sent_requires_channel
    check (status not in ('SENT', 'DELIVERED') or sent_via is not null),
  constraint legal_notices_delivered_requires_proof
    check (status <> 'DELIVERED' or provider_reference is not null)
);

create index legal_notices_property_idx on legal_notices (property_id);
create index legal_notices_status_idx on legal_notices (status);

create trigger legal_notices_set_updated_at
  before update on legal_notices
  for each row execute function set_updated_at();

-- Databank-niveau slot: verzenden zonder goedkeuring is onmogelijk, ook als
-- applicatiecode een bug heeft.
create or replace function enforce_notice_approval()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('USER_APPROVED', 'SENT', 'DELIVERED')
     and new.user_approved_at is null then
    raise exception
      'legal_notices %: status % vereist user_approved_at', new.id, new.status;
  end if;

  if new.status in ('SENT', 'DELIVERED') and new.sent_at is null then
    raise exception 'legal_notices %: status % vereist sent_at', new.id, new.status;
  end if;

  -- Een goedgekeurde brief kan niet stilzwijgend van inhoud veranderen.
  if tg_op = 'UPDATE'
     and old.user_approved_at is not null
     and (new.merge_fields is distinct from old.merge_fields
          or new.template_id is distinct from old.template_id) then
    raise exception
      'legal_notices %: inhoud kan niet wijzigen na goedkeuring', new.id;
  end if;

  return new;
end;
$$;

create trigger legal_notices_enforce_approval
  before insert or update on legal_notices
  for each row execute function enforce_notice_approval();

-- ---------------------------------------------------------------------------
-- contract_scans
-- ---------------------------------------------------------------------------

create table contract_scans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  storage_path text not null,
  sha256 char(64) not null,
  extracted_text text,
  extraction_method text,
  -- findings: [{ clause_quote, category, explanation_nl, explanation_fr,
  --              rule_key, severity, user_dismissed }]
  findings jsonb not null default '[]'::jsonb,
  scanned_at timestamptz,
  user_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contract_scans_property_idx on contract_scans (property_id);

create trigger contract_scans_set_updated_at
  before update on contract_scans
  for each row execute function set_updated_at();

-- Gecureerde checklist van problematische clausules.
create table contract_clause_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  category text not null,
  label_nl text not null,
  label_fr text not null,
  explanation_nl text not null,
  explanation_fr text not null,
  -- Patronen waarmee de clausule herkend wordt (case-insensitive, per taal).
  patterns_nl text[] not null default '{}',
  patterns_fr text[] not null default '{}',
  rule_key text references legal_rules(rule_key),
  severity finding_severity not null default 'WARNING',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audits (huurprijs en indexatie)
-- ---------------------------------------------------------------------------

create table rent_audits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind in ('RENT_GRID', 'INDEXATION')),
  inputs jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  rule_snapshot jsonb not null default '{}'::jsonb,
  -- true zodra een van de gebruikte regels UNVERIFIED of STALE was.
  needs_verification boolean not null default true,
  created_at timestamptz not null default now()
);

create index rent_audits_property_idx on rent_audits (property_id, kind);

-- ---------------------------------------------------------------------------
-- Kennisbank voor de Q&A-assistent (RAG)
-- ---------------------------------------------------------------------------

create table kb_documents (
  id uuid primary key default gen_random_uuid(),
  doc_key text not null unique,
  title_nl text not null,
  title_fr text not null,
  source_name text not null,
  source_url text not null,
  source_is_official boolean not null default false,
  language app_language not null,
  retrieved_at date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references kb_documents(id) on delete cascade,
  position integer not null,
  content text not null,
  -- Full-text zoeken; geen externe embedding-dienst nodig om te starten.
  content_tsv tsvector,
  created_at timestamptz not null default now(),
  unique (document_id, position)
);

create index kb_chunks_tsv_idx on kb_chunks using gin (content_tsv);

create or replace function kb_chunks_update_tsv()
returns trigger
language plpgsql
as $$
begin
  new.content_tsv := to_tsvector('simple', coalesce(new.content, ''));
  return new;
end;
$$;

create trigger kb_chunks_tsv_trigger
  before insert or update of content on kb_chunks
  for each row execute function kb_chunks_update_tsv();

-- ---------------------------------------------------------------------------
-- Betalingen en toegangsrechten
-- ---------------------------------------------------------------------------

create table pricing_config (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  label_nl text not null,
  label_fr text not null,
  kind text not null check (kind in ('SUBSCRIPTION', 'ONE_OFF')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  stripe_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pricing_config_set_updated_at
  before update on pricing_config
  for each row execute function set_updated_at();

-- Toegangsrechten worden uitsluitend server-side toegekend, nooit door de client.
create table entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null references pricing_config(plan_key),
  -- Eenmalige pakketten gelden voor precies een woning.
  property_id uuid references properties(id) on delete cascade,
  source text not null check (source in ('STRIPE', 'FREE_TIER', 'MANUAL')),
  stripe_checkout_session_id text unique,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index entitlements_user_idx on entitlements (user_id, plan_key);
create unique index entitlements_one_off_per_property_idx
  on entitlements (user_id, plan_key, property_id)
  where property_id is not null and revoked_at is null;

-- Idempotentie voor Stripe-webhooks.
create table stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now()
);

-- Kostenopvolging van vision-analyses.
create table vision_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comparison_id uuid references photo_comparisons(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cost_estimate_cents integer,
  created_at timestamptz not null default now()
);

create index vision_usage_user_idx on vision_usage (user_id, created_at);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

create table audit_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  action audit_action not null,
  resource_type text not null,
  resource_id text,
  -- Nooit persoonsgegevens uit foto's of contracten in dit veld.
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_log_user_idx on audit_log (user_id, created_at desc);
create index audit_log_resource_idx on audit_log (resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- Verwijderingsverzoeken (AVG)
-- ---------------------------------------------------------------------------

create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  -- Bedenktijd voordat er onherroepelijk verwijderd wordt.
  execute_after timestamptz not null,
  executed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index deletion_requests_due_idx on deletion_requests (execute_after)
  where executed_at is null and cancelled_at is null;
