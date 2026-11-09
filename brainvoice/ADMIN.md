# AI-Butler – administrative assistant & project manager

_Implements spec §94–§140 (`docs/SPEC-94-140-ADMIN-PM.md`). Status: domain layer complete and tested on
`node:sqlite` (`npm run check`); screens written but, like the rest of the app, not yet run on a device from this
Windows machine._

BrainVoice's capture engine (notes, tasks, reminders, calendar, alarms) stays as it was. On top of it sits the
**Butler**: one conversation that understands administrative and project questions, answers them from real records,
and only ever changes something after you confirmed a preview card.

```
"Wat moet ik vandaag doen?"                     → daily plan with the factual reason per item
"Welke mails moet ik nog beantwoorden?"         → emails that need an answer (not merely unread)
"Open de laatste mail van Fabrice." → "Wat wil hij van mij?" → "Antwoord dat ik dit morgen bekijk."
→ "Maak het iets professioneler." → "Stuur."     → one draft, refined in place, sent after confirmation
"Maak een factuur voor klant GO! voor 5 werkdagen aan €750 per dag." → preview (3 750 + 21 % = 4 537,50)
"Maak de pdf."                                  → number 2026-001 assigned transactionally, +++ OGM +++, PDF
"Noteer 8 uur voor project Dashboard vandaag."  / "Maak mijn factuur voor september."
"Meeting met Sven is gedaan. Hij gaat de toegang regelen. Ik moet tegen vrijdag de dashboardaanpassing doen."
→ proposals (task for me, waiting for Sven) → "Keur alles goed."
"Waarom staat dit stil?"                        → blockers, dependencies, overdue waiting items
"Als ik een factuur ontvang, herinner mij drie dagen voor de vervaldatum."  → automation
```

---

## 1. How a sentence becomes an action

```
text ─► IntentEngine
         1. ContextResolver   (clarification answers, "make that 3 instead" – skipped for Butler tools)
         1b. AdminParser.complete  (answer to a Butler question, e.g. the invoice lines)
         2a. AdminParser       (deterministic nl/en/fr rules for §132 commands → BUTLER_TOOL command)
         2b. DeterministicParser (capture intents)
         3. LLMParser          (long tail; may also pick a tool from the catalog, dates stay phrases)
         4. CommandValidator   (tool args re-validated with the catalog's Zod schema; sensitive/external
                               tools get CONFIRM_REQUIRED, so they can never auto-execute)
         5. decision           (read-only tools may auto-execute when the user enabled that; everything
                               else shows the preview card)
      ─► ActionRouter.execute
         BUTLER_TOOL → ToolRegistry.execute(tool, args, { focus, confirmed, services, adapters })
                       → handler → services → ToolOutcome { summary, payload, focus patch, undo }
         history row (undo plan `tool_undo`), conversation focus merged and saved
```

* **Catalog** – `src/core/butler/catalog.ts`: every tool with name, description, permission level, Zod schema and a
  localized preview. The same catalog validates parser output, LLM output and UI button calls.
* **Registry** – `src/core/butler/ToolRegistry.ts`: binds handlers, validates arguments, refuses `sensitive` /
  `external` tools without confirmation, writes the audit log, reverses executions for undo.
* **Focus** – `src/core/butler/focus.ts`: the email / draft / invoice / project / expense / document / proposals the
  conversation is about. Tool results patch it; the parser reads it ("die factuur", "stuur", "dit was voor project X").
  Focus expires after two hours.
* **Services** – `src/core/services/admin/*`: Company, Invoice, Expense, Timesheet, Document, FollowUp, Email,
  Project, Meeting, Suggestion, Workflow, Administrative, Audit, Link (spec §137).

## 2. Permission levels and safety (§134–§135)

| Level | Meaning | Examples |
|---|---|---|
| `read` | answers a question, changes nothing | admin.today, invoice.list, project.status, email.open |
| `write` | creates/changes local administrative records; previewed first | invoice.create (draft), timesheet.create, project.addTask |
| `sensitive` | financial records; explicit confirmation + audit row | invoice.issue, invoice.generatePdf, invoice.markPaid, invoice.recordIncoming |
| `external` | leaves the phone; explicit confirmation + audit row | email.send |

* The Butler never executes bank transfers, never approves payments and never sends an email on its own. `email.send`
  uses the connected account when one can send, otherwise it opens the system mail app with the draft – you press
  Send there.
* Email, document and meeting content is **data**. Prompts wrap it in `<untrusted_*>` tags with explicit rules
  (`src/core/butler/safety.ts`), deterministic analysis flags instruction-like text (`suspicious`), and derived items
  (tasks, waiting items, invoices) are stored as **proposals** that you approve (§121, §127).
* Uncertain extraction lands in `review_required`; important financial fields carry a confidence and the arithmetic
  (excl. + VAT = incl.), IBAN checksum and structured-communication checksum are verified (§100).
* Totals are computed by `src/core/finance/InvoiceEngine.ts` from integer cents and re-verified before rendering or
  paying; the LLM only interprets requests (§103). Invoice numbers come from a per-series counter inside the same
  transaction as the invoice update (§104).

## 3. Data (SQLite migration 3)

`companies`, `contacts`, `invoices` (+ `invoice_counters`), `expenses`, `time_entries`, `documents`, `follow_ups`,
`emails`, `email_drafts`, `projects`, `milestones`, `project_risks`, `decisions`, `blockers`, `meetings`,
`suggestions`, `workflows`, `workflow_runs`, `audit_log`; `tasks` gained project/milestone/company/contact/assignee/
owner/dependsOn/source columns; relationships reuse `item_links` (§133). The business profile and the explicit
communication styles live in `settings` (§105, §97). Records stay source data – nothing is copied into AI memory (§136).

## 4. Tool catalog (§138)

| Domain | Tools |
|---|---|
| Overview | admin.today, admin.inbox, admin.weeklyReview, admin.deadlines, admin.dashboard, admin.recurring |
| Follow-ups | followup.list, followup.create, followup.resolve |
| Email | email.needsReply, email.search, email.open, email.briefing, email.draftReply, email.refineDraft, email.send, email.compose, email.markHandled, email.import, email.suggest |
| Invoices | invoice.list, invoice.paymentStatus, invoice.get, invoice.create, invoice.updateDraft, invoice.issue, invoice.generatePdf, invoice.cancelDraft, invoice.markPaid, invoice.remind, invoice.recordIncoming, invoice.approve |
| Time & expenses | timesheet.create, timesheet.summary, timesheet.list, timesheet.invoice, expense.create, expense.extract, expense.assign, expense.approve, expense.list |
| Documents | document.search, document.expiring, document.create, document.remind |
| Projects | project.list, project.create, project.status, project.everything, project.nextStep, project.blockers, project.decisions, project.addTask, project.assign, project.addRisk, project.addDecision, project.addBlocker, project.resolveBlocker, project.addMilestone |
| Meetings | meeting.prepare, meeting.extractActions, meeting.debrief, meeting.actions, meeting.record, suggestions.list, suggestions.approve, suggestions.reject |
| Clients & profile | company.list, company.create, company.open, contact.create, style.set, profile.get, profile.update |
| Automations | workflow.create, workflow.list |

## 5. Natural commands recognised offline (§132)

The `AdminParser` covers the spec sentences in Dutch, English and French (`src/core/butler/AdminParser.test.ts` lists
~95 of them). Everything else goes to the capture parser and, when cloud AI is enabled, the LLM can still pick a tool
from the catalog (`toolArgs`, dates as phrases resolved locally).

| Say | Tool |
|---|---|
| Welke mails moet ik nog beantwoorden? · What emails still require an answer? | email.needsReply |
| Wie moet mij nog antwoorden? · Waar wacht ik nog op? | followup.list |
| Welke facturen staan nog open? · Welke facturen moet ik deze week betalen? | invoice.list |
| Heb ik Weston al betaald? | invoice.paymentStatus |
| Maak een factuur voor klant X (voor 5 werkdagen aan €750 per dag). | invoice.create (asks for lines when missing) |
| Maak mijn factuur voor september. | timesheet.invoice |
| Wanneer vervalt deze factuur? · Herinner mij twee dagen voor de vervaldag. | invoice.get · invoice.remind |
| Zoek mijn contract met klant X. · Wanneer loopt mijn contract af? | document.search · document.expiring |
| Wat staat nog open voor project X? · Toon alles rond project X. | project.status · project.everything |
| Welke blockers heb ik? · Waarom staat dit stil? · Wat is de volgende stap? | project.blockers · project.nextStep |
| Bereid mij voor op de meeting met Sven. | meeting.prepare |
| Wat hebben we vorige keer beslist? · Waarom hebben we gekozen voor …? | project.decisions |
| Verwerk dit: … · Maak taken van deze meeting notes. | meeting.extractActions |
| Meeting met Sven is gedaan. Hij gaat … Ik moet tegen vrijdag … | meeting.debrief |
| Welke deadlines heb ik deze week? · Wat moet ik vandaag doen? | admin.deadlines · admin.today |
| Noteer 8 uur voor project X vandaag. · Hoeveel dagen heb ik deze maand gewerkt voor klant X? | timesheet.create · timesheet.summary |
| Dit was voor project X. (after a receipt) · Zet dit onder project RedSift. · Maak hier een taak van. | expense.assign · project.assign · project.addTask |
| Open de laatste mail van Fabrice. → Wat wil hij van mij? → Antwoord dat … → Maak het professioneler. → Stuur. | email.open → email.briefing → email.draftReply → email.refineDraft → email.send |
| Antwoord recruiters altijd professioneel maar vriendelijk. | style.set |
| Als ik een factuur ontvang, herinner mij drie dagen voor de vervaldatum. | workflow.create |
| Herinner mij op het einde van elke maand mijn facturen op te maken. | admin.recurring |

## 6. Screens

Tab **Butler** (`src/app/(tabs)/admin.tsx`) shows the dashboard (§131) and quick questions. From there:
administrative inbox, invoices (+ detail with issue / PDF / share / mark paid / reminder / extraction review),
projects (+ overview with quick capture of tasks, decisions, risks, blockers, meeting notes), clients & contacts,
email (import by pasting, needs-reply view, drafts), documents (file / photo / text, expiry reminders), timesheet,
expenses (receipt photo needs cloud AI; pasted text works offline), proposals, and Settings → Business profile
(profile, writing styles, automations, audit log). Tool results inside the capture flow render through
`src/features/butler/ToolResultView.tsx`; the preview card shows the exact draft or invoice before `Stuur` / `Maak de pdf`.

## 7. Spec traceability

| § | Where |
|---|---|
| 94–95 email administration, classification | `core/email/classify.ts`, `EmailService`, `email.*` tools |
| 96 reply assistant, contextual conversation | `EmailService.draftReply/refineDraft`, `core/email/drafting.ts`, focus + `email.send` confirmation |
| 97 style memory | `CompanyService.communicationPreferences/setStyle`, `style.set`, Settings → Business profile |
| 98 administrative inbox | `AdministrativeService.inbox`, `/admin/inbox` |
| 99–101 invoices, extraction, statuses | `InvoiceService`, `core/finance/extraction.ts`, `invoice.*` |
| 102–104 outgoing invoices, engine, numbering | `InvoiceEngine`, `invoiceHtml.ts`, `InvoiceService.issue` (transactional counter) |
| 105–106 profile, clients | `CompanyService`, `/settings/business`, `/admin/clients` |
| 107 timesheets | `TimesheetService`, `timesheet.*`, `/admin/timesheet` |
| 108 expenses | `ExpenseService`, `expense.*`, `/admin/expenses` |
| 109–110 documents, expiry | `DocumentService` (detectExpiryDate), `document.*` |
| 111 follow-up | `FollowUpService`, email commitments → proposals, inbox surfacing |
| 112–120 projects, milestones, dependencies, blockers, risks, decisions | `ProjectService` (+ `explainStall`, `health`), `project.*` |
| 121–123 meetings | `MeetingService` + `core/meetings/extract.ts`, `SuggestionService` |
| 124–126 weekly review, daily plan, health | `AdministrativeService.weeklyReview/dailyPlan`, `ProjectService.health` |
| 127 task extraction | `email.suggest`, `meeting.extractActions` → `suggestions` table, approval only |
| 128–130 automations, workflow engine, recurring | `WorkflowService`, `core/workflow/parse.ts`, built-in invoice reminder, `admin.recurring` |
| 131 dashboard | `/admin` tab |
| 132 natural commands | `AdminParser` |
| 133 linking | `LinkService` / `item_links`, `project.everything`, `project.assign` |
| 134 financial safety | permission levels, `verifyTotals`, audit log |
| 135 email safety | `core/butler/safety.ts`, suspicious flag, proposals |
| 136 memory | records are the source of truth; prompts assemble context on demand |
| 137–138 services & tools | `services/admin/*`, `butler/catalog.ts`, `butler/tools/*` |
| 139 continuity | focus + daily plan setting focus (recruiter mail, invoice) |

## 8. Known limits / next steps

* **Email transport**: v1 stores emails you paste or share; `EmailAdapter` is the seam for a Gmail/IMAP sync and
  direct sending. Until then `email.send` hands the draft to the system mail app.
* **PDF text**: picked PDFs are stored as attachments; their text is not extracted on device (paste the text, or use a
  photo with cloud AI). Receipt/invoice photos need cloud AI; pasted text works offline.
* **Not verified on a device** (same as the rest of the app): expo-print PDF files, the share sheet, image/document
  pickers and `mailto:` composer were written against current Expo SDK 57 APIs but not run here.
* Workflow triggers currently fire on `invoice.received`; email/document/schedule triggers are modelled and stored but
  only emitted by that path.


## Alfred – operations commands (spec §141–§181)

These tools sit next to the Butler tools in the same catalog and go through the same preview,
permission and audit path. Background work (tickets) is executed by workers that reuse the
registry; sensitive/external steps always wait for an approval in Mission Control.

| Say | Tool | Permission |
|---|---|---|
| "Maak een ticket: zoek uit welke leverancier het goedkoopst is" / "Laat Alfred …" / "Create a ticket: …" | `ticket.create` | write |
| "Wat staat er in de wachtrij?" / "Wat doet Alfred nu?" / "Mission control" | `ticket.list` | read |
| "Status van ticket …" | `ticket.status` | read |
| "Annuleer het ticket …" (Mission Control button) | `ticket.cancel` | write |
| "Wat wacht op mijn goedkeuring?" / "Pending approvals" | `approval.list` | read |
| Approve / reject from Mission Control | `approval.decide` | sensitive |
| Answer Alfred's question | `question.answer` | write |
| "Geef me mijn ochtendbriefing" / "Avondoverzicht" / "Evening review" | `briefing.show` | read |
| "Elke maandag om 9u: geef me de open facturen" / "Every weekday at 8, send me my priorities" | `automation.create` (preview, then activate) | write |
| "Welke planningen heb ik?" | `automation.list` | read |
| "Maak een offerte voor Acme: 5 dagen aan 750 euro" | `quote.create` | write |
| "Welke offertes staan nog open?" | `quote.list` | read |
| "Verstuur de offerte voor Acme" | `quote.send` (number assigned, waiting-for item, mail composer) | external |
| "De offerte voor Acme is aanvaard" → invoice draft | `quote.accept` | sensitive |
| "De offerte voor Acme is afgewezen" | `quote.reject` | write |
| "Wat is de historiek met Acme?" | `crm.timeline` | read |
| "Noteer een gesprek met Acme: …" | `crm.logInteraction` | write |
| "Vraag de adviesraad: …" / "Ask the board: …" | `advisory.ask` (runs as a ticket) | write |
| "Welke toestellen zijn er?" | `home.devices` | read |
| "Zet het licht in de keuken aan" / "Turn off the heating" / "Vergrendel de voordeur" | `home.run` (LOW/MEDIUM/HIGH safety; HIGH needs the device name as confirmation) | sensitive |
| "Draait Alfred nog?" / "System health" | `system.health` | read |

Autonomy (Settings → Alfred): **ASSISTANT** – every change waits for approval; **PROACTIVE**
(default) – local records are created, sending/money waits; **OPERATOR** – Alfred also opens
tickets himself from email triage, CRM scans and the night shift. Sensitive and external actions
always need approval in every mode.

Honesty rules enforced in code: System Health says "24/7" only with a live server worker; email
"monitoring" only when a provider can list messages (the local store cannot); quotes/invoices are
never sent by Alfred – the mail composer or an approved provider does it; devices come from the
provider only.
