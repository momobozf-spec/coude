import { DISCLAIMER, EVIDENCE_EXPLAINER, EVIDENCE_LEVELS } from '@/lib/legal/disclaimer';

export const nl = {
  common: {
    appName: 'RentGuard Brussels',
    tagline: 'Uw huurdossier, goed gedocumenteerd.',
    back: 'Terug',
    next: 'Volgende',
    save: 'Bewaren',
    cancel: 'Annuleren',
    delete: 'Verwijderen',
    confirm: 'Bevestigen',
    loading: 'Bezig…',
    optional: 'optioneel',
    required: 'verplicht',
    language: 'Taal',
    dutch: 'Nederlands',
    french: 'Frans',
  },

  nav: {
    dashboard: 'Overzicht',
    properties: 'Woningen',
    inspections: 'Plaatsbeschrijvingen',
    deposit: 'Waarborg',
    audits: 'Huurprijs',
    contract: 'Contract',
    assistant: 'Assistent',
    settings: 'Instellingen',
  },

  auth: {
    signIn: 'Aanmelden',
    signUp: 'Account aanmaken',
    signOut: 'Afmelden',
    email: 'E-mailadres',
    password: 'Wachtwoord',
    fullName: 'Volledige naam',
    checkYourEmail: 'Kijk uw e-mail na voor de bevestigingslink.',
    passwordHint:
      'Minstens 10 tekens. Achter deze login zitten foto’s van uw woning en uw ' +
      'huurcontract.',
    noAccountYet: 'Nog geen account?',
    alreadyHaveAccount: 'Al een account?',
    forgotPassword: 'Wachtwoord vergeten?',
    forgotTitle: 'Wachtwoord opnieuw instellen',
    forgotIntro:
      'Geef het e-mailadres van uw account. U krijgt een link om een nieuw ' +
      'wachtwoord te kiezen.',
    sendResetLink: 'Link versturen',
    resetLinkSent:
      'Als er een account met dit e-mailadres bestaat, ontvangt u binnen enkele ' +
      'minuten een e-mail met een link. Kijk ook in uw spam.',
    resetTitle: 'Kies een nieuw wachtwoord',
    newPassword: 'Nieuw wachtwoord',
    confirmPassword: 'Herhaal het nieuwe wachtwoord',
    savePassword: 'Wachtwoord bewaren',
    resetLinkInvalid:
      'Deze link is verlopen of al gebruikt. Vraag een nieuwe link aan.',
    termsNotice:
      'Door een account aan te maken aanvaardt u de algemene voorwaarden en ' +
      'neemt u kennis van de privacyverklaring.',
    errors: {
      INVALID_INPUT: 'Kijk de ingevulde gegevens na.',
      INVALID_CREDENTIALS: 'Dit e-mailadres en wachtwoord horen niet samen.',
      EMAIL_TAKEN: 'Er bestaat al een account met dit e-mailadres.',
      WEAK_PASSWORD: 'Kies een langer of sterker wachtwoord.',
      RATE_LIMITED: 'Te veel pogingen. Probeer het over enkele minuten opnieuw.',
      UNKNOWN: 'Er ging iets mis. Probeer het opnieuw.',
      PASSWORDS_DO_NOT_MATCH: 'De twee wachtwoorden zijn niet gelijk.',
      SESSION_EXPIRED:
        'Uw herstellink is verlopen. Vraag een nieuwe link aan.',
    },
  },

  property: {
    title: 'Woning',
    address: 'Adres',
    postalCode: 'Postcode',
    municipality: 'Gemeente',
    monthlyRent: 'Maandhuur (excl. lasten)',
    monthlyCharges: 'Maandelijkse lasten',
    depositAmount: 'Huurwaarborg',
    depositType: 'Vorm van de waarborg',
    leaseSignedOn: 'Datum ondertekening huurcontract',
    leaseStart: 'Begin huurovereenkomst',
    leaseEnd: 'Einde huurovereenkomst',
    leaseRegistered: 'Huurcontract geregistreerd bij FOD Financiën',
    pebCertificateProvided: 'EPB-certificaat ontvangen bij aanvang',
    pebRating: 'EPB-label',
    surface: 'Bewoonbare oppervlakte (m²)',
    bedrooms: 'Aantal slaapkamers',
    landlordName: 'Naam verhuurder',
    landlordAddress: 'Adres verhuurder',
    landlordEmail: 'E-mailadres verhuurder',
    landlordDataPurpose:
      'Deze gegevens gebruiken wij uitsluitend om uw brieven te kunnen ' +
      'adresseren en versturen.',
    postalCodeHelp: 'RentGuard werkt voor het Brussels Gewest: 1000 tot 1299.',
    postalCodeInvalid:
      'Deze postcode ligt buiten het Brussels Hoofdstedelijk Gewest. ' +
      'RentGuard is op Brussels huurrecht gebouwd en zou u elders verkeerd informeren.',
  },

  inspection: {
    checkIn: 'Plaatsbeschrijving bij intrek',
    checkOut: 'Plaatsbeschrijving bij vertrek',
    startCheckIn: 'Start uw intrekdossier',
    startCheckOut: 'Start uw vertrekdossier',
    rooms: 'Kamers',
    addRoom: 'Kamer toevoegen',
    photoChecklist: 'Fotochecklist',
    labels: {
      overview: 'Overzicht van de kamer',
      floor: 'Vloer',
      walls: 'Muren en plafond',
      windows: 'Ramen en deuren',
      damage_closeup: 'Close-up van bestaande schade',
      custom: 'Eigen foto',
    },
    photoNote: 'Notitie bij deze foto',
    complete: 'Dossier afronden',
    generateReport: 'Rapport aanmaken',
    downloadReport: 'Rapport downloaden',
    inviteLandlord: 'Verhuurder uitnodigen om mee te ondertekenen',
    inviteSent: 'Uitnodiging verzonden op {date}',
    signedByLandlord: 'Medeondertekend door {name} op {date}',
    whyCosign:
      'Een dossier dat uw verhuurder heeft bevestigd, is bij een latere ' +
      'discussie veel sterker: de tegenpartij heeft de vaststellingen dan ' +
      'aanvaard. Zonder medeondertekening blijft het uw eigen dossier.',
  },

  evidence: {
    title: 'Wat dit dossier aantoont',
    proves: 'Dit staat vast',
    doesNotProve: 'Dit staat niet vast',
    hash: 'Gegevensvingerafdruk (SHA-256)',
    registeredAt: 'Geregistreerd op onze server',
    explainer: EVIDENCE_EXPLAINER.nl,
    levels: EVIDENCE_LEVELS.nl,
  },

  comparison: {
    title: 'Vergelijking intrek — vertrek',
    aiAnalysis: 'AI-analyse',
    yourVerdict: 'Uw oordeel',
    classification: {
      WEAR_AND_TEAR: 'Normale slijtage',
      DAMAGE: 'Schade',
      UNCLEAR: 'Onduidelijk',
    },
    confidence: 'Zekerheid van de analyse',
    lowConfidenceNotice:
      'De analyse is te onzeker om een uitspraak te doen. Beoordeel dit ' +
      'fotopaar zelf.',
    costEstimate: 'Indicatieve kostenraming',
    costUnavailable:
      'Geen kostenraming beschikbaar: er staat geen referentieprijs voor dit ' +
      'type herstelling in onze tabel. Wij vullen geen bedrag in dat wij niet ' +
      'kunnen onderbouwen.',
    reviewRequired:
      'Bevestig of corrigeer elke analyse. Uw oordeel komt in het rapport; de ' +
      'AI-analyse komt in de bijlage.',
    aiIsNotAVerdict:
      'Deze analyse is een hulpmiddel, geen vaststelling. U beslist.',
  },

  deposit: {
    title: 'Huurwaarborg terugvorderen',
    keysReturnedOn: 'Datum waarop u de sleutels hebt teruggegeven',
    depositAmount: 'Bedrag van de waarborg',
    amountRefunded: 'Reeds terugbetaald',
    landlordClaim: 'Inhouding ingeroepen door de verhuurder',
    landlordClaimReason: 'Reden opgegeven door de verhuurder',
    iban: 'Uw rekeningnummer (IBAN)',
    deadlineTitle: 'Wettelijke termijn',
    deadlineOn: 'De termijn verstrijkt op {date}.',
    deadlinePassed: 'De termijn is verstreken op {date}.',
    daysRemaining: 'Nog {days} dagen',
    createNotice: 'Ingebrekestelling opstellen',
  },

  notice: {
    title: 'Ingebrekestelling',
    preview: 'Voorbeeld',
    reviewTitle: 'Eindcontrole',
    reviewIntro:
      'Lees de brief hieronder volledig na. U verstuurt hem in eigen naam. ' +
      'Wij versturen niets zonder uw uitdrukkelijke bevestiging.',
    reviewCheckbox:
      'Ik heb de brief nagelezen en bevestig dat de gegevens kloppen.',
    approve: 'Goedkeuren',
    send: 'Versturen',
    templateStatus: {
      PLACEHOLDER:
        'Deze brieftekst is nog niet door een jurist nagekeken. Lees hem ' +
        'aandachtig na en pas aan waar nodig.',
      REVIEWED: 'Deze brieftekst is nagekeken door een jurist.',
    },
    channel: {
      SELF_SERVICE: 'Zelf aangetekend versturen via het bpost-loket',
      SELF_SERVICE_HELP:
        'U downloadt de brief en verstuurt hem zelf aangetekend. Gratis, en ' +
        'u houdt het verzendingsbewijs zelf bij.',
      EMAIL_PLAIN: 'Gewone e-mail — geen bewijs van ontvangst',
      EMAIL_PLAIN_HELP:
        'Snel, maar zonder enig bewijs dat uw verhuurder de brief ontvangen ' +
        'heeft. Dit is geen aangetekende zending.',
      QERDS: 'Elektronische aangetekende zending',
      QERDS_HELP:
        'Via een gekwalificeerde dienstverlener onder de eIDAS-verordening. ' +
        'Uw verhuurder moet deze vorm aanvaarden.',
      HYBRID_POST: 'Aangetekende brief per post',
      HYBRID_POST_HELP:
        'Wij laten de brief afdrukken en aangetekend bezorgen.',
    },
    channelUnavailable:
      'Dit kanaal is nog niet geconfigureerd en daarom niet beschikbaar.',
    selfServiceSteps: 'Stappenplan voor aangetekende verzending',
  },

  audits: {
    rentGridTitle: 'Toets uw huurprijs aan het indicatieve rooster',
    rentGridIntro:
      'Het Brussels Gewest publiceert een indicatief huurrooster. Het is ' +
      'indicatief: het legt geen wettelijk maximum op.',
    rentGridMethodNotice:
      'De volledige berekeningsmethode van het rooster is niet publiek. Wij ' +
      'rekenen het daarom niet zelf uit, maar begeleiden u naar de officiële ' +
      'tool en vergelijken daarna met uw werkelijke huurprijs.',
    openOfficialTool: 'Open de officiële rekentool',
    referenceRent: 'Referentiehuurprijs volgens de officiële tool',
    gridConsultedOn: 'Datum van raadpleging',
    indexationTitle: 'Controleer de indexatie van uw huurprijs',
    baseRent: 'Basishuurprijs bij aanvang (excl. lasten)',
    claimedNewRent: 'Nieuwe huurprijs die de verhuurder vraagt',
    indexationDate: 'Ingangsdatum van de indexatie',
    allowedRent: 'Toegestane nieuwe huurprijs',
    overpaid: 'Te veel betaald',
    conditionsTitle: 'Voorwaarden voor indexatie',
    baseYearMismatch:
      'De indexcijfers voor deze twee data hebben een verschillend basisjaar. ' +
      'Een berekening daarover zou een fout bedrag geven, dus rekenen wij niet.',
  },

  contract: {
    title: 'Contractscan',
    upload: 'Huurcontract uploaden',
    findings: 'Bevindingen',
    noFindings: 'Wij vonden geen clausules uit onze checklist in dit contract.',
    findingIsSignal:
      'Dit is een signalering op basis van een checklist, geen juridisch ' +
      'oordeel over uw contract.',
    severity: {
      INFO: 'Ter info',
      WARNING: 'Aandachtspunt',
      CRITICAL: 'Belangrijk',
    },
    dismiss: 'Niet van toepassing',
  },

  assistant: {
    title: 'Vragen over uw huurcontract',
    placeholder: 'Stel uw vraag…',
    sources: 'Bronnen',
    outOfScope:
      'Dat weet ik niet zeker. Ik vind in mijn bronnen geen antwoord op deze ' +
      'vraag. Neem contact op met de Huurdersbond of met de juridische ' +
      'eerstelijnsbijstand.',
    onlyFromSources:
      'Ik antwoord uitsluitend op basis van de documenten in mijn kennisbank ' +
      'en toon telkens waar het antwoord vandaan komt.',
  },

  legalStatus: {
    VERIFIED: 'Bron nagekeken',
    UNVERIFIED: 'Nog te verifiëren',
    STALE: 'Verouderde bron',
    verifiedHelp:
      'Deze regel is teruggevonden in een officiële bron op {date}. Ze is nog ' +
      'niet door een jurist beoordeeld.',
    unverifiedHelp:
      'Deze regel steunt op onofficiële bronnen of op bronnen die elkaar ' +
      'tegenspreken. Gebruik ze als aanwijzing, niet als zekerheid.',
    staleHelp:
      'Deze regel werd voor het laatst nagekeken op {date}, meer dan zes ' +
      'maanden geleden. De huurwetgeving in Brussel wijzigt regelmatig.',
    sourceLabel: 'Bron',
    consultedOn: 'Geraadpleegd op',
  },

  legal: {
    disclaimer: DISCLAIMER.nl,
    notLegalAdvice: 'Geen juridisch advies',
    tenantUnion: 'Huurdersbond',
    firstLineAid: 'Juridische eerstelijnsbijstand',
  },

  privacy: {
    retentionTitle: 'Hoe lang bewaren wij uw dossier?',
    retentionDefault:
      'Standaard bewaren wij uw dossier tot {years} jaar na het einde van uw ' +
      'huurovereenkomst.',
    retentionWarning:
      'Let op: vorderingen uit een huurovereenkomst kunnen tot tien jaar lopen. ' +
      'Kiest u een kortere bewaartermijn, dan bent u uw bewijsmateriaal ' +
      'mogelijk kwijt terwijl een vordering nog loopt.',
    retentionExtend: 'Bewaartermijn verlengen',
    exportData: 'Al mijn gegevens exporteren',
    deleteAccount: 'Mijn account en alle gegevens verwijderen',
    deletionScheduled:
      'Uw verwijdering is gepland voor {date}. U kunt dit tot dan annuleren.',
  },

  billing: {
    plans: 'Formules',
    subscribe: 'Abonneren',
    buy: 'Aankopen',
    manageBilling: 'Facturatie beheren',
    freeCheckIn: 'Uw eerste intrekdossier is gratis.',
    plan: {
      tenant_protect: {
        name: 'Tenant Protect',
        description:
          'Assistent, contractscan, indexatie-audits, opslag van uw ' +
          'plaatsbeschrijvingen en brieven.',
      },
      deposit_recovery: {
        name: 'Deposit Recovery',
        description:
          'Vertrekdossier, AI-vergelijking intrek/vertrek en vergelijkend ' +
          'rapport voor één woning.',
      },
      relocation_pass: {
        name: 'All-in Relocation Pass',
        description:
          'Intrek- en vertrekdossier met AI-vergelijking voor één woning, ook ' +
          'als uw gratis intrekdossier al gebruikt is.',
      },
    },
    shippingCostNotice:
      'Verzendkosten voor aangetekende zending worden apart getoond vóór u ' +
      'bevestigt.',
  },

  errors: {
    generic: 'Er ging iets mis. Probeer het opnieuw.',
    notFound: 'Niet gevonden.',
    unauthorized: 'U hebt geen toegang tot deze pagina.',
    integrationMissing:
      'Deze functie vereist een integratie die nog niet geconfigureerd is.',
  },
} as const;

/**
 * Verbreedt letterlijke stringtypes naar `string`, zodat de Franse vertaling
 * dezelfde structuur moet hebben maar niet dezelfde woorden. Een ontbrekende of
 * te veel gedefinieerde sleutel is een typefout.
 */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

export type Messages = Widen<typeof nl>;
