import type { AssistantIntent } from '../intent/schema';
import type { Language } from '../types/common';

/**
 * Real-world sentences used by the parser tests and as few-shot examples.
 * Expectations are evaluated with now = Wednesday 2026-09-23 10:00 Europe/Brussels.
 */
export interface SentenceFixture {
  text: string;
  language: Language;
  intents: AssistantIntent[];
  expect?: {
    title?: string;
    date?: string;
    time?: string;
    endTime?: string;
    durationMinutes?: number;
    durationSeconds?: number;
    query?: string;
    targetQuery?: string;
    category?: string;
    missing?: string[];
    alerts?: number[];
    people?: string[];
    listName?: string;
  };
}

export const SENTENCES: SentenceFixture[] = [
  // ---- English ---------------------------------------------------------------
  { text: 'Remind me tomorrow at 8 to call the accountant.', language: 'en', intents: ['CREATE_REMINDER'], expect: { title: 'Call the accountant', date: '2026-09-24', time: '08:00' } },
  { text: 'Put gym in my calendar Thursday from 7 until 8 in the evening.', language: 'en', intents: ['CREATE_CALENDAR_EVENT'], expect: { title: 'Gym', date: '2026-09-24', time: '19:00', endTime: '20:00' } },
  { text: 'Tomorrow I need to buy milk, go to the pharmacy and call Youssef.', language: 'en', intents: ['CREATE_TASK', 'CREATE_TASK', 'CREATE_TASK'], expect: { date: '2026-09-24' } },
  { text: 'I just had an idea. An app for automatically analyzing products on Bol.com and finding opportunities.', language: 'en', intents: ['CAPTURE_IDEA'], expect: { category: 'Business' } },
  { text: 'Wake me up tomorrow at quarter past six.', language: 'en', intents: ['CREATE_ALARM'], expect: { date: '2026-09-24', time: '06:15' } },
  { text: 'Set a timer for 25 minutes.', language: 'en', intents: ['CREATE_TIMER'], expect: { durationSeconds: 1500 } },
  { text: 'Next Monday at 2 I have a meeting with Fabrice about the management dashboard. Remind me 30 minutes beforehand.', language: 'en', intents: ['CREATE_CALENDAR_EVENT'], expect: { title: 'Meeting with Fabrice', date: '2026-09-28', time: '14:00', alerts: [-30], people: ['Fabrice'] } },
  { text: 'I need to remember that Fabrice wants the top five risks weighted by severity.', language: 'en', intents: ['CAPTURE_NOTE'] },
  { text: 'What do I need to do tomorrow?', language: 'en', intents: ['GET_TASKS'], expect: { date: '2026-09-24' } },
  { text: 'What did I say about my Bol.com idea?', language: 'en', intents: ['SEARCH_NOTES'], expect: { query: 'Bol.com idea' } },
  { text: 'Remember that Ruben asked for the API documentation.', language: 'en', intents: ['CAPTURE_NOTE'], expect: { people: ['Ruben'] } },
  { text: 'I have an idea for an application that scans halal products.', language: 'en', intents: ['CAPTURE_IDEA'] },
  { text: 'I need to send the invoice tomorrow.', language: 'en', intents: ['CREATE_TASK'], expect: { title: 'Send the invoice', date: '2026-09-24' } },
  { text: 'Remind me tomorrow at 9 to call Yakup.', language: 'en', intents: ['CREATE_REMINDER'], expect: { title: 'Call Yakup', date: '2026-09-24', time: '09:00' } },
  { text: 'Put a meeting with Fabrice Friday at 2 for one hour.', language: 'en', intents: ['CREATE_CALENDAR_EVENT'], expect: { title: 'Meeting with Fabrice', date: '2026-09-25', time: '14:00', durationMinutes: 60 } },
  { text: 'Wake me tomorrow at 6:30.', language: 'en', intents: ['CREATE_ALARM'], expect: { date: '2026-09-24', time: '06:30' } },
  { text: 'Set a timer for 20 minutes.', language: 'en', intents: ['CREATE_TIMER'], expect: { durationSeconds: 1200 } },
  { text: 'What does my day look like tomorrow?', language: 'en', intents: ['GET_AGENDA'], expect: { date: '2026-09-24' } },
  { text: 'What do I still need to do today?', language: 'en', intents: ['GET_TASKS'], expect: { date: '2026-09-23' } },
  { text: 'What did I say about product research?', language: 'en', intents: ['SEARCH_NOTES'], expect: { query: 'product research' } },
  { text: 'Mark send invoice as done.', language: 'en', intents: ['COMPLETE_TASK'], expect: { targetQuery: 'send invoice' } },
  { text: 'Mark buy milk as complete.', language: 'en', intents: ['COMPLETE_TASK'], expect: { targetQuery: 'buy milk' } },
  { text: 'Move my call with Youssef to tomorrow.', language: 'en', intents: ['UPDATE_TASK'], expect: { targetQuery: 'call with Youssef', date: '2026-09-24' } },
  { text: 'Remind me about the invoice again Friday.', language: 'en', intents: ['CREATE_REMINDER'], expect: { title: 'The invoice', date: '2026-09-25', missing: ['time'] } },
  { text: 'Tomorrow remind me at nine to call Yakup, add gym at seven to my calendar and note that I need to research electric cars.', language: 'en', intents: ['CREATE_REMINDER', 'CREATE_CALENDAR_EVENT', 'CAPTURE_NOTE'], expect: { date: '2026-09-24', time: '09:00' } },
  { text: 'Plan meeting with Youssef Friday.', language: 'en', intents: ['CREATE_CALENDAR_EVENT'], expect: { date: '2026-09-25', missing: ['time'] } },
  { text: 'Add milk to my shopping list.', language: 'en', intents: ['CREATE_TASK'], expect: { title: 'Milk', listName: 'shopping' } },
  { text: 'Remind me to send the invoice.', language: 'en', intents: ['CREATE_REMINDER'], expect: { title: 'Send the invoice', missing: ['when'] } },
  { text: 'Remind me in two hours to send the invoice.', language: 'en', intents: ['CREATE_REMINDER'], expect: { title: 'Send the invoice', date: '2026-09-23', time: '12:00' } },
  { text: 'What did I say about Databricks yesterday?', language: 'en', intents: ['SEARCH_NOTES'], expect: { query: 'Databricks', date: '2026-09-22' } },
  { text: 'Find my ideas about real estate.', language: 'en', intents: ['SEARCH_NOTES'], expect: { query: 'real estate' } },
  { text: 'What were the things Fabrice asked me to change?', language: 'en', intents: ['SEARCH_NOTES'], expect: { people: ['Fabrice'] } },
  { text: 'What did I need to buy?', language: 'en', intents: ['SEARCH_NOTES'] },
  { text: 'Schedule a meeting with Youssef tomorrow at 2.', language: 'en', intents: ['CREATE_CALENDAR_EVENT'], expect: { title: 'Meeting with Youssef', date: '2026-09-24', time: '14:00' } },
  { text: 'Plan dinner with my wife Friday at seven.', language: 'en', intents: ['CREATE_CALENDAR_EVENT'], expect: { title: 'Dinner with my wife', date: '2026-09-25' } },
  { text: 'Every Monday at 9 remind me to submit my timesheet.', language: 'en', intents: ['CREATE_REMINDER'], expect: { title: 'Submit my timesheet', time: '09:00' } },
  // ---- Dutch -----------------------------------------------------------------
  { text: 'Herinner mij morgen om 8 uur om Yakup te bellen.', language: 'nl', intents: ['CREATE_REMINDER'], expect: { title: 'Yakup bellen', date: '2026-09-24', time: '08:00' } },
  { text: 'Zet donderdag om 14 uur een meeting met Fabrice in mijn agenda.', language: 'nl', intents: ['CREATE_CALENDAR_EVENT'], expect: { title: 'Meeting met Fabrice', date: '2026-09-24', time: '14:00' } },
  { text: 'Ik moet morgen melk kopen.', language: 'nl', intents: ['CREATE_TASK'], expect: { title: 'Melk kopen', date: '2026-09-24' } },
  { text: 'Maak mij morgen om half zeven wakker.', language: 'nl', intents: ['CREATE_ALARM'], expect: { date: '2026-09-24', time: '06:30' } },
  { text: 'Zet een timer van 25 minuten.', language: 'nl', intents: ['CREATE_TIMER'], expect: { durationSeconds: 1500 } },
  { text: 'Ik heb een idee voor een app die halal producten scant.', language: 'nl', intents: ['CAPTURE_IDEA'] },
  { text: 'Onthoud dat Ruben de API documentatie heeft gevraagd.', language: 'nl', intents: ['CAPTURE_NOTE'], expect: { people: ['Ruben'] } },
  { text: 'Wat moet ik morgen doen?', language: 'nl', intents: ['GET_TASKS'], expect: { date: '2026-09-24' } },
  { text: 'Wat staat er morgen op mijn agenda?', language: 'nl', intents: ['GET_AGENDA'], expect: { date: '2026-09-24' } },
  { text: 'Wat heb ik gezegd over mijn Bol.com idee?', language: 'nl', intents: ['SEARCH_NOTES'], expect: { query: 'Bol.com idee' } },
  { text: 'Markeer factuur sturen als gedaan.', language: 'nl', intents: ['COMPLETE_TASK'], expect: { targetQuery: 'factuur sturen' } },
  { text: 'Verplaats mijn call met Youssef naar morgen.', language: 'nl', intents: ['UPDATE_TASK'], expect: { targetQuery: 'call met Youssef', date: '2026-09-24' } },
  { text: 'Morgen moet ik melk kopen, naar de apotheek gaan en Youssef bellen.', language: 'nl', intents: ['CREATE_TASK', 'CREATE_TASK', 'CREATE_TASK'], expect: { date: '2026-09-24' } },
  { text: 'Voeg melk toe aan mijn boodschappenlijst.', language: 'nl', intents: ['CREATE_TASK'], expect: { title: 'Melk', listName: 'shopping' } },
  { text: 'Herinner mij eraan om de factuur te sturen.', language: 'nl', intents: ['CREATE_REMINDER'], expect: { title: 'De factuur sturen', missing: ['when'] } },
  { text: 'Plan een meeting met Youssef vrijdag.', language: 'nl', intents: ['CREATE_CALENDAR_EVENT'], expect: { title: 'Meeting met Youssef', date: '2026-09-25', missing: ['time'] } },
  { text: 'Volgende maandag om 14 uur heb ik een meeting met Fabrice over het management dashboard. Herinner mij 30 minuten op voorhand.', language: 'nl', intents: ['CREATE_CALENDAR_EVENT'], expect: { date: '2026-09-28', time: '14:00', alerts: [-30] } },
  // ---- French ----------------------------------------------------------------
  { text: "Rappelle-moi demain à 8 heures d'appeler Yakup.", language: 'fr', intents: ['CREATE_REMINDER'], expect: { title: 'Appeler Yakup', date: '2026-09-24', time: '08:00' } },
  { text: 'Planifie une réunion vendredi à 14h.', language: 'fr', intents: ['CREATE_CALENDAR_EVENT'], expect: { title: 'Réunion', date: '2026-09-25', time: '14:00' } },
  { text: 'Je dois acheter du lait demain.', language: 'fr', intents: ['CREATE_TASK'], expect: { title: 'Acheter du lait', date: '2026-09-24' } },
  { text: 'Réveille-moi demain à 6h30.', language: 'fr', intents: ['CREATE_ALARM'], expect: { date: '2026-09-24', time: '06:30' } },
  { text: 'Mets un minuteur de 25 minutes.', language: 'fr', intents: ['CREATE_TIMER'], expect: { durationSeconds: 1500 } },
  { text: "J'ai une idée pour une application qui scanne des produits halal.", language: 'fr', intents: ['CAPTURE_IDEA'] },
  { text: 'Note que Ruben a demandé la documentation API.', language: 'fr', intents: ['CAPTURE_NOTE'], expect: { people: ['Ruben'] } },
  { text: "Qu'est-ce que je dois faire demain ?", language: 'fr', intents: ['GET_TASKS'], expect: { date: '2026-09-24' } },
  { text: "Qu'est-ce que j'ai de prévu demain ?", language: 'fr', intents: ['GET_AGENDA'], expect: { date: '2026-09-24' } },
  { text: "Qu'est-ce que j'ai dit sur mon idée Bol.com ?", language: 'fr', intents: ['SEARCH_NOTES'], expect: { query: 'idée Bol.com' } },
  { text: 'Marque envoyer la facture comme fait.', language: 'fr', intents: ['COMPLETE_TASK'], expect: { targetQuery: 'envoyer la facture' } },
  { text: 'Déplace mon appel avec Youssef à demain.', language: 'fr', intents: ['UPDATE_TASK'], expect: { targetQuery: 'appel avec Youssef', date: '2026-09-24' } },
  { text: 'Ajoute du lait à ma liste de courses.', language: 'fr', intents: ['CREATE_TASK'], expect: { title: 'Du lait', listName: 'shopping' } },
  { text: "Rappelle-moi d'envoyer la facture.", language: 'fr', intents: ['CREATE_REMINDER'], expect: { title: 'Envoyer la facture', missing: ['when'] } },
  { text: 'Planifie une réunion avec Youssef vendredi.', language: 'fr', intents: ['CREATE_CALENDAR_EVENT'], expect: { date: '2026-09-25', missing: ['time'] } },
  { text: 'Lundi prochain à 14h j\'ai une réunion avec Fabrice. Rappelle-moi 30 minutes avant.', language: 'fr', intents: ['CREATE_CALENDAR_EVENT'], expect: { date: '2026-09-28', time: '14:00', alerts: [-30] } },
];
