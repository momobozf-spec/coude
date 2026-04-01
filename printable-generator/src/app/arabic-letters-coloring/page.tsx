import { Metadata } from "next";
import LandingPageTemplate from "@/lib/seo/LandingPageTemplate";
import { SAMPLE_LETTERS, SAMPLE_STAR, SAMPLE_WORDSEARCH } from "@/lib/seo/samples";
import { faqSchema } from "@/lib/seo/schemas";

export const metadata: Metadata = {
  title: "Arabic Letters Coloring Pages — Learn Arabic Alphabet for Kids",
  description: "Free Arabic alphabet coloring pages for kids aged 4-8. Learn Alif, Ba, Ta with fun coloring activities, word searches with Arabic vocabulary, and maze worksheets. Download PDF instantly.",
  keywords: ["arabic letters coloring", "arabic alphabet coloring page", "learn arabic for kids", "arabic letters worksheet", "alif ba ta coloring", "islamic alphabet"],
  openGraph: { title: "Arabic Letters Coloring Pages — Learn Arabic Alphabet", description: "Fun Arabic alphabet coloring & worksheets for ages 4-8. Free PDF download.", url: "/arabic-letters-coloring" },
};

const faqs = [
  { q: "What Arabic letters are covered?", a: "Our worksheets cover all 28 letters of the Arabic alphabet, from Alif to Ya. You can generate coloring pages for individual letters, letter groups, or the complete alphabet." },
  { q: "Do children need to know Arabic already?", a: "Not at all! Our worksheets are designed for absolute beginners. The coloring-based approach makes letter recognition fun and natural, even for children who have never seen Arabic script before." },
  { q: "Can these supplement our Quran classes?", a: "Yes! Many parents and Quran teachers use our Arabic letter worksheets as a warm-up activity before Quran reading sessions. The coloring makes learning feel like play rather than study." },
];

export default function ArabicLettersColoring() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }} />
      <LandingPageTemplate
        slug="arabic-letters-coloring"
        breadcrumbName="Arabic Letters Coloring"
        heroTitle="Arabic Alphabet Coloring Pages"
        heroHighlight="Learn Alif-Ba-Ta Through Play"
        heroParagraph="Make learning Arabic fun with beautiful coloring pages for each letter, word searches with Islamic vocabulary, and maze worksheets. Designed for children aged 4-8."
        samples={[
          { title: "Arabic Letters: Alif & Ba", svg: SAMPLE_LETTERS },
          { title: "Islamic Star Pattern", svg: SAMPLE_STAR },
          { title: "Arabic Word Search", svg: SAMPLE_WORDSEARCH },
        ]}
        bodySections={[
          { heading: "Why Coloring Helps Children Learn Arabic Letters", text: "Research in early childhood education shows that children learn letter shapes faster when they trace and color them rather than simply looking at flashcards. Our Arabic letter coloring pages give children a tactile, engaging way to learn the 28 letters of the Arabic alphabet. Each letter is presented in a large, clear outline that children can color, trace with their finger, or decorate. The combination of visual recognition and physical interaction creates stronger neural pathways for letter recognition — the foundation of reading the Quran." },
          { heading: "Our Arabic Learning Worksheet Collection", text: "We offer multiple activity types for Arabic letter learning: large letter coloring pages where children color individual Arabic letters, word search puzzles featuring Arabic vocabulary in English transliteration (helping children connect sounds to letters), Bismillah calligraphy coloring sheets, and Arabic number worksheets. Each worksheet can be themed — for example, 'Arabic Letters Alif-Ba' generates coloring pages specifically for those letters, while 'Arabic Numbers' creates number-focused activities." },
          { heading: "Integrating with Your Arabic Teaching Routine", text: "Whether you're homeschooling, running a weekend Islamic school, or simply teaching your children at home, our Arabic letter worksheets fit seamlessly into your routine. Use them as a daily practice activity (one letter per day = the full alphabet in a month), as homework sheets for Quran class, or as fun weekend activities. Our digital coloring feature lets children practice letter recognition on a tablet — perfect for reinforcing what they've learned on paper." },
          { heading: "From Letters to Words to Quran", text: "Our worksheets support the natural progression of Arabic learning: first letters, then short words, then Quranic vocabulary. Start with individual letter coloring, progress to word searches containing Islamic terms (Salah, Quran, Masjid, Allah), and eventually use our themed worksheets for Quranic vocabulary practice. This scaffolded approach makes Arabic learning accessible and enjoyable for young children." },
          { heading: "Get Started in Seconds", text: "Create a free account, select your activity type, type 'Arabic Letters Alif-Ba' as your theme, and download your PDF instantly. Free accounts include 3 worksheets. Pro subscribers get unlimited Arabic letter worksheets with new variations every time — perfect for daily practice without repetition." },
        ]}
        faqs={faqs}
      />
    </>
  );
}
