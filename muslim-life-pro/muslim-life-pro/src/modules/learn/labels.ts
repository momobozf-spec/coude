import type { Translator } from '@/i18n'
import type { GameLabels } from '@/modules/learn/games'
import type { LessonPlayerLabels } from '@/modules/learn/lesson-player'
import type { Exercise } from '@/lib/learn/lesson-schema'
import type { LearnerView } from '@/server/modules/learn/learner.service'

/**
 * Server-side label builders for the learn screens. Templates keep their
 * `{name}` placeholders (`getTranslator` leaves unknown tokens in place) so the
 * client components can fill them with live numbers.
 */

export function levelName(tr: Translator, level: number): string {
  if (level >= 3) return tr('learn.levelDeep')
  if (level === 2) return tr('learn.levelAdvanced')
  return tr('learn.levelStarter')
}

export function ageGroupName(tr: Translator, ageGroup: LearnerView['ageGroup']): string {
  if (ageGroup === 'KIDS') return tr('learn.ageKids')
  if (ageGroup === 'TEENS') return tr('learn.ageTeens')
  return tr('learn.ageAdults')
}

/** Name of a game type, for the chips on a lesson card. Plain questions have none. */
export function gameName(tr: Translator, type: Exercise['type'], kids: boolean): string | null {
  switch (type) {
    case 'match':
      return kids ? tr('learn.gameMemory') : tr('learn.gameMatch')
    case 'wordbuild':
      return tr('learn.gameWordbuild')
    case 'quickfire':
      return tr('learn.gameQuickfire')
    case 'order':
      return tr('learn.gameOrder')
    default:
      return null
  }
}

export function gameLabels(tr: Translator): GameLabels {
  return {
    true: tr('learn.true'),
    false: tr('learn.false'),
    orderHint: tr('learn.orderHint'),
    reset: tr('learn.reset'),
    matchHint: tr('learn.matchHint'),
    memoryHint: tr('learn.memoryHint'),
    memoryDone: tr('learn.memoryDone', { moves: '{moves}' }),
    wordHint: tr('learn.wordHint'),
    clue: tr('learn.clue'),
    quickfireIntro: tr('learn.quickfireIntro', { count: '{count}', seconds: '{seconds}' }),
    quickfireStart: tr('learn.quickfireStart'),
    timeLeft: tr('learn.timeLeft', { seconds: '{seconds}' }),
    timeUp: tr('learn.timeUp'),
    quickfireScore: tr('learn.quickfireScore', { right: '{right}', total: '{total}' }),
  }
}

export function playerLabels(tr: Translator): LessonPlayerLabels {
  return {
    ...gameLabels(tr),
    draftBadge: tr('learn.draftBadge'),
    draftNotice: tr('learn.draftNotice'),
    englishFallback: tr('learn.englishFallback'),
    minutes: tr('learn.minutes', { minutes: '{minutes}' }),
    readFirst: tr('learn.readFirst'),
    toQuestions: tr('learn.toQuestions'),
    sources: tr('learn.sources'),
    question: tr('learn.question', { current: '{current}', total: '{total}' }),
    check: tr('learn.check'),
    correct: tr('learn.correct'),
    incorrect: tr('learn.incorrect'),
    continue: tr('learn.continue'),
    finish: tr('learn.finish'),
    saving: tr('learn.saving'),
    resultTitle: tr('learn.resultTitle'),
    resultScore: tr('learn.resultScore', { correct: '{correct}', total: '{total}' }),
    xpEarned: tr('learn.xpEarned', { xp: '{xp}' }),
    noXpReplay: tr('learn.noXpReplay'),
    rhythmDays: tr('learn.rhythmDays', { days: '{days}' }),
    rhythmHint: tr('learn.rhythmHint'),
    next: tr('learn.next'),
    backToPath: tr('learn.backToPath'),
    errorSave: tr('learn.errorSave'),
    limitReached: tr('learn.limitReached'),
    upgrade: tr('common.upgrade'),
    levelUp: tr('learn.levelUp', { level: '{level}' }),
    levelNames: [1, 2, 3].map((level) => levelName(tr, level)),
  }
}
