/**
 * Alle zichtbare tekst, in beide talen.
 *
 * `satisfies Record<Locale, Record<MessageKey, string>>` zorgt dat het Frans
 * exact dezelfde sleutels heeft als het Nederlands. Vergeet je er één, dan faalt
 * de typecheck — niet de klant.
 */
import type { Locale } from '@superette/contracts';

const nl = {
  'app.name': 'Jamal & Jamila',
  'app.tagline': 'Uw sleutel tot de boetiek',

  'nav.key': 'Mijn sleutel',
  'nav.scan': 'Scannen',
  'nav.basket': 'Mandje',
  'nav.receipts': 'Aankopen',

  'auth.login.title': 'Welkom terug',
  'auth.login.submit': 'Inloggen',
  'auth.login.toRegister': 'Nog geen account? Registreer je',
  'auth.register.title': 'Word lid',
  'auth.register.submit': 'Account aanmaken',
  'auth.register.toLogin': 'Al een account? Log in',
  'auth.email': 'E-mailadres',
  'auth.password': 'Wachtwoord',
  'auth.password.hint': 'Minstens 12 tekens',
  'auth.fullName': 'Volledige naam',
  'auth.phone': 'Telefoon (optioneel)',
  'auth.logout': 'Uitloggen',

  'consent.title': 'Toestemming',
  'consent.intro':
    'Een onbemande winkel kan alleen werken als we weten wie er binnen was. Zonder deze twee toestemmingen gaat de deur niet open.',
  'consent.accessLog': 'Ik ga akkoord dat mijn winkelbezoeken worden gelogd',
  'consent.camera': 'Ik ga akkoord met camerabewaking, gekoppeld aan mijn toegangstijdstip',
  'consent.marketing': 'Stuur me aanbiedingen (optioneel, nooit een voorwaarde voor toegang)',
  'consent.required': 'Verplicht voor toegang',
  'consent.revokeWarning': 'Trek je dit in, dan kun je de winkel niet meer betreden.',

  'store.choose': 'Kies een winkel',
  'store.full': 'Vol',
  'store.closed': 'Gesloten',
  'store.open': 'Open',

  'key.title': 'Mijn sleutel',
  'key.instruction': 'Houd deze code voor de scanner aan de deur',
  // De aftelling loopt naar het *verlopen* van de code, niet naar het moment
  // waarop de app hem stilletjes ververst. Dat tweede getal zegt de klant niets;
  // het eerste zegt hem hoe lang deze code nog werkt.
  'key.refreshIn': 'Verloopt over {seconds}s',
  'key.refreshing': 'Nieuwe sleutel ophalen…',
  'key.expired': 'Sleutel verlopen',
  'key.screenshotWarning': 'Een schermafbeelding werkt niet — de code verandert elke {seconds} seconden.',
  'key.error': 'Sleutel kon niet worden opgehaald',

  'scan.title': 'Scannen',
  'scan.instruction': 'Richt je camera op de streepjescode',
  'scan.manual': 'Of voer de code handmatig in',
  'scan.manual.submit': 'Toevoegen',
  'scan.unsupported': 'Je browser ondersteunt camerascannen niet. Voer de code handmatig in.',
  'scan.denied': 'Geen toegang tot de camera. Sta het toe in je browserinstellingen.',
  'scan.added': '{name} toegevoegd',
  'scan.notInStore': 'Je bent niet in de winkel. Open eerst de deur met je sleutel.',

  'basket.title': 'Mandje',
  'basket.empty': 'Je mandje is nog leeg',
  'basket.subtotal': 'Totaal excl. btw',
  'basket.vat': 'Btw {rate}%',
  'basket.total': 'Te betalen',
  'basket.checkout': 'Afrekenen',
  'basket.remove': 'Verwijderen',

  'checkout.title': 'Betalen',
  'checkout.method': 'Kies je betaalmethode',
  'checkout.pay': '{amount} betalen',
  'checkout.redirecting': 'Je wordt doorgestuurd…',

  'receipts.title': 'Mijn aankopen',
  'receipts.empty': 'Nog geen aankopen',
  'receipts.invoice': 'Factuur {number}',
  'receipts.vatBreakdown': 'Btw-uitsplitsing',
  'receipts.base': 'Maatstaf',
  'receipts.vatAmount': 'Btw',

  'common.loading': 'Even geduld…',
  'common.retry': 'Opnieuw proberen',
  'common.back': 'Terug',
  'common.theme': 'Thema',
  'common.language': 'Taal',
} as const;

export type MessageKey = keyof typeof nl;

const fr: Record<MessageKey, string> = {
  'app.name': 'Jamal & Jamila',
  'app.tagline': 'Votre clé de la boutique',

  'nav.key': 'Ma clé',
  'nav.scan': 'Scanner',
  'nav.basket': 'Panier',
  'nav.receipts': 'Achats',

  'auth.login.title': 'Bon retour',
  'auth.login.submit': 'Se connecter',
  'auth.login.toRegister': 'Pas encore de compte ? Inscrivez-vous',
  'auth.register.title': 'Devenez membre',
  'auth.register.submit': 'Créer un compte',
  'auth.register.toLogin': 'Déjà un compte ? Connectez-vous',
  'auth.email': 'Adresse e-mail',
  'auth.password': 'Mot de passe',
  'auth.password.hint': 'Au moins 12 caractères',
  'auth.fullName': 'Nom complet',
  'auth.phone': 'Téléphone (facultatif)',
  'auth.logout': 'Se déconnecter',

  'consent.title': 'Consentement',
  'consent.intro':
    "Une boutique sans personnel ne peut fonctionner que si nous savons qui est entré. Sans ces deux consentements, la porte ne s'ouvre pas.",
  'consent.accessLog': "J'accepte que mes visites en boutique soient enregistrées",
  'consent.camera': "J'accepte la vidéosurveillance, liée à mon heure d'accès",
  'consent.marketing': "Envoyez-moi vos offres (facultatif, jamais une condition d'accès)",
  'consent.required': "Obligatoire pour l'accès",
  'consent.revokeWarning': "Si vous retirez ce consentement, vous ne pourrez plus entrer dans la boutique.",

  'store.choose': 'Choisissez une boutique',
  'store.full': 'Complet',
  'store.closed': 'Fermé',
  'store.open': 'Ouvert',

  'key.title': 'Ma clé',
  'key.instruction': 'Présentez ce code au scanner de la porte',
  'key.refreshIn': 'Expire dans {seconds} s',
  'key.refreshing': 'Nouvelle clé en cours…',
  'key.expired': 'Clé expirée',
  'key.screenshotWarning': 'Une capture d’écran ne fonctionne pas — le code change toutes les {seconds} secondes.',
  'key.error': "La clé n'a pas pu être obtenue",

  'scan.title': 'Scanner',
  'scan.instruction': 'Dirigez votre caméra vers le code-barres',
  'scan.manual': 'Ou saisissez le code manuellement',
  'scan.manual.submit': 'Ajouter',
  'scan.unsupported': "Votre navigateur ne prend pas en charge le scan par caméra. Saisissez le code manuellement.",
  'scan.denied': "Pas d'accès à la caméra. Autorisez-le dans les paramètres de votre navigateur.",
  'scan.added': '{name} ajouté',
  'scan.notInStore': "Vous n'êtes pas dans la boutique. Ouvrez d'abord la porte avec votre clé.",

  'basket.title': 'Panier',
  'basket.empty': 'Votre panier est encore vide',
  'basket.subtotal': 'Total hors TVA',
  'basket.vat': 'TVA {rate} %',
  'basket.total': 'À payer',
  'basket.checkout': 'Payer',
  'basket.remove': 'Retirer',

  'checkout.title': 'Paiement',
  'checkout.method': 'Choisissez votre moyen de paiement',
  'checkout.pay': 'Payer {amount}',
  'checkout.redirecting': 'Redirection en cours…',

  'receipts.title': 'Mes achats',
  'receipts.empty': "Pas encore d'achats",
  'receipts.invoice': 'Facture {number}',
  'receipts.vatBreakdown': 'Détail TVA',
  'receipts.base': 'Base imposable',
  'receipts.vatAmount': 'TVA',

  'common.loading': 'Un instant…',
  'common.retry': 'Réessayer',
  'common.back': 'Retour',
  'common.theme': 'Thème',
  'common.language': 'Langue',
};

export const messages = { nl, fr } satisfies Record<Locale, Record<MessageKey, string>>;
