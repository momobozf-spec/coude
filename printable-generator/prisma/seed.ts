import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const PLACEHOLDER_VIDEO = "https://iframe.mediadelivery.net/embed/placeholder";

async function main() {
  console.log("Seeding Academy courses...");

  // Course 1: Arabic Alphabet Adventure
  const c1 = await prisma.course.upsert({
    where: { slug: "arabic-alphabet-adventure" },
    update: {},
    create: {
      slug: "arabic-alphabet-adventure",
      title: "Arabic Alphabet Adventure",
      titleAr: "مغامرة الحروف العربية",
      description: "A fun, interactive journey through the Arabic alphabet. Children learn to recognize, trace, and pronounce all 28 letters through animated stories, songs, and activities. Perfect for beginners aged 4-7.",
      thumbnail: "/academy/arabic-alphabet.jpg",
      trailerUrl: PLACEHOLDER_VIDEO,
      price: 29,
      languages: "EN,NL",
      ageRange: "4-7",
      level: "beginner",
      totalLessons: 12,
      totalMinutes: 180,
      isPublished: true,
      isFeatured: false,
      category: "Arabic Letters",
    },
  });

  const arabicLetters = [
    ["Alif — The Standing Letter", 14], ["Ba — The Dot Below", 15], ["Ta — Two Dots on Top", 13],
    ["Tha — Three Dots Adventure", 14], ["Jim — The Deep Sound", 16], ["Ha — The Breathy Letter", 13],
    ["Kha — The Scratchy Sound", 15], ["Dal — The Simple Shape", 12], ["Thal — Tongue Between Teeth", 14],
    ["Ra — The Rolling Sound", 13], ["Zay — The Buzzing Letter", 15], ["Sin — The Smiling Letter", 16],
  ] as const;

  for (let i = 0; i < arabicLetters.length; i++) {
    await prisma.lesson.upsert({
      where: { id: `seed-arabic-${i}` },
      update: {},
      create: {
        id: `seed-arabic-${i}`,
        courseId: c1.id,
        title: arabicLetters[i][0],
        description: `Learn the letter ${arabicLetters[i][0].split(" — ")[0]} with fun animations and practice activities.`,
        videoUrl: PLACEHOLDER_VIDEO,
        duration: arabicLetters[i][1] * 60,
        order: i + 1,
        isFree: i < 2, // First 2 lessons free
      },
    });
  }

  // Course 2: Ramadan with Noor
  const c2 = await prisma.course.upsert({
    where: { slug: "ramadan-with-noor" },
    update: {},
    create: {
      slug: "ramadan-with-noor",
      title: "Ramadan with Noor",
      titleAr: "رمضان مع نور",
      description: "Join Noor on a magical Ramadan journey! Learn about fasting, charity, Quran, and the beautiful traditions of Ramadan through engaging stories and activities. Designed for ages 4-8.",
      thumbnail: "/academy/ramadan-noor.jpg",
      trailerUrl: PLACEHOLDER_VIDEO,
      price: 19,
      languages: "EN,NL,FR",
      ageRange: "4-8",
      level: "beginner",
      totalLessons: 8,
      totalMinutes: 120,
      isPublished: true,
      isFeatured: false,
      category: "Ramadan",
    },
  });

  const ramadanLessons = [
    ["What is Ramadan?", 16], ["Fasting for Kids", 14], ["The Magic of Suhoor", 15],
    ["Iftar — Breaking the Fast", 14], ["The Special Night — Laylat al-Qadr", 16],
    ["Eid al-Fitr Celebrations", 15], ["Giving & Charity in Ramadan", 14], ["Beautiful Ramadan Duaa", 16],
  ] as const;

  for (let i = 0; i < ramadanLessons.length; i++) {
    await prisma.lesson.upsert({
      where: { id: `seed-ramadan-${i}` },
      update: {},
      create: {
        id: `seed-ramadan-${i}`,
        courseId: c2.id,
        title: ramadanLessons[i][0],
        description: `Episode ${i + 1}: ${ramadanLessons[i][0]}`,
        videoUrl: PLACEHOLDER_VIDEO,
        duration: ramadanLessons[i][1] * 60,
        order: i + 1,
        isFree: i < 2,
      },
    });
  }

  // Course 3: 99 Names of Allah (Featured)
  const c3 = await prisma.course.upsert({
    where: { slug: "99-names-of-allah" },
    update: {},
    create: {
      slug: "99-names-of-allah",
      title: "99 Names of Allah for Little Hearts",
      titleAr: "أسماء الله الحسنى للصغار",
      description: "Discover the beautiful names of Allah through stories, examples from nature, and daily life connections. Each lesson teaches 5 names with gentle explanations that children can understand and remember.",
      thumbnail: "/academy/99-names.jpg",
      trailerUrl: PLACEHOLDER_VIDEO,
      price: 34,
      languages: "EN,AR,NL",
      ageRange: "5-8",
      level: "beginner",
      totalLessons: 20,
      totalMinutes: 240,
      isPublished: true,
      isFeatured: true,
      category: "Islamic Values",
    },
  });

  const namesLessons = [
    "Ar-Rahman & Ar-Raheem — The Most Merciful",
    "Al-Malik & Al-Quddus — The King, The Pure",
    "As-Salam & Al-Mu'min — Peace & Safety",
    "Al-Aziz & Al-Jabbar — The Mighty",
    "Al-Khaliq & Al-Musawwir — The Creator",
    "Al-Ghaffar & Al-Qahhar — Forgiveness",
    "Al-Wahhab & Ar-Razzaq — The Giver",
    "Al-Fattah & Al-Alim — The Opener, All-Knowing",
    "Al-Basir & As-Sami — Sees & Hears All",
    "Al-Hakam & Al-Adl — Justice & Wisdom",
    "Al-Latif & Al-Khabir — The Gentle",
    "Al-Halim & Al-Azim — The Patient, The Great",
    "Al-Ghafur & Ash-Shakur — Forgiveness & Gratitude",
    "Al-Ali & Al-Kabir — The Most High",
    "Al-Hafiz & Al-Muqit — The Protector",
    "Al-Hasib & Al-Jalil — The Reckoner",
    "Al-Karim & Ar-Raqib — The Generous",
    "Al-Mujib & Al-Wasi — The Responder",
    "Al-Hakim & Al-Wadud — The Wise, The Loving",
    "Al-Haqq & An-Nur — The Truth, The Light",
  ];

  for (let i = 0; i < namesLessons.length; i++) {
    await prisma.lesson.upsert({
      where: { id: `seed-names-${i}` },
      update: {},
      create: {
        id: `seed-names-${i}`,
        courseId: c3.id,
        title: namesLessons[i],
        description: `Lesson ${i + 1}: Learn about ${namesLessons[i]}`,
        videoUrl: PLACEHOLDER_VIDEO,
        duration: 12 * 60,
        order: i + 1,
        isFree: i < 2,
      },
    });
  }

  console.log(`Seeded: ${c1.title} (${arabicLetters.length} lessons)`);
  console.log(`Seeded: ${c2.title} (${ramadanLessons.length} lessons)`);
  console.log(`Seeded: ${c3.title} (${namesLessons.length} lessons)`);

  // ═══════════════════════════════════════════════════
  // RAMADAN CHALLENGE 2026
  // ═══════════════════════════════════════════════════
  const rc = await prisma.ramadanChallenge.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      title: "30 Days of Ramadan Challenge 2026",
      price: 14.99,
      earlyPrice: 9.99,
      startDate: new Date("2026-02-18"),
      endDate: new Date("2026-03-19"),
      isActive: true,
    },
  });

  const days: [string, string, string, string, string?, string?][] = [
    ["Bismillah — Begin met de naam van Allah", "بسم الله", "Bismillah calligraphy", "coloring", "Bismillahi rahmani raheem", "Begin alle goede dingen met de naam van Allah"],
    ["Waarom vasten we?", "لماذا نصوم؟", "Zoek het Iftar eten", "maze", "Allahumma inni laka sumtu", "Vasten leert ons geduld en dankbaarheid"],
    ["Suhoor — De zegen van vroeg opstaan", "السحور", "Suhoor tafel", "coloring", "Allahumma barik lana fi suhoorina", "De Profeet (vzmh) zei: neem suhoor, want daarin zit zegen"],
    ["Sabar — Geduld tijdens Ramadan", "الصبر", "Ramadan woorden", "wordsearch", "Rabbi zidni sabra", "Geduld is de helft van het geloof"],
    ["Quran lezen — Elke dag een beetje", "القرآن", "Arabische letters", "tracing", "Allahumma-hdinaa bil Quran", "De Quran werd geopenbaard in de maand Ramadan"],
    ["Sadaqah — Geven maakt blij", "الصدقة", "Muntjes in een pot", "coloring", "Allahumma taqabbal sadaqatana", "De profeet was het meest vrijgevig in Ramadan"],
    ["Eerste week badge! 🌟", "أسبوع أول", "Moskee", "special", "Alhamdulillah", "Gefeliciteerd met je eerste week Ramadan!"],
    ["Iftar — Breek het vasten met dadels", "الإفطار", "Iftar tafel", "coloring", "Allahumma laka sumtu wa ala rizqika aftartu", "De Profeet brak het vasten met dadels en water"],
    ["Dua — Praten met Allah", "الدعاء", "Eenvoudige dua", "tracing", "Rabbana aatina fid dunya hasana", "Allah houdt ervan wanneer je Hem vraagt"],
    ["Vriendelijkheid — Wees lief voor anderen", "اللطف", "Help de buur", "maze", "Allahumma ajalni min al-muhsineen", "Een glimlach is ook sadaqah"],
    ["Mosquee — Het huis van Allah", "المسجد", "Grote moskee", "coloring", "Allahumma-jal fi qalbi noora", "De moskee is de mooiste plek op aarde"],
    ["Arabisch alfabet — Deel 1", "الأبجدية ١", "Alif tot Jim", "tracing", "Rabbi yassir wala tu'assir", "Leer de eerste letters van het Arabisch alfabet"],
    ["Zakat — Delen is vermenigvuldigen", "الزكاة", "Geven aan anderen", "coloring", "Allahumma barik li fi mali", "Zakat zuivert je bezittingen"],
    ["Halverwege! 🏆 Twee weken badge", "نصف الطريق", "Groot kleurblad", "special", "Alhamdulillahi rabbil alameen", "Masha'Allah! Je bent al halverwege!"],
    ["Laylat al-Qadr — De Nacht der Bestemming", "ليلة القدر", "Sterrenhemel", "coloring", "Allahumma innaka afuwwun tuhibbul afwa fa'fu anni", "Deze nacht is beter dan duizend maanden"],
    ["Arabisch alfabet — Deel 2", "الأبجدية ٢", "Ha tot Sin", "tracing", "Rabbi zidni ilma", "Ga door met het leren van Arabische letters"],
    ["Istighfar — Vergiffenis vragen", "الاستغفار", "Pad naar vergiffenis", "maze", "Astaghfirullah al-adheem", "Allah vergeeft altijd als je oprecht bent"],
    ["Familie — Ramadan samen vieren", "العائلة", "Familie iftar", "coloring", "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yun", "Familie is een geschenk van Allah"],
    ["Natuur — Allah's schepping", "الطبيعة", "Bloemen en bomen", "coloring", "Subhanallah", "Alles in de natuur prijst Allah"],
    ["Arabisch alfabet — Deel 3", "الأبجدية ٣", "Shin tot Qaf", "tracing", "Allahumma allimni ma yanfa'uni", "Je kent nu al meer dan de helft van het alfabet!"],
    ["Drie weken! 💫 Grote badge", "ثلاثة أسابيع", "Certificaat tussenstap", "special", "La ilaha illallah", "Geweldig! Nog één week te gaan!"],
    ["Eid voorbereiden — Nieuwe kleren", "ملابس العيد", "Eid outfit", "coloring", "Allahumma albishni libaasal taqwa", "Het is sunnah om mooie kleren te dragen met Eid"],
    ["Eid cadeautjes — Geven en ontvangen", "هدايا العيد", "Vind de cadeaus", "maze", "Tahaadu tahabbu", "Geef cadeaus, dan groeit de liefde"],
    ["Arabisch alfabet — Deel 4", "الأبجدية ٤", "Kaf tot Ya", "tracing", "Allahumma tammim lana ilmana", "Je kent nu alle Arabische letters!"],
    ["Wudu — Zuiver worden", "الوضوء", "Stappen van wudu", "tracing", "Bismillah, Allahumma-ghfirli dhanbi", "Wudu wast niet alleen je lichaam maar ook je zonden"],
    ["Salah — Het gebed", "الصلاة", "Kind in gebed", "coloring", "Allahu Akbar", "Het gebed is de sleutel tot het paradijs"],
    ["Laylat al-Qadr voorbereiding", "ليلة القدر", "Speciale nacht", "coloring", "Allahumma innaka afuwwun kareemun tuhibbul afwa fa'fu anni", "Zoek Laylat al-Qadr in de laatste 10 nachten"],
    ["Bijna Eid! 🌙", "قريباً العيد", "Eid woorden", "wordsearch", "Allahumma ballighna Eid", "Nog een paar dagen en dan is het Eid!"],
    ["Laatste dag Ramadan", "آخر يوم", "Maan en sterren", "coloring", "Allahumma taqabbal minna", "Moge Allah al onze ibadah accepteren"],
    ["EID MUBARAK! 🎉 Champion badge", "عيد مبارك", "Groot Eid kleurfeest", "special", "Taqabbalallahu minna wa minkum", "Eid Mubarak! Je hebt het gehaald!"],
  ];

  for (let i = 0; i < days.length; i++) {
    const [title, titleAr, theme, activityType, dua, hadith] = days[i];
    await prisma.challengeDay.upsert({
      where: { challengeId_dayNumber: { challengeId: rc.id, dayNumber: i + 1 } },
      update: {},
      create: {
        challengeId: rc.id,
        dayNumber: i + 1,
        title,
        titleAr: titleAr || "",
        theme,
        activityType,
        duaOfDay: dua || null,
        hadithOfDay: hadith || null,
      },
    });
  }

  console.log(`Seeded: Ramadan Challenge 2026 (${days.length} days)`);

  // ═══════════════════════════════════════════════════
  // BADGES
  // ═══════════════════════════════════════════════════
  const badgeData: [string, string, string, string, string, string, number, boolean][] = [
    // [slug, name, description, category, tier, requirement JSON, xp, isSecret]
    ["first-steps", "First Steps", "Completed your very first activity", "completion", "bronze", '{"type":"total_count","count":1}', 10, false],
    ["getting-started", "Getting Started", "Completed 5 activities", "completion", "bronze", '{"type":"total_count","count":5}', 25, false],
    ["active-learner", "Active Learner", "Completed 25 activities — Masha'Allah!", "completion", "silver", '{"type":"total_count","count":25}', 50, false],
    ["noor-scholar", "Noor Scholar", "100 activities completed — true scholar!", "completion", "gold", '{"type":"total_count","count":100}', 150, false],
    ["islamic-champion", "Islamic Champion", "500 activities — legendary!", "completion", "platinum", '{"type":"total_count","count":500}', 500, false],
    ["first-letter", "First Letter", "Completed your first Arabic letter worksheet", "alphabet", "bronze", '{"type":"theme_count","theme":"arabic","count":1}', 10, false],
    ["alphabet-explorer", "Alphabet Explorer", "Completed 10 Arabic letter worksheets", "alphabet", "silver", '{"type":"theme_count","theme":"arabic","count":10}', 30, false],
    ["alphabet-master", "Alphabet Master", "All 28 Arabic letters — Masha'Allah!", "alphabet", "gold", '{"type":"theme_count","theme":"arabic","count":28}', 100, false],
    ["streak-3", "3-Day Streak", "3 days of learning in a row!", "streak", "bronze", '{"type":"streak","days":3}', 20, false],
    ["streak-7", "Week Warrior", "7-day learning streak!", "streak", "silver", '{"type":"streak","days":7}', 50, false],
    ["streak-14", "Fortnight Focus", "14-day learning streak!", "streak", "gold", '{"type":"streak","days":14}', 100, false],
    ["streak-30", "Month Master", "30 consecutive days — amazing!", "streak", "platinum", '{"type":"streak","days":30}', 300, false],
    ["ramadan-beginner", "Ramadan Beginner", "7 days of Ramadan challenge", "ramadan", "bronze", '{"type":"ramadan_days","count":7}', 30, false],
    ["ramadan-halfway", "Ramadan Halfway", "15 days of Ramadan challenge", "ramadan", "silver", '{"type":"ramadan_days","count":15}', 75, false],
    ["ramadan-hero", "Ramadan Hero", "All 30 days! Eid Mubarak! 🎉", "ramadan", "gold", '{"type":"ramadan_days","count":30}', 200, false],
    ["mosque-builder", "Mosque Builder", "5 mosque-themed worksheets", "theme", "silver", '{"type":"theme_count","theme":"mosque","count":5}', 40, false],
    ["eid-celebrant", "Eid Celebrant", "5 Eid-themed activities", "theme", "gold", '{"type":"theme_count","theme":"eid","count":5}', 80, false],
    ["values-champion", "Values Champion", "10 Islamic values worksheets", "theme", "gold", '{"type":"theme_count","theme":"values","count":10}', 100, false],
    ["course-completer", "Course Completer", "Completed your first course", "course", "silver", '{"type":"courses_completed","count":1}', 100, false],
    ["academy-graduate", "Academy Graduate", "Completed 3 courses", "course", "gold", '{"type":"courses_completed","count":3}', 300, false],
    ["noor-ambassador", "Noor Ambassador", "Referred 3 families!", "sharing", "gold", '{"type":"referrals","count":3}', 200, false],
    ["early-bird", "Early Bird", "One of the first 1,000 families!", "special", "platinum", '{"type":"signup_date","before":"2026-06-01"}', 500, true],
    ["laylat-al-qadr", "Laylat al-Qadr", "Secret Ramadan night badge", "special", "platinum", '{"type":"ramadan_day","day":27}', 500, true],
  ];

  const emojiMap: Record<string, string> = {
    "first-steps": "👣", "getting-started": "🚀", "active-learner": "📖", "noor-scholar": "🎓", "islamic-champion": "🏆",
    "first-letter": "أ", "alphabet-explorer": "📝", "alphabet-master": "🌟",
    "streak-3": "🔥", "streak-7": "🔥", "streak-14": "🔥", "streak-30": "⭐",
    "ramadan-beginner": "🌙", "ramadan-halfway": "🌙", "ramadan-hero": "🎉",
    "mosque-builder": "🕌", "eid-celebrant": "🎁", "values-champion": "💚",
    "course-completer": "▶️", "academy-graduate": "📜",
    "noor-ambassador": "📢", "early-bird": "🌅", "laylat-al-qadr": "✨",
  };

  for (let i = 0; i < badgeData.length; i++) {
    const [slug, name, description, category, tier, requirement, xp, isSecret] = badgeData[i];
    await prisma.badge.upsert({
      where: { slug },
      update: {},
      create: { slug, name, description, category, tier, requirement, xpReward: xp, isSecret, iconEmoji: emojiMap[slug] || "⭐", displayOrder: i },
    });
  }

  console.log(`Seeded: ${badgeData.length} badges`);
  console.log("Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
