'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import type { Locale } from '@/i18n/config';
import {
  signInspectionAction,
  type SignState,
} from '@/app/[locale]/landlord/[token]/actions';
import { Alert } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/field';

const INITIAL: SignState = { error: null };

const COPY = {
  nl: {
    name: 'Uw naam',
    nameHint: 'De naam zoals die op het huurcontract staat.',
    confirm:
      'Ik heb het rapport bekeken en bevestig dat ik de inhoud ervan heb gezien ' +
      'en aanvaard.',
    submit: 'Ondertekenen',
    busy: 'Bezig…',
    errors: {
      INVALID_INPUT: 'Vul uw naam in en vink de bevestiging aan.',
      NOT_FOUND: 'Deze link is niet geldig.',
      EXPIRED: 'Deze link is verlopen.',
      ALREADY_SIGNED: 'Dit dossier is al ondertekend.',
      SAVE_FAILED: 'Er ging iets mis. Probeer het opnieuw.',
    },
    done: 'Bedankt. Uw ondertekening is vastgelegd.',
  },
  fr: {
    name: 'Votre nom',
    nameHint: 'Le nom tel qu’il figure sur le bail.',
    confirm:
      'J’ai consulté le rapport et je confirme en avoir vu et accepté le contenu.',
    submit: 'Signer',
    busy: 'En cours…',
    errors: {
      INVALID_INPUT: 'Indiquez votre nom et cochez la confirmation.',
      NOT_FOUND: 'Ce lien n’est pas valide.',
      EXPIRED: 'Ce lien a expiré.',
      ALREADY_SIGNED: 'Ce dossier a déjà été signé.',
      SAVE_FAILED: 'Une erreur est survenue. Réessayez.',
    },
    done: 'Merci. Votre signature a été enregistrée.',
  },
} as const;

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function LandlordSignForm({
  locale,
  token,
}: {
  locale: Locale;
  token: string;
}) {
  const [state, formAction] = useActionState(signInspectionAction, INITIAL);
  const [confirmed, setConfirmed] = useState(false);
  const t = COPY[locale];

  if (state.signed) {
    return (
      <Alert tone="success">
        <p>{t.done}</p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <Alert tone="critical">
          <p>{t.errors[state.error]}</p>
        </Alert>
      ) : null}

      <Field label={t.name} htmlFor="fullName" required hint={t.nameHint}>
        <Input name="fullName" autoComplete="name" required minLength={2} />
      </Field>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <Checkbox
          name="confirmed"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
        />
        <span>{t.confirm}</span>
      </label>

      <Submit label={t.submit} busy={t.busy} />
    </form>
  );
}
