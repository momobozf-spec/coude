import Link from "next/link";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n/dictionaries";
import { Footer, Header } from "@/components/SiteChrome";
import { SlideCard } from "@/components/SlideCard";

async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDict(lang);
  const year = await currentYear();

  return (
    <>
      <Header locale={lang} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 pt-6 pb-16 lg:grid-cols-[1.15fr_1fr] lg:pt-14">
          <div>
            <h1 className="display text-[clamp(3rem,8vw,6.2rem)]">{d.hero.title}</h1>
            <p className="mt-6 max-w-xl text-xl text-ink-soft">{d.hero.lead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={`/${lang}/start`} className="rounded-full bg-ink px-7 py-4 text-lg font-bold text-cream hover:bg-grape">
                {d.hero.cta}
              </Link>
              <span className="text-ink-soft">{d.pricing.price}</span>
            </div>
            <p className="mt-4 max-w-md text-sm text-ink-soft">{d.hero.note}</p>
          </div>

          <div className="relative mx-auto h-[520px] w-[300px]" aria-hidden="true">
            <div className="hero-chat absolute inset-x-0 top-6 flex flex-col gap-3">
              <p className="mb-1 text-sm font-bold text-ink-soft">{d.demo.group}</p>
              {d.demo.lines.map(([who, text], i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-3xl px-4 py-2.5 ${
                    i % 2 === 0 ? "self-start rounded-bl-md bg-white" : "self-end rounded-br-md bg-lilac"
                  }`}
                >
                  <span className="block text-xs font-bold text-pink">{who}</span>
                  {text}
                </div>
              ))}
            </div>
            <div className="hero-slide absolute top-0 left-1/2 origin-top -translate-x-1/2 scale-[0.8]">
              <SlideCard
                spec={{
                  key: "demo",
                  tone: "grape",
                  kicker: d.demo.slideLabel,
                  headline: "Yassine",
                  bubble: d.demo.slideValue,
                  body: d.demo.slideCaption,
                }}
                index={2}
                total={24}
                year={year}
              />
            </div>
          </div>
        </section>

        <section className="py-16">
          <h2 className="display text-5xl">{d.how.title}</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {d.how.steps.map((s, i) => (
              <li key={s.title} className="border-t-[3px] border-ink pt-5">
                <span className="display text-6xl text-pink">{i + 1}</span>
                <h3 className="mt-3 text-2xl font-bold">{s.title}</h3>
                <p className="mt-2 max-w-sm text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="my-8 rounded-[36px_36px_36px_10px] bg-grape px-6 py-12 text-cream sm:px-12">
          <h2 className="display text-5xl text-sun">{d.privacyBlock.title}</h2>
          <ul className="mt-8 grid max-w-3xl gap-5 text-lg">
            {d.privacyBlock.points.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-pink" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-10 py-16 lg:grid-cols-2">
          <div>
            <h2 className="display text-5xl">{d.pricing.title}</h2>
            <p className="display mt-6 text-8xl text-pink">{d.pricing.price}</p>
            <p className="mt-4 text-lg font-semibold">{d.pricing.free}</p>
          </div>
          <div className="self-end">
            <p className="font-bold">{d.pricing.paid}</p>
            <ul className="mt-4 space-y-3">
              {d.pricing.features.map((f) => (
                <li key={f} className="flex gap-3">
                  <span className="text-pink" aria-hidden="true">
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href={`/${lang}/start`} className="mt-8 inline-block rounded-full bg-sun px-7 py-4 text-lg font-bold text-grape">
              {d.pricing.cta}
            </Link>
          </div>
        </section>

        <section className="py-16">
          <h2 className="display text-5xl">{d.faq.title}</h2>
          <div className="mt-8 max-w-3xl divide-y-2 divide-line border-y-2 border-line">
            {d.faq.items.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xl font-bold">
                  {f.q}
                  <span className="text-2xl text-pink transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer locale={lang} />
    </>
  );
}
