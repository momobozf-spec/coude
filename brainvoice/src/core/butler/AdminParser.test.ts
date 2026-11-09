import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { AdminParser, parseInvoiceLines, parsePeriod } from './AdminParser';
import { EMPTY_FOCUS, type ButlerFocus } from './focus';
import type { CommandOf } from '../intent/schema';
import type { Language } from '../types/common';

const TZ = 'Europe/Brussels';
const NOW = DateTime.fromISO('2026-10-03T10:00:00', { zone: TZ }); // Saturday
const parser = new AdminParser();

function parse(text: string, language: Language = 'nl', focus: Partial<ButlerFocus> | null = null): CommandOf<'BUTLER_TOOL'> | null {
  const batch = parser.parse({ text, language, now: NOW, timezone: TZ, source: 'text', focus: focus ? { ...EMPTY_FOCUS, ...focus, updatedAt: NOW.toISO() } : null });
  const first = batch?.commands[0];
  return first && first.intent === 'BUTLER_TOOL' ? first : null;
}

interface Case {
  text: string;
  language?: Language;
  focus?: Partial<ButlerFocus> | null;
  tool: string | null;
  args?: Record<string, unknown>;
  missing?: string;
}

const FOCUS_EMAIL = { emailId: 'e1', contactId: 'c1' };
const FOCUS_DRAFT = { emailId: 'e1', draftId: 'd1' };

const CASES: Case[] = [
  // §132 natural administrative commands (Dutch)
  { text: 'Welke mails moet ik nog beantwoorden?', tool: 'email.needsReply' },
  { text: 'Wie moet mij nog antwoorden?', tool: 'followup.list', args: { kind: 'waiting_for' } },
  { text: 'Welke facturen staan nog open?', tool: 'invoice.list', args: { filter: 'open' } },
  { text: 'Welke facturen moet ik deze week betalen?', tool: 'invoice.list', args: { filter: 'due_this_week', direction: 'incoming' } },
  { text: 'Heb ik Weston al betaald?', tool: 'invoice.paymentStatus', args: { query: 'Weston' } },
  { text: 'Maak een factuur voor klant X.', tool: 'invoice.create', missing: 'lines' },
  { text: 'Maak een factuur voor klant X voor 5 werkdagen aan €750 per dag.', tool: 'invoice.create', args: { client: 'X', lines: [{ description: '5 werkdagen', quantity: 5, unit: 'day', unitPriceCents: 75000 }] } },
  { text: 'Maak een factuur voor GO!', tool: 'invoice.create', missing: 'lines' },
  { text: 'Maak mijn factuur voor september.', tool: 'timesheet.invoice', args: { from: '2026-09-01', to: '2026-09-30' } },
  { text: 'Wanneer vervalt deze factuur?', focus: { invoiceId: 'i1' }, tool: 'invoice.get' },
  { text: 'Wanneer vervalt deze factuur?', tool: null },
  { text: 'Herinner mij twee dagen voor de vervaldag.', focus: { invoiceId: 'i1' }, tool: 'invoice.remind', args: { daysBefore: 2 } },
  { text: 'Zoek mijn contract met klant X.', tool: 'document.search', args: { type: 'contract', client: 'X' } },
  { text: 'Wanneer loopt mijn contract af?', tool: 'document.expiring', args: { type: 'contract' } },
  { text: 'Wat staat nog open voor project X?', tool: 'project.status', args: { project: 'X' } },
  { text: 'Wat staat er nog open voor het dashboard?', tool: 'project.status', args: { project: 'dashboard' } },
  { text: 'Wat staat nog open bij klant X?', tool: 'company.open', args: { client: 'X' } },
  { text: 'Welke blockers heb ik?', tool: 'project.blockers' },
  { text: 'Bereid mij voor op mijn meeting.', tool: 'meeting.prepare' },
  { text: 'Bereid mij voor op de meeting met Sven.', tool: 'meeting.prepare', args: { person: 'Sven' } },
  { text: 'Wat hebben we vorige keer beslist?', tool: 'project.decisions', args: { lastMeeting: true } },
  { text: 'Waarom hebben we gekozen voor een stermodel?', tool: 'project.decisions', args: { query: 'stermodel' } },
  { text: 'Maak taken van deze meeting notes.', tool: 'meeting.extractActions', missing: 'notes' },
  { text: 'Verwerk dit: Beslist: sterschema gebruiken. Actie (Sven): toegang regelen. Risico: API-toegang nog niet goedgekeurd.', tool: 'meeting.extractActions' },
  { text: 'Welke deadlines heb ik deze week?', tool: 'admin.deadlines', args: { from: '2026-09-28', to: '2026-10-04' } },
  { text: 'Waar wacht ik nog op?', tool: 'followup.list' },
  { text: 'Wat moet ik vandaag doen?', tool: 'admin.today' },
  { text: 'Wat moet ik morgen doen?', tool: null },
  { text: 'Geef mij mijn projectoverzicht voor deze week.', tool: 'admin.weeklyReview' },
  { text: 'Toon alles rond project X.', tool: 'project.everything', args: { project: 'X' } },
  { text: 'Wat is de volgende stap?', tool: 'project.nextStep' },
  { text: 'Wat blokkeert dit project?', tool: 'project.blockers' },
  { text: 'Waarom staat dit stil?', tool: 'project.blockers' },
  { text: 'Welke actiepunten kwamen uit de laatste meeting?', tool: 'meeting.actions' },
  { text: 'Noteer 8 uur voor project X vandaag.', tool: 'timesheet.create', args: { minutes: 480, project: 'X', date: '2026-10-03' } },
  { text: 'Hoeveel dagen heb ik deze maand gewerkt voor klant X?', tool: 'timesheet.summary', args: { client: 'X', from: '2026-10-01', to: '2026-10-31', unit: 'days' } },
  { text: 'Dit was voor project X.', focus: { expenseId: 'x1' }, tool: 'expense.assign', args: { project: 'X' } },
  { text: 'Dit was voor project X.', tool: null },
  { text: 'Maak hier een taak van.', focus: FOCUS_EMAIL, tool: 'project.addTask', args: { fromFocus: true } },
  { text: 'Zet dit onder project RedSift.', focus: { taskId: 't1' }, tool: 'project.assign', args: { project: 'RedSift' } },
  { text: 'Open de laatste mail van Fabrice.', tool: 'email.open', args: { from: 'Fabrice' } },
  { text: 'Open die mail van de recruiter.', tool: 'email.open', args: { audience: 'recruiter' } },
  { text: 'Wat wil hij van mij?', focus: FOCUS_EMAIL, tool: 'email.briefing' },
  { text: 'Wat wil hij van mij?', tool: null },
  { text: 'Oké antwoord dat ik dit morgen bekijk.', focus: FOCUS_EMAIL, tool: 'email.draftReply', args: { instruction: 'dat ik dit morgen bekijk' } },
  { text: 'Maak het iets professioneler.', focus: FOCUS_DRAFT, tool: 'email.refineDraft', args: { instruction: 'professioneler' } },
  { text: 'Stuur.', focus: FOCUS_DRAFT, tool: 'email.send' },
  { text: 'Stuur.', tool: null },
  { text: 'Beantwoord die mail van de recruiter.', tool: 'email.draftReply', missing: 'instruction', args: { audience: 'recruiter' } },
  { text: 'Antwoord eerst die recruiter.', tool: 'email.draftReply', missing: 'instruction', args: { audience: 'recruiter' } },
  { text: 'Zeg dat ik maandag beschikbaar ben.', focus: FOCUS_DRAFT, tool: 'email.refineDraft', args: { instruction: 'dat ik maandag beschikbaar ben' } },
  { text: 'Zeg dat ik maandag beschikbaar ben.', focus: FOCUS_EMAIL, tool: 'email.draftReply', args: { instruction: 'dat ik maandag beschikbaar ben' } },
  { text: 'Antwoord vriendelijk dat ik de factuur nog niet via Peppol heb ontvangen.', focus: FOCUS_EMAIL, tool: 'email.draftReply', args: { style: 'professional_friendly', instruction: 'dat ik de factuur nog niet via Peppol heb ontvangen' } },
  { text: 'Vraag Sven of hij dit kan nakijken.', tool: 'email.compose', args: { to: 'Sven', instruction: 'of hij dit kan nakijken' } },
  { text: 'Ze zouden mij deze week antwoorden.', focus: FOCUS_EMAIL, tool: 'followup.create', args: { kind: 'waiting_for', expectedDate: '2026-10-04' } },
  { text: 'Meeting met Sven is gedaan. Hij gaat de toegang regelen. Ik moet tegen vrijdag de dashboardaanpassing doen.', tool: 'meeting.debrief' },
  { text: 'De API toegang is nog niet goedgekeurd en kan onze planning blokkeren.', tool: 'project.addRisk' },
  { text: 'Als ik een factuur ontvang, herinner mij drie dagen voor de vervaldatum.', tool: 'workflow.create' },
  { text: 'Herinner mij op het einde van elke maand mijn facturen op te maken.', tool: 'admin.recurring', args: { title: 'Facturen opmaken', schedule: 'month_end', firstDate: '2026-10-31' } },
  { text: 'Maak daarna een reminder voor die factuur.', focus: { invoiceId: 'i1' }, tool: 'invoice.remind', args: { daysBefore: 3 } },
  { text: 'Antwoord recruiters altijd professioneel maar vriendelijk.', tool: 'style.set', args: { audience: 'recruiter', style: 'professional_friendly' } },
  { text: 'Keur alles goed.', focus: { suggestionIds: ['s1'] }, tool: 'suggestions.approve', args: { all: true } },
  { text: 'Keur alles goed.', tool: null },
  { text: 'Herinner mij morgen om 8 uur om Yakup te bellen.', tool: null },
  { text: 'Ik moet morgen melk kopen.', tool: null },
  // English
  { text: 'What emails still require an answer?', language: 'en', tool: 'email.needsReply' },
  { text: 'Which invoices are open?', language: 'en', tool: 'invoice.list' },
  { text: 'Have I paid Weston yet?', language: 'en', tool: 'invoice.paymentStatus', args: { query: 'Weston' } },
  { text: 'Create an invoice for client Acme for 3 days at €800 per day.', language: 'en', tool: 'invoice.create', args: { client: 'Acme', lines: [{ description: '3 days', quantity: 3, unit: 'day', unitPriceCents: 80000 }] } },
  { text: 'Prepare me for the meeting with Sven.', language: 'en', tool: 'meeting.prepare', args: { person: 'Sven' } },
  { text: 'What did we decide last time?', language: 'en', tool: 'project.decisions', args: { lastMeeting: true } },
  { text: 'What do I need to do today?', language: 'en', tool: 'admin.today' },
  { text: 'Log 8 hours for project Dashboard today.', language: 'en', tool: 'timesheet.create', args: { minutes: 480, project: 'Dashboard' } },
  { text: 'How many days did I work for client Acme this month?', language: 'en', tool: 'timesheet.summary', args: { client: 'Acme' } },
  { text: 'Show everything about project Dashboard.', language: 'en', tool: 'project.everything', args: { project: 'Dashboard' } },
  { text: 'Reply to that email from the recruiter saying that I am available on Monday.', language: 'en', tool: 'email.draftReply', args: { audience: 'recruiter', instruction: 'that I am available on Monday' } },
  { text: 'Make it more professional.', language: 'en', focus: FOCUS_DRAFT, tool: 'email.refineDraft' },
  { text: 'Send it.', language: 'en', focus: FOCUS_DRAFT, tool: 'email.send' },
  { text: 'Open the latest email from Fabrice.', language: 'en', tool: 'email.open', args: { from: 'Fabrice' } },
  { text: 'What does he want from me?', language: 'en', focus: FOCUS_EMAIL, tool: 'email.briefing' },
  { text: 'Remind me two days before the due date.', language: 'en', focus: { invoiceId: 'i1' }, tool: 'invoice.remind', args: { daysBefore: 2 } },
  { text: 'If I receive an invoice, remind me three days before the due date.', language: 'en', tool: 'workflow.create' },
  { text: 'What am I waiting for?', language: 'en', tool: 'followup.list' },
  { text: 'Who still owes me a reply?', language: 'en', tool: 'followup.list' },
  { text: 'Which deadlines do I have this week?', language: 'en', tool: 'admin.deadlines' },
  { text: 'What is blocking this project?', language: 'en', tool: 'project.blockers' },
  { text: 'What is the next step?', language: 'en', tool: 'project.nextStep' },
  { text: 'The meeting with Sven is done. He will arrange the access. I need to do the dashboard change by Friday.', language: 'en', tool: 'meeting.debrief' },
  // French
  { text: 'Quels mails dois-je encore répondre ?', language: 'fr', tool: 'email.needsReply' },
  { text: 'Quelles factures sont encore ouvertes ?', language: 'fr', tool: 'invoice.list' },
  { text: 'Crée une facture pour le client Acme pour 2 jours à 900 € par jour.', language: 'fr', tool: 'invoice.create', args: { client: 'Acme' } },
  { text: 'Prépare-moi pour la réunion avec Sven.', language: 'fr', tool: 'meeting.prepare', args: { person: 'Sven' } },
  { text: "Qu'avons-nous décidé la dernière fois ?", language: 'fr', tool: 'project.decisions', args: { lastMeeting: true } },
  { text: "Que dois-je faire aujourd'hui ?", language: 'fr', tool: 'admin.today' },
  { text: 'Envoie.', language: 'fr', focus: FOCUS_DRAFT, tool: 'email.send' },
  { text: 'Quand je reçois une facture, rappelle-moi trois jours avant l’échéance.', language: 'fr', tool: 'workflow.create' },
  // Alfred operations (§141–§181)
  { text: 'Maak een ticket: zoek uit welke leverancier het goedkoopst is', tool: 'ticket.create', args: { text: 'zoek uit welke leverancier het goedkoopst is' } },
  { text: 'Wat staat er in de wachtrij?', tool: 'ticket.list', args: { view: 'open' } },
  { text: 'Wat wacht op mijn goedkeuring?', tool: 'approval.list' },
  { text: 'Geef me mijn ochtendbriefing', tool: 'briefing.show', args: { kind: 'morning' } },
  { text: 'Elke maandag om 9u: geef me de open facturen', tool: 'automation.create' },
  { text: 'Maak een offerte voor Acme: 5 dagen aan 750 euro', tool: 'quote.create', args: { client: 'Acme' } },
  { text: 'Verstuur de offerte voor Acme', tool: 'quote.send', args: { query: 'Acme' } },
  { text: 'De offerte voor Acme is aanvaard', tool: 'quote.accept', args: { query: 'Acme' } },
  { text: 'Wat is de historiek met Acme?', tool: 'crm.timeline', args: { client: 'Acme' } },
  { text: 'Vraag de adviesraad: moet ik een tweede medewerker aannemen?', tool: 'advisory.ask' },
  { text: 'Zet het licht in de keuken aan', tool: 'home.run', args: { device: 'licht in de keuken', service: 'turn_on' } },
  { text: 'Draait Alfred nog?', tool: 'system.health' },
  { text: 'Create a ticket: compare the three CRM tools we shortlisted', language: 'en', tool: 'ticket.create' },
  { text: 'Every weekday at 8, send me my priorities', language: 'en', tool: 'automation.create' },
  { text: 'Turn off the heating', language: 'en', tool: 'home.run', args: { device: 'heating', service: 'turn_off' } },
  { text: 'Chaque lundi à 9h, résume mes mails', language: 'fr', tool: 'automation.create' },
  { text: 'Que fait Alfred ?', language: 'fr', tool: 'ticket.list', args: { view: 'working' } },
  { text: 'Alfred, maak vannacht een overzicht van alles wat nog openstaat voor mijn projecten.', tool: 'admin.weeklyReview' },
  { text: 'Make me an overview of everything that is still open across my projects', language: 'en', tool: 'admin.weeklyReview' },
];

describe('AdminParser – natural administrative commands', () => {
  for (const c of CASES) {
    it(`[${c.language ?? 'nl'}] ${c.text}${c.focus ? ' (with focus)' : ''}`, () => {
      const cmd = parse(c.text, c.language ?? 'nl', c.focus ?? null);
      if (c.tool === null) {
        expect(cmd).toBeNull();
        return;
      }
      expect(cmd?.tool).toBe(c.tool);
      if (c.missing) {
        expect(cmd?.missingFields).toEqual([c.missing]);
        expect(cmd?.clarificationQuestion).toBeTruthy();
      } else {
        expect(cmd?.missingFields).toEqual([]);
      }
      if (c.args) {
        for (const [key, value] of Object.entries(c.args)) expect(cmd?.args[key], key).toEqual(value);
      }
      expect(cmd?.preview.title.length).toBeGreaterThan(0);
    });
  }

  it('completes a pending invoice with the line answer', () => {
    const pending = parse('Maak een factuur voor klant GO!');
    expect(pending?.missingFields).toEqual(['lines']);
    const batch = parser.complete(pending!, '5 werkdagen aan €750 per dag', { text: '', language: 'nl', now: NOW, timezone: TZ, source: 'text', focus: null });
    const done = batch?.commands[0];
    expect(done?.intent).toBe('BUTLER_TOOL');
    if (done?.intent === 'BUTLER_TOOL') {
      expect(done.args.client).toBe('GO!');
      expect(done.args.lines).toEqual([{ description: '5 werkdagen', quantity: 5, unit: 'day', unitPriceCents: 75000 }]);
      expect(done.missingFields).toEqual([]);
    }
  });

  it('parses invoice lines in several notations', () => {
    expect(parseInvoiceLines('10 uur aan €80 per uur en 1 licentie voor 250 euro')).toEqual([
      { description: '10 uur', quantity: 10, unit: 'hour', unitPriceCents: 8000 },
      { description: 'Licentie', quantity: 1, unit: 'piece', unitPriceCents: 25000 },
    ]);
    expect(parseInvoiceLines('€1500 voor de website')).toEqual([{ description: 'De website', quantity: 1, unit: 'piece', unitPriceCents: 150000 }]);
    expect(parseInvoiceLines('3 dagen consultancy aan 800 euro')).toEqual([{ description: 'Consultancy', quantity: 3, unit: 'day', unitPriceCents: 80000 }]);
  });

  it('resolves periods relative to now', () => {
    expect(parsePeriod('deze week', NOW, TZ)).toEqual({ from: '2026-09-28', to: '2026-10-04', label: 'this_week' });
    expect(parsePeriod('vorige maand', NOW, TZ)?.from).toBe('2026-09-01');
    expect(parsePeriod('september', NOW, TZ)?.to).toBe('2026-09-30');
    expect(parsePeriod('december', NOW, TZ)?.from).toBe('2025-12-01');
    expect(parsePeriod('last month', NOW, TZ)?.label).toBe('last_month');
  });
});
