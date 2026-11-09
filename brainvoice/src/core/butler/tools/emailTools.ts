import { L, NO_DRAFT_FOCUS, NO_EMAIL_FOCUS, plural, requireFocus, resolveContact, type Tri } from './shared';
import type { ToolContext, ToolRegistry } from '../ToolRegistry';
import type { Audience, CommunicationStyle, EmailMessage } from '../../domain/admin';
import { DomainError } from '../../types/common';

const MAILS: { one: Tri; many: Tri } = { one: { nl: 'mail', en: 'email', fr: 'mail' }, many: { nl: 'mails', en: 'emails', fr: 'mails' } };

async function findEmail(ctx: ToolContext, args: { emailId?: string | null; from?: string | null; audience?: string | null; topic?: string | null }): Promise<EmailMessage> {
  const { services, focus, language } = ctx;
  if (args.emailId) return services.emails.require(args.emailId);
  if (args.from || args.audience || args.topic) {
    const found = await services.emails.findLatest({ from: args.from ?? null, topic: args.topic ?? null, audience: (args.audience as Audience | null) ?? null });
    if (found) return found;
    throw new DomainError('NOT_FOUND', L(language, { nl: `Geen mail gevonden van ${args.from ?? args.audience ?? args.topic}.`, en: `No email found from ${args.from ?? args.audience ?? args.topic}.`, fr: `Aucun mail trouvé de ${args.from ?? args.audience ?? args.topic}.` }));
  }
  const id = requireFocus(focus.emailId, NO_EMAIL_FOCUS, language);
  return services.emails.require(id);
}

/** Email tools (§95–§96, §135). Content from emails never becomes an instruction here: handlers only read analyses and the user's own args. */
export function registerEmailTools(registry: ToolRegistry): void {
  registry.registerByName('email.needsReply', async (_args, ctx) => {
    const emails = await ctx.services.emails.needsReply();
    const focus = emails[0] ? { emailId: emails[0].id, contactId: emails[0].contactId, label: emails[0].subject } : null;
    return { summary: L(ctx.language, { nl: 'Mails die een antwoord vragen', en: 'Emails that need a reply', fr: 'Mails à répondre' }), detail: [plural(emails.length, MAILS.one, MAILS.many, ctx.language)], payload: { kind: 'email_list', emails, view: 'needs_reply' }, focus };
  });

  registry.registerByName('email.search', async (args, ctx) => {
    const emails = await ctx.services.emails.search({ query: args.query ?? null, from: args.from ?? null, kind: args.kind ?? null, view: args.kind ? 'kind' : 'all' });
    return { summary: L(ctx.language, { nl: 'Zoekresultaten', en: 'Search results', fr: 'Résultats' }), detail: [plural(emails.length, MAILS.one, MAILS.many, ctx.language)], payload: { kind: 'email_list', emails, view: 'search' } };
  });

  registry.registerByName('email.open', async (args, ctx) => {
    const email = await findEmail(ctx, args);
    await ctx.services.emails.markRead(email.id);
    const briefing = await ctx.services.emails.briefing(email.id);
    const who = email.from.name ?? email.from.email;
    return {
      summary: `${L(ctx.language, { nl: 'Mail van', en: 'Email from', fr: 'Mail de' })} ${who}`,
      detail: [email.subject, briefing.summary],
      payload: { kind: 'email_detail', email: briefing.email, thread: briefing.thread, summary: briefing.summary, requested: briefing.requested, contact: briefing.contact },
      focus: { emailId: email.id, contactId: email.contactId, companyId: email.companyId, projectId: email.projectId ?? undefined, draftId: null, label: `${who}: ${email.subject}` },
      note: email.analysis?.suspicious ? L(ctx.language, { nl: 'Deze mail bevat instructie-achtige tekst; ik voer nooit instructies uit een mail uit.', en: 'This email contains instruction-like text; I never act on instructions inside emails.', fr: 'Ce mail contient du texte ressemblant à des instructions ; je n’exécute jamais d’instructions venant d’un mail.' }) : null,
    };
  });

  registry.registerByName('email.briefing', async (args, ctx) => {
    const email = await findEmail(ctx, { emailId: args.emailId ?? null });
    const briefing = await ctx.services.emails.briefing(email.id);
    const requested = briefing.requested.length ? briefing.requested : [L(ctx.language, { nl: 'Geen expliciete vraag gevonden.', en: 'No explicit request found.', fr: 'Aucune demande explicite trouvée.' })];
    return { summary: L(ctx.language, { nl: 'Wat hij van je wil', en: 'What they want from you', fr: 'Ce qu’il attend de toi' }), detail: requested, payload: { kind: 'email_detail', email: briefing.email, thread: briefing.thread, summary: briefing.summary, requested: briefing.requested, contact: briefing.contact }, focus: { emailId: email.id, contactId: email.contactId } };
  });

  registry.registerByName('email.draftReply', async (args, ctx) => {
    const email = await findEmail(ctx, args);
    const draft = await ctx.services.emails.draftReply(email.id, args.instruction, { style: (args.style as CommunicationStyle | null) ?? null, audience: (args.audience as Audience | null) ?? null, guideline: args.guideline === true });
    return {
      summary: `${L(ctx.language, { nl: 'Concept antwoord aan', en: 'Draft reply to', fr: 'Brouillon de réponse à' })} ${email.from.name ?? email.from.email}`,
      detail: [draft.subject, L(ctx.language, { nl: 'Zeg "stuur" om te verzenden na controle.', en: 'Say "send" to send it after checking.', fr: 'Dis « envoie » pour l’envoyer après vérification.' })],
      payload: { kind: 'email_draft', draft, email },
      focus: { emailId: email.id, draftId: draft.id, contactId: email.contactId, label: `${email.from.name ?? email.from.email}: ${email.subject}` },
      undo: draft.version === 1 ? { kind: 'draft_discard', id: draft.id } : null,
      createdItem: null,
    };
  });

  registry.registerByName('email.refineDraft', async (args, ctx) => {
    const draftId = args.draftId ?? ctx.focus.draftId ?? (ctx.focus.emailId ? (await ctx.services.db.emailDrafts.latestForEmail(ctx.focus.emailId))?.id ?? null : null);
    const id = requireFocus(draftId, NO_DRAFT_FOCUS, ctx.language);
    const before = await ctx.services.emails.requireDraft(id);
    const draft = await ctx.services.emails.refineDraft(id, args.instruction);
    const email = draft.replyToEmailId ? await ctx.services.emails.get(draft.replyToEmailId) : null;
    return { summary: L(ctx.language, { nl: 'Concept aangepast', en: 'Draft updated', fr: 'Brouillon mis à jour' }), detail: [`v${draft.version}`, args.instruction], payload: { kind: 'email_draft', draft, email }, focus: { draftId: draft.id, emailId: email?.id ?? ctx.focus.emailId }, undo: { kind: 'draft_restore', id: draft.id, subject: before.subject, body: before.body } };
  });

  registry.registerByName('email.compose', async (args, ctx) => {
    const contact = await resolveContact(ctx, args.to);
    const address = contact?.email ? null : /\S+@\S+/.test(args.to) ? { name: null, email: args.to } : null;
    if (!contact && !address) throw new DomainError('NOT_FOUND', L(ctx.language, { nl: `Ik ken geen e-mailadres van ${args.to}.`, en: `I do not know an email address for ${args.to}.`, fr: `Je ne connais pas l’adresse de ${args.to}.` }));
    const draft = await ctx.services.emails.compose({ contact, address }, args.instruction, args.subject ?? null, { style: (args.style as CommunicationStyle | null) ?? null });
    return { summary: `${L(ctx.language, { nl: 'Nieuwe mail aan', en: 'New email to', fr: 'Nouveau mail à' })} ${contact?.name ?? args.to}`, detail: [draft.subject], payload: { kind: 'email_draft', draft, email: null }, focus: { draftId: draft.id, emailId: null, contactId: contact?.id ?? null, label: `${contact?.name ?? args.to}: ${draft.subject}` }, undo: { kind: 'draft_discard', id: draft.id } };
  });

  registry.registerByName('email.send', async (args, ctx) => {
    const id = requireFocus(args.draftId ?? ctx.focus.draftId, NO_DRAFT_FOCUS, ctx.language);
    const draft = await ctx.services.emails.requireDraft(id);
    if (draft.status !== 'draft') throw new DomainError('VALIDATION_FAILED', L(ctx.language, { nl: 'Dit concept is al verzonden.', en: 'This draft was already sent.', fr: 'Ce brouillon a déjà été envoyé.' }));
    const email = draft.replyToEmailId ? await ctx.services.emails.get(draft.replyToEmailId) : null;
    let method: 'adapter' | 'composer';
    // Connected mailbox (Gmail…) first, then a legacy sending adapter, then the system composer.
    const provider = ctx.ops?.providers.email();
    const providerReady = provider ? provider.capabilities().canSend && (await provider.status().catch(() => ({ state: 'error' as const }))).state === 'ready' : false;
    if (provider && providerReady) {
      await provider.send(draft, { inReplyToExternalId: email?.externalId ?? null });
      method = 'adapter';
    } else if (ctx.adapters.email.capabilities().canSend && ctx.adapters.email.send) {
      await ctx.adapters.email.send(draft, { inReplyToExternalId: email?.externalId ?? null });
      method = 'adapter';
    } else {
      const opened = await ctx.adapters.mailComposer.compose(draft);
      if (opened !== 'opened') throw new DomainError('EMAIL_UNAVAILABLE');
      method = 'composer';
    }
    const sent = await ctx.services.emails.markSent(draft.id);
    const to = draft.to.map((a) => a.name ?? a.email).join(', ');
    return {
      summary: `${L(ctx.language, { nl: 'Verzonden aan', en: 'Sent to', fr: 'Envoyé à' })} ${to}`,
      detail: [draft.subject, method === 'composer' ? L(ctx.language, { nl: 'Geopend in je mail-app; verstuur daar.', en: 'Opened in your mail app; send it there.', fr: 'Ouvert dans ton app mail ; envoie-le là.' }) : ''].filter(Boolean),
      payload: { kind: 'email_sent', draft: sent, method },
      focus: { draftId: null },
      undo: null,
      externalIds: { draftId: draft.id },
    };
  });

  registry.registerByName('email.markHandled', async (args, ctx) => {
    const id = requireFocus(args.emailId ?? ctx.focus.emailId, NO_EMAIL_FOCUS, ctx.language);
    const email = await ctx.services.emails.markHandled(id);
    return { summary: `${L(ctx.language, { nl: 'Afgehandeld', en: 'Handled', fr: 'Traité' })} · ${email.subject}`, detail: [], payload: { kind: 'record', entity: 'email', id: email.id, title: email.subject, lines: [] }, undo: { kind: 'email_unhandled', id: email.id } };
  });

  registry.registerByName('email.import', async (args, ctx) => {
    const email = await ctx.services.emails.import({ from: { name: args.from.name ?? null, email: args.from.email }, subject: args.subject, bodyText: args.bodyText, receivedAt: args.receivedAt ?? null, isFromMe: args.isFromMe ?? false, threadId: args.threadId ?? null, externalId: args.externalId ?? null });
    const kind = email.analysis?.kind ?? 'unclassified';
    return { summary: `${L(ctx.language, { nl: 'Mail opgeslagen', en: 'Email stored', fr: 'Mail enregistré' })} · ${email.subject}`, detail: [kind, email.analysis?.needsReply ? L(ctx.language, { nl: 'vraagt een antwoord', en: 'needs a reply', fr: 'demande une réponse' }) : ''].filter(Boolean), payload: { kind: 'email_detail', email, thread: [email], summary: email.analysis?.summary ?? email.snippet, requested: email.analysis?.requests ?? [], contact: null }, focus: { emailId: email.id, contactId: email.contactId, draftId: null, label: `${email.from.name ?? email.from.email}: ${email.subject}` }, undo: { kind: 'delete', entity: 'email', id: email.id }, createdItem: null };
  });

  registry.registerByName('email.suggest', async (args, ctx) => {
    const email = await findEmail(ctx, { emailId: args.emailId ?? null });
    const analysed = email.analysis ? email : await ctx.services.emails.analyze(email.id);
    const items = ctx.services.emails.suggestionsFor(analysed);
    const suggestions = await ctx.services.suggestions.propose(items.map((i) => ({ kind: i.kind, title: i.title, payload: i.payload, sourceType: 'email', sourceId: email.id, projectId: email.projectId })));
    const counts = { task: 0, decision: 0, follow_up: 0, risk: 0, question: 0, document_request: 0, reminder: 0, expense: 0, invoice: 0, meeting: 0 };
    for (const s of suggestions) counts[s.kind] += 1;
    return { summary: L(ctx.language, { nl: 'Voorstellen uit de mail', en: 'Proposals from the email', fr: 'Propositions issues du mail' }), detail: [plural(suggestions.length, { nl: 'voorstel', en: 'proposal', fr: 'proposition' }, { nl: 'voorstellen', en: 'proposals', fr: 'propositions' }, ctx.language)], payload: { kind: 'proposals', meeting: null, suggestions, counts, method: analysed.analysis?.method ?? 'deterministic', summary: analysed.analysis?.summary ?? null }, focus: { emailId: email.id, suggestionIds: suggestions.map((s) => s.id) } };
  });
}
