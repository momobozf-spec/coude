# Operationele kosten — indicatie met expliciete aannames

Geen prijzen van leveranciers verzonnen: onderstaande is een rekenmodel. Vul actuele tarieven in vóór beslissingen.

## Aannames pilot
- 1 beheerder, 3–10 klanten, ~5 gepubliceerde kansen/klant/week.
- TED-import 1×/dag: enkele honderden aankondigingen per 90 dagen voor de filter (aantal pas te bevestigen met `npm run ted:sample`).
- AI enkel op documenten van opdrachten die de beheerder relevant vindt: ~10–20 procedures/week.
- Gemiddeld bestek ~40 pagina's ≈ 120.000 tekens ≈ ~30–40k inputtokens; output ~3–5k tokens per extractie.
- Extractie gebeurt één keer per documentset en wordt hergebruikt voor alle klanten.

## Posten
| Post | Formule / bron | Opmerking |
|---|---|---|
| AI-extractie | `(input_tokens × prijs_in + output_tokens × prijs_uit) / 1.000.000` × aantal extracties | Werkelijk verbruik en kosten per run worden geregistreerd (`extraction_run`) zodra `AI_PRICE_*` ingevuld is |
| Hosting app | 1 kleine container/VM (Node) | Tarief eigen provider |
| PostgreSQL | Kleinste beheerde instantie volstaat (<1 GB data in pilot) | Tarief eigen provider |
| Opslag documenten | Bestanden ≤ 20 MB, schatting enkele GB/jaar | Lokaal volume of blob-opslag |
| E-mail | ≤ 10 klanten × ~5 mails/maand | Valt doorgaans binnen instaptarieven van transactionele providers |
| TED API | Gratis, anoniem | Fair-use-limieten respecteren |
| Beheerderstijd | Grootste kostenpost: verificatie + review per kans | Meet tijd per review in de pilot |

## Wat te meten in de pilot
Tokens/kosten per extractie (staat in de app), reviewtijd per kans, aantal relevante kansen per week per klant — en of dat de werkhypothese van €299/maand draagt.
