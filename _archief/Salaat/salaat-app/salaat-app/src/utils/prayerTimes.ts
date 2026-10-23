import * as Adhan from 'adhan';
import { HIJRI_MONTHS, PrayerKey } from '../constants/prayers';

export interface PrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

export function calculatePrayerTimes(
  lat: number,
  lng: number,
  method: string,
  date: Date = new Date()
): PrayerTimes {
  const coords = new Adhan.Coordinates(lat, lng);
  const methodFn = (Adhan.CalculationMethod as any)[method];
  const params = methodFn ? methodFn() : Adhan.CalculationMethod.MuslimWorldLeague();
  const pt = new Adhan.PrayerTimes(coords, date, params);
  return {
    fajr:    pt.fajr,
    sunrise: pt.sunrise,
    dhuhr:   pt.dhuhr,
    asr:     pt.asr,
    maghrib: pt.maghrib,
    isha:    pt.isha,
  };
}

export interface NextPrayerInfo {
  key: PrayerKey;
  time: Date;
  msRemaining: number;
  isTomorrow: boolean;
}

export function getNextPrayer(
  times: PrayerTimes,
  lat: number,
  lng: number,
  method: string
): NextPrayerInfo {
  const now = new Date();
  const order: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

  for (const key of order) {
    if (now < times[key]) {
      return {
        key,
        time: times[key],
        msRemaining: times[key].getTime() - now.getTime(),
        isTomorrow: false,
      };
    }
  }

  // After Isha — get tomorrow's Fajr
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowTimes = calculatePrayerTimes(lat, lng, method, tomorrow);
  return {
    key: 'fajr',
    time: tomorrowTimes.fajr,
    msRemaining: tomorrowTimes.fajr.getTime() - now.getTime(),
    isTomorrow: true,
  };
}

export function getCurrentPrayerKey(times: PrayerTimes): PrayerKey {
  const now = new Date();
  const order: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  let current: PrayerKey = 'isha';
  for (let i = 0; i < order.length; i++) {
    if (now < times[order[i]]) {
      current = i === 0 ? 'isha' : order[i - 1];
      break;
    }
  }
  return current;
}

export function formatTime(date: Date, use24h: boolean): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  if (use24h) return `${h.toString().padStart(2, '0')}:${m}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${m} ${ampm}`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':');
}

export function toHijriDate(date: Date): string {
  const JD = Math.floor(date.getTime() / 86400000 + 2440587.5);
  let l = JD - 1948440 + 10632;
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
  return `${day} ${HIJRI_MONTHS[month - 1]} ${year} H`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'SalaatApp/1.0' } }
    );
    const data = await res.json();
    const a = data.address;
    return a.city || a.town || a.village || a.county || a.country || '';
  } catch {
    return '';
  }
}
