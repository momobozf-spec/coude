const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabi\' ul-Awwal', 'Rabi\' ul-Akhir',
  'Jumada ul-Awwal', 'Jumada ul-Akhir', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah',
];

const HIJRI_MONTHS_AR = [
  'مُحَرَّم', 'صَفَر', 'رَبِيعُ الأَوَّل', 'رَبِيعُ الآخِر',
  'جُمَادَى الأُولَى', 'جُمَادَى الآخِرَة', 'رَجَب', 'شَعْبَان',
  'رَمَضَان', 'شَوَّال', 'ذُو القَعْدَة', 'ذُو الحِجَّة',
];

export interface HijriDate {
  day: number;
  month: number;
  year: number;
  monthName: string;
  monthNameAr: string;
  formatted: string;
  formattedAr: string;
}

export function toHijri(date: Date): HijriDate {
  const JD = Math.floor(date.getTime() / 86400000) + 2440587.5;
  let l = Math.floor(JD) - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  const monthName = HIJRI_MONTHS[month - 1];
  const monthNameAr = HIJRI_MONTHS_AR[month - 1];

  return {
    day,
    month,
    year,
    monthName,
    monthNameAr,
    formatted: `${day} ${monthName} ${year} H`,
    formattedAr: `${day} ${monthNameAr} ${year}`,
  };
}

export function isRamadan(date: Date): boolean {
  return toHijri(date).month === 9;
}

const NL_WEEKDAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const NL_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
                   'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export function formatGregorian(date: Date): string {
  return `${NL_WEEKDAYS[date.getDay()]} ${date.getDate()} ${NL_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
