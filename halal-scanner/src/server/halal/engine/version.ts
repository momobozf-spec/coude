/**
 * De versie van de beslisregels — één plek, nergens anders.
 *
 * Deze string staat in elke `ProductAnalysis`. Verhoog hem zodra de
 * beslislogica inhoudelijk verandert (een andere drempel, een andere volgorde,
 * een nieuwe regel). Wat er dan gebeurt:
 *
 *  - Bestaande analyses blijven staan, met de versie waaronder ze genomen zijn.
 *    Er wordt niets overschreven en niets vernietigd.
 *  - De cachecontrole (`inputHash` + `engineVersion`) slaat automatisch mis,
 *    dus producten worden bij de eerstvolgende lookup opnieuw geanalyseerd.
 *  - Achteraf is per product te zien onder welke regels een status tot stand
 *    kwam — bij een halal-beoordeling is dat geen luxe maar een vereiste.
 *
 * Het formaat `naam@major` is bewust grof. Een semver-patch suggereert dat een
 * wijziging "klein" is; hier is elke wijziging in de regels betekenisvol.
 */
export const ENGINE_VERSION = "halal-engine@1";

export type EngineVersion = typeof ENGINE_VERSION;
