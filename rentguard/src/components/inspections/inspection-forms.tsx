'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import type { Locale } from '@/i18n/config';
import {
  completeInspectionAction,
  createInspectionAction,
  inviteLandlordAction,
  type InspectionState,
} from '@/app/[locale]/(app)/inspections/actions';
import { Alert } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { ROOM_PRESETS } from '@/lib/inspections/rooms';

const INITIAL: InspectionState = { error: null };

const ERROR_COPY: Record<string, { nl: string; fr: string }> = {
  INVALID_INPUT: {
    nl: 'Kijk de ingevulde gegevens na.',
    fr: 'Vérifiez les données saisies.',
  },
  NOT_AUTHENTICATED: {
    nl: 'Uw sessie is verlopen. Meld u opnieuw aan.',
    fr: 'Votre session a expiré. Reconnectez-vous.',
  },
  NOT_FOUND: { nl: 'Niet gevonden.', fr: 'Introuvable.' },
  ALREADY_EXISTS: {
    nl: 'Voor deze woning bestaat al een dossier van dit type.',
    fr: 'Un dossier de ce type existe déjà pour ce logement.',
  },
  NOT_ENTITLED: {
    nl: 'Deze formule is nog niet actief voor deze woning.',
    fr: 'Cette formule n’est pas encore active pour ce logement.',
  },
  NO_CHECK_IN: {
    nl:
      'Er is nog geen afgerond intrekdossier voor deze woning. Een ' +
      'vertrekdossier zonder vergelijkingsbasis heeft weinig waarde.',
    fr:
      'Il n’existe pas encore de dossier d’entrée clôturé pour ce logement. Un ' +
      'dossier de sortie sans base de comparaison a peu de valeur.',
  },
  NOT_COMPLETE: {
    nl: 'Voeg minstens één foto toe voordat u het dossier afrondt.',
    fr: 'Ajoutez au moins une photo avant de clôturer le dossier.',
  },
  NO_LANDLORD_EMAIL: {
    nl:
      'Er staat geen e-mailadres van de verhuurder bij deze woning. Vul het ' +
      'aan om een uitnodiging te kunnen sturen.',
    fr:
      'Aucune adresse e-mail du bailleur n’est enregistrée pour ce logement. ' +
      'Complétez-la pour pouvoir envoyer une invitation.',
  },
  EMAIL_NOT_CONFIGURED: {
    nl:
      'De uitnodiging is aangemaakt, maar de e-mail kon niet verstuurd worden: ' +
      'de e-maildienst is nog niet geconfigureerd.',
    fr:
      'L’invitation a été créée, mais l’e-mail n’a pas pu être envoyé : le ' +
      'service d’e-mail n’est pas encore configuré.',
  },
  SAVE_FAILED: {
    nl: 'Er ging iets mis bij het bewaren.',
    fr: 'Une erreur est survenue lors de l’enregistrement.',
  },
};

function errorText(code: string | null, locale: Locale): string | null {
  if (!code) return null;
  return ERROR_COPY[code]?.[locale] ?? ERROR_COPY.SAVE_FAILED[locale];
}

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------

export function StartInspectionForm({
  locale,
  propertyId,
  type,
  defaultDate,
}: {
  locale: Locale;
  propertyId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(createInspectionAction, INITIAL);
  const [customRooms, setCustomRooms] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const message = errorText(state.error, locale);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="type" value={type} />

      {message ? (
        <Alert tone="critical">
          <p>{message}</p>
          {state.error === 'NOT_ENTITLED' && state.suggestedPlan ? (
            <p>
              <Link
                href={`/${locale}/billing`}
                className="underline underline-offset-2"
              >
                {locale === 'nl' ? 'Formules bekijken' : 'Voir les formules'}
              </Link>
            </p>
          ) : null}
        </Alert>
      ) : null}

      <Field
        label={
          locale === 'nl' ? 'Datum van vaststelling' : 'Date de la constatation'
        }
        htmlFor="inspectionDate"
        required
      >
        <Input
          name="inspectionDate"
          type="date"
          defaultValue={defaultDate}
          required
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-slate-900">
          {locale === 'nl'
            ? 'Welke ruimtes wilt u documenteren?'
            : 'Quelles pièces souhaitez-vous documenter ?'}
        </legend>

        <div className="grid gap-2 sm:grid-cols-2">
          {ROOM_PRESETS.map((preset) => (
            <label
              key={preset.key}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm"
            >
              <Checkbox
                name="rooms"
                value={preset.key}
                defaultChecked={preset.defaultSelected}
              />
              <span>{preset[locale]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-900">
          {locale === 'nl' ? 'Eigen ruimte toevoegen' : 'Ajouter une pièce'}
        </p>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={locale === 'nl' ? 'bv. Bureau' : 'p. ex. Bureau'}
            maxLength={80}
          />
          <Button
            variant="secondary"
            onClick={() => {
              const name = draft.trim();
              if (name === '') return;
              setCustomRooms((current) => [...current, name]);
              setDraft('');
            }}
          >
            {locale === 'nl' ? 'Toevoegen' : 'Ajouter'}
          </Button>
        </div>

        {customRooms.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {customRooms.map((name, index) => (
              <li
                key={`${name}-${index}`}
                className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm"
              >
                <input type="hidden" name="customRooms" value={name} />
                {name}
                <button
                  type="button"
                  onClick={() =>
                    setCustomRooms((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                  aria-label={locale === 'nl' ? 'Verwijderen' : 'Supprimer'}
                  className="text-slate-500"
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Submit
        label={locale === 'nl' ? 'Dossier starten' : 'Démarrer le dossier'}
        busy={locale === 'nl' ? 'Bezig…' : 'En cours…'}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------

export function CompleteInspectionForm({
  locale,
  inspectionId,
  disabled,
}: {
  locale: Locale;
  inspectionId: string;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(completeInspectionAction, INITIAL);
  const [confirmed, setConfirmed] = useState(false);
  const message = errorText(state.error, locale);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="inspectionId" value={inspectionId} />

      {message ? (
        <Alert tone="critical">
          <p>{message}</p>
        </Alert>
      ) : null}

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <Checkbox
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>
          {locale === 'nl'
            ? 'Ik heb alle ruimtes nagekeken en wil dit dossier afronden.'
            : 'J’ai vérifié toutes les pièces et je souhaite clôturer ce dossier.'}
        </span>
      </label>

      <Button type="submit" size="lg" disabled={disabled || !confirmed}>
        {locale === 'nl' ? 'Dossier afronden' : 'Clôturer le dossier'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------

export function InviteLandlordForm({
  locale,
  inspectionId,
  landlordEmail,
  propertyId,
  alreadySentAt,
}: {
  locale: Locale;
  inspectionId: string;
  landlordEmail: string | null;
  propertyId: string;
  alreadySentAt: string | null;
}) {
  const [state, formAction] = useActionState(inviteLandlordAction, INITIAL);
  const message = errorText(state.error, locale);

  if (!landlordEmail) {
    return (
      <Alert tone="info">
        <p>{ERROR_COPY.NO_LANDLORD_EMAIL[locale]}</p>
        <p>
          <Link
            href={`/${locale}/properties/${propertyId}/edit`}
            className="underline underline-offset-2"
          >
            {locale === 'nl'
              ? 'E-mailadres toevoegen'
              : 'Ajouter une adresse e-mail'}
          </Link>
        </p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="inspectionId" value={inspectionId} />

      {message ? (
        <Alert tone={state.error === 'EMAIL_NOT_CONFIGURED' ? 'warning' : 'critical'}>
          <p>{message}</p>
        </Alert>
      ) : null}

      {alreadySentAt && !state.error ? (
        <Alert tone="success">
          <p>
            {locale === 'nl'
              ? 'De uitnodiging is verstuurd. Zolang de verhuurder niet ' +
                'ondertekent, blijft dit dossier eenzijdig.'
              : 'L’invitation a été envoyée. Tant que le bailleur ne signe pas, ' +
                'ce dossier reste unilatéral.'}
          </p>
        </Alert>
      ) : null}

      <p className="text-sm text-slate-700">
        {locale === 'nl' ? 'Uitnodiging naar' : 'Invitation à'}:{' '}
        <span className="font-medium">{landlordEmail}</span>
      </p>

      <Submit
        label={
          alreadySentAt
            ? locale === 'nl'
              ? 'Opnieuw versturen'
              : 'Renvoyer'
            : locale === 'nl'
              ? 'Uitnodiging versturen'
              : 'Envoyer l’invitation'
        }
        busy={locale === 'nl' ? 'Bezig…' : 'En cours…'}
      />
    </form>
  );
}
