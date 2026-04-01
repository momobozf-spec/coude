import Link from "next/link";
import { breadcrumbSchema } from "./schemas";

interface Sample {
  title: string;
  svg: string;
}

interface Props {
  slug: string;
  heroTitle: string;
  heroHighlight: string;
  heroParagraph: string;
  bodySections: { heading: string; text: string }[];
  samples: Sample[];
  faqs: { q: string; a: string }[];
  breadcrumbName: string;
}

export default function LandingPageTemplate({
  slug,
  heroTitle,
  heroHighlight,
  heroParagraph,
  bodySections,
  samples,
  faqs,
  breadcrumbName,
}: Props) {
  const crumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: breadcrumbName, url: `/${slug}` },
  ]);

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      {/* Nav */}
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold" style={{ color: "#0d9488" }}>Noor Printables</Link>
          <div className="flex gap-2">
            <Link href="/login" className="btn-secondary text-sm">Log in</Link>
            <Link href="/register" className="btn-primary text-sm">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="max-w-4xl mx-auto px-4 py-3 text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600">Home</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-600">{breadcrumbName}</span>
      </div>

      {/* Hero */}
      <section className="px-4 pt-8 pb-12 text-center" style={{ background: "linear-gradient(180deg, #faf9f6 0%, #f0ebe3 100%)" }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            {heroTitle}
            <br />
            <span style={{ color: "#0d9488" }}>{heroHighlight}</span>
          </h1>
          <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">{heroParagraph}</p>
          <Link href="/register" className="btn-primary text-lg px-10 py-3.5 shadow-lg">
            Get Free Worksheets &rarr;
          </Link>
          <p className="text-xs text-gray-400 mt-3">No credit card required &middot; Instant download</p>
        </div>
      </section>

      {/* Samples */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Free Sample Worksheets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {samples.map((s, i) => (
              <div key={i} className="card text-center">
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-50 mb-3" dangerouslySetInnerHTML={{ __html: s.svg }} />
                <p className="text-sm font-semibold text-gray-700">{s.title}</p>
                <Link href="/register" className="text-xs mt-2 inline-block hover:underline" style={{ color: "#0d9488" }}>
                  Download free &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Body content */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto prose-custom">
          {bodySections.map((s, i) => (
            <div key={i} className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">{s.heading}</h2>
              <p className="text-gray-600 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="py-12 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Frequently Asked Questions</h2>
            {faqs.map((faq, i) => (
              <details key={i} className="group border-b border-gray-100 py-4">
                <summary className="flex justify-between items-center cursor-pointer text-gray-900 font-medium">
                  {faq.q}
                  <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-16 px-4 text-center" style={{ background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            Ready to Create Islamic Activities Your Kids Will Love?
          </h2>
          <Link href="/register" className="inline-flex items-center justify-center bg-white font-bold text-lg px-10 py-4 rounded-lg shadow-lg" style={{ color: "#0d9488" }}>
            Start Free Today &rarr;
          </Link>
          <p className="text-teal-200 text-xs mt-4">3 free sheets &middot; No credit card</p>
        </div>
      </section>

      <footer className="text-center py-6 text-sm text-gray-400">
        Noor Printables &copy; 2026 &mdash; Islamic educational printables for kids
      </footer>
    </div>
  );
}
