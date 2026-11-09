/**
 * Juridische teksten van Superette: privacyverklaring, gebruiksvoorwaarden en
 * cookieverklaring, in het Nederlands, Frans en Engels.
 *
 * CONCEPT — LATEN NALEZEN DOOR EEN JURIST vóór publicatie. De inhoud volgt wat
 * de software werkelijk doet (zie docs/PRIVACY.md voor het register); waar iets
 * een juridische keuze is, staat het in dat register als open punt.
 *
 * Plaatshouders: {name}, {kbo}, {city}, {email}, {address}. Ze worden ingevuld
 * door `components/legal-document.tsx` met `lib/legal.ts`.
 */
import type { AppLocale } from './format';

export type LegalDocumentId = 'privacy' | 'terms' | 'cookies';

export type LegalBlock = string | { readonly list: readonly string[] };

export interface LegalSection {
  readonly id: string;
  readonly heading: string;
  readonly body: readonly LegalBlock[];
}

export interface LegalDocument {
  readonly title: string;
  readonly draftNotice: string;
  readonly version: string;
  readonly sections: readonly LegalSection[];
}

const VERSION = { nl: 'Concept van 24 oktober 2026', fr: 'Projet du 24 octobre 2026', en: 'Draft of 24 October 2026' } as const;

const DRAFT = {
  nl: 'Concept — laten nalezen door een jurist. Deze tekst is nog niet juridisch goedgekeurd.',
  fr: 'Projet — à faire relire par un juriste. Ce texte n’a pas encore été validé juridiquement.',
  en: 'Draft — to be reviewed by a lawyer. This text has not yet been legally approved.',
} as const;

const privacy: Record<AppLocale, LegalDocument> = {
  nl: {
    title: 'Privacyverklaring',
    draftNotice: DRAFT.nl,
    version: VERSION.nl,
    sections: [
      {
        id: 'who',
        heading: 'Wie is verantwoordelijk?',
        body: [
          'Superette wordt uitgebaat door {name}, ondernemingsnummer {kbo}, gevestigd te {address}. Zij is de verwerkingsverantwoordelijke voor je persoonsgegevens.',
          'Vragen over je gegevens of je rechten: {email}.',
        ],
      },
      {
        id: 'what',
        heading: 'Welke gegevens, waarvoor, op welke grond en hoe lang',
        body: [
          {
            list: [
              'Account en inloggen — e-mailadres, naam, wachtwoord (alleen als Argon2id-hash), taal. Grond: uitvoering van de overeenkomst (AVG art. 6.1.b). Bewaard tot je je account verwijdert.',
              'Sessies — sessie-id, gehashte sessietokens, apparaattype (user-agent), tijdstippen. Grond: overeenkomst en beveiliging (art. 6.1.b en 6.1.f). Gewist 30 dagen na afloop of afmelden.',
              'Akkoord bij registratie — dat je de voorwaarden aanvaardde en of je marketing wilde, met tijdstip, IP-adres en apparaattype. Grond: bewijs van je akkoord (art. 6.1.c en 7.1). Bewaard als bewijs, ook na verwijdering van je account, zonder naam of e-mailadres.',
              'Boodschappenlijsten en voorkeuren — lijsten en regels, gekozen supermarkten, favoriete winkels, klantenkaartbezit, optioneel postcode en gemeente. Grond: overeenkomst (art. 6.1.b). Tot je ze of je account verwijdert.',
              'Prijsalerts en meldingen — gevolgde producten, doelprijzen, gekozen winkels, meldingsgeschiedenis. Grond: overeenkomst (art. 6.1.b). Tot je ze of je account verwijdert.',
              'E-mailmeldingen — je e-mailadres en de inhoud van het overzicht. Grond: toestemming (art. 6.1.a); standaard uit, je zet het zelf aan en uit in je voorkeuren. Hoogstens één overzicht per dag.',
              'Beveiliging en misbruikpreventie — je IP-adres wordt kortstondig in het geheugen gebruikt om het aantal verzoeken te beperken en niet opgeslagen; technische logs bevatten geen wachtwoorden, tokens of e-mailadressen. Grond: gerechtvaardigd belang (art. 6.1.f).',
            ],
          },
          'We versturen geen nieuwsbrief. We gebruiken geen trackingcookies, geen advertentie-ID’s, geen analyse van derden en geen locatie van je toestel.',
        ],
      },
      {
        id: 'alerts',
        heading: 'Prijsalerts',
        body: [
          'Een prijsalert bewaart welk product je volgt, je doelprijs en je winkels. Bij elke prijscontrole vergelijken we die met de beschikbare prijzen; valt een prijs onder je grens, dan zie je een melding in de app, en per e-mail alleen als je dat aanzette. We delen je lijsten, voorkeuren en alerts nooit met supermarkten of andere derden.',
        ],
      },
      {
        id: 'processors',
        heading: 'Wie verwerkt gegevens voor ons?',
        body: [
          {
            list: [
              'Hosting en database: Render (servers in Frankfurt, EU). Render Services, Inc. is een Amerikaanse onderneming; doorgifte gebeurt alleen met passende waarborgen (AVG hoofdstuk V).',
              'E-mail (alleen als je e-mailmeldingen aanzet): een e-mailprovider met een verwerkersovereenkomst.',
            ],
          },
          'Supermarkten krijgen geen gegevens van jou: hun prijzen komen alleen naar ons toe.',
        ],
      },
      {
        id: 'rights',
        heading: 'Je rechten',
        body: [
          {
            list: [
              'Inzage en overdraagbaarheid: download al je gegevens als JSON via Profiel → Jouw gegevens.',
              'Rectificatie: lijsten, voorkeuren en alerts pas je zelf aan; voor je naam of e-mailadres mail je naar {email}.',
              'Wissing: verwijder je account via Profiel → Jouw gegevens. Lijsten, alerts, meldingen, voorkeuren en sessies worden gewist; je account wordt geanonimiseerd.',
              'Toestemming intrekken: zet e-mailmeldingen uit in je voorkeuren. Dat geldt voor de toekomst.',
              'Bezwaar en beperking: mail naar {email}. We antwoorden binnen een maand.',
              'Klacht: bij de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel, www.gegevensbeschermingsautoriteit.be.',
            ],
          },
        ],
      },
      {
        id: 'security',
        heading: 'Beveiliging',
        body: [
          'Wachtwoorden worden gehasht met Argon2id. Sessies lopen via beveiligde HttpOnly-cookies die JavaScript niet kan lezen, met korte levensduur en intrekking op de server. Verkeer verloopt uitsluitend via HTTPS.',
        ],
      },
      {
        id: 'changes',
        heading: 'Wijzigingen',
        body: ['Bij een inhoudelijke wijziging melden we dat in de app en vragen we waar nodig opnieuw je toestemming.'],
      },
    ],
  },
  fr: {
    title: 'Déclaration de confidentialité',
    draftNotice: DRAFT.fr,
    version: VERSION.fr,
    sections: [
      {
        id: 'who',
        heading: 'Qui est responsable ?',
        body: [
          'Superette est exploité par {name}, numéro d’entreprise {kbo}, établie à {address}. Elle est responsable du traitement de vos données personnelles.',
          'Questions sur vos données ou vos droits : {email}.',
        ],
      },
      {
        id: 'what',
        heading: 'Quelles données, pourquoi, sur quelle base et combien de temps',
        body: [
          {
            list: [
              'Compte et connexion — adresse e-mail, nom, mot de passe (uniquement sous forme de hachage Argon2id), langue. Base : exécution du contrat (RGPD art. 6.1.b). Conservé jusqu’à la suppression de votre compte.',
              'Sessions — identifiant de session, jetons hachés, type d’appareil (user-agent), horodatages. Base : contrat et sécurité (art. 6.1.b et 6.1.f). Effacées 30 jours après expiration ou déconnexion.',
              'Accord lors de l’inscription — acceptation des conditions et choix marketing, avec horodatage, adresse IP et type d’appareil. Base : preuve de votre accord (art. 6.1.c et 7.1). Conservé comme preuve, même après la suppression du compte, sans nom ni adresse e-mail.',
              'Listes de courses et préférences — listes et lignes, supermarchés choisis, magasins favoris, cartes de fidélité, code postal et commune (facultatifs). Base : contrat (art. 6.1.b). Jusqu’à leur suppression ou celle du compte.',
              'Alertes de prix et notifications — produits suivis, prix cibles, magasins choisis, historique des notifications. Base : contrat (art. 6.1.b). Jusqu’à leur suppression ou celle du compte.',
              'Notifications par e-mail — votre adresse e-mail et le contenu du récapitulatif. Base : consentement (art. 6.1.a) ; désactivées par défaut, vous les activez et désactivez dans vos préférences. Au maximum un récapitulatif par jour.',
              'Sécurité et prévention des abus — votre adresse IP est utilisée brièvement en mémoire pour limiter le nombre de requêtes et n’est pas enregistrée ; les journaux techniques ne contiennent ni mots de passe, ni jetons, ni adresses e-mail. Base : intérêt légitime (art. 6.1.f).',
            ],
          },
          'Nous n’envoyons pas de newsletter. Nous n’utilisons ni cookies de suivi, ni identifiants publicitaires, ni outils d’analyse tiers, ni la localisation de votre appareil.',
        ],
      },
      {
        id: 'alerts',
        heading: 'Alertes de prix',
        body: [
          'Une alerte enregistre le produit suivi, votre prix cible et vos magasins. À chaque vérification, nous les comparons aux prix disponibles ; si un prix passe sous votre seuil, une notification apparaît dans l’application, et par e-mail uniquement si vous l’avez activé. Nous ne partageons jamais vos listes, préférences ou alertes avec des supermarchés ou d’autres tiers.',
        ],
      },
      {
        id: 'processors',
        heading: 'Qui traite des données pour nous ?',
        body: [
          {
            list: [
              'Hébergement et base de données : Render (serveurs à Francfort, UE). Render Services, Inc. est une société américaine ; tout transfert se fait uniquement avec des garanties appropriées (RGPD chapitre V).',
              'E-mail (uniquement si vous activez les notifications par e-mail) : un prestataire e-mail lié par un contrat de sous-traitance.',
            ],
          },
          'Les supermarchés ne reçoivent aucune donnée vous concernant : seuls leurs prix nous parviennent.',
        ],
      },
      {
        id: 'rights',
        heading: 'Vos droits',
        body: [
          {
            list: [
              'Accès et portabilité : téléchargez toutes vos données en JSON via Profil → Vos données.',
              'Rectification : vous modifiez vous-même listes, préférences et alertes ; pour votre nom ou e-mail, écrivez à {email}.',
              'Effacement : supprimez votre compte via Profil → Vos données. Listes, alertes, notifications, préférences et sessions sont effacées ; votre compte est anonymisé.',
              'Retrait du consentement : désactivez les notifications e-mail dans vos préférences, avec effet pour l’avenir.',
              'Opposition et limitation : écrivez à {email}. Nous répondons dans un délai d’un mois.',
              'Plainte : auprès de l’Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles, www.autoriteprotectiondonnees.be.',
            ],
          },
        ],
      },
      {
        id: 'security',
        heading: 'Sécurité',
        body: [
          'Les mots de passe sont hachés avec Argon2id. Les sessions passent par des cookies HttpOnly sécurisés, illisibles par JavaScript, de courte durée et révocables côté serveur. Les échanges se font exclusivement en HTTPS.',
        ],
      },
      {
        id: 'changes',
        heading: 'Modifications',
        body: ['En cas de modification substantielle, nous vous en informons dans l’application et demandons, si nécessaire, à nouveau votre consentement.'],
      },
    ],
  },
  en: {
    title: 'Privacy statement',
    draftNotice: DRAFT.en,
    version: VERSION.en,
    sections: [
      {
        id: 'who',
        heading: 'Who is responsible?',
        body: [
          'Superette is operated by {name}, company number {kbo}, established at {address}. It is the controller of your personal data.',
          'Questions about your data or your rights: {email}.',
        ],
      },
      {
        id: 'what',
        heading: 'Which data, why, on what basis and for how long',
        body: [
          {
            list: [
              'Account and login — email address, name, password (stored only as an Argon2id hash), language. Basis: performance of the contract (GDPR art. 6.1.b). Kept until you delete your account.',
              'Sessions — session id, hashed session tokens, device type (user agent), timestamps. Basis: contract and security (art. 6.1.b and 6.1.f). Deleted 30 days after expiry or logout.',
              'Agreement at sign-up — that you accepted the terms and your marketing choice, with timestamp, IP address and device type. Basis: proof of your agreement (art. 6.1.c and 7.1). Kept as evidence, also after your account is deleted, without name or email address.',
              'Shopping lists and preferences — lists and items, chosen supermarkets, favourite stores, loyalty cards held, optionally postcode and town. Basis: contract (art. 6.1.b). Until you delete them or your account.',
              'Price alerts and notifications — followed products, target prices, chosen stores, notification history. Basis: contract (art. 6.1.b). Until you delete them or your account.',
              'Email notifications — your email address and the content of the digest. Basis: consent (art. 6.1.a); off by default, you switch it on and off in your preferences. At most one digest per day.',
              'Security and abuse prevention — your IP address is used briefly in memory to limit the number of requests and is not stored; technical logs contain no passwords, tokens or email addresses. Basis: legitimate interest (art. 6.1.f).',
            ],
          },
          'We do not send a newsletter. We use no tracking cookies, no advertising IDs, no third-party analytics and no device location.',
        ],
      },
      {
        id: 'alerts',
        heading: 'Price alerts',
        body: [
          'A price alert stores which product you follow, your target price and your stores. At each price check we compare them with the available prices; when a price drops below your threshold, you get a notification in the app, and by email only if you switched that on. We never share your lists, preferences or alerts with supermarkets or other third parties.',
        ],
      },
      {
        id: 'processors',
        heading: 'Who processes data on our behalf?',
        body: [
          {
            list: [
              'Hosting and database: Render (servers in Frankfurt, EU). Render Services, Inc. is a US company; any transfer takes place only with appropriate safeguards (GDPR chapter V).',
              'Email (only if you switch on email notifications): an email provider bound by a data processing agreement.',
            ],
          },
          'Supermarkets receive no data about you: only their prices come to us.',
        ],
      },
      {
        id: 'rights',
        heading: 'Your rights',
        body: [
          {
            list: [
              'Access and portability: download all your data as JSON via Profile → Your data.',
              'Rectification: you edit lists, preferences and alerts yourself; for your name or email address, write to {email}.',
              'Erasure: delete your account via Profile → Your data. Lists, alerts, notifications, preferences and sessions are erased; your account is anonymised.',
              'Withdrawing consent: switch off email notifications in your preferences, with effect for the future.',
              'Objection and restriction: write to {email}. We reply within one month.',
              'Complaint: to the Belgian Data Protection Authority, Rue de la Presse 35, 1000 Brussels, www.dataprotectionauthority.be.',
            ],
          },
        ],
      },
      {
        id: 'security',
        heading: 'Security',
        body: [
          'Passwords are hashed with Argon2id. Sessions use secure HttpOnly cookies that JavaScript cannot read, with a short lifetime and server-side revocation. Traffic is HTTPS only.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes',
        body: ['When we make a material change, we tell you in the app and ask for your consent again where required.'],
      },
    ],
  },
};

const terms: Record<AppLocale, LegalDocument> = {
  nl: {
    title: 'Gebruiksvoorwaarden',
    draftNotice: DRAFT.nl,
    version: VERSION.nl,
    sections: [
      {
        id: 'who',
        heading: 'Wie we zijn',
        body: ['Superette is een prijsvergelijker voor Belgische supermarkten, uitgebaat door {name}, ondernemingsnummer {kbo}, {address}. Contact: {email}.'],
      },
      {
        id: 'service',
        heading: 'Wat Superette doet',
        body: [
          'Superette verzamelt prijzen en promoties van supermarkten uit publiek toegankelijke bronnen (zoals webpagina’s en folders van de ketens) en toont ze naast elkaar, met eenheidsprijzen, boodschappenlijsten en prijsalerts. De dienst is gratis en vereist geen account om te zoeken; voor lijsten en alerts maak je een account.',
          'Superette is onafhankelijk en heeft geen band met de getoonde supermarkten. Je koopt niets via Superette: de aankoop en de prijs aan de kassa zijn een zaak tussen jou en de winkel.',
        ],
      },
      {
        id: 'prices',
        heading: 'Prijzen zijn indicatief',
        body: [
          'Elke prijs toont zijn bron en het moment waarop hij werd vastgesteld. Prijzen, promoties, voorwaarden en beschikbaarheid kunnen intussen gewijzigd zijn of per winkel verschillen. Prijzen met het label “Niet geverifieerd” komen uit een bron waarvan de voorwaarden nog niet zijn nagekeken. Bindend is altijd de prijs in de winkel. Controleer belangrijke prijzen bij de winkel zelf.',
          'De volgorde van de resultaten volgt de sortering die je kiest (bijvoorbeeld eenheidsprijs of verpakkingsprijs). Supermarkten betalen niet voor een plaats of een betere rangschikking.',
        ],
      },
      {
        id: 'account',
        heading: 'Je account',
        body: [
          'Je geeft correcte gegevens op en houdt je wachtwoord geheim. Eén account per persoon. Je kunt je account op elk moment zelf verwijderen via Profiel → Jouw gegevens.',
        ],
      },
      {
        id: 'use',
        heading: 'Wat niet mag',
        body: [
          {
            list: [
              'de dienst automatisch uitlezen of de gegevens in bulk overnemen;',
              'proberen beveiliging, rate limits of toegangscontroles te omzeilen;',
              'de dienst gebruiken op een manier die anderen of de werking schaadt.',
            ],
          },
          'Bij misbruik kunnen we een account schorsen of verwijderen.',
        ],
      },
      {
        id: 'ip',
        heading: 'Merken en intellectuele eigendom',
        body: [
          'Namen van supermarkten, merken en producten zijn eigendom van hun respectieve houders en worden alleen gebruikt om de producten en winkels te benoemen. Superette toont geen logo’s van de ketens. De software, vormgeving en teksten van Superette zijn eigendom van {name}.',
          'Ben je rechthebbende en heb je een bezwaar tegen hoe we gegevens of namen tonen? Mail naar {email}; we bekijken het snel en verwijderen waar nodig.',
        ],
      },
      {
        id: 'liability',
        heading: 'Aansprakelijkheid',
        body: [
          'We doen ons best om de dienst beschikbaar en de gegevens actueel te houden, maar geven geen garantie op volledigheid, juistheid of ononderbroken beschikbaarheid. Voor zover de wet dat toelaat, zijn we niet aansprakelijk voor schade door een afwijkende prijs of het niet (tijdig) ontvangen van een melding. Dit beperkt niet je wettelijke rechten als consument, noch onze aansprakelijkheid voor opzet of grove fout.',
        ],
      },
      {
        id: 'changes',
        heading: 'Wijzigingen en toepasselijk recht',
        body: [
          'We kunnen deze voorwaarden aanpassen; bij een inhoudelijke wijziging melden we dat vooraf in de app. Op deze voorwaarden is het Belgische recht van toepassing. Bij een geschil zoeken we eerst samen een oplossing; daarna zijn de rechtbanken bevoegd die de wet aanwijst. Klachten kun je ook melden via het Belgische meldpunt van de FOD Economie.',
        ],
      },
    ],
  },
  fr: {
    title: 'Conditions d’utilisation',
    draftNotice: DRAFT.fr,
    version: VERSION.fr,
    sections: [
      {
        id: 'who',
        heading: 'Qui sommes-nous',
        body: ['Superette est un comparateur de prix des supermarchés belges, exploité par {name}, numéro d’entreprise {kbo}, {address}. Contact : {email}.'],
      },
      {
        id: 'service',
        heading: 'Ce que fait Superette',
        body: [
          'Superette collecte les prix et promotions des supermarchés à partir de sources accessibles au public (telles que les pages web et dépliants des enseignes) et les affiche côte à côte, avec prix unitaires, listes de courses et alertes de prix. Le service est gratuit et ne nécessite pas de compte pour chercher ; un compte est nécessaire pour les listes et alertes.',
          'Superette est indépendant et n’a aucun lien avec les supermarchés affichés. Vous n’achetez rien via Superette : l’achat et le prix en caisse relèvent de vous et du magasin.',
        ],
      },
      {
        id: 'prices',
        heading: 'Les prix sont indicatifs',
        body: [
          'Chaque prix indique sa source et le moment où il a été constaté. Prix, promotions, conditions et disponibilité peuvent avoir changé entre-temps ou varier selon le magasin. Les prix marqués « Non vérifié » proviennent d’une source dont les conditions n’ont pas encore été examinées. Seul le prix en magasin fait foi. Vérifiez les prix importants auprès du magasin.',
          'L’ordre des résultats suit le tri que vous choisissez (par exemple prix unitaire ou prix par emballage). Les supermarchés ne paient pas pour une place ou un meilleur classement.',
        ],
      },
      {
        id: 'account',
        heading: 'Votre compte',
        body: ['Vous fournissez des données exactes et gardez votre mot de passe secret. Un compte par personne. Vous pouvez supprimer votre compte à tout moment via Profil → Vos données.'],
      },
      {
        id: 'use',
        heading: 'Ce qui est interdit',
        body: [
          {
            list: [
              'extraire automatiquement le service ou reprendre les données en masse ;',
              'tenter de contourner la sécurité, les limites de requêtes ou les contrôles d’accès ;',
              'utiliser le service d’une manière qui nuit à autrui ou à son fonctionnement.',
            ],
          },
          'En cas d’abus, nous pouvons suspendre ou supprimer un compte.',
        ],
      },
      {
        id: 'ip',
        heading: 'Marques et propriété intellectuelle',
        body: [
          'Les noms des supermarchés, marques et produits appartiennent à leurs titulaires respectifs et ne sont utilisés que pour désigner les produits et magasins. Superette n’affiche pas les logos des enseignes. Le logiciel, la présentation et les textes de Superette appartiennent à {name}.',
          'Vous êtes titulaire de droits et contestez la manière dont nous affichons des données ou des noms ? Écrivez à {email} ; nous examinons rapidement et retirons si nécessaire.',
        ],
      },
      {
        id: 'liability',
        heading: 'Responsabilité',
        body: [
          'Nous faisons de notre mieux pour que le service soit disponible et les données à jour, sans garantie d’exhaustivité, d’exactitude ou de disponibilité ininterrompue. Dans les limites de la loi, nous ne sommes pas responsables d’un dommage dû à un prix différent ou à une notification non reçue (à temps). Ceci ne limite pas vos droits légaux de consommateur, ni notre responsabilité en cas de dol ou de faute grave.',
        ],
      },
      {
        id: 'changes',
        heading: 'Modifications et droit applicable',
        body: [
          'Nous pouvons modifier ces conditions ; en cas de modification substantielle, nous vous en informons au préalable dans l’application. Le droit belge s’applique. En cas de litige, nous cherchons d’abord une solution ensemble ; ensuite, les tribunaux désignés par la loi sont compétents. Vous pouvez aussi signaler une plainte au point de contact du SPF Économie.',
        ],
      },
    ],
  },
  en: {
    title: 'Terms of use',
    draftNotice: DRAFT.en,
    version: VERSION.en,
    sections: [
      {
        id: 'who',
        heading: 'Who we are',
        body: ['Superette is a price comparison service for Belgian supermarkets, operated by {name}, company number {kbo}, {address}. Contact: {email}.'],
      },
      {
        id: 'service',
        heading: 'What Superette does',
        body: [
          'Superette collects supermarket prices and promotions from publicly accessible sources (such as the chains’ web pages and leaflets) and shows them side by side, with unit prices, shopping lists and price alerts. The service is free and needs no account to search; lists and alerts require an account.',
          'Superette is independent and has no affiliation with the supermarkets shown. You do not buy anything through Superette: the purchase and the till price are between you and the store.',
        ],
      },
      {
        id: 'prices',
        heading: 'Prices are indicative',
        body: [
          'Every price shows its source and when it was observed. Prices, promotions, conditions and availability may have changed since, or differ by store. Prices labelled “Unverified” come from a source whose terms have not yet been reviewed. The price in the store is always the one that counts. Check important prices with the store itself.',
          'Results are ordered by the sorting you choose (for example unit price or package price). Supermarkets do not pay for a placement or a better ranking.',
        ],
      },
      {
        id: 'account',
        heading: 'Your account',
        body: ['You provide accurate details and keep your password secret. One account per person. You can delete your account at any time via Profile → Your data.'],
      },
      {
        id: 'use',
        heading: 'What is not allowed',
        body: [
          {
            list: [
              'automatically extracting the service or copying the data in bulk;',
              'trying to bypass security, rate limits or access controls;',
              'using the service in a way that harms others or its operation.',
            ],
          },
          'In case of abuse we may suspend or delete an account.',
        ],
      },
      {
        id: 'ip',
        heading: 'Trademarks and intellectual property',
        body: [
          'Names of supermarkets, brands and products belong to their respective owners and are used only to identify the products and stores. Superette does not show the chains’ logos. The Superette software, design and texts belong to {name}.',
          'Are you a rights holder and do you object to how we show data or names? Write to {email}; we will look into it promptly and remove content where needed.',
        ],
      },
      {
        id: 'liability',
        heading: 'Liability',
        body: [
          'We do our best to keep the service available and the data current, but give no guarantee of completeness, accuracy or uninterrupted availability. To the extent permitted by law, we are not liable for damage caused by a different price or a notification not received (in time). This does not limit your statutory consumer rights, nor our liability for intent or gross negligence.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes and applicable law',
        body: [
          'We may change these terms; for a material change we notify you in the app beforehand. Belgian law applies. In case of a dispute we first look for a solution together; after that, the courts designated by law have jurisdiction. You can also report a complaint to the contact point of the FPS Economy.',
        ],
      },
    ],
  },
};

const cookies: Record<AppLocale, LegalDocument> = {
  nl: {
    title: 'Cookies en lokale opslag',
    draftNotice: DRAFT.nl,
    version: VERSION.nl,
    sections: [
      {
        id: 'summary',
        heading: 'Kort',
        body: ['Superette gebruikt alleen strikt noodzakelijke cookies om je ingelogd te houden, en de lokale opslag van je browser voor je taal, thema en (zonder account) je winkelkeuze. Geen tracking, geen advertenties, geen analyse van derden. Daarom vragen we geen cookietoestemming.'],
      },
      {
        id: 'cookies',
        heading: 'Cookies',
        body: [
          {
            list: [
              'sup_access — houdt je aangemeld; ondertekend token, 15 minuten geldig; HttpOnly, Secure, SameSite=Lax. Alleen als je inlogt.',
              'sup_refresh — vernieuwt je sessie zonder opnieuw in te loggen; tot 30 dagen; HttpOnly, Secure, SameSite=Strict. Verdwijnt bij afmelden.',
            ],
          },
        ],
      },
      {
        id: 'storage',
        heading: 'Lokale opslag (localStorage)',
        body: [
          {
            list: [
              'superette.locale — je gekozen taal.',
              'superette.theme — licht of donker thema.',
              'superette.guest-preferences — je winkelkeuze als je geen account hebt. Blijft op je toestel.',
            ],
          },
          'Je kunt cookies en lokale opslag op elk moment wissen in je browser; je wordt dan afgemeld en de app valt terug op de standaardinstellingen.',
        ],
      },
    ],
  },
  fr: {
    title: 'Cookies et stockage local',
    draftNotice: DRAFT.fr,
    version: VERSION.fr,
    sections: [
      {
        id: 'summary',
        heading: 'En bref',
        body: ['Superette n’utilise que des cookies strictement nécessaires pour vous garder connecté, et le stockage local de votre navigateur pour votre langue, votre thème et (sans compte) votre choix de magasins. Pas de suivi, pas de publicité, pas d’analyse de tiers. C’est pourquoi nous ne demandons pas de consentement aux cookies.'],
      },
      {
        id: 'cookies',
        heading: 'Cookies',
        body: [
          {
            list: [
              'sup_access — vous garde connecté ; jeton signé, valable 15 minutes ; HttpOnly, Secure, SameSite=Lax. Uniquement si vous vous connectez.',
              'sup_refresh — renouvelle votre session sans nouvelle connexion ; jusqu’à 30 jours ; HttpOnly, Secure, SameSite=Strict. Supprimé à la déconnexion.',
            ],
          },
        ],
      },
      {
        id: 'storage',
        heading: 'Stockage local (localStorage)',
        body: [
          {
            list: [
              'superette.locale — la langue choisie.',
              'superette.theme — thème clair ou sombre.',
              'superette.guest-preferences — votre choix de magasins si vous n’avez pas de compte. Reste sur votre appareil.',
            ],
          },
          'Vous pouvez effacer cookies et stockage local à tout moment dans votre navigateur ; vous serez alors déconnecté et l’application reviendra aux réglages par défaut.',
        ],
      },
    ],
  },
  en: {
    title: 'Cookies and local storage',
    draftNotice: DRAFT.en,
    version: VERSION.en,
    sections: [
      {
        id: 'summary',
        heading: 'In short',
        body: ['Superette only uses strictly necessary cookies to keep you logged in, and your browser’s local storage for your language, theme and (without an account) your store choice. No tracking, no advertising, no third-party analytics. That is why we do not ask for cookie consent.'],
      },
      {
        id: 'cookies',
        heading: 'Cookies',
        body: [
          {
            list: [
              'sup_access — keeps you logged in; signed token, valid for 15 minutes; HttpOnly, Secure, SameSite=Lax. Only when you log in.',
              'sup_refresh — renews your session without logging in again; up to 30 days; HttpOnly, Secure, SameSite=Strict. Removed when you log out.',
            ],
          },
        ],
      },
      {
        id: 'storage',
        heading: 'Local storage (localStorage)',
        body: [
          {
            list: [
              'superette.locale — your chosen language.',
              'superette.theme — light or dark theme.',
              'superette.guest-preferences — your store choice when you have no account. Stays on your device.',
            ],
          },
          'You can clear cookies and local storage in your browser at any time; you will then be logged out and the app falls back to its defaults.',
        ],
      },
    ],
  },
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, Record<AppLocale, LegalDocument>> = { privacy, terms, cookies };
