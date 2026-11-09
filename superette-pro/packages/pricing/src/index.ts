/**
 * `@superette/pricing` — zuivere prijslogica voor de supermarktvergelijker.
 *
 * Geen database, geen HTTP, geen Nest. Alleen functies over gehele centen en
 * gehele basiseenheden, zodat elke berekening in de API én in de app exact
 * hetzelfde oplevert en in milliseconden te testen is.
 *
 *   - `money`      — euro ↔ centen, afronding, kortingspercentage
 *   - `units`      — verpakkingseenheden → gram / milliliter / stuk
 *   - `normalize`  — prijs per kg, per liter, per stuk; multipacks
 *   - `promotions` — 1+1, "2 voor €5", -30%, staffels, 2de aan halve prijs
 *   - `deposit`    — statiegeld apart van de productprijs
 */
export * from './money';
export * from './units';
export * from './normalize';
export * from './promotions';
export * from './deposit';
