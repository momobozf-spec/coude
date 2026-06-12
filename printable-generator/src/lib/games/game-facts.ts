export const GAME_FACTS: Record<string, string[]> = {
  memory: [
    "The crescent moon and star are symbols associated with Islam and appear on many Muslim country flags.",
    "Tasbih (prayer beads) are used to count dhikr — usually 33 or 99 beads.",
    "The Quran was revealed to Prophet Muhammad ﷺ over 23 years through the angel Jibreel.",
    "The Ka'bah in Mecca is considered the holiest site in Islam.",
    "Islamic geometric patterns represent infinite creation and are found in mosques worldwide.",
    "There are over 1.8 billion Muslims in the world today.",
    "The five daily prayers are: Fajr, Dhuhr, Asr, Maghrib, and Isha.",
    "Muslims fast during the month of Ramadan from sunrise to sunset.",
    "Zakat (charity) is one of the Five Pillars of Islam.",
    "The word 'Islam' means 'submission to the will of God'.",
  ],
  arabic: [
    "Arabic is written from right to left.",
    "The Arabic alphabet has 28 letters — all consonants.",
    "Arabic is spoken by over 300 million people worldwide.",
    "The first word revealed in the Quran was 'Iqra' (اقرأ) meaning 'Read'.",
    "Arabic letters change shape depending on their position in a word.",
    "The Quran is always recited in Arabic, regardless of a Muslim's native language.",
    "Arabic is one of the six official languages of the United Nations.",
    "Many English words come from Arabic: algebra, algorithm, coffee, sugar.",
    "Arabic calligraphy is considered one of the highest forms of Islamic art.",
    "The Arabic word 'Allah' means 'The God' — Al (the) + Ilah (god).",
  ],
  kaaba: [
    "The Ka'bah was built by Prophet Ibrahim (AS) and his son Ismail (AS).",
    "Muslims circle the Ka'bah 7 times during Hajj — this is called Tawaf.",
    "The Black Stone (Hajr al-Aswad) is set in the eastern corner of the Ka'bah.",
    "The Ka'bah is covered with a black cloth called the Kiswah, replaced every year.",
    "Over 2 million Muslims visit the Ka'bah during Hajj each year.",
    "The Ka'bah is approximately 15 meters (50 feet) tall.",
    "The door of the Ka'bah is made of solid gold and weighs 280 kg.",
    "The area around the Ka'bah is called the Masjid al-Haram.",
    "Prophet Muhammad ﷺ placed the Black Stone back in the Ka'bah before prophethood.",
    "The Ka'bah has been rebuilt several times throughout history.",
  ],
};

export function getRandomFact(game: string): string {
  const facts = GAME_FACTS[game] || GAME_FACTS.memory;
  return facts[Math.floor(Math.random() * facts.length)];
}
