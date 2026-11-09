'use client';

import { useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { serviceWorkerUrl, shouldRegisterServiceWorker } from '@/lib/service-worker';

/** Registreert de service worker (app-schil + offlinepagina), alleen in productie. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    const ok = shouldRegisterServiceWorker({
      nodeEnv: process.env.NODE_ENV,
      supported: 'serviceWorker' in navigator,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    });
    if (!ok) return;
    navigator.serviceWorker.register(serviceWorkerUrl(API_BASE_URL), { scope: '/' }).catch(() => {
      // Geen worker = gewoon geen offline-schil; de app werkt verder.
    });
  }, []);
  return null;
}
