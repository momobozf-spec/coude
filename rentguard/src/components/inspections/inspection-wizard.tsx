'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { Locale } from '@/i18n/config';
import type { InspectionPhoto, InspectionRoom } from '@/lib/supabase/types';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import {
  roomCompleteness,
  slotHint,
  slotLabel,
  slotsForRoom,
} from '@/lib/inspections/rooms';
import { shortHash } from '@/lib/evidence/hash';
import { formatDateTime } from '@/lib/utils';

interface PhotoView {
  id: string;
  room: string;
  label: string;
  sha256: string;
  uploaded_at: string;
  note: string | null;
}

const COPY = {
  nl: {
    rooms: 'Kamers',
    complete: 'Volledig',
    incomplete: 'Onvolledig',
    photos: (n: number) => `${n} foto${n === 1 ? '' : "'s"}`,
    addPhoto: 'Foto toevoegen',
    uploading: 'Bezig met opslaan…',
    remove: 'Verwijderen',
    notes: 'Notities bij deze kamer',
    notesHint:
      'Beschrijf wat op een foto moeilijk te zien is: een geur, een raam dat ' +
      'niet sluit, een radiator die niet werkt.',
    saveNotes: 'Notities bewaren',
    registeredAt: 'Geregistreerd',
    hash: 'Vingerafdruk',
    missing: 'Nog aanbevolen:',
    required: 'aanbevolen',
    uploadFailed: 'Deze foto kon niet worden opgeslagen.',
    tooLarge: 'Dit bestand is te groot (maximaal 25 MB).',
    wrongType: 'Alleen foto’s (JPEG, PNG of WebP).',
    closed: 'Dit dossier is afgerond en kan niet meer wijzigen.',
    noPhotosYet: 'Nog geen foto’s in deze kamer.',
  },
  fr: {
    rooms: 'Pièces',
    complete: 'Complet',
    incomplete: 'Incomplet',
    photos: (n: number) => `${n} photo${n === 1 ? '' : 's'}`,
    addPhoto: 'Ajouter une photo',
    uploading: 'Enregistrement…',
    remove: 'Supprimer',
    notes: 'Notes pour cette pièce',
    notesHint:
      'Décrivez ce qu’une photo montre mal : une odeur, une fenêtre qui ne ' +
      'ferme pas, un radiateur qui ne fonctionne pas.',
    saveNotes: 'Enregistrer les notes',
    registeredAt: 'Enregistré',
    hash: 'Empreinte',
    missing: 'Encore recommandé :',
    required: 'recommandé',
    uploadFailed: 'Cette photo n’a pas pu être enregistrée.',
    tooLarge: 'Ce fichier est trop volumineux (25 Mo maximum).',
    wrongType: 'Uniquement des photos (JPEG, PNG ou WebP).',
    closed: 'Ce dossier est clôturé et ne peut plus être modifié.',
    noPhotosYet: 'Pas encore de photo dans cette pièce.',
  },
} as const;

export function InspectionWizard({
  locale,
  inspectionId,
  rooms,
  initialPhotos,
  readOnly,
  onNotesSave,
}: {
  locale: Locale;
  inspectionId: string;
  rooms: InspectionRoom[];
  initialPhotos: InspectionPhoto[];
  readOnly: boolean;
  onNotesSave: (formData: FormData) => void;
}) {
  const t = COPY[locale];

  const [photos, setPhotos] = useState<PhotoView[]>(
    initialPhotos.map((photo) => ({
      id: photo.id,
      room: photo.room,
      label: photo.label,
      sha256: photo.sha256,
      uploaded_at: photo.uploaded_at,
      note: photo.note,
    })),
  );
  const [activeRoomKey, setActiveRoomKey] = useState(
    rooms[0]?.room_key ?? '',
  );
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRoom = rooms.find((room) => room.room_key === activeRoomKey);
  const slots = useMemo(() => slotsForRoom(activeRoomKey), [activeRoomKey]);

  const photosByRoom = useMemo(() => {
    const map = new Map<string, PhotoView[]>();
    for (const photo of photos) {
      const list = map.get(photo.room) ?? [];
      list.push(photo);
      map.set(photo.room, list);
    }
    return map;
  }, [photos]);

  const upload = useCallback(
    async (file: File, label: string) => {
      setError(null);
      setBusySlot(label);

      const body = new FormData();
      body.append('file', file);
      body.append('roomKey', activeRoomKey);
      body.append('label', label);

      try {
        const response = await fetch(
          `/api/inspections/${inspectionId}/photos`,
          { method: 'POST', body },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(
            payload.error === 'TOO_LARGE'
              ? t.tooLarge
              : payload.error === 'TYPE_NOT_ALLOWED'
                ? t.wrongType
                : payload.error === 'INSPECTION_CLOSED'
                  ? t.closed
                  : t.uploadFailed,
          );
          return;
        }

        const payload = (await response.json()) as { photo: PhotoView };
        setPhotos((current) => [...current, payload.photo]);
      } catch {
        setError(t.uploadFailed);
      } finally {
        setBusySlot(null);
      }
    },
    [activeRoomKey, inspectionId, t],
  );

  const remove = useCallback(async (photoId: string) => {
    const response = await fetch(`/api/photos/${photoId}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    }
  }, []);

  return (
    <div className="space-y-5">
      <nav aria-label={t.rooms}>
        <ul className="flex gap-2 overflow-x-auto pb-2">
          {rooms.map((room) => {
            const roomPhotos = photosByRoom.get(room.room_key) ?? [];
            const status = roomCompleteness(room.room_key, roomPhotos);
            const isActive = room.room_key === activeRoomKey;

            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => setActiveRoomKey(room.room_key)}
                  aria-current={isActive ? 'true' : undefined}
                  className={[
                    'whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700',
                  ].join(' ')}
                >
                  {room.display_name}
                  <span
                    className={[
                      'ml-2 text-xs',
                      isActive ? 'text-slate-300' : 'text-slate-500',
                    ].join(' ')}
                  >
                    {roomPhotos.length}
                  </span>
                  {status.isComplete ? (
                    <span className="ml-1" aria-label={t.complete}>
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {error ? (
        <Alert tone="critical">
          <p>{error}</p>
        </Alert>
      ) : null}

      {activeRoom ? (
        <>
          {slots.map((slot) => {
            const slotPhotos = (photosByRoom.get(activeRoomKey) ?? []).filter(
              (photo) => photo.label === slot.label,
            );

            return (
              <Card key={slot.label}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {slotLabel(slot, locale)}
                      {slot.required ? (
                        <Badge tone="neutral" className="ml-2">
                          {t.required}
                        </Badge>
                      ) : null}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {slotHint(slot, locale)}
                    </p>
                  </div>
                </div>

                {slotPhotos.length > 0 ? (
                  <ul className="mb-3 space-y-2">
                    {slotPhotos.map((photo) => (
                      <li
                        key={photo.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        <div className="min-w-0 text-xs text-slate-600">
                          <p>
                            {t.registeredAt}:{' '}
                            <span className="font-medium text-slate-800">
                              {formatDateTime(photo.uploaded_at, locale)}
                            </span>
                          </p>
                          <p className="mt-0.5 font-mono">
                            {t.hash}: {shortHash(photo.sha256)}
                          </p>
                        </div>
                        {!readOnly ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove(photo.id)}
                          >
                            {t.remove}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!readOnly ? (
                  <CaptureButton
                    label={busySlot === slot.label ? t.uploading : t.addPhoto}
                    disabled={busySlot !== null}
                    onFile={(file) => void upload(file, slot.label)}
                  />
                ) : null}
              </Card>
            );
          })}

          <Card>
            <form action={onNotesSave} className="space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="inspectionId" value={inspectionId} />
              <input type="hidden" name="roomId" value={activeRoom.id} />

              <label
                htmlFor="notes"
                className="block text-sm font-medium text-slate-900"
              >
                {t.notes}
              </label>
              <p className="text-sm text-slate-600">{t.notesHint}</p>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={activeRoom.notes ?? ''}
                rows={4}
                disabled={readOnly}
              />
              {!readOnly ? (
                <Button type="submit" variant="secondary">
                  {t.saveNotes}
                </Button>
              ) : null}
            </form>
          </Card>

          {(photosByRoom.get(activeRoomKey) ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">{t.noPhotosYet}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Knop die de camera opent op mobiel en anders de bestandskiezer.
 *
 * `capture="environment"` stuurt de achtercamera aan; op desktop wordt het
 * attribuut genegeerd en krijgt de gebruiker een gewone bestandskiezer.
 */
function CaptureButton({
  label,
  disabled,
  onFile,
}: {
  label: string;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Leegmaken zodat dezelfde foto opnieuw gekozen kan worden.
          event.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="secondary"
        full
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}
