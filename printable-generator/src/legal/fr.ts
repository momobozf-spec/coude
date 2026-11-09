import type { LegalTexts } from "./types";

// Traduction de la version néerlandaise (nl.ts), qui prévaut en cas de divergence.
export const fr: LegalTexts = {
  privacy: {
    title: "Politique de confidentialité",
    sections: [
      {
        h: "1. Qui est responsable ?",
        p: [
          "Noor Printables est exploité par {NAME}, numéro d'entreprise {CBE}, dont le siège social est situé {ADDRESS} (« nous »). Nous sommes le responsable du traitement des données personnelles traitées via Noor Printables. Contact : {EMAIL}.",
        ],
      },
      {
        h: "2. À qui s'adresse Noor Printables ? (enfants)",
        p: [
          "Noor Printables crée des fiches pour enfants de 4 à 8 ans, mais le service s'adresse aux adultes : parents, tuteurs, enseignants et écoles. Seules les personnes de 18 ans ou plus peuvent créer un compte ; vous le confirmez lors de l'inscription.",
          "Les enfants ne créent pas de compte et nous ne demandons pas de données personnelles d'enfants. En Belgique, les enfants de moins de 13 ans ne peuvent pas consentir eux-mêmes au traitement de leurs données par des services en ligne (art. 8 RGPD et art. 7 de la loi belge du 30 juillet 2018) ; ils utilisent les fiches ou le coloriage numérique uniquement via le compte et sous la surveillance d'un parent, tuteur ou enseignant.",
          "N'indiquez pas de noms ou d'autres données d'enfants dans les champs de texte libre (p. ex. le thème d'une fiche). Si vous pensez qu'un enfant a créé un compte ou saisi des données d'un enfant, contactez-nous : nous les supprimerons.",
          "Les modules optionnels qui pourraient demander des données sur un enfant (p. ex. un prénom et un âge pour un certificat) sont désactivés par défaut. S'ils sont activés plus tard, seul le parent ou tuteur saisit ces données, avec son consentement, limitées au nécessaire, et elles peuvent être supprimées à tout moment.",
        ],
      },
      {
        h: "3. Quelles données traitons-nous ?",
        ul: [
          "Données de compte : nom, adresse e-mail, mot de passe (uniquement sous forme de hachage chiffré) ou — en cas de connexion via Google, Microsoft ou Apple — l'identifiant unique de ce fournisseur et votre photo de profil si elle est transmise.",
          "Données d'utilisation : les fiches que vous créez (type, thème, date) et leur nombre, votre formule, votre code de parrainage et, le cas échéant, qui vous a invité.",
          "Données de paiement : les paiements sont traités par Stripe. Nous ne recevons aucun numéro de carte ou de compte ; nous conservons votre identifiant client Stripe, l'identifiant et le statut de l'abonnement.",
          "Données de facturation des écoles : nom de l'école, personne de contact, e-mail, adresse de facturation et numéro de TVA si vous demandez une facture.",
          "Communication : les e-mails que vous nous envoyez et les e-mails transactionnels que nous vous envoyons (p. ex. bienvenue, confirmation d'upgrade).",
          "Données techniques : adresse IP et journaux techniques chez notre hébergeur, ainsi que les cookies nécessaires pour rester connecté (voir notre politique en matière de cookies).",
          "Uniquement avec votre consentement : données analytiques via Google Analytics (voir politique cookies).",
        ],
      },
      {
        h: "4. Pourquoi et sur quelle base juridique ?",
        ul: [
          "Pour fournir votre compte et le service (générer des fiches, gérer votre abonnement, support) — exécution du contrat (art. 6.1.b RGPD).",
          "Pour traiter les paiements et tenir notre comptabilité — exécution du contrat et obligation légale (art. 6.1.b et 6.1.c RGPD).",
          "Pour sécuriser le service et prévenir les abus (p. ex. limites, prévention de la fraude au parrainage) — notre intérêt légitime (art. 6.1.f RGPD).",
          "Pour analyser et améliorer le site au moyen de cookies analytiques — uniquement avec votre consentement (art. 6.1.a RGPD), que vous pouvez retirer à tout moment.",
          "Nous n'envoyons pas d'e-mails marketing sans votre consentement préalable. Nous ne vendons pas vos données et ne pratiquons ni profilage ni décision automatisée produisant des effets juridiques.",
        ],
      },
      {
        h: "5. Avec qui partageons-nous les données ?",
        p: [
          "Nous faisons appel aux sous-traitants suivants, qui n'utilisent vos données que sur nos instructions : notre hébergeur (p. ex. Vercel) et notre fournisseur de base de données (p. ex. Turso), de préférence dans une région UE ; Stripe Payments Europe Ltd. (Irlande) pour les paiements ; Resend pour l'envoi d'e-mails ; et Google, Microsoft ou Apple uniquement si vous vous connectez via eux. Google Analytics n'est utilisé qu'après votre consentement.",
          "Certaines de ces parties sont établies aux États-Unis ou peuvent y accéder aux données. Ces transferts hors de l'Espace économique européen reposent sur le EU-U.S. Data Privacy Framework (pour les entreprises certifiées) ou sur les clauses contractuelles types de la Commission européenne.",
          "Nous ne communiquons des données aux autorités que si la loi nous y oblige.",
        ],
      },
      {
        h: "6. Combien de temps conservons-nous vos données ?",
        ul: [
          "Données de compte et d'utilisation : aussi longtemps que votre compte existe. Après la suppression de votre compte, nous les effaçons dans les 30 jours, sauf ce que nous devons conserver légalement.",
          "Factures et pièces comptables : pendant le délai légal de conservation des pièces comptables.",
          "Journaux techniques : le moins longtemps possible, en général 30 jours au maximum (selon l'hébergeur).",
          "Votre choix en matière de cookies : jusqu'à ce que vous le modifiiez ou effaciez les données de votre navigateur.",
        ],
      },
      {
        h: "7. Sécurité",
        p: ["Les mots de passe ne sont stockés que sous forme de hachage bcrypt, toutes les connexions passent par HTTPS et l'accès aux fonctions d'administration est limité aux administrateurs disposant d'un compte personnel."],
      },
      {
        h: "8. Vos droits",
        p: [
          "Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation du traitement, de portabilité et d'opposition au traitement fondé sur notre intérêt légitime. Vous pouvez retirer votre consentement à tout moment. Envoyez votre demande à {EMAIL} ; nous répondons dans un délai d'un mois.",
          "Si vous n'êtes pas satisfait, vous pouvez introduire une plainte auprès de l'Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles, contact@apd-gba.be, www.autoriteprotectiondonnees.be.",
        ],
      },
      {
        h: "9. Modifications",
        p: ["Nous pouvons modifier cette politique. La date de la dernière version figure en haut. Nous informons les utilisateurs inscrits des changements importants par e-mail."],
      },
    ],
  },

  terms: {
    title: "Conditions générales d'utilisation",
    sections: [
      {
        h: "1. Qui sommes-nous ?",
        p: [
          "Noor Printables est proposé par {NAME}, numéro d'entreprise et de TVA {CBE}, siège social : {ADDRESS}, e-mail : {EMAIL}.",
          "Les présentes conditions s'appliquent à toute utilisation de Noor Printables et à tout abonnement gratuit ou payant.",
        ],
      },
      {
        h: "2. Compte",
        ul: [
          "Vous devez avoir 18 ans ou plus pour créer un compte. Les enfants n'utilisent le service que sous la surveillance d'un parent, tuteur ou enseignant.",
          "Vous fournissez des informations exactes et gardez votre mot de passe secret. Vous êtes responsable de l'utilisation de votre compte.",
          "Vous pouvez faire supprimer votre compte à tout moment via {EMAIL}.",
        ],
      },
      {
        h: "3. Le service",
        p: [
          "Avec Noor Printables, vous créez des fiches islamiques (coloriages, labyrinthes, mots mêlés) en PDF et pouvez colorier numériquement. La formule gratuite permet un nombre limité de fiches ; Pro et School offrent des fiches illimitées.",
          "Nous faisons de notre mieux pour afficher correctement les textes religieux, les lettres arabes et les traductions. Si vous constatez une erreur, signalez-la-nous afin que nous puissions la corriger.",
          "Nous visons une bonne disponibilité mais ne pouvons garantir un fonctionnement ininterrompu. Nous pouvons modifier ou ajouter des fonctionnalités ; nous annonçons à l'avance les modifications substantielles d'un abonnement payant.",
        ],
      },
      {
        h: "4. Prix, paiement et renouvellement",
        ul: [
          "Les prix actuels figurent sur le site et s'entendent TVA comprise pour les consommateurs. Vous voyez toujours le montant à payer avant de confirmer sur la page de paiement Stripe.",
          "Les abonnements Pro et School sont mensuels ou annuels et se renouvellent automatiquement pour la même durée jusqu'à résiliation.",
          "Vous pouvez résilier à tout moment via votre compte (portail client Stripe). La résiliation prend effet à la fin de la période payée en cours ; aucun remboursement n'est accordé pour cette période, sauf en cas de rétractation (point 5) ou si la loi l'impose.",
          "Nous vous informons d'une modification de prix au moins 30 jours à l'avance. Si vous n'êtes pas d'accord, vous pouvez résilier avant l'application du nouveau prix.",
          "En cas d'échec de paiement, nous maintenons temporairement votre accès ; après plusieurs échecs, votre compte passe à la formule gratuite.",
        ],
      },
      {
        h: "5. Droit de rétractation (consommateurs)",
        p: [
          "En tant que consommateur, vous avez le droit de vous rétracter d'un abonnement payant dans les 14 jours de sa conclusion, sans avoir à donner de motif.",
          "Si vous demandez expressément que le service commence immédiatement (en activant l'abonnement tout de suite), vous payez, en cas de rétractation, un montant proportionnel à ce qui a été fourni jusqu'au moment de la rétractation.",
          "Pour les fiches téléchargées en tant que contenu numérique, le droit de rétractation prend fin dès le début du téléchargement, si vous y avez expressément consenti au préalable et reconnu perdre ainsi votre droit de rétractation (art. VI.53, 13° CDE).",
          "Pour exercer votre droit de rétractation, envoyez une déclaration claire à {EMAIL}, par exemple au moyen de ce formulaire type : « À {NAME}, {ADDRESS}, {EMAIL} : Je vous notifie par la présente ma rétractation du contrat portant sur l'abonnement [Pro/School]. Commandé le : [date]. Nom : [nom]. E-mail du compte : [e-mail]. Date : [date]. » Nous remboursons le montant dû dans les 14 jours par le même moyen de paiement.",
        ],
      },
      {
        h: "6. Utilisation des fiches (licence)",
        ul: [
          "Vous pouvez imprimer les fiches créées avec Noor Printables et les utiliser dans votre famille et — avec un abonnement Pro ou School — dans vos propres classes et cours, même si vous êtes rémunéré pour ces cours.",
          "Avec un abonnement School, l'école peut utiliser les fiches dans ses propres classes.",
          "Interdit : revendre les fiches (numériques ou imprimées) en tant que telles, les diffuser publiquement en ligne ou les proposer dans un service concurrent, et extraire le service de manière automatisée ou massive.",
          "Le logiciel, les dessins et les modèles restent la propriété de {NAME} ou de ses concédants.",
        ],
      },
      {
        h: "7. Usage loyal et abus",
        p: ["Vous n'utilisez pas le service à des fins illicites, ne tentez pas de contourner les limites ou la sécurité et ne créez pas de faux comptes (p. ex. pour obtenir des bonus de parrainage). En cas d'abus, nous pouvons retirer des bonus, limiter l'accès ou mettre fin au compte, après avertissement préalable sauf si cela n'est pas raisonnable."],
      },
      {
        h: "8. Responsabilité",
        p: ["Nous fournissons le service avec le soin nécessaire. Dans la mesure permise par la loi, nous ne sommes pas responsables des dommages indirects (tels que le manque à gagner). Notre responsabilité est en tout cas limitée au montant payé au cours des 12 mois précédant le fait dommageable. Ces limitations ne s'appliquent pas en cas de dol, de faute grave, de décès ou de lésion corporelle, et ne portent pas atteinte à vos droits impératifs de consommateur."],
      },
      {
        h: "9. Plaintes et litiges",
        p: [
          "Pour toute plainte, écrivez à {EMAIL} ; nous répondons dans les 14 jours. Les consommateurs peuvent également s'adresser au Service de Médiation pour le Consommateur (www.mediationconsommateur.be).",
          "Les présentes conditions sont régies par le droit belge. Les litiges sont soumis aux tribunaux compétents ; en tant que consommateur, vous conservez la protection des règles impératives de votre lieu de résidence.",
        ],
      },
      {
        h: "10. Modifications",
        p: ["Nous pouvons modifier ces conditions. Nous annonçons les modifications substantielles au moins 30 jours à l'avance par e-mail ; vous pouvez alors résilier avant leur entrée en vigueur."],
      },
    ],
  },

  cookies: {
    title: "Politique en matière de cookies",
    sections: [
      {
        h: "1. Que sont les cookies ?",
        p: ["Les cookies sont de petits fichiers texte qu'un site web enregistre sur votre appareil. Les techniques similaires, comme le stockage local (localStorage) de votre navigateur, sont également couvertes par cette politique."],
      },
      {
        h: "2. Cookies strictement nécessaires (sans consentement)",
        ul: [
          "authjs.session-token / __Secure-authjs.session-token — vous garde connecté ; jusqu'à 30 jours.",
          "authjs.csrf-token / __Host-authjs.csrf-token — protection contre les requêtes falsifiées ; session.",
          "authjs.callback-url / __Secure-authjs.callback-url — mémorise la page à afficher après connexion ; session.",
          "Stockage local « noor-locale » — votre choix de langue ; jusqu'à effacement.",
          "Stockage local « noor-cookie-consent » — votre choix en matière de cookies ; jusqu'à modification ou effacement.",
        ],
      },
      {
        h: "3. Cookies analytiques (uniquement avec consentement)",
        p: ["Si vous y consentez, nous utilisons Google Analytics (Google Ireland Ltd.) pour mesurer l'utilisation du site, avec adresse IP tronquée. Cookies : _ga et _ga_<ID>, conservés jusqu'à 2 ans. Sans consentement, Google Analytics n'est pas chargé."],
      },
      {
        h: "4. Cookies tiers lors du paiement",
        p: ["Lors du paiement, vous êtes redirigé vers Stripe, qui y place ses propres cookies (notamment pour la prévention de la fraude) selon sa propre politique."],
      },
      {
        h: "5. Gérer votre choix",
        p: ["Vous pouvez modifier votre choix à tout moment via « Paramètres des cookies » en bas de chaque page, ou supprimer les cookies dans les paramètres de votre navigateur. Questions : {EMAIL}."],
      },
    ],
  },

  legal: {
    title: "Mentions légales",
    sections: [
      {
        h: "Exploitant",
        ul: ["{NAME}", "Siège social : {ADDRESS}", "Numéro d'entreprise (BCE) et numéro de TVA : {CBE}", "E-mail : {EMAIL}"],
      },
      {
        h: "Documents",
        p: ["Voir aussi notre politique de confidentialité, nos conditions générales et notre politique en matière de cookies (liens en bas de chaque page)."],
      },
    ],
  },
};
