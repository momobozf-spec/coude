import type { Locale } from "@/lib/locales";

/**
 * E-mail copy lives here rather than in messages/*.json because e-mails are
 * rendered outside a request, where next-intl has no locale context. It is
 * still one central catalogue in four languages — not strings scattered
 * through components.
 */

type WelcomeCopy = {
  subject: string;
  heading: string;
  intro: string;
  body: string;
  cta: string;
  footer: string;
};

type ReminderCopy = {
  subject: string;
  heading: string;
  intro: string;
  body: string;
  /** `{date}` is replaced with the localized charge date. */
  charge: string;
  keep: string;
  cta: string;
  cancel: string;
  footer: string;
};

type LinkMailCopy = {
  subject: string;
  heading: string;
  intro: string;
  body: string;
  cta: string;
  ignore: string;
  footer: string;
};

export const passwordResetCopy: Record<Locale, LinkMailCopy> = {
  nl: {
    subject: "Je herstellink voor Noor Club",
    heading: "Nieuw wachtwoord instellen",
    intro: "Je hebt gevraagd om je wachtwoord te herstellen.",
    body: "Klik op de knop hieronder om een nieuw wachtwoord te kiezen. De link werkt één keer en verloopt over een uur.",
    cta: "Kies een nieuw wachtwoord",
    ignore:
      "Heb jij dit niet aangevraagd? Dan hoef je niets te doen. Je wachtwoord blijft ongewijzigd.",
    footer: "Noor Club — elke maand een Islamitisch leerpakket voor je gezin.",
  },
  en: {
    subject: "Your Noor Club reset link",
    heading: "Set a new password",
    intro: "You asked to reset your password.",
    body: "Use the button below to choose a new password. The link works once and expires in an hour.",
    cta: "Choose a new password",
    ignore:
      "Did you not request this? Then there is nothing to do. Your password stays as it is.",
    footer: "Noor Club — a monthly Islamic learning pack for your family.",
  },
  fr: {
    subject: "Votre lien de réinitialisation Noor Club",
    heading: "Définir un nouveau mot de passe",
    intro: "Vous avez demandé à réinitialiser votre mot de passe.",
    body: "Utilisez le bouton ci-dessous pour choisir un nouveau mot de passe. Le lien fonctionne une fois et expire dans une heure.",
    cta: "Choisir un nouveau mot de passe",
    ignore:
      "Vous n’avez rien demandé ? Il n’y a rien à faire. Votre mot de passe reste inchangé.",
    footer: "Noor Club — chaque mois un pack d’apprentissage islamique pour votre famille.",
  },
  de: {
    subject: "Dein Link zum Zurücksetzen bei Noor Club",
    heading: "Neues Passwort festlegen",
    intro: "Du hast angefragt, dein Passwort zurückzusetzen.",
    body: "Wähle mit der Schaltfläche unten ein neues Passwort. Der Link funktioniert einmal und läuft in einer Stunde ab.",
    cta: "Neues Passwort wählen",
    ignore:
      "Du hast das nicht angefragt? Dann musst du nichts tun. Dein Passwort bleibt unverändert.",
    footer: "Noor Club — jeden Monat ein islamisches Lernpaket für deine Familie.",
  },
};

export const verifyEmailCopy: Record<Locale, LinkMailCopy> = {
  nl: {
    subject: "Bevestig je e-mailadres",
    heading: "Nog één klik",
    intro: "Welkom bij Noor Club.",
    body: "Bevestig je e-mailadres, dan weten we zeker dat we je kunnen bereiken — bijvoorbeeld met de herinnering vóór je eerste jaarbetaling. De link verloopt over 24 uur.",
    cta: "Bevestig mijn e-mailadres",
    ignore: "Heb jij geen account aangemaakt? Dan kun je deze mail weggooien.",
    footer: "Noor Club — elke maand een Islamitisch leerpakket voor je gezin.",
  },
  en: {
    subject: "Confirm your e-mail address",
    heading: "One more click",
    intro: "Welcome to Noor Club.",
    body: "Confirm your e-mail address so we know we can reach you — for instance with the reminder before your first annual payment. The link expires in 24 hours.",
    cta: "Confirm my e-mail address",
    ignore: "Did you not create an account? Then you can discard this e-mail.",
    footer: "Noor Club — a monthly Islamic learning pack for your family.",
  },
  fr: {
    subject: "Confirmez votre adresse e-mail",
    heading: "Encore un clic",
    intro: "Bienvenue chez Noor Club.",
    body: "Confirmez votre adresse e-mail pour que nous soyons sûrs de pouvoir vous joindre — par exemple avec le rappel avant votre premier paiement annuel. Le lien expire dans 24 heures.",
    cta: "Confirmer mon adresse e-mail",
    ignore: "Vous n’avez pas créé de compte ? Vous pouvez ignorer cet e-mail.",
    footer: "Noor Club — chaque mois un pack d’apprentissage islamique pour votre famille.",
  },
  de: {
    subject: "Bestätige deine E-Mail-Adresse",
    heading: "Nur noch ein Klick",
    intro: "Willkommen bei Noor Club.",
    body: "Bestätige deine E-Mail-Adresse, damit wir sicher wissen, dass wir dich erreichen — zum Beispiel mit der Erinnerung vor deiner ersten Jahreszahlung. Der Link läuft in 24 Stunden ab.",
    cta: "E-Mail-Adresse bestätigen",
    ignore: "Du hast kein Konto erstellt? Dann kannst du diese E-Mail wegwerfen.",
    footer: "Noor Club — jeden Monat ein islamisches Lernpaket für deine Familie.",
  },
};

export const accountDeletedCopy: Record<Locale, Omit<LinkMailCopy, "cta" | "ignore">> = {
  nl: {
    subject: "Je Noor Club-account is verwijderd",
    heading: "Account verwijderd",
    intro: "Je account en alle gegevens zijn verwijderd.",
    body: "De profielen van je kinderen, hun voortgang en badges zijn weg. Een lopend abonnement stopt aan het einde van de betaalde periode. Wil je terugkomen, dan maak je gewoon een nieuw account aan.",
    footer: "Noor Club — bedankt dat je er was.",
  },
  en: {
    subject: "Your Noor Club account has been deleted",
    heading: "Account deleted",
    intro: "Your account and all its data have been removed.",
    body: "Your children's profiles, their progress and their badges are gone. A running subscription stops at the end of the paid period. If you ever want to come back, simply create a new account.",
    footer: "Noor Club — thank you for being here.",
  },
  fr: {
    subject: "Votre compte Noor Club a été supprimé",
    heading: "Compte supprimé",
    intro: "Votre compte et toutes ses données ont été supprimés.",
    body: "Les profils de vos enfants, leur progression et leurs badges ont disparu. Un abonnement en cours s’arrête à la fin de la période payée. Si vous souhaitez revenir, créez simplement un nouveau compte.",
    footer: "Noor Club — merci d’avoir été là.",
  },
  de: {
    subject: "Dein Noor-Club-Konto wurde gelöscht",
    heading: "Konto gelöscht",
    intro: "Dein Konto und alle Daten wurden entfernt.",
    body: "Die Profile deiner Kinder, ihr Fortschritt und ihre Abzeichen sind weg. Ein laufendes Abo endet zum Ende des bezahlten Zeitraums. Wenn du zurückkommen möchtest, erstelle einfach ein neues Konto.",
    footer: "Noor Club — danke, dass du da warst.",
  },
};

export const welcomeCopy: Record<Locale, WelcomeCopy> = {
  nl: {
    subject: "Welkom bij Noor Club",
    heading: "Welkom bij Noor Club",
    intro: "Je account staat klaar.",
    body: "Maak een profiel voor je kind aan, open het pakket van deze maand en print de werkbladen. De vijf spellen spelen je kind op de telefoon of tablet.",
    cta: "Open Noor Club",
    footer: "Je kunt op elk moment opzeggen in je account.",
  },
  en: {
    subject: "Welcome to Noor Club",
    heading: "Welcome to Noor Club",
    intro: "Your account is ready.",
    body: "Create a profile for your child, open this month’s pack and print the worksheets. The five games play on a phone or tablet.",
    cta: "Open Noor Club",
    footer: "You can cancel at any time in your account.",
  },
  fr: {
    subject: "Bienvenue chez Noor Club",
    heading: "Bienvenue chez Noor Club",
    intro: "Votre compte est prêt.",
    body: "Créez un profil pour votre enfant, ouvrez le pack du mois et imprimez les fiches. Les cinq jeux fonctionnent sur téléphone ou tablette.",
    cta: "Ouvrir Noor Club",
    footer: "Vous pouvez résilier à tout moment dans votre compte.",
  },
  de: {
    subject: "Willkommen bei Noor Club",
    heading: "Willkommen bei Noor Club",
    intro: "Dein Konto ist bereit.",
    body: "Lege ein Profil für dein Kind an, öffne das Paket dieses Monats und drucke die Arbeitsblätter. Die fünf Spiele laufen auf Handy oder Tablet.",
    cta: "Noor Club öffnen",
    footer: "Du kannst jederzeit in deinem Konto kündigen.",
  },
};

export const reminderCopy: Record<Locale, ReminderCopy> = {
  nl: {
    subject: "Nog 7 dagen: je eerste maand Noor Club loopt af",
    heading: "Je eerste maand loopt bijna af",
    intro: "Dit is een herinnering, geen factuur.",
    body: "Je bent nu 23 dagen lid van Noor Club. Je eerste maand kostte €1.",
    charge: "Op {date} start je jaarabonnement van €79.",
    keep: "Wil je doorgaan? Dan hoef je niets te doen.",
    cta: "Bekijk je account",
    cancel: "Wil je stoppen? Zeg op met één klik in je account, vóór die datum. Dan betaal je alleen de €1.",
    footer: "Noor Club — elke maand een Islamitisch leerpakket voor je gezin.",
  },
  en: {
    subject: "7 days left: your first month of Noor Club is ending",
    heading: "Your first month is almost over",
    intro: "This is a reminder, not an invoice.",
    body: "You have been a Noor Club member for 23 days. Your first month cost €1.",
    charge: "On {date} your €79 annual subscription starts.",
    keep: "Happy to continue? You do not need to do anything.",
    cta: "View your account",
    cancel: "Want to stop? Cancel with one click in your account before that date, and you will only have paid the €1.",
    footer: "Noor Club — a monthly Islamic learning pack for your family.",
  },
  fr: {
    subject: "Plus que 7 jours : votre premier mois Noor Club se termine",
    heading: "Votre premier mois se termine bientôt",
    intro: "Ceci est un rappel, pas une facture.",
    body: "Vous êtes membre de Noor Club depuis 23 jours. Votre premier mois a coûté 1 €.",
    charge: "Le {date}, votre abonnement annuel de 79 € commence.",
    keep: "Vous souhaitez continuer ? Vous n’avez rien à faire.",
    cta: "Voir votre compte",
    cancel: "Vous préférez arrêter ? Résiliez en un clic dans votre compte avant cette date : vous n’aurez payé que le 1 €.",
    footer: "Noor Club — chaque mois un pack d’apprentissage islamique pour votre famille.",
  },
  de: {
    subject: "Noch 7 Tage: dein erster Monat bei Noor Club endet",
    heading: "Dein erster Monat endet bald",
    intro: "Das ist eine Erinnerung, keine Rechnung.",
    body: "Du bist seit 23 Tagen bei Noor Club. Dein erster Monat hat 1 € gekostet.",
    charge: "Am {date} startet dein Jahresabo für 79 €.",
    keep: "Möchtest du weitermachen? Dann musst du nichts tun.",
    cta: "Konto ansehen",
    cancel: "Möchtest du aufhören? Kündige mit einem Klick in deinem Konto vor diesem Datum — dann hast du nur den 1 € bezahlt.",
    footer: "Noor Club — jeden Monat ein islamisches Lernpaket für deine Familie.",
  },
};
