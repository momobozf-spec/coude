/**
 * Habit templates.
 *
 * Suggestions, never auto-created. A user who arrives to twelve pre-made habits
 * they did not choose has been handed someone else's routine, and the first thing
 * they do is delete them. Onboarding offers these; the user picks.
 */

export interface HabitTemplate {
  key: string
  name: string
  description: string
  category: 'WORSHIP' | 'HEALTH' | 'LEARNING' | 'FAMILY' | 'WORK' | 'CHARITY' | 'PERSONAL'
  icon: string
  color: string
  type: 'BOOLEAN' | 'COUNTER' | 'DURATION'
  targetValue: number
  unit: string | null
  frequencyType: 'DAILY' | 'SPECIFIC_DAYS' | 'TIMES_PER_WEEK'
  targetPerPeriod: number
  daysOfWeek: number[]
  preferredTimeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY'
}

export const HABIT_TEMPLATE_GROUPS: {
  key: string
  label: string
  templates: HabitTemplate[]
}[] = [
  {
    key: 'worship',
    label: 'Worship',
    templates: [
      {
        key: 'quran',
        name: 'Read Qur’an',
        description: 'A set number of pages each day.',
        category: 'WORSHIP',
        icon: 'book-open',
        color: 'emerald',
        type: 'COUNTER',
        targetValue: 5,
        unit: 'pages',
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'MORNING',
      },
      {
        key: 'morning-adhkar',
        name: 'Morning adhkar',
        description: 'The remembrances after Fajr.',
        category: 'WORSHIP',
        icon: 'sunrise',
        color: 'gold',
        type: 'BOOLEAN',
        targetValue: 1,
        unit: null,
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'MORNING',
      },
      {
        key: 'evening-adhkar',
        name: 'Evening adhkar',
        description: 'The remembrances before sunset.',
        category: 'WORSHIP',
        icon: 'sunset',
        color: 'gold',
        type: 'BOOLEAN',
        targetValue: 1,
        unit: null,
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'EVENING',
      },
      {
        key: 'dhikr',
        name: 'Dhikr',
        description: 'A daily count of remembrance.',
        category: 'WORSHIP',
        icon: 'heart',
        color: 'emerald',
        type: 'COUNTER',
        targetValue: 100,
        unit: 'times',
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'ANY',
      },
      {
        key: 'islamic-study',
        name: 'Islamic study',
        description: 'Time set aside to learn.',
        category: 'WORSHIP',
        icon: 'graduation-cap',
        color: 'emerald',
        type: 'DURATION',
        targetValue: 20,
        unit: 'minutes',
        frequencyType: 'TIMES_PER_WEEK',
        targetPerPeriod: 4,
        daysOfWeek: [],
        preferredTimeOfDay: 'EVENING',
      },
      {
        key: 'sadaqah',
        name: 'Give sadaqah',
        description: 'Something small, given regularly.',
        category: 'CHARITY',
        icon: 'hand-heart',
        color: 'gold',
        type: 'BOOLEAN',
        targetValue: 1,
        unit: null,
        frequencyType: 'TIMES_PER_WEEK',
        targetPerPeriod: 3,
        daysOfWeek: [],
        preferredTimeOfDay: 'ANY',
      },
    ],
  },
  {
    key: 'health',
    label: 'Health',
    templates: [
      {
        key: 'walk',
        name: 'Walk',
        description: 'Get outside and move.',
        category: 'HEALTH',
        icon: 'footprints',
        color: 'emerald',
        type: 'DURATION',
        targetValue: 30,
        unit: 'minutes',
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'ANY',
      },
      {
        key: 'workout',
        name: 'Workout',
        description: 'Strength or cardio session.',
        category: 'HEALTH',
        icon: 'dumbbell',
        color: 'emerald',
        type: 'BOOLEAN',
        targetValue: 1,
        unit: null,
        frequencyType: 'SPECIFIC_DAYS',
        targetPerPeriod: 3,
        daysOfWeek: [1, 3, 5],
        preferredTimeOfDay: 'MORNING',
      },
      {
        key: 'water',
        name: 'Drink water',
        description: 'Eight glasses through the day.',
        category: 'HEALTH',
        icon: 'droplet',
        color: 'emerald',
        type: 'COUNTER',
        targetValue: 8,
        unit: 'glasses',
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'ANY',
      },
      {
        key: 'sleep-routine',
        name: 'Sleep before 23:00',
        description: 'Protect Fajr by protecting the night before.',
        category: 'HEALTH',
        icon: 'moon',
        color: 'emerald',
        type: 'BOOLEAN',
        targetValue: 1,
        unit: null,
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'EVENING',
      },
    ],
  },
  {
    key: 'personal',
    label: 'Personal',
    templates: [
      {
        key: 'read',
        name: 'Read',
        description: 'Twenty minutes of reading.',
        category: 'LEARNING',
        icon: 'book',
        color: 'emerald',
        type: 'DURATION',
        targetValue: 20,
        unit: 'minutes',
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'EVENING',
      },
      {
        key: 'journal',
        name: 'Journal',
        description: 'A few lines about the day.',
        category: 'PERSONAL',
        icon: 'pen-line',
        color: 'emerald',
        type: 'BOOLEAN',
        targetValue: 1,
        unit: null,
        frequencyType: 'TIMES_PER_WEEK',
        targetPerPeriod: 4,
        daysOfWeek: [],
        preferredTimeOfDay: 'EVENING',
      },
      {
        key: 'learn',
        name: 'Learn something',
        description: 'A course, a language, a skill.',
        category: 'LEARNING',
        icon: 'lightbulb',
        color: 'emerald',
        type: 'DURATION',
        targetValue: 25,
        unit: 'minutes',
        frequencyType: 'TIMES_PER_WEEK',
        targetPerPeriod: 5,
        daysOfWeek: [],
        preferredTimeOfDay: 'ANY',
      },
      {
        key: 'family-time',
        name: 'Family time',
        description: 'Undistracted time with the people at home.',
        category: 'FAMILY',
        icon: 'users',
        color: 'emerald',
        type: 'BOOLEAN',
        targetValue: 1,
        unit: null,
        frequencyType: 'DAILY',
        targetPerPeriod: 7,
        daysOfWeek: [],
        preferredTimeOfDay: 'EVENING',
      },
    ],
  },
]

export const HABIT_TEMPLATES: HabitTemplate[] = HABIT_TEMPLATE_GROUPS.flatMap(
  (group) => group.templates,
)

export function findTemplate(key: string): HabitTemplate | undefined {
  return HABIT_TEMPLATES.find((template) => template.key === key)
}
