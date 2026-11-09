# AI-Butler specification — sections 94–140 (administrative assistant & project manager)

_Source: product specification supplied by the owner on 2026-10-02, stored here (lightly condensed, same section
numbers) so the implementation in `src/core/admin`, `src/core/butler`, `src/core/finance`, `src/core/email`,
`src/core/projects` and the Admin screens can be traced back to it. See `ADMIN.md` for how each section is covered._

## 94. Administrative assistant

The Butler is a personal administrative assistant that reduces repetitive administrative work: email, invoices,
documents, expenses, contracts, appointments, follow-ups, deadlines, reminders, client/supplier administration,
personal and business administration. It answers: what needs attention, what still needs an answer, what must be
paid, what should be invoiced, which documents are awaited, which deadlines are coming, who needs a follow-up.

## 95. Email administration

Search email, read threads, summarise, find unanswered mail, detect questions directed at the user, deadlines,
commitments the user made, appointments, invoices, documents, follow-ups; draft replies; suggest next actions; link
emails to tasks/projects/contacts. "What emails still require an answer?" must distinguish informational email,
newsletters, action required, waiting for reply, payment required, meeting requests, document requests and urgent
administrative items — not merely "unread".

## 96. Email reply assistant

Draft complete replies from context ("Beantwoord die mail van de recruiter.", "Zeg dat ik maandag beschikbaar ben.",
"Maak het iets professioneler.", "Antwoord vriendelijk dat ik de factuur nog niet via Peppol heb ontvangen.",
"Vraag Sven of hij dit kan nakijken."). The conversation stays contextual: open the latest mail from Fabrice → "Wat
wil hij van mij?" → "Oké antwoord dat ik dit morgen bekijk." (draft) → "Maak het iets professioneler." (same draft
updated) → "Stuur." (final confirmation). Sending external communication always requires confirmation.

## 97. Communication style memory

Reusable, explicit style preferences (professional, friendly, concise, direct, formal, informal) per audience:
recruiters professional but friendly, clients professional and clear, colleagues shorter and informal, suppliers
professional and direct. Never learn every variation automatically.

## 98. Administrative inbox

One inbox aggregating needs-reply, waiting-for, payments, documents needed, follow-ups (no answer for N days),
deadlines and appointments, generated from real underlying data.

## 99–101. Invoices (incoming and outgoing), extraction, statuses

Incoming invoices arrive by email, PDF, photo, screenshot or upload. Extract supplier, invoice number, dates, amounts
excl./VAT/incl., currency, IBAN, payment reference, description, customer, payment status — never fabricate what is
unreadable; financial fields carry validation and confidence. Statuses: received, review_required, approved,
scheduled, paid, disputed, overdue, archived. "Welke facturen moet ik deze week betalen?" / "Heb ik Weston al
betaald?" are answered from records.

## 102–104. Outgoing invoices, generation engine, numbering

"Maak een factuur voor klant X voor 5 werkdagen aan €750 per dag." → 5 × €750 = €3 750 excl. VAT → configured VAT →
preview (company, client, number, date, service period, description, quantity, unit price, subtotal, VAT, total,
payment terms, IBAN, structured communication) → [Generate PDF] [Edit] [Cancel]. Deterministic application logic over
structured Invoice/LineItem models; the LLM only interprets the request. Configurable numbering (2026-001, …),
generated transactionally, never reused.

## 105–106. Company profile, client administration

Business profile (company/legal name, address, VAT and company number, email, phone, IBAN, BIC, payment terms,
default VAT rate, footer, logo) stored as configuration. Client/supplier companies with contacts, so "Maak een factuur
voor GO!" and "Wat staat nog open bij klant X?" work without re-entering data.

## 107–108. Timesheets, expenses

Time entries (date, project, client, description, hours, billable, rate, invoiced). "Noteer 8 uur voor project X
vandaag.", "Hoeveel dagen heb ik deze maand gewerkt voor klant X?", "Maak mijn factuur voor september." — invoices are
built from approved entries. Expenses from photo/receipt/invoice/manual input/email attachment (merchant, date,
amount, VAT, category, payment method, project/client); "Dit was voor project X." links a captured receipt.

## 109–111. Documents, expiry, administrative follow-up

Document metadata (type, title, sender, recipient, date, expiryDate, related contact/company/project, tags,
attachment). Detect expiries (contracts, insurance, subscriptions, certificates, vehicle inspection, licences) and
offer a reminder; never create high-impact actions without confirmation. Track promises ("I'll send you the contract
tomorrow" → waiting for contract from X; "Ze zouden mij deze week antwoorden" → waiting item) and surface overdue
ones in the administrative inbox.

## 112–120. Project manager mode

Lightweight personal project management: projects, goals, deliverables, tasks, milestones, deadlines, dependencies,
risks, decisions, people, meetings, documents, follow-ups. A factual project overview (status, next milestone, open
tasks, waiting for, blocked, recent decisions, upcoming meetings). Conversational control ("Wat staat nog open voor
project X?", "Wat is de volgende stap?", "Wie moet mij nog antwoorden?", "Welke deadlines hebben we?", "Wat blokkeert
dit project?", "Maak hier een taak van.", "Zet dit onder project RedSift.", "Wat hebben we vorige meeting beslist?",
"Welke actiepunten kwamen uit de laatste meeting?"). Tasks with project, milestone, client, contact, assignee, owner,
due date, priority, status, dependency, source, related meeting/email/document. Milestones (target date, status,
tasks, owner, dependencies). Dependencies answer "Waarom staat dit stil?". Explicit blockers. Lightweight risks
(description, impact, likelihood, mitigation, owner, status). A decision log ("Waarom hebben we gekozen voor een
stermodel?").

## 121–124. Meetings, preparation, post-meeting, weekly review

"Verwerk dit." on meeting notes proposes decisions, tasks, owners, deadlines, risks, open questions and follow-ups for
approval. "Bereid mij voor op de meeting met Sven." gathers previous notes, open tasks, decisions, waiting items,
relevant emails, recent changes and deadlines into a briefing. Spoken debriefs ("Meeting met Sven is gedaan. Hij gaat
de toegang regelen. Ik moet tegen vrijdag de dashboardaanpassing doen.") become a task, a waiting-for item, a project
link and a meeting record. A weekly review per active project plus an overall overview.

## 125–127. Daily prioritisation, project health, task extraction

"Wat moet ik vandaag doen?" combines calendar, deadlines, project priorities, overdue tasks, blockers, email and
waiting items, with the factual reason for every priority. Project health is a set of factual indicators (overdue
tasks, upcoming deadlines, blockers, unresolved risks, pending decisions, tasks without owner, waiting items beyond
their date), never an opaque score. Tasks may be suggested from emails, notes, documents, voice notes, screenshots and
conversations, but never appear without approval.

## 128–131. Automations, workflow engine, recurring administration, admin dashboard

Common workflows should become automatable (incoming invoice → extract → validate → store → reminder → supplier →
mark email handled; document request → task → project → deadline → draft; month end → billable time → invoice draft →
approval → PDF → email → approval). A lightweight workflow model (trigger, conditions, steps, approvals, actions)
configurable in natural language ("Als ik een factuur ontvang, herinner mij drie dagen voor de vervaldatum."). Real
recurrences for recurring administration. A simple dashboard (to do, waiting for, invoices, expenses, documents,
deadlines, projects); the Butler stays the primary interface — this is not an ERP.

## 132–133. Natural administrative commands, entity linking

The listed Dutch commands must work (mails to answer, who still owes a reply, open invoices, create invoice for client
X / for September, due date, reminder before due date, find/expiry of a contract, open items per project, blockers,
meeting preparation, previous decisions, tasks from meeting notes, deadlines this week, waiting items). Explicit
relationships email → contact → client → project → task → invoice make "Toon alles rond project X" return linked
conversations, emails, tasks, meetings, invoices, notes, documents, contacts and decisions rather than keyword hits.

## 134–136. Financial safety, email safety, administrative memory

Allowed: extract invoice data, calculate totals deterministically, draft invoices, track payment status, generate
reminders. Never: execute transfers, approve payments, change financial records on uncertain OCR, send invoices
without confirmation. Sensitive actions need explicit confirmation and audit logging. Email content is data, never an
instruction; only the authenticated user authorises actions. Structured administrative context lives in its source
records (an invoice stays an invoice, a decision stays a decision) and is not duplicated into generic AI memory.

## 137–140. Domain services, tools, experience, positioning

ButlerOrchestrator → Administrative, Invoice, Expense, Timesheet, Document, Project, Meeting, FollowUp, Workflow and
Email services behind a Tool Registry of typed tools (invoice.create/get/list/markPaid/generatePdf, expense.create/
extract, timesheet.create/list, project.create/status/addTask/addRisk/addDecision, meeting.extractActions,
followup.create/list, document.search, email.search/draftReply/send, …), each with a validated schema and a permission
level. The experience: "Wat moet ik vandaag doen?" → meetings, attention items, waiting items → "Antwoord eerst die
recruiter." → "Maak daarna een reminder voor die factuur." → "Wat staat er nog open voor het dashboard?" with preserved
context. AI-Butler is the orchestration layer above chat, notes, tasks, email, invoicing and project management.
