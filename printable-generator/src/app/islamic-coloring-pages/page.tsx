import { Metadata } from "next";
import LandingPageTemplate from "@/lib/seo/LandingPageTemplate";
import { SAMPLE_MOSQUE, SAMPLE_STAR, SAMPLE_CRESCENT } from "@/lib/seo/samples";
import { faqSchema } from "@/lib/seo/schemas";

export const metadata: Metadata = {
  title: "Islamic Coloring Pages for Kids — Free Printable Worksheets",
  description: "Download free Islamic coloring pages for children aged 4-8. Beautiful mosque, crescent, geometric pattern & Ramadan coloring sheets. Print at home or use in the classroom. New designs every week.",
  keywords: ["islamic coloring pages", "islamic coloring pages for kids", "muslim coloring book", "mosque coloring page", "islamic printables", "ramadan coloring pages"],
  openGraph: {
    title: "Islamic Coloring Pages for Kids — Free Printable Worksheets",
    description: "Beautiful Islamic coloring pages: mosques, crescents, geometric patterns. Designed for ages 4-8. Download free.",
    url: "/islamic-coloring-pages",
  },
};

const faqs = [
  { q: "What age are these coloring pages designed for?", a: "Our Islamic coloring pages are designed for children aged 4-8, with varying complexity levels. Simpler pages (crescents, stars) suit ages 4-5, while detailed geometric patterns challenge ages 6-8." },
  { q: "Can I use these in my Islamic school?", a: "Absolutely! Our School plan ($49/mo) gives you up to 25 teacher accounts with unlimited downloads. Many Islamic weekend schools and full-time schools use our worksheets." },
  { q: "Are the designs reviewed for Islamic appropriateness?", a: "Yes. All designs are curated to be age-appropriate and aligned with mainstream Islamic values. We do not include any depictions of prophets or living beings in our mosque/Islamic architecture designs." },
  { q: "Can I print these at home?", a: "Yes! All coloring pages are generated as A4 PDF files optimized for home printing. They work perfectly on any standard printer." },
  { q: "How often are new designs added?", a: "We add new Islamic coloring page themes every week. Pro and School subscribers get priority access to new designs." },
];

export default function IslamicColoringPages() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }} />
      <LandingPageTemplate
        slug="islamic-coloring-pages"
        breadcrumbName="Islamic Coloring Pages"
        heroTitle="Free Islamic Coloring Pages"
        heroHighlight="for Kids Aged 4-8"
        heroParagraph="Download beautiful Islamic coloring pages featuring mosques, crescents, geometric patterns, and more. Designed by Muslim educators for children. Print at home or use in the classroom."
        samples={[
          { title: "Mosque Coloring Page", svg: SAMPLE_MOSQUE },
          { title: "Islamic Star Pattern", svg: SAMPLE_STAR },
          { title: "Crescent & Stars", svg: SAMPLE_CRESCENT },
        ]}
        bodySections={[
          {
            heading: "Why Islamic Coloring Pages Matter for Your Child's Development",
            text: "Coloring is more than just fun — it develops fine motor skills, hand-eye coordination, and creativity in young children. When combined with Islamic themes, coloring pages become a powerful tool for introducing children to their faith in an engaging, age-appropriate way. Research shows that children retain information better when they interact with it physically, making coloring an ideal activity for early Islamic education. Our mosque coloring pages help children recognize Islamic architecture, while our geometric pattern sheets introduce them to the mathematical beauty of Islamic art — a tradition stretching back over a thousand years."
          },
          {
            heading: "What Makes Our Islamic Coloring Pages Different",
            text: "Unlike generic coloring pages found online, every design on Noor Printables is purposefully crafted for Muslim families. Our coloring pages feature mosques with accurate architectural details, Islamic geometric patterns based on traditional tessellation, crescent moons and stars, Ramadan lanterns, and more. Each page is generated on-demand, meaning you get unique worksheets every time. We offer four activity types: coloring pages, mazes, word searches, and digital coloring — all with Islamic themes. Our digital coloring feature lets children color on a tablet or phone, perfect for travel or screen time you can feel good about."
          },
          {
            heading: "Perfect for Home and Classroom Use",
            text: "Parents use our coloring pages during Ramadan to keep children engaged, during Eid celebrations as party activities, and year-round as part of their Islamic education routine. Islamic school teachers use our worksheets as classroom warm-up activities, homework sheets, and reward activities. With our School plan, up to 25 teachers can access unlimited worksheets with custom school branding. All PDFs are optimized for A4 printing and work on any home or office printer."
          },
          {
            heading: "Themes Available for Islamic Coloring",
            text: "Choose from dozens of Islamic themes including: mosques, minarets, the Kaaba, Ramadan lanterns, crescent moons, Islamic geometric patterns, Arabic calligraphy, Eid decorations, dua hands, Quran, the Five Pillars of Islam, Hajj, Zakat, and more. We also offer general educational themes like animals, nature, and shapes — all with an Islamic twist. New themes are added weekly, and Pro subscribers get priority access."
          },
          {
            heading: "How to Get Started",
            text: "Getting your first Islamic coloring page takes less than 30 seconds: create a free account, choose 'Coloring Page' as your activity type, enter a theme like 'Mosque' or 'Ramadan', and click generate. Your PDF downloads instantly. Free accounts get 3 worksheets to try. Upgrade to Pro ($12/month or $97/year) for unlimited access, no watermarks, and commercial use rights. Schools get bulk generation and multi-teacher accounts for $49/month."
          },
        ]}
        faqs={faqs}
      />
    </>
  );
}
