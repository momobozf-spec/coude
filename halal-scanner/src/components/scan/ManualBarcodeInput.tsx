"use client";

import { useId, useState, type FormEvent } from "react";

/**
 * Handmatige invoer — de route die altijd werkt.
 *
 * Deze component doet bewust geen echte barcodevalidatie. De backend heeft de
 * checksumcontrole voor EAN/UPC en is daar de bron van waarheid; die hier
 * nabouwen zou betekenen dat er twee implementaties zijn die uit elkaar kunnen
 * lopen, en dan is het maar de vraag welke gelijk heeft.
 *
 * Wat hier wél gebeurt is een goedkope vormcontrole — zijn het cijfers, is de
 * lengte plausibel — zodat iemand die een letter typt meteen feedback krijgt in
 * plaats van na een netwerkrondje. Alles wat daar doorheen komt gaat naar
 * dezelfde flow als een camerascan.
 */

/** Snelle vormcontrole. Nadrukkelijk geen checksum: dat doet de backend. */
export function looksLikeBarcode(value: string): boolean {
  const trimmed = value.trim();
  return /^\d{8,14}$/.test(trimmed);
}

export interface ManualBarcodeInputProps {
  onSubmit: (barcode: string) => void;
  disabled?: boolean;
}

export function ManualBarcodeInput({ onSubmit, disabled = false }: ManualBarcodeInputProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const [value, setValue] = useState("");
  const [showError, setShowError] = useState(false);

  const invalid = showError && !looksLikeBarcode(value);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!looksLikeBarcode(value)) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">
        Barcode handmatig invoeren
      </label>

      <p id={hintId} className="text-sm text-[var(--muted)]">
        De cijfers onder de streepjescode, meestal 8 tot 13 cijfers.
      </p>

      <div className="flex gap-2">
        <input
          id={inputId}
          name="barcode"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          // `pattern` helpt mobiele toetsenborden, maar de echte controle
          // gebeurt bij submit en daarna op de server.
          pattern="[0-9]*"
          value={value}
          disabled={disabled}
          aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setValue(event.target.value);
            if (showError) setShowError(false);
          }}
          placeholder="5411234567890"
          className="min-h-11 flex-1 rounded-lg border bg-[var(--surface)] px-3 py-2 text-base"
          style={{ borderColor: invalid ? "var(--color-tone-negative)" : "var(--border)" }}
        />

        <button
          type="submit"
          disabled={disabled}
          className="min-h-11 rounded-lg bg-[var(--foreground)] px-4 py-2 font-medium text-[var(--background)] disabled:opacity-50"
        >
          Zoeken
        </button>
      </div>

      {invalid ? (
        <p id={errorId} role="alert" className="text-sm text-tone-negative">
          Een barcode bestaat uit 8 tot 14 cijfers. Controleer wat je hebt ingetypt.
        </p>
      ) : null}
    </form>
  );
}
