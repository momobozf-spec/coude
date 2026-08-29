-- Waalse indicatieve slijtagegrille — officiële referentiedata.
--
-- Bron: "Grille indicative de référence portant sur la vétusté naturelle des
-- logements en Wallonie", Service public de Wallonie.
-- https://logement.wallonie.be/storage/logement/documents/content/lease/reparations-et-vetuste-listes/grille-indicative-de-vetuste-des-logements-tableau.pdf
-- Geraadpleegd en overgenomen op 2026-08-29.
--
-- LET OP — dit is WAALS recht, geen Brussels recht.
-- Er bestaat geen officieel slijtagerooster voor het Brussels Hoofdstedelijk
-- Gewest. Wij gebruiken deze grille als niet-bindende referentie om de AI-
-- classificatie te onderbouwen en om een kostenverdeling te kunnen tonen.
-- Een Brusselse rechter is er niet aan gebonden. De UI moet dat zeggen.
-- Zie docs/juridisch.md §5.
--
-- Categorieën: het brondocument spreekt van vijf categorieën (chauffage,
-- électricité, menuiseries, parachèvements, sanitaires). In de PDF-tekst zijn
-- vier koppen zichtbaar; de afwerkingsposten staan hieronder onder
-- 'PARACHEVEMENTS' omdat ze inhoudelijk daar horen. Wie de indeling exact wil
-- volgen, moet de opmaak van het brondocument naslaan.

insert into vetuste_reference (
  item_key, category, label_source_fr, label_nl, label_fr,
  lifetime_years, abattement_pct, source_name, source_url
)
select
  item_key, category, label_source_fr, label_nl, label_fr,
  lifetime_years, abattement_pct,
  'Service public de Wallonie — Grille indicative de vétusté',
  'https://logement.wallonie.be/storage/logement/documents/content/lease/reparations-et-vetuste-listes/grille-indicative-de-vetuste-des-logements-tableau.pdf'
from (values

-- CHAUFFAGE ------------------------------------------------------------------
  ('heating.electric_water_heater', 'CHAUFFAGE', 'BOILERS ET CHAUFFE-EAUX ELECTRIQUES', 'Elektrische boilers en waterverwarmers', 'Boilers et chauffe-eaux électriques', 10.0, 10.00),
  ('heating.gas_water_heater', 'CHAUFFAGE', 'CHAUFFE-EAU AU GAZ', 'Gasboiler', 'Chauffe-eau au gaz', 12.0, 8.33),
  ('heating.water_heater_any', 'CHAUFFAGE', 'BOILERS/CHAUFFE-EAU (TOUS TYPES)', 'Boiler of waterverwarmer (alle types)', 'Boilers/chauffe-eau (tous types)', 10.0, 10.00),
  ('heating.boiler', 'CHAUFFAGE', 'CHAUDIERE', 'Verwarmingsketel', 'Chaudière', 15.0, 6.67),
  ('heating.radiators', 'CHAUFFAGE', 'RADIATEURS', 'Radiatoren', 'Radiateurs', 25.0, 4.00),
  ('heating.electric_convector', 'CHAUFFAGE', 'CONVECTEUR ELECTRIQUE', 'Elektrische convector', 'Convecteur électrique', 15.0, 6.67),

-- ELECTRICITE ----------------------------------------------------------------
  ('electricity.installation', 'ELECTRICITE', 'INSTALLATION ELECTRIQUE', 'Elektrische installatie', 'Installation électrique', 20.0, 5.00),
  ('electricity.vmc_vent', 'ELECTRICITE', 'VMC individuelle (bouche)', 'Individuele ventilatie (rooster)', 'VMC individuelle (bouche)', 15.0, 6.67),
  ('electricity.vmc_motor', 'ELECTRICITE', 'VMC individuelle (Groupe moteur)', 'Individuele ventilatie (motorgroep)', 'VMC individuelle (groupe moteur)', 15.0, 6.67),

-- MENUISERIES ----------------------------------------------------------------
  ('joinery.exterior_woodwork_paint', 'MENUISERIES', 'PEINTURES BOISERIES EXTERIEURES', 'Schilderwerk buitenschrijnwerk', 'Peintures boiseries extérieures', 9.0, 11.11),
  ('joinery.shutters_pvc_rolling', 'MENUISERIES', 'VOLETS PVC – ROULANTS', 'Rolluiken in pvc', 'Volets PVC – roulants', 16.0, 6.25),
  ('joinery.shutters_pvc_hinged', 'MENUISERIES', 'VOLETS PVC – BATTANTS', 'Draailuiken in pvc', 'Volets PVC – battants', 20.0, 5.00),
  ('joinery.shutters_wood_alu_rolling', 'MENUISERIES', 'VOLETS BOIS/ALU - ROULANTS', 'Rolluiken in hout of aluminium', 'Volets bois/alu – roulants', 20.0, 5.00),
  ('joinery.shutters_wood_alu_hinged', 'MENUISERIES', 'VOLETS BOIS/ALU - BATTANTS', 'Draailuiken in hout of aluminium', 'Volets bois/alu – battants', 20.0, 5.00),
  ('joinery.shutters_any', 'MENUISERIES', 'VOLETS (TOUS TYPES)', 'Luiken (alle types)', 'Volets (tous types)', 20.0, 5.00),
  ('joinery.interior_door', 'MENUISERIES', 'PORTE INTÉRIEURE', 'Binnendeur', 'Porte intérieure', 23.0, 4.35),
  ('joinery.entrance_door', 'MENUISERIES', 'PORTE PALIÈRE/PORTE D''ENTRÉE', 'Toegangsdeur of overloopdeur', 'Porte palière / porte d''entrée', 23.0, 4.35),
  ('joinery.door_any', 'MENUISERIES', 'PORTE (TOUS TYPES)', 'Deur (alle types)', 'Porte (tous types)', 23.0, 4.35),
  ('joinery.locks_hardware', 'MENUISERIES', 'SERRURERIE - QUINCAILLERIES', 'Sloten en beslag', 'Serrurerie – quincaillerie', 15.0, 6.67),

-- PARACHEVEMENTS -------------------------------------------------------------
  ('finish.tiling', 'PARACHEVEMENTS', 'REVÊTEMENT CARRELAGE', 'Tegelbekleding', 'Revêtement carrelage', 25.0, 4.00),
  ('finish.wallpaper', 'PARACHEVEMENTS', 'PAPIERS DE TAPISSERIE', 'Behangpapier', 'Papiers de tapisserie', 8.0, 12.50),
  ('finish.interior_wall_paint', 'PARACHEVEMENTS', 'PEINTURES INTERIEURES MURS', 'Binnenschilderwerk muren', 'Peintures intérieures murs', 8.0, 12.50),
  ('finish.interior_ceiling_paint', 'PARACHEVEMENTS', 'PEINTURES INTERIEURES PLAFONDS/FAUX-PLAFONDS', 'Binnenschilderwerk plafonds en valse plafonds', 'Peintures intérieures plafonds / faux-plafonds', 10.0, 10.00),
  ('finish.exterior_wall_paint', 'PARACHEVEMENTS', 'PEINTURES EXTERIEURES MURS', 'Buitenschilderwerk muren', 'Peintures extérieures murs', 10.0, 10.00),
  ('finish.floors_and_slabs', 'PARACHEVEMENTS', 'PLANCHERS ET DALLES DE SOL', 'Vloeren en vloerplaten', 'Planchers et dalles de sol', 13.0, 7.69),
  ('finish.wall_cladding', 'PARACHEVEMENTS', 'REVETEMENTS MURAUX (Lambris/Plaquettes de parement)', 'Wandbekleding (lambrisering, steenstrips)', 'Revêtements muraux (lambris / plaquettes de parement)', 20.0, 5.00),
  ('finish.laminate_floor', 'PARACHEVEMENTS', 'REVETEMENTS DE SOL STRATIFIÉS', 'Laminaatvloer', 'Revêtements de sol stratifiés', 17.0, 5.88),
  ('finish.solid_parquet', 'PARACHEVEMENTS', 'PARQUET MASSIF', 'Massief parket', 'Parquet massif', 27.0, 3.70),
  ('finish.carpet', 'PARACHEVEMENTS', 'MOQUETTE', 'Tapijt', 'Moquette', 9.0, 11.11),
  ('finish.vinyl', 'PARACHEVEMENTS', 'VYNILE', 'Vinyl', 'Vinyle', 15.0, 6.67),
  ('finish.wall_tiles', 'PARACHEVEMENTS', 'FAÏENCE MURALE', 'Wandtegels', 'Faïence murale', 20.0, 5.00),

-- SANITAIRES -----------------------------------------------------------------
  ('sanitary.bathtub', 'SANITAIRES', 'BAIGNOIRES', 'Ligbad', 'Baignoires', 20.0, 5.00),
  ('sanitary.shower_cabin', 'SANITAIRES', 'DOUCHES (Cabine)', 'Douchecabine', 'Douches (cabine)', 20.0, 5.00),
  ('sanitary.shower_tray', 'SANITAIRES', 'DOUCHE (Bac)', 'Douchebak', 'Douche (bac)', 20.0, 5.00),
  ('sanitary.wc_complete', 'SANITAIRES', 'WC ET CHASSES D''EAU (complet)', 'Toilet en spoelbak (volledig)', 'WC et chasses d''eau (complet)', 20.0, 5.00),
  ('sanitary.wc_bowl', 'SANITAIRES', 'WC (cuvette)', 'Toiletpot', 'WC (cuvette)', 22.0, 4.55),
  ('sanitary.wc_parts', 'SANITAIRES', 'TOUS ELEMENTS DE WC', 'Alle toiletonderdelen', 'Tous éléments de WC', 22.0, 4.55),
  ('sanitary.fixtures_taps', 'SANITAIRES', 'APPAREILS SANITAIRES ET ROBINETTERIES', 'Sanitaire toestellen en kranen', 'Appareils sanitaires et robinetteries', 14.0, 7.14),
  ('sanitary.washbasin', 'SANITAIRES', 'LAVABO', 'Wastafel', 'Lavabo', 20.0, 5.00),
  ('sanitary.under_sink_unit', 'SANITAIRES', 'MEUBLES SOUS ÉVIER', 'Onderkast gootsteen', 'Meubles sous évier', 12.0, 8.33)

) as t(item_key, category, label_source_fr, label_nl, label_fr, lifetime_years, abattement_pct)
on conflict (item_key) do nothing;
