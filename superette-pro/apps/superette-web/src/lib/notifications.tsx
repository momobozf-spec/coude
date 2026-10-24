'use client';

/**
 * Ongelezen in-app meldingen, voor het badge in de navigatie. Haalt ze op
 * zodra er een sessie is en ververst elke minuut; pagina's kunnen `refresh`
 * aanroepen na "als gelezen markeren".
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AlertNotification } from '@superette/contracts';
import { api } from './api';
import { useAuth } from './auth';

interface NotificationsValue {
  notifications: AlertNotification[] | null;
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

const REFRESH_MS = 60_000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AlertNotification[] | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications(null);
      return;
    }
    try {
      setNotifications(await api.notifications());
    } catch {
      // Een mislukte verversing is geen reden om de rest van de app te storen.
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    if (!user) return;
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [user, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      await api.markNotificationRead(id);
      setNotifications((current) => current?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? null);
    },
    [],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications?.filter((n) => n.readAt === null).length ?? 0,
      refresh,
      markRead,
    }),
    [notifications, refresh, markRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications moet binnen <NotificationsProvider> gebruikt worden');
  return value;
}
