/// <reference types="node" />
/**
 * Snelle zelftest voor de lokale heuristiek en de OS-versiebeoordeling.
 * Start met: npm run test:heuristics
 */
import assert from 'node:assert/strict';

import { analyzeText, analyzeUrl, extractUrls, isValidEmail } from '../src/scan/heuristics';
import { evaluateOsVersion } from '../src/scan/osVersion';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FOUT ${name}`);
    throw err;
  }
}

const ids = (text: string) => analyzeText(text).signals.map((s) => s.id);

console.log('Heuristiek');
test('lege invoer', () => assert.equal(analyzeText('   ').verdict, 'empty'));
test('gewone tekst zonder signalen', () => {
  const r = analyzeText('Hey, zien we elkaar zaterdag om 14u bij de bakker?');
  assert.equal(r.verdict, 'no_signals');
  assert.equal(r.signals.length, 0);
});
test('officieel domein geeft geen merk-signaal', () => {
  assert.deepEqual(analyzeUrl('https://www.bpost.be/nl/track'), []);
  assert.deepEqual(analyzeUrl('https://mijn.ing.be'), []);
  assert.deepEqual(analyzeUrl('https://www.kbc.be'), []);
});
test('gewone woorden met merk-letters geven geen vals alarm', () => {
  assert.deepEqual(analyzeUrl('https://www.shopping-center.be'), []);
  assert.deepEqual(analyzeUrl('https://pineapple.com'), []);
  assert.deepEqual(analyzeUrl('https://www.booking.com'), []);
});
test('nagebootst merkdomein', () => {
  assert.ok(analyzeUrl('https://bpost-pakket-betaling.com/x').some((s) => s.id === 'brand_mismatch'));
  assert.ok(analyzeUrl('https://ing.be.verify-login.top').some((s) => s.id === 'brand_mismatch'));
  assert.ok(analyzeUrl('mijndigid-login.nl').some((s) => s.id === 'brand_mismatch'));
});
test('verkorte link', () => assert.ok(analyzeUrl('https://bit.ly/3abcDEF').some((s) => s.id === 'shortener')));
test('IP-adres', () => assert.ok(analyzeUrl('http://192.168.12.5/login').some((s) => s.id === 'ip_host')));
test('punycode', () => assert.ok(analyzeUrl('https://xn--pypal-4ve.com').some((s) => s.id === 'punycode')));
test('@ in link', () => assert.ok(analyzeUrl('https://www.kbc.be@evil.example.com/').some((s) => s.id === 'userinfo')));
test('klassieke pakket-sms is verdacht', () => {
  const r = analyzeText('bpost: uw pakket wacht. Betaal vandaag nog €1,99 verzendkosten via https://bpost-be.delivery-fee.top/pay');
  assert.equal(r.verdict, 'suspicious');
  assert.ok(ids('bpost: uw pakket wacht. Betaal vandaag nog €1,99 verzendkosten via https://bpost-be.delivery-fee.top/pay').includes('link_plus_pressure'));
});
test('hoi mam-bericht', () => {
  const r = analyzeText('Hoi mam, dit is mijn nieuw nummer. Mijn telefoon is kapot, kun je iets voor me betalen?');
  assert.ok(r.signals.some((s) => s.id === 'family_impersonation'));
  assert.notEqual(r.verdict, 'no_signals');
});
test('vraag om pincode', () => assert.ok(ids('Bevestig uw gegevens en geef uw pincode in').includes('credentials')));
test('e-mailadres in tekst wordt geen link', () => assert.deepEqual(extractUrls('mail naar jan@voorbeeld.be aub'), []));
test('links worden uit tekst gehaald', () => {
  const urls = extractUrls('Kijk op www.voorbeeld.be/info, of https://bit.ly/x.');
  assert.deepEqual(urls, ['www.voorbeeld.be/info', 'https://bit.ly/x']);
});

console.log('E-mailvalidatie');
test('geldig', () => assert.ok(isValidEmail('naam@voorbeeld.be')));
test('ongeldig', () => {
  assert.ok(!isValidEmail('naam@voorbeeld'));
  assert.ok(!isValidEmail('naam voorbeeld.be'));
  assert.ok(!isValidEmail('@voorbeeld.be'));
});

console.log('OS-versie');
test('Android', () => {
  assert.equal(evaluateOsVersion('android', '16').outcome, 'good');
  assert.equal(evaluateOsVersion('android', '13').outcome, 'attention');
  assert.equal(evaluateOsVersion('android', '11').outcome, 'risk');
});
test('iOS', () => {
  assert.equal(evaluateOsVersion('ios', '26.1').outcome, 'good');
  assert.equal(evaluateOsVersion('ios', '17.6.1').outcome, 'attention');
  assert.equal(evaluateOsVersion('ios', '15.8').outcome, 'risk');
  assert.equal(evaluateOsVersion('ios', 'abc').outcome, 'unknown');
});

console.log(`\n${passed} tests geslaagd.`);
