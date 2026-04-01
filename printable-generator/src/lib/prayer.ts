// Prayer time calculation using the standard astronomical algorithms
// Based on praytimes.org methodology

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Calculation methods
export const METHODS = {
  MWL: { name: "Muslim World League", fajrAngle: 18, ishaAngle: 17 },
  ISNA: { name: "ISNA (North America)", fajrAngle: 15, ishaAngle: 15 },
  Egypt: { name: "Egyptian General Authority", fajrAngle: 19.5, ishaAngle: 17.5 },
  Makkah: { name: "Umm al-Qura (Makkah)", fajrAngle: 18.5, ishaAngle: 0, ishaMinutes: 90 },
  Karachi: { name: "University of Islamic Sciences, Karachi", fajrAngle: 18, ishaAngle: 18 },
  Tehran: { name: "Institute of Geophysics, Tehran", fajrAngle: 17.7, ishaAngle: 14 },
  Turkey: { name: "Diyanet (Turkey)", fajrAngle: 18, ishaAngle: 17 },
} as const;

export type MethodKey = keyof typeof METHODS;

interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

interface SunPosition {
  declination: number;
  equation: number;
}

function sunPosition(jd: number): SunPosition {
  const D = jd - 2451545.0;
  const g = (357.529 + 0.98560028 * D) % 360;
  const q = (280.459 + 0.98564736 * D) % 360;
  const L = (q + 1.915 * Math.sin(g * DEG) + 0.020 * Math.sin(2 * g * DEG)) % 360;
  const e = 23.439 - 0.00000036 * D;
  const RA = Math.atan2(Math.cos(e * DEG) * Math.sin(L * DEG), Math.cos(L * DEG)) * RAD;
  const declination = Math.asin(Math.sin(e * DEG) * Math.sin(L * DEG)) * RAD;
  const equation = q / 15 - RA / 15 + (RA > 180 ? 24 : 0) - (q > 180 ? 24 : 0);
  return { declination, equation: equation > 12 ? equation - 24 : equation };
}

function julianDate(year: number, month: number, day: number): number {
  if (month <= 2) { year--; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function midDay(jd: number, lng: number): number {
  const eq = sunPosition(jd).equation;
  return 12 - eq - lng / 15;
}

function sunAngleTime(jd: number, angle: number, lat: number, lng: number, direction: "ccw" | "cw"): number {
  const sun = sunPosition(jd);
  const mid = midDay(jd, lng);
  const decl = sun.declination;
  const t = Math.acos(
    (-Math.sin(angle * DEG) - Math.sin(lat * DEG) * Math.sin(decl * DEG)) /
    (Math.cos(lat * DEG) * Math.cos(decl * DEG))
  ) * RAD / 15;
  return mid + (direction === "ccw" ? -t : t);
}

function asrTime(jd: number, lat: number, lng: number, factor = 1): number {
  const sun = sunPosition(jd);
  const mid = midDay(jd, lng);
  const decl = sun.declination;
  const angle = Math.atan(1 / (factor + Math.tan(Math.abs(lat - decl) * DEG))) * RAD;
  return sunAngleTime(jd, angle, lat, lng, "cw");
}

function formatTime(hours: number): string {
  hours = hours % 24;
  if (hours < 0) hours += 24;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function calculatePrayerTimes(
  lat: number,
  lng: number,
  date: Date = new Date(),
  method: MethodKey = "MWL"
): PrayerTimes {
  const m = METHODS[method];
  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const tz = -date.getTimezoneOffset() / 60;

  const fajr = sunAngleTime(jd, m.fajrAngle, lat, lng, "ccw") + tz;
  const sunrise = sunAngleTime(jd, 0.833, lat, lng, "ccw") + tz;
  const dhuhr = midDay(jd, lng) + tz + 1 / 60; // 1 min safety
  const asr = asrTime(jd, lat, lng) + tz;
  const maghrib = sunAngleTime(jd, 0.833, lat, lng, "cw") + tz;

  let isha: number;
  if ("ishaMinutes" in m && m.ishaMinutes) {
    isha = maghrib + m.ishaMinutes / 60;
  } else {
    isha = sunAngleTime(jd, m.ishaAngle, lat, lng, "cw") + tz;
  }

  return {
    fajr: formatTime(fajr),
    sunrise: formatTime(sunrise),
    dhuhr: formatTime(dhuhr),
    asr: formatTime(asr),
    maghrib: formatTime(maghrib),
    isha: formatTime(isha),
  };
}

// Qibla direction calculation
export function calculateQibla(lat: number, lng: number): number {
  // Kaaba coordinates
  const kaabaLat = 21.4225;
  const kaabaLng = 39.8262;

  const phiK = kaabaLat * DEG;
  const lambdaK = kaabaLng * DEG;
  const phi = lat * DEG;
  const lambda = lng * DEG;

  const qibla = Math.atan2(
    Math.sin(lambdaK - lambda),
    Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda)
  ) * RAD;

  return (qibla + 360) % 360;
}

// Distance to Mecca
export function distanceToMecca(lat: number, lng: number): number {
  const R = 6371; // Earth radius km
  const dLat = (21.4225 - lat) * DEG;
  const dLng = (39.8262 - lng) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * DEG) * Math.cos(21.4225 * DEG) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get next prayer from current time
export function getNextPrayer(times: PrayerTimes): { name: string; time: string; isNow: boolean } | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const prayers = [
    { name: "Fajr", time: times.fajr },
    { name: "Sunrise", time: times.sunrise },
    { name: "Dhuhr", time: times.dhuhr },
    { name: "Asr", time: times.asr },
    { name: "Maghrib", time: times.maghrib },
    { name: "Isha", time: times.isha },
  ];

  for (const prayer of prayers) {
    const [h, m] = prayer.time.split(":").map(Number);
    const prayerMinutes = h * 60 + m;
    if (prayerMinutes > currentMinutes) {
      return { ...prayer, isNow: false };
    }
  }

  // After Isha — next is tomorrow's Fajr
  return { name: "Fajr", time: times.fajr, isNow: false };
}
