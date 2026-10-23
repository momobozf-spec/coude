-- Slijtageverdeling op een fotovergelijking.
--
-- De grille zegt hoe je een herstelkost verdeelt, niet wat een herstelling
-- kost. Die kost komt ofwel uit `repair_cost_reference` (indicatieve
-- bandbreedte, admin-beheerd), ofwel uit een offerte die de gebruiker zelf
-- invoert. Zolang geen van beide er is, wordt er geen bedrag getoond.
--
-- Zie docs/juridisch.md §5 en src/lib/vetuste/calculate.ts.

alter table photo_comparisons
  -- Post uit de Waalse grille waarop deze verdeling steunt.
  add column vetuste_item_key text references vetuste_reference(item_key),
  -- Leeftijd van de uitrusting bij intrek, in jaren.
  add column equipment_age_at_entry_years numeric(4, 1)
    check (equipment_age_at_entry_years >= 0),
  -- Geraamde herstelkost in eurocent, uit een offerte of uit de referentietabel.
  add column repair_cost_cents integer check (repair_cost_cents >= 0),
  add column repair_cost_source text
    check (repair_cost_source in ('QUOTE', 'REFERENCE_TABLE')),
  -- Grond waarop de grille niet toegepast wordt.
  add column vetuste_exclusion text,
  -- Uitkomst van de verdeling, bevroren op het moment van berekenen.
  add column vetuste_abattement_pct numeric(5, 2)
    check (vetuste_abattement_pct between 0 and 100),
  add column tenant_share_cents integer check (tenant_share_cents >= 0),
  add column landlord_share_cents integer check (landlord_share_cents >= 0),
  add column vetuste_calculated_at timestamptz;

-- Verdeling en kost horen bij elkaar: het een zonder het ander is zinloos.
alter table photo_comparisons
  add constraint photo_comparisons_vetuste_consistent
  check (
    vetuste_calculated_at is null
    or (
      repair_cost_cents is not null
      and tenant_share_cents is not null
      and landlord_share_cents is not null
    )
  );

-- Observaties van de AI, feitelijk beschreven. Los van ai_notes bewaard zodat
-- het rapport ze als lijst kan tonen.
alter table photo_comparisons
  add column ai_observed_differences jsonb not null default '[]'::jsonb,
  add column ai_forced_unclear boolean not null default false,
  add column ai_refused boolean not null default false,
  add column ai_suggested_item_keys text[] not null default '{}';

comment on column photo_comparisons.user_verdict is
  'Het oordeel van de gebruiker. Dit is leidend in het rapport; de AI-analyse '
  'staat in de bijlage.';
