// Pure functies voor het Noor-aanmeldformulier (zonder DOM), ook gebruikt in de tests.
(function (root) {
  'use strict';

  var LEGACY_STORAGE_KEY = 'noor-growth-funnel-leads';
  var ALLOWED_CHILD_AGES = ['0-3', '4-6', '7-9', '10+', 'Meerdere leeftijden'];

  function text(value, max) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  // Bouwt exact wat naar het endpoint gaat. Dataminimalisatie: alleen een leeftijdsgroep van
  // kinderen (uit een vaste lijst), nooit namen of andere kindgegevens; geen browsergegevens.
  function buildLead(form) {
    var childrenAge = text(form.childrenAge, 40);
    return {
      submittedAt: new Date().toISOString(),
      name: text(form.name, 80),
      email: text(form.email, 120),
      phone: text(form.phone, 40),
      country: text(form.country, 40),
      persona: text(form.persona, 60),
      childrenAgeGroup: ALLOWED_CHILD_AGES.indexOf(childrenAge) >= 0 ? childrenAge : '',
      interests: (form.interests || []).map(function (i) { return text(i, 80); }).slice(0, 10),
      biggestProblem: text(form.biggestProblem, 400),
      topOffer: text(form.topOffer, 60),
      budget: text(form.budget, 40),
      urgency: text(form.urgency, 40),
      willingToPay: text(form.willingToPay, 60),
      consent: form.consent === true,
      consentText: 'Toestemming voor bewaren van antwoorden en e-mails over Noor (privacyverklaring versie 2026-10-24)',
      source: 'noor-growth-funnel'
    };
  }

  function validate(lead) {
    var errors = [];
    if (!lead.name) errors.push('Vul je naam in.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.push('Vul een geldig e-mailadres in.');
    if (lead.interests.length === 0) errors.push('Kies minstens één interessegebied.');
    if (!lead.consent) errors.push('Geef toestemming om je aan te melden.');
    return errors;
  }

  // Verstuurt de aanmelding. Geeft altijd een resultaatobject terug; gooit nooit.
  function submitLead(endpoint, lead, fetchImpl) {
    if (!endpoint) {
      return Promise.resolve({ status: 'inactive', message: 'Aanmelden is nog niet actief. Je gegevens zijn niet verzonden en nergens bewaard. Probeer het later opnieuw.' });
    }
    return fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(lead)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return { status: 'ok', message: 'Bedankt! Je aanmelding is ontvangen. We houden je op de hoogte.' };
    }).catch(function () {
      return { status: 'error', message: 'Verzenden is niet gelukt. Er is niets bewaard. Probeer het later opnieuw.' };
    });
  }

  // Verwijdert leads die de vroegere versie van deze pagina in de browser bewaarde.
  function purgeLegacyStorage(storage) {
    try { if (storage) storage.removeItem(LEGACY_STORAGE_KEY); } catch (e) { /* geblokkeerde storage: niets te doen */ }
  }

  function legalLine(legal) {
    return 'Noor is een project van ' + legal.entityName + ' · Ondernemingsnummer ' + legal.enterpriseNumber + ' · ' + (legal.address || legal.city);
  }

  root.NoorFunnel = { buildLead: buildLead, validate: validate, submitLead: submitLead, purgeLegacyStorage: purgeLegacyStorage, legalLine: legalLine, LEGACY_STORAGE_KEY: LEGACY_STORAGE_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
