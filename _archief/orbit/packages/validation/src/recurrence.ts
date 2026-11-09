import { RecurrenceFreq, type RecurrenceRule } from '@orbit/types';
import { z } from 'zod';
import { recurrenceAnchorSchema, recurrenceFreqSchema, weekdaySchema } from './enums';
import { isoDateSchema } from './primitives';

export const recurrenceRuleSchema: z.ZodType<RecurrenceRule> = z
  .object({
    freq: recurrenceFreqSchema,
    interval: z.number().int().min(1).max(365),
    byWeekday: z.array(weekdaySchema).min(1).max(7).optional(),
    byMonthDay: z.array(z.number().int().min(-31).max(31).refine((n) => n !== 0)).min(1).max(31).optional(),
    byMonth: z.array(z.number().int().min(1).max(12)).min(1).max(12).optional(),
    until: isoDateSchema.optional(),
    count: z.number().int().min(1).max(1000).optional(),
    anchor: recurrenceAnchorSchema,
  })
  .superRefine((rule, ctx) => {
    if (rule.until && rule.count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['until'],
        message: 'Kies een einddatum of een aantal herhalingen, niet allebei',
      });
    }
    if (rule.byWeekday && rule.freq !== RecurrenceFreq.Weekly) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['byWeekday'],
        message: 'Weekdagen kunnen alleen bij een wekelijkse herhaling',
      });
    }
    if (rule.byMonthDay && rule.freq !== RecurrenceFreq.Monthly) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['byMonthDay'],
        message: 'Maanddagen kunnen alleen bij een maandelijkse herhaling',
      });
    }
    if (rule.byMonth && rule.freq !== RecurrenceFreq.Yearly) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['byMonth'],
        message: 'Maanden kunnen alleen bij een jaarlijkse herhaling',
      });
    }
  });
