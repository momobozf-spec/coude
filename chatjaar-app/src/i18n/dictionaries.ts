import type { AwardId } from "@/lib/stats";
import { brandDeep } from "@/lib/brand";

export const LOCALES = ["nl", "fr", "en", "de", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "nl";

/** BCP 47 tag per locale, used for number/date formatting and hreflang. */
export const LOCALE_TAG: Record<Locale, string> = { nl: "nl-BE", fr: "fr-BE", en: "en-GB", de: "de-DE", es: "es-ES" };

/** Fallback for visitors whose browser language we don't support. */
export const FALLBACK_LOCALE: Locale = "en";

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

type AwardCopy = { title: string; line: string };

export interface Dict {
  meta: { title: string; description: string };
  nav: { start: string; privacy: string; terms: string; imprint: string; language: string };
  hero: { title: string; lead: string; cta: string; note: string };
  demo: { group: string; lines: Array<[string, string]>; slideLabel: string; slideValue: string; slideCaption: string };
  how: { title: string; steps: Array<{ title: string; text: string }> };
  privacyBlock: { title: string; points: string[] };
  pricing: { title: string; price: string; free: string; paid: string; features: string[]; cta: string };
  faq: { title: string; items: Array<{ q: string; a: string }> };
  footer: { operator: string; trademark: string };
  upload: {
    title: string;
    lead: string;
    iosTitle: string;
    iosSteps: string[];
    androidTitle: string;
    androidSteps: string[];
    drop: string;
    choose: string;
    busy: string;
    localNote: string;
    errors: Record<"empty" | "no_messages" | "no_txt_in_zip" | "too_large" | "few_messages" | "generic", string>;
  };
  teaser: {
    ready: string;
    unlockTitle: string;
    unlockLead: string;
    lockedCount: (n: number) => string;
    consent: string;
    pay: string;
    paying: string;
    again: string;
    payError: string;
  };
  result: {
    checking: string;
    notPaid: string;
    reupload: string;
    reuploadLead: string;
    canceled: string;
    download: string;
    downloadAll: string;
    share: string;
    aiLoading: string;
    aiError: string;
    aiRetry: string;
    newChat: string;
    thanks: string;
  };
  slides: {
    year: (year: number) => string;
    totalMessages: string;
    totalLine: (words: string) => string;
    busiestDay: string;
    busiestDayLine: (count: string) => string;
    topSender: string;
    topSenderLine: (share: string) => string;
    peakHour: string;
    peakHourLine: (hour: string) => string;
    streak: string;
    streakLine: (start: string, end: string) => string;
    activeDays: (n: string) => string;
    emojis: string;
    words: string;
    duo: string;
    duoLine: (count: string) => string;
    ranking: string;
    messagesShort: string;
    personality: string;
    moments: string;
    roast: string;
    prediction: string;
    motto: string;
    outro: string;
    outroLine: string;
    months: string[];
    awards: Record<AwardId, AwardCopy>;
  };
  legal: {
    privacyTitle: string;
    termsTitle: string;
    imprintTitle: string;
    lastUpdated: string;
  };
}

const nlMonths = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const frMonths = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const nl: Dict = {
  meta: {
    title: "Chatjaar — het jaaroverzicht van je groepschat",
    description: "Upload je WhatsApp-groep en krijg het jaaroverzicht: wie het meest stuurt, wie ghost, de grappigste momenten en een roast per lid. Je chat blijft op je toestel.",
  },
  nav: { start: "Maak je Chatjaar", privacy: "Privacy", terms: "Voorwaarden", imprint: "Colofon", language: "Taal" },
  hero: {
    title: "Wie heeft jullie groepschat dit jaar echt gedragen?",
    lead: "Upload de export van je WhatsApp-groep. Je krijgt een jaaroverzicht om te delen: prijzen, records, de grappigste momenten en een roast voor iedereen.",
    cta: "Maak je Chatjaar",
    note: "De eerste slides zijn gratis. Je chat wordt op je eigen toestel gelezen.",
  },
  demo: {
    group: "Zondagvoetbal ⚽",
    lines: [
      ["Yassine", "wie neemt de ballen mee"],
      ["Tom", "ik niet, ik heb vorige keer"],
      ["Yassine", "jullie zijn allemaal kapot"],
      ["Bram", "😂😂"],
    ],
    slideLabel: "Spammer van het jaar",
    slideValue: "4.812",
    slideCaption: "38% van alle berichten kwam van deze persoon.",
  },
  how: {
    title: "Zo werkt het",
    steps: [
      { title: "Exporteer je groep", text: "In WhatsApp: open de groep, kies Chat exporteren en dan Zonder media." },
      { title: "Upload het bestand", text: "Je toestel leest de chat en telt alles. Er wordt niets opgeslagen." },
      { title: "Deel je Chatjaar", text: "Swipe door de slides en post de kaartjes terug in de groep." },
    ],
  },
  privacyBlock: {
    title: "Je chat blijft van jou",
    points: [
      "Je chat wordt in je browser gelezen en geteld. Het bestand gaat niet naar onze server.",
      "Voor de AI-slides sturen we enkel een selectie berichten, met namen, nummers, links en e-mailadressen vervangen.",
      "We bewaren niets. Sluit je het venster, dan is alles weg.",
    ],
  },
  pricing: {
    title: "Wat kost het?",
    price: "€7,99",
    free: "Gratis: de eerste drie slides.",
    paid: "Eenmalig, per groep:",
    features: [
      "Alle prijzen: spammer, ghost, nachtuil, snelste reageerder en meer",
      "Records: drukste dag, langste reeks, uur van de waarheid",
      "AI: de grappigste momenten, een roast per lid en jullie voorspelling voor volgend jaar",
      "Kaartjes in hoge resolutie om te delen",
    ],
    cta: "Probeer gratis",
  },
  faq: {
    title: "Vragen",
    items: [
      { q: "Werkt het met iPhone en Android?", a: "Ja. Chatjaar leest de exports van beide, in het Nederlands, Frans, Engels, Duits en Spaans." },
      { q: "Moet iedereen in de groep iets doen?", a: "Nee. Eén persoon exporteert de chat en maakt het overzicht voor de hele groep." },
      { q: "Welke periode telt mee?", a: "Het kalenderjaar van het laatste bericht in je export. Exporteer je nu, dan krijg je dit jaar." },
      { q: "Kan ik mijn geld terugkrijgen?", a: "Je krijgt het overzicht meteen na betaling. Werkt er iets niet, mail ons en we lossen het op of betalen terug." },
      { q: "Werkt het ook voor een gesprek met één persoon?", a: "Ja, al zijn de groepsprijzen dan minder spannend." },
    ],
  },
  footer: { operator: "Chatjaar is een dienst van Marhaba Cooperation BV.", trademark: "WhatsApp is een merk van WhatsApp LLC. Chatjaar is niet verbonden aan WhatsApp of Meta." },
  upload: {
    title: "Upload je groepschat",
    lead: "Exporteer de groep eerst uit WhatsApp. Kies altijd Zonder media: dat gaat sneller en is alles wat we nodig hebben.",
    iosTitle: "iPhone",
    iosSteps: ["Open de groep en tik op de groepsnaam bovenaan.", "Scrol naar onderen en tik op Chat exporteren.", "Kies Zonder media en bewaar het bestand in Bestanden."],
    androidTitle: "Android",
    androidSteps: ["Open de groep en tik op ⋮ rechtsboven.", "Kies Meer en dan Chat exporteren.", "Kies Zonder media en bewaar het bestand."],
    drop: "Sleep je .zip- of .txt-bestand hierheen",
    choose: "Kies bestand",
    busy: "Je chat wordt gelezen…",
    localNote: "Dit gebeurt op je toestel. Het bestand wordt niet geüpload.",
    errors: {
      empty: "Dit bestand is leeg. Exporteer de chat opnieuw en probeer nog eens.",
      no_messages: "In dit bestand staan geen WhatsApp-berichten. Kies het .txt- of .zip-bestand dat WhatsApp maakte.",
      no_txt_in_zip: "In deze .zip zit geen chat. Kies het .zip-bestand dat WhatsApp maakte bij Chat exporteren.",
      too_large: "Dit bestand is groter dan 80 MB. Exporteer de chat opnieuw met Zonder media.",
      few_messages: "Deze chat heeft te weinig berichten dit jaar voor een overzicht. Kies een actievere groep.",
      generic: "Dit bestand kon niet gelezen worden. Exporteer de chat opnieuw met Zonder media.",
    },
  },
  teaser: {
    ready: "Je Chatjaar is klaar",
    unlockTitle: "Ontgrendel de rest",
    unlockLead: "Alle prijzen, records en de AI-slides met de grappigste momenten en een roast per lid.",
    lockedCount: (n) => `Nog ${n} slides plus de AI-slides staan klaar.`,
    consent: "Ik wil het overzicht meteen ontvangen en weet dat ik daardoor geen herroepingsrecht meer heb.",
    pay: "Betaal €7,99 en ontgrendel",
    paying: "Je wordt doorgestuurd naar de betaling…",
    again: "Andere chat kiezen",
    payError: "De betaalpagina kon niet geopend worden. Probeer het opnieuw.",
  },
  result: {
    checking: "Je betaling wordt gecontroleerd…",
    notPaid: "We vinden geen geslaagde betaling voor deze link. Ben je net betaald, herlaad de pagina dan binnen een minuut.",
    reupload: "Kies je chat opnieuw",
    reuploadLead: "Je betaling is gelukt. Omdat we je chat niet bewaren, kies je het bestand nog één keer op dit toestel.",
    canceled: "De betaling werd afgebroken. Je kan het opnieuw proberen.",
    download: "Download",
    downloadAll: "Download alle kaartjes",
    share: "Deel",
    aiLoading: "De AI leest jullie beste momenten…",
    aiError: "De AI-slides konden niet gemaakt worden.",
    aiRetry: "Opnieuw proberen",
    newChat: "Nog een groep doen",
    thanks: "Bedankt! Hier is jullie volledige Chatjaar.",
  },
  slides: {
    year: (y) => `Chatjaar ${y}`,
    totalMessages: "berichten dit jaar",
    totalLine: (w) => `Samen goed voor ${w} woorden.`,
    busiestDay: "Drukste dag",
    busiestDayLine: (c) => `${c} berichten op één dag. Wat was daar aan de hand?`,
    topSender: "Spammer van het jaar",
    topSenderLine: (s) => `${s} van alle berichten kwam van deze persoon.`,
    peakHour: "Uur van de waarheid",
    peakHourLine: (h) => `Rond ${h} ontploft de groep.`,
    streak: "Langste reeks",
    streakLine: (s, e) => `Elke dag iets gestuurd, van ${s} tot ${e}.`,
    activeDays: (n) => `${n} dagen actief`,
    emojis: "Emoji's van het jaar",
    words: "Woorden van het jaar",
    duo: "Duo van het jaar",
    duoLine: (c) => `${c} keer reageerden ze binnen een kwartier op elkaar.`,
    ranking: "De ranglijst",
    messagesShort: "berichten",
    personality: "Jullie groep is…",
    moments: "Moment van het jaar",
    roast: "De roast",
    prediction: "Voorspelling voor volgend jaar",
    motto: "Jullie motto",
    outro: "Tot volgend jaar",
    outroLine: "Gemaakt met chatjaar",
    months: nlMonths,
    awards: {
      spammer: { title: "Spammer van het jaar", line: "{value} berichten. Dat is {share} van de groep." },
      ghost: { title: "Ghost van het jaar", line: "Slechts {value} berichten. Leeft die nog?" },
      nightOwl: { title: "Nachtuil", line: "{value} berichten tussen middernacht en 5 uur." },
      voiceKing: { title: "Koning(in) van de voice notes", line: "{value} spraakberichten. Een podcast was goedkoper." },
      fastest: { title: "Snelste reageerder", line: "Reageert gemiddeld binnen {value} minuten." },
      starter: { title: "Gesprekstarter", line: "Bracht de groep {value} keer weer tot leven." },
      novelist: { title: "Romanschrijver", line: "Gemiddeld {value} woorden per bericht." },
      questioner: { title: "Vraagbaak", line: "{value} berichten met een vraagteken." },
      laugher: { title: "Lacher van het jaar", line: "{value} keer gelachen. Makkelijk publiek." },
      stickers: { title: "Stickerkoning(in)", line: "{value} stickers. Woorden zijn overrated." },
      deleter: { title: "Wisser van het jaar", line: "{value} berichten verwijderd. Wat stond daar?" },
    },
  },
  legal: { privacyTitle: "Privacyverklaring", termsTitle: "Algemene voorwaarden", imprintTitle: "Colofon", lastUpdated: "Laatst bijgewerkt" },
};

const fr: Dict = {
  meta: {
    title: "Chatjaar — le bilan de l'année de ton groupe",
    description: "Importe ton groupe WhatsApp et reçois le bilan de l'année : qui écrit le plus, qui disparaît, les meilleurs moments et un roast pour chacun. Ta discussion reste sur ton appareil.",
  },
  nav: { start: "Crée ton Chatjaar", privacy: "Confidentialité", terms: "Conditions", imprint: "Mentions légales", language: "Langue" },
  hero: {
    title: "Qui a vraiment porté votre groupe cette année ?",
    lead: "Importe l'export de ton groupe WhatsApp. Tu reçois un bilan à partager : prix, records, les meilleurs moments et un roast pour chacun.",
    cta: "Crée ton Chatjaar",
    note: "Les premières slides sont gratuites. Ta discussion est lue sur ton propre appareil.",
  },
  demo: {
    group: "Foot du dimanche ⚽",
    lines: [
      ["Yassine", "qui ramène les ballons"],
      ["Tom", "pas moi, je l'ai fait la dernière fois"],
      ["Yassine", "vous êtes tous nuls"],
      ["Bram", "😂😂"],
    ],
    slideLabel: "Spammeur de l'année",
    slideValue: "4 812",
    slideCaption: "38 % de tous les messages viennent de cette personne.",
  },
  how: {
    title: "Comment ça marche",
    steps: [
      { title: "Exporte ton groupe", text: "Dans WhatsApp : ouvre le groupe, choisis Exporter la discussion puis Sans médias." },
      { title: "Importe le fichier", text: "Ton appareil lit la discussion et compte tout. Rien n'est enregistré." },
      { title: "Partage ton Chatjaar", text: "Fais défiler les slides et poste les cartes dans le groupe." },
    ],
  },
  privacyBlock: {
    title: "Ta discussion reste à toi",
    points: [
      "Ta discussion est lue et comptée dans ton navigateur. Le fichier ne va pas sur notre serveur.",
      "Pour les slides IA, nous envoyons seulement une sélection de messages, avec les noms, numéros, liens et e-mails remplacés.",
      "Nous ne gardons rien. Ferme la fenêtre et tout disparaît.",
    ],
  },
  pricing: {
    title: "Combien ça coûte ?",
    price: "7,99 €",
    free: "Gratuit : les trois premières slides.",
    paid: "Une fois, par groupe :",
    features: [
      "Tous les prix : spammeur, fantôme, oiseau de nuit, réponse la plus rapide et plus",
      "Records : jour le plus actif, plus longue série, heure de pointe",
      "IA : les meilleurs moments, un roast pour chacun et votre prédiction pour l'an prochain",
      "Cartes en haute résolution à partager",
    ],
    cta: "Essaie gratuitement",
  },
  faq: {
    title: "Questions",
    items: [
      { q: "Ça marche avec iPhone et Android ?", a: "Oui. Chatjaar lit les exports des deux, en français, néerlandais, anglais, allemand et espagnol." },
      { q: "Tout le groupe doit faire quelque chose ?", a: "Non. Une seule personne exporte la discussion et crée le bilan pour tout le groupe." },
      { q: "Quelle période est prise en compte ?", a: "L'année civile du dernier message de ton export. Si tu exportes maintenant, tu reçois cette année." },
      { q: "Puis-je être remboursé ?", a: "Tu reçois le bilan juste après le paiement. Si quelque chose ne marche pas, écris-nous et nous réglons le problème ou te remboursons." },
      { q: "Ça marche pour une discussion à deux ?", a: "Oui, même si les prix de groupe sont alors moins palpitants." },
    ],
  },
  footer: { operator: "Chatjaar est un service de Marhaba Cooperation BV.", trademark: "WhatsApp est une marque de WhatsApp LLC. Chatjaar n'est pas lié à WhatsApp ni à Meta." },
  upload: {
    title: "Importe ta discussion de groupe",
    lead: "Exporte d'abord le groupe depuis WhatsApp. Choisis toujours Sans médias : c'est plus rapide et c'est tout ce qu'il nous faut.",
    iosTitle: "iPhone",
    iosSteps: ["Ouvre le groupe et touche le nom du groupe en haut.", "Descends et touche Exporter la discussion.", "Choisis Sans médias et enregistre le fichier dans Fichiers."],
    androidTitle: "Android",
    androidSteps: ["Ouvre le groupe et touche ⋮ en haut à droite.", "Choisis Plus puis Exporter la discussion.", "Choisis Sans médias et enregistre le fichier."],
    drop: "Glisse ton fichier .zip ou .txt ici",
    choose: "Choisir un fichier",
    busy: "Lecture de ta discussion…",
    localNote: "Cela se passe sur ton appareil. Le fichier n'est pas envoyé.",
    errors: {
      empty: "Ce fichier est vide. Exporte la discussion à nouveau et réessaie.",
      no_messages: "Ce fichier ne contient pas de messages WhatsApp. Choisis le fichier .txt ou .zip créé par WhatsApp.",
      no_txt_in_zip: "Ce .zip ne contient pas de discussion. Choisis le .zip créé par WhatsApp avec Exporter la discussion.",
      too_large: "Ce fichier dépasse 80 Mo. Exporte la discussion à nouveau avec Sans médias.",
      few_messages: "Cette discussion a trop peu de messages cette année pour un bilan. Choisis un groupe plus actif.",
      generic: "Ce fichier n'a pas pu être lu. Exporte la discussion à nouveau avec Sans médias.",
    },
  },
  teaser: {
    ready: "Ton Chatjaar est prêt",
    unlockTitle: "Débloque la suite",
    unlockLead: "Tous les prix, les records et les slides IA avec les meilleurs moments et un roast pour chacun.",
    lockedCount: (n) => `Encore ${n} slides, plus les slides IA, t'attendent.`,
    consent: "Je veux recevoir le bilan immédiatement et je sais que je perds ainsi mon droit de rétractation.",
    pay: "Payer 7,99 € et débloquer",
    paying: "Redirection vers le paiement…",
    again: "Choisir une autre discussion",
    payError: "La page de paiement n'a pas pu s'ouvrir. Réessaie.",
  },
  result: {
    checking: "Vérification de ton paiement…",
    notPaid: "Nous ne trouvons pas de paiement réussi pour ce lien. Si tu viens de payer, recharge la page dans une minute.",
    reupload: "Choisis à nouveau ta discussion",
    reuploadLead: "Ton paiement a réussi. Comme nous ne gardons pas ta discussion, choisis le fichier une dernière fois sur cet appareil.",
    canceled: "Le paiement a été annulé. Tu peux réessayer.",
    download: "Télécharger",
    downloadAll: "Télécharger toutes les cartes",
    share: "Partager",
    aiLoading: "L'IA lit vos meilleurs moments…",
    aiError: "Les slides IA n'ont pas pu être créées.",
    aiRetry: "Réessayer",
    newChat: "Faire un autre groupe",
    thanks: "Merci ! Voici votre Chatjaar complet.",
  },
  slides: {
    year: (y) => `Chatjaar ${y}`,
    totalMessages: "messages cette année",
    totalLine: (w) => `Soit ${w} mots au total.`,
    busiestDay: "Jour le plus actif",
    busiestDayLine: (c) => `${c} messages en un jour. Il s'est passé quoi ?`,
    topSender: "Spammeur de l'année",
    topSenderLine: (s) => `${s} de tous les messages viennent de cette personne.`,
    peakHour: "L'heure de vérité",
    peakHourLine: (h) => `Vers ${h}, le groupe explose.`,
    streak: "Plus longue série",
    streakLine: (s, e) => `Un message chaque jour, du ${s} au ${e}.`,
    activeDays: (n) => `${n} jours actifs`,
    emojis: "Emojis de l'année",
    words: "Mots de l'année",
    duo: "Duo de l'année",
    duoLine: (c) => `${c} fois, ils se sont répondu en moins d'un quart d'heure.`,
    ranking: "Le classement",
    messagesShort: "messages",
    personality: "Votre groupe est…",
    moments: "Moment de l'année",
    roast: "Le roast",
    prediction: "Prédiction pour l'an prochain",
    motto: "Votre devise",
    outro: "À l'année prochaine",
    outroLine: "Créé avec chatjaar",
    months: frMonths,
    awards: {
      spammer: { title: "Spammeur de l'année", line: "{value} messages. Soit {share} du groupe." },
      ghost: { title: "Fantôme de l'année", line: "Seulement {value} messages. Toujours en vie ?" },
      nightOwl: { title: "Oiseau de nuit", line: "{value} messages entre minuit et 5 h." },
      voiceKing: { title: "Roi·reine des vocaux", line: "{value} messages vocaux. Un podcast coûtait moins cher." },
      fastest: { title: "Réponse la plus rapide", line: "Répond en moyenne en {value} minutes." },
      starter: { title: "Lanceur de conversations", line: "A réveillé le groupe {value} fois." },
      novelist: { title: "Romancier", line: "{value} mots par message en moyenne." },
      questioner: { title: "Le curieux", line: "{value} messages avec un point d'interrogation." },
      laugher: { title: "Rieur de l'année", line: "A ri {value} fois. Public facile." },
      stickers: { title: "Roi·reine des stickers", line: "{value} stickers. Les mots, c'est surfait." },
      deleter: { title: "Effaceur de l'année", line: "{value} messages supprimés. Il y avait quoi ?" },
    },
  },
  legal: { privacyTitle: "Politique de confidentialité", termsTitle: "Conditions générales", imprintTitle: "Mentions légales", lastUpdated: "Dernière mise à jour" },
};

const en: Dict = {
  meta: {
    title: "Chatjaar — your group chat's year in review",
    description: "Upload your WhatsApp group and get the year in review: who texts most, who ghosts, the funniest moments and a roast for everyone. Your chat stays on your device.",
  },
  nav: { start: "Make your Chatjaar", privacy: "Privacy", terms: "Terms", imprint: "Imprint", language: "Language" },
  hero: {
    title: "Who really carried your group chat this year?",
    lead: "Upload your WhatsApp group export. You get a year in review to share: awards, records, the funniest moments and a roast for everyone.",
    cta: "Make your Chatjaar",
    note: "The first slides are free. Your chat is read on your own device.",
  },
  demo: {
    group: "Sunday football ⚽",
    lines: [
      ["Yassine", "who's bringing the balls"],
      ["Tom", "not me, I did last time"],
      ["Yassine", "you're all useless"],
      ["Bram", "😂😂"],
    ],
    slideLabel: "Spammer of the year",
    slideValue: "4,812",
    slideCaption: "38% of all messages came from this person.",
  },
  how: {
    title: "How it works",
    steps: [
      { title: "Export your group", text: "In WhatsApp: open the group, tap Export chat, then Without media." },
      { title: "Upload the file", text: "Your device reads the chat and counts everything. Nothing is stored." },
      { title: "Share your Chatjaar", text: "Swipe through the slides and post the cards back in the group." },
    ],
  },
  privacyBlock: {
    title: "Your chat stays yours",
    points: [
      "Your chat is read and counted in your browser. The file never reaches our server.",
      "For the AI slides we send only a selection of messages, with names, numbers, links and email addresses replaced.",
      "We keep nothing. Close the window and it's gone.",
    ],
  },
  pricing: {
    title: "What does it cost?",
    price: "€7.99",
    free: "Free: the first three slides.",
    paid: "One-off, per group:",
    features: [
      "Every award: spammer, ghost, night owl, fastest replier and more",
      "Records: busiest day, longest streak, peak hour",
      "AI: the funniest moments, a roast for everyone and your prediction for next year",
      "High-resolution cards to share",
    ],
    cta: "Try it free",
  },
  faq: {
    title: "Questions",
    items: [
      { q: "Does it work with iPhone and Android?", a: "Yes. Chatjaar reads exports from both, in English, Dutch, French, German and Spanish." },
      { q: "Does everyone in the group need to do something?", a: "No. One person exports the chat and makes the review for the whole group." },
      { q: "Which period counts?", a: "The calendar year of the last message in your export. Export now and you get this year." },
      { q: "Can I get a refund?", a: "You get the review right after paying. If something doesn't work, email us and we'll fix it or refund you." },
      { q: "Does it work for a one-on-one chat?", a: "Yes, although the group awards are less exciting." },
    ],
  },
  footer: { operator: "Chatjaar is a service of Marhaba Cooperation BV.", trademark: "WhatsApp is a trademark of WhatsApp LLC. Chatjaar is not affiliated with WhatsApp or Meta." },
  upload: {
    title: "Upload your group chat",
    lead: "Export the group from WhatsApp first. Always pick Without media: it's faster and it's all we need.",
    iosTitle: "iPhone",
    iosSteps: ["Open the group and tap the group name at the top.", "Scroll down and tap Export chat.", "Pick Without media and save the file to Files."],
    androidTitle: "Android",
    androidSteps: ["Open the group and tap ⋮ in the top right.", "Pick More, then Export chat.", "Pick Without media and save the file."],
    drop: "Drop your .zip or .txt file here",
    choose: "Choose file",
    busy: "Reading your chat…",
    localNote: "This happens on your device. The file is not uploaded.",
    errors: {
      empty: "This file is empty. Export the chat again and retry.",
      no_messages: "This file has no WhatsApp messages. Pick the .txt or .zip file WhatsApp created.",
      no_txt_in_zip: "This .zip has no chat in it. Pick the .zip WhatsApp created with Export chat.",
      too_large: "This file is larger than 80 MB. Export the chat again with Without media.",
      few_messages: "This chat has too few messages this year for a review. Pick a more active group.",
      generic: "This file couldn't be read. Export the chat again with Without media.",
    },
  },
  teaser: {
    ready: "Your Chatjaar is ready",
    unlockTitle: "Unlock the rest",
    unlockLead: "Every award, every record, and the AI slides with the funniest moments and a roast for everyone.",
    lockedCount: (n) => `${n} more slides plus the AI slides are waiting.`,
    consent: "I want the review delivered immediately and understand I lose my right of withdrawal.",
    pay: "Pay €7.99 and unlock",
    paying: "Taking you to checkout…",
    again: "Pick another chat",
    payError: "Checkout couldn't be opened. Try again.",
  },
  result: {
    checking: "Checking your payment…",
    notPaid: "We can't find a successful payment for this link. If you just paid, reload the page in a minute.",
    reupload: "Pick your chat again",
    reuploadLead: "Your payment went through. Because we don't store your chat, pick the file one more time on this device.",
    canceled: "The payment was cancelled. You can try again.",
    download: "Download",
    downloadAll: "Download all cards",
    share: "Share",
    aiLoading: "The AI is reading your best moments…",
    aiError: "The AI slides couldn't be created.",
    aiRetry: "Try again",
    newChat: "Do another group",
    thanks: "Thanks! Here's your full Chatjaar.",
  },
  slides: {
    year: (y) => `Chatjaar ${y}`,
    totalMessages: "messages this year",
    totalLine: (w) => `Good for ${w} words together.`,
    busiestDay: "Busiest day",
    busiestDayLine: (c) => `${c} messages in one day. What happened?`,
    topSender: "Spammer of the year",
    topSenderLine: (s) => `${s} of all messages came from this person.`,
    peakHour: "Hour of truth",
    peakHourLine: (h) => `Around ${h}, the group goes off.`,
    streak: "Longest streak",
    streakLine: (s, e) => `Something every day, from ${s} to ${e}.`,
    activeDays: (n) => `${n} active days`,
    emojis: "Emojis of the year",
    words: "Words of the year",
    duo: "Duo of the year",
    duoLine: (c) => `${c} times they replied to each other within 15 minutes.`,
    ranking: "The ranking",
    messagesShort: "messages",
    personality: "Your group is…",
    moments: "Moment of the year",
    roast: "The roast",
    prediction: "Prediction for next year",
    motto: "Your motto",
    outro: "See you next year",
    outroLine: "Made with chatjaar",
    months: enMonths,
    awards: {
      spammer: { title: "Spammer of the year", line: "{value} messages. That's {share} of the group." },
      ghost: { title: "Ghost of the year", line: "Only {value} messages. Still alive?" },
      nightOwl: { title: "Night owl", line: "{value} messages between midnight and 5am." },
      voiceKing: { title: "Voice note royalty", line: "{value} voice notes. A podcast would've been cheaper." },
      fastest: { title: "Fastest replier", line: "Replies within {value} minutes on average." },
      starter: { title: "Conversation starter", line: "Brought the group back to life {value} times." },
      novelist: { title: "Novelist", line: "{value} words per message on average." },
      questioner: { title: "The curious one", line: "{value} messages with a question mark." },
      laugher: { title: "Laugher of the year", line: "Laughed {value} times. Easy crowd." },
      stickers: { title: "Sticker royalty", line: "{value} stickers. Words are overrated." },
      deleter: { title: "Deleter of the year", line: "{value} messages deleted. What did they say?" },
    },
  },
  legal: { privacyTitle: "Privacy policy", termsTitle: "Terms and conditions", imprintTitle: "Imprint", lastUpdated: "Last updated" },
};

const deMonths = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const esMonths = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const de: Dict = {
  meta: {
    title: "Chatjaar — der Jahresrückblick eurer Gruppenchats",
    description: "Lade deine WhatsApp-Gruppe hoch und hol dir den Jahresrückblick: wer am meisten schreibt, wer abtaucht, die lustigsten Momente und ein Roast für jeden. Dein Chat bleibt auf deinem Gerät.",
  },
  nav: { start: "Dein Chatjaar erstellen", privacy: "Datenschutz", terms: "AGB", imprint: "Impressum", language: "Sprache" },
  hero: {
    title: "Wer hat euren Gruppenchat dieses Jahr wirklich getragen?",
    lead: "Lade den Export deiner WhatsApp-Gruppe hoch. Du bekommst einen Jahresrückblick zum Teilen: Preise, Rekorde, die lustigsten Momente und einen Roast für jeden.",
    cta: "Dein Chatjaar erstellen",
    note: "Die ersten Slides sind gratis. Dein Chat wird auf deinem eigenen Gerät gelesen.",
  },
  demo: {
    group: "Sonntagskick ⚽",
    lines: [
      ["Yassine", "wer bringt die bälle mit"],
      ["Tom", "ich nicht, ich hatte sie letztes mal"],
      ["Yassine", "ihr seid alle so faul"],
      ["Bram", "😂😂"],
    ],
    slideLabel: "Spammer des Jahres",
    slideValue: "4.812",
    slideCaption: "38 % aller Nachrichten kamen von dieser Person.",
  },
  how: {
    title: "So funktioniert's",
    steps: [
      { title: "Gruppe exportieren", text: "In WhatsApp: Gruppe öffnen, Chat exportieren wählen und dann Ohne Medien." },
      { title: "Datei hochladen", text: "Dein Gerät liest den Chat und zählt alles. Es wird nichts gespeichert." },
      { title: "Chatjaar teilen", text: "Wisch durch die Slides und poste die Karten zurück in die Gruppe." },
    ],
  },
  privacyBlock: {
    title: "Dein Chat bleibt deiner",
    points: [
      "Dein Chat wird in deinem Browser gelesen und gezählt. Die Datei landet nie auf unserem Server.",
      "Für die KI-Slides senden wir nur eine Auswahl an Nachrichten, mit ersetzten Namen, Nummern, Links und E-Mail-Adressen.",
      "Wir speichern nichts. Schließt du das Fenster, ist alles weg.",
    ],
  },
  pricing: {
    title: "Was kostet es?",
    price: "7,99 €",
    free: "Gratis: die ersten drei Slides.",
    paid: "Einmalig, pro Gruppe:",
    features: [
      "Alle Preise: Spammer, Geist, Nachteule, Schnellantworter und mehr",
      "Rekorde: aktivster Tag, längste Serie, Stoßzeit",
      "KI: die lustigsten Momente, ein Roast für jeden und eure Prognose fürs nächste Jahr",
      "Hochauflösende Karten zum Teilen",
    ],
    cta: "Gratis ausprobieren",
  },
  faq: {
    title: "Fragen",
    items: [
      { q: "Funktioniert es mit iPhone und Android?", a: "Ja. Chatjaar liest Exporte von beiden, auf Deutsch, Englisch, Spanisch, Französisch und Niederländisch." },
      { q: "Muss jeder in der Gruppe etwas tun?", a: "Nein. Eine Person exportiert den Chat und erstellt den Rückblick für die ganze Gruppe." },
      { q: "Welcher Zeitraum zählt?", a: "Das Kalenderjahr der letzten Nachricht in deinem Export. Exportierst du jetzt, bekommst du dieses Jahr." },
      { q: "Bekomme ich mein Geld zurück?", a: "Du bekommst den Rückblick direkt nach der Zahlung. Funktioniert etwas nicht, schreib uns: Wir beheben es oder erstatten dir den Betrag." },
      { q: "Geht das auch mit einem Einzelchat?", a: "Ja, auch wenn die Gruppenpreise dann weniger spannend sind." },
    ],
  },
  footer: { operator: "Chatjaar ist ein Dienst der Marhaba Cooperation BV (Belgien).", trademark: "WhatsApp ist eine Marke der WhatsApp LLC. Chatjaar steht in keiner Verbindung zu WhatsApp oder Meta." },
  upload: {
    title: "Lade deinen Gruppenchat hoch",
    lead: "Exportiere die Gruppe zuerst aus WhatsApp. Wähle immer Ohne Medien: Das geht schneller und mehr brauchen wir nicht.",
    iosTitle: "iPhone",
    iosSteps: ["Öffne die Gruppe und tippe oben auf den Gruppennamen.", "Scrolle nach unten und tippe auf Chat exportieren.", "Wähle Ohne Medien und speichere die Datei in Dateien."],
    androidTitle: "Android",
    androidSteps: ["Öffne die Gruppe und tippe oben rechts auf ⋮.", "Wähle Mehr und dann Chat exportieren.", "Wähle Ohne Medien und speichere die Datei."],
    drop: "Zieh deine .zip- oder .txt-Datei hierher",
    choose: "Datei auswählen",
    busy: "Dein Chat wird gelesen…",
    localNote: "Das passiert auf deinem Gerät. Die Datei wird nicht hochgeladen.",
    errors: {
      empty: "Diese Datei ist leer. Exportiere den Chat erneut und versuch es noch einmal.",
      no_messages: "In dieser Datei stehen keine WhatsApp-Nachrichten. Wähle die .txt- oder .zip-Datei, die WhatsApp erstellt hat.",
      no_txt_in_zip: "In dieser .zip ist kein Chat. Wähle die .zip, die WhatsApp mit Chat exportieren erstellt hat.",
      too_large: "Diese Datei ist größer als 80 MB. Exportiere den Chat erneut mit Ohne Medien.",
      few_messages: "Dieser Chat hat dieses Jahr zu wenige Nachrichten für einen Rückblick. Wähle eine aktivere Gruppe.",
      generic: "Diese Datei konnte nicht gelesen werden. Exportiere den Chat erneut mit Ohne Medien.",
    },
  },
  teaser: {
    ready: "Dein Chatjaar ist fertig",
    unlockTitle: "Schalte den Rest frei",
    unlockLead: "Alle Preise, alle Rekorde und die KI-Slides mit den lustigsten Momenten und einem Roast für jeden.",
    lockedCount: (n) => `Noch ${n} Slides plus die KI-Slides warten auf dich.`,
    consent: "Ich möchte den Rückblick sofort erhalten und weiß, dass ich dadurch mein Widerrufsrecht verliere.",
    pay: "7,99 € zahlen und freischalten",
    paying: "Weiter zur Zahlung…",
    again: "Anderen Chat wählen",
    payError: "Die Zahlung konnte nicht geöffnet werden. Versuch es noch einmal.",
  },
  result: {
    checking: "Deine Zahlung wird geprüft…",
    notPaid: "Wir finden keine erfolgreiche Zahlung für diesen Link. Hast du gerade bezahlt, lade die Seite in einer Minute neu.",
    reupload: "Wähle deinen Chat erneut",
    reuploadLead: "Deine Zahlung ist angekommen. Weil wir deinen Chat nicht speichern, wähle die Datei auf diesem Gerät noch einmal aus.",
    canceled: "Die Zahlung wurde abgebrochen. Du kannst es erneut versuchen.",
    download: "Herunterladen",
    downloadAll: "Alle Karten herunterladen",
    share: "Teilen",
    aiLoading: "Die KI liest eure besten Momente…",
    aiError: "Die KI-Slides konnten nicht erstellt werden.",
    aiRetry: "Erneut versuchen",
    newChat: "Noch eine Gruppe machen",
    thanks: "Danke! Hier ist dein komplettes Chatjaar.",
  },
  slides: {
    year: (y) => `Chatjaar ${y}`,
    totalMessages: "Nachrichten dieses Jahr",
    totalLine: (w) => `Zusammen ${w} Wörter.`,
    busiestDay: "Aktivster Tag",
    busiestDayLine: (c) => `${c} Nachrichten an einem Tag. Was war da los?`,
    topSender: "Spammer des Jahres",
    topSenderLine: (s) => `${s} aller Nachrichten kamen von dieser Person.`,
    peakHour: "Stunde der Wahrheit",
    peakHourLine: (h) => `Gegen ${h} dreht die Gruppe durch.`,
    streak: "Längste Serie",
    streakLine: (s, e) => `Jeden Tag was los, vom ${s} bis zum ${e}.`,
    activeDays: (n) => `${n} aktive Tage`,
    emojis: "Emojis des Jahres",
    words: "Wörter des Jahres",
    duo: "Duo des Jahres",
    duoLine: (c) => `${c}-mal haben sie sich innerhalb von 15 Minuten geantwortet.`,
    ranking: "Die Rangliste",
    messagesShort: "Nachrichten",
    personality: "Eure Gruppe ist…",
    moments: "Moment des Jahres",
    roast: "Der Roast",
    prediction: "Prognose fürs nächste Jahr",
    motto: "Euer Motto",
    outro: "Bis nächstes Jahr",
    outroLine: "Gemacht mit chatjaar",
    months: deMonths,
    awards: {
      spammer: { title: "Spammer des Jahres", line: "{value} Nachrichten. Das sind {share} der Gruppe." },
      ghost: { title: "Geist des Jahres", line: "Nur {value} Nachrichten. Lebst du noch?" },
      nightOwl: { title: "Nachteule", line: "{value} Nachrichten zwischen Mitternacht und 5 Uhr." },
      voiceKing: { title: "Sprachnachrichten-König", line: "{value} Sprachnachrichten. Ein Podcast wäre günstiger gewesen." },
      fastest: { title: "Schnellantworter", line: "Antwortet im Schnitt innerhalb von {value} Minuten." },
      starter: { title: "Gesprächsstarter", line: "Hat die Gruppe {value}-mal wiederbelebt." },
      novelist: { title: "Romanautor", line: "Im Schnitt {value} Wörter pro Nachricht." },
      questioner: { title: "Der Neugierige", line: "{value} Nachrichten mit Fragezeichen." },
      laugher: { title: "Lacher des Jahres", line: "{value}-mal gelacht. Leichtes Publikum." },
      stickers: { title: "Sticker-König", line: "{value} Sticker. Worte werden überschätzt." },
      deleter: { title: "Löscher des Jahres", line: "{value} Nachrichten gelöscht. Was stand da?" },
    },
  },
  legal: { privacyTitle: "Datenschutzerklärung", termsTitle: "Allgemeine Geschäftsbedingungen", imprintTitle: "Impressum", lastUpdated: "Zuletzt aktualisiert" },
};

const es: Dict = {
  meta: {
    title: "Chatjaar — el resumen del año de tu chat de grupo",
    description: "Sube tu grupo de WhatsApp y recibe el resumen del año: quién escribe más, quién desaparece, los momentos más graciosos y un roast para cada uno. Tu chat se queda en tu dispositivo.",
  },
  nav: { start: "Crea tu Chatjaar", privacy: "Privacidad", terms: "Condiciones", imprint: "Aviso legal", language: "Idioma" },
  hero: {
    title: "¿Quién sostuvo de verdad vuestro chat de grupo este año?",
    lead: "Sube la exportación de tu grupo de WhatsApp. Recibes un resumen del año para compartir: premios, récords, los momentos más graciosos y un roast para cada uno.",
    cta: "Crea tu Chatjaar",
    note: "Las primeras slides son gratis. Tu chat se lee en tu propio dispositivo.",
  },
  demo: {
    group: "Fútbol del domingo ⚽",
    lines: [
      ["Yassine", "quién trae los balones"],
      ["Tom", "yo no, los traje la última vez"],
      ["Yassine", "sois todos unos vagos"],
      ["Bram", "😂😂"],
    ],
    slideLabel: "Spammer del año",
    slideValue: "4.812",
    slideCaption: "El 38 % de todos los mensajes vino de esta persona.",
  },
  how: {
    title: "Cómo funciona",
    steps: [
      { title: "Exporta tu grupo", text: "En WhatsApp: abre el grupo, elige Exportar chat y luego Sin archivos." },
      { title: "Sube el archivo", text: "Tu dispositivo lee el chat y lo cuenta todo. No se guarda nada." },
      { title: "Comparte tu Chatjaar", text: "Desliza las slides y publica las tarjetas en el grupo." },
    ],
  },
  privacyBlock: {
    title: "Tu chat sigue siendo tuyo",
    points: [
      "Tu chat se lee y se cuenta en tu navegador. El archivo nunca llega a nuestro servidor.",
      "Para las slides de IA solo enviamos una selección de mensajes, con nombres, números, enlaces y correos sustituidos.",
      "No guardamos nada. Cierra la ventana y todo desaparece.",
    ],
  },
  pricing: {
    title: "¿Cuánto cuesta?",
    price: "7,99 €",
    free: "Gratis: las tres primeras slides.",
    paid: "Pago único, por grupo:",
    features: [
      "Todos los premios: spammer, fantasma, búho nocturno, respuesta más rápida y más",
      "Récords: día más activo, racha más larga, hora punta",
      "IA: los momentos más graciosos, un roast para cada uno y vuestra predicción para el año que viene",
      "Tarjetas en alta resolución para compartir",
    ],
    cta: "Pruébalo gratis",
  },
  faq: {
    title: "Preguntas",
    items: [
      { q: "¿Funciona con iPhone y Android?", a: "Sí. Chatjaar lee exportaciones de ambos, en español, inglés, alemán, francés y neerlandés." },
      { q: "¿Tiene que hacer algo todo el grupo?", a: "No. Una persona exporta el chat y crea el resumen para todo el grupo." },
      { q: "¿Qué periodo cuenta?", a: "El año natural del último mensaje de tu exportación. Si exportas ahora, obtienes este año." },
      { q: "¿Me devolvéis el dinero?", a: "Recibes el resumen justo después de pagar. Si algo no funciona, escríbenos y lo arreglamos o te devolvemos el dinero." },
      { q: "¿Funciona con un chat individual?", a: "Sí, aunque los premios de grupo son menos emocionantes." },
    ],
  },
  footer: { operator: "Chatjaar es un servicio de Marhaba Cooperation BV (Bélgica).", trademark: "WhatsApp es una marca de WhatsApp LLC. Chatjaar no está afiliado a WhatsApp ni a Meta." },
  upload: {
    title: "Sube tu chat de grupo",
    lead: "Primero exporta el grupo desde WhatsApp. Elige siempre Sin archivos: es más rápido y es todo lo que necesitamos.",
    iosTitle: "iPhone",
    iosSteps: ["Abre el grupo y toca el nombre del grupo arriba.", "Desplázate hacia abajo y toca Exportar chat.", "Elige Sin archivos y guarda el archivo en Archivos."],
    androidTitle: "Android",
    androidSteps: ["Abre el grupo y toca ⋮ arriba a la derecha.", "Elige Más y luego Exportar chat.", "Elige Sin archivos y guarda el archivo."],
    drop: "Suelta aquí tu archivo .zip o .txt",
    choose: "Elegir archivo",
    busy: "Leyendo tu chat…",
    localNote: "Esto ocurre en tu dispositivo. El archivo no se sube.",
    errors: {
      empty: "Este archivo está vacío. Vuelve a exportar el chat e inténtalo de nuevo.",
      no_messages: "Este archivo no contiene mensajes de WhatsApp. Elige el archivo .txt o .zip que creó WhatsApp.",
      no_txt_in_zip: "Este .zip no contiene ningún chat. Elige el .zip que WhatsApp creó con Exportar chat.",
      too_large: "Este archivo pesa más de 80 MB. Vuelve a exportar el chat con Sin archivos.",
      few_messages: "Este chat tiene muy pocos mensajes este año para un resumen. Elige un grupo más activo.",
      generic: "No se ha podido leer este archivo. Vuelve a exportar el chat con Sin archivos.",
    },
  },
  teaser: {
    ready: "Tu Chatjaar está listo",
    unlockTitle: "Desbloquea el resto",
    unlockLead: "Todos los premios, todos los récords y las slides de IA con los momentos más graciosos y un roast para cada uno.",
    lockedCount: (n) => `Te esperan ${n} slides más y las slides de IA.`,
    consent: "Quiero recibir el resumen de inmediato y sé que así pierdo mi derecho de desistimiento.",
    pay: "Paga 7,99 € y desbloquea",
    paying: "Te llevamos al pago…",
    again: "Elegir otro chat",
    payError: "No se ha podido abrir el pago. Inténtalo de nuevo.",
  },
  result: {
    checking: "Comprobando tu pago…",
    notPaid: "No encontramos un pago completado para este enlace. Si acabas de pagar, recarga la página en un minuto.",
    reupload: "Vuelve a elegir tu chat",
    reuploadLead: "Tu pago se ha completado. Como no guardamos tu chat, elige el archivo una vez más en este dispositivo.",
    canceled: "El pago se ha cancelado. Puedes intentarlo de nuevo.",
    download: "Descargar",
    downloadAll: "Descargar todas las tarjetas",
    share: "Compartir",
    aiLoading: "La IA está leyendo vuestros mejores momentos…",
    aiError: "No se han podido crear las slides de IA.",
    aiRetry: "Reintentar",
    newChat: "Hacer otro grupo",
    thanks: "¡Gracias! Aquí tienes tu Chatjaar completo.",
  },
  slides: {
    year: (y) => `Chatjaar ${y}`,
    totalMessages: "mensajes este año",
    totalLine: (w) => `En total, ${w} palabras.`,
    busiestDay: "Día más activo",
    busiestDayLine: (c) => `${c} mensajes en un solo día. ¿Qué pasó?`,
    topSender: "Spammer del año",
    topSenderLine: (s) => `El ${s} de todos los mensajes vino de esta persona.`,
    peakHour: "La hora de la verdad",
    peakHourLine: (h) => `Hacia las ${h}, el grupo se vuelve loco.`,
    streak: "Racha más larga",
    streakLine: (s, e) => `Mensajes todos los días, del ${s} al ${e}.`,
    activeDays: (n) => `${n} días activos`,
    emojis: "Emojis del año",
    words: "Palabras del año",
    duo: "Dúo del año",
    duoLine: (c) => `${c} veces se respondieron en menos de 15 minutos.`,
    ranking: "La clasificación",
    messagesShort: "mensajes",
    personality: "Vuestro grupo es…",
    moments: "Momento del año",
    roast: "El roast",
    prediction: "Predicción para el año que viene",
    motto: "Vuestro lema",
    outro: "Hasta el año que viene",
    outroLine: "Hecho con chatjaar",
    months: esMonths,
    awards: {
      spammer: { title: "Spammer del año", line: "{value} mensajes. Eso es el {share} del grupo." },
      ghost: { title: "Fantasma del año", line: "Solo {value} mensajes. ¿Sigues vivo?" },
      nightOwl: { title: "Búho nocturno", line: "{value} mensajes entre medianoche y las 5." },
      voiceKing: { title: "Rey de los audios", line: "{value} audios. Un pódcast habría salido más barato." },
      fastest: { title: "Respuesta más rápida", line: "Responde de media en {value} minutos." },
      starter: { title: "Rompehielos", line: "Resucitó el grupo {value} veces." },
      novelist: { title: "El novelista", line: "{value} palabras por mensaje de media." },
      questioner: { title: "El curioso", line: "{value} mensajes con signo de interrogación." },
      laugher: { title: "Risa del año", line: "Se rio {value} veces. Público fácil." },
      stickers: { title: "Rey de los stickers", line: "{value} stickers. Las palabras están sobrevaloradas." },
      deleter: { title: "Borrador del año", line: "{value} mensajes eliminados. ¿Qué decían?" },
    },
  },
  legal: { privacyTitle: "Política de privacidad", termsTitle: "Condiciones generales", imprintTitle: "Aviso legal", lastUpdated: "Última actualización" },
};

const DICTS: Record<Locale, Dict> = brandDeep({ nl, fr, en, de, es });

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

export function numberFormat(locale: Locale) {
  return new Intl.NumberFormat(LOCALE_TAG[locale]);
}
