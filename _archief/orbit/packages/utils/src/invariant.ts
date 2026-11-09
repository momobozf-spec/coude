export class InvariantError extends Error {
  override readonly name = 'InvariantError';
}

/** Faalt luid bij een programmeerfout. Niet gebruiken voor gebruikersinvoer. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvariantError(message);
}

/** Maakt een `switch` over een union uitputtend; TypeScript faalt bij een gemiste tak. */
export function assertNever(value: never, message = 'Onverwachte waarde'): never {
  throw new InvariantError(`${message}: ${JSON.stringify(value)}`);
}

export function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new InvariantError(message);
  return value;
}
