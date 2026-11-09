import type { Translator } from '@/i18n'
import type { Rhythm } from '@/lib/learn/rhythm'

/** One sentence telling the member where their learning rhythm stands. */
export function rhythmLine(tr: Translator, rhythm: Rhythm): string {
  if (rhythm.current === 0) return tr('learn.rhythmNone')
  if (rhythm.learnedToday) return tr('learn.rhythmToday')
  if (rhythm.daysLeft === 0) return tr('learn.rhythmLastDay')
  return tr('learn.rhythmLeft', { days: rhythm.daysLeft ?? 0 })
}
