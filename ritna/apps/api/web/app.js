/* Ritna — lokale webversie. Praat met dezelfde API (zelfde poort). */
(() => {
  'use strict';
  const DEMO_PASSWORD = 'ritna-demo-2026';
  const DEMO = [
    ['klant@ritna.local', 'Klant'],
    ['taxi@ritna.local', 'Taxibedrijf'],
    ['chauffeur@ritna.local', 'Chauffeur'],
    ['admin@ritna.local', 'Platformbeheer'],
  ];
  // Vaste plaatsen met coördinaten (er is lokaal geen adres-zoekdienst).
  const PLACES = [
    ['Brussel-Centraal', 50.8455, 4.3571],
    ['Brussels Airport (Zaventem)', 50.9010, 4.4844],
    ['Brussel-Zuid (Midi)', 50.8357, 4.3363],
    ['Brussel-Noord', 50.8603, 4.3610],
    ['Grote Markt Brussel', 50.8467, 4.3525],
    ['Schuman (EU-wijk)', 50.8434, 4.3807],
    ['Louizaplein', 50.8360, 4.3570],
    ['Atomium', 50.8949, 4.3415],
    ['Zaventem centrum', 50.8846, 4.4724],
    ['Vilvoorde station', 50.9270, 4.4290],
    ['Ukkel Vanderkindere', 50.8137, 4.3527],
    ['Etterbeek station', 50.8216, 4.3895],
  ];

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const eur = (c) => (c == null ? '—' : '€ ' + (c / 100).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const dt = (d) => (d ? new Date(d).toLocaleString('nl-BE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const main = $('#main');

  let session = null;
  try { session = JSON.parse(localStorage.getItem('ritna-session') || 'null'); } catch { session = null; }
  const save = () => { try { session ? localStorage.setItem('ritna-session', JSON.stringify(session)) : localStorage.removeItem('ritna-session'); } catch {} };

  let tt;
  function toast(msg, err = false) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 3500);
  }

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(session ? { authorization: 'Bearer ' + session.token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && session) { session = null; save(); render(); throw new Error('Sessie verlopen, meld opnieuw aan'); }
    if (!res.ok) {
      const msg = data.message || (data.issues ? data.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ') : 'Fout ' + res.status);
      throw new Error(msg);
    }
    return data;
  }
  async function run(fn, okMsg) {
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, true); return undefined; }
  }

  const statusClass = (s) => ({ completed: 'ok', accepted: 'ok', driver_assigned: 'ok', driver_en_route: 'ok', driver_arrived: 'ok', in_progress: 'ok', requested: 'warn' })[s] || (/cancel|declin|expir|unfulf|no_show/.test(s) ? 'bad' : '');
  const STATUS_NL = { requested: 'Wacht op vervoerder', accepted: 'Bevestigd', driver_assigned: 'Chauffeur toegewezen', driver_en_route: 'Onderweg', driver_arrived: 'Aangekomen', in_progress: 'Rit bezig', completed: 'Voltooid', declined: 'Geweigerd', expired: 'Geen antwoord', unfulfilled: 'Geen vervoerder', cancelled_by_customer: 'Geannuleerd (klant)', cancelled_by_operator: 'Geannuleerd (vervoerder)', cancelled_by_platform: 'Geannuleerd (Ritna)', no_show: 'No-show' };
  const pill = (s, label) => `<span class="pill ${statusClass(s)}">${esc(label || STATUS_NL[s] || s)}</span>`;
  const range = (daysBack = 30, daysFwd = 30) => {
    const f = new Date(Date.now() - daysBack * 864e5).toISOString();
    const t = new Date(Date.now() + daysFwd * 864e5).toISOString();
    return `from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`;
  };

  // --------------------------------------------------------------- header
  function renderWho() {
    const who = $('#who');
    if (!session) { who.innerHTML = ''; return; }
    const roleNl = { customer: 'Klant', operator_admin: 'Taxibedrijf', driver: 'Chauffeur', platform_admin: 'Beheer' }[session.user.role] || session.user.role;
    who.innerHTML = `<span>${esc(session.user.fullName || session.user.full_name || session.user.email)} · ${esc(roleNl)}</span><button class="btn sm alt" id="logout">Afmelden</button>`;
    $('#logout').onclick = () => { session = null; save(); render(); };
  }

  // --------------------------------------------------------------- login
  function renderLogin() {
    main.innerHTML = `
      <div class="card login">
        <h1>Aanmelden</h1>
        <p class="muted small">Lokale testomgeving. Kies een demo-account of meld je aan.</p>
        <div class="demo-accounts">${DEMO.map(([e, l]) => `<button class="btn alt" data-demo="${esc(e)}">${esc(l)} <span class="muted small">· ${esc(e)}</span></button>`).join('')}</div>
        <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
        <form id="lf" class="fields" style="grid-template-columns:1fr">
          <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
          <label>Wachtwoord<input name="password" type="password" required autocomplete="current-password"></label>
          <button class="btn">Aanmelden</button>
        </form>
        <p class="small muted">Nieuwe klant? <a href="#" id="reg">Account maken</a></p>
      </div>`;
    const doLogin = async (email, password) => {
      const r = await run(() => api('POST', '/v1/auth/login', { email, password }));
      if (r) { session = r; save(); render(); }
    };
    main.querySelectorAll('[data-demo]').forEach((b) => (b.onclick = () => doLogin(b.dataset.demo, DEMO_PASSWORD)));
    $('#lf').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); doLogin(f.get('email'), f.get('password')); };
    $('#reg').onclick = (e) => { e.preventDefault(); renderRegister(); };
  }

  function renderRegister() {
    main.innerHTML = `
      <div class="card login"><h1>Klantaccount maken</h1>
        <form id="rf" class="fields" style="grid-template-columns:1fr">
          <label>Naam<input name="fullName" required minlength="2"></label>
          <label>E-mail<input name="email" type="email" required></label>
          <label>Telefoon<input name="phone"></label>
          <label>Wachtwoord (min. 10 tekens)<input name="password" type="password" minlength="10" required></label>
          <div class="row"><button class="btn">Account maken</button><button type="button" class="btn alt" id="back">Terug</button></div>
        </form></div>`;
    $('#back').onclick = renderLogin;
    $('#rf').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (!f.phone) delete f.phone;
      const r = await run(() => api('POST', '/v1/auth/register', f), 'Account aangemaakt');
      if (r) { session = r; save(); render(); }
    };
  }

  // --------------------------------------------------------------- tabs helper
  function tabs(list, current, onPick) {
    return `<div class="tabs">${list.map(([k, l]) => `<button data-tab="${k}" class="${k === current ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
  }
  function bindTabs(onPick) { main.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => onPick(b.dataset.tab))); }

  // =============================================================== KLANT
  let custTab = 'boek';
  let lastSearch = null;
  async function renderCustomer() {
    main.innerHTML = `<h1>Rit boeken</h1><p class="muted">Kies vertrek en bestemming, bekijk de vaste prijzen en boek.</p>${tabs([['boek', 'Nieuwe rit'], ['ritten', 'Mijn ritten'], ['meldingen', 'Meldingen']], custTab)}<div id="pane"></div>`;
    bindTabs((t) => { custTab = t; renderCustomer(); });
    const pane = $('#pane');
    if (custTab === 'boek') return renderBook(pane);
    if (custTab === 'ritten') return renderMyRides(pane);
    return renderNotifications(pane);
  }

  function placeSelect(name, sel) {
    return `<select name="${name}">${PLACES.map((p, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(p[0])}</option>`).join('')}</select>`;
  }
  function renderBook(pane) {
    const soon = new Date(Date.now() + 90 * 60_000); soon.setSeconds(0, 0);
    const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    pane.innerHTML = `
      <div class="card"><form id="sf">
        <div class="fields">
          <label>Ophalen${placeSelect('from', 1)}</label>
          <label>Bestemming${placeSelect('to', 0)}</label>
          <label>Ophaalmoment<input type="datetime-local" name="at" value="${local}" required></label>
          <label>Categorie<select name="category"><option value="standard">Standaard (4 pl.)</option><option value="van">Van</option></select></label>
          <label>Passagiers<input type="number" name="passengers" min="1" max="8" value="1"></label>
          <label>Bagage<input type="number" name="luggage" min="0" max="20" value="1"></label>
        </div>
        <button class="btn yel">Prijzen zoeken</button>
      </form></div>
      <div id="results"></div>`;
    $('#sf').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const a = PLACES[+f.get('from')], b = PLACES[+f.get('to')];
      if (a === b) return toast('Vertrek en bestemming zijn gelijk', true);
      const trip = {
        pickup: { address: a[0], lat: a[1], lng: a[2] },
        dropoff: { address: b[0], lat: b[1], lng: b[2] },
        pickupAt: new Date(f.get('at')).toISOString(),
        category: f.get('category'),
        passengers: +f.get('passengers'),
        luggageItems: +f.get('luggage'),
      };
      const r = await run(() => api('POST', '/v1/search', trip));
      if (!r) return;
      lastSearch = { trip, ...r };
      renderResults();
    };
  }
  function renderResults() {
    const box = $('#results'); if (!box || !lastSearch) return;
    const { options, distanceMeters, durationSeconds } = lastSearch;
    box.innerHTML = `<div class="card"><h2>Beschikbare vervoerders</h2>
      <p class="muted small">${(distanceMeters / 1000).toFixed(1)} km · ± ${Math.round(durationSeconds / 60)} min · vaste prijs incl. btw</p>
      ${options.length ? options.map((o, i) => `
        <div class="option"><div><strong>${esc(o.tradeName)}</strong>
          <div class="small muted">${o.rating.count ? '★ ' + o.rating.average + ' (' + o.rating.count + ')' : 'Nog geen beoordelingen'} · gratis annuleren tot ${o.cancellationPolicy?.freeUntilMinutesBefore ?? '?'} min vooraf</div></div>
          <div class="row"><span class="stat num" style="font-size:18px">${eur(o.priceCents)}</span><button class="btn yel sm" data-book="${i}">Boek</button></div></div>`).join('') : '<p class="empty">Geen vervoerder beschikbaar voor deze rit.</p>'}
      ${options.length ? `<div class="row" style="margin-top:8px"><button class="btn alt sm" id="open">Open aanvraag (goedkoopste eerst, max ${eur(Math.max(...options.map((o) => o.priceCents)))})</button></div>` : ''}
    </div>`;
    const book = async (body) => {
      const r = await run(() => api('POST', '/v1/rides', { ...lastSearch.trip, ...body, idempotencyKey: 'web-' + Date.now() + '-' + Math.random().toString(36).slice(2) }), 'Aanvraag verstuurd naar de vervoerder');
      if (r) { lastSearch = null; custTab = 'ritten'; renderCustomer(); }
    };
    box.querySelectorAll('[data-book]').forEach((b) => (b.onclick = () => {
      const o = options[+b.dataset.book];
      book({ mode: 'chosen_operator', operatorId: o.operatorId, acceptedPriceCents: o.priceCents });
    }));
    const open = $('#open');
    if (open) open.onclick = () => book({ mode: 'open_dispatch', acceptedPriceCents: Math.max(...options.map((o) => o.priceCents)) });
  }

  async function renderMyRides(pane) {
    pane.innerHTML = '<p class="muted">Laden…</p>';
    const list = await run(() => api('GET', '/v1/rides'));
    if (!list) return;
    pane.innerHTML = list.length ? list.map((r) => `
      <div class="card"><div class="row" style="justify-content:space-between">
        <div><h3>${esc(r.pickup.address)} → ${esc(r.dropoff.address)}</h3>
          <div class="small muted">${dt(r.pickupAt)} · ${esc(r.category)} · ${r.passengers} pers.</div></div>
        <div class="row">${pill(r.status, r.statusLabel)}<strong class="num">${eur(r.priceCents ?? r.maxPriceCents)}</strong></div></div>
        ${r.operator ? `<p class="small">Vervoerder: <strong>${esc(r.operator.trade_name)}</strong>${r.driver ? ' · chauffeur ' + esc(r.driver.first_name) : ''}${r.vehicle ? ' · ' + esc(r.vehicle.plate) : ''}</p>` : ''}
        ${r.feeCents ? `<p class="small">Annuleringskost: ${eur(r.feeCents)}</p>` : ''}
        <ul class="timeline">${r.timeline.map((t) => `<li>${dt(t.at)} — ${esc(STATUS_NL[t.to_status] || t.to_status)}</li>`).join('')}</ul>
        <div class="row" style="margin-top:8px">
          ${['requested', 'accepted', 'driver_assigned', 'driver_en_route', 'driver_arrived'].includes(r.status) ? `<button class="btn bad sm" data-cancel="${r.id}">Annuleren</button>` : ''}
          ${r.status === 'completed' ? `<button class="btn alt sm" data-review="${r.id}">Beoordelen</button>` : ''}
          <button class="btn alt sm" data-inc="${r.id}">Probleem melden</button>
        </div></div>`).join('') : '<p class="empty">Nog geen ritten.</p>';
    pane.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = async () => {
      if (!confirmInline(b, 'Zeker annuleren?')) return;
      const r = await run(() => api('POST', `/v1/rides/${b.dataset.cancel}/cancel`), 'Rit geannuleerd');
      if (r) renderMyRides(pane);
    }));
    pane.querySelectorAll('[data-review]').forEach((b) => (b.onclick = async () => {
      const rating = Number(prompt('Score 1 tot 5?', '5'));
      if (!rating) return;
      const comment = prompt('Opmerking (optioneel)') || undefined;
      const r = await run(() => api('POST', `/v1/rides/${b.dataset.review}/review`, { rating, comment }), 'Bedankt voor je beoordeling');
      if (r) renderMyRides(pane);
    }));
    pane.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => reportIncident(b.dataset.inc)));
  }

  async function reportIncident(id) {
    const description = prompt('Wat is er gebeurd? (min. 5 tekens)');
    if (!description) return;
    await run(() => api('POST', `/v1/rides/${id}/incidents`, { kind: 'other', description }), 'Melding verstuurd naar Ritna');
  }

  async function renderNotifications(pane) {
    const list = await run(() => api('GET', '/v1/notifications'));
    if (!list) return;
    pane.innerHTML = `<div class="card">${list.length ? `<table><tr><th>Wanneer</th><th>Bericht</th><th>Gegevens</th></tr>${list.map((n) => `<tr><td>${dt(n.created_at)}</td><td>${esc(n.template)}</td><td class="small muted">${esc(JSON.stringify(n.payload))}</td></tr>`).join('')}</table>` : '<p class="empty">Geen meldingen.</p>'}</div>`;
  }

  function confirmInline(btn, text) {
    if (btn.dataset.sure === '1') return true;
    btn.dataset.sure = '1'; btn.textContent = text; return false;
  }

  // =============================================================== TAXIBEDRIJF
  let opTab = 'aanvragen';
  async function renderOperator() {
    main.innerHTML = `<h1>Taxibedrijf</h1>${tabs([['aanvragen', 'Aanvragen'], ['ritten', 'Ritten'], ['verdiensten', 'Verdiensten'], ['vloot', 'Chauffeurs & voertuigen'], ['tarieven', 'Tarieven & profiel']], opTab)}<div id="pane"></div>`;
    bindTabs((t) => { opTab = t; renderOperator(); });
    const pane = $('#pane');
    pane.innerHTML = '<p class="muted">Laden…</p>';
    if (opTab === 'aanvragen' || opTab === 'ritten') return renderOpRides(pane);
    if (opTab === 'verdiensten') return renderEarnings(pane);
    if (opTab === 'vloot') return renderFleet(pane);
    return renderTariffs(pane);
  }

  async function renderOpRides(pane) {
    const [data, drivers, vehicles] = await Promise.all([
      run(() => api('GET', '/v1/operator/rides?' + range(7, 30))),
      run(() => api('GET', '/v1/operator/drivers')),
      run(() => api('GET', '/v1/operator/vehicles')),
    ]);
    if (!data) return;
    const drvOpts = (drivers || []).filter((d) => d.status === 'active').map((d) => `<option value="${d.id}">${esc(d.full_name)}${d.is_available ? '' : ' (niet beschikbaar)'}</option>`).join('');
    const vehOpts = (vehicles || []).map((v) => `<option value="${v.id}">${esc(v.plate)} · ${esc(v.category)}</option>`).join('');
    if (opTab === 'aanvragen') {
      const p = data.pendingRequests;
      pane.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>Openstaande aanvragen</h2><button class="btn alt sm" id="refresh">Vernieuwen</button></div>
        ${p.length ? p.map((r) => `<div class="option"><div><strong>${esc(r.pickup_address)} → ${esc(r.dropoff_address)}</strong>
          <div class="small muted">${dt(r.pickup_at)} · ${esc(r.category)} · ${r.passengers} pers. · ${r.luggage_items} bagage · verloopt ${dt(r.expires_at)}</div>
          ${r.notes ? `<div class="small">“${esc(r.notes)}”</div>` : ''}</div>
          <div class="row"><strong class="num">${eur(r.price_cents)}</strong>
            <select data-drv="${r.ride_id}" style="width:auto"><option value="">Chauffeur later</option>${drvOpts}</select>
            <button class="btn yel sm" data-accept="${r.ride_id}">Aanvaarden</button>
            <button class="btn bad sm" data-decline="${r.ride_id}">Weigeren</button></div></div>`).join('') : '<p class="empty">Geen openstaande aanvragen. Boek als klant een rit om er een te zien.</p>'}</div>`;
      $('#refresh').onclick = () => renderOperator();
      pane.querySelectorAll('[data-accept]').forEach((b) => (b.onclick = async () => {
        const driverId = pane.querySelector(`[data-drv="${b.dataset.accept}"]`).value || undefined;
        const r = await run(() => api('POST', `/v1/operator/rides/${b.dataset.accept}/accept`, driverId ? { driverId } : {}), 'Rit aanvaard');
        if (r) renderOperator();
      }));
      pane.querySelectorAll('[data-decline]').forEach((b) => (b.onclick = async () => {
        if (!confirmInline(b, 'Zeker weigeren?')) return;
        const r = await run(() => api('POST', `/v1/operator/rides/${b.dataset.decline}/decline`, { reason: 'Geweigerd via web' }), 'Aanvraag geweigerd');
        if (r) renderOperator();
      }));
      return;
    }
    const rides = data.rides;
    const drvName = (id) => (drivers || []).find((d) => d.id === id)?.full_name || '—';
    pane.innerHTML = `<div class="card tablewrap"><h2>Ritten (7 dagen terug, 30 vooruit)</h2>${rides.length ? `<table>
      <tr><th>Ophalen</th><th>Traject</th><th>Status</th><th class="num">Prijs</th><th>Chauffeur</th><th></th></tr>
      ${rides.map((r) => `<tr><td>${dt(r.pickup_at)}</td><td>${esc(r.pickup_address)} → ${esc(r.dropoff_address)}<div class="small muted">${esc(r.category)} · ${r.passengers} pers. · ${esc(r.source)}</div></td>
        <td>${pill(r.status)}</td><td class="num">${eur(r.price_cents)}</td><td>${esc(drvName(r.driver_id))}</td>
        <td>${['accepted', 'driver_assigned'].includes(r.status) ? `<div class="row"><select data-asg="${r.id}" style="width:auto">${drvOpts}</select><select data-veh="${r.id}" style="width:auto"><option value="">Voertuig chauffeur</option>${vehOpts}</select><button class="btn sm alt" data-assign="${r.id}">Toewijzen</button></div>` : ''}
          ${['accepted', 'driver_assigned', 'driver_en_route'].includes(r.status) ? `<button class="btn sm bad" data-opcancel="${r.id}">Annuleren</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="empty">Geen ritten in deze periode.</p>'}</div>`;
    pane.querySelectorAll('[data-assign]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.assign;
      const driverId = pane.querySelector(`[data-asg="${id}"]`).value;
      const vehicleId = pane.querySelector(`[data-veh="${id}"]`).value || undefined;
      const r = await run(() => api('POST', `/v1/operator/rides/${id}/assign`, { driverId, vehicleId }), 'Chauffeur toegewezen');
      if (r) renderOperator();
    }));
    pane.querySelectorAll('[data-opcancel]').forEach((b) => (b.onclick = async () => {
      const reason = prompt('Reden van annulering (min. 3 tekens)');
      if (!reason) return;
      const r = await run(() => api('POST', `/v1/operator/rides/${b.dataset.opcancel}/cancel`, { reason }), 'Rit geannuleerd');
      if (r) renderOperator();
    }));
  }

  async function renderEarnings(pane) {
    const e = await run(() => api('GET', '/v1/operator/earnings?' + range(90, 1)));
    if (!e) return;
    pane.innerHTML = `<div class="grid">
      <div class="card"><div class="muted small">Klantbetalingen (90 d)</div><div class="stat num">${eur(e.customerCharges)}</div></div>
      <div class="card"><div class="muted small">Commissie Ritna</div><div class="stat num">${eur(e.platformCommission)}</div><div class="small muted">+ btw ${eur(e.commissionVat)}</div></div>
      <div class="card"><div class="muted small">Voor jou</div><div class="stat num">${eur(e.operatorPayable)}</div></div>
      <div class="card"><div class="muted small">Nog uit te betalen</div><div class="stat num">${eur(e.unpaidBalance)}</div></div></div>
      <div class="card"><h2>Uitbetalingen</h2>${e.payouts.length ? `<table><tr><th>Datum</th><th class="num">Bedrag</th><th>Status</th></tr>${e.payouts.map((p) => `<tr><td>${dt(p.created_at)}</td><td class="num">${eur(p.amount_cents)}</td><td>${pill(p.status === 'paid' ? 'completed' : 'requested', p.status === 'paid' ? 'Betaald' : p.status)}</td></tr>`).join('')}</table>` : '<p class="empty">Nog geen uitbetalingen.</p>'}</div>`;
  }

  async function renderFleet(pane) {
    const [drivers, vehicles] = await Promise.all([run(() => api('GET', '/v1/operator/drivers')), run(() => api('GET', '/v1/operator/vehicles'))]);
    if (!drivers || !vehicles) return;
    pane.innerHTML = `<div class="grid">
      <div class="card"><h2>Chauffeurs</h2><table><tr><th>Naam</th><th>Status</th><th>Beschikbaar</th></tr>${drivers.map((d) => `<tr><td>${esc(d.full_name)}<div class="small muted">${esc(d.email)}</div></td><td>${pill(d.status === 'active' ? 'completed' : 'requested', d.status)}</td><td>${d.is_available ? 'ja' : 'nee'}</td></tr>`).join('')}</table>
        <h3 style="margin-top:14px">Chauffeur toevoegen</h3>
        <form id="df" class="fields" style="grid-template-columns:1fr 1fr">
          <label>Naam<input name="fullName" required></label><label>E-mail<input name="email" type="email" required></label>
          <label>Telefoon<input name="phone" required minlength="6"></label><label>Wachtwoord<input name="password" type="password" minlength="10" required></label>
          <label style="grid-column:1/-1;flex-direction:row;display:flex;gap:8px;align-items:center"><input type="checkbox" name="canAcceptRequests" style="width:auto"> Mag aanvragen aanvaarden</label>
          <button class="btn sm">Toevoegen</button></form>
        <p class="small muted">Een nieuwe chauffeur moet door Ritna-beheer geactiveerd worden.</p></div>
      <div class="card"><h2>Voertuigen</h2><table><tr><th>Plaat</th><th>Wagen</th><th>Cat.</th><th>Plaatsen</th></tr>${vehicles.map((v) => `<tr><td>${esc(v.plate)}</td><td>${esc((v.make || '') + ' ' + (v.model || ''))}</td><td>${esc(v.category)}</td><td>${v.seats}</td></tr>`).join('')}</table>
        <h3 style="margin-top:14px">Voertuig toevoegen</h3>
        <form id="vf" class="fields" style="grid-template-columns:1fr 1fr">
          <label>Nummerplaat<input name="plate" required></label><label>Categorie<select name="category"><option value="standard">standard</option><option value="van">van</option></select></label>
          <label>Merk<input name="make"></label><label>Model<input name="model"></label>
          <label>Plaatsen<input name="seats" type="number" min="1" max="8" value="4"></label><label>Bagage<input name="luggageCapacity" type="number" min="0" max="20" value="3"></label>
          <button class="btn sm">Toevoegen</button></form></div></div>`;
    $('#df').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const r = await run(() => api('POST', '/v1/operator/drivers', { fullName: f.get('fullName'), email: f.get('email'), phone: f.get('phone'), password: f.get('password'), canAcceptRequests: !!f.get('canAcceptRequests') }), 'Chauffeur toegevoegd');
      if (r) renderOperator();
    };
    $('#vf').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const body = { plate: f.plate, category: f.category, seats: +f.seats, luggageCapacity: +f.luggageCapacity };
      if (f.make) body.make = f.make; if (f.model) body.model = f.model;
      const r = await run(() => api('POST', '/v1/operator/vehicles', body), 'Voertuig toegevoegd');
      if (r) renderOperator();
    };
  }

  async function renderTariffs(pane) {
    const [tariffs, me] = await Promise.all([run(() => api('GET', '/v1/operator/tariffs')), run(() => api('GET', '/v1/operator/me'))]);
    if (!tariffs || !me) return;
    const row = (t) => `<form class="card" data-tar="${esc(t.category)}"><h3>Categorie ${esc(t.category)}</h3><div class="fields">
      <label>Instap (cent)<input name="baseFare" type="number" value="${t.base_fare}"></label><label>Per km (cent)<input name="perKm" type="number" value="${t.per_km}"></label>
      <label>Per minuut (cent)<input name="perMinute" type="number" value="${t.per_minute}"></label><label>Minimumprijs (cent)<input name="minimumFare" type="number" value="${t.minimum_fare}"></label>
      <label>Nachttoeslag (cent)<input name="nightSurcharge" type="number" value="${t.night_surcharge}"></label></div><button class="btn sm">Opslaan</button></form>`;
    pane.innerHTML = `<div class="card"><h2>${esc(me.trade_name || me.tradeName || '')}</h2><p class="small muted">Status: ${esc(me.status)} · gratis annuleren tot ${esc(me.cancel_free_until_min)} min · wachttijd no-show ${esc(me.no_show_wait_min)} min · aanvaardtermijn ${esc(me.accept_timeout_sec)} s</p></div>${tariffs.map(row).join('')}
      <p class="small muted">Bedragen in centen, incl. btw. Testwaarden, geen markttarieven.</p>`;
    pane.querySelectorAll('[data-tar]').forEach((form) => (form.onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)]));
      await run(() => api('PUT', `/v1/operator/tariffs/${form.dataset.tar}`, body), 'Tarief opgeslagen');
    }));
  }

  // =============================================================== CHAUFFEUR
  const NEXT = { driver_assigned: ['driver_en_route', 'Vertrek naar klant'], driver_en_route: ['driver_arrived', 'Ik ben aangekomen'], driver_arrived: ['in_progress', 'Rit starten'], in_progress: ['completed', 'Rit voltooien'] };
  let drvTab = 'ritten';
  async function renderDriver() {
    const me = await run(() => api('GET', '/v1/driver/me'));
    if (!me) return;
    main.innerHTML = `<div class="row" style="justify-content:space-between"><div><h1>Chauffeur</h1><p class="muted">${esc(me.operator)} · status ${esc(me.status)}</p></div>
      <button class="btn ${me.is_available ? 'yel' : 'alt'}" id="avail">${me.is_available ? 'Beschikbaar ✓' : 'Niet beschikbaar'}</button></div>
      ${tabs([['ritten', 'Mijn ritten'], ['aanvragen', 'Aanvragen'], ['historiek', 'Historiek']], drvTab)}<div id="pane"><p class="muted">Laden…</p></div>`;
    bindTabs((t) => { drvTab = t; renderDriver(); });
    $('#avail').onclick = async () => { const r = await run(() => api('PATCH', '/v1/driver/me', { isAvailable: !me.is_available })); if (r) renderDriver(); };
    const pane = $('#pane');
    if (drvTab === 'ritten') {
      const list = await run(() => api('GET', '/v1/driver/rides'));
      if (!list) return;
      pane.innerHTML = list.length ? list.map((r) => `<div class="card"><div class="row" style="justify-content:space-between"><div><h3>${esc(r.pickup_address)} → ${esc(r.dropoff_address)}</h3>
        <div class="small muted">${dt(r.pickup_at)} · ${r.passengers} pers. · ${r.luggage_items} bagage${r.notes ? ' · “' + esc(r.notes) + '”' : ''}</div></div>${pill(r.status)}</div>
        <div class="row" style="margin-top:8px">${NEXT[r.status] ? `<button class="btn yel" data-step="${r.id}" data-to="${NEXT[r.status][0]}">${NEXT[r.status][1]}</button>` : ''}
        ${r.status === 'driver_arrived' ? `<button class="btn bad sm" data-step="${r.id}" data-to="no_show">Klant niet gekomen</button>` : ''}
        <button class="btn alt sm" data-inc="${r.id}">Incident</button></div></div>`).join('') : '<p class="empty">Geen toegewezen ritten.</p>';
      pane.querySelectorAll('[data-step]').forEach((b) => (b.onclick = async () => {
        const r = await run(() => api('POST', `/v1/driver/rides/${b.dataset.step}/status`, { status: b.dataset.to }), 'Status bijgewerkt');
        if (r) renderDriver();
      }));
      pane.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => reportIncident(b.dataset.inc)));
    } else if (drvTab === 'aanvragen') {
      const list = await run(() => api('GET', '/v1/driver/requests'));
      if (!list) return;
      pane.innerHTML = list.length ? list.map((r) => `<div class="option"><div><strong>${esc(r.pickup_address)} → ${esc(r.dropoff_address)}</strong><div class="small muted">${dt(r.pickup_at)} · verloopt ${dt(r.expires_at)}</div></div>
        <div class="row"><strong class="num">${eur(r.price_cents)}</strong><button class="btn yel sm" data-acc="${r.ride_id}">Aanvaarden</button></div></div>`).join('') : '<p class="empty">Geen aanvragen (of je mag geen aanvragen aanvaarden).</p>';
      pane.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = async () => {
        const r = await run(() => api('POST', `/v1/operator/rides/${b.dataset.acc}/accept`, {}), 'Rit aanvaard');
        if (r) { drvTab = 'ritten'; renderDriver(); }
      }));
    } else {
      const list = await run(() => api('GET', '/v1/driver/history'));
      if (!list) return;
      pane.innerHTML = `<div class="card tablewrap">${list.length ? `<table><tr><th>Datum</th><th>Traject</th><th>Status</th><th class="num">Prijs</th></tr>${list.map((r) => `<tr><td>${dt(r.pickup_at)}</td><td>${esc(r.pickup_address)} → ${esc(r.dropoff_address)}</td><td>${pill(r.status)}</td><td class="num">${eur(r.price_cents)}</td></tr>`).join('')}</table>` : '<p class="empty">Nog geen voltooide ritten.</p>'}</div>`;
    }
  }

  // =============================================================== BEHEER
  let admTab = 'aandacht';
  async function renderAdmin() {
    main.innerHTML = `<h1>Platformbeheer</h1>${tabs([['aandacht', 'Aandachtslijst'], ['cijfers', 'Cijfers'], ['vervoerders', 'Vervoerders'], ['ritten', 'Ritten']], admTab)}<div id="pane"><p class="muted">Laden…</p></div>`;
    bindTabs((t) => { admTab = t; renderAdmin(); });
    const pane = $('#pane');
    if (admTab === 'aandacht') {
      const a = await run(() => api('GET', '/v1/admin/attention'));
      if (!a) return;
      const block = (title, arr, fmt) => `<div class="card"><h3>${esc(title)} <span class="pill ${arr.length ? 'warn' : 'ok'}">${arr.length}</span></h3>${arr.length ? '<ul class="small">' + arr.map((x) => '<li>' + fmt(x) + '</li>').join('') + '</ul>' : '<p class="empty small">Niets.</p>'}</div>`;
      pane.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn alt sm" id="tick">Verlopen aanvragen nu verwerken</button><button class="btn alt sm" id="payout">Uitbetalingsrun starten</button></div>
        <div class="grid">
        ${block('Aanvragen die bijna verlopen', a.expiringOffers, (x) => `rit ${esc(x.ride_id.slice(0, 8))} · verloopt ${dt(x.expires_at)}`)}
        ${block('Bevestigd zonder chauffeur (< 1 u)', a.acceptedWithoutDriver, (x) => `rit ${esc(x.id.slice(0, 8))} · ${dt(x.pickup_at)}`)}
        ${block('Nog niet vertrokken, ophalen nabij', a.notStartedNearPickup, (x) => `rit ${esc(x.id.slice(0, 8))} · ${dt(x.pickup_at)}`)}
        ${block('Open incidenten', a.incidents, (x) => `${esc(x.kind)}: ${esc(x.description)} <button class="btn sm alt" data-resolve="${x.id}">Afsluiten</button>`)}
        ${block('Documenten die vervallen', a.expiringDocs, (x) => `${esc(x.doc_type)} (${esc(x.owner_type)}) · ${esc(String(x.expires_on).slice(0, 10))}`)}
        ${block('Vervoerders wachten op activatie', a.pendingOperators, (x) => esc(x.trade_name))}
        </div>`;
      $('#tick').onclick = async () => { const r = await run(() => api('POST', '/v1/admin/tick')); if (r) { toast(`${r.expiredOffersHandled} verlopen aanvragen verwerkt`); renderAdmin(); } };
      $('#payout').onclick = async () => { const r = await run(() => api('POST', '/v1/admin/payouts/run')); if (r) toast(r.length ? r.map((x) => `${eur(x.amountCents)}: ${x.status}`).join(' · ') : 'Niets uit te betalen'); };
      pane.querySelectorAll('[data-resolve]').forEach((b) => (b.onclick = async () => {
        const resolution = prompt('Hoe is het opgelost?');
        if (!resolution) return;
        const r = await run(() => api('POST', `/v1/admin/incidents/${b.dataset.resolve}/resolve`, { resolution }), 'Incident afgesloten');
        if (r) renderAdmin();
      }));
    } else if (admTab === 'cijfers') {
      const s = await run(() => api('GET', '/v1/admin/stats?' + range(30, 1)));
      if (!s) return;
      const m = (t) => s.money.find((x) => x.entry_type === t)?.total ?? 0;
      pane.innerHTML = `<div class="grid">
        <div class="card"><div class="muted small">Klantbetalingen (30 d)</div><div class="stat num">${eur(m('customer_charge'))}</div></div>
        <div class="card"><div class="muted small">Commissie Ritna</div><div class="stat num">${eur(m('platform_commission'))}</div></div>
        <div class="card"><div class="muted small">Btw op commissie</div><div class="stat num">${eur(m('commission_vat'))}</div></div>
        <div class="card"><div class="muted small">Klanten met voltooide rit</div><div class="stat num">${s.customers.customers}</div><div class="small muted">${s.customers.repeat_customers} terugkerend</div></div></div>
        <div class="card"><h2>Ritten per status</h2>${s.ridesByStatus.length ? `<table>${s.ridesByStatus.map((r) => `<tr><td>${pill(r.status)}</td><td class="num">${r.n}</td></tr>`).join('')}</table>` : '<p class="empty">Nog geen ritten.</p>'}</div>`;
    } else if (admTab === 'vervoerders') {
      const list = await run(() => api('GET', '/v1/admin/operators'));
      if (!list) return;
      pane.innerHTML = `<div class="card tablewrap"><table><tr><th>Vervoerder</th><th>KBO</th><th>Status</th><th></th></tr>${list.map((o) => `<tr><td>${esc(o.trade_name)}<div class="small muted">${esc(o.legal_name)}</div></td><td>${esc(o.enterprise_number)}</td><td>${pill(o.status === 'active' ? 'completed' : o.status === 'pending' ? 'requested' : 'cancelled_by_platform', o.status)}</td>
        <td class="row">${o.status !== 'active' ? `<button class="btn sm yel" data-act="${o.id}">Activeren</button>` : `<button class="btn sm bad" data-susp="${o.id}">Schorsen</button>`}</td></tr>`).join('')}</table></div>`;
      pane.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => { const r = await run(() => api('POST', `/v1/admin/operators/${b.dataset.act}/activate`), 'Vervoerder geactiveerd'); if (r) renderAdmin(); }));
      pane.querySelectorAll('[data-susp]').forEach((b) => (b.onclick = async () => { if (!confirmInline(b, 'Zeker schorsen?')) return; const r = await run(() => api('POST', `/v1/admin/operators/${b.dataset.susp}/suspend`), 'Vervoerder geschorst'); if (r) renderAdmin(); }));
    } else {
      const list = await run(() => api('GET', '/v1/admin/rides?' + range(30, 30)));
      if (!list) return;
      pane.innerHTML = `<div class="card tablewrap">${list.length ? `<table><tr><th>Ophalen</th><th>Vervoerder</th><th>Modus</th><th>Status</th><th class="num">Prijs</th><th></th></tr>${list.map((r) => `<tr><td>${dt(r.pickup_at)}</td><td>${esc(r.operator || '—')}</td><td>${esc(r.booking_mode)}</td><td>${pill(r.status)}</td><td class="num">${eur(r.price_cents ?? r.max_price_cents)}</td><td><button class="btn sm alt" data-det="${r.id}">Detail</button></td></tr>`).join('')}</table>` : '<p class="empty">Geen ritten.</p>'}</div><div id="det"></div>`;
      pane.querySelectorAll('[data-det]').forEach((b) => (b.onclick = async () => {
        const d = await run(() => api('GET', `/v1/admin/rides/${b.dataset.det}`));
        if (!d) return;
        $('#det').innerHTML = `<div class="card"><h2>Rit ${esc(d.ride.id.slice(0, 8))}</h2>
          <p>${esc(d.ride.pickup_address)} → ${esc(d.ride.dropoff_address)} · ${pill(d.ride.status)}</p>
          <h3>Grootboek</h3>${d.ledger.length ? `<table>${d.ledger.map((l) => `<tr><td>${esc(l.entry_type)}</td><td class="num">${eur(l.amount_cents)}</td></tr>`).join('')}</table>` : '<p class="empty small">Nog geen boekingen (pas bij voltooien).</p>'}
          <h3>Betaling</h3><p class="small">${d.payment ? `${esc(d.payment.status)} · gereserveerd ${eur(d.payment.authorized_cents)} · geïnd ${eur(d.payment.captured_cents)} · terugbetaald ${eur(d.payment.refunded_cents)}` : '—'}</p>
          <h3>Aanbiedingen</h3><ul class="small">${d.offers.map((o) => `<li>#${o.sequence} ${esc(o.status)} · ${eur(o.price_cents)}</li>`).join('') || '<li>—</li>'}</ul>
          <h3>Tijdlijn</h3><ul class="timeline">${d.events.map((e) => `<li>${dt(e.at)} — ${esc(e.from_status || '·')} → ${esc(e.to_status)}</li>`).join('')}</ul></div>`;
      }));
    }
  }

  // --------------------------------------------------------------- router
  function render() {
    renderWho();
    if (!session) return renderLogin();
    const role = session.user.role;
    if (role === 'customer') return renderCustomer();
    if (role === 'operator_admin') return renderOperator();
    if (role === 'driver') return renderDriver();
    if (role === 'platform_admin') return renderAdmin();
    main.innerHTML = '<p>Onbekende rol.</p>';
  }
  render();
})();
