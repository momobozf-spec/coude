import { Metadata } from "next";
import LandingPageTemplate from "@/lib/seo/LandingPageTemplate";
import { SAMPLE_GIFT, SAMPLE_MOSQUE, SAMPLE_WORDSEARCH } from "@/lib/seo/samples";
import { faqSchema } from "@/lib/seo/schemas";

export const metadata: Metadata = {
  title: "Eid Printables & Worksheets for Kids — Free Coloring Pages",
  description: "Free Eid worksheets and coloring pages for children. Eid al-Fitr and Eid al-Adha themed activities: coloring pages, mazes, word searches. Download PDF instantly. Perfect for Islamic schools and families.",
  keywords: ["eid printables", "eid worksheets free", "eid coloring pages", "eid al fitr activities kids", "eid al adha worksheets", "islamic eid crafts"],
  openGraph: { title: "Eid Printables & Worksheets for Kids — Free", description: "Eid coloring pages, mazes & word searches for ages 4-8. Free PDF download.", url: "/eid-printables" },
};

const faqs = [
  { q: "Do you have both Eid al-Fitr and Eid al-Adha themes?", a: "Yes! We have themes for both Eids. Eid al-Fitr worksheets focus on celebrations after Ramadan, while Eid al-Adha themes cover Hajj, sacrifice, and sharing." },
  { q: "Can I use these as Eid party activities?", a: "Absolutely! Our coloring pages make perfect Eid party activities for children. Print a stack of different designs and set up a coloring station. Kids love it!" },
  { q: "Are there Eid-specific word searches?", a: "Yes! Our Eid word search puzzles include vocabulary like Eid Mubarak, Salah, Gifts, Family, Happy, Mosque, Pray, and Share — perfect for building Islamic vocabulary." },
];

export default function EidPrintables() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }} />
      <LandingPageTemplate
        slug="eid-printables"
        breadcrumbName="Eid Printables"
        heroTitle="Eid Printables &amp; Worksheets"
        heroHighlight="Celebrate with Your Kids"
        heroParagraph="Make Eid celebrations special with printable coloring pages, mazes, and word searches. Eid al-Fitr and Eid al-Adha themes. Perfect as party activities, classroom worksheets, or home fun."
        samples={[
          { title: "Eid Gifts Coloring Page", svg: SAMPLE_GIFT },
          { title: "Eid Mosque Celebration", svg: SAMPLE_MOSQUE },
          { title: "Eid Word Search", svg: SAMPLE_WORDSEARCH },
        ]}
        bodySections={[
          { heading: "Make Eid Unforgettable for Your Children", text: "Eid is the most exciting day of the year for Muslim children — and with Noor Printables, you can make it even more special. Our Eid-themed worksheets include coloring pages of gift boxes with Islamic geometric patterns, mosque celebrations, Eid decorations, and crescent moon designs. Use them as pre-Eid excitement builders, Eid morning activities while waiting for prayer, or Eid party entertainment for groups of children. Every child gets a unique worksheet, making Eid feel personal and creative." },
          { heading: "Eid al-Fitr Activities", text: "Our Eid al-Fitr collection celebrates the joy of completing Ramadan: coloring pages featuring 'Eid Mubarak' designs, gift boxes and celebration scenes, mosque illustrations for Eid prayers, and family gathering themes. Word searches include Eid-specific vocabulary: Salah, Gifts, Family, Joy, Sweets, New Clothes, Forgiveness. These worksheets are perfect for the days leading up to Eid and Eid day itself." },
          { heading: "Eid al-Adha & Hajj Activities", text: "For Eid al-Adha, our themes cover the story of Ibrahim (AS), Hajj pilgrimage scenes, Kaaba illustrations, and the spirit of sacrifice and sharing. Maze worksheets guide children on a 'path to the Kaaba', while word searches introduce Hajj vocabulary: Tawaf, Ihram, Mina, Arafat, Sacrifice, Share. These are especially valuable for teaching the meaning behind Eid al-Adha." },
          { heading: "Eid Party Activity Station", text: "Here's a proven party setup: print 5-10 different Eid coloring pages, set out crayons and colored pencils, and let children pick their favorites. For digital-native kids, open our digital coloring feature on a tablet — they can color mosque and Eid designs on screen with touch controls. Children can save and share their creations via WhatsApp. It keeps kids happily occupied while adults celebrate, and every child goes home with their own Eid artwork." },
          { heading: "Free Eid Worksheets to Start", text: "Get 3 free Eid worksheets instantly — no credit card required. Choose your activity type (coloring, maze, or word search), type 'Eid al-Fitr' or 'Eid al-Adha' as your theme, and download. For unlimited Eid activities, upgrade to Pro ($12/month). Planning an Eid event at your Islamic school? Our School plan ($49/month) lets 25 teachers generate unlimited worksheets with custom branding." },
        ]}
        faqs={faqs}
      />
    </>
  );
}
