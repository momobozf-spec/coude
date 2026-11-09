/**
 * De enige plek in de frontend waar een status naar visuele vorm wordt vertaald.
 *
 * Let goed op wat hier NIET gebeurt: er wordt nergens bepaald wélke status een
 * product heeft. Die komt kant-en-klaar uit de backend, inclusief `statusLabel`,
 * `statusIcon` en `statusTone`. Deze module doet uitsluitend de laatste stap die
 * de backend niet kan doen — een `tone`-string koppelen aan Tailwind-klassen en
 * een `icon`-string aan een React-component.
 *
 * Er staat dus bewust nergens iets als `if (status === "HARAM") return red`.
 * Zou dat hier staan, dan bestond de beslisregel op twee plekken en zou hij
 * vroeg of laat op één van die twee veranderen.
 *
 * Kleur is nooit het enige signaal: elke variant levert altijd een icoon én een
 * tekstlabel mee.
 */
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  HelpCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/** Iconnamen zoals de backend ze in `statusIcon` levert. */
const ICONS: Record<string, LucideIcon> = {
  "check-circle": CheckCircle2,
  check: Check,
  "alert-triangle": AlertTriangle,
  "x-circle": XCircle,
  "help-circle": HelpCircle,
};

/**
 * Het icoon bij een status.
 *
 * Bewust een component met een `icon`-prop, en geen functie die een component
 * teruggeeft. Dat tweede leest prettiger (`const Icon = pick(...)`) maar React
 * ziet dan bij elke render een "nieuw" componenttype, wat state-verlies en
 * onnodige remounts kan opleveren. Hier is het type altijd `StatusIcon` en
 * verandert alleen de prop.
 */
export function StatusIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon: LucideIcon = ICONS[icon] ?? HelpCircle;
  return <Icon aria-hidden="true" className={className} />;
}

export interface ToneClasses {
  /** Achtergrond + rand + tekst, voor een blok of badge. */
  surface: string;
  /** Alleen tekst/icoonkleur, voor gebruik op een neutrale achtergrond. */
  accent: string;
  /** Rand, voor kaarten die alleen een accentlijn nodig hebben. */
  border: string;
}

const TONES: Record<string, ToneClasses> = {
  positive: {
    surface: "bg-tone-positive-bg border-tone-positive-border text-tone-positive",
    accent: "text-tone-positive",
    border: "border-tone-positive-border",
  },
  "neutral-positive": {
    surface:
      "bg-tone-neutral-positive-bg border-tone-neutral-positive-border text-tone-neutral-positive",
    accent: "text-tone-neutral-positive",
    border: "border-tone-neutral-positive-border",
  },
  caution: {
    surface: "bg-tone-caution-bg border-tone-caution-border text-tone-caution",
    accent: "text-tone-caution",
    border: "border-tone-caution-border",
  },
  negative: {
    surface: "bg-tone-negative-bg border-tone-negative-border text-tone-negative",
    accent: "text-tone-negative",
    border: "border-tone-negative-border",
  },
  unknown: {
    surface: "bg-tone-unknown-bg border-tone-unknown-border text-tone-unknown",
    accent: "text-tone-unknown",
    border: "border-tone-unknown-border",
  },
};

export function toneClasses(tone: string): ToneClasses {
  return TONES[tone] ?? TONES.unknown!;
}

/**
 * Betrouwbaarheid in gewone taal.
 *
 * Bewust geen percentage: de engine kent drie niveaus en geen fijnere schaal.
 * "97,4%" zou een precisie suggereren die er niet is, en dat is bij een
 * halal-oordeel geen onschuldige afronding.
 */
const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: "Hoog",
  MEDIUM: "Gemiddeld",
  LOW: "Laag",
};

export function confidenceLabel(confidence: string): string {
  return CONFIDENCE_LABELS[confidence] ?? confidence;
}

/** Uitleg van wat de betrouwbaarheid betekent; niet hoe goed het product is. */
export function confidenceDescription(confidence: string): string {
  switch (confidence) {
    case "HIGH":
      return "We zijn zeker van deze uitspraak.";
    case "MEDIUM":
      return "Deze uitspraak berust deels op onvolledige informatie.";
    default:
      return "Er is weinig informatie beschikbaar; behandel deze uitspraak met voorzichtigheid.";
  }
}
