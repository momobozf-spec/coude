const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://noorprintables.com";

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${APP_URL}${item.url}`,
    })),
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function articleSchema(opts: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url: opts.url.startsWith("http") ? opts.url : `${APP_URL}${opts.url}`,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    author: { "@type": "Organization", name: "Noor Printables" },
    publisher: {
      "@type": "Organization",
      name: "Noor Printables",
      url: APP_URL,
    },
    image: opts.image || `${APP_URL}/api/og?title=${encodeURIComponent(opts.title)}`,
  };
}
