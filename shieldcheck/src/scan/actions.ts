import type { CheckResult, SettingsTarget } from './types';

export interface ActionItem {
  id: string;
  title: string;
  body: string;
  /** 'finding' = hoort bij een echte bevinding en telt mee in de score; 'tip' = algemene tip. */
  kind: 'finding' | 'tip';
  /** Bij 'finding': de controle waar deze actie bij hoort. */
  checkId?: string;
  settings?: SettingsTarget;
  manualSteps?: string;
}

/** Acties op basis van echte bevindingen: alleen voor geverifieerde controles die niet in orde zijn. */
export function actionsFromResults(results: CheckResult[]): ActionItem[] {
  const actions: ActionItem[] = [];
  for (const r of results) {
    if (r.source !== 'verified' || r.weight <= 0) continue;
    if (r.outcome !== 'attention' && r.outcome !== 'risk') continue;

    if (r.id === 'os_version') {
      actions.push({
        id: 'act_os_update',
        kind: 'finding',
        checkId: r.id,
        title: 'Installeer de nieuwste systeemupdate',
        body: r.summary,
        settings: r.settings,
        manualSteps: r.manualSteps,
      });
    } else if (r.id === 'screen_lock') {
      actions.push({
        id: 'act_screen_lock',
        kind: 'finding',
        checkId: r.id,
        title: 'Stel een schermvergrendeling in',
        body: 'Kies een pincode van minstens 6 cijfers, een wachtwoord of biometrie. Zo blijven je gegevens beschermd als je toestel verloren raakt.',
        settings: r.settings,
        manualSteps: r.manualSteps,
      });
    }
  }
  return actions;
}

/** Algemene tips: los van een meting, tellen niet mee in de score. */
export function generalTips(): ActionItem[] {
  return [
    {
      id: 'tip_permissions',
      kind: 'tip',
      title: 'Kijk de toestemmingen van je apps na',
      body: 'Gaat een app aan locatie, contacten, camera of microfoon zonder dat je weet waarom? Zet die toegang dan uit.',
      settings: 'privacy',
      manualSteps: 'iPhone: Instellingen > Privacy en beveiliging. Android: Instellingen > Privacy > Toestemmingsbeheer.',
    },
    {
      id: 'tip_wifi',
      kind: 'tip',
      title: 'Controleer de beveiliging van je wifi',
      body: 'Je thuisnetwerk hoort WPA2 of WPA3 te gebruiken. Doe op openbare wifi geen bankzaken.',
      settings: 'wifi',
      manualSteps: 'iPhone: Instellingen > Wifi > (i) naast je netwerk. Android: Instellingen > Netwerk en internet > Wifi.',
    },
    {
      id: 'tip_2fa',
      kind: 'tip',
      title: 'Zet tweestapsverificatie aan voor je e-mail',
      body: 'Je e-mailaccount is de sleutel tot je andere accounts. Met een tweede stap (app of sms-code) is een gelekt wachtwoord alleen niet genoeg.',
      manualSteps: 'Open de beveiligingsinstellingen van je e-mailaccount (bv. via de website van je provider).',
    },
    {
      id: 'tip_report',
      kind: 'tip',
      title: 'Meld verdachte berichten',
      body: 'België: stuur verdachte mails door naar suspicious@safeonweb.be. Nederland: meld fraude bij de Fraudehelpdesk. Klik niet op de link.',
    },
  ];
}
