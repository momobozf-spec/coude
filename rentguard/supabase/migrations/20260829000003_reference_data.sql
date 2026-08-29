-- RentGuard Brussels — referentiedata
--
-- Elke regel draagt haar eigen bron en verificatiestatus. Zie docs/juridisch.md.
-- Regels met status UNVERIFIED mogen in de UI nooit als vaststaand verschijnen.

-- ---------------------------------------------------------------------------
-- legal_rules
-- ---------------------------------------------------------------------------

insert into legal_rules (
  rule_key, description_nl, description_fr, parameters,
  source_url, source_name, source_is_official, verified_at, status,
  applies_from, notes
) values

-- §1 Huurwaarborg -----------------------------------------------------------
(
  'bxl.deposit.max_months',
  'De huurwaarborg bedraagt maximaal 2 maanden huur.',
  'La garantie locative s''élève à maximum 2 mois de loyer.',
  '{"max_months": 2, "code_article": "248"}'::jsonb,
  'https://etaamb.openjustice.be/fr/ordonnance-du-04-avril-2024_n2024003465.html',
  'Ordonnantie 04/04/2024 tot wijziging van de Brusselse Huisvestingscode (art. 248)',
  true, date '2026-08-29', 'VERIFIED', date '2024-11-01',
  'Geldt voor huurovereenkomsten gesloten of hernieuwd vanaf 01/11/2024.'
),
(
  'bxl.deposit.allowed_forms',
  'De huurder kiest de vorm van de waarborg uit vijf wettelijke mogelijkheden.',
  'Le locataire choisit la forme de la garantie parmi cinq possibilités légales.',
  '{"forms": ["INDIVIDUAL_ACCOUNT", "BANK_GUARANTEE_CPAS", "PROGRESSIVE_BANK_GUARANTEE", "REAL_SECURITY", "PERSONAL_SURETY"], "personal_surety_student_only": true, "code_article": "248"}'::jsonb,
  'https://etaamb.openjustice.be/fr/ordonnance-du-04-avril-2024_n2024003465.html',
  'Ordonnantie 04/04/2024 (art. 248)',
  true, date '2026-08-29', 'VERIFIED', date '2024-11-01',
  'Persoonlijke borgstelling: enkel bij studentenhuur, cumuleerbaar.'
),
(
  'bxl.deposit.restitution_deadline_months',
  'De waarborg moet binnen 2 maanden na teruggave van de sleutels worden vrijgegeven.',
  'La garantie doit être libérée dans les 2 mois de la remise des clés.',
  '{"months": 2, "starts_from": "KEYS_RETURNED", "code_article": "249"}'::jsonb,
  'https://etaamb.openjustice.be/fr/ordonnance-du-04-avril-2024_n2024003465.html',
  'Ordonnantie 04/04/2024 (art. 249)',
  true, date '2026-08-29', 'VERIFIED', date '2024-11-01',
  'Openstaande vraag aan de jurist: startpunt bij sleuteloverdracht die niet samenvalt met het einde van de huur.'
),
(
  'bxl.deposit.late_penalty_pct_per_month',
  'Bij laattijdige vrijgave is 10 % van het waarborgbedrag per maand vertraging verschuldigd.',
  'En cas de restitution tardive, 10 % du montant de la garantie est dû par mois de retard.',
  '{"pct_per_month": 10, "code_article": "249", "claimable_without_confirmation": false}'::jsonb,
  'https://etaamb.openjustice.be/fr/ordonnance-du-04-avril-2024_n2024003465.html',
  'Ordonnantie 04/04/2024 (art. 249)',
  true, date '2026-08-29', 'VERIFIED', date '2024-11-01',
  'Nog niet bevestigd of de boete van rechtswege loopt dan wel een ingebrekestelling vereist. De brief vermeldt het bedrag daarom onder voorbehoud.'
),
(
  'bxl.deposit.cash_prohibited',
  'De huurwaarborg mag niet in cash betaald worden.',
  'La garantie locative ne peut pas être payée en espèces.',
  '{}'::jsonb,
  'https://www.biv.be/nieuws/artikels/wijzigingen-brusselse-huisvestingscode-gaan-op-1-november-0',
  'BIV/IPI (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', date '2024-11-01',
  'Enkel via secundaire bron gevonden.'
),

-- §2 Plaatsbeschrijving -----------------------------------------------------
(
  'be.edl.mandatory',
  'Een tegensprekelijke plaatsbeschrijving bij intrek is verplicht.',
  'Un état des lieux d''entrée contradictoire est obligatoire.',
  '{"code_article": "1730 oud BW / 220 Brusselse Huisvestingscode"}'::jsonb,
  'https://www.bruxelles-j.be/te-loger/etat-des-lieux-dentree-et-de-sortie/',
  'Bruxelles-J (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', null,
  'Artikelnummers nog niet in de officiële geconsolideerde tekst nagelezen.'
),
(
  'be.edl.absence_presumption',
  'Zonder plaatsbeschrijving bij intrek wordt de huurder vermoed het goed in goede staat te hebben ontvangen.',
  'Sans état des lieux d''entrée, le locataire est présumé avoir reçu le bien en bon état.',
  '{"code_article": "1731 oud BW"}'::jsonb,
  'https://www.bruxelles-j.be/te-loger/etat-des-lieux-dentree-et-de-sortie/',
  'Bruxelles-J (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', null,
  'Dit vermoeden is de reden waarom fotodocumentatie waarde heeft.'
),

-- §3 Indexatie --------------------------------------------------------------
(
  'be.index.formula',
  'Nieuwe huurprijs = basishuurprijs x (nieuwe gezondheidsindex / aanvangsindex).',
  'Nouveau loyer = loyer de base x (nouvel indice santé / indice de départ).',
  '{"index_type": "HEALTH", "base_index_month": "MONTH_BEFORE_SIGNING", "new_index_month": "MONTH_BEFORE_ANNIVERSARY", "code_article": "1728bis oud BW"}'::jsonb,
  'https://legalnews.be/bouw-vastgoed/indexatie-van-woninghuur-in-vlaanderen-en-brussel-wat-is-de-stand-van-zaken-na-1-oktober-2023-seeds-of-law/',
  'Seeds of Law via Legal News (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', null,
  'Formule breed bevestigd; artikelverwijzing nog te verifiëren in de officiële tekst.'
),
(
  'be.index.not_automatic',
  'Indexatie gebeurt niet automatisch: de verhuurder moet ze schriftelijk vragen.',
  'L''indexation n''est pas automatique: le bailleur doit la demander par écrit.',
  '{}'::jsonb,
  'https://legalnews.be/bouw-vastgoed/indexatie-van-woninghuur-in-vlaanderen-en-brussel-wat-is-de-stand-van-zaken-na-1-oktober-2023-seeds-of-law/',
  'Seeds of Law via Legal News (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', null, null
),
(
  'bxl.index.requires_registration',
  'In Brussel is indexatie niet toegelaten als het huurcontract niet geregistreerd is.',
  'À Bruxelles, l''indexation n''est pas autorisée si le bail n''est pas enregistré.',
  '{}'::jsonb,
  'https://www.smovin.app/nl-be/huurindexatie/brussel/',
  'Smovin (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', null, null
),
(
  'bxl.index.requires_peb_certificate',
  'In Brussel is indexatie niet toegelaten als het EPB-certificaat niet aan de huurder werd voorgelegd.',
  'À Bruxelles, l''indexation n''est pas autorisée si le certificat PEB n''a pas été présenté au locataire.',
  '{}'::jsonb,
  'https://www.smovin.app/nl-be/huurindexatie/brussel/',
  'Smovin (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', null, null
),
(
  'bxl.index.peb_correction_factors',
  'EPB-gebonden correctiefactoren op de indexatie. TOEPASSINGSGEBIED ONZEKER — bronnen spreken elkaar tegen.',
  'Facteurs de correction liés au PEB. CHAMP D''APPLICATION INCERTAIN — les sources se contredisent.',
  '{"factors": {"A": 1.0, "B": 1.0, "C": 1.0, "D": 0.75, "E": 0.75, "F": 0.0, "G": 0.0}, "code_article": "224/2 §1bis/2", "conflicting_readings": ["contracten van vóór 01/10/2022 met label D/E/F", "contracten in werking vóór 14/10/2022, labels E/F/G volgens aangepaste formule", "degressief mechanisme over 12 maanden afhankelijk van de verjaardagsmaand"], "may_ground_a_letter": false}'::jsonb,
  'https://verenigdeeigenaars.be/wp-content/uploads/2024/04/Correctiefactoren-Brussels-Hoofdstedelijk-Gewest-Eigenaarsmagazine-okt-2023.pdf',
  'Verenigde Eigenaars / Dewaele / Seeds of Law (tegenstrijdige secundaire bronnen)',
  false, date '2026-08-29', 'UNVERIFIED', null,
  'Er wordt GEEN ingebrekestelling gegenereerd die zich uitsluitend op deze regel baseert zolang de status UNVERIFIED is.'
),

-- §4 Huurrooster ------------------------------------------------------------
(
  'bxl.rentgrid.legal_basis',
  'Het indicatieve huurrooster berust op de Besluiten BHR van 30/06/2022 en 06/10/2022.',
  'La grille indicative des loyers repose sur les arrêtés du GRBC des 30/06/2022 et 06/10/2022.',
  '{"arretes": ["2022-06-30", "2022-10-06"]}'::jsonb,
  'https://loyers.brussels/a-propos-des-loyers-de-reference',
  'loyers.brussels (officieel)',
  true, date '2026-08-29', 'VERIFIED', null, null
),
(
  'bxl.rentgrid.margin_pct',
  'Rond de mediane referentiehuurprijs geldt een marge van 10 %.',
  'Une marge de 10 % s''applique autour du loyer de référence médian.',
  '{"margin_pct": 10}'::jsonb,
  'https://loyers.brussels/a-propos-des-loyers-de-reference',
  'loyers.brussels (officieel)',
  true, date '2026-08-29', 'VERIFIED', null, null
),
(
  'bxl.rentgrid.indicative_only',
  'Het huurrooster is indicatief en legt geen wettelijk maximum op.',
  'La grille des loyers est indicative et n''impose pas de maximum légal.',
  '{}'::jsonb,
  'https://loyers.brussels/a-propos-des-loyers-de-reference',
  'loyers.brussels (officieel)',
  true, date '2026-08-29', 'VERIFIED', null, null
),
(
  'bxl.rentgrid.method_not_public',
  'De volledige berekeningsmethode van het rooster is niet publiek reproduceerbaar.',
  'La méthode de calcul complète de la grille n''est pas reproductible publiquement.',
  '{"official_tool_url": "https://loyers.brussels"}'::jsonb,
  'https://loyers.brussels/a-propos-des-loyers-de-reference',
  'loyers.brussels (officieel)',
  true, date '2026-08-29', 'VERIFIED', null,
  'Daarom begeleide flow naar de officiële tool in plaats van een eigen berekening.'
),

-- §6 Verjaring --------------------------------------------------------------
(
  'be.prescription.lease_claims_years',
  'Persoonlijke rechtsvorderingen uit de huurovereenkomst verjaren na 10 jaar.',
  'Les actions personnelles découlant du bail se prescrivent par 10 ans.',
  '{"years": 10, "code_article": "2262bis §1 oud BW"}'::jsonb,
  'https://www.elfri.be/artikel/persoonlijke-rechtsvorderingen-verjaren-na-10-jaar',
  'elfri.be (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', null,
  'Relevant voor de bewaartermijn: onze standaard van 2 jaar is korter dan deze termijn.'
),
(
  'be.prescription.rent_arrears_years',
  'Achterstallige huur verjaart na 5 jaar vanaf de vervaldag van elke maandhuur.',
  'Les arriérés de loyer se prescrivent par 5 ans à compter de chaque échéance mensuelle.',
  '{"years": 5, "code_article": "2277 oud BW"}'::jsonb,
  'https://advocaten-leuven.be/verjaring-en-huur-wanneer-verjaart-mijn-vordering-inzake-huur/',
  'Advocaten Leuven (secundaire bron)',
  false, date '2026-08-29', 'UNVERIFIED', null, null
),

-- §5 Slijtage ---------------------------------------------------------------
(
  'be.vetuste.no_brussels_grid',
  'Er bestaat geen officieel slijtagerooster voor het Brussels Hoofdstedelijk Gewest.',
  'Il n''existe pas de grille de vétusté officielle pour la Région de Bruxelles-Capitale.',
  '{"reference_grid_region": "WALLONIA", "binding_in_brussels": false}'::jsonb,
  'https://logement.wallonie.be/storage/logement/documents/content/lease/reparations-et-vetuste-listes/grille-indicative-de-vetuste-des-logements-guide-utilisation.pdf',
  'Waals Gewest — grille indicative de vétusté (als niet-bindende referentie)',
  false, date '2026-08-29', 'UNVERIFIED', null,
  'Negatieve vaststelling: afwezigheid van een Brusselse grille is niet formeel te bewijzen. Aan de jurist voorleggen.'
);

-- ---------------------------------------------------------------------------
-- pricing_config
-- ---------------------------------------------------------------------------

insert into pricing_config (plan_key, label_nl, label_fr, kind, amount_cents) values
  ('tenant_protect', 'Tenant Protect', 'Tenant Protect', 'SUBSCRIPTION', 499),
  ('deposit_recovery', 'Deposit Recovery', 'Deposit Recovery', 'ONE_OFF', 2999),
  ('relocation_pass', 'All-in Relocation Pass', 'All-in Relocation Pass', 'ONE_OFF', 4999),
  ('free_checkin', 'Gratis check-in rapport', 'Rapport d''entrée gratuit', 'ONE_OFF', 0);

-- ---------------------------------------------------------------------------
-- letter_templates
--
-- Alle templates staan op PLACEHOLDER tot een jurist ze nakijkt. De applicatie
-- toont die status bij elke brief.
-- ---------------------------------------------------------------------------

insert into letter_templates (
  template_key, language, version, title, body, required_rule_keys,
  legal_review_status
) values
(
  'deposit_claim', 'nl', 1,
  'Ingebrekestelling — vrijgave van de huurwaarborg',
  E'{{sender_name}}\n{{sender_address}}\n\n{{landlord_name}}\n{{landlord_address}}\n\n{{city}}, {{today}}\n\nBetreft: ingebrekestelling — vrijgave van de huurwaarborg voor {{property_address}}\n\nGeachte,\n\nIk was huurder van het pand gelegen te {{property_address}}. De huurovereenkomst ving aan op {{lease_start}} en eindigde op {{lease_end}}. Ik heb de sleutels aan u overhandigd op {{keys_returned_on}}.\n\nDe huurwaarborg bedraagt {{deposit_amount}} EUR.\n\nOvereenkomstig artikel 249 van de Brusselse Huisvestingscode moet de huurwaarborg binnen twee maanden na de teruggave van de sleutels worden vrijgegeven. Die termijn is verstreken op {{deadline_date}}. Tot op vandaag heb ik {{amount_refunded}} EUR ontvangen.\n\n{{#if landlord_claim_reason}}U hebt een inhouding ingeroepen op grond van: {{landlord_claim_reason}}. Ik betwist deze inhouding om de volgende redenen: {{dispute_reasons}}.{{/if}}\n\nIk stel u hierbij in gebreke om het openstaande bedrag van {{amount_claimed}} EUR over te maken op rekeningnummer {{iban}} binnen de veertien dagen na verzending van deze brief.\n\nDezelfde bepaling voorziet in een vergoeding van 10 % van het waarborgbedrag per maand vertraging. Ik behoud mij uitdrukkelijk het recht voor deze vergoeding te vorderen.\n\n{{#if has_report}}Als bijlage vindt u het fotodossier van de plaatsbeschrijving bij intrek en bij vertrek, met de gegevensvingerafdruk (SHA-256) en het tijdstip van registratie van elke foto.{{/if}}\n\nBij gebrek aan gevolg binnen de gestelde termijn zal ik mij wenden tot de bevoegde vrederechter.\n\nMet hoogachting,\n\n{{sender_name}}\n\n---\n{{disclaimer}}',
  array['bxl.deposit.restitution_deadline_months', 'bxl.deposit.late_penalty_pct_per_month'],
  'PLACEHOLDER'
),
(
  'deposit_claim', 'fr', 1,
  'Mise en demeure — libération de la garantie locative',
  E'{{sender_name}}\n{{sender_address}}\n\n{{landlord_name}}\n{{landlord_address}}\n\n{{city}}, le {{today}}\n\nObjet : mise en demeure — libération de la garantie locative pour {{property_address}}\n\nMadame, Monsieur,\n\nJ''étais locataire du bien situé {{property_address}}. Le bail a pris cours le {{lease_start}} et s''est terminé le {{lease_end}}. Je vous ai remis les clés le {{keys_returned_on}}.\n\nLa garantie locative s''élève à {{deposit_amount}} EUR.\n\nConformément à l''article 249 du Code bruxellois du Logement, la garantie locative doit être libérée dans les deux mois de la remise des clés. Ce délai est venu à échéance le {{deadline_date}}. À ce jour, j''ai reçu {{amount_refunded}} EUR.\n\n{{#if landlord_claim_reason}}Vous avez invoqué une retenue au motif suivant : {{landlord_claim_reason}}. Je conteste cette retenue pour les raisons suivantes : {{dispute_reasons}}.{{/if}}\n\nPar la présente, je vous mets en demeure de verser le solde de {{amount_claimed}} EUR sur le compte {{iban}} dans les quatorze jours de l''envoi du présent courrier.\n\nLa même disposition prévoit une indemnité de 10 % du montant de la garantie par mois de retard. Je me réserve expressément le droit de réclamer cette indemnité.\n\n{{#if has_report}}Vous trouverez en annexe le dossier photographique de l''état des lieux d''entrée et de sortie, avec l''empreinte numérique (SHA-256) et l''horodatage d''enregistrement de chaque photo.{{/if}}\n\nÀ défaut de suite dans le délai imparti, je saisirai le juge de paix compétent.\n\nVeuillez agréer mes salutations distinguées,\n\n{{sender_name}}\n\n---\n{{disclaimer}}',
  array['bxl.deposit.restitution_deadline_months', 'bxl.deposit.late_penalty_pct_per_month'],
  'PLACEHOLDER'
),
(
  'indexation_dispute', 'nl', 1,
  'Betwisting van de huurindexatie',
  E'{{sender_name}}\n{{sender_address}}\n\n{{landlord_name}}\n{{landlord_address}}\n\n{{city}}, {{today}}\n\nBetreft: betwisting van de aangerekende huurindexatie voor {{property_address}}\n\nGeachte,\n\nU hebt de huurprijs van het pand {{property_address}} geïndexeerd van {{current_rent}} EUR naar {{claimed_new_rent}} EUR met ingang van {{indexation_date}}.\n\nNa berekening op basis van de wettelijke formule kom ik uit op een bedrag van {{calculated_new_rent}} EUR:\n\n  basishuurprijs {{base_rent}} EUR x (gezondheidsindex {{new_index}} / aanvangsindex {{base_index}}) = {{calculated_new_rent}} EUR\n\n{{#if extra_grounds}}Daarnaast merk ik het volgende op: {{extra_grounds}}{{/if}}\n\nIk verzoek u de huurprijs aan te passen naar {{calculated_new_rent}} EUR en het te veel betaalde bedrag van {{overpaid_amount}} EUR terug te storten op rekeningnummer {{iban}}, binnen de dertig dagen na verzending van deze brief.\n\nMet hoogachting,\n\n{{sender_name}}\n\n---\n{{disclaimer}}',
  array['be.index.formula'],
  'PLACEHOLDER'
),
(
  'indexation_dispute', 'fr', 1,
  'Contestation de l''indexation du loyer',
  E'{{sender_name}}\n{{sender_address}}\n\n{{landlord_name}}\n{{landlord_address}}\n\n{{city}}, le {{today}}\n\nObjet : contestation de l''indexation du loyer appliquée pour {{property_address}}\n\nMadame, Monsieur,\n\nVous avez indexé le loyer du bien {{property_address}} de {{current_rent}} EUR à {{claimed_new_rent}} EUR à partir du {{indexation_date}}.\n\nAprès calcul sur la base de la formule légale, j''obtiens un montant de {{calculated_new_rent}} EUR :\n\n  loyer de base {{base_rent}} EUR x (indice santé {{new_index}} / indice de départ {{base_index}}) = {{calculated_new_rent}} EUR\n\n{{#if extra_grounds}}Je relève en outre ce qui suit : {{extra_grounds}}{{/if}}\n\nJe vous demande d''adapter le loyer à {{calculated_new_rent}} EUR et de rembourser le trop-perçu de {{overpaid_amount}} EUR sur le compte {{iban}}, dans les trente jours de l''envoi du présent courrier.\n\nVeuillez agréer mes salutations distinguées,\n\n{{sender_name}}\n\n---\n{{disclaimer}}',
  array['be.index.formula'],
  'PLACEHOLDER'
),
(
  'defect_notice', 'nl', 1,
  'Melding van een gebrek en verzoek tot herstelling',
  E'{{sender_name}}\n{{sender_address}}\n\n{{landlord_name}}\n{{landlord_address}}\n\n{{city}}, {{today}}\n\nBetreft: melding van een gebrek aan {{property_address}}\n\nGeachte,\n\nIk stel u in kennis van het volgende gebrek aan het gehuurde pand:\n\n{{defect_description}}\n\nIk stelde dit vast op {{defect_noticed_on}}.{{#if previously_reported}} Ik meldde dit eerder op {{previous_report_date}}, zonder gevolg.{{/if}}\n\nIk verzoek u de nodige herstellingen uit te voeren binnen {{deadline_days}} dagen na verzending van deze brief, en mij te laten weten wanneer de werken kunnen plaatsvinden.\n\n{{#if has_photos}}Als bijlage vindt u foto''s van het gebrek, met de gegevensvingerafdruk (SHA-256) en het tijdstip van registratie.{{/if}}\n\nMet hoogachting,\n\n{{sender_name}}\n\n---\n{{disclaimer}}',
  array[]::text[],
  'PLACEHOLDER'
),
(
  'defect_notice', 'fr', 1,
  'Signalement d''un défaut et demande de réparation',
  E'{{sender_name}}\n{{sender_address}}\n\n{{landlord_name}}\n{{landlord_address}}\n\n{{city}}, le {{today}}\n\nObjet : signalement d''un défaut à {{property_address}}\n\nMadame, Monsieur,\n\nJe vous informe du défaut suivant affectant le bien loué :\n\n{{defect_description}}\n\nJe l''ai constaté le {{defect_noticed_on}}.{{#if previously_reported}} Je vous l''avais déjà signalé le {{previous_report_date}}, sans suite.{{/if}}\n\nJe vous demande de faire procéder aux réparations nécessaires dans les {{deadline_days}} jours de l''envoi du présent courrier, et de me faire savoir quand les travaux pourront avoir lieu.\n\n{{#if has_photos}}Vous trouverez en annexe des photos du défaut, avec l''empreinte numérique (SHA-256) et l''horodatage d''enregistrement.{{/if}}\n\nVeuillez agréer mes salutations distinguées,\n\n{{sender_name}}\n\n---\n{{disclaimer}}',
  array[]::text[],
  'PLACEHOLDER'
),
(
  'rent_grid_discussion', 'nl', 1,
  'Verzoek tot gesprek over de huurprijs',
  E'{{sender_name}}\n{{sender_address}}\n\n{{landlord_name}}\n{{landlord_address}}\n\n{{city}}, {{today}}\n\nBetreft: huurprijs van {{property_address}}\n\nGeachte,\n\nDe huidige huurprijs van het pand {{property_address}} bedraagt {{current_rent}} EUR per maand, exclusief lasten.\n\nIk raadpleegde het indicatieve huurrooster van het Brussels Hoofdstedelijk Gewest op {{grid_consulted_on}} via de officiële tool op loyers.brussels. Voor een vergelijkbaar pand geeft die tool een referentiehuurprijs van {{reference_rent}} EUR aan. Het verschil met de huidige huurprijs bedraagt {{difference_amount}} EUR ({{difference_pct}} %).\n\nIk ben mij ervan bewust dat dit rooster indicatief is en geen wettelijk maximum oplegt. Ik zou de huurprijs graag met u bespreken in het licht van deze referentie.\n\nMag ik u vragen mij te laten weten of u openstaat voor een gesprek?\n\nMet hoogachting,\n\n{{sender_name}}\n\n---\n{{disclaimer}}',
  array['bxl.rentgrid.indicative_only', 'bxl.rentgrid.margin_pct'],
  'PLACEHOLDER'
),
(
  'rent_grid_discussion', 'fr', 1,
  'Demande d''entretien au sujet du loyer',
  E'{{sender_name}}\n{{sender_address}}\n\n{{landlord_name}}\n{{landlord_address}}\n\n{{city}}, le {{today}}\n\nObjet : loyer de {{property_address}}\n\nMadame, Monsieur,\n\nLe loyer actuel du bien {{property_address}} s''élève à {{current_rent}} EUR par mois, hors charges.\n\nJ''ai consulté la grille indicative des loyers de la Région de Bruxelles-Capitale le {{grid_consulted_on}} via l''outil officiel sur loyers.brussels. Pour un bien comparable, cet outil indique un loyer de référence de {{reference_rent}} EUR. L''écart avec le loyer actuel est de {{difference_amount}} EUR ({{difference_pct}} %).\n\nJe suis conscient que cette grille est indicative et n''impose pas de maximum légal. Je souhaiterais néanmoins discuter du loyer avec vous à la lumière de cette référence.\n\nPourriez-vous me faire savoir si vous êtes ouvert à un entretien ?\n\nVeuillez agréer mes salutations distinguées,\n\n{{sender_name}}\n\n---\n{{disclaimer}}',
  array['bxl.rentgrid.indicative_only', 'bxl.rentgrid.margin_pct'],
  'PLACEHOLDER'
);

-- ---------------------------------------------------------------------------
-- contract_clause_checks — gecureerde checklist
-- ---------------------------------------------------------------------------

insert into contract_clause_checks (
  check_key, category, label_nl, label_fr,
  explanation_nl, explanation_fr, patterns_nl, patterns_fr, rule_key, severity
) values
(
  'deposit_over_two_months', 'DEPOSIT',
  'Waarborg van meer dan twee maanden huur',
  'Garantie supérieure à deux mois de loyer',
  'Voor Brusselse huurovereenkomsten gesloten of hernieuwd vanaf 1 november 2024 bedraagt de huurwaarborg maximaal twee maanden huur. Een clausule die drie maanden vraagt, verdient nazicht.',
  'Pour les baux bruxellois conclus ou renouvelés à partir du 1er novembre 2024, la garantie locative s''élève à maximum deux mois de loyer. Une clause exigeant trois mois mérite vérification.',
  array['drie maanden huur', 'waarborg van drie', '3 maanden huurwaarborg'],
  array['trois mois de loyer', 'garantie de trois', '3 mois de garantie'],
  'bxl.deposit.max_months', 'CRITICAL'
),
(
  'deposit_cash', 'DEPOSIT',
  'Waarborg in contanten',
  'Garantie en espèces',
  'Een clausule die betaling van de waarborg in cash oplegt, verdient nazicht: de waarborg hoort op een geïndividualiseerde rekening of in een van de andere wettelijke vormen.',
  'Une clause imposant le paiement de la garantie en espèces mérite vérification : la garantie doit être placée sur un compte individualisé ou prendre une des autres formes légales.',
  array['in contanten', 'cash betaald', 'contante betaling van de waarborg'],
  array['en espèces', 'en liquide', 'paiement cash de la garantie'],
  'bxl.deposit.cash_prohibited', 'WARNING'
),
(
  'no_entry_inspection', 'INSPECTION',
  'Afstand van de plaatsbeschrijving',
  'Renonciation à l''état des lieux',
  'Een clausule waarin de huurder afziet van een plaatsbeschrijving bij intrek verdient nazicht: zonder plaatsbeschrijving wordt u vermoed het pand in goede staat te hebben ontvangen.',
  'Une clause par laquelle le locataire renonce à l''état des lieux d''entrée mérite vérification : sans état des lieux, vous êtes présumé avoir reçu le bien en bon état.',
  array['geen plaatsbeschrijving', 'afstand van plaatsbeschrijving', 'zonder plaatsbeschrijving'],
  array['sans état des lieux', 'renonce à l''état des lieux', 'pas d''état des lieux'],
  'be.edl.absence_presumption', 'CRITICAL'
),
(
  'all_repairs_on_tenant', 'REPAIRS',
  'Alle herstellingen ten laste van de huurder',
  'Toutes les réparations à charge du locataire',
  'Een clausule die alle herstellingen, ook de grove herstellingen, bij de huurder legt, verdient nazicht. De verdeling tussen huurders- en eigenaarsherstellingen is wettelijk geregeld.',
  'Une clause mettant toutes les réparations, y compris les grosses réparations, à charge du locataire mérite vérification. La répartition entre réparations locatives et du propriétaire est réglée par la loi.',
  array['alle herstellingen ten laste van de huurder', 'alle herstellingswerken zijn ten laste van de huurder'],
  array['toutes les réparations à charge du locataire', 'toutes réparations sont à charge du preneur'],
  null, 'WARNING'
),
(
  'automatic_indexation', 'INDEXATION',
  'Automatische indexatie zonder verzoek',
  'Indexation automatique sans demande',
  'Een clausule die stelt dat de huurprijs automatisch geïndexeerd wordt zonder dat de verhuurder daarom moet verzoeken, verdient nazicht.',
  'Une clause prévoyant une indexation automatique du loyer sans demande du bailleur mérite vérification.',
  array['automatisch geïndexeerd', 'van rechtswege geïndexeerd', 'indexatie gebeurt automatisch'],
  array['indexé automatiquement', 'indexation de plein droit', 'l''indexation est automatique'],
  'be.index.not_automatic', 'WARNING'
),
(
  'no_sublet_no_reason', 'OTHER',
  'Absoluut verbod op onderverhuur en huuroverdracht',
  'Interdiction absolue de sous-location et de cession',
  'Een absoluut verbod op onderverhuur en huuroverdracht is gebruikelijk, maar de gevolgen ervan zijn ingrijpend. Lees deze clausule aandachtig.',
  'Une interdiction absolue de sous-location et de cession est courante, mais ses conséquences sont importantes. Lisez cette clause attentivement.',
  array['onderverhuring is verboden', 'verbod op onderverhuur'],
  array['sous-location est interdite', 'interdiction de sous-louer'],
  null, 'INFO'
),
(
  'penalty_clause', 'OTHER',
  'Schadebeding of boetebeding',
  'Clause pénale',
  'Een boetebeding legt op voorhand een schadevergoeding vast. Overdreven bedragen kunnen door een rechter gematigd worden. Laat dit nakijken als het bedrag hoog lijkt.',
  'Une clause pénale fixe à l''avance une indemnité. Des montants excessifs peuvent être réduits par un juge. Faites vérifier si le montant paraît élevé.',
  array['schadebeding', 'boetebeding', 'forfaitaire schadevergoeding'],
  array['clause pénale', 'indemnité forfaitaire'],
  null, 'WARNING'
);
