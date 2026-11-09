import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');

async function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(await read('config.js'), ctx);
  vm.runInContext(await read('funnel.js'), ctx);
  return { config: ctx.window.NOOR_CONFIG, funnel: ctx.window.NoorFunnel };
}

const input = {
  name: ' Amina ', email: 'amina@example.be', phone: '', country: 'Belgie', persona: 'Mama',
  childrenAge: '4-6', interests: ['Islamitische printables'], biggestProblem: 'Weinig materiaal',
  topOffer: 'Printable bundle', budget: 'Tot €9', urgency: 'Deze maand', willingToPay: 'Ja, direct', consent: true
};

test('endpoint is standaard leeg en dan wordt niets verzonden', async () => {
  const { config, funnel } = await load();
  assert.equal(config.LEAD_ENDPOINT, '');
  let called = false;
  const result = await funnel.submitLead(config.LEAD_ENDPOINT, funnel.buildLead(input), () => { called = true; });
  assert.equal(called, false);
  assert.equal(result.status, 'inactive');
  assert.match(result.message, /nog niet actief/);
});

test('met endpoint: POST JSON naar het endpoint, ok bij 2xx', async () => {
  const { funnel } = await load();
  const calls = [];
  const result = await funnel.submitLead('https://forms.example/x', funnel.buildLead(input), (url, init) => { calls.push({ url, init }); return Promise.resolve({ ok: true, status: 200 }); });
  assert.equal(result.status, 'ok');
  assert.equal(calls[0].url, 'https://forms.example/x');
  assert.equal(calls[0].init.method, 'POST');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.email, 'amina@example.be');
  assert.equal(body.name, 'Amina');
});

test('met endpoint: fout of netwerkfout geeft nette melding, geen exception', async () => {
  const { funnel } = await load();
  const lead = funnel.buildLead(input);
  assert.equal((await funnel.submitLead('https://x', lead, () => Promise.resolve({ ok: false, status: 500 }))).status, 'error');
  assert.equal((await funnel.submitLead('https://x', lead, () => Promise.reject(new Error('offline')))).status, 'error');
});

test('dataminimalisatie kinderen: alleen een leeftijdsgroep uit de vaste lijst', async () => {
  const { funnel } = await load();
  assert.equal(funnel.buildLead(input).childrenAgeGroup, '4-6');
  assert.equal(funnel.buildLead({ ...input, childrenAge: 'Yusuf, 5 jaar' }).childrenAgeGroup, '');
  const keys = Object.keys(funnel.buildLead(input));
  assert.ok(!keys.some((k) => /child(ren)?(Name|Birth|Photo)/i.test(k)));
  assert.ok(!keys.includes('childrenAge'));
});

test('validatie: interesse en toestemming verplicht', async () => {
  const { funnel } = await load();
  assert.deepEqual(funnel.validate(funnel.buildLead(input)).length, 0);
  assert.equal(funnel.validate(funnel.buildLead({ ...input, interests: [], consent: false })).length, 2);
});

test('oude leads in localStorage worden opgeruimd', async () => {
  const { funnel } = await load();
  const removed = [];
  funnel.purgeLegacyStorage({ removeItem: (k) => removed.push(k) });
  assert.deepEqual(removed, ['noor-growth-funnel-leads']);
  funnel.purgeLegacyStorage({ removeItem: () => { throw new Error('blocked'); } }); // mag niet gooien
});

test('geen lead-opslag in de browser en geen publiek dashboard/export', async () => {
  const app = await read('app.js');
  const html = await read('index.html');
  assert.doesNotMatch(app, /localStorage\.setItem|sessionStorage|indexedDB/);
  assert.doesNotMatch(html, /id="dashboard"|export-json|export-csv|lead-table/);
  assert.doesNotMatch(app, /export-json|export-csv|downloadFile/);
});

test('privacyverklaring bestaat, is gelinkt vanuit de toestemming en noemt de uitbater', async () => {
  const html = await read('index.html');
  assert.match(html, /name="consent"[\s\S]{0,400}href="privacy\.html"/);
  const privacy = await read('privacy.html');
  assert.match(privacy, /Concept — laten nalezen door een jurist/);
  for (const page of [html, privacy]) {
    assert.match(page, /Marhaba Data &amp; AI Agent BV/);
    assert.match(page, /BE 1003\.552\.102/);
    assert.match(page, /Zaventem/);
  }
  assert.match(privacy, /leeftijdsgroep/);
});
