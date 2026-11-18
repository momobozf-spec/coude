import { getLocales } from "expo-localization";
import { brandDeep } from "@/lib/brand";
import { FALLBACK_LOCALE, LOCALES, isLocale, type Locale } from "./dictionaries";

/** Texts that only exist in the app (the slides and awards come from dictionaries.ts, shared with the website). */
export interface AppDict {
  home: {
    title: string;
    lead: string;
    howTitle: string;
    iosTitle: string;
    iosSteps: string[];
    androidTitle: string;
    androidSteps: string[];
    pick: string;
    busy: string;
    privacy: string;
    free: string;
  };
  deck: {
    ready: string;
    swipe: string;
    unlockTitle: string;
    unlockLead: string;
    lockedCount: (n: number) => string;
    buy: (price: string) => string;
    buyNoPrice: string;
    buying: string;
    buyError: string;
    notAvailable: string;
    aiLoading: string;
    aiError: string;
    aiRetry: string;
    share: string;
    shareError: string;
    newChat: string;
    thanks: string;
    alreadyPaid: string;
  };
  story: {
    play: string;
    replay: string;
    tapHint: string;
    close: string;
    monthsTitle: string;
    daysInARow: string;
    summaryTitle: string;
    sumMessages: string;
    sumActiveDays: string;
    sumEmoji: string;
  };
  about: {
    title: string;
    privacy: string;
    terms: string;
    imprint: string;
    operator: string;
    trademark: string;
    version: string;
    how: string;
  };
}

const nl: AppDict = {
  home: {
    title: "Wie heeft jullie groepschat dit jaar echt gedragen?",
    lead: "Je jaaroverzicht om te delen: prijzen, records, de grappigste momenten en een roast voor iedereen.",
    howTitle: "Zo begin je",
    iosTitle: "iPhone",
    iosSteps: ["Open de groep in WhatsApp en tik bovenaan op de groepsnaam.", "Tik op Exporteer chat en kies Zonder media.", "Kies Chatjaar in het deelmenu."],
    androidTitle: "Android",
    androidSteps: ["Open de groep in WhatsApp en tik op ⋮ rechtsboven.", "Kies Meer › Chat exporteren › Zonder media.", "Kies Chatjaar in het deelmenu."],
    pick: "Of kies een geëxporteerd bestand",
    busy: "Je chat wordt gelezen…",
    privacy: "Je chat wordt op je telefoon gelezen en geteld. Het bestand wordt niet geüpload.",
    free: "De eerste 3 slides zijn gratis.",
  },
  deck: {
    ready: "Je Chatjaar is klaar",
    swipe: "Swipe door je slides",
    unlockTitle: "Ontgrendel de rest",
    unlockLead: "Alle prijzen, records en de AI-slides met de grappigste momenten en een roast per lid.",
    lockedCount: (n) => `Nog ${n} slides plus de AI-slides staan klaar.`,
    buy: (p) => `Ontgrendel voor ${p}`,
    buyNoPrice: "Ontgrendel",
    buying: "Even geduld…",
    buyError: "De betaling is niet gelukt. Probeer opnieuw.",
    notAvailable: "Betalen is nog niet beschikbaar in deze versie.",
    aiLoading: "De AI leest jullie beste momenten…",
    aiError: "De AI-slides konden niet gemaakt worden.",
    aiRetry: "Opnieuw proberen",
    share: "Deel deze slide",
    shareError: "Delen is niet gelukt.",
    newChat: "Andere groep",
    thanks: "Bedankt! Hier is je volledige Chatjaar.",
    alreadyPaid: "Deze chat is al ontgrendeld.",
  },
  story: {
    play: "▶  Speel je Chatjaar af",
    replay: "▶  Opnieuw afspelen",
    tapHint: "Tik rechts voor verder, links voor terug",
    close: "Sluiten",
    monthsTitle: "Drukste maand",
    daysInARow: "dagen op rij",
    summaryTitle: "Jullie jaar in één beeld",
    sumMessages: "Berichten",
    sumActiveDays: "Actieve dagen",
    sumEmoji: "Emoji van het jaar",
  },
  about: {
    title: "Over Chatjaar",
    privacy: "Privacyverklaring",
    terms: "Voorwaarden",
    imprint: "Colofon",
    operator: "Chatjaar is een dienst van Marhaba Cooperation BV (België).",
    trademark: "WhatsApp is een merk van WhatsApp LLC. Chatjaar is niet verbonden aan WhatsApp of Meta.",
    version: "Versie",
    how: "Je chat wordt op je telefoon gelezen. Enkel voor de AI-slides sturen we na betaling een kleine selectie berichten, met namen, nummers, links en e-mailadressen vervangen. We bewaren niets.",
  },
};

const fr: AppDict = {
  home: {
    title: "Qui a vraiment porté votre discussion de groupe cette année ?",
    lead: "Ton bilan de l'année à partager : prix, records, les moments les plus drôles et un roast pour chacun.",
    howTitle: "Pour commencer",
    iosTitle: "iPhone",
    iosSteps: ["Ouvre le groupe dans WhatsApp et touche le nom du groupe en haut.", "Touche Exporter la discussion et choisis Sans médias.", "Choisis Chatjaar dans le menu de partage."],
    androidTitle: "Android",
    androidSteps: ["Ouvre le groupe dans WhatsApp et touche ⋮ en haut à droite.", "Choisis Plus › Exporter la discussion › Sans médias.", "Choisis Chatjaar dans le menu de partage."],
    pick: "Ou choisis un fichier exporté",
    busy: "Lecture de ta discussion…",
    privacy: "Ta discussion est lue et comptée sur ton téléphone. Le fichier n'est pas envoyé.",
    free: "Les 3 premières slides sont gratuites.",
  },
  deck: {
    ready: "Ton Chatjaar est prêt",
    swipe: "Fais défiler tes slides",
    unlockTitle: "Débloque la suite",
    unlockLead: "Tous les prix, les records et les slides IA avec les moments les plus drôles et un roast pour chacun.",
    lockedCount: (n) => `Encore ${n} slides et les slides IA t'attendent.`,
    buy: (p) => `Débloquer pour ${p}`,
    buyNoPrice: "Débloquer",
    buying: "Un instant…",
    buyError: "Le paiement n'a pas abouti. Réessaie.",
    notAvailable: "Le paiement n'est pas encore disponible dans cette version.",
    aiLoading: "L'IA lit vos meilleurs moments…",
    aiError: "Les slides IA n'ont pas pu être créées.",
    aiRetry: "Réessayer",
    share: "Partager cette slide",
    shareError: "Le partage a échoué.",
    newChat: "Autre groupe",
    thanks: "Merci ! Voici ton Chatjaar complet.",
    alreadyPaid: "Cette discussion est déjà débloquée.",
  },
  story: {
    play: "▶  Lance ton Chatjaar",
    replay: "▶  Revoir",
    tapHint: "Touche à droite pour avancer, à gauche pour revenir",
    close: "Fermer",
    monthsTitle: "Mois le plus actif",
    daysInARow: "jours d'affilée",
    summaryTitle: "Votre année en une image",
    sumMessages: "Messages",
    sumActiveDays: "Jours actifs",
    sumEmoji: "Emoji de l'année",
  },
  about: {
    title: "À propos de Chatjaar",
    privacy: "Politique de confidentialité",
    terms: "Conditions",
    imprint: "Mentions légales",
    operator: "Chatjaar est un service de Marhaba Cooperation BV (Belgique).",
    trademark: "WhatsApp est une marque de WhatsApp LLC. Chatjaar n'est pas affilié à WhatsApp ni à Meta.",
    version: "Version",
    how: "Ta discussion est lue sur ton téléphone. Seulement pour les slides IA, après paiement, nous envoyons une petite sélection de messages, avec noms, numéros, liens et e-mails remplacés. Nous ne conservons rien.",
  },
};

const en: AppDict = {
  home: {
    title: "Who really carried your group chat this year?",
    lead: "Your year in review to share: awards, records, the funniest moments and a roast for everyone.",
    howTitle: "How to start",
    iosTitle: "iPhone",
    iosSteps: ["Open the group in WhatsApp and tap the group name at the top.", "Tap Export chat and pick Without media.", "Pick Chatjaar in the share menu."],
    androidTitle: "Android",
    androidSteps: ["Open the group in WhatsApp and tap ⋮ in the top right.", "Pick More › Export chat › Without media.", "Pick Chatjaar in the share menu."],
    pick: "Or pick an exported file",
    busy: "Reading your chat…",
    privacy: "Your chat is read and counted on your phone. The file is not uploaded.",
    free: "The first 3 slides are free.",
  },
  deck: {
    ready: "Your Chatjaar is ready",
    swipe: "Swipe through your slides",
    unlockTitle: "Unlock the rest",
    unlockLead: "Every award, every record, and the AI slides with the funniest moments and a roast for everyone.",
    lockedCount: (n) => `${n} more slides plus the AI slides are waiting.`,
    buy: (p) => `Unlock for ${p}`,
    buyNoPrice: "Unlock",
    buying: "One moment…",
    buyError: "The payment didn't go through. Try again.",
    notAvailable: "Payments aren't available in this version yet.",
    aiLoading: "The AI is reading your best moments…",
    aiError: "The AI slides couldn't be created.",
    aiRetry: "Try again",
    share: "Share this slide",
    shareError: "Sharing failed.",
    newChat: "Another group",
    thanks: "Thanks! Here's your full Chatjaar.",
    alreadyPaid: "This chat is already unlocked.",
  },
  story: {
    play: "▶  Play your Chatjaar",
    replay: "▶  Play again",
    tapHint: "Tap right to go on, left to go back",
    close: "Close",
    monthsTitle: "Busiest month",
    daysInARow: "days in a row",
    summaryTitle: "Your year in one picture",
    sumMessages: "Messages",
    sumActiveDays: "Active days",
    sumEmoji: "Emoji of the year",
  },
  about: {
    title: "About Chatjaar",
    privacy: "Privacy policy",
    terms: "Terms",
    imprint: "Imprint",
    operator: "Chatjaar is a service of Marhaba Cooperation BV (Belgium).",
    trademark: "WhatsApp is a trademark of WhatsApp LLC. Chatjaar is not affiliated with WhatsApp or Meta.",
    version: "Version",
    how: "Your chat is read on your phone. Only for the AI slides, after payment, we send a small selection of messages with names, numbers, links and email addresses replaced. We keep nothing.",
  },
};

const de: AppDict = {
  home: {
    title: "Wer hat euren Gruppenchat dieses Jahr wirklich getragen?",
    lead: "Dein Jahresrückblick zum Teilen: Preise, Rekorde, die lustigsten Momente und ein Roast für jeden.",
    howTitle: "So startest du",
    iosTitle: "iPhone",
    iosSteps: ["Öffne die Gruppe in WhatsApp und tippe oben auf den Gruppennamen.", "Tippe auf Chat exportieren und wähle Ohne Medien.", "Wähle Chatjaar im Teilen-Menü."],
    androidTitle: "Android",
    androidSteps: ["Öffne die Gruppe in WhatsApp und tippe oben rechts auf ⋮.", "Wähle Mehr › Chat exportieren › Ohne Medien.", "Wähle Chatjaar im Teilen-Menü."],
    pick: "Oder wähle eine exportierte Datei",
    busy: "Dein Chat wird gelesen…",
    privacy: "Dein Chat wird auf deinem Handy gelesen und gezählt. Die Datei wird nicht hochgeladen.",
    free: "Die ersten 3 Slides sind gratis.",
  },
  deck: {
    ready: "Dein Chatjaar ist fertig",
    swipe: "Wisch durch deine Slides",
    unlockTitle: "Schalte den Rest frei",
    unlockLead: "Alle Preise, alle Rekorde und die KI-Slides mit den lustigsten Momenten und einem Roast für jeden.",
    lockedCount: (n) => `Noch ${n} Slides plus die KI-Slides warten auf dich.`,
    buy: (p) => `Für ${p} freischalten`,
    buyNoPrice: "Freischalten",
    buying: "Einen Moment…",
    buyError: "Die Zahlung hat nicht geklappt. Versuch es noch einmal.",
    notAvailable: "Bezahlen ist in dieser Version noch nicht verfügbar.",
    aiLoading: "Die KI liest eure besten Momente…",
    aiError: "Die KI-Slides konnten nicht erstellt werden.",
    aiRetry: "Erneut versuchen",
    share: "Diese Slide teilen",
    shareError: "Teilen hat nicht geklappt.",
    newChat: "Andere Gruppe",
    thanks: "Danke! Hier ist dein komplettes Chatjaar.",
    alreadyPaid: "Dieser Chat ist bereits freigeschaltet.",
  },
  story: {
    play: "▶  Dein Chatjaar abspielen",
    replay: "▶  Nochmal abspielen",
    tapHint: "Rechts tippen für weiter, links für zurück",
    close: "Schließen",
    monthsTitle: "Aktivster Monat",
    daysInARow: "Tage am Stück",
    summaryTitle: "Euer Jahr auf einen Blick",
    sumMessages: "Nachrichten",
    sumActiveDays: "Aktive Tage",
    sumEmoji: "Emoji des Jahres",
  },
  about: {
    title: "Über Chatjaar",
    privacy: "Datenschutzerklärung",
    terms: "AGB",
    imprint: "Impressum",
    operator: "Chatjaar ist ein Dienst der Marhaba Cooperation BV (Belgien).",
    trademark: "WhatsApp ist eine Marke der WhatsApp LLC. Chatjaar steht in keiner Verbindung zu WhatsApp oder Meta.",
    version: "Version",
    how: "Dein Chat wird auf deinem Handy gelesen. Nur für die KI-Slides senden wir nach der Zahlung eine kleine Auswahl an Nachrichten, mit ersetzten Namen, Nummern, Links und E-Mail-Adressen. Wir speichern nichts.",
  },
};

const es: AppDict = {
  home: {
    title: "¿Quién sostuvo de verdad vuestro chat de grupo este año?",
    lead: "Tu resumen del año para compartir: premios, récords, los momentos más graciosos y un roast para cada uno.",
    howTitle: "Cómo empezar",
    iosTitle: "iPhone",
    iosSteps: ["Abre el grupo en WhatsApp y toca el nombre del grupo arriba.", "Toca Exportar chat y elige Sin archivos.", "Elige Chatjaar en el menú de compartir."],
    androidTitle: "Android",
    androidSteps: ["Abre el grupo en WhatsApp y toca ⋮ arriba a la derecha.", "Elige Más › Exportar chat › Sin archivos.", "Elige Chatjaar en el menú de compartir."],
    pick: "O elige un archivo exportado",
    busy: "Leyendo tu chat…",
    privacy: "Tu chat se lee y se cuenta en tu teléfono. El archivo no se sube.",
    free: "Las 3 primeras slides son gratis.",
  },
  deck: {
    ready: "Tu Chatjaar está listo",
    swipe: "Desliza tus slides",
    unlockTitle: "Desbloquea el resto",
    unlockLead: "Todos los premios, todos los récords y las slides de IA con los momentos más graciosos y un roast para cada uno.",
    lockedCount: (n) => `Te esperan ${n} slides más y las slides de IA.`,
    buy: (p) => `Desbloquear por ${p}`,
    buyNoPrice: "Desbloquear",
    buying: "Un momento…",
    buyError: "El pago no se ha completado. Inténtalo de nuevo.",
    notAvailable: "El pago aún no está disponible en esta versión.",
    aiLoading: "La IA está leyendo vuestros mejores momentos…",
    aiError: "No se han podido crear las slides de IA.",
    aiRetry: "Reintentar",
    share: "Compartir esta slide",
    shareError: "No se ha podido compartir.",
    newChat: "Otro grupo",
    thanks: "¡Gracias! Aquí tienes tu Chatjaar completo.",
    alreadyPaid: "Este chat ya está desbloqueado.",
  },
  story: {
    play: "▶  Reproduce tu Chatjaar",
    replay: "▶  Ver de nuevo",
    tapHint: "Toca a la derecha para avanzar, a la izquierda para volver",
    close: "Cerrar",
    monthsTitle: "Mes más activo",
    daysInARow: "días seguidos",
    summaryTitle: "Vuestro año en una imagen",
    sumMessages: "Mensajes",
    sumActiveDays: "Días activos",
    sumEmoji: "Emoji del año",
  },
  about: {
    title: "Sobre Chatjaar",
    privacy: "Política de privacidad",
    terms: "Condiciones",
    imprint: "Aviso legal",
    operator: "Chatjaar es un servicio de Marhaba Cooperation BV (Bélgica).",
    trademark: "WhatsApp es una marca de WhatsApp LLC. Chatjaar no está afiliado a WhatsApp ni a Meta.",
    version: "Versión",
    how: "Tu chat se lee en tu teléfono. Solo para las slides de IA, después del pago, enviamos una pequeña selección de mensajes con nombres, números, enlaces y correos sustituidos. No guardamos nada.",
  },
};

const APP_DICTS: Record<Locale, AppDict> = brandDeep({ nl, fr, en, de, es });

export function getAppDict(locale: Locale): AppDict {
  return APP_DICTS[locale];
}

/** First supported language from the phone's language list, otherwise English. */
export function deviceLocale(): Locale {
  for (const l of getLocales()) {
    const code = (l.languageCode ?? "").toLowerCase();
    if (isLocale(code)) return code;
  }
  return FALLBACK_LOCALE;
}

export { LOCALES };
