-- Row Level Security for every table.
--
-- Principles:
--  * Deny by default. RLS is enabled everywhere; a table with no matching
--    policy returns nothing.
--  * Users read their own rows and nothing else.
--  * Users have NO direct UPDATE on claims. Confirming a claim goes through
--    the confirm_claim() RPC, which is the only path that may set
--    user_confirmed_at. This keeps consent tamper-evident.
--  * The worker uses the service role, which bypasses RLS by design (ADR 0002)
--    but is still bound by the CHECK constraints on claims.

alter table public.profiles             enable row level security;
alter table public.commute_routes       enable row level security;
alter table public.monitored_trips      enable row level security;
alter table public.claims               enable row level security;
alter table public.claim_trips          enable row level security;
alter table public.claim_status_events  enable row level security;
alter table public.compensation_rules   enable row level security;
alter table public.mandates             enable row level security;
alter table public.notifications        enable row level security;
alter table public.stripe_events        enable row level security;
alter table public.worker_heartbeats    enable row level security;
alter table public.app_settings         enable row level security;
alter table public.admin_users          enable row level security;

-- Belt and braces: revoke the blanket grants Supabase hands to anon/authenticated
-- so that a future table without policies cannot leak.
revoke all on public.stripe_events      from anon, authenticated;
revoke all on public.worker_heartbeats  from anon, authenticated;
revoke all on public.admin_users        from anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- commute_routes
-- ---------------------------------------------------------------------------

create policy commute_routes_select_own on public.commute_routes
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy commute_routes_insert_own on public.commute_routes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy commute_routes_update_own on public.commute_routes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy commute_routes_delete_own on public.commute_routes
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- monitored_trips — read-only for users; only the worker writes them
-- ---------------------------------------------------------------------------

create policy monitored_trips_select_own on public.monitored_trips
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- claims — read-only for users. No UPDATE policy exists on purpose:
-- confirmation goes exclusively through confirm_claim().
-- ---------------------------------------------------------------------------

create policy claims_select_own on public.claims
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy claims_admin_update on public.claims
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy claim_trips_select_own on public.claim_trips
  for select to authenticated
  using (
    exists (
      select 1 from public.claims c
      where c.id = claim_trips.claim_id
        and (c.user_id = auth.uid() or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- claim_status_events — append-only audit trail, readable by the owner
-- ---------------------------------------------------------------------------

create policy claim_status_events_select_own on public.claim_status_events
  for select to authenticated
  using (
    exists (
      select 1 from public.claims c
      where c.id = claim_status_events.claim_id
        and (c.user_id = auth.uid() or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- compensation_rules — world-readable to signed-in users (they are public
-- facts and the UI cites them), writable by admins only.
-- ---------------------------------------------------------------------------

create policy compensation_rules_select on public.compensation_rules
  for select to authenticated
  using (true);

create policy compensation_rules_admin_write on public.compensation_rules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- mandates — insert-once, never updated or deleted by the user
-- ---------------------------------------------------------------------------

create policy mandates_select_own on public.mandates
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy mandates_insert_own on public.mandates
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- app_settings — readable by admins; the app reads it via the service role
-- ---------------------------------------------------------------------------

create policy app_settings_admin_all on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Deliberately NO policy on admin_users: the table's privileges are revoked
-- outright above, so the admin roster cannot be enumerated at all. Code that
-- needs to know whether the caller is an admin calls public.is_admin(), which
-- is SECURITY DEFINER and answers only about the caller.

-- ===========================================================================
-- State machine guard
-- ===========================================================================

create or replace function public.claims_guard()
returns trigger
language plpgsql
as $$
declare
  allowed public.claim_status[];
begin
  -- Consent, once given, is immutable. It may never be altered or withdrawn by
  -- an update — cancelling a claim is a status change, not a rewrite of history.
  if tg_op = 'UPDATE' then
    if old.user_confirmed_at is not null
       and new.user_confirmed_at is distinct from old.user_confirmed_at then
      raise exception
        'claims: user_confirmed_at is immutable once set (claim %)', old.id
        using errcode = 'check_violation';
    end if;

    if old.confirmation_ip is not null
       and new.confirmation_ip is distinct from old.confirmation_ip then
      raise exception
        'claims: confirmation_ip is immutable once set (claim %)', old.id
        using errcode = 'check_violation';
    end if;

    -- Legal transitions.
    if new.status is distinct from old.status then
      -- Every branch is cast explicitly: without it Postgres infers text[]
      -- from the first branch and then fails on the empty claim_status[] ones.
      allowed := case old.status
        when 'DETECTED' then
          array['AWAITING_USER_CONFIRMATION', 'EXPIRED', 'CANCELLED']::public.claim_status[]
        when 'AWAITING_USER_CONFIRMATION' then
          array['CONFIRMED', 'EXPIRED', 'CANCELLED']::public.claim_status[]
        when 'CONFIRMED' then
          array['IN_ADMIN_REVIEW', 'SUBMITTED', 'CANCELLED', 'EXPIRED']::public.claim_status[]
        when 'IN_ADMIN_REVIEW' then
          array['SUBMITTED', 'REJECTED', 'CANCELLED', 'EXPIRED']::public.claim_status[]
        when 'SUBMITTED' then
          array['AWAITING_NMBS', 'APPROVED', 'REJECTED', 'CANCELLED']::public.claim_status[]
        when 'AWAITING_NMBS' then
          array['APPROVED', 'REJECTED', 'CANCELLED']::public.claim_status[]
        -- Terminal states.
        when 'APPROVED'  then array[]::public.claim_status[]
        when 'REJECTED'  then array[]::public.claim_status[]
        when 'EXPIRED'   then array[]::public.claim_status[]
        when 'CANCELLED' then array[]::public.claim_status[]
      end;

      if not (new.status = any (allowed)) then
        raise exception
          'claims: illegal status transition % -> % (claim %)',
          old.status, new.status, old.id
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger claims_guard_trigger
  before update on public.claims
  for each row execute function public.claims_guard();

-- Mirror every status change into the audit trail automatically.
create or replace function public.claims_log_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.claim_status_events (claim_id, status, source, actor_id, note)
    values (
      new.id,
      new.status,
      case
        when auth.uid() is null then 'SYSTEM'::public.status_event_source
        when public.is_admin()  then 'ADMIN'::public.status_event_source
        else 'USER'::public.status_event_source
      end,
      auth.uid(),
      null
    );
  end if;
  return new;
end;
$$;

create trigger claims_log_status_insert
  after insert on public.claims
  for each row execute function public.claims_log_status();

create trigger claims_log_status_update
  after update on public.claims
  for each row execute function public.claims_log_status();

-- ===========================================================================
-- confirm_claim() — the ONLY path that may record user consent
-- ===========================================================================

create or replace function public.confirm_claim(
  p_claim_id uuid,
  p_ip inet
)
returns public.claims
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.claims;
begin
  if auth.uid() is null then
    raise exception 'confirm_claim: authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_ip is null then
    raise exception 'confirm_claim: confirmation IP is required'
      using errcode = 'null_value_not_allowed';
  end if;

  -- Lock the row so a double submit cannot produce two confirmations.
  select * into v_claim
  from public.claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'confirm_claim: claim not found'
      using errcode = 'no_data_found';
  end if;

  -- Ownership is checked here explicitly: SECURITY DEFINER bypasses RLS.
  if v_claim.user_id <> auth.uid() then
    raise exception 'confirm_claim: not your claim'
      using errcode = 'insufficient_privilege';
  end if;

  if v_claim.status <> 'AWAITING_USER_CONFIRMATION' then
    raise exception 'confirm_claim: claim is not awaiting confirmation (status %)',
      v_claim.status
      using errcode = 'check_violation';
  end if;

  if v_claim.deadline_at <= now() then
    raise exception 'confirm_claim: the deadline for this claim has passed'
      using errcode = 'check_violation';
  end if;

  update public.claims
  set status            = 'CONFIRMED',
      user_confirmed_at = now(),
      confirmation_ip   = p_ip
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.confirm_claim(uuid, inet) from public;
grant execute on function public.confirm_claim(uuid, inet) to authenticated;
