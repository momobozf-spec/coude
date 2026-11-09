/**
 * Conversational focus (§96, §139): what "die mail", "dit", "daarna een reminder voor die
 * factuur" refer to. Updated by tool results, persisted with the conversation state and
 * consumed by the AdminParser when a command leaves the target implicit.
 */
export interface ButlerFocus {
  emailId: string | null;
  draftId: string | null;
  projectId: string | null;
  companyId: string | null;
  contactId: string | null;
  invoiceId: string | null;
  followUpId: string | null;
  taskId: string | null;
  meetingId: string | null;
  expenseId: string | null;
  documentId: string | null;
  suggestionIds: string[];
  /** Human label of the main focused entity for previews ("mail van Fabrice"). */
  label: string | null;
  updatedAt: string | null;
}

export const EMPTY_FOCUS: ButlerFocus = {
  emailId: null,
  draftId: null,
  projectId: null,
  companyId: null,
  contactId: null,
  invoiceId: null,
  followUpId: null,
  taskId: null,
  meetingId: null,
  expenseId: null,
  documentId: null,
  suggestionIds: [],
  label: null,
  updatedAt: null,
};

export type FocusPatch = Partial<ButlerFocus>;

export function mergeFocus(current: ButlerFocus | null | undefined, patch: FocusPatch | null | undefined, at: string): ButlerFocus {
  const base = current ?? EMPTY_FOCUS;
  if (!patch) return base;
  return { ...base, ...patch, suggestionIds: patch.suggestionIds ?? base.suggestionIds, updatedAt: at };
}

/** A focus older than this is ignored (minutes). */
export const FOCUS_TTL_MINUTES = 120;

export function isFocusFresh(focus: ButlerFocus | null | undefined, nowISO: string): focus is ButlerFocus {
  if (!focus?.updatedAt) return false;
  const age = (new Date(nowISO).getTime() - new Date(focus.updatedAt).getTime()) / 60_000;
  return Number.isFinite(age) && age <= FOCUS_TTL_MINUTES;
}
