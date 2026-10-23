/* KetelCheck – aanvraagformulier (NL/FR). Geen frameworks, geen cookies. */
(function () {
  "use strict";

  // ===== CONFIG: vul na deploy van de Apps Script web app in =====
  // De waarden staan in /assets/config.js (window.KETELCHECK_CONFIG).
  var SITE = window.KETELCHECK_CONFIG || {};
  var CONFIG = {
    // Lokaal (localhost) praat het formulier met lokaal/server.cjs; online met Apps Script.
    endpoint: /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
      ? "/exec"
      : SITE.endpoint,
    // Startregio: Brussel (1000-1299) + Vlaamse Rand / Halle-Vilvoorde (1500-1999)
    regions: [[1000, 1299], [1500, 1999]]
  };

  var lang = (document.documentElement.lang || "nl").slice(0, 2);
  var T = {
    nl: {
      required: "Vul de verplichte velden in.",
      postcode: "Geef een geldige Belgische postcode (4 cijfers).",
      region: "We zijn voorlopig enkel actief in Brussel en de Vlaamse Rand (postcodes 1000-1299 en 1500-1999). Je aanvraag is niet verstuurd.",
      gas: "We behandelen voorlopig enkel de vervanging van gasketels. Je aanvraag is niet verstuurd.",
      tenant: "De vervanging van een ketel beslist de eigenaar. Vraag je verhuurder om de aanvraag in te dienen. Je aanvraag is niet verstuurd.",
      phone: "Geef een geldig Belgisch telefoonnummer.",
      email: "Geef een geldig e-mailadres.",
      consent: "Zonder toestemming kunnen we je aanvraag niet doorgeven.",
      sending: "Bezig met versturen…",
      fail: "Versturen lukte niet. Probeer opnieuw of mail ons rechtstreeks.",
      dup: "We hebben recent al een aanvraag van jou ontvangen. We nemen contact op."
    },
    fr: {
      required: "Veuillez remplir les champs obligatoires.",
      postcode: "Indiquez un code postal belge valide (4 chiffres).",
      region: "Nous sommes pour l'instant actifs uniquement à Bruxelles et dans la périphérie flamande (codes postaux 1000-1299 et 1500-1999). Votre demande n'a pas été envoyée.",
      gas: "Pour l'instant, nous traitons uniquement le remplacement de chaudières au gaz. Votre demande n'a pas été envoyée.",
      tenant: "Le remplacement d'une chaudière est décidé par le propriétaire. Demandez à votre bailleur d'introduire la demande. Votre demande n'a pas été envoyée.",
      phone: "Indiquez un numéro de téléphone belge valide.",
      email: "Indiquez une adresse e-mail valide.",
      consent: "Sans votre accord, nous ne pouvons pas transmettre votre demande.",
      sending: "Envoi en cours…",
      fail: "L'envoi a échoué. Réessayez ou écrivez-nous directement.",
      dup: "Nous avons déjà reçu récemment une demande de votre part. Nous vous recontactons."
    }
  }[lang] || null;

  // UTM / herkomst bijhouden (sessionStorage = alleen deze tab, geen cookie)
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"];
  function readUtm() {
    var out = {};
    var qs = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (k) {
      var v = qs.get(k);
      if (v) {
        out[k] = v.slice(0, 200);
        try { sessionStorage.setItem("kc_" + k, out[k]); } catch (e) { /* geen storage: negeren */ }
      } else {
        try { var s = sessionStorage.getItem("kc_" + k); if (s) out[k] = s; } catch (e) { /* idem */ }
      }
    });
    return out;
  }
  var utm = readUtm();
  var loadedAt = Date.now();

  function inRegion(pc) {
    return CONFIG.regions.some(function (r) { return pc >= r[0] && pc <= r[1]; });
  }

  function normPhone(raw) {
    var p = String(raw || "").replace(/[\s.\-\/()]/g, "");
    if (p.indexOf("0032") === 0) p = "+32" + p.slice(4);
    else if (p.indexOf("0") === 0) p = "+32" + p.slice(1);
    return /^\+32[1-9]\d{7,8}$/.test(p) ? p : null;
  }

  function val(form, name) {
    var el = form.elements[name];
    if (!el) return "";
    if (el instanceof RadioNodeList) return el.value || "";
    return (el.value || "").trim();
  }

  var form = document.getElementById("aanvraag");
  if (!form || !T) return;
  var msg = document.getElementById("msg");
  var btn = form.querySelector("button[type=submit]");
  var done = document.getElementById("done");

  function show(text, cls) {
    msg.textContent = text;
    msg.className = "msg " + (cls || "");
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    show("");

    // honeypot: bots vullen dit veld in
    if (val(form, "website")) { form.style.display = "none"; done.style.display = "block"; return; }

    var required = ["postcode", "brandstof", "situatie", "offerte", "termijn", "eigenaar", "naam", "telefoon", "email"];
    for (var i = 0; i < required.length; i++) {
      if (!val(form, required[i])) { show(T.required, "err"); return; }
    }
    if (val(form, "brandstof") !== "gas") { show(T.gas, "err"); return; }
    if (val(form, "eigenaar") === "huurder") { show(T.tenant, "err"); return; }
    var pcRaw = val(form, "postcode");
    if (!/^\d{4}$/.test(pcRaw)) { show(T.postcode, "err"); return; }
    var pc = parseInt(pcRaw, 10);
    if (!inRegion(pc)) { show(T.region, "err"); return; }
    var phone = normPhone(val(form, "telefoon"));
    if (!phone) { show(T.phone, "err"); return; }
    var email = val(form, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { show(T.email, "err"); return; }
    if (!form.elements["toestemming"].checked) { show(T.consent, "err"); return; }

    var payload = {
      lang: lang,
      postcode: pcRaw,
      gemeente: val(form, "gemeente"),
      brandstof: val(form, "brandstof"),
      merk: val(form, "merk"),
      leeftijd: val(form, "leeftijd"),
      situatie: val(form, "situatie"),
      offerte: val(form, "offerte"),
      offerte_bedrag: val(form, "offerte_bedrag"),
      termijn: val(form, "termijn"),
      eigenaar: val(form, "eigenaar"),
      naam: val(form, "naam"),
      telefoon: phone,
      email: email,
      opmerking: val(form, "opmerking").slice(0, 1000),
      toestemming: "ja",
      pagina: window.location.pathname,
      elapsed_ms: Date.now() - loadedAt,
      utm: utm
    };

    btn.disabled = true;
    show(T.sending);

    // text/plain = 'simple request' => geen CORS-preflight naar Apps Script
    fetch(CONFIG.endpoint, { method: "POST", body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          form.style.display = "none";
          done.style.display = "block";
          if (res.duplicate) { done.querySelector("p").textContent = T.dup; }
          if (window.gtag) { try { window.gtag("event", "generate_lead"); } catch (e) { /* noop */ } }
        } else {
          btn.disabled = false;
          show((res && res.error) || T.fail, "err");
        }
      })
      .catch(function () {
        btn.disabled = false;
        show(T.fail, "err");
      });
  });
})();
