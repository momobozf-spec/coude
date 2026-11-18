import type { Locale } from "@/i18n/dictionaries";
import { brandDeep } from "@/lib/brand";

export interface LegalSection {
  h: string;
  p: string[];
}

export const LEGAL_UPDATED = "2026-11-09";

export interface Company {
  name: string;
  enterprise: string;
  vat: string;
  address: string;
  email: string;
}

export function company(): Company {
  return {
    name: "Marhaba Cooperation BV",
    enterprise: "1037.222.285",
    vat: "BE1037222285",
    address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  };
}

function contact(c: Company, locale: Locale) {
  const parts = [c.name, c.address, c.email].filter(Boolean);
  const seeImprint: Record<Locale, string> = {
    nl: "(adres en e-mail: zie colofon)",
    fr: "(adresse et e-mail : voir les mentions légales)",
    en: "(address and email: see imprint)",
    de: "(Anschrift und E-Mail: siehe Impressum)",
    es: "(dirección y correo: ver aviso legal)",
  };
  if (parts.length === 1) parts.push(seeImprint[locale]);
  return parts.join(", ");
}

export function privacyRaw(locale: Locale, c: Company): LegalSection[] {
  if (locale === "de") {
    return [
      { h: "Wer ist verantwortlich?", p: [`Verantwortlich ist ${contact(c, locale)}, Unternehmensnummer ${c.enterprise} (Belgien).`] },
      {
        h: "Was mit deinem Chat passiert",
        p: [
          "Dein WhatsApp-Export wird in deinem Browser gelesen und ausgewertet. Die Datei wird nie an unsere Server gesendet.",
          "Die Ergebnisse liegen im Sitzungsspeicher deines Browsers, damit die Zahlung abgeschlossen werden kann. Sie verschwinden, wenn du den Tab schließt.",
        ],
      },
      {
        h: "KI-Slides",
        p: [
          "Nach der Zahlung senden wir eine begrenzte Auswahl an Nachrichten und Statistiken, um die KI-Slides zu erstellen. Vor dem Senden werden die Namen der Mitglieder durch Codes (Lid A, Lid B…) ersetzt und Links, Telefonnummern und E-Mail-Adressen entfernt. Die echten Namen werden nur in deinem Browser wieder eingesetzt.",
          "Dieser Text wird von Anthropic PBC (USA) als unser Auftragsverarbeiter verarbeitet, um die Antwort zu erzeugen. Wir speichern weder die Auswahl noch die Antwort auf unseren Servern. Die Übermittlung außerhalb des EWR stützt sich auf die Standardvertragsklauseln der Europäischen Kommission.",
          "Rechtsgrundlage: die Erfüllung des Vertrags, den du mit uns schließt (Art. 6 Abs. 1 lit. b DSGVO). Du lädst einen Chat hoch, an dem du selbst teilnimmst, für die private Nutzung.",
        ],
      },
      {
        h: "Zahlung",
        p: [
          "Zahlungen werden von Stripe Payments Europe Ltd. abgewickelt. Stripe erhält die für die Zahlung nötigen Daten (etwa deine E-Mail-Adresse und Zahlungsart). Wir erhalten den Zahlungsstatus und den Betrag und bewahren diese 7 Jahre für unsere Buchhaltung auf (rechtliche Verpflichtung, Art. 6 Abs. 1 lit. c DSGVO).",
        ],
      },
      { h: "Cookies und Tracking", p: ["Wir verwenden auf dieser Website keine Tracking-Cookies, keine Analysetools und keine Werbung von Dritten. Es wird nur der oben beschriebene technische Sitzungsspeicher genutzt."] },
      {
        h: "Deine Rechte",
        p: [
          "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Datenübertragbarkeit. Da wir deinen Chat nicht speichern, gibt es außer den Zahlungsdaten praktisch nichts zu löschen. Kontaktiere uns über die oben genannte Adresse.",
          "Du kannst dich bei der belgischen Datenschutzbehörde beschweren, Drukpersstraat 35, 1000 Brüssel (www.dataprotectionauthority.be), oder bei der Datenschutzaufsichtsbehörde in deinem Wohnsitzland.",
        ],
      },
    ];
  }
  if (locale === "es") {
    return [
      { h: "¿Quién es el responsable?", p: [`El responsable del tratamiento es ${contact(c, locale)}, número de empresa ${c.enterprise} (Bélgica).`] },
      {
        h: "Qué pasa con tu chat",
        p: [
          "Tu exportación de WhatsApp se lee y se analiza en tu navegador. El archivo nunca se envía a nuestros servidores.",
          "Los resultados se guardan en el almacenamiento de sesión de tu navegador para que el pago pueda completarse. Desaparecen al cerrar la pestaña.",
        ],
      },
      {
        h: "Slides de IA",
        p: [
          "Después del pago enviamos una selección limitada de mensajes y estadísticas para generar las slides de IA. Antes del envío, los nombres de los miembros se sustituyen por códigos (Lid A, Lid B…) y se eliminan los enlaces, números de teléfono y correos electrónicos. Los nombres reales solo se vuelven a poner en tu navegador.",
          "Este texto lo trata Anthropic PBC (Estados Unidos) como encargado del tratamiento para generar la respuesta. No guardamos ni la selección ni la respuesta en nuestros servidores. La transferencia fuera del EEE se basa en las cláusulas contractuales tipo de la Comisión Europea.",
          "Base jurídica: la ejecución del contrato que celebras con nosotros (art. 6.1.b RGPD). Subes un chat en el que participas, para uso privado.",
        ],
      },
      {
        h: "Pago",
        p: [
          "Los pagos los procesa Stripe Payments Europe Ltd. Stripe recibe los datos necesarios para el pago (como tu correo y tu método de pago). Nosotros recibimos el estado del pago y el importe, que conservamos 7 años para nuestra contabilidad (obligación legal, art. 6.1.c RGPD).",
        ],
      },
      { h: "Cookies y seguimiento", p: ["No usamos cookies de seguimiento, herramientas de analítica ni publicidad de terceros en este sitio. Solo se usa el almacenamiento de sesión técnico descrito arriba."] },
      {
        h: "Tus derechos",
        p: [
          "Tienes derecho de acceso, rectificación, supresión, limitación, oposición y portabilidad. Como no guardamos tu chat, en la práctica no hay nada que borrar aparte de los datos de pago. Contáctanos en la dirección indicada arriba.",
          "Puedes presentar una reclamación ante la Autoridad de Protección de Datos de Bélgica, Drukpersstraat 35, 1000 Bruselas (www.dataprotectionauthority.be), o ante la autoridad de protección de datos de tu país de residencia.",
        ],
      },
    ];
  }
  if (locale === "fr") {
    return [
      { h: "Qui est responsable ?", p: [`Le responsable du traitement est ${contact(c, locale)}, numéro d'entreprise ${c.enterprise}.`] },
      {
        h: "Ce qui se passe avec ta discussion",
        p: [
          "Ton export WhatsApp est lu et analysé dans ton navigateur. Le fichier n'est jamais envoyé à nos serveurs.",
          "Les résultats sont conservés dans le stockage de session de ton navigateur, pour que le paiement puisse aboutir. Ils disparaissent quand tu fermes l'onglet.",
        ],
      },
      {
        h: "Slides IA",
        p: [
          "Après paiement, nous envoyons une sélection limitée de messages et de statistiques pour générer les slides IA. Avant l'envoi, les noms des membres sont remplacés par des codes (Lid A, Lid B…) et les liens, numéros de téléphone et adresses e-mail sont supprimés. Les vrais noms sont remis uniquement dans ton navigateur.",
          "Ce texte est traité par Anthropic PBC (États-Unis) en tant que sous-traitant, pour générer la réponse. Nous ne conservons ni la sélection ni la réponse sur nos serveurs. Le transfert hors de l'EEE repose sur les clauses contractuelles types de la Commission européenne.",
          "Base juridique : l'exécution du contrat que tu concluais avec nous (art. 6.1.b RGPD). Tu importes une discussion à laquelle tu participes, pour un usage privé.",
        ],
      },
      {
        h: "Paiement",
        p: [
          "Les paiements sont traités par Stripe Payments Europe Ltd. Stripe reçoit les données nécessaires au paiement (comme ton e-mail et ton moyen de paiement). Nous recevons le statut du paiement et le montant, que nous conservons pour notre comptabilité pendant 7 ans (obligation légale, art. 6.1.c RGPD).",
        ],
      },
      { h: "Cookies et suivi", p: ["Nous n'utilisons ni cookies de suivi, ni outils d'analyse, ni publicités tierces sur ce site. Seul le stockage de session technique décrit ci-dessus est utilisé."] },
      {
        h: "Tes droits",
        p: [
          "Tu as le droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité. Comme nous ne stockons pas ta discussion, il n'y a en pratique rien à effacer en dehors des données de paiement. Contacte-nous via l'adresse ci-dessus.",
          "Tu peux introduire une plainte auprès de l'Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles (www.autoriteprotectiondonnees.be).",
        ],
      },
    ];
  }
  if (locale === "en") {
    return [
      { h: "Who is responsible?", p: [`The controller is ${contact(c, locale)}, enterprise number ${c.enterprise}.`] },
      {
        h: "What happens to your chat",
        p: [
          "Your WhatsApp export is read and analysed in your browser. The file is never sent to our servers.",
          "Results are kept in your browser's session storage so checkout can complete. They disappear when you close the tab.",
        ],
      },
      {
        h: "AI slides",
        p: [
          "After payment we send a limited selection of messages and statistics to generate the AI slides. Before sending, member names are replaced with codes (Lid A, Lid B…) and links, phone numbers and email addresses are removed. Real names are put back only in your browser.",
          "This text is processed by Anthropic PBC (United States) as our processor to generate the response. We do not store the selection or the response on our servers. Transfers outside the EEA rely on the European Commission's standard contractual clauses.",
          "Legal basis: performance of the contract you enter into with us (Art. 6(1)(b) GDPR). You upload a chat you take part in, for private use.",
        ],
      },
      {
        h: "Payment",
        p: [
          "Payments are processed by Stripe Payments Europe Ltd. Stripe receives the data needed for payment (such as your email and payment method). We receive the payment status and amount, which we keep for our accounts for 7 years (legal obligation, Art. 6(1)(c) GDPR).",
        ],
      },
      { h: "Cookies and tracking", p: ["We use no tracking cookies, analytics or third-party advertising on this site. Only the technical session storage described above is used."] },
      {
        h: "Your rights",
        p: [
          "You have the right to access, rectification, erasure, restriction, objection and portability. Because we don't store your chat, in practice there is nothing to erase apart from payment records. Contact us at the address above.",
          "You can lodge a complaint with the Belgian Data Protection Authority, Drukpersstraat 35, 1000 Brussels (www.dataprotectionauthority.be).",
        ],
      },
    ];
  }
  return [
    { h: "Wie is verantwoordelijk?", p: [`De verwerkingsverantwoordelijke is ${contact(c, locale)}, ondernemingsnummer ${c.enterprise}.`] },
    {
      h: "Wat er met je chat gebeurt",
      p: [
        "Je WhatsApp-export wordt in je browser gelezen en geanalyseerd. Het bestand wordt nooit naar onze servers gestuurd.",
        "De resultaten staan in de sessie-opslag van je browser, zodat de betaling kan afronden. Ze verdwijnen wanneer je het tabblad sluit.",
      ],
    },
    {
      h: "AI-slides",
      p: [
        "Na betaling sturen we een beperkte selectie berichten en statistieken door om de AI-slides te maken. Vóór het verzenden worden de namen van de leden vervangen door codes (Lid A, Lid B…) en worden links, telefoonnummers en e-mailadressen verwijderd. De echte namen worden enkel in je browser teruggezet.",
        "Deze tekst wordt verwerkt door Anthropic PBC (Verenigde Staten) als onze verwerker, om het antwoord te maken. We bewaren de selectie en het antwoord niet op onze servers. De doorgifte buiten de EER gebeurt op basis van de standaardcontractbepalingen van de Europese Commissie.",
        "Rechtsgrond: de uitvoering van de overeenkomst die je met ons sluit (art. 6.1.b AVG). Je uploadt een chat waaraan je zelf deelneemt, voor privégebruik.",
      ],
    },
    {
      h: "Betaling",
      p: [
        "Betalingen verlopen via Stripe Payments Europe Ltd. Stripe ontvangt de gegevens die nodig zijn voor de betaling (zoals je e-mailadres en betaalmiddel). Wij ontvangen de betaalstatus en het bedrag, die we 7 jaar bewaren voor onze boekhouding (wettelijke verplichting, art. 6.1.c AVG).",
      ],
    },
    { h: "Cookies en tracking", p: ["We gebruiken geen trackingcookies, geen analysetools en geen advertenties van derden op deze site. Enkel de technische sessie-opslag hierboven wordt gebruikt."] },
    {
      h: "Je rechten",
      p: [
        "Je hebt recht op inzage, verbetering, wissing, beperking, bezwaar en overdraagbaarheid. Omdat we je chat niet bewaren, is er in de praktijk niets te wissen buiten de betaalgegevens. Contacteer ons via het adres hierboven.",
        "Je kan een klacht indienen bij de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel (www.gegevensbeschermingsautoriteit.be).",
      ],
    },
  ];
}

export function termsRaw(locale: Locale, c: Company): LegalSection[] {
  if (locale === "de") {
    return [
      { h: "Der Dienst", p: [`Chatjaar ist ein Dienst der ${contact(c, locale)}, USt-IdNr. ${c.vat}. Chatjaar erstellt einen Jahresrückblick eines WhatsApp-Chats aus einem Export, den du hochlädst.`] },
      { h: "Preis und Zahlung", p: ["Die ersten drei Slides sind gratis. Der vollständige Rückblick kostet einmalig 7,99 € inklusive MwSt. pro Chat. Die Zahlung erfolgt über Stripe."] },
      {
        h: "Widerrufsrecht",
        p: [
          "Chatjaar ist ein digitaler Inhalt, der sofort geliefert wird. Vor der Zahlung stimmst du ausdrücklich der sofortigen Lieferung zu und bestätigst, dass du dadurch dein Widerrufsrecht verlierst (Art. 16 Buchst. m der Richtlinie 2011/83/EU; Art. VI.53, 13° des belgischen Wirtschaftsgesetzbuchs).",
          "Funktioniert der Rückblick nicht wie beschrieben, kontaktiere uns: Wir beheben das Problem oder erstatten dir den Betrag.",
        ],
      },
      {
        h: "Deine Nutzung",
        p: [
          "Lade nur Chats hoch, an denen du selbst teilnimmst, für die private Nutzung. Teile den Rückblick respektvoll mit den Mitgliedern des Chats.",
          "Die KI-Texte werden automatisch erstellt und sind als Humor gedacht. Sie können Fehler enthalten.",
        ],
      },
      { h: "Haftung", p: ["Unsere Haftung ist auf den gezahlten Betrag begrenzt, außer bei Vorsatz oder grober Fahrlässigkeit."] },
      { h: "Anwendbares Recht", p: ["Es gilt belgisches Recht. Zwingende Verbraucherschutzvorschriften deines Wohnsitzlandes bleiben unberührt."] },
    ];
  }
  if (locale === "es") {
    return [
      { h: "El servicio", p: [`Chatjaar es un servicio de ${contact(c, locale)}, IVA ${c.vat}. Chatjaar crea un resumen del año de un chat de WhatsApp a partir de una exportación que tú subes.`] },
      { h: "Precio y pago", p: ["Las tres primeras slides son gratis. El resumen completo cuesta 7,99 € IVA incluido, un solo pago por chat. El pago se realiza a través de Stripe."] },
      {
        h: "Derecho de desistimiento",
        p: [
          "Chatjaar es contenido digital que se entrega de inmediato. Antes de pagar, aceptas expresamente la entrega inmediata y reconoces que pierdes tu derecho de desistimiento (art. 16, letra m, de la Directiva 2011/83/UE; art. VI.53, 13° del Código de Derecho Económico belga).",
          "Si el resumen no funciona como se describe, contáctanos y lo arreglamos o te devolvemos el dinero.",
        ],
      },
      {
        h: "Tu uso",
        p: [
          "Sube solo chats en los que participas, para uso privado. Comparte el resumen con respeto con los miembros del chat.",
          "Los textos de IA se generan automáticamente y tienen fines humorísticos. Pueden contener errores.",
        ],
      },
      { h: "Responsabilidad", p: ["Nuestra responsabilidad se limita al importe pagado, salvo en caso de dolo o culpa grave."] },
      { h: "Ley aplicable", p: ["Se aplica la ley belga. Los derechos que te otorga la normativa de consumo de tu país de residencia siguen siendo de aplicación."] },
    ];
  }
  if (locale === "fr") {
    return [
      { h: "Le service", p: [`Chatjaar est un service de ${contact(c, locale)}, TVA ${c.vat}. Chatjaar crée un bilan de l'année d'une discussion WhatsApp à partir d'un export que tu importes.`] },
      { h: "Prix et paiement", p: ["Les trois premières slides sont gratuites. Le bilan complet coûte 7,99 € TVA comprise, une fois par discussion. Le paiement se fait via Stripe."] },
      {
        h: "Droit de rétractation",
        p: [
          "Chatjaar est un contenu numérique livré immédiatement. Avant de payer, tu donnes ton accord exprès pour une livraison immédiate et tu reconnais perdre ton droit de rétractation (art. VI.53, 13° du Code de droit économique).",
          "Si le bilan ne fonctionne pas comme décrit, contacte-nous : nous réglons le problème ou te remboursons.",
        ],
      },
      {
        h: "Ton utilisation",
        p: [
          "Importe uniquement des discussions auxquelles tu participes, pour un usage privé. Partage le bilan de manière respectueuse avec les membres de la discussion.",
          "Les textes IA sont générés automatiquement et destinés à l'humour. Ils peuvent contenir des erreurs.",
        ],
      },
      { h: "Responsabilité", p: ["Notre responsabilité est limitée au montant payé, sauf en cas de faute intentionnelle ou grave."] },
      { h: "Droit applicable", p: ["Le droit belge s'applique. Les droits que tu tires du droit de la consommation de ton pays de résidence restent d'application."] },
    ];
  }
  if (locale === "en") {
    return [
      { h: "The service", p: [`Chatjaar is a service of ${contact(c, locale)}, VAT ${c.vat}. Chatjaar creates a year in review of a WhatsApp chat from an export you upload.`] },
      { h: "Price and payment", p: ["The first three slides are free. The full review costs €7.99 including VAT, once per chat. Payment is handled by Stripe."] },
      {
        h: "Right of withdrawal",
        p: [
          "Chatjaar is digital content delivered immediately. Before paying, you expressly agree to immediate delivery and acknowledge that you lose your right of withdrawal (Art. VI.53, 13° Belgian Code of Economic Law).",
          "If the review doesn't work as described, contact us and we will fix it or refund you.",
        ],
      },
      {
        h: "Your use",
        p: [
          "Only upload chats you take part in, for private use. Share the review respectfully with the members of the chat.",
          "AI texts are generated automatically and meant as humour. They can contain mistakes.",
        ],
      },
      { h: "Liability", p: ["Our liability is limited to the amount paid, except in case of intent or gross negligence."] },
      { h: "Governing law", p: ["Belgian law applies. Rights you have under the consumer law of your country of residence remain in force."] },
    ];
  }
  return [
    { h: "De dienst", p: [`Chatjaar is een dienst van ${contact(c, locale)}, btw ${c.vat}. Chatjaar maakt een jaaroverzicht van een WhatsApp-chat op basis van een export die je zelf uploadt.`] },
    { h: "Prijs en betaling", p: ["De eerste drie slides zijn gratis. Het volledige overzicht kost €7,99 inclusief btw, eenmalig per chat. De betaling verloopt via Stripe."] },
    {
      h: "Herroepingsrecht",
      p: [
        "Chatjaar is digitale inhoud die meteen geleverd wordt. Vóór de betaling stem je uitdrukkelijk in met onmiddellijke levering en erken je dat je daardoor je herroepingsrecht verliest (art. VI.53, 13° Wetboek van economisch recht).",
        "Werkt het overzicht niet zoals beschreven, contacteer ons dan: we lossen het op of betalen je terug.",
      ],
    },
    {
      h: "Jouw gebruik",
      p: [
        "Upload enkel chats waaraan je zelf deelneemt, voor privégebruik. Deel het overzicht respectvol met de leden van de chat.",
        "De AI-teksten worden automatisch gemaakt en zijn bedoeld als humor. Ze kunnen fouten bevatten.",
      ],
    },
    { h: "Aansprakelijkheid", p: ["Onze aansprakelijkheid is beperkt tot het betaalde bedrag, behalve bij opzet of zware fout."] },
    { h: "Toepasselijk recht", p: ["Het Belgisch recht is van toepassing. De rechten die je haalt uit het consumentenrecht van je woonland blijven gelden."] },
  ];
}

export function imprint(locale: Locale, c: Company): LegalSection[] {
  const L = {
    nl: ["Uitgever", "Ondernemingsnummer", "Btw-nummer", "Adres", "E-mail", "Betalingen", "Betalingen verlopen via Stripe Payments Europe Ltd."],
    fr: ["Éditeur", "Numéro d'entreprise", "Numéro de TVA", "Adresse", "E-mail", "Paiements", "Les paiements sont traités par Stripe Payments Europe Ltd."],
    en: ["Publisher", "Enterprise number", "VAT number", "Address", "Email", "Payments", "Payments are processed by Stripe Payments Europe Ltd."],
    de: ["Anbieter", "Unternehmensnummer (Belgien)", "USt-IdNr.", "Anschrift", "E-Mail", "Zahlungen", "Zahlungen werden von Stripe Payments Europe Ltd. abgewickelt."],
    es: ["Titular", "Número de empresa (Bélgica)", "Número de IVA", "Dirección", "Correo electrónico", "Pagos", "Los pagos los procesa Stripe Payments Europe Ltd."],
  }[locale];
  return [
    {
      h: L[0],
      p: [c.name, `${L[1]}: ${c.enterprise}`, `${L[2]}: ${c.vat}`, ...(c.address ? [`${L[3]}: ${c.address}`] : []), ...(c.email ? [`${L[4]}: ${c.email}`] : [])],
    },
    { h: L[5], p: [L[6]] },
  ];
}

export function privacy(locale: Locale, c: Company): LegalSection[] {
  return brandDeep(privacyRaw(locale, c));
}

export function terms(locale: Locale, c: Company): LegalSection[] {
  return brandDeep(termsRaw(locale, c));
}
