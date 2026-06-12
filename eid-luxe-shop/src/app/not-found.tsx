import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center lg:px-6">
      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
        404
      </span>
      <h1 className="mt-3 font-display text-5xl leading-tight text-forest-800 sm:text-6xl">
        Deze pagina vonden we niet terug.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base text-warmbrown-600">
        Misschien is ze verhuisd, of misschien hebben wij een typfout gemaakt.
        Geen zorgen — kom rustig terug naar de hoofdpagina.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/" variant="primary">Terug naar home</LinkButton>
        <LinkButton href="/shop" variant="ghost">Bekijk de shop</LinkButton>
      </div>
    </section>
  );
}
