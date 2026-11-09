import { L, NO_DOCUMENT_FOCUS, NO_SUGGESTIONS, plural, requireFocus, resolveCompany, resolveContact, resolveProject, type Tri } from './shared';
import type { ToolContext, ToolRegistry } from '../ToolRegistry';
import type { Audience, CommunicationStyle, DocumentType, EntityRef, SuggestionKind, WorkflowStep } from '../../domain/admin';
import { checkProfileForInvoicing } from '../../finance/InvoiceEngine';
import { DomainError } from '../../types/common';

const TASKS: { one: Tri; many: Tri } = { one: { nl: 'open taak', en: 'open task', fr: 'tâche ouverte' }, many: { nl: 'open taken', en: 'open tasks', fr: 'tâches ouvertes' } };

function focusTarget(ctx: ToolContext): EntityRef | null {
  const f = ctx.focus;
  if (f.taskId) return { type: 'TASK', id: f.taskId };
  if (f.emailId) return { type: 'EMAIL', id: f.emailId };
  if (f.documentId) return { type: 'DOCUMENT', id: f.documentId };
  if (f.expenseId) return { type: 'EXPENSE', id: f.expenseId };
  if (f.invoiceId) return { type: 'INVOICE', id: f.invoiceId };
  if (f.meetingId) return { type: 'MEETING', id: f.meetingId };
  if (f.followUpId) return { type: 'FOLLOW_UP', id: f.followUpId };
  return null;
}

/** Project, meeting, suggestion, document, company, style, profile and workflow tools (§105–§131). */
export function registerProjectTools(registry: ToolRegistry): void {
  // ---- Projects ---------------------------------------------------------------

  registry.registerByName('project.list', async (_args, ctx) => {
    const projects = await ctx.services.projects.list('open');
    const rows = [];
    for (const project of projects) {
      const open = await ctx.services.tasks.listByProject(project.id, { status: 'open' });
      const blockers = await ctx.services.projects.blockers(project.id);
      rows.push({ project, openTasks: open.length, blockers: blockers.length, nextDue: open.find((t) => t.dueDate)?.dueDate ?? null });
    }
    return { summary: L(ctx.language, { nl: 'Mijn projecten', en: 'My projects', fr: 'Mes projets' }), detail: [plural(projects.length, { nl: 'project', en: 'project', fr: 'projet' }, { nl: 'projecten', en: 'projects', fr: 'projets' }, ctx.language)], payload: { kind: 'project_list', projects: rows } };
  });

  registry.registerByName('project.create', async (args, ctx) => {
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }) : null;
    const project = await ctx.services.projects.create({ name: args.name, companyId: company?.id ?? null, goal: args.goal ?? null, description: args.description ?? null });
    return { summary: `${L(ctx.language, { nl: 'Project', en: 'Project', fr: 'Projet' })} · ${project.name}`, detail: [company?.name ?? ''].filter(Boolean), payload: { kind: 'record', entity: 'project', id: project.id, title: project.name, lines: [] }, focus: { projectId: project.id, companyId: company?.id ?? undefined, label: project.name }, undo: { kind: 'delete', entity: 'project', id: project.id } };
  });

  registry.registerByName('project.status', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: true });
    if (!project) throw new DomainError('NOT_FOUND');
    const overview = await ctx.services.projects.overview(project.id, ctx.language);
    const detail = [plural(overview.openTasks.length, TASKS.one, TASKS.many, ctx.language), overview.nextMilestone ? `${L(ctx.language, { nl: 'Volgende mijlpaal', en: 'Next milestone', fr: 'Prochain jalon' })}: ${overview.nextMilestone.title}${overview.nextMilestone.targetDate ? ` (${overview.nextMilestone.targetDate})` : ''}` : '', ...overview.attention].filter(Boolean);
    return { summary: `${project.name} · ${L(ctx.language, { nl: { active: 'actief', on_hold: 'on hold', done: 'afgerond', archived: 'gearchiveerd' }[project.status], en: project.status.replace('_', ' '), fr: { active: 'actif', on_hold: 'en pause', done: 'terminé', archived: 'archivé' }[project.status] })}`, detail, payload: { kind: 'project_overview', overview }, focus: { projectId: project.id, companyId: project.companyId ?? undefined, label: project.name } };
  });

  registry.registerByName('project.everything', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: true });
    if (!project) throw new DomainError('NOT_FOUND');
    const everything = await ctx.services.projects.everything(project.id);
    const detail = [`${everything.tasks.length} ${L(ctx.language, { nl: 'taken', en: 'tasks', fr: 'tâches' })}`, `${everything.meetings.length} ${L(ctx.language, { nl: 'meetings', en: 'meetings', fr: 'réunions' })}`, `${everything.decisions.length} ${L(ctx.language, { nl: 'beslissingen', en: 'decisions', fr: 'décisions' })}`, `${everything.invoices.length} ${L(ctx.language, { nl: 'facturen', en: 'invoices', fr: 'factures' })}`, `${everything.documents.length} ${L(ctx.language, { nl: 'documenten', en: 'documents', fr: 'documents' })}`, `${everything.emails.length} ${L(ctx.language, { nl: 'mails', en: 'emails', fr: 'mails' })}`];
    return { summary: `${L(ctx.language, { nl: 'Alles rond', en: 'Everything about', fr: 'Tout sur' })} ${project.name}`, detail, payload: { kind: 'project_everything', everything }, focus: { projectId: project.id, label: project.name } };
  });

  registry.registerByName('project.nextStep', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: true });
    if (!project) throw new DomainError('NOT_FOUND');
    const next = await ctx.services.projects.nextStep(project.id);
    const allBlocked = !next.task && next.blockedTasks.length > 0;
    const summary = next.task ? `${L(ctx.language, { nl: 'Volgende stap', en: 'Next step', fr: 'Prochaine étape' })}: ${next.task.title}` : allBlocked ? L(ctx.language, { nl: `Alles staat geblokkeerd – los eerst de blocker op (${next.blockedTasks[0]?.title ?? ''})`, en: `Everything is blocked – resolve the blocker first (${next.blockedTasks[0]?.title ?? ''})`, fr: `Tout est bloqué – lève d’abord le blocage (${next.blockedTasks[0]?.title ?? ''})` }) : next.milestone ? `${L(ctx.language, { nl: 'Volgende mijlpaal', en: 'Next milestone', fr: 'Prochain jalon' })}: ${next.milestone.title}` : L(ctx.language, { nl: 'Geen open stappen.', en: 'No open steps.', fr: 'Aucune étape ouverte.' });
    return { summary, detail: [next.task?.dueDate ? `${L(ctx.language, { nl: 'tegen', en: 'by', fr: 'pour le' })} ${next.task.dueDate}` : '', next.blockedTasks.length ? `${next.blockedTasks.length} ${L(ctx.language, { nl: 'geblokkeerd', en: 'blocked', fr: 'bloquée(s)' })}` : ''].filter(Boolean), payload: { kind: 'next_step', project, task: next.task, milestone: next.milestone ? { title: next.milestone.title, targetDate: next.milestone.targetDate } : null, blockedTasks: next.blockedTasks }, focus: { projectId: project.id, taskId: next.task?.id ?? undefined } };
  });

  registry.registerByName('project.blockers', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: false });
    const blockers = await ctx.services.projects.blockers(project?.id ?? null);
    const reasons = project ? await ctx.services.projects.explainStall(project.id, ctx.language) : [];
    const summary = project ? `${project.name}: ${plural(blockers.length, { nl: 'blocker', en: 'blocker', fr: 'blocage' }, { nl: 'blockers', en: 'blockers', fr: 'blocages' }, ctx.language)}` : plural(blockers.length, { nl: 'blocker', en: 'blocker', fr: 'blocage' }, { nl: 'blockers', en: 'blockers', fr: 'blocages' }, ctx.language);
    return { summary, detail: reasons.length ? reasons.map((r) => r.text) : blockers.map((b) => `${b.description}${b.who ? ` (${b.who})` : ''}`), payload: { kind: 'blockers', project, blockers, reasons }, focus: project ? { projectId: project.id } : null };
  });

  registry.registerByName('project.decisions', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: false });
    let meeting = null;
    let decisions;
    if (args.lastMeeting) {
      meeting = await ctx.services.meetings.latest(project?.id ?? null);
      decisions = meeting ? await ctx.services.projects.decisions({ meetingId: meeting.id }) : [];
      if (decisions.length === 0 && meeting) decisions = await ctx.services.projects.decisions({ projectId: project?.id ?? meeting.projectId, since: meeting.date, limit: 10 });
    } else {
      decisions = await ctx.services.projects.decisions({ projectId: project?.id ?? null, query: args.query ?? null, limit: 10 });
    }
    const summary = decisions.length === 0 ? L(ctx.language, { nl: 'Geen beslissingen gevonden.', en: 'No decisions found.', fr: 'Aucune décision trouvée.' }) : args.query ? `${decisions[0]?.decision}` : L(ctx.language, { nl: 'Beslissingen', en: 'Decisions', fr: 'Décisions' });
    return { summary, detail: decisions.slice(0, 5).map((d) => `${d.decidedOn}: ${d.decision}${d.reason ? ` – ${d.reason}` : ''}`), payload: { kind: 'decisions', project, decisions, meeting }, focus: project ? { projectId: project.id } : null };
  });

  registry.registerByName('project.addTask', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: !args.fromFocus });
    let title = args.title ?? null;
    let emailId: string | null = null;
    let documentId: string | null = null;
    let dueDate = args.dueDate ?? null;
    let suggestionId: string | null = null;
    if (!title && (args.fromFocus || !args.title)) {
      const target = focusTarget(ctx);
      if (target?.type === 'EMAIL') {
        const email = await ctx.services.emails.require(target.id);
        emailId = email.id;
        title = email.analysis?.requests[0] ?? email.subject;
        dueDate = dueDate ?? email.analysis?.deadlines[0]?.date ?? null;
      } else if (target?.type === 'DOCUMENT') {
        const doc = await ctx.services.documents.require(target.id);
        documentId = doc.id;
        title = `${L(ctx.language, { nl: 'Opvolgen', en: 'Follow up', fr: 'Suivre' })}: ${doc.title}`;
      } else if (ctx.focus.suggestionIds[0]) {
        const s = await ctx.services.suggestions.get(ctx.focus.suggestionIds[0]);
        if (s) {
          title = s.title;
          suggestionId = s.id;
        }
      }
    }
    if (!title) throw new DomainError('INVALID_ARGUMENTS', L(ctx.language, { nl: 'Waarvan moet ik een taak maken?', en: 'What should the task be?', fr: 'Quelle tâche dois-je créer ?' }));
    const task = project ? await ctx.services.projects.addTask(project.id, { title, dueDate, assignee: args.assignee ?? null, emailId, documentId, sourceType: emailId ? 'email' : documentId ? 'document' : 'conversation', sourceId: emailId ?? documentId ?? suggestionId }) : await ctx.services.tasks.create({ title, dueDate, assignee: args.assignee ?? null, emailId, documentId, sourceType: emailId ? 'email' : documentId ? 'document' : 'conversation', sourceId: emailId ?? documentId ?? suggestionId });
    if (emailId) await ctx.services.links.link({ type: 'TASK', id: task.id }, { type: 'EMAIL', id: emailId }, 'source');
    if (suggestionId) await ctx.services.db.suggestions.update({ ...(await ctx.services.suggestions.get(suggestionId))!, status: 'approved', resultType: 'TASK', resultId: task.id, resolvedAt: ctx.clock.nowISO() });
    const lines = [project?.name ?? '', task.dueDate ?? ''].filter(Boolean);
    return { summary: `${L(ctx.language, { nl: 'Taak', en: 'Task', fr: 'Tâche' })} · ${task.title}`, detail: lines, payload: { kind: 'record', entity: 'task', id: task.id, title: task.title, lines }, focus: { taskId: task.id, projectId: project?.id ?? undefined }, undo: { kind: 'delete', entity: 'task', id: task.id }, createdItem: { type: 'TASK', id: task.id } };
  });

  registry.registerByName('project.assign', async (args, ctx) => {
    const project = await ctx.services.projects.resolve(args.project);
    const target = args.target ? ({ type: args.target.type, id: args.target.id } as EntityRef) : focusTarget(ctx);
    if (!target) throw new DomainError('INVALID_ARGUMENTS', L(ctx.language, { nl: 'Wat moet ik onder dit project zetten? Open eerst een item.', en: 'What should I file under this project? Open an item first.', fr: 'Que dois-je classer sous ce projet ? Ouvre d’abord un élément.' }));
    let title = '';
    let undo: Parameters<typeof registry.undo>[0] | null = null;
    switch (target.type) {
      case 'TASK': {
        const task = await ctx.services.tasks.getById(target.id);
        if (!task) throw new DomainError('NOT_FOUND');
        await ctx.services.projects.assignTask(task.id, project.id);
        title = task.title;
        undo = { kind: 'task_unassign', id: task.id, previousProjectId: task.projectId, previousMilestoneId: task.milestoneId };
        break;
      }
      case 'EMAIL': {
        const email = await ctx.services.emails.assignProject(target.id, project.id);
        title = email.subject;
        break;
      }
      case 'DOCUMENT': {
        const doc = await ctx.services.documents.update(target.id, { projectId: project.id });
        title = doc.title;
        break;
      }
      case 'EXPENSE': {
        const before = await ctx.services.expenses.require(target.id);
        const expense = await ctx.services.expenses.assignToProject(target.id, project.id);
        title = expense.merchant;
        undo = { kind: 'expense_unassign', id: expense.id, previousProjectId: before.projectId };
        break;
      }
      case 'INVOICE': {
        const invoice = await ctx.services.invoices.require(target.id);
        await ctx.services.db.invoices.update({ ...invoice, projectId: project.id, updatedAt: ctx.clock.nowISO() });
        title = `${invoice.counterpartyName} ${invoice.invoiceNumber ?? ''}`.trim();
        break;
      }
      case 'MEETING': {
        const meeting = await ctx.services.meetings.update(target.id, { projectId: project.id });
        title = meeting.title;
        break;
      }
      case 'FOLLOW_UP': {
        const f = await ctx.services.followUps.update(target.id, { projectId: project.id });
        title = f.title;
        break;
      }
      default:
        throw new DomainError('INVALID_ARGUMENTS');
    }
    await ctx.services.links.link({ type: 'PROJECT', id: project.id }, target, 'contains');
    return { summary: `${title} → ${project.name}`, detail: [], payload: { kind: 'record', entity: 'project', id: project.id, title: project.name, lines: [title] }, focus: { projectId: project.id }, undo };
  });

  registry.registerByName('project.addRisk', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: true });
    if (!project) throw new DomainError('NOT_FOUND');
    const risk = await ctx.services.projects.addRisk(project.id, { description: args.description, impact: args.impact, likelihood: args.likelihood });
    return { summary: `${L(ctx.language, { nl: 'Risico', en: 'Risk', fr: 'Risque' })} · ${risk.description}`, detail: [project.name, `${L(ctx.language, { nl: 'impact', en: 'impact', fr: 'impact' })}: ${risk.impact}`], payload: { kind: 'record', entity: 'risk', id: risk.id, title: risk.description, lines: [project.name] }, focus: { projectId: project.id }, undo: { kind: 'delete', entity: 'risk', id: risk.id } };
  });

  registry.registerByName('project.addDecision', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: false });
    const decision = await ctx.services.projects.addDecision({ projectId: project?.id ?? null, decision: args.decision, reason: args.reason ?? null, participants: args.participants ?? [], meetingId: ctx.focus.meetingId });
    return { summary: `${L(ctx.language, { nl: 'Beslissing', en: 'Decision', fr: 'Décision' })} · ${decision.decision}`, detail: [decision.reason ?? '', project?.name ?? ''].filter(Boolean), payload: { kind: 'record', entity: 'decision', id: decision.id, title: decision.decision, lines: [decision.reason ?? ''].filter(Boolean) }, focus: project ? { projectId: project.id } : null, undo: { kind: 'delete', entity: 'decision', id: decision.id } };
  });

  registry.registerByName('project.addBlocker', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: false });
    const blocker = await ctx.services.projects.addBlocker({ projectId: project?.id ?? null, taskId: args.taskId ?? ctx.focus.taskId ?? null, kind: (args.kind as never) ?? 'other', description: args.description, who: args.who ?? null });
    return { summary: `${L(ctx.language, { nl: 'Blocker', en: 'Blocker', fr: 'Blocage' })} · ${blocker.description}`, detail: [blocker.who ?? '', project?.name ?? ''].filter(Boolean), payload: { kind: 'record', entity: 'blocker', id: blocker.id, title: blocker.description, lines: [] }, focus: project ? { projectId: project.id } : null, undo: { kind: 'delete', entity: 'blocker', id: blocker.id } };
  });

  registry.registerByName('project.resolveBlocker', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: false });
    let id = args.blockerId ?? null;
    if (!id) {
      const open = await ctx.services.projects.blockers(project?.id ?? null);
      const needle = (args.query ?? '').toLowerCase();
      id = (needle ? open.find((b) => b.description.toLowerCase().includes(needle) || (b.who ?? '').toLowerCase().includes(needle)) : open[0])?.id ?? null;
    }
    if (!id) throw new DomainError('NOT_FOUND', L(ctx.language, { nl: 'Geen open blocker gevonden.', en: 'No open blocker found.', fr: 'Aucun blocage ouvert trouvé.' }));
    const blocker = await ctx.services.projects.resolveBlocker(id);
    return { summary: `${L(ctx.language, { nl: 'Blocker opgelost', en: 'Blocker resolved', fr: 'Blocage résolu' })} · ${blocker.description}`, detail: [], payload: { kind: 'record', entity: 'blocker', id: blocker.id, title: blocker.description, lines: [] }, undo: { kind: 'blocker_reopen', id: blocker.id } };
  });

  registry.registerByName('project.addMilestone', async (args, ctx) => {
    const project = await resolveProject(ctx, args, { required: true });
    if (!project) throw new DomainError('NOT_FOUND');
    const milestone = await ctx.services.projects.addMilestone(project.id, { title: args.title, targetDate: args.targetDate ?? null, owner: args.owner ?? null });
    return { summary: `${L(ctx.language, { nl: 'Mijlpaal', en: 'Milestone', fr: 'Jalon' })} · ${milestone.title}`, detail: [project.name, milestone.targetDate ?? ''].filter(Boolean), payload: { kind: 'record', entity: 'milestone', id: milestone.id, title: milestone.title, lines: [milestone.targetDate ?? ''].filter(Boolean) }, focus: { projectId: project.id }, undo: { kind: 'delete', entity: 'milestone', id: milestone.id } };
  });

  // ---- Meetings & suggestions ---------------------------------------------------

  registry.registerByName('meeting.prepare', async (args, ctx) => {
    const project = args.project || args.projectId ? await resolveProject(ctx, args, { allowFocus: false }) : null;
    const briefing = await ctx.services.meetings.prepare({ person: args.person ?? null, projectId: project?.id ?? null }, ctx.language);
    return { summary: `${L(ctx.language, { nl: 'Briefing', en: 'Briefing', fr: 'Briefing' })}${args.person ? ` · ${args.person}` : briefing.project ? ` · ${briefing.project.name}` : ''}`, detail: briefing.lines, payload: { kind: 'briefing', briefing }, focus: { projectId: briefing.project?.id ?? undefined, contactId: (await resolveContact(ctx, args.person ?? null).catch(() => null))?.id ?? undefined } };
  });

  registry.registerByName('meeting.extractActions', async (args, ctx) => {
    const project = args.project || args.projectId ? await resolveProject(ctx, args, { allowFocus: false }) : await resolveProject(ctx, {}, { allowFocus: true });
    const meetingId = args.meetingId ?? (!args.notes ? ctx.focus.meetingId : null);
    if (!args.notes && !meetingId) throw new DomainError('INVALID_ARGUMENTS', L(ctx.language, { nl: 'Plak of dicteer de meetingnotities die ik moet verwerken.', en: 'Paste or dictate the meeting notes to process.', fr: 'Colle ou dicte les notes de réunion à traiter.' }), { details: { missing: 'notes' } });
    const result = await ctx.services.meetings.extract({ meetingId, notes: args.notes ?? null, projectId: project?.id ?? null, title: args.title ?? null }, ctx.language);
    const c = result.counts;
    const detail = [c.decision ? `${c.decision} ${L(ctx.language, { nl: 'beslissingen', en: 'decisions', fr: 'décisions' })}` : '', c.task ? `${c.task} ${L(ctx.language, { nl: 'taken', en: 'tasks', fr: 'tâches' })}` : '', c.follow_up ? `${c.follow_up} ${L(ctx.language, { nl: 'opvolgingen', en: 'follow-ups', fr: 'suivis' })}` : '', c.risk ? `${c.risk} ${L(ctx.language, { nl: 'risico’s', en: 'risks', fr: 'risques' })}` : '', c.question ? `${c.question} ${L(ctx.language, { nl: 'open vragen', en: 'open questions', fr: 'questions ouvertes' })}` : '', L(ctx.language, { nl: 'Zeg "keur alles goed" of kies per item.', en: 'Say "approve all" or pick per item.', fr: 'Dis « approuve tout » ou choisis par élément.' })].filter(Boolean);
    return { summary: L(ctx.language, { nl: 'Voorstellen uit de meeting', en: 'Proposals from the meeting', fr: 'Propositions de la réunion' }), detail, payload: { kind: 'proposals', meeting: result.meeting, suggestions: result.suggestions, counts: result.counts, method: result.method, summary: result.summary }, focus: { meetingId: result.meeting?.id ?? null, projectId: project?.id ?? undefined, suggestionIds: result.suggestions.map((s) => s.id) }, undo: result.meeting && !args.meetingId ? { kind: 'delete', entity: 'meeting', id: result.meeting.id } : null };
  });

  registry.registerByName('meeting.debrief', async (args, ctx) => {
    const result = await ctx.services.meetings.debrief(args.text, ctx.language, args.project ?? null);
    const c = result.counts;
    const detail = [c.task ? `${c.task} ${L(ctx.language, { nl: 'taak/taken voor mij', en: 'task(s) for me', fr: 'tâche(s) pour moi' })}` : '', c.follow_up ? `${c.follow_up} ${L(ctx.language, { nl: 'wachtitem(s)', en: 'waiting item(s)', fr: 'attente(s)' })}` : '', c.decision ? `${c.decision} ${L(ctx.language, { nl: 'beslissing(en)', en: 'decision(s)', fr: 'décision(s)' })}` : '', result.meeting?.projectId ? `${L(ctx.language, { nl: 'project', en: 'project', fr: 'projet' })}: ${(await ctx.services.projects.get(result.meeting.projectId))?.name ?? ''}` : '', L(ctx.language, { nl: 'Bevestig de voorstellen om ze aan te maken.', en: 'Confirm the proposals to create them.', fr: 'Confirme les propositions pour les créer.' })].filter(Boolean);
    return { summary: `${L(ctx.language, { nl: 'Meeting verwerkt', en: 'Meeting processed', fr: 'Réunion traitée' })} · ${result.meeting?.title ?? ''}`, detail, payload: { kind: 'proposals', meeting: result.meeting, suggestions: result.suggestions, counts: result.counts, method: result.method, summary: result.summary }, focus: { meetingId: result.meeting?.id ?? null, projectId: result.meeting?.projectId ?? undefined, suggestionIds: result.suggestions.map((s) => s.id) }, undo: result.meeting ? { kind: 'delete', entity: 'meeting', id: result.meeting.id } : null };
  });

  registry.registerByName('meeting.actions', async (args, ctx) => {
    const { meeting, suggestions } = await ctx.services.meetings.actionItems(args.meetingId ?? ctx.focus.meetingId ?? null);
    const actions = suggestions.filter((s) => s.kind === 'task' || s.kind === 'follow_up');
    const counts: Record<SuggestionKind, number> = { task: 0, decision: 0, follow_up: 0, risk: 0, question: 0, document_request: 0, reminder: 0, expense: 0, invoice: 0, meeting: 0 };
    for (const s of suggestions) counts[s.kind] += 1;
    return { summary: meeting ? `${L(ctx.language, { nl: 'Actiepunten', en: 'Action items', fr: 'Actions' })} · ${meeting.title}` : L(ctx.language, { nl: 'Geen meeting gevonden.', en: 'No meeting found.', fr: 'Aucune réunion trouvée.' }), detail: actions.map((s) => `${s.status === 'approved' ? '✓' : '○'} ${s.title}`), payload: { kind: 'proposals', meeting, suggestions, counts, method: 'deterministic', summary: meeting?.summary ?? null }, focus: meeting ? { meetingId: meeting.id, projectId: meeting.projectId ?? undefined, suggestionIds: suggestions.filter((s) => s.status === 'proposed').map((s) => s.id) } : null };
  });

  registry.registerByName('meeting.record', async (args, ctx) => {
    const project = args.project || args.projectId ? await resolveProject(ctx, args, { allowFocus: false }) : null;
    const meeting = await ctx.services.meetings.record({ title: args.title, date: args.date ?? null, time: args.time ?? null, participants: args.participants ?? [], notes: args.notes ?? null, projectId: project?.id ?? null });
    return { summary: `${L(ctx.language, { nl: 'Meeting', en: 'Meeting', fr: 'Réunion' })} · ${meeting.title}`, detail: [meeting.date, meeting.participants.join(', ')].filter(Boolean), payload: { kind: 'record', entity: 'meeting', id: meeting.id, title: meeting.title, lines: [meeting.date] }, focus: { meetingId: meeting.id, projectId: project?.id ?? undefined }, undo: { kind: 'delete', entity: 'meeting', id: meeting.id } };
  });

  registry.registerByName('suggestions.list', async (args, ctx) => {
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const suggestions = await ctx.services.suggestions.list({ status: 'proposed', projectId: project?.id ?? null });
    const counts: Record<SuggestionKind, number> = { task: 0, decision: 0, follow_up: 0, risk: 0, question: 0, document_request: 0, reminder: 0, expense: 0, invoice: 0, meeting: 0 };
    for (const s of suggestions) counts[s.kind] += 1;
    return { summary: plural(suggestions.length, { nl: 'openstaand voorstel', en: 'pending proposal', fr: 'proposition en attente' }, { nl: 'openstaande voorstellen', en: 'pending proposals', fr: 'propositions en attente' }, ctx.language), detail: suggestions.slice(0, 6).map((s) => `${s.kind}: ${s.title}`), payload: { kind: 'proposals', meeting: null, suggestions, counts, method: 'deterministic', summary: null }, focus: { suggestionIds: suggestions.map((s) => s.id) } };
  });

  registry.registerByName('suggestions.approve', async (args, ctx) => {
    let ids = args.ids ?? [];
    if (ids.length === 0) {
      const pool = ctx.focus.suggestionIds.length ? await ctx.services.db.suggestions.getByIds(ctx.focus.suggestionIds) : await ctx.services.suggestions.list({ status: 'proposed' });
      ids = pool.filter((s) => s.status === 'proposed' && (!args.kinds?.length || args.kinds.includes(s.kind))).map((s) => s.id);
    }
    requireFocus(ids, NO_SUGGESTIONS, ctx.language);
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }) : null;
    const outcomes = await ctx.services.suggestions.approve(ids, { projectId: project?.id ?? ctx.focus.projectId ?? null });
    const created = outcomes.filter((o) => o.created).map((o) => o.created!);
    const skipped = outcomes.filter((o) => o.skipped).map((o) => ({ title: o.suggestion.title, reason: o.skipped! }));
    return { summary: `${created.length} ${L(ctx.language, { nl: 'aangemaakt', en: 'created', fr: 'créé(s)' })}`, detail: [...created.map((c) => `${c.type.toLowerCase()}: ${c.title}`), ...skipped.map((s) => `⚠ ${s.title}: ${s.reason}`)], payload: { kind: 'approvals', created, skipped, rejected: 0 }, focus: { suggestionIds: [] }, undo: { kind: 'suggestions_reset', ids: outcomes.filter((o) => o.created).map((o) => o.suggestion.id) } };
  });

  registry.registerByName('suggestions.reject', async (args, ctx) => {
    let ids = args.ids ?? [];
    if (ids.length === 0) ids = ctx.focus.suggestionIds.length ? ctx.focus.suggestionIds : (await ctx.services.suggestions.list({ status: 'proposed' })).map((s) => s.id);
    requireFocus(ids, NO_SUGGESTIONS, ctx.language);
    const rejected = await ctx.services.suggestions.reject(ids);
    return { summary: `${rejected} ${L(ctx.language, { nl: 'verworpen', en: 'rejected', fr: 'rejeté(s)' })}`, detail: [], payload: { kind: 'approvals', created: [], skipped: [], rejected }, focus: { suggestionIds: [] }, undo: { kind: 'suggestions_reset', ids } };
  });

  // ---- Documents ----------------------------------------------------------------

  registry.registerByName('document.search', async (args, ctx) => {
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }).catch(() => null) : null;
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }).catch(() => null) : null;
    let documents = await ctx.services.documents.search(args.query ?? null, { type: (args.type as DocumentType | null) ?? null, companyId: company?.id ?? null, projectId: project?.id ?? null });
    if (documents.length === 0 && args.client && !company) documents = await ctx.services.documents.search(args.client, { type: (args.type as DocumentType | null) ?? null });
    return { summary: documents.length ? `${documents.length} ${L(ctx.language, { nl: 'document(en) gevonden', en: 'document(s) found', fr: 'document(s) trouvé(s)' })}` : L(ctx.language, { nl: 'Geen document gevonden.', en: 'No document found.', fr: 'Aucun document trouvé.' }), detail: documents.slice(0, 5).map((d) => `${d.title}${d.expiryDate ? ` (${L(ctx.language, { nl: 'vervalt', en: 'expires', fr: 'expire' })} ${d.expiryDate})` : ''}`), payload: { kind: 'documents', documents, expiring: false }, focus: documents[0] ? { documentId: documents[0].id, companyId: company?.id ?? undefined } : null };
  });

  registry.registerByName('document.expiring', async (args, ctx) => {
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }).catch(() => null) : null;
    let documents = await ctx.services.documents.expiring(args.withinDays ?? 365, (args.type as DocumentType | null) ?? null);
    if (company) documents = documents.filter((d) => d.companyId === company.id);
    const first = documents[0];
    const summary = first?.expiryDate ? `${first.title} ${L(ctx.language, { nl: 'vervalt op', en: 'expires on', fr: 'expire le' })} ${first.expiryDate}` : L(ctx.language, { nl: 'Geen vervaldatum gevonden.', en: 'No expiry date found.', fr: 'Aucune date d’expiration trouvée.' });
    return { summary, detail: documents.slice(0, 5).map((d) => `${d.title}: ${d.expiryDate ?? '?'}`), payload: { kind: 'documents', documents, expiring: true }, focus: first ? { documentId: first.id } : null, note: first ? L(ctx.language, { nl: 'Wil je een herinnering? Zeg bv. "herinner mij 30 dagen voor dit document vervalt".', en: 'Want a reminder? Say e.g. "remind me 30 days before this document expires".', fr: 'Un rappel ? Dis « rappelle-moi 30 jours avant l’expiration de ce document ».' }) : null };
  });

  registry.registerByName('document.create', async (args, ctx) => {
    const company = args.client ? await resolveCompany(ctx, args.client, { allowFocus: false }).catch(() => null) : null;
    const project = args.project ? await resolveProject(ctx, { project: args.project }, { allowFocus: false }).catch(() => null) : null;
    const doc = await ctx.services.documents.create({ title: args.title, type: (args.type as DocumentType | undefined) ?? undefined, extractedText: args.text ?? null, date: args.date ?? null, expiryDate: args.expiryDate ?? null, companyId: company?.id ?? null, projectId: project?.id ?? null, sender: args.sender ?? null, attachmentUri: args.attachmentUri ?? null, mimeType: args.mimeType ?? null, source: args.source ?? 'manual' });
    const lines = [doc.type, doc.expiryDate ? `${L(ctx.language, { nl: 'vervalt', en: 'expires', fr: 'expire' })} ${doc.expiryDate}` : ''].filter(Boolean);
    return { summary: `${L(ctx.language, { nl: 'Document', en: 'Document', fr: 'Document' })} · ${doc.title}`, detail: lines, payload: { kind: 'record', entity: 'document', id: doc.id, title: doc.title, lines }, focus: { documentId: doc.id, companyId: company?.id ?? undefined, projectId: project?.id ?? undefined }, undo: { kind: 'delete', entity: 'document', id: doc.id }, note: doc.expiryDate ? L(ctx.language, { nl: `Dit document vervalt op ${doc.expiryDate}. Een herinnering maken?`, en: `This document expires on ${doc.expiryDate}. Create a reminder?`, fr: `Ce document expire le ${doc.expiryDate}. Créer un rappel ?` }) : null };
  });

  registry.registerByName('document.remind', async (args, ctx) => {
    const id = requireFocus(args.documentId ?? ctx.focus.documentId, NO_DOCUMENT_FOCUS, ctx.language);
    const result = await ctx.services.documents.remindBeforeExpiry(id, args.daysBefore, ctx.language);
    return { summary: `${L(ctx.language, { nl: 'Herinnering', en: 'Reminder', fr: 'Rappel' })} · ${result.document.title}`, detail: [result.dueISO.slice(0, 16).replace('T', ' ')], payload: { kind: 'record', entity: 'reminder', id: result.reminderId, title: result.document.title, lines: [result.dueISO] }, focus: { documentId: id }, undo: { kind: 'delete', entity: 'reminder', id: result.reminderId }, createdItem: { type: 'REMINDER', id: result.reminderId } };
  });

  // ---- Companies, contacts, styles, profile -------------------------------------

  registry.registerByName('company.list', async (args, ctx) => {
    const companies = await ctx.services.companies.listCompanies(args.kind ?? null);
    return { summary: args.kind === 'supplier' ? L(ctx.language, { nl: 'Leveranciers', en: 'Suppliers', fr: 'Fournisseurs' }) : L(ctx.language, { nl: 'Klanten', en: 'Clients', fr: 'Clients' }), detail: [`${companies.length}`], payload: { kind: 'company_list', companies } };
  });

  registry.registerByName('company.create', async (args, ctx) => {
    const company = await ctx.services.companies.createCompany({ name: args.name, kind: args.kind ?? 'client', email: args.email ?? null, vatNumber: args.vatNumber ?? null, iban: args.iban ?? null, paymentTermsDays: args.paymentTermsDays ?? null });
    return { summary: `${L(ctx.language, { nl: company.kind === 'supplier' ? 'Leverancier' : 'Klant', en: company.kind === 'supplier' ? 'Supplier' : 'Client', fr: company.kind === 'supplier' ? 'Fournisseur' : 'Client' })} · ${company.name}`, detail: [company.vatNumber ?? ''].filter(Boolean), payload: { kind: 'record', entity: 'company', id: company.id, title: company.name, lines: [] }, focus: { companyId: company.id, label: company.name }, undo: { kind: 'delete', entity: 'company', id: company.id } };
  });

  registry.registerByName('company.open', async (args, ctx) => {
    const company = await ctx.services.companies.resolveCompany(args.client);
    const contacts = await ctx.services.companies.listContacts(company.id);
    const openInvoices = await ctx.services.invoices.list('open', { companyId: company.id });
    const projects = (await ctx.services.projects.list('open')).filter((p) => p.companyId === company.id);
    const followUps = (await ctx.services.followUps.list({ status: 'open' })).filter((f) => f.companyId === company.id || projects.some((p) => p.id === f.projectId));
    const openTasks: Awaited<ReturnType<typeof ctx.services.tasks.listByProject>> = [];
    for (const p of projects) openTasks.push(...(await ctx.services.tasks.listByProject(p.id, { status: 'open' })));
    const summary = await ctx.services.timesheets.summary({ companyId: company.id, status: 'all' });
    const detail = [`${openInvoices.length} ${L(ctx.language, { nl: 'open facturen', en: 'open invoices', fr: 'factures ouvertes' })}`, `${openTasks.length} ${L(ctx.language, { nl: 'open taken', en: 'open tasks', fr: 'tâches ouvertes' })}`, `${followUps.length} ${L(ctx.language, { nl: 'wachtitems', en: 'waiting items', fr: 'attentes' })}`, summary.uninvoicedMinutes ? `${Math.round((summary.uninvoicedMinutes / 60) * 100) / 100} ${L(ctx.language, { nl: 'uur niet gefactureerd', en: 'hours not invoiced', fr: 'heures non facturées' })}` : ''].filter(Boolean);
    return { summary: `${L(ctx.language, { nl: 'Open bij', en: 'Open with', fr: 'Ouvert chez' })} ${company.name}`, detail, payload: { kind: 'company_overview', company, contacts, openInvoices, projects, followUps, openTasks, uninvoicedMinutes: summary.uninvoicedMinutes }, focus: { companyId: company.id, label: company.name, invoiceId: openInvoices[0]?.id ?? undefined } };
  });

  registry.registerByName('contact.create', async (args, ctx) => {
    const company = args.company ? await resolveCompany(ctx, args.company, { allowFocus: false }).catch(() => null) : null;
    const contact = await ctx.services.companies.createContact({ name: args.name, companyId: company?.id ?? null, email: args.email ?? null, phone: args.phone ?? null, audience: (args.audience as Audience | null) ?? null, role: args.role ?? null });
    return { summary: `${L(ctx.language, { nl: 'Contact', en: 'Contact', fr: 'Contact' })} · ${contact.name}`, detail: [company?.name ?? '', contact.email ?? ''].filter(Boolean), payload: { kind: 'record', entity: 'contact', id: contact.id, title: contact.name, lines: [] }, focus: { contactId: contact.id, companyId: company?.id ?? undefined }, undo: { kind: 'delete', entity: 'contact', id: contact.id } };
  });

  registry.registerByName('style.set', async (args, ctx) => {
    const contact = args.contact ? await resolveContact(ctx, args.contact) : null;
    await ctx.services.companies.setStyle({ audience: (args.audience as Audience | null) ?? null, contactId: contact?.id ?? null, default: !args.audience && !contact }, args.style as CommunicationStyle);
    if (args.rule) await ctx.services.companies.addStyleRule(args.rule);
    const target = contact?.name ?? args.audience ?? L(ctx.language, { nl: 'standaard', en: 'default', fr: 'par défaut' });
    return { summary: `${L(ctx.language, { nl: 'Stijl onthouden', en: 'Style remembered', fr: 'Style mémorisé' })} · ${target}: ${args.style}`, detail: [], payload: { kind: 'record', entity: 'style', id: target, title: args.style, lines: [] } };
  });

  registry.registerByName('profile.get', async (_args, ctx) => {
    const profile = await ctx.services.companies.profile();
    const check = checkProfileForInvoicing(profile);
    return { summary: profile.companyName || L(ctx.language, { nl: 'Bedrijfsprofiel (leeg)', en: 'Business profile (empty)', fr: 'Profil (vide)' }), detail: [check.complete ? L(ctx.language, { nl: 'Klaar om te factureren.', en: 'Ready to invoice.', fr: 'Prêt à facturer.' }) : `${L(ctx.language, { nl: 'Ontbreekt', en: 'Missing', fr: 'Manque' })}: ${check.missing.join(', ')}`], payload: { kind: 'profile', profile, complete: check.complete, missing: check.missing as string[] } };
  });

  registry.registerByName('profile.update', async (args, ctx) => {
    const { street, postalCode, city, country, ...rest } = args;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    const address = { ...(street !== undefined ? { street } : {}), ...(postalCode !== undefined ? { postalCode } : {}), ...(city !== undefined ? { city } : {}), ...(country !== undefined ? { country } : {}) };
    const profile = await ctx.services.companies.updateProfile({ ...(patch as Parameters<typeof ctx.services.companies.updateProfile>[0]), ...(Object.keys(address).length ? { address } : {}) });
    const check = checkProfileForInvoicing(profile);
    return { summary: L(ctx.language, { nl: 'Bedrijfsprofiel bijgewerkt', en: 'Business profile updated', fr: 'Profil mis à jour' }), detail: Object.keys(patch).concat(Object.keys(address)), payload: { kind: 'profile', profile, complete: check.complete, missing: check.missing as string[] } };
  });

  // ---- Workflows -------------------------------------------------------------------

  registry.registerByName('workflow.create', async (args, ctx) => {
    const workflow = await ctx.services.workflows.create({ name: args.name, description: args.description ?? null, trigger: args.trigger, conditions: args.conditions ?? [], steps: args.steps as unknown as WorkflowStep[], sourceText: args.sourceText ?? null });
    return { summary: `${L(ctx.language, { nl: 'Automatisering', en: 'Automation', fr: 'Automatisation' })} · ${workflow.name}`, detail: [workflow.sourceText ?? workflow.trigger.type], payload: { kind: 'workflow', workflow }, undo: { kind: 'delete', entity: 'workflow', id: workflow.id } };
  });

  registry.registerByName('workflow.list', async (_args, ctx) => {
    const workflows = await ctx.services.workflows.list();
    return { summary: L(ctx.language, { nl: 'Automatiseringen', en: 'Automations', fr: 'Automatisations' }), detail: workflows.map((w) => `${w.enabled ? '●' : '○'} ${w.name}`), payload: { kind: 'workflows', workflows } };
  });
}
