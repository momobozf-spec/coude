# Lokaal testen

Dubbelklik **`start-lokaal.cmd`** in de coude-map. Die start:

| Wat | Adres |
|---|---|
| Startpagina met alle projecten | http://localhost:4000 |
| Ritna (API + webversie) | http://localhost:4100 |
| TenderKompas IT | http://localhost:4200 |
| KetelCheck (formulier + beheer/mailbox) | http://localhost:4300 · /beheer |
| Overnamemarkt (enkel met `overnamemarkt/.env.local`) | http://localhost:4400 |

- Database: echte PostgreSQL via `embedded-postgres`, zonder installatie of adminrechten. Gegevens in `lokaal/.pgdata` (niet in git).
- De eerste start installeert pakketten per project (`npm ci`) en duurt enkele minuten.
- Stoppen: venster sluiten of Ctrl+C.
- Alle wachtwoorden en sleutels hier zijn **lokale demowaarden**, nooit voor productie.
