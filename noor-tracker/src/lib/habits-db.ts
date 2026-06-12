// Helpers for serializing/deserializing habits field (stored as JSON string in SQLite)

export function serializeHabits(habits: Record<string, boolean>): string {
  return JSON.stringify(habits);
}

export function deserializeHabits(raw: string | Record<string, boolean>): Record<string, boolean> {
  if (typeof raw === "string") {
    return JSON.parse(raw) as Record<string, boolean>;
  }
  return raw;
}
