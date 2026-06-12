export const gameText: Record<string, Record<string, string>> = {
  en: {
    play: "Play", pause: "Pause", restart: "Restart", score: "Score", lives: "Lives",
    level: "Level", gameOver: "Game Over!", wellDone: "Well done!", catchThe: "Catch:",
    layers: "Layers", perfect: "Perfect!", newBest: "New Personal Best!",
    tapToStart: "Tap to Start", matches: "Matches", moves: "Moves", time: "Time",
    combo: "Combo", missed: "Missed", backToHub: "Back to Games",
  },
  nl: {
    play: "Speel", pause: "Pauze", restart: "Opnieuw", score: "Score", lives: "Levens",
    level: "Level", gameOver: "Game Over!", wellDone: "Goed gedaan!", catchThe: "Vang:",
    layers: "Lagen", perfect: "Perfect!", newBest: "Nieuw Record!",
    tapToStart: "Tik om te starten", matches: "Matches", moves: "Zetten", time: "Tijd",
    combo: "Combo", missed: "Gemist", backToHub: "Terug naar Games",
  },
  fr: {
    play: "Jouer", pause: "Pause", restart: "Recommencer", score: "Score", lives: "Vies",
    level: "Niveau", gameOver: "Fin du jeu!", wellDone: "Bien joué!", catchThe: "Attrape:",
    layers: "Couches", perfect: "Parfait!", newBest: "Nouveau Record!",
    tapToStart: "Appuyez pour commencer", matches: "Paires", moves: "Coups", time: "Temps",
    combo: "Combo", missed: "Raté", backToHub: "Retour aux jeux",
  },
  ar: {
    play: "العب", pause: "إيقاف", restart: "إعادة", score: "النقاط", lives: "الأرواح",
    level: "المستوى", gameOver: "!انتهت اللعبة", wellDone: "!أحسنت", catchThe: ":امسك",
    layers: "الطبقات", perfect: "!ممتاز", newBest: "!رقم قياسي جديد",
    tapToStart: "انقر للبدء", matches: "التطابقات", moves: "الحركات", time: "الوقت",
    combo: "كومبو", missed: "فائت", backToHub: "العودة للألعاب",
  },
};

export function getGameText(lang = "en") {
  return gameText[lang] || gameText.en;
}
