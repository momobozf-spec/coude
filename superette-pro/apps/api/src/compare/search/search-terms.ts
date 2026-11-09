/**
 * Eenvoudige, deterministische buigingsregel voor zoekwoorden, zodat
 * "gerookte zalm" ook "Zalm Gerookt" vindt en "eieren" ook "eier":
 *  - woorden van 5+ letters op "en" → zonder "en"  (eieren → eier, kippen → kipp)
 *  - woorden van 5+ letters op "e" of "s" → zonder die letter (gerookte → gerookt)
 * Korte woorden ("kaas", "melk", "cola") blijven ongemoeid. Zoeken gebeurt met
 * "bevat", dus de kortere stam vindt zowel "gerookt" als "gerookte".
 * Geen fuzzy-magie: wat gevonden wordt, blijft uitlegbaar.
 */
export function searchStem(token: string): string {
  if (token.length < 5) return token;
  if (token.endsWith('en')) return token.slice(0, -2);
  if (token.endsWith('e') || token.endsWith('s')) return token.slice(0, -1);
  return token;
}
