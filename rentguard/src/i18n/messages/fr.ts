import { DISCLAIMER, EVIDENCE_EXPLAINER, EVIDENCE_LEVELS } from '@/lib/legal/disclaimer';

import type { Messages } from '@/i18n/messages/nl';

export const fr: Messages = {
  common: {
    appName: 'RentGuard Brussels',
    tagline: 'Votre dossier locatif, bien documenté.',
    back: 'Retour',
    next: 'Suivant',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    confirm: 'Confirmer',
    loading: 'En cours…',
    optional: 'facultatif',
    required: 'obligatoire',
    language: 'Langue',
    dutch: 'Néerlandais',
    french: 'Français',
  },

  nav: {
    dashboard: 'Aperçu',
    properties: 'Logements',
    inspections: 'États des lieux',
    deposit: 'Garantie',
    audits: 'Loyer',
    contract: 'Bail',
    assistant: 'Assistant',
    settings: 'Paramètres',
  },

  auth: {
    signIn: 'Se connecter',
    signUp: 'Créer un compte',
    signOut: 'Se déconnecter',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    fullName: 'Nom complet',
    checkYourEmail: 'Consultez votre e-mail pour le lien de confirmation.',
    passwordHint:
      'Au moins 10 caractères. Derrière cette connexion se trouvent des photos ' +
      'de votre logement et votre bail.',
    noAccountYet: 'Pas encore de compte ?',
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    errors: {
      INVALID_INPUT: 'Vérifiez les données saisies.',
      INVALID_CREDENTIALS: 'Cette adresse e-mail et ce mot de passe ne correspondent pas.',
      EMAIL_TAKEN: 'Un compte existe déjà avec cette adresse e-mail.',
      WEAK_PASSWORD: 'Choisissez un mot de passe plus long ou plus robuste.',
      RATE_LIMITED: 'Trop de tentatives. Réessayez dans quelques minutes.',
      UNKNOWN: 'Une erreur est survenue. Réessayez.',
    },
  },

  property: {
    title: 'Logement',
    address: 'Adresse',
    postalCode: 'Code postal',
    municipality: 'Commune',
    monthlyRent: 'Loyer mensuel (hors charges)',
    monthlyCharges: 'Charges mensuelles',
    depositAmount: 'Garantie locative',
    depositType: 'Forme de la garantie',
    leaseSignedOn: 'Date de signature du bail',
    leaseStart: 'Début du bail',
    leaseEnd: 'Fin du bail',
    leaseRegistered: 'Bail enregistré auprès du SPF Finances',
    pebCertificateProvided: 'Certificat PEB reçu au début du bail',
    pebRating: 'Label PEB',
    surface: 'Surface habitable (m²)',
    bedrooms: 'Nombre de chambres',
    landlordName: 'Nom du bailleur',
    landlordAddress: 'Adresse du bailleur',
    landlordEmail: 'Adresse e-mail du bailleur',
    landlordDataPurpose:
      'Nous utilisons ces données uniquement pour adresser et envoyer vos ' +
      'courriers.',
    postalCodeHelp:
      'RentGuard couvre la Région bruxelloise : 1000 à 1299.',
    postalCodeInvalid:
      'Ce code postal se situe en dehors de la Région de Bruxelles-Capitale. ' +
      'RentGuard est construit sur le droit locatif bruxellois et vous ' +
      'informerait mal ailleurs.',
  },

  inspection: {
    checkIn: "État des lieux d'entrée",
    checkOut: 'État des lieux de sortie',
    startCheckIn: "Démarrer votre dossier d'entrée",
    startCheckOut: 'Démarrer votre dossier de sortie',
    rooms: 'Pièces',
    addRoom: 'Ajouter une pièce',
    photoChecklist: 'Liste de photos',
    labels: {
      overview: "Vue d'ensemble de la pièce",
      floor: 'Sol',
      walls: 'Murs et plafond',
      windows: 'Fenêtres et portes',
      damage_closeup: 'Gros plan des dégâts existants',
      custom: 'Photo libre',
    },
    photoNote: 'Note pour cette photo',
    complete: 'Clôturer le dossier',
    generateReport: 'Générer le rapport',
    downloadReport: 'Télécharger le rapport',
    inviteLandlord: 'Inviter le bailleur à cosigner',
    inviteSent: 'Invitation envoyée le {date}',
    signedByLandlord: 'Cosigné par {name} le {date}',
    whyCosign:
      'Un dossier que votre bailleur a confirmé pèse nettement plus lourd en ' +
      'cas de discussion ultérieure : la partie adverse a alors accepté les ' +
      'constatations. Sans cosignature, il reste votre dossier.',
  },

  evidence: {
    title: 'Ce que ce dossier établit',
    proves: 'Ceci est établi',
    doesNotProve: "Ceci n'est pas établi",
    hash: 'Empreinte numérique (SHA-256)',
    registeredAt: 'Enregistré sur notre serveur',
    explainer: EVIDENCE_EXPLAINER.fr,
    levels: EVIDENCE_LEVELS.fr,
  },

  comparison: {
    title: 'Comparaison entrée — sortie',
    aiAnalysis: 'Analyse IA',
    yourVerdict: 'Votre appréciation',
    classification: {
      WEAR_AND_TEAR: 'Usure normale',
      DAMAGE: 'Dégât',
      UNCLEAR: 'Incertain',
    },
    confidence: "Degré de certitude de l'analyse",
    lowConfidenceNotice:
      "L'analyse est trop incertaine pour conclure. Appréciez vous-même cette " +
      'paire de photos.',
    costEstimate: 'Estimation indicative du coût',
    costUnavailable:
      "Pas d'estimation disponible : aucun prix de référence pour ce type de " +
      "réparation ne figure dans notre table. Nous n'inscrivons pas un montant " +
      'que nous ne pouvons pas justifier.',
    reviewRequired:
      'Confirmez ou corrigez chaque analyse. Votre appréciation figure dans le ' +
      "rapport ; l'analyse IA figure en annexe.",
    aiIsNotAVerdict:
      "Cette analyse est un outil d'aide, pas une constatation. C'est vous qui " +
      'décidez.',
  },

  deposit: {
    title: 'Récupérer votre garantie locative',
    keysReturnedOn: 'Date à laquelle vous avez remis les clés',
    depositAmount: 'Montant de la garantie',
    amountRefunded: 'Déjà remboursé',
    landlordClaim: 'Retenue invoquée par le bailleur',
    landlordClaimReason: 'Motif indiqué par le bailleur',
    iban: 'Votre numéro de compte (IBAN)',
    deadlineTitle: 'Délai légal',
    deadlineOn: 'Le délai expire le {date}.',
    deadlinePassed: 'Le délai a expiré le {date}.',
    daysRemaining: 'Encore {days} jours',
    createNotice: 'Rédiger une mise en demeure',
  },

  notice: {
    title: 'Mise en demeure',
    preview: 'Aperçu',
    reviewTitle: 'Contrôle final',
    reviewIntro:
      'Relisez intégralement le courrier ci-dessous. Vous l’envoyez en votre ' +
      "propre nom. Nous n'envoyons rien sans votre confirmation explicite.",
    reviewCheckbox:
      'J’ai relu le courrier et je confirme que les données sont exactes.',
    approve: 'Approuver',
    send: 'Envoyer',
    templateStatus: {
      PLACEHOLDER:
        "Ce modèle de courrier n'a pas encore été relu par un juriste. Lisez-le " +
        'attentivement et adaptez-le si nécessaire.',
      REVIEWED: 'Ce modèle de courrier a été relu par un juriste.',
    },
    channel: {
      SELF_SERVICE: 'Envoyer vous-même en recommandé au guichet bpost',
      SELF_SERVICE_HELP:
        'Vous téléchargez le courrier et l’envoyez vous-même en recommandé. ' +
        'Gratuit, et vous conservez la preuve d’envoi.',
      EMAIL_PLAIN: 'E-mail ordinaire — aucune preuve de réception',
      EMAIL_PLAIN_HELP:
        'Rapide, mais sans aucune preuve que votre bailleur a reçu le courrier. ' +
        "Il ne s'agit pas d'un envoi recommandé.",
      QERDS: 'Envoi recommandé électronique',
      QERDS_HELP:
        'Via un prestataire qualifié au sens du règlement eIDAS. Votre bailleur ' +
        'doit accepter cette forme.',
      HYBRID_POST: 'Courrier recommandé par la poste',
      HYBRID_POST_HELP:
        'Nous faisons imprimer le courrier et le faisons remettre en recommandé.',
    },
    channelUnavailable:
      "Ce canal n'est pas encore configuré et n'est donc pas disponible.",
    selfServiceSteps: 'Marche à suivre pour un envoi recommandé',
  },

  audits: {
    rentGridTitle: 'Comparez votre loyer à la grille indicative',
    rentGridIntro:
      'La Région bruxelloise publie une grille indicative des loyers. Elle est ' +
      "indicative : elle n'impose pas de maximum légal.",
    rentGridMethodNotice:
      "La méthode de calcul complète de la grille n'est pas publique. Nous ne " +
      "la recalculons donc pas nous-mêmes : nous vous guidons vers l'outil " +
      'officiel, puis nous comparons avec votre loyer réel.',
    openOfficialTool: "Ouvrir l'outil officiel",
    referenceRent: "Loyer de référence selon l'outil officiel",
    gridConsultedOn: 'Date de consultation',
    indexationTitle: "Vérifiez l'indexation de votre loyer",
    baseRent: 'Loyer de base au début du bail (hors charges)',
    claimedNewRent: 'Nouveau loyer demandé par le bailleur',
    indexationDate: "Date de prise d'effet de l'indexation",
    allowedRent: 'Nouveau loyer autorisé',
    overpaid: 'Trop-perçu',
    conditionsTitle: "Conditions de l'indexation",
    baseYearMismatch:
      'Les indices de ces deux dates ont une année de base différente. Un ' +
      'calcul sur cette base donnerait un montant erroné : nous ne calculons ' +
      'donc pas.',
  },

  contract: {
    title: 'Analyse du bail',
    upload: 'Téléverser le bail',
    findings: 'Constats',
    noFindings:
      "Nous n'avons trouvé dans ce bail aucune clause de notre liste de contrôle.",
    findingIsSignal:
      "Il s'agit d'un signalement basé sur une liste de contrôle, pas d'un " +
      'jugement juridique sur votre bail.',
    severity: {
      INFO: 'Pour information',
      WARNING: "Point d'attention",
      CRITICAL: 'Important',
    },
    dismiss: 'Sans objet',
  },

  assistant: {
    title: 'Questions sur votre bail',
    placeholder: 'Posez votre question…',
    sources: 'Sources',
    outOfScope:
      "Je n'en suis pas certain. Mes sources ne répondent pas à cette question. " +
      "Contactez le Syndicat des locataires ou l'aide juridique de première " +
      'ligne.',
    onlyFromSources:
      'Je réponds uniquement sur la base des documents de ma base de ' +
      "connaissances et j'indique chaque fois d'où vient la réponse.",
  },

  legalStatus: {
    VERIFIED: 'Source vérifiée',
    UNVERIFIED: 'À vérifier',
    STALE: 'Source périmée',
    verifiedHelp:
      'Cette règle a été retrouvée dans une source officielle le {date}. Elle ' +
      "n'a pas encore été appréciée par un juriste.",
    unverifiedHelp:
      'Cette règle repose sur des sources non officielles ou contradictoires. ' +
      "Utilisez-la comme indication, pas comme certitude.",
    staleHelp:
      'Cette règle a été vérifiée pour la dernière fois le {date}, il y a plus ' +
      'de six mois. La législation locative bruxelloise change régulièrement.',
    sourceLabel: 'Source',
    consultedOn: 'Consultée le',
  },

  legal: {
    disclaimer: DISCLAIMER.fr,
    notLegalAdvice: 'Pas un conseil juridique',
    tenantUnion: 'Syndicat des locataires',
    firstLineAid: 'Aide juridique de première ligne',
  },

  privacy: {
    retentionTitle: 'Combien de temps conservons-nous votre dossier ?',
    retentionDefault:
      'Par défaut, nous conservons votre dossier jusqu’à {years} ans après la ' +
      'fin de votre bail.',
    retentionWarning:
      'Attention : les actions découlant d’un bail peuvent courir jusqu’à dix ' +
      'ans. Si vous choisissez une durée plus courte, vous risquez de perdre ' +
      'vos preuves alors qu’une action est encore possible.',
    retentionExtend: 'Prolonger la durée de conservation',
    exportData: 'Exporter toutes mes données',
    deleteAccount: 'Supprimer mon compte et toutes mes données',
    deletionScheduled:
      'Votre suppression est prévue le {date}. Vous pouvez l’annuler jusque-là.',
  },

  billing: {
    plans: 'Formules',
    subscribe: 'S’abonner',
    buy: 'Acheter',
    manageBilling: 'Gérer la facturation',
    freeCheckIn: "Votre premier dossier d'entrée est gratuit.",
    plan: {
      tenant_protect: {
        name: 'Tenant Protect',
        description:
          'Assistant, analyse du bail, audits d’indexation, conservation de vos ' +
          'états des lieux et courriers.',
      },
      deposit_recovery: {
        name: 'Deposit Recovery',
        description:
          'Analyse de sortie, dossier de garantie complet et mise en demeure ' +
          'pour un logement.',
      },
      relocation_pass: {
        name: 'All-in Relocation Pass',
        description:
          'Entrée, sortie et audit du bail pour un déménagement.',
      },
    },
    shippingCostNotice:
      "Les frais d'envoi recommandé sont affichés séparément avant votre " +
      'confirmation.',
  },

  errors: {
    generic: 'Une erreur est survenue. Réessayez.',
    notFound: 'Introuvable.',
    unauthorized: "Vous n'avez pas accès à cette page.",
    integrationMissing:
      "Cette fonction requiert une intégration qui n'est pas encore configurée.",
  },
};
