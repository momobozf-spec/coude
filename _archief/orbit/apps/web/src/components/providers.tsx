'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from './theme/theme-provider';

/**
 * Eén QueryClient per browsertab, aangemaakt in state zodat hij een
 * Server-Side-Render-pas overleeft zonder tussen gebruikers te lekken.
 *
 * De instellingen zijn afgestemd op offline-first: data blijft lang geldig,
 * refetch bij focus is uit (de sync-engine duwt zelf wijzigingen binnen), en
 * mutaties worden niet automatisch herhaald omdat de outbox dat al doet.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 24 * 60 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              // Niet blijven proberen op fouten die niet vanzelf overgaan.
              const status = (error as { status?: number }).status;
              if (status && status >= 400 && status < 500 && status !== 429) return false;
              return failureCount < 3;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
