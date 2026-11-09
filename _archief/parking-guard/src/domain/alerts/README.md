# Pijler 1 — Live Alerts *(nog niet gebouwd)*

Gereserveerde plek voor de crowdsourced scanauto-notificaties.

Wat hier hoort te komen: de pure beslislogica — of een melding betrouwbaar genoeg
is om te versturen, welke gebruikers binnen het relevante gebied vallen, hoe
meldingen ontdubbeld worden, en welke drempels gelden voordat een alert de deur
uit gaat.

Wat hier **niet** hoort: database-toegang, push-providers, HTTP. Die horen in
`src/server/`.

De gedeelde lagen (auth, betalingen, entitlements, storage, mail, jobs) zijn
module-onafhankelijk gebouwd en zijn dus direct bruikbaar. Zie ADR 0001.
