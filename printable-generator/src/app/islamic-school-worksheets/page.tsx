import { Metadata } from "next";
import LandingPageTemplate from "@/lib/seo/LandingPageTemplate";
import { SAMPLE_MOSQUE, SAMPLE_WORDSEARCH, SAMPLE_MAZE } from "@/lib/seo/samples";
import { faqSchema } from "@/lib/seo/schemas";

export const metadata: Metadata = {
  title: "Islamic School Worksheets — Printable Activities for Classroom Use",
  description: "Printable Islamic worksheets for schools and teachers. Coloring pages, mazes, and word searches with Islamic themes. Bulk generation, 25 teacher accounts, custom branding. Used by 180+ Islamic schools.",
  keywords: ["islamic school worksheets", "islamic education worksheets", "islamic studies printables", "islamic teacher resources", "muslim school activities", "weekend islamic school worksheets"],
  openGraph: { title: "Islamic School Worksheets — For Teachers & Schools", description: "Printable Islamic worksheets for classroom use. Bulk generation, 25 teacher accounts. Used by 180+ schools.", url: "/islamic-school-worksheets" },
};

const faqs = [
  { q: "How many teachers can use the School plan?", a: "The School plan supports up to 25 teacher accounts under one subscription. Each teacher gets their own login and can generate unlimited worksheets independently." },
  { q: "Can we add our school logo to the worksheets?", a: "Yes! The School plan includes custom branding. Your school name and logo appear on every generated worksheet, making them look professional and consistent." },
  { q: "Do you offer invoice/purchase order billing?", a: "Yes. School plan customers can request invoice billing from the dashboard. We support purchase order payments and can provide documentation for school budgets." },
  { q: "Can worksheets align with our Islamic studies curriculum?", a: "Our themes cover standard Islamic studies topics: Five Pillars, Prophets, Islamic Values, Arabic Letters, Ramadan, Hajj, and more. Teachers can generate worksheets for specific lessons by entering detailed themes." },
  { q: "Is there a discount for annual billing?", a: "Yes! Annual billing is $397/year (equivalent to $33/month) — saving $191 compared to monthly billing at $49/month." },
];

export default function IslamicSchoolWorksheets() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }} />
      <LandingPageTemplate
        slug="islamic-school-worksheets"
        breadcrumbName="Islamic School Worksheets"
        heroTitle="Islamic School Worksheets"
        heroHighlight="Built for Teachers &amp; Schools"
        heroParagraph="Generate unlimited Islamic educational worksheets for your classroom. Coloring pages, mazes, and word searches with Islamic themes. 25 teacher accounts, bulk generation, and custom school branding."
        samples={[
          { title: "Mosque Coloring Worksheet", svg: SAMPLE_MOSQUE },
          { title: "Islamic Word Search", svg: SAMPLE_WORDSEARCH },
          { title: "Path to Mosque Maze", svg: SAMPLE_MAZE },
        ]}
        bodySections={[
          { heading: "Why 180+ Islamic Schools Choose Noor Printables", text: "Islamic school teachers face a unique challenge: finding educational materials that are both pedagogically sound and Islamically appropriate. Generic worksheet platforms offer thousands of templates, but almost none with Islamic content. Teachers end up spending hours creating their own materials or adapting secular worksheets. Noor Printables solves this by generating unlimited Islamic-themed worksheets on-demand. Enter a topic from your lesson plan — 'Five Pillars of Islam', 'Hajj Journey', or 'Arabic Letters Alif-Ba' — and get a professional worksheet in seconds. 180+ Islamic schools worldwide already use Noor Printables as part of their daily classroom routine." },
          { heading: "Built Specifically for Classroom Use", text: "Our School plan is designed for the way Islamic schools actually work. Up to 25 teachers share one subscription, each with their own account. Teachers generate worksheets independently for their classes. Every worksheet can include your school's name and branding. Bulk generation lets you create a week's worth of worksheets in minutes. And because worksheets are generated on-demand with variation, no two students get identical sheets — reducing copying and encouraging individual work." },
          { heading: "Curriculum-Aligned Islamic Themes", text: "Our theme library aligns with standard Islamic studies curricula: Five Pillars of Islam (Shahada, Salah, Zakat, Sawm, Hajj), Prophets and their stories, Islamic values (kindness, patience, gratitude, honesty), Arabic letters and numbers, Ramadan and Eid celebrations, Mosque and Islamic architecture, Quran and Sunnah, and Islamic history. Teachers can enter specific themes like 'Prophet Ibrahim and the Kaaba' to get targeted worksheets for their current lesson." },
          { heading: "Multiple Activity Types for Different Learning Styles", text: "Not every child learns the same way. Our platform offers four activity types to reach different learners: Coloring pages develop fine motor skills and visual recognition. Mazes build problem-solving and spatial reasoning. Word searches strengthen vocabulary and letter recognition. Digital coloring engages technology-oriented learners on tablets. Teachers can mix activity types throughout the week to keep students engaged and address multiple intelligences." },
          { heading: "Investment That Pays for Itself", text: "At $49/month (or $33/month with annual billing), the School plan costs less than a single pack of printed worksheets from a traditional publisher — and you get unlimited generation with new content every week. Calculate the time your teachers currently spend creating or searching for Islamic worksheets: even saving 2 hours per teacher per month makes the investment worthwhile. Request a demo or start with a free account to see the quality before committing." },
        ]}
        faqs={faqs}
      />
    </>
  );
}
