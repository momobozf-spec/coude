/**
 * The closed set of things the assistant may offer to do.
 *
 * Model output is matched against this allowlist. A name the model invents
 * resolves to nothing, so there is no path from generated text to an arbitrary
 * function call — and nothing here is destructive.
 *
 * Lives outside the `'use server'` module deliberately: a Server Actions file
 * may only export async functions, and this contract is shared by the client,
 * the server and the tests.
 */
export const ASSISTANT_ACTIONS = [
  'CREATE_WEEKLY_PLAN',
  'CREATE_RAMADAN_PLAN',
  'CREATE_TRAVEL_PLAN',
  'CREATE_LIFE_EVENT_PLAN',
] as const

export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number]

/** Which generator an allowlisted action maps to. */
export const ACTION_TO_GENERATOR: Record<AssistantAction, 'WEEKLY' | 'RAMADAN' | 'TRAVEL' | 'LIFE_EVENT'> = {
  CREATE_WEEKLY_PLAN: 'WEEKLY',
  CREATE_RAMADAN_PLAN: 'RAMADAN',
  CREATE_TRAVEL_PLAN: 'TRAVEL',
  CREATE_LIFE_EVENT_PLAN: 'LIFE_EVENT',
}

export function isAssistantAction(value: string): value is AssistantAction {
  return (ASSISTANT_ACTIONS as readonly string[]).includes(value)
}
