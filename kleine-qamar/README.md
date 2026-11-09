# Kleine Qamar

- `wachtlijst/` — meertalige wachtlijstpagina (NL/FR/AR) met Brevo-formulier (double opt-in). **Deploy-klaar.**
- `app/` — gebouwde testversie van de kinderapp (één HTML-bestand). De broncode ontbreekt; niet publiceren als product zolang de bron niet terug is.

## Wachtlijst

| Bestand | Rol |
|---|---|
| `wachtlijst/index.html` | Landingspagina + formulier |
| `wachtlijst/wachtlijst.js` | Teksten NL/FR/AR, tekeningen, formulierlogica |
| `wachtlijst/config.js` | **Eén configuratieplek**: Brevo-formulier-URL en uitbatergegevens (`legal.address` = TODO) |
| `wachtlijst/privacy.html` | Privacyverklaring NL + FR (volledig) en AR (samenvatting) — concept, laten nalezen |
| `wachtlijst/fonts.css`, `wachtlijst/fonts/` | Lokaal gehoste lettertypes (SIL OFL), geen Google Fonts |
| `wachtlijst/_headers` | CSP/HSTS e.d. voor Cloudflare Pages/Netlify |

```powershell
npm.cmd run check   # syntaxcontrole
npm.cmd test        # 6 tests (privacylinks, uitbater, geen externe fonts, CSP)
```

### Live zetten (Cloudflare Pages)

1. In Brevo: controleer dat het formulier "Kleine Qamar wachtlijst" double opt-in gebruikt, zet **open- en kliktracking uit** voor deze lijst/campagnes (de privacyverklaring belooft dat), en stel een automatisch opruimen van niet-bevestigde contacten na 30 dagen in (of doe het maandelijks manueel).
2. Vul `wachtlijst/config.js` → `legal.address` in.
3. Cloudflare → Workers & Pages → Pages → Upload assets: de **inhoud van de map `wachtlijst/`** (inclusief `_headers` en `fonts/`).
4. Custom domain koppelen; HTTPS is automatisch.
5. Test: inschrijven met een eigen adres, bevestigingsmail openen, controleren dat het contact in de Brevo-lijst staat.
