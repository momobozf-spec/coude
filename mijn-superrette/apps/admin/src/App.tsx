import { useState, type ReactNode } from 'react';
import type { AdminStatsDto } from '@superrette/validation';
import { login, session } from './api';
import { useApi, useHashRoute } from './hooks';
import { MatchReview } from './pages/MatchReview';
import { Dashboard, Equivalences, Errors, Products, Promotions, Providers, RetailerProducts, Retailers } from './pages/Other';

const ROUTES: { path: string; label: string; page: () => ReactNode; badge?: keyof AdminStatsDto }[] = [
  { path: '/', label: 'Overzicht', page: Dashboard },
  { path: '/matches', label: 'Match review', page: MatchReview, badge: 'pendingMatches' },
  { path: '/equivalences', label: 'Equivalenten', page: Equivalences, badge: 'suggestedEquivalences' },
  { path: '/providers', label: 'Providers & syncs', page: Providers },
  { path: '/errors', label: 'Importfouten', page: Errors, badge: 'openErrors' },
  { path: '/products', label: 'Canonieke producten', page: Products },
  { path: '/retailer-products', label: 'Retailerproducten', page: RetailerProducts },
  { path: '/promotions', label: 'Promoties', page: Promotions },
  { path: '/retailers', label: 'Supermarkten', page: Retailers },
];

function Mark(): ReactNode {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#F08A4B" opacity="0.18" />
      <path d="M40 12.5 C37.5 9.6 26 9.2 26 14.6 C26 19.4 39 17.8 39 22.8 C39 25.6 34 26.4 25.5 25.2" stroke="#FAF6EF" strokeWidth="4.4" strokeLinecap="round" fill="none" />
      <rect x="11" y="28" width="42" height="6" rx="3" fill="#FAF6EF" />
      <path d="M14.5 34.5 H49.5 L46 51 Q45.4 53.5 42.6 53.5 H21.4 Q18.6 53.5 18 51 Z" fill="#F08A4B" />
    </svg>
  );
}

function Login({ onDone }: { onDone: () => void }): ReactNode {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="login card"
      onSubmit={(e) => {
        e.preventDefault();
        login(email, password)
          .then(onDone)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
      }}
    >
      <h1>Mijn Superrette · Admin</h1>
      <input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      <input placeholder="Wachtwoord" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      <button className="primary" type="submit">
        Inloggen
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}

export function App(): ReactNode {
  const [authed, setAuthed] = useState(() => session.get()?.user.role === 'ADMIN');
  const [route] = useHashRoute();
  const stats = useApi<AdminStatsDto>(authed ? `/v1/admin/stats?r=${route}` : null);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const current = ROUTES.find((r) => r.path === route) ?? ROUTES[0]!;
  const Page = current.page;
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">
          <Mark />
          <div>
            <small>MIJN</small>
            <strong>Superrette</strong>
          </div>
        </div>
        {ROUTES.map((r) => (
          <a key={r.path} href={`#${r.path}`} className={r.path === current.path ? 'active' : ''}>
            {r.label}
            {r.badge && stats.data?.[r.badge] ? <span className="count">{stats.data[r.badge]}</span> : null}
          </a>
        ))}
        <div style={{ flex: 1 }} />
        <a
          href="#/"
          onClick={() => {
            session.set(null);
            setAuthed(false);
          }}
        >
          Uitloggen
        </a>
      </nav>
      <main>
        <Page />
      </main>
    </div>
  );
}
