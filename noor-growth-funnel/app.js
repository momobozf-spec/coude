// Noor aanmeldformulier. Bewaart NIETS in de browser: aanmeldingen gaan alleen naar
// NOOR_CONFIG.LEAD_ENDPOINT. Is dat leeg, dan meldt de pagina dat aanmelden nog niet actief is.
(function () {
  const config = window.NOOR_CONFIG;
  const funnel = window.NoorFunnel;
  const leadForm = document.getElementById('lead-capture-form');
  const formStatus = document.getElementById('form-status');
  const submitButton = leadForm.querySelector('button[type="submit"]');

  funnel.purgeLegacyStorage(window.localStorage);

  function setStatus(message, kind) {
    formStatus.textContent = message;
    formStatus.dataset.kind = kind;
  }

  if (!config.LEAD_ENDPOINT) {
    setStatus('Let op: aanmelden is nog niet actief. Er wordt niets verzonden of bewaard.', 'inactive');
  }

  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (leadForm.elements.website && leadForm.elements.website.value) return; // honeypot

    const formData = new FormData(leadForm);
    const lead = funnel.buildLead({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      country: formData.get('country'),
      persona: formData.get('persona'),
      childrenAge: formData.get('childrenAge'),
      interests: formData.getAll('interests'),
      biggestProblem: formData.get('biggestProblem'),
      topOffer: formData.get('topOffer'),
      budget: formData.get('budget'),
      urgency: formData.get('urgency'),
      willingToPay: formData.get('willingToPay'),
      consent: formData.get('consent') === 'on'
    });

    const errors = funnel.validate(lead);
    if (errors.length) { setStatus(errors.join(' '), 'error'); return; }

    submitButton.disabled = true;
    if (config.LEAD_ENDPOINT) setStatus('Bezig met verzenden…', 'pending');
    const result = await funnel.submitLead(config.LEAD_ENDPOINT, lead, (url, init) => window.fetch(url, init));
    submitButton.disabled = false;
    setStatus(result.message, result.status);
    if (result.status === 'ok') leadForm.reset();
  });

  document.querySelectorAll('[data-legal-line]').forEach((node) => { node.textContent = funnel.legalLine(config.legal); });
  document.querySelectorAll('[data-contact-email]').forEach((node) => {
    node.textContent = config.contactEmail;
    if (node.tagName === 'A') node.href = 'mailto:' + config.contactEmail;
  });
})();
