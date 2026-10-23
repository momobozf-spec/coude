# Marhaba — Data & AI Agent Consulting

Nederlandstalige, responsive consultingwebsite van Marhaba Data & AI Agent BV: diensten, interactieve voorbeeldaanpakken, FAQ en een contactformulier. Puur HTML, CSS en JavaScript; geen buildstap, geen npm-dependencies, geen externe requests (lettertypes zitten in `fonts/`).

## Lokaal starten

```powershell
cd marhaba-consulting
npm.cmd run dev      # http://localhost:3015 (PORT aanpasbaar)
npm.cmd run check    # syntaxcontrole van alle scripts
npm.cmd test         # 8 tests (mailto, wettelijke vermeldingen, geen externe requests, CSP)
```

## Configuratie — één bestand: `config.js`

| Sleutel | Standaard | Betekenis |
|---|---|---|
| `contactEmail` | `momobozf@gmail.com` | Ontvanger van het formulier (mailto) en contactlinks. |
| `formEndpoint` | `''` (leeg) | Leeg = formulier opent het e-mailprogramma van de bezoeker met voorgevuld onderwerp en bericht. Ingevuld (bv. `https://formspree.io/f/xxxx`) = formulier POST JSON naar die URL; bij een fout valt het terug op mailto. |
| `legal.address` | `''` — **TODO** | Straat, huisnummer en postcode van de zetel. Zolang leeg toont de site alleen "Zaventem". |

Vul je `formEndpoint` in, voeg dan de origin ook toe aan `connect-src` en `form-action` in `_headers`, en vermeld de formulierdienst als verwerker in `privacy.html` (sectie 4).

## Pagina's

- `index.html` — de site; footer met BV-naam, ondernemingsnummer, Zaventem, e-mail en links.
- `privacy.html` — privacyverklaring (concept, laten nalezen door een jurist).
- `juridisch.html` — wettelijke vermeldingen + gebruiksvoorwaarden website (concept).

## Live zetten (Cloudflare Pages, gratis, EU-vriendelijk)

1. Cloudflare-account → Workers & Pages → Create → Pages → "Upload assets" (of koppel de GitHub-repo met root `marhaba-consulting`, build command leeg, output directory `/`).
2. Upload: `index.html`, `privacy.html`, `juridisch.html`, `styles.css`, `config.js`, `contact.js`, `app.js`, `legal.js`, `favicon.svg`, `_headers` en de map `fonts/`. Niet nodig: `server.mjs`, `test/`, `preview-*.png`, `package.json`.
3. Custom domain koppelen (Pages → Custom domains). HTTPS is automatisch; `_headers` zet CSP, HSTS en andere security-headers.
4. Test: formulier invullen → je mailprogramma opent met een bericht aan `momobozf@gmail.com`.

Netlify werkt identiek (zelfde `_headers`-formaat). De Node-server (`server.mjs`) is alleen voor lokale preview.

## Inhoud

De interactieve voorbeelden tonen mogelijke aanpakken, geen behaalde klantresultaten. Er staan bewust geen cases, referenties of testimonials op de site; voeg alleen echte, met toestemming gebruikte referenties toe.
