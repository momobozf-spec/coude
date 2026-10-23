export const PRAYER_META = [
  { key: 'fajr',    name: 'Fajr',       arabic: 'الفجر',   icon: '🌙', color: '#4a6fa5' },
  { key: 'sunrise', name: 'Zonsopgang', arabic: 'الشروق',  icon: '🌅', color: '#e8956b' },
  { key: 'dhuhr',   name: 'Dhuhr',      arabic: 'الظهر',   icon: '☀️', color: '#e8c97a' },
  { key: 'asr',     name: 'Asr',        arabic: 'العصر',   icon: '🌤', color: '#7ec8a0' },
  { key: 'maghrib', name: 'Maghrib',    arabic: 'المغرب',  icon: '🌇', color: '#c97a7a' },
  { key: 'isha',    name: 'Isha',       arabic: 'العشاء',  icon: '🌃', color: '#7a8fc9' },
] as const;

export type PrayerKey = typeof PRAYER_META[number]['key'];

export const CALCULATION_METHODS = [
  { key: 'MuslimWorldLeague',     label: 'Muslim World League',        region: 'Internationaal' },
  { key: 'Egyptian',              label: 'Egyptisch Instituut',        region: 'Egypte'         },
  { key: 'Karachi',               label: 'Univ. van Karachi',          region: 'Pakistan'       },
  { key: 'UmmAlQura',             label: 'Umm Al-Qura',                region: 'Saudi-Arabië'   },
  { key: 'Dubai',                 label: 'Dubai',                      region: 'VAE'            },
  { key: 'MoonsightingCommittee', label: 'Moonsighting Committee',     region: 'Internationaal' },
  { key: 'NorthAmerica',          label: 'ISNA',                       region: 'Noord-Amerika'  },
  { key: 'Kuwait',                label: 'Kuwait',                     region: 'Koeweit'        },
  { key: 'Qatar',                 label: 'Qatar',                      region: 'Qatar'          },
  { key: 'Singapore',             label: 'MUIS',                       region: 'Singapore'      },
  { key: 'Turkey',                label: 'Diyanet',                    region: 'Turkije'        },
  { key: 'Tehran',                label: 'Inst. Teheran',              region: 'Iran'           },
] as const;

export const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabi ul-Awwal', 'Rabi ul-Akhir',
  'Jumada ul-Awwal', 'Jumada ul-Akhir', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah',
];
