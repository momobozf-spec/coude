/**
 * De naad waarlangs itsme later inschuift.
 *
 * Vandaag draait er één implementatie: `LocalIdentityProvider` (e-mail +
 * wachtwoord). Die levert `identityVerified: false` en `ageVerified: false`,
 * want een wegwerpmailadres bewijst niets over wie er om 3u 's nachts voor de
 * deur staat.
 *
 * Zodra je een itsme merchant-contract hebt, komt daar een `ItsmeIdentityProvider`
 * naast die de OIDC Authorization Code + PKCE flow afhandelt en `identityVerified`
 * en `ageVerified` op `true` zet. De gate-service leest die vlaggen al — zie
 * `GateService.assertEligible` en `Store.requiresVerifiedIdentity`. Er hoeft dan
 * geen enkele bestaande regel te wijzigen, alleen een provider bij te komen.
 */

/** Nest injection token. */
export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export type IdentityProviderName = 'LOCAL' | 'ITSME';

/** Wat een geslaagde authenticatie ons over de persoon vertelt. */
export interface VerifiedIdentity {
  readonly provider: IdentityProviderName;
  /** De `sub` van een externe IdP. `null` bij lokale accounts. */
  readonly externalSubject: string | null;
  readonly email: string;
  /**
   * Is dit een sterk geverifieerde identiteit (eID-niveau)?
   *
   * Alleen `true` bij een IdP die de persoon aan een officieel document koppelt.
   * Winkels met `requiresVerifiedIdentity` weigeren iedereen waarvoor dit `false` is.
   */
  readonly identityVerified: boolean;
  /** Is de meerderjarigheid bevestigd door de IdP? */
  readonly ageVerified: boolean;
}

export interface IdentityProvider {
  readonly name: IdentityProviderName;

  /**
   * Controleert de aangeleverde credentials.
   *
   * Geeft `null` bij een mislukte poging — zonder onderscheid tussen
   * "gebruiker bestaat niet" en "wachtwoord fout". Dat onderscheid is een
   * gratis gebruikersopsomming voor een aanvaller.
   */
  authenticate(credentials: { email: string; password: string }): Promise<VerifiedIdentity | null>;
}
