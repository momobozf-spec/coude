import { Metadata } from "next";
import LandingPageTemplate from "@/lib/seo/LandingPageTemplate";
import { SAMPLE_LANTERN, SAMPLE_CRESCENT, SAMPLE_MAZE } from "@/lib/seo/samples";
import { faqSchema } from "@/lib/seo/schemas";

export const metadata: Metadata = {
  title: "Ramadan Worksheets & Activities for Kids — Free Printable PDF",
  description: "Free Ramadan worksheets for children aged 4-8. Coloring pages, mazes, and word searches themed around fasting, iftar, taraweeh, and Ramadan traditions. Download as PDF instantly.",
  keywords: ["ramadan worksheets", "ramadan activities for children", "ramadan coloring pages", "ramadan printables", "islamic ramadan kids", "ramadan maze"],
  openGraph: { title: "Ramadan Worksheets & Activities for Kids", description: "Free Ramadan coloring pages, mazes & word searches for ages 4-8. Download PDF instantly.", url: "/ramadan-worksheets" },
};

const faqs = [
  { q: "When should I start Ramadan activities with my kids?", a: "Start 2-3 weeks before Ramadan to build excitement. Use our countdown coloring pages and Ramadan vocabulary word searches to introduce concepts like fasting, iftar, and suhoor." },
  { q: "Are these appropriate for non-fasting children?", a: "Absolutely! These worksheets focus on the joy and community aspects of Ramadan — lanterns, moon sighting, iftar meals, charity, and Quran reading — making them perfect for children too young to fast." },
  { q: "Can I use these for my Islamic school's Ramadan program?", a: "Yes! Our School plan gives 25 teacher accounts unlimited worksheets. Many Islamic schools use our Ramadan activity packs for daily classroom activities throughout the month." },
];

export default function RamadanWorksheets() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }} />
      <LandingPageTemplate
        slug="ramadan-worksheets"
        breadcrumbName="Ramadan Worksheets"
        heroTitle="Ramadan Worksheets &amp; Activities"
        heroHighlight="for Kids Aged 4-8"
        heroParagraph="Make Ramadan special with printable coloring pages, mazes, and word searches. Themes include fasting, iftar, Ramadan lanterns, crescent moons, and more. Download instantly as PDF."
        samples={[
          { title: "Ramadan Lantern Coloring", svg: SAMPLE_LANTERN },
          { title: "Crescent Moon & Stars", svg: SAMPLE_CRESCENT },
          { title: "Path to Iftar Maze", svg: SAMPLE_MAZE },
        ]}
        bodySections={[
          { heading: "Make Ramadan Magical for Your Children", text: "Ramadan is a month of spiritual growth, community, and joy — and children should experience that magic too. Our Ramadan worksheets help kids aged 4-8 engage with the blessed month through hands-on activities they love: coloring beautiful Ramadan lanterns, solving mazes to find the path to the mosque for Taraweeh, and discovering Islamic vocabulary in word search puzzles. Whether your child is fasting for the first time or simply observing the family traditions, these activities create meaningful Ramadan memories." },
          { heading: "Ramadan Themes Available", text: "Our Ramadan worksheet collection covers every aspect of the holy month: Ramadan Mubarak greetings, iftar tables with dates and water, Ramadan lanterns (fanous), crescent moon sighting, Taraweeh prayer, Quran reading, Laylat al-Qadr, charity and giving, suhoor meals, and Eid al-Fitr celebrations. Each theme generates unique worksheets, so you can create a fresh activity for every day of Ramadan — that's 30 unique coloring pages, mazes, and word searches!" },
          { heading: "Daily Ramadan Activity Routine", text: "Many parents create a daily Ramadan routine with our worksheets: a coloring page after suhoor for early risers, a maze puzzle during afternoon quiet time, and a word search before iftar. Teachers use them as classroom warm-ups during the school day. Our digital coloring feature is perfect for car rides to Taraweeh — kids can color on a tablet while parents drive. The results can be saved and shared with family on WhatsApp." },
          { heading: "Ramadan Countdown Activities", text: "Start building excitement weeks before Ramadan begins! Create a Ramadan countdown with a new coloring page each day. Use our Islamic vocabulary word searches to teach Ramadan-related words: Sawm, Iftar, Suhoor, Taraweeh, Quran, Laylat al-Qadr, Zakat al-Fitr. By the time Ramadan arrives, your children will be prepared and excited." },
          { heading: "From Free to Unlimited Ramadan Fun", text: "Try 3 worksheets free — no credit card needed. When you're ready for unlimited Ramadan activities, upgrade to Pro ($12/month or $97/year). During Ramadan, we often run special promotions — use code RAMADAN50 at checkout for 50% off your first month. School accounts ($49/month) get bulk generation for entire classroom sets." },
        ]}
        faqs={faqs}
      />
    </>
  );
}
