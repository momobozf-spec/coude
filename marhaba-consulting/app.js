const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  menu.setAttribute('aria-expanded', 'false'); navigation.classList.remove('open');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) {
    navigation.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.focus();
  }
});
const scenarios = {
  support: { label: 'SNELLERE KLANTENSERVICE', question: '“Onze klanten wachten te lang op een antwoord.”', steps: ['Terugkerende vragen in kaart brengen', 'Antwoorden en afspraken bundelen', 'Voorbereidend werk ondersteunen met AI'], title: 'Meer aandacht voor je klant', answer: 'De medewerker krijgt een antwoordvoorstel en houdt de controle. Samen volgen we de responstijd en kwaliteit op om te beoordelen wat verbetert.' },
  knowledge: { label: 'SOEPELER SAMENWERKEN', question: '“Ons team verliest veel tijd met informatie zoeken.”', steps: ['Knelpunten en informatiebehoeften bepalen', 'Kennis toegankelijk en actueel maken', 'Zoekwerk gericht ondersteunen'], title: 'Kennis die je team verder helpt', answer: 'Medewerkers vinden afspraken en werkinstructies makkelijker terug. We toetsen samen of dit zoektijd vermindert en de samenwerking verbetert.' },
  report: { label: 'MEER GRIP OP JE BEDRIJF', question: '“We hebben cijfers, maar missen overzicht om te sturen.”', steps: ['Bepalen welke beslissingen inzicht vragen', 'Relevante bedrijfsinformatie samenbrengen', 'Een vast ritme voor opvolging afspreken'], title: 'Van overzicht naar gerichte keuzes', answer: 'Een helder overzicht helpt je afwijkingen bespreken en prioriteiten bepalen. We spreken af wie de informatie controleert en acties opvolgt.' }
};
let activeScenario = 'support';
let playback = 0;
const replay = document.querySelector('#replay');
function renderScenario(key) {
  playback++;
  activeScenario = key;
  const scenario = scenarios[key];
  document.querySelector('.scenario-label').textContent = scenario.label;
  document.querySelector('#demo-question').textContent = scenario.question;
  document.querySelector('#demo-steps').replaceChildren(...scenario.steps.map((label, index) => {
    const row = document.createElement('div');
    const number = document.createElement('span'); number.textContent = index + 1;
    const check = document.createElement('i'); check.textContent = '✓';
    row.append(number, document.createTextNode(label), check); return row;
  }));
  document.querySelector('#answer-title').textContent = scenario.title;
  document.querySelector('#answer-text').textContent = scenario.answer;
  document.querySelectorAll('.demo-option').forEach(button => {
    const selected = button.dataset.scenario === key;
    button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
  });
  replay.disabled = false;
  replay.innerHTML = 'Bekijk de stappen <span>▶</span>';
}
document.querySelectorAll('.demo-option').forEach(button => button.addEventListener('click', () => renderScenario(button.dataset.scenario)));
replay.addEventListener('click', async () => {
  const id = ++playback;
  replay.disabled = true; replay.textContent = 'Stappen bekijken…';
  const rows = [...document.querySelectorAll('#demo-steps > div')];
  rows.forEach(row => { row.classList.add('pending'); row.querySelector('i').textContent = '·'; });
  document.querySelector('#answer-title').textContent = 'Van vraag naar aanpak';
  document.querySelector('#answer-text').textContent = 'Bekijk hoe we deze bedrijfsuitdaging stap voor stap aanpakken.';
  for (const row of rows) {
    await new Promise(resolve => setTimeout(resolve, 650));
    if (id !== playback) return;
    row.classList.remove('pending'); row.querySelector('i').textContent = '✓';
  }
  renderScenario(activeScenario);
});
document.querySelectorAll('[data-interest]').forEach(link => link.addEventListener('click', () => {
  document.querySelector('#interest').value = link.dataset.interest;
}));
const config = window.MARHABA_CONFIG;
const contact = window.MarhabaContact;
const form = document.querySelector('#project-form');
const formStatus = document.querySelector('#form-status');
const mailtoFallback = document.querySelector('#mailto-fallback');
function formFields() {
  const data = new FormData(form);
  return { name: data.get('name'), company: data.get('company'), email: data.get('email'), interest: data.get('interest'), message: data.get('message') };
}
function openMailto(fields, prefix) {
  const href = contact.buildMailto(config.contactEmail, fields);
  mailtoFallback.href = href;
  mailtoFallback.hidden = false;
  formStatus.textContent = (prefix ? prefix + ' ' : '') + 'Je e-mailprogramma opent met een voorgevuld bericht aan ' + config.contactEmail + '. Klik daar op verzenden. Opent er niets? Gebruik de link hieronder of mail rechtstreeks.';
  window.location.href = href;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (form.elements.website && form.elements.website.value) return; // honeypot: bots vullen dit verborgen veld in
  const fields = formFields();
  const errors = contact.validate(fields);
  if (errors.length) { formStatus.textContent = errors.join(' '); return; }
  const submit = form.querySelector('button[type="submit"]');
  if (!config.formEndpoint) { openMailto(fields); return; }
  submit.disabled = true;
  formStatus.textContent = 'Je bericht wordt verzonden…';
  try {
    const response = await fetch(config.formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(contact.endpointPayload(fields))
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    form.reset();
    mailtoFallback.hidden = true;
    formStatus.textContent = 'Bedankt! Je bericht is verzonden. We antwoorden zo snel mogelijk per e-mail.';
  } catch {
    openMailto(fields, 'Verzenden via het formulier lukte niet.');
  } finally {
    submit.disabled = false;
  }
});
document.querySelector('#download-brief').addEventListener('click', () => {
  const fields = formFields();
  const brief = 'MARHABA — PROJECTBRIEF\n\n' + contact.briefText(fields) + '\nDeze projectbrief is lokaal aangemaakt en niet verzonden.\n';
  const url = URL.createObjectURL(new Blob(['\uFEFF', brief], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'marhaba-projectbrief.txt';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  formStatus.textContent = 'Je projectbrief is gedownload. Er is niets verzonden.';
});
document.querySelectorAll('[data-legal-line]').forEach(node => { node.textContent = contact.legalLine(config.legal); });
document.querySelectorAll('[data-contact-email]').forEach(node => {
  node.textContent = config.contactEmail;
  if (node.tagName === 'A') node.href = 'mailto:' + config.contactEmail;
});
document.querySelector('#year').textContent = new Date().getFullYear();
