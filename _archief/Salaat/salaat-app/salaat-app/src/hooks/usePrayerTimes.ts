import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PrayerTimes, NextPrayerInfo,
  calculatePrayerTimes, getNextPrayer,
  getCurrentPrayerKey, reverseGeocode,
} from '../utils/prayerTimes';
import { PrayerKey } from '../constants/prayers';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface HookState {
  status: AppStatus;
  error: string | null;
  lat: number | null;
  lng: number | null;
  cityName: string;
  prayerTimes: PrayerTimes | null;
  nextPrayer: NextPrayerInfo | null;
  currentPrayer: PrayerKey | null;
  countdown: string;
  method: string;
  use24h: boolean;
}

const SK = {
  method: '@salaat_method',
  use24h: '@salaat_24h',
  city:   '@salaat_city',
  lat:    '@salaat_lat',
  lng:    '@salaat_lng',
};

export function usePrayerTimes() {
  const [s, setS] = useState<HookState>({
    status: 'idle', error: null,
    lat: null, lng: null, cityName: '',
    prayerTimes: null, nextPrayer: null, currentPrayer: null,
    countdown: '--:--:--', method: 'MuslimWorldLeague', use24h: true,
  });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msRef   = useRef(0);

  useEffect(() => {
    AsyncStorage.multiGet([SK.method, SK.use24h]).then(pairs => {
      const method = pairs[0][1] || 'MuslimWorldLeague';
      const use24h = pairs[1][1] !== 'false';
      setS(p => ({ ...p, method, use24h }));
    });
  }, []);

  const recalculate = useCallback((lat: number, lng: number, method: string) => {
    const times = calculatePrayerTimes(lat, lng, method);
    const next  = getNextPrayer(times, lat, lng, method);
    const curr  = getCurrentPrayerKey(times);
    msRef.current = next.msRemaining;
    setS(p => ({ ...p, status: 'ready', prayerTimes: times, nextPrayer: next, currentPrayer: curr }));
  }, []);

  useEffect(() => {
    if (s.status !== 'ready' || !s.lat || !s.lng) return;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      msRef.current = Math.max(0, msRef.current - 1000);
      const h = Math.floor(msRef.current / 3600000);
      const m = Math.floor((msRef.current % 3600000) / 60000);
      const sec = Math.floor((msRef.current % 60000) / 1000);
      const cd = [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
      setS(p => ({ ...p, countdown: cd }));
      if (msRef.current === 0 && s.lat && s.lng) recalculate(s.lat, s.lng, s.method);
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [s.status, s.lat, s.lng, s.method, recalculate]);

  const requestLocation = useCallback(async () => {
    setS(p => ({ ...p, status: 'loading', error: null }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setS(p => ({ ...p, status: 'error', error: 'Locatietoegang geweigerd. Ga naar instellingen.' }));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const [cachedCity, cachedLat, cachedLng] = await AsyncStorage.multiGet([SK.city, SK.lat, SK.lng])
        .then(p => p.map(v => v[1]));
      const dist = cachedLat && cachedLng
        ? Math.sqrt((lat - parseFloat(cachedLat))**2 + (lng - parseFloat(cachedLng))**2) : 999;
      let city = (dist < 0.05 && cachedCity) ? cachedCity : await reverseGeocode(lat, lng);
      if (dist >= 0.05) {
        await AsyncStorage.multiSet([[SK.city, city], [SK.lat, String(lat)], [SK.lng, String(lng)]]);
      }
      const method = await AsyncStorage.getItem(SK.method) || 'MuslimWorldLeague';
      setS(p => ({ ...p, lat, lng, cityName: city, method }));
      recalculate(lat, lng, method);
    } catch (e: any) {
      setS(p => ({ ...p, status: 'error', error: e.message || 'Onbekende fout.' }));
    }
  }, [recalculate]);

  const setMethod = useCallback(async (method: string) => {
    await AsyncStorage.setItem(SK.method, method);
    setS(p => ({ ...p, method }));
    if (s.lat && s.lng) recalculate(s.lat, s.lng, method);
  }, [s.lat, s.lng, recalculate]);

  const setUse24h = useCallback(async (use24h: boolean) => {
    await AsyncStorage.setItem(SK.use24h, String(use24h));
    setS(p => ({ ...p, use24h }));
  }, []);

  return { ...s, requestLocation, setMethod, setUse24h };
}
