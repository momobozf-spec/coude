import type { ReactNode } from 'react';

export function Badge({ children, tone }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info' | 'promo' }): ReactNode {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

export function Meter({ value }: { value: number }): ReactNode {
  const color = value >= 0.85 ? 'var(--success)' : value >= 0.7 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="meter" role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

export function Page({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }): ReactNode {
  return (
    <section>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{title}</h1>
        {actions}
      </div>
      {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      {children}
    </section>
  );
}

export function State({ loading, error }: { loading: boolean; error: string | null }): ReactNode {
  if (error) return <p className="error">{error}</p>;
  if (loading) return <p className="muted">Laden…</p>;
  return null;
}

export const statusTone = (s: string): 'success' | 'warning' | 'danger' | 'info' | undefined =>
  ({ SUCCESS: 'success', SUPPORTED: 'success', CONFIRMED: 'success', AUTO_ACCEPTED: 'info', PARTIAL: 'warning', EXPERIMENTAL: 'warning', PENDING_REVIEW: 'warning', SUGGESTED: 'info', RUNNING: 'info', QUEUED: 'info', FAILED: 'danger', REJECTED: 'danger', UNSUPPORTED: undefined } as const)[s] ?? undefined;
