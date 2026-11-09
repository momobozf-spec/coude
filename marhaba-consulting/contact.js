// Pure hulpfuncties voor het contactformulier en de wettelijke vermeldingen.
// Klassiek script (geen module) zodat het zonder build in de browser werkt;
// in de tests wordt het in een vm-context geladen.
(function (root) {
  'use strict';

  var MAX_MAILTO_BODY = 1800; // sommige mailclients kappen lange mailto-URL's af

  function clean(value, max) {
    return String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim().slice(0, max || 5000);
  }

  function normalize(fields) {
    return {
      name: clean(fields.name, 120),
      company: clean(fields.company, 160),
      email: clean(fields.email, 200),
      interest: clean(fields.interest, 120),
      message: clean(fields.message, 5000)
    };
  }

  function validate(fields) {
    var f = normalize(fields);
    var errors = [];
    if (!f.name) errors.push('Vul je naam in.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.push('Vul een geldig e-mailadres in.');
    if (!f.message) errors.push('Beschrijf kort je uitdaging.');
    return errors;
  }

  function subject(fields) {
    var f = normalize(fields);
    return 'Contactaanvraag via website: ' + (f.interest || 'Algemeen') + (f.company ? ' (' + f.company + ')' : '');
  }

  function briefText(fields) {
    var f = normalize(fields);
    return 'Naam: ' + f.name + '\n' +
      'Organisatie: ' + (f.company || 'Niet opgegeven') + '\n' +
      'E-mail: ' + f.email + '\n' +
      'Interesse: ' + (f.interest || 'Niet opgegeven') + '\n\n' +
      'UITDAGING\n' + f.message + '\n';
  }

  function buildMailto(to, fields) {
    var body = briefText(fields);
    if (body.length > MAX_MAILTO_BODY) body = body.slice(0, MAX_MAILTO_BODY) + '\n[… ingekort — vul gerust aan in deze e-mail]';
    return 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@') +
      '?subject=' + encodeURIComponent(subject(fields)) +
      '&body=' + encodeURIComponent(body);
  }

  function endpointPayload(fields) {
    var f = normalize(fields);
    return {
      name: f.name,
      company: f.company,
      email: f.email,
      interest: f.interest,
      message: f.message,
      _subject: subject(fields)
    };
  }

  function legalLine(legal) {
    var parts = [legal.entityName, 'Ondernemingsnummer ' + legal.enterpriseNumber];
    parts.push(legal.address ? legal.address : legal.city);
    return parts.join(' · ');
  }

  root.MarhabaContact = {
    normalize: normalize,
    validate: validate,
    subject: subject,
    briefText: briefText,
    buildMailto: buildMailto,
    endpointPayload: endpointPayload,
    legalLine: legalLine
  };
})(typeof window !== 'undefined' ? window : globalThis);
