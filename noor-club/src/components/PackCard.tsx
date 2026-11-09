import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { Chip } from "@/components/ui/StatTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";

export type PackCardData = {
  slug: string;
  title: string;
  description: string;
  coverUrl: string;
  isFree: boolean;
  releaseAt: Date;
  done: number;
  total: number;
  locked: boolean;
};

export async function PackCard({
  pack,
  childId,
  locale,
}: {
  pack: PackCardData;
  childId: string;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "packs" });
  const released = pack.releaseAt.getTime() <= Date.now();
  const complete = pack.total > 0 && pack.done >= pack.total;

  const body = (
    <>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-emerald-light">
        {/* Covers are generated SVGs, so a plain <img> keeps this a pure server
            component with no image-optimization round trip. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pack.coverUrl}
          alt=""
          className={cn(
            "h-full w-full object-cover",
            (!released || pack.locked) && "opacity-60 grayscale",
          )}
          loading="lazy"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {pack.isFree ? <Chip tone="gold">{t("free")}</Chip> : null}
          {!released ? <Chip tone="muted">{t("comingSoon")}</Chip> : null}
          {released && pack.locked ? <Chip tone="muted">🔒 {t("locked")}</Chip> : null}
          {complete ? <Chip tone="emerald">✓ {t("done")}</Chip> : null}
        </div>
      </div>

      <h3 className="mt-3 text-lg font-extrabold text-emerald-dark">{pack.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{pack.description}</p>

      {released ? (
        <div className="mt-3">
          <ProgressBar
            value={pack.total > 0 ? pack.done / pack.total : 0}
            label={t("progress", { done: pack.done, total: pack.total })}
            tone={complete ? "emerald" : "gold"}
          />
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {t("progress", { done: pack.done, total: pack.total })}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs font-semibold text-slate-500">
          {t("availableFrom", {
            date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
              pack.releaseAt,
            ),
          })}
        </p>
      )}
    </>
  );

  if (!released) {
    return <div className="rounded-card bg-white p-4 shadow-card opacity-80">{body}</div>;
  }

  return (
    <Link
      href={`/pakket/${pack.slug}?kind=${childId}`}
      className="block rounded-card bg-white p-4 shadow-card transition-shadow hover:shadow-lift"
    >
      {body}
    </Link>
  );
}
