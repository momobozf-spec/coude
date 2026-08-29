-- RentGuard Brussels — Row Level Security
--
-- Uitgangspunt: elke tabel heeft RLS aan. Wat niet uitdrukkelijk toegelaten is,
-- is verboden. Server-side taken (webhooks, verzending, verhuurder-ondertekening
-- via token) draaien met de service role en omzeilen RLS bewust; die routes
-- doen hun eigen autorisatiecontrole.

-- ---------------------------------------------------------------------------
-- Hulpfuncties
-- ---------------------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where profiles.user_id = auth.uid()
      and profiles.role = 'ADMIN'
  );
$$;

create or replace function owns_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from properties
    where properties.id = p_property_id
      and properties.user_id = auth.uid()
  );
$$;

create or replace function owns_inspection(p_inspection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from inspections
    join properties on properties.id = inspections.property_id
    where inspections.id = p_inspection_id
      and properties.user_id = auth.uid()
  );
$$;

create or replace function owns_photo(p_photo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from inspection_photos
    join inspections on inspections.id = inspection_photos.inspection_id
    join properties on properties.id = inspections.property_id
    where inspection_photos.id = p_photo_id
      and properties.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS aanzetten op ALLE tabellen
-- ---------------------------------------------------------------------------

alter table profiles                enable row level security;
alter table properties              enable row level security;
alter table inspections             enable row level security;
alter table inspection_rooms        enable row level security;
alter table inspection_photos       enable row level security;
alter table photo_comparisons       enable row level security;
alter table legal_rules             enable row level security;
alter table letter_templates        enable row level security;
alter table repair_cost_reference   enable row level security;
alter table vetuste_reference       enable row level security;
alter table health_index_values     enable row level security;
alter table deposit_cases           enable row level security;
alter table deposit_reminders       enable row level security;
alter table legal_notices           enable row level security;
alter table contract_scans          enable row level security;
alter table contract_clause_checks  enable row level security;
alter table rent_audits             enable row level security;
alter table kb_documents            enable row level security;
alter table kb_chunks               enable row level security;
alter table pricing_config          enable row level security;
alter table entitlements            enable row level security;
alter table stripe_events           enable row level security;
alter table vision_usage            enable row level security;
alter table audit_log               enable row level security;
alter table deletion_requests       enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_own on profiles
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

create policy profiles_insert_own on profiles
  for insert to authenticated
  with check (user_id = auth.uid());

-- role en stripe-velden mogen niet door de gebruiker gewijzigd worden; dat
-- wordt afgedwongen door de trigger hieronder.
create policy profiles_update_own on profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- De service role (geen auth.uid()) mag alles.
  if auth.uid() is null then
    return new;
  end if;
  if is_admin() then
    return new;
  end if;

  new.role := old.role;
  new.stripe_customer_id := old.stripe_customer_id;
  new.subscription_status := old.subscription_status;
  new.subscription_current_period_end := old.subscription_current_period_end;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on profiles
  for each row execute function protect_profile_fields();

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

create policy properties_select_own on properties
  for select to authenticated
  using (user_id = auth.uid());

create policy properties_insert_own on properties
  for insert to authenticated
  with check (user_id = auth.uid());

create policy properties_update_own on properties
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy properties_delete_own on properties
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- inspections / rooms / photos / comparisons
-- ---------------------------------------------------------------------------

create policy inspections_all_own on inspections
  for all to authenticated
  using (owns_property(property_id))
  with check (owns_property(property_id));

create policy inspection_rooms_all_own on inspection_rooms
  for all to authenticated
  using (owns_inspection(inspection_id))
  with check (owns_inspection(inspection_id));

create policy inspection_photos_all_own on inspection_photos
  for all to authenticated
  using (owns_inspection(inspection_id))
  with check (owns_inspection(inspection_id));

create policy photo_comparisons_all_own on photo_comparisons
  for all to authenticated
  using (owns_photo(checkin_photo_id) and owns_photo(checkout_photo_id))
  with check (owns_photo(checkin_photo_id) and owns_photo(checkout_photo_id));

-- ---------------------------------------------------------------------------
-- Referentiedata: iedereen leest, alleen ADMIN schrijft
-- ---------------------------------------------------------------------------

create policy legal_rules_read on legal_rules
  for select to authenticated using (true);
create policy legal_rules_admin_write on legal_rules
  for all to authenticated using (is_admin()) with check (is_admin());

create policy letter_templates_read on letter_templates
  for select to authenticated using (true);
create policy letter_templates_admin_write on letter_templates
  for all to authenticated using (is_admin()) with check (is_admin());

create policy repair_cost_read on repair_cost_reference
  for select to authenticated using (true);
create policy repair_cost_admin_write on repair_cost_reference
  for all to authenticated using (is_admin()) with check (is_admin());

create policy vetuste_read on vetuste_reference
  for select to authenticated using (true);
create policy vetuste_admin_write on vetuste_reference
  for all to authenticated using (is_admin()) with check (is_admin());

create policy health_index_read on health_index_values
  for select to authenticated using (true);
create policy health_index_admin_write on health_index_values
  for all to authenticated using (is_admin()) with check (is_admin());

create policy clause_checks_read on contract_clause_checks
  for select to authenticated using (true);
create policy clause_checks_admin_write on contract_clause_checks
  for all to authenticated using (is_admin()) with check (is_admin());

create policy kb_documents_read on kb_documents
  for select to authenticated using (is_active);
create policy kb_documents_admin_write on kb_documents
  for all to authenticated using (is_admin()) with check (is_admin());

create policy kb_chunks_read on kb_chunks
  for select to authenticated using (true);
create policy kb_chunks_admin_write on kb_chunks
  for all to authenticated using (is_admin()) with check (is_admin());

create policy pricing_read on pricing_config
  for select to authenticated using (is_active or is_admin());
create policy pricing_admin_write on pricing_config
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Dossiers gekoppeld aan een woning
-- ---------------------------------------------------------------------------

create policy deposit_cases_all_own on deposit_cases
  for all to authenticated
  using (owns_property(property_id))
  with check (owns_property(property_id));

create policy deposit_reminders_select_own on deposit_reminders
  for select to authenticated
  using (exists (
    select 1 from deposit_cases dc
    where dc.id = deposit_reminders.deposit_case_id
      and owns_property(dc.property_id)
  ));

create policy contract_scans_all_own on contract_scans
  for all to authenticated
  using (owns_property(property_id))
  with check (owns_property(property_id));

create policy rent_audits_all_own on rent_audits
  for all to authenticated
  using (owns_property(property_id))
  with check (owns_property(property_id));

-- ---------------------------------------------------------------------------
-- legal_notices
--
-- De client mag brieven opstellen, aanpassen en goedkeuren. Het effectief
-- verzenden gebeurt server-side; de client kan status nooit zelf op SENT,
-- DELIVERED of FAILED zetten.
-- ---------------------------------------------------------------------------

create policy legal_notices_select_own on legal_notices
  for select to authenticated
  using (owns_property(property_id));

create policy legal_notices_insert_own on legal_notices
  for insert to authenticated
  with check (owns_property(property_id) and status = 'DRAFT');

create policy legal_notices_update_own on legal_notices
  for update to authenticated
  using (owns_property(property_id) and status in ('DRAFT', 'USER_APPROVED'))
  with check (owns_property(property_id) and status in ('DRAFT', 'USER_APPROVED'));

create policy legal_notices_delete_draft on legal_notices
  for delete to authenticated
  using (owns_property(property_id) and status = 'DRAFT');

-- ---------------------------------------------------------------------------
-- Alleen-lezen voor de gebruiker; schrijven uitsluitend server-side
-- ---------------------------------------------------------------------------

create policy entitlements_select_own on entitlements
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

create policy vision_usage_select_own on vision_usage
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

create policy audit_log_select_own on audit_log
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- stripe_events: geen enkele client-toegang. RLS staat aan zonder policies,
-- dus alleen de service role komt erbij.

-- ---------------------------------------------------------------------------
-- deletion_requests
-- ---------------------------------------------------------------------------

create policy deletion_requests_select_own on deletion_requests
  for select to authenticated
  using (user_id = auth.uid());

create policy deletion_requests_insert_own on deletion_requests
  for insert to authenticated
  with check (user_id = auth.uid());

create policy deletion_requests_cancel_own on deletion_requests
  for update to authenticated
  using (user_id = auth.uid() and executed_at is null)
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profiel aanmaken bij registratie
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, email, full_name, language)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'language', '')::app_language,
      'fr'::app_language
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage: private buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('inspection-photos', 'inspection-photos', false),
  ('reports', 'reports', false),
  ('contracts', 'contracts', false)
on conflict (id) do nothing;

-- Objectpad-conventie: <user_id>/<rest>. Zo is eigendom af te leiden uit het
-- pad zonder join.
create policy storage_own_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('inspection-photos', 'reports', 'contracts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_own_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('inspection-photos', 'reports', 'contracts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_own_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('inspection-photos', 'reports', 'contracts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
