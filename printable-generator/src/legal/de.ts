import type { LegalTexts } from "./types";

// Übersetzung der niederländischen Fassung (nl.ts), die bei Abweichungen maßgeblich ist.
export const de: LegalTexts = {
  privacy: {
    title: "Datenschutzerklärung",
    sections: [
      {
        h: "1. Wer ist verantwortlich?",
        p: [
          "Noor Printables wird betrieben von {NAME}, Unternehmensnummer {CBE}, Sitz: {ADDRESS} („wir“). Wir sind Verantwortlicher für die über Noor Printables verarbeiteten personenbezogenen Daten. Kontakt: {EMAIL}.",
        ],
      },
      {
        h: "2. Für wen ist Noor Printables gedacht? (Kinder)",
        p: [
          "Noor Printables erstellt Arbeitsblätter für Kinder von 4 bis 8 Jahren, der Dienst richtet sich aber an Erwachsene: Eltern, Erziehungsberechtigte, Lehrkräfte und Schulen. Nur Personen ab 18 Jahren dürfen ein Konto anlegen; dies bestätigen Sie bei der Registrierung.",
          "Kinder legen kein Konto an und wir fragen keine personenbezogenen Daten von Kindern ab. In Belgien können Kinder unter 13 Jahren nicht selbst in die Verarbeitung ihrer Daten durch Online-Dienste einwilligen (Art. 8 DSGVO und Art. 7 des belgischen Gesetzes vom 30. Juli 2018); sie nutzen die Arbeitsblätter oder das digitale Malen nur über das Konto und unter Aufsicht eines Elternteils, Erziehungsberechtigten oder einer Lehrkraft.",
          "Geben Sie in Freitextfeldern (z. B. dem Thema eines Arbeitsblatts) keine Namen oder sonstigen Daten von Kindern ein. Wenn Sie vermuten, dass ein Kind ein Konto angelegt oder Daten eines Kindes eingegeben hat, kontaktieren Sie uns: Wir löschen diese Daten.",
          "Optionale Module, die Daten über ein Kind abfragen könnten (z. B. Vorname und Alter für eine Urkunde), sind standardmäßig deaktiviert. Werden sie später aktiviert, gibt nur der Elternteil oder Erziehungsberechtigte diese Daten mit seiner Einwilligung ein, beschränkt auf das Notwendige; sie können jederzeit gelöscht werden.",
        ],
      },
      {
        h: "3. Welche Daten verarbeiten wir?",
        ul: [
          "Kontodaten: Name, E-Mail-Adresse, Passwort (nur als verschlüsselter Hash) oder — bei Anmeldung über Google, Microsoft oder Apple — die eindeutige ID dieses Anbieters und Ihr Profilbild, falls übermittelt.",
          "Nutzungsdaten: welche Arbeitsblätter Sie erstellen (Typ, Thema, Datum) und wie viele, Ihr Tarif, Ihr Empfehlungscode und ggf. wer Sie eingeladen hat.",
          "Zahlungsdaten: Zahlungen werden über Stripe abgewickelt. Wir erhalten keine Karten- oder Kontonummern; wir speichern Ihre Stripe-Kunden-ID, Abonnement-ID und den Abonnementstatus.",
          "Rechnungsdaten von Schulen: Name der Schule, Ansprechpartner, E-Mail, Rechnungsadresse und USt-IdNr., wenn Sie eine Rechnung anfordern.",
          "Kommunikation: E-Mails, die Sie uns senden, und Transaktions-E-Mails, die wir Ihnen senden (z. B. Willkommen, Upgrade-Bestätigung).",
          "Technische Daten: IP-Adresse und technische Protokolle bei unserem Hosting-Anbieter sowie die Cookies, die für die Anmeldung nötig sind (siehe Cookie-Richtlinie).",
          "Nur mit Ihrer Einwilligung: Analysedaten über Google Analytics (siehe Cookie-Richtlinie).",
        ],
      },
      {
        h: "4. Zu welchem Zweck und auf welcher Rechtsgrundlage?",
        ul: [
          "Bereitstellung Ihres Kontos und des Dienstes (Arbeitsblätter erstellen, Abonnement verwalten, Support) — Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).",
          "Zahlungsabwicklung und Buchhaltung — Vertragserfüllung und rechtliche Verpflichtung (Art. 6 Abs. 1 lit. b und c DSGVO).",
          "Sicherheit des Dienstes und Missbrauchsverhinderung (z. B. Limits, Schutz vor Empfehlungsbetrug) — berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).",
          "Analyse und Verbesserung der Website mit Analyse-Cookies — nur mit Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit widerrufen können.",
          "Wir versenden keine Werbe-E-Mails ohne Ihre vorherige Einwilligung. Wir verkaufen Ihre Daten nicht und betreiben kein Profiling und keine automatisierten Entscheidungen mit Rechtswirkung.",
        ],
      },
      {
        h: "5. An wen geben wir Daten weiter?",
        p: [
          "Wir setzen folgende Auftragsverarbeiter ein, die Ihre Daten nur nach unserer Weisung nutzen: unseren Hosting-Anbieter (z. B. Vercel) und Datenbankanbieter (z. B. Turso), vorzugsweise in einer EU-Region; Stripe Payments Europe Ltd. (Irland) für Zahlungen; Resend für den E-Mail-Versand; sowie Google, Microsoft oder Apple nur, wenn Sie sich darüber anmelden. Google Analytics wird nur nach Ihrer Einwilligung genutzt.",
          "Einige dieser Anbieter sind in den USA ansässig oder können dort auf Daten zugreifen. Solche Übermittlungen außerhalb des Europäischen Wirtschaftsraums erfolgen auf Grundlage des EU-U.S. Data Privacy Framework (für zertifizierte Unternehmen) oder der Standardvertragsklauseln der Europäischen Kommission.",
          "Wir geben Daten nur dann an Behörden weiter, wenn wir gesetzlich dazu verpflichtet sind.",
        ],
      },
      {
        h: "6. Wie lange speichern wir Ihre Daten?",
        ul: [
          "Konto- und Nutzungsdaten: solange Ihr Konto besteht. Nach Löschung Ihres Kontos löschen wir sie innerhalb von 30 Tagen, außer wir müssen sie gesetzlich aufbewahren.",
          "Rechnungen und Buchhaltungsunterlagen: für die gesetzliche Aufbewahrungsfrist für Buchhaltungsunterlagen.",
          "Technische Protokolle: so kurz wie möglich, in der Regel höchstens 30 Tage (abhängig vom Hosting-Anbieter).",
          "Ihre Cookie-Auswahl: bis Sie sie ändern oder Ihre Browserdaten löschen.",
        ],
      },
      {
        h: "7. Sicherheit",
        p: ["Passwörter werden nur als bcrypt-Hash gespeichert, alle Verbindungen laufen über HTTPS, und der Zugang zu Verwaltungsfunktionen ist auf Administratoren mit persönlichem Konto beschränkt."],
      },
      {
        h: "8. Ihre Rechte",
        p: [
          "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen auf Grundlage unseres berechtigten Interesses. Eine Einwilligung können Sie jederzeit widerrufen. Senden Sie Ihre Anfrage an {EMAIL}; wir antworten innerhalb eines Monats.",
          "Sie können sich außerdem bei der belgischen Datenschutzbehörde beschweren: Gegevensbeschermingsautoriteit / Autorité de protection des données, Drukpersstraat 35, 1000 Brüssel, contact@apd-gba.be, www.dataprotectionauthority.be.",
        ],
      },
      {
        h: "9. Änderungen",
        p: ["Wir können diese Erklärung anpassen. Das Datum der aktuellen Fassung steht oben. Über wesentliche Änderungen informieren wir registrierte Nutzer per E-Mail."],
      },
    ],
  },

  terms: {
    title: "Nutzungsbedingungen",
    sections: [
      {
        h: "1. Wer sind wir?",
        p: [
          "Noor Printables wird angeboten von {NAME}, Unternehmens- und USt-Nummer {CBE}, Sitz: {ADDRESS}, E-Mail: {EMAIL}.",
          "Diese Bedingungen gelten für jede Nutzung von Noor Printables und für jedes kostenlose oder kostenpflichtige Abonnement.",
        ],
      },
      {
        h: "2. Konto",
        ul: [
          "Sie müssen mindestens 18 Jahre alt sein, um ein Konto anzulegen. Kinder nutzen den Dienst nur unter Aufsicht eines Elternteils, Erziehungsberechtigten oder einer Lehrkraft.",
          "Sie machen korrekte Angaben und halten Ihr Passwort geheim. Sie sind für die Nutzung Ihres Kontos verantwortlich.",
          "Sie können Ihr Konto jederzeit über {EMAIL} löschen lassen.",
        ],
      },
      {
        h: "3. Der Dienst",
        p: [
          "Mit Noor Printables erstellen Sie islamische Arbeitsblätter (Malvorlagen, Labyrinthe, Suchrätsel) als PDF und können digital malen. Der kostenlose Tarif erlaubt eine begrenzte Anzahl Arbeitsblätter; Pro und School bieten unbegrenzt viele.",
          "Wir bemühen uns, religiöse Texte, arabische Buchstaben und Übersetzungen korrekt darzustellen. Wenn Sie einen Fehler bemerken, melden Sie ihn bitte, damit wir ihn beheben können.",
          "Wir streben eine gute Verfügbarkeit an, können aber keinen unterbrechungsfreien Betrieb garantieren. Wir können Funktionen ändern oder ergänzen; wesentliche Änderungen eines kostenpflichtigen Abonnements kündigen wir vorab an.",
        ],
      },
      {
        h: "4. Preise, Zahlung und Verlängerung",
        ul: [
          "Die aktuellen Preise stehen auf der Website und verstehen sich für Verbraucher inklusive MwSt. Den zu zahlenden Betrag sehen Sie immer vor der Bestätigung auf der Stripe-Zahlungsseite.",
          "Pro- und School-Abonnements laufen monatlich oder jährlich und verlängern sich automatisch um denselben Zeitraum, bis Sie kündigen.",
          "Sie können jederzeit über Ihr Konto (Stripe-Kundenportal) kündigen. Die Kündigung wird zum Ende des laufenden bezahlten Zeitraums wirksam; für diesen Zeitraum erfolgt keine Erstattung, außer bei Widerruf (Abschnitt 5) oder wenn das Gesetz es vorschreibt.",
          "Über Preisänderungen informieren wir mindestens 30 Tage im Voraus. Sind Sie nicht einverstanden, können Sie vor Inkrafttreten des neuen Preises kündigen.",
          "Schlägt eine Zahlung fehl, behalten Sie vorübergehend Zugang; nach wiederholt fehlgeschlagenen Zahlungen wird Ihr Konto auf den kostenlosen Tarif umgestellt.",
        ],
      },
      {
        h: "5. Widerrufsrecht (Verbraucher)",
        p: [
          "Als Verbraucher haben Sie das Recht, ein kostenpflichtiges Abonnement binnen 14 Tagen nach Vertragsschluss ohne Angabe von Gründen zu widerrufen.",
          "Verlangen Sie ausdrücklich, dass der Dienst sofort beginnt (durch sofortige Aktivierung des Abonnements), zahlen Sie im Fall des Widerrufs einen Betrag, der dem bis zum Widerruf Geleisteten entspricht.",
          "Bei Arbeitsblättern, die Sie als digitale Inhalte herunterladen, erlischt das Widerrufsrecht mit Beginn des Downloads, wenn Sie dem vorher ausdrücklich zugestimmt und bestätigt haben, dass Sie dadurch Ihr Widerrufsrecht verlieren (Art. VI.53, 13° belgisches Wirtschaftsgesetzbuch).",
          "Um zu widerrufen, senden Sie eine eindeutige Erklärung an {EMAIL}, zum Beispiel mit diesem Musterformular: „An {NAME}, {ADDRESS}, {EMAIL}: Hiermit widerrufe ich meinen Vertrag über das Abonnement [Pro/School]. Bestellt am: [Datum]. Name: [Name]. E-Mail des Kontos: [E-Mail]. Datum: [Datum].“ Wir erstatten den geschuldeten Betrag binnen 14 Tagen über dasselbe Zahlungsmittel.",
        ],
      },
      {
        h: "6. Nutzung der Arbeitsblätter (Lizenz)",
        ul: [
          "Sie dürfen mit Noor Printables erstellte Arbeitsblätter ausdrucken und in Ihrer Familie sowie — mit einem Pro- oder School-Abonnement — in Ihren eigenen Klassen und Unterrichtsstunden verwenden, auch wenn Sie für diesen Unterricht bezahlt werden.",
          "Mit einem School-Abonnement darf die Schule die Arbeitsblätter in ihren eigenen Klassen verwenden.",
          "Nicht erlaubt: Arbeitsblätter (digital oder gedruckt) als solche weiterzuverkaufen, öffentlich online zu verbreiten oder in einem konkurrierenden Dienst anzubieten sowie den Dienst automatisiert oder massenhaft auszulesen.",
          "Software, Designs und Vorlagen bleiben Eigentum von {NAME} oder ihren Lizenzgebern.",
        ],
      },
      {
        h: "7. Faire Nutzung und Missbrauch",
        p: ["Sie nutzen den Dienst nicht für rechtswidrige Zwecke, versuchen nicht, Limits oder Sicherheitsmaßnahmen zu umgehen, und legen keine Fake-Konten an (z. B. für Empfehlungsboni). Bei Missbrauch können wir Boni entziehen, den Zugang beschränken oder das Konto beenden, nach vorheriger Warnung, sofern zumutbar."],
      },
      {
        h: "8. Haftung",
        p: ["Wir erbringen den Dienst mit der gebotenen Sorgfalt. Soweit gesetzlich zulässig, haften wir nicht für indirekte Schäden (z. B. entgangenen Gewinn). Unsere Haftung ist in jedem Fall auf den Betrag begrenzt, den Sie in den 12 Monaten vor dem Schadensereignis gezahlt haben. Diese Beschränkungen gelten nicht bei Vorsatz, grober Fahrlässigkeit, Tod oder Körperverletzung und berühren Ihre zwingenden Verbraucherrechte nicht."],
      },
      {
        h: "9. Beschwerden und Streitigkeiten",
        p: [
          "Beschwerden richten Sie bitte per E-Mail an {EMAIL}; wir antworten binnen 14 Tagen. Verbraucher können sich auch an den belgischen Verbraucherschlichtungsdienst wenden (www.consumentenombudsdienst.be).",
          "Es gilt belgisches Recht. Streitigkeiten werden den zuständigen Gerichten vorgelegt; als Verbraucher behalten Sie den Schutz der zwingenden Vorschriften Ihres Wohnsitzlandes.",
        ],
      },
      {
        h: "10. Änderungen",
        p: ["Wir können diese Bedingungen ändern. Wesentliche Änderungen kündigen wir mindestens 30 Tage vorher per E-Mail an; Sie können dann vor Inkrafttreten kündigen."],
      },
    ],
  },

  cookies: {
    title: "Cookie-Richtlinie",
    sections: [
      {
        h: "1. Was sind Cookies?",
        p: ["Cookies sind kleine Textdateien, die eine Website auf Ihrem Gerät speichert. Ähnliche Techniken wie der lokale Speicher (localStorage) Ihres Browsers fallen ebenfalls unter diese Richtlinie."],
      },
      {
        h: "2. Unbedingt erforderliche Cookies (keine Einwilligung nötig)",
        ul: [
          "authjs.session-token / __Secure-authjs.session-token — hält Sie angemeldet; bis zu 30 Tage.",
          "authjs.csrf-token / __Host-authjs.csrf-token — Schutz vor gefälschten Anfragen; Sitzung.",
          "authjs.callback-url / __Secure-authjs.callback-url — merkt sich das Ziel nach der Anmeldung; Sitzung.",
          "Lokaler Speicher „noor-locale“ — Ihre Sprachauswahl; bis zur Löschung.",
          "Lokaler Speicher „noor-cookie-consent“ — Ihre Cookie-Auswahl; bis zur Änderung oder Löschung.",
        ],
      },
      {
        h: "3. Analyse-Cookies (nur mit Einwilligung)",
        p: ["Mit Ihrer Einwilligung nutzen wir Google Analytics (Google Ireland Ltd.) zur Messung der Websitenutzung mit gekürzter IP-Adresse. Cookies: _ga und _ga_<ID>, Speicherdauer bis zu 2 Jahre. Ohne Einwilligung wird Google Analytics nicht geladen."],
      },
      {
        h: "4. Cookies von Dritten bei der Zahlung",
        p: ["Bei der Zahlung werden Sie zu Stripe weitergeleitet. Stripe setzt dort eigene Cookies (u. a. zur Betrugsprävention) gemäß seiner eigenen Cookie-Richtlinie."],
      },
      {
        h: "5. Ihre Auswahl verwalten",
        p: ["Sie können Ihre Auswahl jederzeit über „Cookie-Einstellungen“ unten auf jeder Seite ändern oder Cookies in Ihren Browsereinstellungen löschen. Fragen: {EMAIL}."],
      },
    ],
  },

  legal: {
    title: "Impressum",
    sections: [
      {
        h: "Betreiber",
        ul: ["{NAME}", "Sitz: {ADDRESS}", "Unternehmensnummer (ZDU) und USt-IdNr.: {CBE}", "E-Mail: {EMAIL}"],
      },
      {
        h: "Dokumente",
        p: ["Siehe auch unsere Datenschutzerklärung, Nutzungsbedingungen und Cookie-Richtlinie (Links unten auf jeder Seite)."],
      },
    ],
  },
};
