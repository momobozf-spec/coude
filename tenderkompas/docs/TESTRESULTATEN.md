# Testresultaten (23-10-2026)

Omgeving: Node 22.22, PostgreSQL 16, Vitest 5.0.5. `npm test` = unit + integratie tegen echte testdatabase (incl. echte lokale SMTP-server). `tsc`, `eslint`, `next build`: OK.

## HTTP-isolatiecheck (scripts/security-check.ts, echte browser tegen productiebuild)

**18 geslaagd, 0 gefaald** (2026-10-23T01:34:34.015Z)

| Controle | Resultaat | Detail |
|---|---|---|
| anoniem: document B | OK | verwacht 401 |
| anoniem: kansdetail → login | OK | http://localhost:3000/login |
| A ziet eigen kans | OK | verwacht 200 |
| A: kans van B (geldig id, andere org) | OK | verwacht 404 |
| A: niet-gepubliceerde kans | OK | verwacht 404 |
| A: verzonnen uuid | OK | verwacht 404 |
| A: ongeldig id (injectie) | OK | verwacht 404 |
| A: document van B | OK | verwacht 404 |
| A: digest-export van B | OK | verwacht 404 |
| A: beheer-beoordeling van B | OK | verwacht 404 |
| A: beheer-klantpagina B | OK | verwacht 404 |
| ingetrokken kans niet bij open kansen | OK | open-tab vs. afgesloten-tab |
| geldige kans wel bij open kansen | OK | open-tab |
| vervalste feedback op kans van B geweigerd | OK | http://localhost:3000/portal/kansen/7c5a5c51-85a0-4648-8c33-a3b1bd3bd944?fout=Geen+toegang+tot+deze+kans. |
| vervalst volgen van kans B geweigerd | OK | 0 rijen |
| profiel B niet wijzigbaar via geïnjecteerd organizationId | OK | B=DEMO B A=GEHACKT |
| admin-actie (goedkeuren) door klant met vervalste request | OK | HTTP 409, status nu to_review |
| admin-actie door anonieme request | OK | HTTP 409, status nu to_review |

## Fixtures ≠ live
Alle TED-tests gebruiken herkenbare TESTFIXTURE-antwoorden volgens het officiële schema. Er is nog geen enkele live TED-import geslaagd.

## Vitest (volledige uitvoer)
```
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > gegevensisolatie tussen twee klantorganisaties 481ms
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > alleen goedgekeurde, actuele analyses worden gepubliceerd 269ms
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > gewijzigde deadline leidt tot nieuwe controle; gepubliceerde versie toont dat de wijziging gecontroleerd wordt 277ms
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > ingetrokken of verlopen opdracht verschijnt niet als open kans 294ms
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > onbekende verplichte voorwaarde blijft onbekend in de gepubliceerde klantweergave 275ms
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > percelen behouden eigen voorwaarden en deadlines 256ms
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > onleesbaar document leidt niet tot onterechte zekerheid 319ms
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > opnieuw uitvoeren van een verzendtaak stuurt geen dubbele e-mail 293ms
 ✓ tests/integration/critical-chain.test.ts > kritieke keten > demo- en live gegevens worden niet gemengd 190ms
 ✓ tests/integration/critical-chain.test.ts > TED-import > dubbele import maakt geen dubbele kans; nieuwe publicatie = zelfde procedure 84ms
 ✓ tests/integration/critical-chain.test.ts > TED-import > TED-wijziging zet een gepubliceerde beoordeling opnieuw ter controle 226ms
 ✓ tests/integration/critical-chain.test.ts > TED-import > vooraankondiging en gunning verschijnen niet als open kans 83ms
 ✓ tests/integration/critical-chain.test.ts > TED-import > door TED geweigerd veld wordt weggelaten, opnieuw geprobeerd en zichtbaar gemeld 104ms
 ✓ tests/integration/critical-chain.test.ts > TED-import > mislukte import is zichtbaar en niet hetzelfde als nul nieuwe kansen 71ms
 ✓ tests/integration/critical-chain.test.ts > TED-import > geslaagde incrementele import werkt cursor bij en is herhaalbaar zonder duplicaten 96ms
 ✓ tests/integration/risks.test.ts > goedkeuring vervalt bij bronwijziging > nieuwe voorwaarde na goedkeuring ⇒ goedkeuring ongeldig, publicatie geweigerd, nieuwe versie ter controle 380ms
 ✓ tests/integration/risks.test.ts > goedkeuring vervalt bij bronwijziging > gewijzigde voorwaarde (afgewezen/verwijderd) ⇒ goedkeuring ongeldig 257ms
 ✓ tests/integration/risks.test.ts > goedkeuring vervalt bij bronwijziging > gewijzigde deadline na goedkeuring ⇒ goedkeuring ongeldig 233ms
 ✓ tests/integration/risks.test.ts > e-mail: test ≠ overhandiging aan SMTP ≠ aflevering > echte SMTP-overhandiging: status handed_to_smtp, aflevering 'unknown', herhaling stuurt niets opnieuw 553ms
 ✓ tests/integration/risks.test.ts > e-mail: test ≠ overhandiging aan SMTP ≠ aflevering > door SMTP geweigerde ontvanger ⇒ failed, niet 'verzonden' 364ms
 ✓ tests/integration/risks.test.ts > demodata komt niet automatisch in productie > demo-seed weigert zonder expliciete toestemming en altijd in productie 53ms
 ✓ tests/integration/risks.test.ts > demodata komt niet automatisch in productie > migraties bevatten geen gegevens (geen INSERT) 62ms
 ✓ tests/integration/ai-extraction.test.ts > AI-extractie > valideert bewijs, verzint niets, registreert verbruik en hergebruikt analyse voor meerdere klanten 479ms
 ✓ tests/integration/ai-extraction.test.ts > AI-extractie > ongeldige modeluitvoer wordt niet toegepast en zichtbaar geregistreerd 192ms
 ✓ tests/integration/ai-extraction.test.ts > AI-extractie > zonder API-sleutel geen AI-uitvoer (geen simulatie) 185ms
 ✓ tests/unit/time-ted-ai-net.test.ts > tijd en deadlines > TED datum+tijd met offset ⇒ exact tijdstip; oorspronkelijke waarde blijft bewaard 2ms
 ✓ tests/unit/time-ted-ai-net.test.ts > tijd en deadlines > TED datum zonder tijd ⇒ geen tijdstip geraden 0ms
 ✓ tests/unit/time-ted-ai-net.test.ts > tijd en deadlines > vrije tekst zonder tijdzone ⇒ geen tijdzone geraden 1ms
 ✓ tests/unit/time-ted-ai-net.test.ts > tijd en deadlines > vrije tekst met expliciete Belgische tijd ⇒ correct UTC-tijdstip (wintertijd) 16ms
 ✓ tests/unit/time-ted-ai-net.test.ts > tijd en deadlines > zomertijd wordt correct verwerkt 1ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-mapping > percelen behouden eigen deadlines en waarden (positioneel enkel bij gelijke aantallen) 3ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-mapping > meertalige titel: Nederlands heeft voorrang, oorspronkelijke taal wordt bewaard 1ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-mapping > tijden die niet aligneren met datums ⇒ tijdstip onbekend 0ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-mapping > intrekkings- en schorsingssignalen volgens codelijst change-corrig-justification 1ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-mapping > query bevat land, periode, CPV en aparte FT-clausules 1ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-veldbeheer > herkent door TED geweigerde velden in een 400-antwoord 1ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-client > probeert opnieuw bij 429/5xx en volgt iteratietokens tot een lege pagina 27ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-client > timedOut=true wordt niet als geldige pagina aanvaard 2ms
 ✓ tests/unit/time-ted-ai-net.test.ts > TED-client > 4xx wordt niet herhaald en geeft de fout zichtbaar terug 0ms
 ✓ tests/unit/time-ted-ai-net.test.ts > levensfase > mapt notice-types conservatief 0ms
 ✓ tests/unit/time-ted-ai-net.test.ts > levensfase > wijzigingsbericht verandert de fase niet; gunning wint van oproep; intrekking wint van alles 0ms
 ✓ tests/unit/time-ted-ai-net.test.ts > AI-bewijscontrole > citaat moet letterlijk in het document staan 0ms
 ✓ tests/unit/time-ted-ai-net.test.ts > AI-bewijscontrole > verzonnen waarde of citaat ⇒ evidence_not_found 0ms
 ✓ tests/unit/time-ted-ai-net.test.ts > SSRF-bescherming > weigert privé/gereserveerde adressen en niet-https 4ms
 ✓ tests/unit/time-ted-ai-net.test.ts > SSRF-bescherming > bestandstype wordt op inhoud gecontroleerd, niet op opgegeven type 0ms
 ✓ tests/unit/time-ted-ai-net.test.ts > relevantie-prefilter en publicatiepoort > herkent doelgroeprelevante opdrachten via CPV of termen (NL/FR/EN) 4ms
 ✓ tests/unit/time-ted-ai-net.test.ts > relevantie-prefilter en publicatiepoort > alleen goedgekeurde, actuele beoordelingen zijn publiceerbaar 0ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > onbekende verplichte voorwaarde blijft onbekend en blokkeert 'verder onderzoeken' 6ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > automatische suggestie wordt nooit automatisch toegepast 2ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > individuele certificering wordt niet gesuggereerd voor een eis op bedrijfsniveau 3ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > harde blokkade blijft zichtbaar en bepaalt het advies, ook bij hoge relevantie 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > samenwerking wordt alleen als oplossing genoemd wanneer de bron dat documenteert 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > alle voorwaarden voldaan + relevant ⇒ verder onderzoeken 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > zonder vastgelegde voorwaarden kan nooit 'verder onderzoeken' volgen 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > onleesbaar document leidt niet tot onterechte zekerheid 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > voorwaarden met afgewezen of niet-teruggevonden bewijs tellen niet mee 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > vooraankondiging, gunning, intrekking en verlopen deadline zijn nooit een open kans 2ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > onbekende deadline ⇒ eerst controleren 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > te korte voorbereidingstijd is een harde blokkade 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > raamovereenkomstplafond wordt niet als omzet geïnterpreteerd 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > uitgesloten werkzaamheid is een harde blokkade 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > land van de opdrachtgever telt niet als plaats van uitvoering 1ms
 ✓ tests/unit/engine.test.ts > beoordelingsengine > deadline zonder tijdzone wordt gemeld 16ms
 Test Files  5 passed (5)
      Tests  63 passed (63)
```
