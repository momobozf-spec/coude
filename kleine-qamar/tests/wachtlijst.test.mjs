import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const dir = new URL('../wachtlijst/', import.meta.url);
const read = (name) => readFile(new URL(name, dir), 'utf8');

test('consenttekst linkt in elke taal naar de privacyverklaring en noemt Brevo', async () => {
  const js = await read('wachtlijst.js');
  for (const lang of ['nl', 'fr', 'ar']) assert.match(js, new RegExp(`href=\\\\?"privacy\\.html#${lang}\\\\?"`), lang);
  assert.equal((js.match(/Brevo/g) || []).length >= 3, true);
});

test('privacyverklaring: NL/FR/AR, Brevo als verwerker, uitbater, concept-markering', async () => {
  const html = await read('privacy.html');
  for (const id of ['nl', 'fr', 'ar']) assert.match(html, new RegExp(`<section id="${id}"`));
  assert.match(html, /Concept — laten nalezen door een jurist/);
  assert.match(html, /Verwerker: Brevo/);
  assert.match(html, /Sous-traitant : Brevo/);
  assert.match(html, /Marhaba Data &amp; AI Agent BV/);
  assert.match(html, /BE 1003\.552\.102/);
  assert.match(html, /Zaventem/);
  assert.match(html, /momobozf@gmail\.com/);
});

test('footer van de wachtlijst toont uitbatergegevens en privacylink', async () => {
  const html = await read('index.html');
  assert.match(html, /Marhaba Data &amp; AI Agent BV · BE 1003\.552\.102 · Zaventem/);
  assert.match(html, /id="privacy-link" href="privacy\.html#nl"/);
  assert.match(html, /mailto:momobozf@gmail\.com/);
});

test('config: één plek voor endpoint en uitbatergegevens, adres als TODO', async () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(await read('config.js'), ctx);
  const c = ctx.window.QAMAR_CONFIG;
  assert.match(c.FORM_ENDPOINT, /^https:\/\/[a-z0-9]+\.sibforms\.com\/serve\//);
  assert.equal(c.legal.entityName, 'Marhaba Data & AI Agent BV');
  assert.equal(c.legal.enterpriseNumber, 'BE 1003.552.102');
  assert.equal(c.legal.address, '');
  assert.match(await read('config.js'), /TODO\(Mohamed\)/);
});

test('geen externe fonts of scripts (geen Google Fonts), fontbestanden aanwezig', async () => {
  for (const name of (await readdir(dir)).filter((n) => /\.(html|css|js)$/.test(n))) {
    const t = await read(name);
    assert.doesNotMatch(t, /fonts\.(googleapis|gstatic)\.com/, name);
    assert.doesNotMatch(t, /<(script|link)[^>]+(src|href)="https?:\/\//, name);
  }
  const css = await read('fonts.css');
  const files = [...css.matchAll(/url\('(fonts\/[^']+)'\)/g)].map((m) => m[1]);
  assert.ok(files.length >= 10);
  for (const f of files) await readFile(new URL(f, dir));
});

test('CSP staat Brevo toe en verder alleen eigen bronnen', async () => {
  const h = await read('_headers');
  const csp = h.split('\n').find((l) => l.includes('Content-Security-Policy'));
  assert.match(csp, /script-src 'self';/);
  assert.match(csp, /connect-src 'self' https:\/\/\*\.sibforms\.com/);
  assert.deepEqual([...csp.matchAll(/https:\/\/[^\s;]+/g)].map((m) => m[0]).filter((u) => !u.endsWith('sibforms.com')), []);
});
