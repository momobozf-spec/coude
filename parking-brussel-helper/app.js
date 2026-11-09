const STORAGE_KEY = "parking-brussel-helper-cases";

const checklistItems = {
  fine: [
    "Kopie of foto van de retributie, notificatie of rappel",
    "Bewijs van betaling of parkeersessie, als je betaald had",
    "Bewijs van bewonerskaart of geldige parkeerkaart",
    "Foto's van signalisatie, straat of parkeerautomaat als dat relevant is",
    "Zonecode, parkeerautomaatnummer of totemcode noteren als die zichtbaar is",
    "Korte chronologie met datum, uur, straat en nummerplaat",
  ],
  plate: [
    "Kopie recto-verso identiteitskaart",
    "Inschrijvingsbewijs van het voertuig, recto-verso",
    "Bij leasing of huur: contract met naam van de aanvrager",
    "Bij bedrijfswagen: attest dat jij de enige gebruiker bent",
    "Bij tijdelijk vervangvoertuig: garageattest met duur van immobilisatie",
  ],
};

const zoneInfo = {
  blue: {
    label: "Blauwe zone",
    rule: "Gratis met blauwe parkeerschijf of geldige parkeerkaart. Gewoonlijk maximaal 2 uur, tenzij het bijkomend bord iets anders vermeldt.",
    fee: "Retributie: 37 euro per periode van 4u30.",
  },
  green: {
    label: "Groene zone",
    rule: "Betalend voor bezoekers, zonder maximum parkeerduur. In sommige gemeenten is 15 minuten gratis met specifiek ticket.",
    fee: "Retributie: 37 euro per periode van 4u30.",
  },
  grey: {
    label: "Grijze zone",
    rule: "Betalend met een maximaal toegelaten parkeertijd van 4u30.",
    fee: "Retributie: 47 euro per periode van 4u30.",
  },
  red: {
    label: "Rode zone",
    rule: "Betalend kortparkeren met maximaal 2 uur.",
    fee: "Retributie: 42 euro per periode van 2u.",
  },
  orange: {
    label: "Oranje zone",
    rule: "Betalend parkeren bij lokale handelscentra met maximaal 2 uur.",
    fee: "Retributie: 42 euro per periode van 2u.",
  },
  event: {
    label: "Evenementenzone",
    rule: "Tijdelijke zone bij grote evenementen, betalend met maximaal 4u30.",
    fee: "Retributie: 50 euro per periode van 4u30.",
  },
  delivery: {
    label: "Leveringszone",
    rule: "Bestemd voor laden en lossen, vaak nabij handelszaken.",
    fee: "Retributie: 100 euro per periode van 4u30.",
  },
  kiss: {
    label: "Kiss & Ride",
    rule: "Maximale parkeerduur staat op de borden, vaak 15 minuten.",
    fee: "Retributie: 100 euro per periode van 4u30.",
  },
  reserved: {
    label: "Voorbehouden plaatsen",
    rule: "Voor bewoners en autodeelwagens met geldige vrijstellingskaart.",
    fee: "Retributie: 25 euro per periode van 4u30.",
  },
};

const defaultFineFacts = "Ik betwist deze retributie omdat de vaststelling volgens mij niet overeenkomt met mijn situatie. Zie de bijgevoegde bewijsstukken.";
const defaultPlateNote = "Gelieve mijn bestaande parkeerkaart aan te passen naar de nieuwe nummerplaat. De bewijsstukken zijn toegevoegd.";

let cases = loadCases();
let activeId = cases[0]?.id || null;

const elements = {
  newCaseButton: document.getElementById("new-case-button"),
  caseList: document.getElementById("case-list"),
  emptyList: document.getElementById("empty-list"),
  caseTemplate: document.getElementById("case-template"),
  form: document.getElementById("case-form"),
  tabs: document.querySelectorAll(".tab"),
  fineFields: document.getElementById("fine-fields"),
  plateFields: document.getElementById("plate-fields"),
  checklist: document.getElementById("checklist"),
  resetChecklist: document.getElementById("reset-checklist"),
  letterOutput: document.getElementById("letter-output"),
  copyLetter: document.getElementById("copy-letter"),
  scenarioButtons: document.querySelectorAll(".scenario-card"),
  zoneBox: document.getElementById("zone-box"),
  zoneSummary: document.getElementById("zone-summary"),
  openCount: document.getElementById("open-count"),
  draftCount: document.getElementById("draft-count"),
};

const fields = [
  "name",
  "email",
  "municipality",
  "status",
  "fine-reference",
  "fine-date",
  "plate",
  "street",
  "fine-time",
  "zone",
  "reason",
  "facts",
  "old-plate",
  "new-plate",
  "change-type",
  "replacement-until",
  "plate-note",
];

if (cases.length === 0) {
  createCase("fine");
} else {
  render();
}

elements.newCaseButton.addEventListener("click", () => createCase(getActiveCase()?.type || "fine"));

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    updateActiveCase({ type: tab.dataset.type });
  });
});

elements.form.addEventListener("input", () => {
  const data = readForm();
  updateActiveCase(data, false);
  renderChecklist();
  renderLetter();
  renderCases();
});

elements.form.addEventListener("change", () => {
  const data = readForm();
  updateActiveCase(data, false);
  renderChecklist();
  renderZoneInfo();
  renderLetter();
  renderCases();
});

elements.resetChecklist.addEventListener("click", () => {
  updateActiveCase({ checklist: {} });
  renderChecklist();
});

elements.copyLetter.addEventListener("click", async () => {
  await navigator.clipboard.writeText(elements.letterOutput.value);
  elements.copyLetter.textContent = "Gekopieerd";
  setTimeout(() => {
    elements.copyLetter.textContent = "Kopieer";
  }, 1400);
});

elements.scenarioButtons.forEach((button) => {
  button.addEventListener("click", () => applyScenario(button.dataset.scenario));
});

function createCase(type) {
  const newCase = {
    id: crypto.randomUUID(),
    type,
    status: "open",
    name: "",
    email: "",
    municipality: "",
    fineReference: "",
    fineDate: "",
    plate: "",
    street: "",
    fineTime: "",
    zone: "",
    reason: "resident-card",
    facts: type === "fine" ? defaultFineFacts : "",
    oldPlate: "",
    newPlate: "",
    changeType: "Definitieve plaatwijziging",
    replacementUntil: "",
    plateNote: type === "plate" ? defaultPlateNote : "",
    checklist: {},
    createdAt: new Date().toISOString(),
  };

  cases.unshift(newCase);
  activeId = newCase.id;
  persistCases();
  render();
}

function loadCases() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function persistCases() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

function getActiveCase() {
  return cases.find((item) => item.id === activeId) || cases[0];
}

function updateActiveCase(updates, shouldRender = true) {
  const activeCase = getActiveCase();
  if (!activeCase) return;

  cases = cases.map((item) => (
    item.id === activeCase.id ? { ...item, ...updates } : item
  ));
  persistCases();

  if (shouldRender) {
    render();
  }
}

function render() {
  const activeCase = getActiveCase();
  if (!activeCase) return;

  activeId = activeCase.id;
  renderCases();
  renderForm(activeCase);
  renderTabs(activeCase.type);
  renderChecklist();
  renderZoneInfo();
  renderLetter();
}

function renderCases() {
  elements.caseList.innerHTML = "";
  elements.emptyList.hidden = cases.length > 0;

  cases.forEach((item) => {
    const node = elements.caseTemplate.content.firstElementChild.cloneNode(true);
    const button = node.querySelector(".case-card");
    const title = node.querySelector(".case-title");
    const meta = node.querySelector(".case-meta");

    title.textContent = getCaseTitle(item);
    meta.textContent = getCaseMeta(item);
    button.classList.toggle("is-active", item.id === activeId);

    button.addEventListener("click", () => {
      activeId = item.id;
      render();
    });

    elements.caseList.appendChild(node);
  });

  elements.openCount.textContent = cases.filter((item) => item.status === "open").length;
  elements.draftCount.textContent = cases.filter((item) => item.status === "ready").length;
}

function renderForm(activeCase) {
  setValue("name", activeCase.name);
  setValue("email", activeCase.email);
  setValue("municipality", activeCase.municipality);
  setValue("status", activeCase.status);
  setValue("fine-reference", activeCase.fineReference);
  setValue("fine-date", activeCase.fineDate);
  setValue("plate", activeCase.plate);
  setValue("street", activeCase.street);
  setValue("fine-time", activeCase.fineTime);
  setValue("zone", activeCase.zone);
  setValue("reason", activeCase.reason);
  setValue("facts", activeCase.facts);
  setValue("old-plate", activeCase.oldPlate);
  setValue("new-plate", activeCase.newPlate);
  setValue("change-type", activeCase.changeType);
  setValue("replacement-until", activeCase.replacementUntil);
  setValue("plate-note", activeCase.plateNote);
}

function renderTabs(type) {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.type === type);
  });
  elements.fineFields.classList.toggle("is-hidden", type !== "fine");
  elements.plateFields.classList.toggle("is-hidden", type !== "plate");
}

function renderZoneInfo() {
  const activeCase = getActiveCase();
  const info = zoneInfo[activeCase.zone];

  if (!info) {
    elements.zoneSummary.textContent = "Kies een zone";
    elements.zoneBox.textContent = "Kies in je dossier een parkeerzone om de normale regels en mogelijke retributie te zien.";
    return;
  }

  elements.zoneSummary.textContent = info.label;
  elements.zoneBox.innerHTML = `
    <strong>${info.label}</strong>
    <span>${info.rule}</span>
    <em>${info.fee}</em>
  `;
}

function renderChecklist() {
  const activeCase = getActiveCase();
  const items = checklistItems[activeCase.type];
  elements.checklist.innerHTML = "";

  items.forEach((text, index) => {
    const id = `${activeCase.id}-${index}`;
    const label = document.createElement("label");
    label.className = "check-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(activeCase.checklist?.[index]);
    input.addEventListener("change", () => {
      updateActiveCase({
        checklist: {
          ...activeCase.checklist,
          [index]: input.checked,
        },
      }, false);
    });

    const span = document.createElement("span");
    span.textContent = text;
    label.htmlFor = id;
    input.id = id;

    label.append(input, span);
    elements.checklist.appendChild(label);
  });
}

function renderLetter() {
  const activeCase = getActiveCase();
  elements.letterOutput.value = activeCase.type === "fine"
    ? buildFineLetter(activeCase)
    : buildPlateLetter(activeCase);
}

function readForm() {
  return {
    name: valueOf("name"),
    email: valueOf("email"),
    municipality: valueOf("municipality"),
    status: valueOf("status"),
    fineReference: valueOf("fine-reference"),
    fineDate: valueOf("fine-date"),
    plate: valueOf("plate").toUpperCase(),
    street: valueOf("street"),
    fineTime: valueOf("fine-time"),
    zone: valueOf("zone"),
    reason: valueOf("reason"),
    facts: valueOf("facts"),
    oldPlate: valueOf("old-plate").toUpperCase(),
    newPlate: valueOf("new-plate").toUpperCase(),
    changeType: valueOf("change-type"),
    replacementUntil: valueOf("replacement-until"),
    plateNote: valueOf("plate-note"),
  };
}

function buildFineLetter(item) {
  const reason = {
    "resident-card": "Ik beschikte over een geldige bewonerskaart of parkeerkaart voor deze situatie.",
    "paid-ticket": "Ik had mijn parkeersessie betaald en voeg het betalingsbewijs toe.",
    "blue-disc": "Ik gebruikte een blauwe parkeerschijf en betwist dat de toegelaten parkeertijd werd overschreden.",
    "wrong-plate": "De nummerplaat of vaststelling lijkt foutief geregistreerd.",
    signage: "De signalisatie of de toepasselijke parkeerzone was onduidelijk.",
    other: "Er zijn feitelijke elementen waardoor ik de retributie betwist.",
  }[item.reason];
  const zoneLine = zoneInfo[item.zone]
    ? `Volgens de informatie over deze zone noteer ik: ${zoneInfo[item.zone].rule} ${zoneInfo[item.zone].fee}`
    : "";

  const lines = [
    "Onderwerp: bezwaar tegen parkeerretributie",
    "",
    `Naam: ${item.name || "[naam]"}`,
    `E-mail: ${item.email || "[e-mail]"}`,
    `Gemeente: ${item.municipality || "[gemeente]"}`,
    `Referentie: ${item.fineReference || "[referentie]"}`,
    `Datum retributie: ${formatDate(item.fineDate) || "[datum]"}`,
    `Uur vaststelling: ${item.fineTime || "[uur]"}`,
    `Locatie: ${item.street || "[straat / locatie]"}`,
    `Nummerplaat: ${item.plate || "[nummerplaat]"}`,
    `Zone: ${zoneInfo[item.zone]?.label || "[zone]"}`,
    "",
    "Geachte,",
    "",
    "Hierbij dien ik een klacht/betwisting in tegen de hierboven vermelde parkeerretributie.",
    reason,
  ];

  if (zoneLine) {
    lines.push(zoneLine);
  }

  lines.push(
    "",
    item.facts || defaultFineFacts,
    "",
    "Ik vraag u vriendelijk om mijn dossier opnieuw te onderzoeken en de retributie te annuleren indien de bijgevoegde bewijsstukken dit bevestigen.",
    "",
    "Met vriendelijke groeten,",
    item.name || "[naam]",
  );

  return lines.join("\n");
}

function buildPlateLetter(item) {
  return [
    "Onderwerp: wijziging parkeerkaart / bewonerskaart",
    "",
    `Naam: ${item.name || "[naam]"}`,
    `E-mail: ${item.email || "[e-mail]"}`,
    `Gemeente: ${item.municipality || "[gemeente]"}`,
    `Type wijziging: ${item.changeType || "[type wijziging]"}`,
    `Oude nummerplaat: ${item.oldPlate || "[oude nummerplaat]"}`,
    `Nieuwe nummerplaat: ${item.newPlate || "[nieuwe nummerplaat]"}`,
    item.replacementUntil ? `Tijdelijk tot: ${formatDate(item.replacementUntil)}` : "",
    "",
    "Geachte,",
    "",
    "Gelieve mijn parkeerkaart/bewonerskaart te wijzigen op basis van bovenstaande gegevens.",
    "",
    item.plateNote || defaultPlateNote,
    "",
    "De nodige bewijsstukken worden toegevoegd aan de officiële aanvraag.",
    "",
    "Met vriendelijke groeten,",
    item.name || "[naam]",
  ].filter(Boolean).join("\n");
}

function getCaseTitle(item) {
  if (item.type === "fine") {
    return item.fineReference || item.plate || "Nieuwe betwisting";
  }

  return item.newPlate || item.oldPlate || "Nieuwe plaatwijziging";
}

function getCaseMeta(item) {
  const type = item.type === "fine" ? "Boete" : "Kaart";
  const zone = item.zone ? ` - ${zoneInfo[item.zone]?.label}` : "";
  return `${type} - ${statusLabel(item.status)}${zone}`;
}

function applyScenario(scenario) {
  if (scenario === "plate-change") {
    updateActiveCase({
      type: "plate",
      status: "open",
      plateNote: valueOf("plate-note") || defaultPlateNote,
    });
    return;
  }

  const scenarioFacts = {
    "resident-card": "Ik beschikte op het moment van de vaststelling over een geldige bewonerskaart/parkeerkaart. Controleer aub de geldigheid, de zone en de gekoppelde nummerplaat.",
    "paid-ticket": "Ik had mijn parkeersessie correct gestart via app, sms of parkeerautomaat. Ik voeg het betalingsbewijs, de sessiegegevens en indien mogelijk de zonecode toe.",
    "blue-disc": "Ik had mijn blauwe schijf zichtbaar geplaatst. Controleer aub het beginuur, de toegelaten duur op het bijkomend bord en het tijdstip van de vaststelling.",
  };

  updateActiveCase({
    type: "fine",
    reason: scenario,
    facts: scenarioFacts[scenario] || defaultFineFacts,
  });
}

function statusLabel(status) {
  return {
    open: "open",
    ready: "klaar",
    sent: "ingediend",
    closed: "afgesloten",
  }[status] || "open";
}

function setValue(id, value) {
  document.getElementById(id).value = value || "";
}

function valueOf(id) {
  return document.getElementById(id).value.trim();
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("nl-BE").format(new Date(`${value}T00:00:00`));
}
