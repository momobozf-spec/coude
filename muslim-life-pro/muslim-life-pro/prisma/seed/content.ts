import type { PrismaClient } from '@prisma/client'

/**
 * Daily reminder content.
 *
 * References are given precisely so a reader can verify every item. Hadith entries
 * cite the collection and the grading, because presenting an unattributed hadith as
 * authoritative is exactly the kind of thing this product must not do.
 */

interface ContentSeed {
  type: 'VERSE' | 'HADITH' | 'DUA'
  arabic?: string
  transliteration?: string
  translation: string
  reference: string
  source?: string
  tags: string[]
}

export const DAILY_CONTENT: ContentSeed[] = [
  {
    type: 'VERSE',
    arabic: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    transliteration: "Fa inna ma'al-'usri yusra",
    translation: 'For indeed, with hardship comes ease.',
    reference: "Qur'an 94:5",
    source: 'Surah Ash-Sharh',
    tags: ['patience', 'hope'],
  },
  {
    type: 'VERSE',
    arabic: 'وَمَن يَتَّقِ ٱللَّهَ يَجْعَل لَّهُۥ مَخْرَجًا',
    transliteration: 'Wa man yattaqillaha yaj\'al lahu makhraja',
    translation: 'And whoever is mindful of Allah, He will make a way out for them.',
    reference: "Qur'an 65:2",
    source: 'Surah At-Talaq',
    tags: ['trust', 'guidance'],
  },
  {
    type: 'VERSE',
    arabic: 'إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ',
    transliteration: "Innallaha ma'as-sabirin",
    translation: 'Indeed, Allah is with those who are patient.',
    reference: "Qur'an 2:153",
    source: 'Surah Al-Baqarah',
    tags: ['patience'],
  },
  {
    type: 'VERSE',
    arabic: 'وَقُل رَّبِّ زِدْنِى عِلْمًا',
    transliteration: 'Wa qul rabbi zidni ilma',
    translation: 'And say: My Lord, increase me in knowledge.',
    reference: "Qur'an 20:114",
    source: 'Surah Ta-Ha',
    tags: ['knowledge', 'learning'],
  },
  {
    type: 'VERSE',
    arabic: 'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
    transliteration: "Ala bidhikrillahi tatma'innul-qulub",
    translation: 'Truly, it is in the remembrance of Allah that hearts find rest.',
    reference: "Qur'an 13:28",
    source: "Surah Ar-Ra'd",
    tags: ['dhikr', 'peace'],
  },
  {
    type: 'VERSE',
    arabic: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    transliteration: "La yukallifullahu nafsan illa wus'aha",
    translation: 'Allah does not burden a soul beyond what it can bear.',
    reference: "Qur'an 2:286",
    source: 'Surah Al-Baqarah',
    tags: ['mercy', 'hope'],
  },
  {
    type: 'HADITH',
    translation:
      'The deeds most beloved to Allah are those done consistently, even if they are few.',
    reference: 'Sahih al-Bukhari 6464',
    source: 'Narrated by Aisha (may Allah be pleased with her) · Authentic',
    tags: ['consistency', 'habits'],
  },
  {
    type: 'HADITH',
    translation: 'Whoever believes in Allah and the Last Day should speak good or remain silent.',
    reference: 'Sahih al-Bukhari 6018',
    source: 'Narrated by Abu Hurayrah (may Allah be pleased with him) · Authentic',
    tags: ['character', 'speech'],
  },
  {
    type: 'HADITH',
    translation:
      'The strong person is not the one who overcomes people by strength, but the one who controls himself while in anger.',
    reference: 'Sahih al-Bukhari 6114',
    source: 'Narrated by Abu Hurayrah (may Allah be pleased with him) · Authentic',
    tags: ['character', 'patience'],
  },
  {
    type: 'HADITH',
    translation: 'Take advantage of your health before your illness, and your free time before you become busy.',
    reference: 'Sunan al-Nasa\'i, al-Hakim',
    source: 'Narrated by Ibn Abbas (may Allah be pleased with him) · Graded authentic by al-Hakim',
    tags: ['time', 'productivity'],
  },
  {
    type: 'HADITH',
    translation: 'None of you truly believes until he loves for his brother what he loves for himself.',
    reference: 'Sahih al-Bukhari 13',
    source: 'Narrated by Anas ibn Malik (may Allah be pleased with him) · Authentic',
    tags: ['community', 'character'],
  },
  {
    type: 'DUA',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration:
      "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar",
    translation:
      'Our Lord, grant us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.',
    reference: "Qur'an 2:201",
    source: 'Surah Al-Baqarah',
    tags: ['dua', 'daily'],
  },
  {
    type: 'DUA',
    arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
    transliteration: "Allahumma a'inni 'ala dhikrika wa shukrika wa husni 'ibadatik",
    translation:
      'O Allah, help me to remember You, to thank You, and to worship You in the best manner.',
    reference: "Sunan Abu Dawud 1522",
    source: 'Taught by the Prophet ﷺ to Mu\'adh ibn Jabal · Authentic',
    tags: ['dua', 'worship'],
  },
  {
    type: 'DUA',
    arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي',
    transliteration: 'Rabbish-rahli sadri wa yassir li amri',
    translation: 'My Lord, expand for me my chest and make my task easy for me.',
    reference: "Qur'an 20:25–26",
    source: 'Surah Ta-Ha',
    tags: ['dua', 'ease', 'work'],
  },
]

export async function seedContent(prisma: PrismaClient) {
  for (const item of DAILY_CONTENT) {
    const existing = await prisma.dailyContent.findFirst({
      where: { reference: item.reference, translation: item.translation, locale: 'en' },
      select: { id: true },
    })

    if (existing) {
      await prisma.dailyContent.update({
        where: { id: existing.id },
        data: { ...item, locale: 'en', isActive: true },
      })
    } else {
      await prisma.dailyContent.create({ data: { ...item, locale: 'en' } })
    }
  }

  return prisma.dailyContent.count()
}
