import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ShoppingListDetailDto, ShoppingListItemDto } from '@superrette/validation';
import { useSession } from '../state/session';
import { API_URL } from './config';

export interface LiveActivity {
  id: string;
  type: string;
  userDisplayName: string | null;
  payload: Record<string, unknown>;
}

/**
 * Subscribe to realtime changes of a shared list. Server events patch the
 * React Query cache so everyone sees additions/check-offs instantly.
 */
export function useListRealtime(listId: string | undefined): { connected: boolean; lastActivity: LiveActivity | null } {
  const { client, user } = useSession();
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastActivity, setLastActivity] = useState<LiveActivity | null>(null);

  useEffect(() => {
    if (!listId || !user) return;
    let socket: Socket | null = null;
    let cancelled = false;
    void client.accessToken().then((token) => {
      if (cancelled || !token) return;
      socket = io(`${API_URL}/realtime`, { auth: { token }, transports: ['websocket'] });
      socket.on('connect', () => {
        setConnected(true);
        socket?.emit('list.join', { listId });
      });
      socket.on('disconnect', () => setConnected(false));
      const key = ['list', listId];
      socket.on('item.upserted', (e: { item: ShoppingListItemDto }) => {
        qc.setQueryData<ShoppingListDetailDto>(key, (prev) => {
          if (!prev) return prev;
          const exists = prev.items.some((i) => i.id === e.item.id);
          // Never overwrite a newer local version with an older event.
          const items = exists ? prev.items.map((i) => (i.id === e.item.id && i.version <= e.item.version ? e.item : i)) : [...prev.items, e.item];
          return { ...prev, items };
        });
      });
      socket.on('item.deleted', (e: { itemId: string }) => {
        qc.setQueryData<ShoppingListDetailDto>(key, (prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== e.itemId) } : prev));
      });
      socket.on('list.updated', () => void qc.invalidateQueries({ queryKey: ['compare', listId] }));
      socket.on('member.joined', () => void qc.invalidateQueries({ queryKey: key }));
      socket.on('activity', (a: LiveActivity & { actorId?: string }) => {
        if (a.actorId !== user.id) setLastActivity(a);
      });
    });
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [listId, user, client, qc]);

  return { connected, lastActivity };
}
