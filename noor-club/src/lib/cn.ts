export type ClassValue = string | false | null | undefined;

/** Tiny class joiner. No dependency needed for what amounts to a filter+join. */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
