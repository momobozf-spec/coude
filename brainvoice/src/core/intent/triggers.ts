import type { AssistantIntent } from './schema';
import type { Language } from '../types/common';

/**
 * Intent trigger phrases per language for the DeterministicParser.
 *
 * Patterns are regex sources applied with the `iu` flags to normalised
 * (lower-case, NFC) text. Named groups:
 *   target – the item an update/complete/delete refers to
 *   rest   – text after the trigger that becomes the title
 *   query  – the search query
 *   types  – item type words in a search ("ideas", "notes")
 *   list   – list name in "add X to my shopping list"
 *   num / unit – number and unit for alert offsets
 *
 * Order matters: rules are tried top to bottom, first match wins.
 */

export type TriggerIntent = AssistantIntent | 'ALERT_OFFSET';

export interface TriggerRule {
  intent: TriggerIntent;
  pattern: string;
  confidence: number;
}

const P = 'please\\s+';

export const TRIGGERS: Record<Language, TriggerRule[]> = {
  en: [
    // Alert relative to a previous event: "remind me 30 minutes beforehand"
    { intent: 'ALERT_OFFSET', pattern: `^(?:and\\s+)?(?:remind|alert|notify|warn|ping)\\s+me\\s+(?<num>\\d+|an?|one|two|five|ten|fifteen|twenty|thirty|forty-five|sixty)\\s+(?<unit>minutes?|mins?|hours?|hrs?)\\s+(?:beforehand|before|earlier|in advance|ahead|prior)\\b`, confidence: 0.96 },
    // Timers
    { intent: 'CREATE_TIMER', pattern: `^(?:${P})?(?:set|start|put|create|make|give me|run)\\s+(?:a\\s+|an\\s+|the\\s+|me\\s+a\\s+)?(?:(?:\\d+|[a-z]+)[\\s-]?(?:minute|min|hour|second|sec)s?\\s+)?timer\\b(?:\\s+(?:for|of))?`, confidence: 0.97 },
    { intent: 'CREATE_TIMER', pattern: `\\btimer\\b(?:\\s+(?:for|of))?`, confidence: 0.85 },
    // Alarms
    { intent: 'CREATE_ALARM', pattern: `^(?:${P})?wake me(?: up)?\\b`, confidence: 0.97 },
    { intent: 'CREATE_ALARM', pattern: `\\b(?:set|put|create|make)\\s+(?:an?\\s+|the\\s+)?alarm\\b(?:\\s+for)?`, confidence: 0.96 },
    { intent: 'CREATE_ALARM', pattern: `^alarm\\b(?:\\s+(?:for|at))?`, confidence: 0.9 },
    // Reminders
    { intent: 'CREATE_REMINDER', pattern: `^(?:${P})?remind me(?:\\s+(?:to|about|of|that))?\\b`, confidence: 0.97 },
    { intent: 'CREATE_REMINDER', pattern: `\\b(?:set|create|add|make)\\s+(?:a\\s+)?reminder(?:\\s+(?:to|for|about|that))?\\b`, confidence: 0.95 },
    { intent: 'CREATE_REMINDER', pattern: `^reminder\\s*[:\\-]?\\s`, confidence: 0.9 },
    // Calendar events
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `\\b(?:put|add|schedule|plan|book|create|set up|block)\\b.*\\b(?:in|to|on|into)\\s+(?:my\\s+|the\\s+)?(?:calendar|agenda|schedule)\\b`, confidence: 0.97 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?:${P})?(?:schedule|plan|book|set up|arrange|organi[sz]e|put|add|create|block)\\s+(?:a\\s+|an\\s+|the\\s+|my\\s+)?(?=(?:meeting|call|appointment|dinner|lunch|breakfast|coffee|event|session|interview|visit|workout|gym|dentist|doctor)\\b)`, confidence: 0.96 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?:${P})?(?:schedule|book)\\b`, confidence: 0.85 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^i(?:'ve| have)\\s+(?:a\\s+|an\\s+)?(?=(?:meeting|appointment|call|dinner|lunch|interview|visit|session|date)\\b)`, confidence: 0.93 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?=(?:meeting|appointment|call|dinner|lunch|breakfast|coffee|drinks)\\s+with\\b)`, confidence: 0.92 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?:${P})?plan\\s+(?:a\\s+|an\\s+)?`, confidence: 0.8 },
    // Completing tasks
    { intent: 'COMPLETE_TASK', pattern: `^(?:${P})?(?:mark|set|check)\\s+(?<target>.+?)\\s+(?:as\\s+)?(?:done|complete|completed|finished|off)\\s*$`, confidence: 0.97 },
    { intent: 'COMPLETE_TASK', pattern: `^(?<target>.+?)\\s+is\\s+(?:done|complete|completed|finished)\\s*$`, confidence: 0.9 },
    { intent: 'COMPLETE_TASK', pattern: `^(?:i(?:'ve| have)?\\s+)?(?:finished|completed)\\s+(?<target>.+)$`, confidence: 0.9 },
    { intent: 'COMPLETE_TASK', pattern: `^(?:check off|tick off|complete)\\s+(?<target>.+)$`, confidence: 0.92 },
    // Updating / moving tasks
    { intent: 'UPDATE_TASK', pattern: `^(?:${P})?(?:move|reschedule|postpone|push|shift)\\s+(?<target>.+?)\\s+to\\s+(?<rest>.+)$`, confidence: 0.94 },
    { intent: 'UPDATE_TASK', pattern: `^(?:${P})?change\\s+(?<target>.+?)\\s+to\\s+(?<rest>.+)$`, confidence: 0.85 },
    // Deleting events
    { intent: 'DELETE_EVENT', pattern: `^(?:${P})?(?:delete|cancel|remove|scrap)\\s+(?:the\\s+|my\\s+)?(?<target>.+)$`, confidence: 0.93 },
    // Search
    { intent: 'SEARCH_NOTES', pattern: `^what did i (?:say|write|note|mention|record|capture|think)\\s+(?:about|on|regarding)\\s+(?<query>.+)$`, confidence: 0.96 },
    { intent: 'SEARCH_NOTES', pattern: `^what were the things (?<query>.+)$`, confidence: 0.9 },
    { intent: 'SEARCH_NOTES', pattern: `^what did i (?:need|have|want) to (?<query>buy|get|order|pick up)\\b.*$`, confidence: 0.9 },
    { intent: 'SEARCH_NOTES', pattern: `^(?:find|search(?: for)?|look up|look for|show me|show|pull up|get)\\s+(?:my\\s+|all\\s+|the\\s+|all my\\s+)?(?<types>notes?|ideas?|thoughts?|captures?|tasks?|reminders?)?\\s*(?:about|on|for|regarding|related to|mentioning)?\\s*(?<query>.+)$`, confidence: 0.93 },
    { intent: 'SEARCH_NOTES', pattern: `^what (?:was|were) (?:my|the)\\s+(?<query>.+)$`, confidence: 0.75 },
    // Agenda
    { intent: 'GET_AGENDA', pattern: `^what(?:'s| is| does)?\\s+(?:on\\s+)?my\\s+(?:day|agenda|schedule|calendar)\\b`, confidence: 0.97 },
    { intent: 'GET_AGENDA', pattern: `^what do i have (?:on|planned|scheduled|coming up|going on)\\b`, confidence: 0.95 },
    { intent: 'GET_AGENDA', pattern: `^what(?:'s| is)\\s+(?:scheduled|planned|coming up|on)\\b`, confidence: 0.93 },
    { intent: 'GET_AGENDA', pattern: `^how does my (?:day|week|agenda|schedule) look`, confidence: 0.95 },
    { intent: 'GET_AGENDA', pattern: `^what does my (?:day|week|agenda|schedule) look like`, confidence: 0.95 },
    { intent: 'GET_AGENDA', pattern: `^(?:show|give|tell) me my (?:agenda|schedule|calendar|day|appointments)\\b`, confidence: 0.95 },
    { intent: 'GET_AGENDA', pattern: `^(?:my )?(?:agenda|schedule)\\b`, confidence: 0.85 },
    // Tasks
    { intent: 'GET_TASKS', pattern: `^what do i (?:still\\s+)?(?:need|have|got) to do\\b`, confidence: 0.97 },
    { intent: 'GET_TASKS', pattern: `^what (?:are|were) my tasks\\b`, confidence: 0.96 },
    { intent: 'GET_TASKS', pattern: `^(?:show|list|give|tell)\\s+(?:me\\s+)?my\\s+(?:tasks|to-?dos?|todo list|to-?do list|open tasks)\\b`, confidence: 0.96 },
    { intent: 'GET_TASKS', pattern: `^what(?:'s| is) (?:left|on my (?:to-?do|todo)(?: list)?|on my list|still open)\\b`, confidence: 0.93 },
    { intent: 'GET_TASKS', pattern: `^what (?:should|must) i (?:do|still do)\\b`, confidence: 0.9 },
    { intent: 'GET_TASKS', pattern: `^(?:my )?tasks\\b`, confidence: 0.85 },
    // Ideas
    { intent: 'CAPTURE_IDEA', pattern: `^(?:i\\s+)?(?:just\\s+)?(?:have|had|got)\\s+(?:an?\\s+)?(?:new\\s+|business\\s+|app\\s+|product\\s+|great\\s+|quick\\s+|little\\s+)?idea\\b(?:\\s*[:,.\\-]|\\s+for|\\s+about|\\s+of|\\s+to)?`, confidence: 0.96 },
    { intent: 'CAPTURE_IDEA', pattern: `^idea\\s*[:\\-]?\\s`, confidence: 0.95 },
    { intent: 'CAPTURE_IDEA', pattern: `^(?:new|business|app|product|startup)\\s+idea\\b(?:\\s*[:\\-]|\\s+for|\\s+about)?`, confidence: 0.94 },
    { intent: 'CAPTURE_IDEA', pattern: `^what if\\b`, confidence: 0.7 },
    // Notes / knowledge
    { intent: 'CAPTURE_NOTE', pattern: `^(?:${P})?(?:remember|note|write down|jot down|keep in mind|record|capture|save|note down)\\s+(?:that|this|the following)\\b`, confidence: 0.96 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:note|notes|thought|thoughts|remember|memo|brain ?dump|fyi)\\s*[:\\-]\\s`, confidence: 0.95 },
    { intent: 'CAPTURE_NOTE', pattern: `^i (?:need|want|have) to remember (?:that\\s+)?`, confidence: 0.95 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:${P})?(?:remember|note|write down|jot down|note down)\\b`, confidence: 0.85 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:i think|i believe|i feel like|just thinking|thinking about)\\b`, confidence: 0.65 },
    // Tasks
    { intent: 'CREATE_TASK', pattern: `^(?:${P})?(?:add|put)\\s+(?<rest>.+?)\\s+(?:to|on|onto)\\s+(?:my\\s+|the\\s+)?(?<list>shopping|grocery|groceries|to-?do|todo|task|tasks)?\\s*list\\b`, confidence: 0.97 },
    { intent: 'CREATE_TASK', pattern: `^i (?:need|have|got|must|should|ought)\\s+to\\b`, confidence: 0.95 },
    { intent: 'CREATE_TASK', pattern: `^i (?:must|should|gotta|wanna|want to)\\b`, confidence: 0.9 },
    { intent: 'CREATE_TASK', pattern: `^(?:need|have) to\\b`, confidence: 0.88 },
    { intent: 'CREATE_TASK', pattern: `^(?:task|todo|to-?do)\\s*[:\\-]\\s`, confidence: 0.95 },
    { intent: 'CREATE_TASK', pattern: `^(?:don't|do not) forget to\\b`, confidence: 0.93 },
    { intent: 'CREATE_TASK', pattern: `^(?:add|create|new)\\s+(?:a\\s+)?task\\b(?:\\s*[:\\-]|\\s+to|\\s+for)?`, confidence: 0.94 },
    { intent: 'CREATE_TASK', pattern: `^(?:buy|call|send|email|order|book|pay|pick up|finish|write|fix|check|clean|prepare|submit|review|read|print|renew|return|cancel)\\b`, confidence: 0.72 },
  ],
  nl: [
    { intent: 'ALERT_OFFSET', pattern: `^(?:en\\s+)?(?:herinner|verwittig|waarschuw)\\s+(?:mij|me)\\s+(?<num>\\d+|een|één|twee|vijf|tien|vijftien|twintig|dertig|zestig)\\s+(?<unit>minuten|minuut|min|uur|uren)\\s+(?:op voorhand|ervoor|van tevoren|vooraf|eerder|vantevoren)\\b`, confidence: 0.96 },
    { intent: 'CREATE_TIMER', pattern: `^(?:zet|start|maak|stel)\\s+(?:een\\s+|de\\s+)?(?:timer|kookwekker)\\b(?:\\s+(?:van|voor|op|in))?`, confidence: 0.97 },
    { intent: 'CREATE_TIMER', pattern: `\\b(?:timer|kookwekker)\\b(?:\\s+(?:van|voor))?`, confidence: 0.85 },
    { intent: 'CREATE_ALARM', pattern: `\\bmaak\\s+(?:mij|me)\\b.*\\bwakker\\b`, confidence: 0.97 },
    { intent: 'CREATE_ALARM', pattern: `\\b(?:zet|maak|stel)\\s+(?:een\\s+|de\\s+|mijn\\s+|m'n\\s+)?(?:wekker|alarm)\\b(?:\\s+(?:voor|op))?`, confidence: 0.96 },
    { intent: 'CREATE_ALARM', pattern: `^(?:wekker|alarm)\\b(?:\\s+(?:voor|op|om))?`, confidence: 0.9 },
    { intent: 'CREATE_ALARM', pattern: `\\bwakker (?:maken|worden)\\b`, confidence: 0.85 },
    { intent: 'CREATE_REMINDER', pattern: `^herinner (?:mij|me)(?: er ?aan)?(?:\\s+(?:om|dat|aan))?\\b`, confidence: 0.97 },
    { intent: 'CREATE_REMINDER', pattern: `\\b(?:zet|maak|stel)\\s+(?:een\\s+)?herinnering\\b(?:\\s+(?:om|voor|dat|in))?`, confidence: 0.95 },
    { intent: 'CREATE_REMINDER', pattern: `^herinnering\\s*[:\\-]?\\s`, confidence: 0.9 },
    { intent: 'CREATE_REMINDER', pattern: `^help me (?:eraan )?herinneren\\b(?:\\s+(?:om|dat))?`, confidence: 0.93 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `\\b(?:zet|plan|voeg|maak|boek|noteer|schrijf|blokkeer)\\b.*\\b(?:in|op|aan|toe aan)\\s+(?:mijn\\s+|de\\s+|m'n\\s+)?(?:agenda|kalender|planning)\\b`, confidence: 0.97 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?:plan|boek|leg|regel|zet|maak)\\s+(?:een\\s+|de\\s+)?(?=(?:meeting|vergadering|afspraak|call|etentje|lunch|ontbijt|koffie|gesprek|sessie|bezoek|training|tandarts|dokter)\\b)`, confidence: 0.96 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?:plan|boek)\\b`, confidence: 0.85 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?:ik heb|heb ik)\\s+(?:een\\s+|de\\s+)?(?=(?:meeting|vergadering|afspraak|call|etentje|lunch|gesprek|bezoek|interview)\\b)`, confidence: 0.93 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?=(?:meeting|vergadering|afspraak|call|etentje|lunch|koffie)\\s+met\\b)`, confidence: 0.92 },
    { intent: 'COMPLETE_TASK', pattern: `^(?:markeer|zet|vink)\\s+(?<target>.+?)\\s+(?:als\\s+|op\\s+)?(?:gedaan|klaar|voltooid|afgewerkt|afgerond|af|afgevinkt)\\s*$`, confidence: 0.97 },
    { intent: 'COMPLETE_TASK', pattern: `^(?<target>.+?)\\s+is\\s+(?:gedaan|klaar|voltooid|afgewerkt|afgerond|af)\\s*$`, confidence: 0.9 },
    { intent: 'COMPLETE_TASK', pattern: `^ik heb\\s+(?<target>.+?)\\s+(?:gedaan|afgewerkt|afgerond|voltooid)\\s*$`, confidence: 0.9 },
    { intent: 'UPDATE_TASK', pattern: `^(?:verplaats|verzet|verschuif|stel)\\s+(?<target>.+?)\\s+(?:naar|uit tot|uit naar)\\s+(?<rest>.+)$`, confidence: 0.94 },
    { intent: 'UPDATE_TASK', pattern: `^verander\\s+(?<target>.+?)\\s+naar\\s+(?<rest>.+)$`, confidence: 0.85 },
    { intent: 'DELETE_EVENT', pattern: `^(?:verwijder|annuleer|schrap|wis)\\s+(?:de\\s+|mijn\\s+|het\\s+|m'n\\s+)?(?<target>.+)$`, confidence: 0.93 },
    { intent: 'SEARCH_NOTES', pattern: `^wat heb ik (?:gezegd|geschreven|genoteerd|opgeslagen|vermeld|gedacht)\\s+over\\s+(?<query>.+)$`, confidence: 0.96 },
    { intent: 'SEARCH_NOTES', pattern: `^wat waren de dingen (?<query>.+)$`, confidence: 0.9 },
    { intent: 'SEARCH_NOTES', pattern: `^wat moest ik (?:nog\\s+|allemaal\\s+)?(?<query>kopen|halen|bestellen)\\b.*$`, confidence: 0.9 },
    { intent: 'SEARCH_NOTES', pattern: `^(?:zoek|vind|toon|geef|haal)\\s+(?:mij\\s+|me\\s+|alle\\s+|mijn\\s+|al mijn\\s+)?(?<types>notities?|ideeën|ideeen|idee|gedachten|taken|herinneringen)?\\s*(?:over|rond|voor|met|in verband met|i\\.v\\.m\\.|omtrent)?\\s*(?<query>.+)$`, confidence: 0.93 },
    { intent: 'SEARCH_NOTES', pattern: `^wat (?:was|waren) (?:mijn|de)\\s+(?<query>.+)$`, confidence: 0.75 },
    { intent: 'GET_AGENDA', pattern: `^wat staat er\\b.*\\bop (?:mijn|de|m'n) (?:agenda|planning|kalender)\\b`, confidence: 0.97 },
    { intent: 'GET_AGENDA', pattern: `^hoe ziet mijn (?:dag|week|agenda|planning) eruit\\b`, confidence: 0.96 },
    { intent: 'GET_AGENDA', pattern: `^wat heb ik\\b.*\\b(?:gepland|op de planning|op de agenda|op mijn agenda)\\b`, confidence: 0.95 },
    { intent: 'GET_AGENDA', pattern: `^wat is er (?:gepland|op de planning)\\b`, confidence: 0.93 },
    { intent: 'GET_AGENDA', pattern: `^(?:toon|geef)\\s+(?:mij\\s+|me\\s+)?mijn (?:agenda|planning|dag|afspraken)\\b`, confidence: 0.95 },
    { intent: 'GET_AGENDA', pattern: `^(?:mijn )?(?:agenda|planning)\\b`, confidence: 0.85 },
    { intent: 'GET_TASKS', pattern: `^wat moet ik\\b.*\\bdoen\\b`, confidence: 0.97 },
    { intent: 'GET_TASKS', pattern: `^wat zijn mijn taken\\b`, confidence: 0.96 },
    { intent: 'GET_TASKS', pattern: `^(?:toon|geef|lijst)\\s+(?:mij\\s+|me\\s+)?mijn (?:taken|to-?do's?|todo's?|takenlijst|to-?do lijst|open taken)\\b`, confidence: 0.96 },
    { intent: 'GET_TASKS', pattern: `^wat staat er (?:nog\\s+)?op mijn (?:to-?do|todo|takenlijst|lijst)\\b`, confidence: 0.93 },
    { intent: 'GET_TASKS', pattern: `^wat moet er (?:nog\\s+)?gebeuren\\b`, confidence: 0.9 },
    { intent: 'GET_TASKS', pattern: `^(?:mijn )?taken\\b`, confidence: 0.85 },
    { intent: 'CAPTURE_IDEA', pattern: `^(?:ik\\s+)?(?:heb|had|kreeg)\\s+(?:net\\s+|zonet\\s+|juist\\s+|daarnet\\s+)?(?:een\\s+)?(?:nieuw\\s+|zakelijk\\s+|goed\\s+|leuk\\s+)?idee(?:tje)?\\b(?:\\s*[:,.\\-]|\\s+voor|\\s+over|\\s+om)?`, confidence: 0.96 },
    { intent: 'CAPTURE_IDEA', pattern: `^idee\\s*[:\\-]?\\s`, confidence: 0.95 },
    { intent: 'CAPTURE_IDEA', pattern: `^(?:nieuw|zakelijk|business|app)\\s*idee\\b(?:\\s*[:\\-]|\\s+voor|\\s+over)?`, confidence: 0.94 },
    { intent: 'CAPTURE_IDEA', pattern: `^wat als\\b`, confidence: 0.7 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:onthoud|onthou|noteer|schrijf op|noteer even|hou in gedachten|houd in gedachten|bewaar|sla op)\\s+(?:dat|dit|het volgende|even dat)\\b`, confidence: 0.96 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:notitie|nota|gedachte|memo|onthouden|braindump|brain dump)\\s*[:\\-]\\s`, confidence: 0.95 },
    { intent: 'CAPTURE_NOTE', pattern: `^ik moet (?:onthouden|niet vergeten) (?:dat\\s+)?`, confidence: 0.95 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:onthoud|onthou|noteer|schrijf op)\\b`, confidence: 0.85 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:ik denk|ik vind|ik geloof)\\b`, confidence: 0.65 },
    { intent: 'CREATE_TASK', pattern: `^(?:voeg|zet)\\s+(?<rest>.+?)\\s+(?:toe\\s+)?(?:aan|op|bij)\\s+(?:mijn\\s+|de\\s+|m'n\\s+)?(?<list>boodschappen|todo|to-?do|taken|winkel)?\\s*lijst(?:je)?\\b`, confidence: 0.97 },
    { intent: 'CREATE_TASK', pattern: `^(?:ik moet|moet ik)(?:\\s+nog)?\\b`, confidence: 0.95 },
    { intent: 'CREATE_TASK', pattern: `^ik zou (?:nog\\s+)?moeten\\b`, confidence: 0.9 },
    { intent: 'CREATE_TASK', pattern: `^(?:taak|todo|to-?do)\\s*[:\\-]\\s`, confidence: 0.95 },
    { intent: 'CREATE_TASK', pattern: `^(?:niet vergeten|vergeet niet)\\s+(?:om\\s+)?`, confidence: 0.93 },
    { intent: 'CREATE_TASK', pattern: `^(?:voeg|maak|nieuwe?)\\s+(?:een\\s+)?taak\\b(?:\\s*[:\\-]|\\s+toe|\\s+om)?`, confidence: 0.94 },
    { intent: 'CREATE_TASK', pattern: `^(?:ik ga|we moeten)\\b`, confidence: 0.7 },
  ],
  fr: [
    { intent: 'ALERT_OFFSET', pattern: `^(?:et\\s+)?(?:rappelle[- ]moi|préviens[- ]moi|previens[- ]moi|alerte[- ]moi)\\s+(?<num>\\d+|une?|deux|cinq|dix|quinze|vingt|trente|soixante)\\s+(?<unit>minutes?|min|heures?)\\s+(?:avant|à l'avance|a l'avance|plus tôt|plus tot|auparavant)\\b`, confidence: 0.96 },
    { intent: 'CREATE_TIMER', pattern: `^(?:mets|met|lance|règle|regle|démarre|demarre|programme|active|mettre)\\s+(?:un\\s+|le\\s+)?(?:minuteur|timer|chrono|compte à rebours|compte a rebours)\\b(?:\\s+(?:de|pour|d'|sur))?`, confidence: 0.97 },
    { intent: 'CREATE_TIMER', pattern: `\\b(?:minuteur|timer)\\b(?:\\s+(?:de|pour|d'))?`, confidence: 0.85 },
    { intent: 'CREATE_ALARM', pattern: `^r[ée]veille[- ]moi\\b`, confidence: 0.97 },
    { intent: 'CREATE_ALARM', pattern: `\\b(?:mets|met|règle|regle|programme|active|mettre)\\s+(?:un\\s+|une\\s+|le\\s+|l')?(?:r[ée]veil|alarme)\\b(?:\\s+(?:pour|à|a))?`, confidence: 0.96 },
    { intent: 'CREATE_ALARM', pattern: `^(?:r[ée]veil|alarme)\\b(?:\\s+(?:pour|à|a))?`, confidence: 0.9 },
    { intent: 'CREATE_REMINDER', pattern: `^rappelle[- ]moi(?:\\s+(?:de|d'|que))?\\b`, confidence: 0.97 },
    { intent: 'CREATE_REMINDER', pattern: `\\b(?:mets|met|crée|cree|ajoute|programme)\\s+(?:un\\s+)?rappel\\b(?:\\s+(?:pour|de|d'))?`, confidence: 0.95 },
    { intent: 'CREATE_REMINDER', pattern: `^rappel\\s*[:\\-]?\\s`, confidence: 0.9 },
    { intent: 'CREATE_REMINDER', pattern: `^fais[- ]moi penser (?:à|a)\\b`, confidence: 0.93 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `\\b(?:mets|met|ajoute|planifie|programme|note|inscris|enregistre|bloque)\\b.*\\b(?:dans|sur|à|a|au)\\s+(?:mon\\s+|l'|le\\s+)?(?:agenda|calendrier|planning)\\b`, confidence: 0.97 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?:planifie|programme|organise|prévois|prevois|fixe|réserve|reserve|mets|met|ajoute)\\s+(?:une?\\s+|le\\s+|la\\s+|mon\\s+|ma\\s+)?(?=(?:réunion|reunion|rendez-vous|rdv|appel|dîner|diner|déjeuner|dejeuner|petit-déjeuner|café|cafe|séance|seance|visite|entretien|sport|dentiste|médecin|medecin)\\b)`, confidence: 0.96 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?:planifie|programme|organise)\\b`, confidence: 0.85 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^j'ai (?:une?\\s+|le\\s+|la\\s+)?(?=(?:réunion|reunion|rendez-vous|rdv|appel|dîner|diner|déjeuner|dejeuner|entretien|visite)\\b)`, confidence: 0.93 },
    { intent: 'CREATE_CALENDAR_EVENT', pattern: `^(?=(?:réunion|reunion|rendez-vous|rdv|dîner|diner|déjeuner|dejeuner|café|cafe)\\s+avec\\b)`, confidence: 0.92 },
    { intent: 'COMPLETE_TASK', pattern: `^(?:marque|note|coche)\\s+(?<target>.+?)\\s+comme\\s+(?:fait|faite|terminé|terminée|termine|complété|complete|réglé|regle)\\s*$`, confidence: 0.97 },
    { intent: 'COMPLETE_TASK', pattern: `^(?<target>.+?)\\s+est\\s+(?:fait|faite|terminé|terminée|termine|réglé)\\s*$`, confidence: 0.9 },
    { intent: 'COMPLETE_TASK', pattern: `^j'ai (?:fini|terminé|termine|réglé|regle)\\s+(?<target>.+)$`, confidence: 0.9 },
    { intent: 'COMPLETE_TASK', pattern: `^coche\\s+(?<target>.+)$`, confidence: 0.92 },
    { intent: 'UPDATE_TASK', pattern: `^(?:déplace|deplace|reporte|décale|decale|repousse)\\s+(?<target>.+?)\\s+(?:à|a|au|vers|pour)\\s+(?<rest>.+)$`, confidence: 0.94 },
    { intent: 'UPDATE_TASK', pattern: `^change\\s+(?<target>.+?)\\s+(?:à|a|pour|en)\\s+(?<rest>.+)$`, confidence: 0.85 },
    { intent: 'DELETE_EVENT', pattern: `^(?:supprime|annule|enlève|enleve|retire|efface)\\s+(?:le\\s+|la\\s+|les\\s+|mon\\s+|ma\\s+|mes\\s+|l')?(?<target>.+)$`, confidence: 0.93 },
    { intent: 'SEARCH_NOTES', pattern: `^qu'est[- ]ce que j'ai (?:dit|écrit|ecrit|noté|note|mentionné|mentionne|pensé|pense)\\s+(?:sur|à propos de|a propos de|concernant|au sujet de|de)\\s+(?<query>.+)$`, confidence: 0.96 },
    { intent: 'SEARCH_NOTES', pattern: `^(?:que devais[- ]je|qu'est[- ]ce que je devais)\\s+(?<query>acheter|faire|commander)\\b.*$`, confidence: 0.9 },
    { intent: 'SEARCH_NOTES', pattern: `^(?:cherche|trouve|recherche|montre[- ]moi|affiche|retrouve)\\s+(?:mes\\s+|toutes\\s+|tous\\s+|les\\s+|toutes mes\\s+)?(?<types>notes?|idées?|idees?|pensées?|pensees?|tâches?|taches?|rappels?)?\\s*(?:sur|à propos de|a propos de|concernant|pour|au sujet de|liées? à|liees? a)?\\s*(?<query>.+)$`, confidence: 0.93 },
    { intent: 'GET_AGENDA', pattern: `^qu'est[- ]ce que j'ai\\b.*\\b(?:de prévu|de prevu|au programme|à l'agenda|a l'agenda|comme rendez-vous)\\b`, confidence: 0.97 },
    { intent: 'GET_AGENDA', pattern: `^à quoi ressemble ma (?:journée|journee|semaine)\\b|^a quoi ressemble ma (?:journée|journee|semaine)\\b`, confidence: 0.96 },
    { intent: 'GET_AGENDA', pattern: `^qu'est[- ]ce qui est (?:prévu|prevu|au programme)\\b`, confidence: 0.93 },
    { intent: 'GET_AGENDA', pattern: `^(?:montre|affiche|donne)[- ]moi mon (?:agenda|programme|planning)\\b`, confidence: 0.95 },
    { intent: 'GET_AGENDA', pattern: `^(?:quel est|c'est quoi) mon (?:programme|agenda|planning)\\b`, confidence: 0.95 },
    { intent: 'GET_AGENDA', pattern: `^(?:mon )?(?:agenda|planning|programme)\\b`, confidence: 0.85 },
    { intent: 'GET_TASKS', pattern: `^qu'est[- ]ce que je dois (?:encore\\s+)?faire\\b`, confidence: 0.97 },
    { intent: 'GET_TASKS', pattern: `^quelles sont mes (?:tâches|taches)\\b`, confidence: 0.96 },
    { intent: 'GET_TASKS', pattern: `^(?:montre|affiche|liste|donne)[- ]?(?:moi\\s+)?mes (?:tâches|taches|to-?do|choses à faire|choses a faire)\\b`, confidence: 0.96 },
    { intent: 'GET_TASKS', pattern: `^qu'est[- ]ce qu'il me reste (?:à|a) faire\\b`, confidence: 0.93 },
    { intent: 'GET_TASKS', pattern: `^que dois[- ]je (?:encore\\s+)?faire\\b`, confidence: 0.93 },
    { intent: 'GET_TASKS', pattern: `^(?:mes )?(?:tâches|taches)\\b`, confidence: 0.85 },
    { intent: 'CAPTURE_IDEA', pattern: `^(?:j'ai|j'ai eu|il me vient|je viens d'avoir)\\s+(?:une\\s+)?(?:nouvelle\\s+|petite\\s+|super\\s+|bonne\\s+)?id[ée]e\\b(?:\\s*[:,.\\-]|\\s+pour|\\s+de|\\s+d'|\\s+sur)?`, confidence: 0.96 },
    { intent: 'CAPTURE_IDEA', pattern: `^id[ée]e\\s*[:\\-]?\\s`, confidence: 0.95 },
    { intent: 'CAPTURE_IDEA', pattern: `^(?:nouvelle\\s+)?id[ée]e (?:de|d'|pour)\\b`, confidence: 0.94 },
    { intent: 'CAPTURE_IDEA', pattern: `^et si\\b`, confidence: 0.7 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:souviens[- ]toi|rappelle[- ]toi|note|retiens|écris|ecris|garde en tête|garde en tete|enregistre)\\s+(?:que|ceci|ça|ca|la chose suivante)\\b`, confidence: 0.96 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:note|notes|pensée|pensee|mémo|memo|à retenir|a retenir)\\s*[:\\-]\\s`, confidence: 0.95 },
    { intent: 'CAPTURE_NOTE', pattern: `^je dois (?:me\\s+)?(?:rappeler|souvenir|retenir)\\s+(?:que\\s+)?`, confidence: 0.95 },
    { intent: 'CAPTURE_NOTE', pattern: `^il faut (?:que je\\s+)?(?:retienne|retenir|me souvienne|se souvenir|me souvenir)\\s+(?:que\\s+)?`, confidence: 0.94 },
    { intent: 'CAPTURE_NOTE', pattern: `^(?:note|retiens|souviens[- ]toi)\\b`, confidence: 0.85 },
    { intent: 'CAPTURE_NOTE', pattern: `^je (?:pense|crois) que\\b`, confidence: 0.65 },
    { intent: 'CREATE_TASK', pattern: `^(?:ajoute|mets|met)\\s+(?<rest>.+?)\\s+(?:à|a|sur|dans)\\s+(?:ma\\s+|la\\s+)?liste(?:\\s+(?:de\\s+|des\\s+)(?<list>courses|tâches|taches|choses à faire|à faire))?\\b`, confidence: 0.97 },
    { intent: 'CREATE_TASK', pattern: `^je dois\\b`, confidence: 0.95 },
    { intent: 'CREATE_TASK', pattern: `^il faut que je\\b`, confidence: 0.93 },
    { intent: 'CREATE_TASK', pattern: `^je devrais\\b`, confidence: 0.9 },
    { intent: 'CREATE_TASK', pattern: `^il faut\\b`, confidence: 0.85 },
    { intent: 'CREATE_TASK', pattern: `^(?:tâche|tache|todo|to-?do|à faire|a faire)\\s*[:\\-]\\s`, confidence: 0.95 },
    { intent: 'CREATE_TASK', pattern: `^(?:n'oublie pas|ne pas oublier|oublie pas|faut pas oublier)\\s+(?:de\\s+|d')?`, confidence: 0.93 },
    { intent: 'CREATE_TASK', pattern: `^(?:ajoute|crée|cree|nouvelle?)\\s+(?:une\\s+)?(?:tâche|tache)\\b(?:\\s*[:\\-]|\\s+pour|\\s+de)?`, confidence: 0.94 },
    { intent: 'CREATE_TASK', pattern: `^(?:acheter|appeler|envoyer|commander|réserver|reserver|payer|finir|écrire|ecrire|vérifier|verifier|nettoyer|préparer|preparer)\\b`, confidence: 0.72 },
  ],
};

/**
 * Words that mark the start of a new command inside one sentence; used to split
 * "remind me at nine to call Yakup, add gym at seven to my calendar and note that…"
 * into three clauses. Only strong, sentence-initial triggers belong here.
 */
export const CLAUSE_STARTERS: Record<Language, string[]> = {
  en: [
    'remind me', 'wake me', 'set a timer', 'start a timer', 'set an alarm', 'set alarm',
    'add ', 'put ', 'schedule ', 'plan ', 'book ', 'note that', 'note:', 'remember that', 'write down',
    'i have an idea', 'i had an idea', 'idea:', 'i need to', 'i have to', 'i must', 'mark ', 'move ', 'delete ', 'cancel ',
    'what did i say', 'what do i', "what's on my", 'what is on my', 'find my', 'search ', 'alert me', 'notify me',
  ],
  nl: [
    'herinner mij', 'herinner me', 'maak mij', 'maak me', 'zet een timer', 'start een timer', 'zet een wekker', 'zet de wekker',
    'zet ', 'voeg ', 'plan ', 'boek ', 'noteer dat', 'noteer:', 'onthoud dat', 'schrijf op', 'ik heb een idee', 'idee:',
    'ik moet', 'markeer ', 'verplaats ', 'verwijder ', 'annuleer ', 'wat heb ik gezegd', 'wat moet ik', 'wat staat er', 'zoek ', 'vind ',
    'verwittig mij', 'verwittig me', 'waarschuw mij', 'waarschuw me',
  ],
  fr: [
    'rappelle-moi', 'rappelle moi', 'réveille-moi', 'reveille-moi', 'mets un minuteur', 'lance un minuteur', 'mets un réveil', 'mets une alarme',
    'mets ', 'ajoute ', 'planifie ', 'programme ', 'note que', 'note:', 'souviens-toi que', 'retiens que', "j'ai une idée", 'idée:',
    'je dois', 'il faut que je', 'marque ', 'déplace ', 'supprime ', 'annule ', "qu'est-ce que j'ai dit", "qu'est-ce que je dois", 'cherche ', 'trouve ',
    'préviens-moi', 'previens-moi', 'alerte-moi',
  ],
};

/** Filler words removed from titles. */
export const FILLERS: Record<Language, string[]> = {
  en: ['please', 'just', 'maybe', 'also', 'then', 'kindly', 'quickly', 'again'],
  nl: ['even', 'eens', 'maar', 'alsjeblieft', 'alstublieft', 'aub', 'a.u.b.', 'misschien', 'ook', 'nog', 'gewoon', 'effe', 'opnieuw', 'eventjes'],
  fr: ["s'il te plaît", "s'il te plait", "s'il vous plaît", "s'il vous plait", 'stp', 'svp', 'juste', 'aussi', 'peut-être', 'peut-etre', 'encore', 'un peu'],
};

/** Phrases removed from titles after the trigger and the date have been stripped. */
export const TITLE_NOISE: Record<Language, string[]> = {
  en: [
    'in my calendar', 'to my calendar', 'on my calendar', 'into my calendar', 'in the calendar', 'to the calendar', 'on the calendar',
    'in my agenda', 'to my agenda', 'in my schedule', 'to my schedule', 'in calendar', 'to calendar',
  ],
  nl: [
    'in mijn agenda', 'op mijn agenda', 'aan mijn agenda', 'in de agenda', 'op de agenda', "in m'n agenda", 'in mijn kalender', 'op mijn kalender',
    'in mijn planning', 'toe aan mijn agenda', 'toe',
  ],
  fr: [
    'dans mon agenda', 'sur mon agenda', 'à mon agenda', 'a mon agenda', 'au calendrier', 'dans le calendrier', 'dans mon calendrier',
    "dans l'agenda", 'sur mon calendrier', 'dans mon planning', 'à mon calendrier', 'a mon calendrier',
  ],
};

/** Leading connector words stripped from titles ("to call", "om te bellen", "d'appeler"). */
export const LEADING_CONNECTORS: Record<Language, string[]> = {
  en: ['to', 'that', 'about', 'of', 'the following', 'and', 'for', 'me', 'on', 'this', 'a', 'an'],
  nl: ['om', 'dat', 'aan', 'over', 'eraan', 'er aan', 'te', 'en', 'voor', 'me', 'mij', 'een', 'het', 'de', 'dit', 'even'],
  fr: ['de', "d'", 'que', 'à', 'a', 'pour', 'et', 'moi', 'me', 'ceci', 'ça', 'ca', 'un', 'une', 'le', 'la', "l'"],
};
