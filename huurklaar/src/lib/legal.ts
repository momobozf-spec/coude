// Juridische teksten. SJABLOON: laat dit nakijken door een jurist vóór lancering.
// Vul [ADRES] en het contactadres in.
import type { Locale } from "@/lib/i18n";

type Doc = { title: string; updated: string; sections: { h: string; p: string[] }[] };

export const PRIVACY: Record<Locale, Doc> = {
  nl: {
    title: "Privacybeleid",
    updated: "Laatst bijgewerkt: november 2026",
    sections: [
      { h: "Wie zijn wij", p: ["Huurklaar is een dienst van Marhaba Cooperation BV, ondernemingsnummer BE 1037.222.285, [ADRES]. Wij zijn verantwoordelijk voor de verwerking van je persoonsgegevens. Vragen of verzoeken: privacy@huurklaar.be."] },
      { h: "Wat blijft op je eigen toestel", p: ["Je dossiergegevens (inkomen, gezinssituatie, motivatie) en je bijlagen (identiteitskaart, loonfiches, …) worden alleen in je browser bewaard. Ze worden niet naar onze servers gestuurd. De dossier-PDF wordt op je eigen toestel gemaakt. Je wist deze gegevens met de knop 'Wis alles' of door je browsergegevens te wissen."] },
      { h: "Wat wij verwerken", p: [
        "Account: je e-mailadres, om je in te loggen en je aankopen te koppelen (uitvoering van de overeenkomst).",
        "Betalingen: via Stripe. Wij zien je kaart- of rekeninggegevens niet. Wij bewaren een klant-ID, de status van je abonnement en of je Dossier Klaar kocht (uitvoering van de overeenkomst en wettelijke boekhoudplicht).",
        "Advertentie-check: de tekst die je plakt en, als je dat aanvinkt, je netto-inkomen, worden voor de analyse doorgestuurd naar onze AI-verwerker. Wij bewaren de tekst en het resultaat niet; we tellen alleen het aantal checks per account.",
        "Zoekpas: je zoekprofiel (maximale maandlast, gemeenten, slaapkamers, huisdier). Mails die je doorstuurt naar je Huurklaar-adres worden automatisch gelezen; we bewaren alleen de gegevens van de panden (titel, link, gemeente, prijs, slaapkamers) en je kandidaturen met notities. De volledige mail bewaren we niet, behalve een bevestigingsmail van je mailprovider zodat je de code kan aflezen (uitvoering van de overeenkomst).",
        "Statistieken: we meten anoniem welke pagina's bezocht worden en hoeveel mensen een stap zetten (bv. een check of aankoop), zonder cookies en zonder je te volgen over andere sites (gerechtvaardigd belang).",
        "Technische logs: IP-adres en foutmeldingen, maximaal 30 dagen, voor beveiliging en het oplossen van fouten (gerechtvaardigd belang).",
      ] },
      { h: "Verwerkers", p: ["Supabase (database en login), Stripe (betalingen), Anthropic (AI-analyse van advertenties en meldingen), Postmark (ontvangst van doorgestuurde meldingen), Vercel (hosting en anonieme statistieken). Met elke verwerker is een verwerkersovereenkomst afgesloten. Bij doorgifte buiten de EER gelden de standaardcontractbepalingen van de Europese Commissie."] },
      { h: "Bewaartermijnen", p: ["Je account tot je het verwijdert. Facturen en betaalgegevens 7 jaar, zoals de boekhoudwetgeving vraagt. Telgegevens van checks tot je account verwijderd wordt. Matches ouder dan 6 maanden worden automatisch verwijderd."] },
      { h: "Cookies", p: ["We gebruiken alleen functionele cookies: om je ingelogd te houden en je taalkeuze te onthouden. Geen advertentie- of trackingcookies."] },
      { h: "Je rechten", p: ["Je hebt recht op inzage, verbetering, verwijdering, beperking, overdraagbaarheid en bezwaar. Mail naar privacy@huurklaar.be. Je kan ook klacht indienen bij de Gegevensbeschermingsautoriteit (www.gegevensbeschermingsautoriteit.be)."] },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : novembre 2026",
    sections: [
      { h: "Qui sommes-nous", p: ["Huurklaar est un service de Marhaba Cooperation SRL, numéro d'entreprise BE 1037.222.285, [ADRESSE]. Nous sommes responsables du traitement de vos données personnelles. Questions ou demandes : privacy@huurklaar.be."] },
      { h: "Ce qui reste sur votre appareil", p: ["Les données de votre dossier (revenus, situation familiale, motivation) et vos annexes (carte d'identité, fiches de paie, …) sont conservées uniquement dans votre navigateur. Elles ne sont pas envoyées à nos serveurs. Le PDF du dossier est créé sur votre appareil. Vous effacez ces données avec le bouton « Tout effacer » ou en effaçant les données de votre navigateur."] },
      { h: "Ce que nous traitons", p: [
        "Compte : votre adresse e-mail, pour la connexion et le lien avec vos achats (exécution du contrat).",
        "Paiements : via Stripe. Nous ne voyons pas vos données de carte ou de compte. Nous conservons un identifiant client, le statut de votre abonnement et l'achat éventuel de Dossier Prêt (exécution du contrat et obligation comptable légale).",
        "Vérification d'annonce : le texte que vous collez et, si vous cochez la case, votre revenu net, sont transmis à notre sous-traitant IA pour l'analyse. Nous ne conservons ni le texte ni le résultat ; nous comptons seulement le nombre de vérifications par compte.",
        "Pass Recherche : votre profil de recherche (charge mensuelle maximale, communes, chambres, animal). Les e-mails que vous transférez à votre adresse Huurklaar sont lus automatiquement ; nous ne conservons que les données des biens (titre, lien, commune, prix, chambres) et vos candidatures avec notes. Nous ne conservons pas l'e-mail complet, sauf un e-mail de confirmation de votre fournisseur pour que vous puissiez lire le code (exécution du contrat).",
        "Statistiques : nous mesurons de façon anonyme les pages visitées et le nombre de personnes qui franchissent une étape (p. ex. une vérification ou un achat), sans cookies et sans vous suivre sur d'autres sites (intérêt légitime).",
        "Journaux techniques : adresse IP et messages d'erreur, 30 jours maximum, pour la sécurité et la correction d'erreurs (intérêt légitime).",
      ] },
      { h: "Sous-traitants", p: ["Supabase (base de données et connexion), Stripe (paiements), Anthropic (analyse IA des annonces et alertes), Postmark (réception des alertes transférées), Vercel (hébergement et statistiques anonymes). Un contrat de sous-traitance est conclu avec chacun. En cas de transfert hors EEE, les clauses contractuelles types de la Commission européenne s'appliquent."] },
      { h: "Durées de conservation", p: ["Votre compte jusqu'à sa suppression. Factures et données de paiement 7 ans, comme l'exige la législation comptable. Compteurs de vérifications jusqu'à la suppression du compte. Les matches de plus de 6 mois sont supprimés automatiquement."] },
      { h: "Cookies", p: ["Nous utilisons uniquement des cookies fonctionnels : pour vous garder connecté et retenir votre langue. Aucun cookie publicitaire ou de suivi."] },
      { h: "Vos droits", p: ["Vous avez un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition. Écrivez à privacy@huurklaar.be. Vous pouvez aussi introduire une plainte auprès de l'Autorité de protection des données (www.autoriteprotectiondonnees.be)."] },
    ],
  },
};

export const TERMS: Record<Locale, Doc> = {
  nl: {
    title: "Algemene voorwaarden",
    updated: "Laatst bijgewerkt: november 2026",
    sections: [
      { h: "De dienst", p: ["Huurklaar helpt huurders een huurdossier samen te stellen en huuradvertenties te beoordelen. Huurklaar is geen vastgoedmakelaar en geeft geen juridisch advies. Analyses zijn automatisch en kunnen fouten bevatten; controleer belangrijke punten zelf. Huurklaar garandeert niet dat je een woning vindt."] },
      { h: "Prijzen en betaling", p: ["Alle prijzen zijn in euro, inclusief btw. Dossier Klaar is een eenmalige aankoop. De Zoekpas is een maandabonnement dat automatisch verlengt tot je het opzegt. Betalingen verlopen via Stripe."] },
      { h: "Herroepingsrecht", p: ["Huurklaar levert digitale inhoud en diensten die meteen na betaling beginnen. Bij het afrekenen vraag je uitdrukkelijk om meteen te starten en bevestig je dat je daardoor je herroepingsrecht van 14 dagen verliest (art. VI.53, 13° WER)."] },
      { h: "Opzeggen", p: ["Je zegt de Zoekpas op wanneer je wil via je account ('Beheer abonnement'). De Zoekpas blijft actief tot het einde van de betaalde maand. Er is geen terugbetaling van een lopende maand."] },
      { h: "Redelijk gebruik", p: ["Om misbruik te voorkomen geldt een daglimiet op advertentie-checks. Automatisch of commercieel gebruik van de dienst is niet toegelaten."] },
      { h: "Aansprakelijkheid", p: ["Wij doen ons best om de dienst correct en beschikbaar te houden. Behalve bij opzet of zware fout is onze aansprakelijkheid beperkt tot het bedrag dat je de laatste 12 maanden betaalde."] },
      { h: "Recht en geschillen", p: ["Belgisch recht is van toepassing. Je kan bij een geschil ook terecht bij de Consumentenombudsdienst (www.consumentenombudsdienst.be)."] },
    ],
  },
  fr: {
    title: "Conditions générales",
    updated: "Dernière mise à jour : novembre 2026",
    sections: [
      { h: "Le service", p: ["Huurklaar aide les locataires à constituer un dossier de location et à évaluer des annonces. Huurklaar n'est pas un agent immobilier et ne donne pas d'avis juridique. Les analyses sont automatiques et peuvent contenir des erreurs ; vérifiez vous-même les points importants. Huurklaar ne garantit pas que vous trouverez un logement."] },
      { h: "Prix et paiement", p: ["Tous les prix sont en euros, TVA comprise. Dossier Prêt est un achat unique. Le Pass Recherche est un abonnement mensuel renouvelé automatiquement jusqu'à sa résiliation. Les paiements passent par Stripe."] },
      { h: "Droit de rétractation", p: ["Huurklaar fournit des contenus et services numériques qui commencent immédiatement après le paiement. Lors du paiement, vous demandez expressément un démarrage immédiat et confirmez perdre ainsi votre droit de rétractation de 14 jours (art. VI.53, 13° CDE)."] },
      { h: "Résiliation", p: ["Vous résiliez le Pass Recherche quand vous voulez via votre compte (« Gérer l'abonnement »). Il reste actif jusqu'à la fin du mois payé. Le mois en cours n'est pas remboursé."] },
      { h: "Usage raisonnable", p: ["Pour éviter les abus, une limite journalière s'applique aux vérifications d'annonces. L'usage automatisé ou commercial du service n'est pas autorisé."] },
      { h: "Responsabilité", p: ["Nous faisons de notre mieux pour que le service soit correct et disponible. Sauf dol ou faute lourde, notre responsabilité est limitée au montant payé au cours des 12 derniers mois."] },
      { h: "Droit applicable et litiges", p: ["Le droit belge est d'application. En cas de litige, vous pouvez aussi vous adresser au Service de Médiation pour le Consommateur (www.mediationconsommateur.be)."] },
    ],
  },
};
