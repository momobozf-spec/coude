import { useState, type ReactNode } from 'react';
import type {
  AdminEquivalenceDto,
  AdminProviderDto,
  AdminProviderErrorDto,
  AdminStatsDto,
  AdminSyncDto,
  Paginated,
} from '@superrette/validation';
import { api, dateTime, euro } from '../api';
import { Badge, Meter, Page, State, statusTone } from '../components';
import { useApi } from '../hooks';

export function Dashboard(): ReactNode {
  const { data, error, loading } = useApi<AdminStatsDto>('/v1/admin/stats');
  const tiles: [string, keyof AdminStatsDto, string?][] = [
    ['Te beoordelen matches', 'pendingMatches', '#/matches'],
    ['Voorgestelde equivalenten', 'suggestedEquivalences', '#/equivalences'],
    ['Open importfouten', 'openErrors', '#/errors'],
    ['Actieve promoties', 'activePromotions', '#/promotions'],
    ['Canonieke producten', 'variants', '#/products'],
    ['Retailerproducten', 'retailerProducts', '#/retailer-products'],
    ['Prijsobservaties', 'priceObservations'],
    ['Supermarkten', 'retailers', '#/retailers'],
    ['Gebruikers', 'users'],
  ];
  return (
    <Page title="Overzicht" subtitle="Status van catalogus, matching en imports.">
      <State loading={loading} error={error} />
      {data ? (
        <div className="grid">
          {tiles.map(([label, key, href]) => (
            <a key={key} href={href ?? undefined} className="card stat" style={{ color: 'inherit' }}>
              <div className="label">{label}</div>
              <div className="value">{new Intl.NumberFormat('nl-BE').format(data[key])}</div>
            </a>
          ))}
        </div>
      ) : null}
    </Page>
  );
}

export function Equivalences(): ReactNode {
  const [status, setStatus] = useState('SUGGESTED');
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useApi<Paginated<AdminEquivalenceDto>>(`/v1/admin/equivalences?status=${status}&limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const decide = async (id: string, decision: 'confirm' | 'reject'): Promise<void> => {
    await api(`/v1/admin/equivalences/${id}/decision`, { method: 'POST', body: { decision } });
    reload();
  };
  return (
    <Page title="Equivalente producten" subtitle="Bv. Boni Halfvolle Melk 1L ≈ AH Halfvolle Melk 1L. Bevestigde paren krijgen voorrang in de mandvergelijking.">
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {['SUGGESTED', 'CONFIRMED', 'REJECTED'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input placeholder="Zoek product" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{data?.total ?? 0} paren</span>
      </div>
      <State loading={loading} error={error} />
      <table>
        <thead>
          <tr>
            <th>Bronproduct</th>
            <th>Equivalent</th>
            <th>Zekerheid</th>
            <th>Redenen</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.items.map((e) => (
            <tr key={e.id}>
              <td>{e.source.name}</td>
              <td>{e.target.name}</td>
              <td style={{ width: 120 }}>
                {Math.round(e.confidence * 100)}%<Meter value={e.confidence} />
              </td>
              <td>
                <div className="row">{e.reasons.map((r) => <Badge key={r}>{r}</Badge>)}</div>
              </td>
              <td>
                {e.status === 'SUGGESTED' ? (
                  <div className="row">
                    <button className="success" onClick={() => void decide(e.id, 'confirm')}>
                      Bevestigen
                    </button>
                    <button className="danger" onClick={() => void decide(e.id, 'reject')}>
                      Afwijzen
                    </button>
                  </div>
                ) : (
                  <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}

export function Providers(): ReactNode {
  const providers = useApi<AdminProviderDto[]>('/v1/admin/providers');
  const syncs = useApi<Paginated<AdminSyncDto>>('/v1/admin/syncs?limit=30');
  const [message, setMessage] = useState<string | null>(null);
  const trigger = async (key: string, kind: string): Promise<void> => {
    try {
      const s = await api<AdminSyncDto>(`/v1/admin/providers/${key}/sync`, { method: 'POST', body: { kind } });
      setMessage(`Sync ${s.id.slice(0, 8)} ingepland (${s.status}).`);
      setTimeout(() => {
        syncs.reload();
        providers.reload();
      }, 1500);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Page title="Providers & synchronisatie" subtitle="Eén kapotte provider breekt nooit de rest. UNSUPPORTED providers hebben (nog) geen legale, betrouwbare integratie.">
      {message ? <p className="banner">{message}</p> : null}
      <State loading={providers.loading} error={providers.error} />
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Status</th>
            <th>Bron</th>
            <th>Laatste sync</th>
            <th>Reden / documentatie</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {providers.data?.map((p) => (
            <tr key={p.key}>
              <td>
                <strong>{p.displayName}</strong>
                <div className="muted">
                  <code>{p.key}</code>
                </div>
              </td>
              <td>
                <Badge tone={statusTone(p.supportStatus)}>{p.supportStatus}</Badge>
              </td>
              <td>
                {p.supportStatus === 'UNSUPPORTED' ? <span className="muted">—</span> : <Badge tone={p.dataOrigin === 'DEVELOPMENT_SEED' ? 'warning' : 'info'}>{p.dataOrigin}</Badge>}
              </td>
              <td>{p.lastSync ? <Badge tone={statusTone(p.lastSync.status)}>{`${p.lastSync.status} · ${dateTime(p.lastSync.finishedAt ?? p.lastSync.startedAt)}`}</Badge> : <span className="muted">—</span>}</td>
              <td className="muted" style={{ maxWidth: 420 }}>
                {p.reason}
              </td>
              <td>
                {p.enabled ? (
                  <div className="row">
                    {['FULL', 'PRICES', 'PROMOTIONS'].map((k) => (
                      <button key={k} onClick={() => void trigger(p.key, k)}>
                        {k}
                      </button>
                    ))}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ marginTop: 28 }}>Recente syncs</h2>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Soort</th>
            <th>Status</th>
            <th>Start</th>
            <th>Einde</th>
            <th className="num">Gelezen</th>
            <th className="num">Nieuw</th>
            <th className="num">Bijgewerkt</th>
            <th className="num">Mislukt</th>
          </tr>
        </thead>
        <tbody>
          {syncs.data?.items.map((s) => (
            <tr key={s.id}>
              <td>{s.providerKey}</td>
              <td>{s.kind}</td>
              <td>
                <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                {s.errorSummary ? <div className="error">{s.errorSummary}</div> : null}
              </td>
              <td>{dateTime(s.startedAt)}</td>
              <td>{dateTime(s.finishedAt)}</td>
              <td className="num">{s.readCount}</td>
              <td className="num">{s.createdCount}</td>
              <td className="num">{s.updatedCount}</td>
              <td className="num">{s.failedCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}

export function Errors(): ReactNode {
  const { data, error, loading, reload } = useApi<Paginated<AdminProviderErrorDto>>('/v1/admin/errors?limit=100');
  return (
    <Page title="Mislukte imports" subtitle="Records die een pipelinestap niet haalden. De rest van de import ging gewoon door.">
      <State loading={loading} error={error} />
      <table>
        <thead>
          <tr>
            <th>Tijd</th>
            <th>Provider</th>
            <th>Stap</th>
            <th>Extern id</th>
            <th>Melding</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.items.map((e) => (
            <tr key={e.id}>
              <td>{dateTime(e.createdAt)}</td>
              <td>{e.providerKey}</td>
              <td>
                <Badge tone="warning">{e.stage}</Badge>
              </td>
              <td>
                <code>{e.externalId ?? '—'}</code>
              </td>
              <td style={{ maxWidth: 520, wordBreak: 'break-word' }}>{e.message}</td>
              <td>
                <button onClick={() => void api(`/v1/admin/errors/${e.id}/resolve`, { method: 'POST' }).then(reload)}>Opgelost</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data?.items.length === 0 ? <p className="muted">Geen open fouten.</p> : null}
    </Page>
  );
}

interface VariantRow {
  id: string;
  name: string;
  sizeLabel: string | null;
  needsReview: boolean;
  dataOrigin: string;
  listings: number;
  gtins: string[];
}

export function Products(): ReactNode {
  const [q, setQ] = useState('');
  const [review, setReview] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useApi<Paginated<VariantRow>>(`/v1/admin/products?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}${review ? '&status=needs_review' : ''}`);
  const detail = useApi<{ variant: Record<string, unknown>; listings: { rp: { id: string; title: string; retailerSku: string }; retailerName: string; price: { regularPriceCents: number; promoPriceCents: number | null; observedAt: string } | null }[]; gtins: { gtin: string }[] }>(selected ? `/v1/admin/products/${selected}` : null);
  return (
    <Page title="Canonieke producten" subtitle="Product = genormaliseerd canoniek product; retailerproducten zijn de versies per supermarkt.">
      <div className="toolbar">
        <input placeholder="Zoek" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="row">
          <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} /> Enkel te controleren
        </label>
        <span className="muted">{list.data?.total ?? 0} producten</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>GTIN</th>
              <th className="num">Listings</th>
              <th>Bron</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((v) => (
              <tr key={v.id} onClick={() => setSelected(v.id)} style={{ cursor: 'pointer', background: selected === v.id ? 'var(--surface-alt)' : undefined }}>
                <td>
                  {v.name} {v.needsReview ? <Badge tone="warning">controleren</Badge> : null}
                </td>
                <td>{v.gtins.map((g) => <code key={g}>{g}</code>)}</td>
                <td className="num">{v.listings}</td>
                <td>
                  <Badge tone={v.dataOrigin === 'DEVELOPMENT_SEED' ? 'warning' : 'info'}>{v.dataOrigin}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {selected && detail.data ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{String(detail.data.variant.displayName)}</h2>
            <div className="row">{detail.data.gtins.map((g) => <code key={g.gtin}>{g.gtin}</code>)}</div>
            {detail.data.variant.needsReview ? (
              <button style={{ marginTop: 10 }} onClick={() => void api(`/v1/admin/products/${selected}`, { method: 'PATCH', body: { needsReview: false } }).then(() => { detail.reload(); list.reload(); })}>
                Markeer als gecontroleerd
              </button>
            ) : null}
            <h3>Retailerproducten</h3>
            <table>
              <tbody>
                {detail.data.listings.map((l) => (
                  <tr key={l.rp.id}>
                    <td>
                      <strong>{l.retailerName}</strong>
                      <div className="muted">{l.rp.title}</div>
                    </td>
                    <td className="num">
                      {euro(l.price?.promoPriceCents ?? l.price?.regularPriceCents)}
                      {l.price?.promoPriceCents ? <div className="muted" style={{ textDecoration: 'line-through' }}>{euro(l.price.regularPriceCents)}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Page>
  );
}

interface RetailerProductRow {
  id: string;
  title: string;
  sku: string;
  retailerName: string;
  variantId: string | null;
  dataOrigin: string;
  price: number | null;
  promo: number | null;
}

export function RetailerProducts(): ReactNode {
  const [q, setQ] = useState('');
  const [unlinked, setUnlinked] = useState(false);
  const [prices, setPrices] = useState<string | null>(null);
  const list = useApi<Paginated<RetailerProductRow>>(`/v1/admin/retailer-products?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}${unlinked ? '&status=unlinked' : ''}`);
  const history = useApi<{ id: number; observedAt: string; regularPriceCents: number; promoPriceCents: number | null; sourceProvider: string }[]>(prices ? `/v1/admin/retailer-products/${prices}/prices` : null);
  return (
    <Page title="Retailerproducten & prijzen">
      <div className="toolbar">
        <input placeholder="Zoek" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="row">
          <input type="checkbox" checked={unlinked} onChange={(e) => setUnlinked(e.target.checked)} /> Niet gekoppeld
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: prices ? '2fr 1fr' : '1fr', gap: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Supermarkt</th>
              <th>Titel</th>
              <th>SKU</th>
              <th className="num">Prijs</th>
              <th>Gekoppeld</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((r) => (
              <tr key={r.id} onClick={() => setPrices(r.id)} style={{ cursor: 'pointer' }}>
                <td>{r.retailerName}</td>
                <td>{r.title}</td>
                <td>
                  <code>{r.sku}</code>
                </td>
                <td className="num">
                  {euro(r.promo ?? r.price)} {r.promo ? <Badge tone="promo">PROMO</Badge> : null}
                </td>
                <td>{r.variantId ? <Badge tone="success">ja</Badge> : <Badge tone="warning">nee</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {prices ? (
          <table>
            <thead>
              <tr>
                <th>Observatie</th>
                <th className="num">Normaal</th>
                <th className="num">Promo</th>
              </tr>
            </thead>
            <tbody>
              {history.data?.map((h) => (
                <tr key={h.id}>
                  <td>
                    {dateTime(h.observedAt)}
                    <div className="muted">{h.sourceProvider}</div>
                  </td>
                  <td className="num">{euro(h.regularPriceCents)}</td>
                  <td className="num">{euro(h.promoPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </Page>
  );
}

export function Promotions(): ReactNode {
  const { data, error, loading } = useApi<Paginated<{ id: string; label: string; mechanic: string; retailerName: string; startsAt: string | null; endsAt: string | null; dataOrigin: string }>>('/v1/admin/promotions?limit=200');
  const now = Date.now();
  return (
    <Page title="Promoties">
      <State loading={loading} error={error} />
      <table>
        <thead>
          <tr>
            <th>Supermarkt</th>
            <th>Promotie</th>
            <th>Mechaniek</th>
            <th>Geldig</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((p) => {
            const active = (!p.startsAt || new Date(p.startsAt).getTime() <= now) && (!p.endsAt || new Date(p.endsAt).getTime() >= now);
            return (
              <tr key={p.id}>
                <td>{p.retailerName}</td>
                <td>{p.label}</td>
                <td>
                  <code>{p.mechanic}</code>
                </td>
                <td>
                  {dateTime(p.startsAt)} → {dateTime(p.endsAt)}
                </td>
                <td>{active ? <Badge tone="success">actief</Badge> : <Badge>niet actief</Badge>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Page>
  );
}

export function Retailers(): ReactNode {
  const { data, error, loading, reload } = useApi<{ id: string; name: string; slug: string; type: string; isActive: boolean; dataSupport: string; brandColor: string }[]>('/v1/admin/retailers');
  return (
    <Page title="Supermarkten" subtitle="Supermarkten zijn data: toevoegen of uitschakelen vereist geen app-release.">
      <State loading={loading} error={error} />
      <table>
        <thead>
          <tr>
            <th>Naam</th>
            <th>Type</th>
            <th>Gegevens</th>
            <th>Actief</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((r) => (
            <tr key={r.id}>
              <td>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: r.brandColor, marginRight: 8 }} />
                {r.name} <code>{r.slug}</code>
              </td>
              <td>{r.type}</td>
              <td>
                <Badge tone={statusTone(r.dataSupport)}>{r.dataSupport}</Badge>
              </td>
              <td>
                <input type="checkbox" checked={r.isActive} onChange={(e) => void api(`/v1/admin/retailers/${r.id}`, { method: 'PATCH', body: { isActive: e.target.checked } }).then(reload)} aria-label={`${r.name} actief`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}
