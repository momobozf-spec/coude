import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');

async function loadBrowserScripts() {
  const context = { window: {}, globalThis: {} };
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(await read('config.js'), context);
  vm.runInContext(await read('contact.js'), context);
  return { config: context.window.MARHABA_CONFIG, contact: context.window.MarhabaContact };
}

const sample = { name: 'Sara Peeters', company: 'Bakkerij & Co', email: 'sara@example.be', interest: 'Inzicht & besluitvorming', message: 'Regel 1\nRegel 2 met ?&= tekens' };

test('mailto gaat naar het juiste adres met voorgevuld onderwerp en body', async () => {
  const { config, contact } = await loadBrowserScripts();
  assert.equal(config.contactEmail, 'momobozf@gmail.com');
  const href = contact.buildMailto(config.contactEmail, sample);
  assert.ok(href.startsWith('mailto:momobozf@gmail.com?subject='));
  const url = new URL(href);
  assert.equal(url.searchParams.get('subject'), 'Contactaanvraag via website: Inzicht & besluitvorming (Bakkerij & Co)');
  const body = url.searchParams.get('body');
  assert.match(body, /Naam: Sara Peeters/);
  assert.match(body, /E-mail: sara@example\.be/);
  assert.match(body, /Regel 2 met \?&= tekens/);
});

test('lange berichten worden ingekort zodat de mailto-link bruikbaar blijft', async () => {
  const { contact } = await loadBrowserScripts();
  const href = contact.buildMailto('momobozf@gmail.com', { ...sample, message: 'x'.repeat(5000) });
  const body = new URL(href).searchParams.get('body');
  assert.ok(body.length < 2000);
  assert.match(body, /ingekort/);
});

test('validatie weigert ontbrekende of foute velden', async () => {
  const { contact } = await loadBrowserScripts();
  assert.equal(contact.validate(sample).length, 0);
  assert.equal(contact.validate({ ...sample, email: 'geen-adres' }).length, 1);
  assert.equal(contact.validate({ name: '', email: '', message: '' }).length, 3);
});

test('formulier-endpoint is standaard leeg (mailto is de standaard)', async () => {
  const { config, contact } = await loadBrowserScripts();
  assert.equal(config.formEndpoint, '');
  const payload = contact.endpointPayload(sample);
  assert.equal(payload.email, 'sara@example.be');
  assert.ok(payload._subject.includes('Contactaanvraag'));
});

test('wettelijke vermeldingen: BV-naam, ondernemingsnummer, Zaventem, e-mail; adres alleen uit config', async () => {
  const { config, contact } = await loadBrowserScripts();
  assert.equal(config.legal.entityName, 'Marhaba Data & AI Agent BV');
  assert.equal(config.legal.enterpriseNumber, 'BE 1003.552.102');
  assert.equal(contact.legalLine(config.legal), 'Marhaba Data & AI Agent BV · Ondernemingsnummer BE 1003.552.102 · Zaventem');
  assert.equal(contact.legalLine({ ...config.legal, address: 'Straat 1, 1930 Zaventem' }).endsWith('Straat 1, 1930 Zaventem'), true);
  for (const page of ['index.html', 'privacy.html', 'juridisch.html']) {
    const html = await read(page);
    assert.match(html, /Marhaba Data &amp; AI Agent BV/, page);
    assert.match(html, /BE 1003\.552\.102/, page);
    assert.match(html, /Zaventem/, page);
    assert.match(html, /momobozf@gmail\.com/, page);
    assert.match(html, /href="privacy\.html"/, page);
    assert.match(html, /href="juridisch\.html"/, page);
  }
});

test('juridische pagina\'s zijn gemarkeerd als concept', async () => {
  for (const page of ['privacy.html', 'juridisch.html']) assert.match(await read(page), /Concept — laten nalezen door een jurist/);
});

test('geen externe requests: geen Google Fonts of andere externe scripts/stylesheets/fonts', async () => {
  const names = (await readdir(root)).filter(n => /\.(html|css|js)$/.test(n));
  for (const name of names) {
    const text = await read(name);
    assert.doesNotMatch(text, /fonts\.(googleapis|gstatic)\.com/, name);
    assert.doesNotMatch(text, /<(script|link)[^>]+(src|href)="https?:\/\//, name);
    assert.doesNotMatch(text, /url\(['"]?https?:/, name);
  }
  const css = await read('styles.css');
  for (const [, file] of css.matchAll(/url\('(fonts\/[^']+)'\)/g)) await readFile(new URL(file, root));
});

test('CSP in _headers staat geen externe bronnen toe', async () => {
  const headers = await read('_headers');
  assert.match(headers, /Content-Security-Policy: default-src 'self'; script-src 'self'/);
  assert.match(headers, /Strict-Transport-Security/);
  assert.doesNotMatch(headers.split('\n').find(l => l.includes('Content-Security-Policy')), /https?:/);
});
