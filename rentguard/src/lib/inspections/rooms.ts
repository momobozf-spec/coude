import type { Locale } from '@/i18n/config';

/**
 * Kamerstructuur en fotochecklist.
 *
 * De sleutels (`room_key`, `label`) zijn taalonafhankelijk. Dat is essentieel:
 * de uitcheckwizard koppelt elke foto aan de intrekfoto met dezelfde sleutel.
 * Zou de sleutel de vertaalde naam zijn, dan brak die koppeling zodra iemand
 * van taal wisselt.
 */

export interface RoomPreset {
  key: string;
  nl: string;
  fr: string;
  /** Kamers die in vrijwel elke woning voorkomen, staan standaard aan. */
  defaultSelected: boolean;
}

export const ROOM_PRESETS: RoomPreset[] = [
  { key: 'entrance', nl: 'Inkomhal', fr: "Hall d'entrée", defaultSelected: true },
  { key: 'living_room', nl: 'Woonkamer', fr: 'Séjour', defaultSelected: true },
  { key: 'kitchen', nl: 'Keuken', fr: 'Cuisine', defaultSelected: true },
  { key: 'bedroom_1', nl: 'Slaapkamer 1', fr: 'Chambre 1', defaultSelected: true },
  { key: 'bedroom_2', nl: 'Slaapkamer 2', fr: 'Chambre 2', defaultSelected: false },
  { key: 'bedroom_3', nl: 'Slaapkamer 3', fr: 'Chambre 3', defaultSelected: false },
  { key: 'bathroom', nl: 'Badkamer', fr: 'Salle de bain', defaultSelected: true },
  { key: 'toilet', nl: 'Toilet', fr: 'Toilette', defaultSelected: true },
  { key: 'hallway', nl: 'Gang', fr: 'Couloir', defaultSelected: false },
  { key: 'storage', nl: 'Berging', fr: 'Débarras', defaultSelected: false },
  { key: 'cellar', nl: 'Kelder', fr: 'Cave', defaultSelected: false },
  { key: 'attic', nl: 'Zolder', fr: 'Grenier', defaultSelected: false },
  { key: 'terrace', nl: 'Terras of tuin', fr: 'Terrasse ou jardin', defaultSelected: false },
  { key: 'garage', nl: 'Garage', fr: 'Garage', defaultSelected: false },
  {
    key: 'meters',
    nl: 'Meterstanden',
    fr: 'Relevés des compteurs',
    defaultSelected: true,
  },
];

export function roomLabel(preset: RoomPreset, locale: Locale): string {
  return preset[locale];
}

/** Kamers die de gebruiker zelf toevoegt, krijgen deze sleutelvorm. */
export function customRoomKey(displayName: string, index: number): string {
  const slug = displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  return `custom:${slug || 'kamer'}_${index}`;
}

export function isCustomRoom(roomKey: string): boolean {
  return roomKey.startsWith('custom:');
}

// ---------------------------------------------------------------------------
// Fotochecklist
// ---------------------------------------------------------------------------

export interface PhotoSlot {
  label: string;
  nl: string;
  fr: string;
  /** Wat de gebruiker precies moet fotograferen. */
  hintNl: string;
  hintFr: string;
  required: boolean;
  /** Meerdere foto's toegestaan onder dit label. */
  multiple: boolean;
}

const STANDARD_SLOTS: PhotoSlot[] = [
  {
    label: 'overview',
    nl: 'Overzicht van de kamer',
    fr: "Vue d'ensemble de la pièce",
    hintNl:
      'Ga in een hoek staan en fotografeer de hele kamer. Zorg dat vloer en ' +
      'plafond mee in beeld komen.',
    hintFr:
      "Placez-vous dans un coin et photographiez toute la pièce. Veillez à ce " +
      'que le sol et le plafond soient visibles.',
    required: true,
    multiple: true,
  },
  {
    label: 'floor',
    nl: 'Vloer',
    fr: 'Sol',
    hintNl:
      'Fotografeer de vloer van dichtbij, ook waar hij er goed uitziet. Zonder ' +
      'beginfoto is later niet aan te tonen dat een vlek er nog niet was.',
    hintFr:
      'Photographiez le sol de près, y compris là où il est en bon état. Sans ' +
      "photo de départ, impossible de démontrer plus tard qu'une tache " +
      "n'existait pas encore.",
    required: true,
    multiple: true,
  },
  {
    label: 'walls',
    nl: 'Muren en plafond',
    fr: 'Murs et plafond',
    hintNl:
      'Fotografeer elke muur apart. Let op gaatjes van pluggen, vlekken en ' +
      'vochtplekken.',
    hintFr:
      'Photographiez chaque mur séparément. Faites attention aux trous de ' +
      "chevilles, aux taches et aux traces d'humidité.",
    required: true,
    multiple: true,
  },
  {
    label: 'windows',
    nl: 'Ramen en deuren',
    fr: 'Fenêtres et portes',
    hintNl:
      'Fotografeer het raamwerk, de kruk en de dichting. Test of het raam sluit ' +
      'en noteer het als dat niet lukt.',
    hintFr:
      "Photographiez le châssis, la poignée et le joint. Testez si la fenêtre " +
      'ferme et notez-le si ce n’est pas le cas.',
    required: false,
    multiple: true,
  },
  {
    label: 'damage_closeup',
    nl: 'Close-up van bestaande schade',
    fr: 'Gros plan des dégâts existants',
    hintNl:
      'Dit is de belangrijkste foto. Alles wat al beschadigd is en u nu niet ' +
      'vastlegt, kan later aan u worden toegeschreven. Neem er gerust veel.',
    hintFr:
      'C’est la photo la plus importante. Tout ce qui est déjà abîmé et que ' +
      'vous ne documentez pas maintenant pourra plus tard vous être imputé. ' +
      "N'hésitez pas à en prendre beaucoup.",
    required: false,
    multiple: true,
  },
];

const METER_SLOTS: PhotoSlot[] = [
  {
    label: 'meter_electricity',
    nl: 'Elektriciteitsmeter',
    fr: "Compteur d'électricité",
    hintNl:
      'Fotografeer het meternummer én de standen zo dat de cijfers leesbaar ' +
      'zijn. Bij een tweevoudig tarief: beide standen.',
    hintFr:
      'Photographiez le numéro du compteur et les index de sorte que les ' +
      'chiffres soient lisibles. En bi-horaire : les deux index.',
    required: true,
    multiple: true,
  },
  {
    label: 'meter_gas',
    nl: 'Gasmeter',
    fr: 'Compteur de gaz',
    hintNl: 'Meternummer en stand, leesbaar in beeld.',
    hintFr: 'Numéro du compteur et index, lisibles à l’image.',
    required: false,
    multiple: true,
  },
  {
    label: 'meter_water',
    nl: 'Watermeter',
    fr: "Compteur d'eau",
    hintNl: 'Meternummer en stand, leesbaar in beeld.',
    hintFr: 'Numéro du compteur et index, lisibles à l’image.',
    required: false,
    multiple: true,
  },
];

export function slotsForRoom(roomKey: string): PhotoSlot[] {
  return roomKey === 'meters' ? METER_SLOTS : STANDARD_SLOTS;
}

export const ALL_SLOTS: PhotoSlot[] = [...STANDARD_SLOTS, ...METER_SLOTS];

export function slotFor(label: string): PhotoSlot | null {
  return ALL_SLOTS.find((slot) => slot.label === label) ?? null;
}

export function slotLabel(slot: PhotoSlot, locale: Locale): string {
  return locale === 'nl' ? slot.nl : slot.fr;
}

export function slotHint(slot: PhotoSlot, locale: Locale): string {
  return locale === 'nl' ? slot.hintNl : slot.hintFr;
}

// ---------------------------------------------------------------------------
// Volledigheid
// ---------------------------------------------------------------------------

export interface RoomCompleteness {
  roomKey: string;
  photoCount: number;
  missingRequired: string[];
  isComplete: boolean;
}

/**
 * Bepaalt of een kamer voldoende gedocumenteerd is.
 *
 * Wij blokkeren niets: een gebruiker mag afronden met een onvolledige kamer.
 * Wel toont het rapport dan welke onderdelen ontbreken, zodat de zwakte van
 * het dossier zichtbaar is in plaats van verborgen.
 */
export function roomCompleteness(
  roomKey: string,
  photos: { label: string }[],
): RoomCompleteness {
  const slots = slotsForRoom(roomKey);
  const present = new Set(photos.map((photo) => photo.label));

  const missingRequired = slots
    .filter((slot) => slot.required && !present.has(slot.label))
    .map((slot) => slot.label);

  return {
    roomKey,
    photoCount: photos.length,
    missingRequired,
    isComplete: missingRequired.length === 0 && photos.length > 0,
  };
}
