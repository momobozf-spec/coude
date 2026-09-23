import type { nl } from './locales/nl.js';

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

/** Shape every catalogue must implement (derived from the Dutch source). */
export type Messages = Widen<typeof nl>;

export interface PluralMessage {
  one: string;
  other: string;
}

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = T extends string
  ? never
  : T extends PluralMessage
    ? never
    : { [K in keyof T]: T[K] extends string | PluralMessage ? K : Join<K, Leaves<T[K]>> }[keyof T];

/** Every translatable key, e.g. "product.cheapest". */
export type MessageKey = Leaves<Messages>;
