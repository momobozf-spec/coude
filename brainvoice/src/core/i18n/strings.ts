import type { Language } from '../types/common';

/**
 * User-facing strings used by the domain layer (clarification questions,
 * validation messages, summaries). UI-only strings live next to the screens.
 */

type StringTable = {
  askWhen: string;
  askWhenReminder: string;
  askTime: string;
  askTitle: string;
  askDuration: string;
  askTarget: string;
  askQuery: string;
  pastDate: string;
  endBeforeStart: string;
  noExplicitTime: string;
  lowConfidence: string;
  unknown: string;
  fallbackNote: string;
  destructive: string;
  toolArgsInvalid: string;
  sensitiveConfirm: string;
  externalConfirm: string;
  labels: Record<
    | 'BUTLER_TOOL'
    | 'CAPTURE_NOTE'
    | 'CAPTURE_IDEA'
    | 'CREATE_TASK'
    | 'CREATE_REMINDER'
    | 'CREATE_CALENDAR_EVENT'
    | 'CREATE_ALARM'
    | 'CREATE_TIMER'
    | 'UPDATE_TASK'
    | 'COMPLETE_TASK'
    | 'UPDATE_EVENT'
    | 'DELETE_EVENT'
    | 'SEARCH_NOTES'
    | 'GET_AGENDA'
    | 'GET_TASKS'
    | 'UNKNOWN',
    string
  >;
  reminderBefore: string;
  allDay: string;
  timer: string;
  alarm: string;
  noResults: string;
  nothingPlanned: string;
  noTasks: string;
  tasksHeader: string;
  agendaHeader: string;
  remindersHeader: string;
  inboxHeader: string;
  searchHeader: string;
};

export const STRINGS: Record<Language, StringTable> = {
  en: {
    askWhen: 'When?',
    askWhenReminder: 'When should I remind you?',
    askTime: 'What time?',
    askTitle: 'What should I call it?',
    askDuration: 'How long should the timer run?',
    askTarget: 'Which item do you mean?',
    askQuery: 'What should I search for?',
    pastDate: 'That moment has already passed. When should it be?',
    endBeforeStart: 'The end time is before the start time.',
    noExplicitTime: 'No exact time was given; I picked a default.',
    lowConfidence: "I'm not sure I understood. Did you mean this?",
    unknown: "I didn't understand that. Could you say it differently?",
    fallbackNote: 'Save this as a note?',
    destructive: 'This changes existing data and needs your confirmation.',
    toolArgsInvalid: 'I am missing details for this request.',
    sensitiveConfirm: 'Financial or administrative records change; please confirm.',
    externalConfirm: 'This leaves your phone (email is sent); please confirm.',
    labels: {
      BUTLER_TOOL: 'Butler',
      CAPTURE_NOTE: 'Note',
      CAPTURE_IDEA: 'Idea',
      CREATE_TASK: 'Task',
      CREATE_REMINDER: 'Reminder',
      CREATE_CALENDAR_EVENT: 'Calendar',
      CREATE_ALARM: 'Alarm',
      CREATE_TIMER: 'Timer',
      UPDATE_TASK: 'Update task',
      COMPLETE_TASK: 'Complete task',
      UPDATE_EVENT: 'Update event',
      DELETE_EVENT: 'Delete event',
      SEARCH_NOTES: 'Search',
      GET_AGENDA: 'Agenda',
      GET_TASKS: 'Tasks',
      UNKNOWN: 'Unknown',
    },
    reminderBefore: 'Reminder: {n} min before',
    allDay: 'All day',
    timer: 'Timer',
    alarm: 'Alarm',
    noResults: 'Nothing found.',
    nothingPlanned: 'Nothing planned.',
    noTasks: 'No open tasks.',
    tasksHeader: 'Tasks',
    agendaHeader: 'Agenda',
    remindersHeader: 'Reminders',
    inboxHeader: 'Brain Inbox',
    searchHeader: 'Results',
  },
  nl: {
    askWhen: 'Wanneer?',
    askWhenReminder: 'Wanneer moet ik je herinneren?',
    askTime: 'Hoe laat?',
    askTitle: 'Hoe zal ik het noemen?',
    askDuration: 'Hoe lang moet de timer lopen?',
    askTarget: 'Welk item bedoel je?',
    askQuery: 'Waar moet ik naar zoeken?',
    pastDate: 'Dat moment is al voorbij. Wanneer moet het zijn?',
    endBeforeStart: 'De eindtijd ligt voor de starttijd.',
    noExplicitTime: 'Geen exact uur gegeven; ik koos een standaardtijd.',
    lowConfidence: 'Ik ben niet zeker dat ik het begreep. Bedoelde je dit?',
    unknown: 'Dat begreep ik niet. Kun je het anders zeggen?',
    fallbackNote: 'Als notitie bewaren?',
    destructive: 'Dit wijzigt bestaande gegevens en vraagt je bevestiging.',
    toolArgsInvalid: 'Ik mis details voor deze vraag.',
    sensitiveConfirm: 'Financiële of administratieve gegevens wijzigen; bevestig even.',
    externalConfirm: 'Dit verlaat je telefoon (e-mail wordt verzonden); bevestig even.',
    labels: {
      BUTLER_TOOL: 'Butler',
      CAPTURE_NOTE: 'Notitie',
      CAPTURE_IDEA: 'Idee',
      CREATE_TASK: 'Taak',
      CREATE_REMINDER: 'Herinnering',
      CREATE_CALENDAR_EVENT: 'Agenda',
      CREATE_ALARM: 'Wekker',
      CREATE_TIMER: 'Timer',
      UPDATE_TASK: 'Taak wijzigen',
      COMPLETE_TASK: 'Taak afvinken',
      UPDATE_EVENT: 'Afspraak wijzigen',
      DELETE_EVENT: 'Afspraak verwijderen',
      SEARCH_NOTES: 'Zoeken',
      GET_AGENDA: 'Agenda',
      GET_TASKS: 'Taken',
      UNKNOWN: 'Onbekend',
    },
    reminderBefore: 'Herinnering: {n} min vooraf',
    allDay: 'Hele dag',
    timer: 'Timer',
    alarm: 'Wekker',
    noResults: 'Niets gevonden.',
    nothingPlanned: 'Niets gepland.',
    noTasks: 'Geen open taken.',
    tasksHeader: 'Taken',
    agendaHeader: 'Agenda',
    remindersHeader: 'Herinneringen',
    inboxHeader: 'Brain Inbox',
    searchHeader: 'Resultaten',
  },
  fr: {
    askWhen: 'Quand ?',
    askWhenReminder: 'Quand dois-je te le rappeler ?',
    askTime: 'À quelle heure ?',
    askTitle: 'Comment dois-je l’appeler ?',
    askDuration: 'Combien de temps doit durer le minuteur ?',
    askTarget: 'De quel élément parles-tu ?',
    askQuery: 'Que dois-je chercher ?',
    pastDate: 'Ce moment est déjà passé. Quand faut-il le prévoir ?',
    endBeforeStart: 'L’heure de fin est avant l’heure de début.',
    noExplicitTime: 'Aucune heure précise ; j’ai choisi une heure par défaut.',
    lowConfidence: 'Je ne suis pas sûr d’avoir compris. C’est bien ça ?',
    unknown: 'Je n’ai pas compris. Peux-tu le dire autrement ?',
    fallbackNote: 'Enregistrer comme note ?',
    destructive: 'Ceci modifie des données existantes et demande ta confirmation.',
    toolArgsInvalid: 'Il me manque des détails pour cette demande.',
    sensitiveConfirm: 'Des données financières ou administratives changent ; confirme.',
    externalConfirm: 'Ceci quitte ton téléphone (envoi d’e-mail) ; confirme.',
    labels: {
      BUTLER_TOOL: 'Butler',
      CAPTURE_NOTE: 'Note',
      CAPTURE_IDEA: 'Idée',
      CREATE_TASK: 'Tâche',
      CREATE_REMINDER: 'Rappel',
      CREATE_CALENDAR_EVENT: 'Agenda',
      CREATE_ALARM: 'Réveil',
      CREATE_TIMER: 'Minuteur',
      UPDATE_TASK: 'Modifier la tâche',
      COMPLETE_TASK: 'Terminer la tâche',
      UPDATE_EVENT: 'Modifier l’événement',
      DELETE_EVENT: 'Supprimer l’événement',
      SEARCH_NOTES: 'Recherche',
      GET_AGENDA: 'Agenda',
      GET_TASKS: 'Tâches',
      UNKNOWN: 'Inconnu',
    },
    reminderBefore: 'Rappel : {n} min avant',
    allDay: 'Toute la journée',
    timer: 'Minuteur',
    alarm: 'Réveil',
    noResults: 'Rien trouvé.',
    nothingPlanned: 'Rien de prévu.',
    noTasks: 'Aucune tâche ouverte.',
    tasksHeader: 'Tâches',
    agendaHeader: 'Agenda',
    remindersHeader: 'Rappels',
    inboxHeader: 'Brain Inbox',
    searchHeader: 'Résultats',
  },
};

export function t(language: Language): StringTable {
  return STRINGS[language];
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
