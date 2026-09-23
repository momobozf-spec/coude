import { useState, type ReactNode } from 'react';
import type { AdminMatchDto, Paginated } from '@superrette/validation';
import { api } from '../api';
import { Badge, Meter, Page, State, statusTone } from '../components';
import { useApi } from '../hooks';

/**
 * PRODUCT MATCH REVIEW — humans confirm, reject or reassign proposed links
 * between retailer products and canonical products. Decisions persist:
 * future imports honour them.
 */
function MatchCard({ match, onDone }: { match: AdminMatchDto; onDone: () => void }): ReactNode {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reassign, setReassign] = useState(false);
  const [query, setQuery] = useState('');
  const results = useApi<Paginated<{ id: string; name: string; sizeLabel: string | null; listings: number }>>(
    reassign && query.length >= 2 ? `/v1/admin/products?q=${encodeURIComponent(query)}&limit=8` : null,
  );

  const decide = async (body: Record<string, unknown>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/admin/matches/${match.id}/decision`, { method: 'POST', body });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="match">
        <div>
          <span className="muted">RETAILER PRODUCT · {match.retailerProduct.retailerName}</span>
          <h3>{match.retailerProduct.title}</h3>
          <div className="muted">{match.retailerProduct.quantityText ?? ''}</div>
          <div className="row">
            {match.retailerProduct.gtins.map((g) => (
              <code key={g}>{g}</code>
            ))}
          </div>
        </div>
        <div>
          <span className="muted">VOORGESTELDE CANONIEKE MATCH</span>
          <h3>{match.proposed.name}</h3>
          <div className="row">
            {match.proposed.gtins.map((g) => (
              <code key={g}>{g}</code>
            ))}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            {match.reasons.map((r) => (
              <Badge
                key={r}
                tone={
                  r.includes('different') || r.includes('conflict')
                    ? 'danger'
                    : r.includes('equal')
                      ? 'success'
                      : undefined
                }
              >
                {r}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <span className="muted">Zekerheid</span>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{Math.round(match.score * 100)}%</div>
          <Meter value={match.score} />
          <Badge tone={statusTone(match.confidence === 'HIGH' || match.confidence === 'EXACT' ? 'SUCCESS' : 'PARTIAL')}>
            {match.confidence}
          </Badge>{' '}
          <Badge tone={statusTone(match.status)}>{match.status}</Badge>
        </div>
      </div>
      {match.status === 'PENDING_REVIEW' ? (
        <div className="row" style={{ marginTop: 14 }}>
          <button className="success" disabled={busy} onClick={() => void decide({ decision: 'approve' })}>
            Goedkeuren
          </button>
          <button className="danger" disabled={busy} onClick={() => void decide({ decision: 'reject' })}>
            Afwijzen
          </button>
          <button disabled={busy} onClick={() => setReassign((r) => !r)}>
            Ander product
          </button>
          {error ? <span className="error">{error}</span> : null}
        </div>
      ) : null}
      {match.alternatives.length > 0 && match.status === 'PENDING_REVIEW' ? (
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted">Alternatieven:</span>
          {match.alternatives.map((a) => (
            <button
              key={a.variantId}
              disabled={busy}
              onClick={() => void decide({ decision: 'reassign', variantId: a.variantId })}
            >
              {a.name} ({Math.round(a.score * 100)}%)
            </button>
          ))}
        </div>
      ) : null}
      {reassign ? (
        <div className="stack" style={{ marginTop: 12 }}>
          <input
            placeholder="Zoek canoniek product…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {results.data?.items.map((v) => (
            <div key={v.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>
                {v.name} <span className="muted">· {v.listings} listings</span>
              </span>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void decide({ decision: 'reassign', variantId: v.id })}
              >
                Koppel
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MatchReview(): ReactNode {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useApi<Paginated<AdminMatchDto>>(
    `/v1/admin/matches?status=${status}&limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  );
  return (
    <Page
      title="Product match review"
      subtitle="Menselijke correcties blijven bewaard en worden bij elke import gerespecteerd."
    >
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {['PENDING_REVIEW', 'AUTO_ACCEPTED', 'CONFIRMED', 'REJECTED'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input placeholder="Zoek op titel" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{data?.total ?? 0} resultaten</span>
      </div>
      <State loading={loading} error={error} />
      {data?.items.length === 0 ? <div className="card muted">Niets te beoordelen. 🎉</div> : null}
      <div className="stack">
        {data?.items.map((m) => (
          <MatchCard key={m.id} match={m} onDone={reload} />
        ))}
      </div>
    </Page>
  );
}
