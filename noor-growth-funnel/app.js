const STORAGE_KEY = "noor-growth-funnel-leads";

const leadForm = document.getElementById("lead-capture-form");
const formStatus = document.getElementById("form-status");
const interestBreakdown = document.getElementById("interest-breakdown");
const leadTableBody = document.getElementById("lead-table-body");
const leadTableCount = document.getElementById("lead-table-count");
const metricTemplate = document.getElementById("metric-item-template");

const statTotal = document.getElementById("stat-total");
const statHot = document.getElementById("stat-hot");
const statOffer = document.getElementById("stat-offer");
const statBudget = document.getElementById("stat-budget");

const exportJsonButton = document.getElementById("export-json");
const exportCsvButton = document.getElementById("export-csv");
const clearLeadsButton = document.getElementById("clear-leads");

let leads = loadLeads();

renderDashboard();

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(leadForm);
  const interests = formData.getAll("interests");

  if (interests.length === 0) {
    formStatus.textContent = "Kies minimaal 1 interessegebied zodat je data bruikbaar blijft.";
    formStatus.style.color = "#aa4638";
    return;
  }

  const lead = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: formData.get("name")?.toString().trim(),
    email: formData.get("email")?.toString().trim(),
    phone: formData.get("phone")?.toString().trim(),
    country: formData.get("country"),
    persona: formData.get("persona"),
    childrenAge: formData.get("childrenAge"),
    interests,
    biggestProblem: formData.get("biggestProblem")?.toString().trim(),
    topOffer: formData.get("topOffer"),
    budget: formData.get("budget"),
    urgency: formData.get("urgency"),
    willingToPay: formData.get("willingToPay"),
    consent: Boolean(formData.get("consent")),
  };

  leads.unshift(lead);
  persistLeads();
  renderDashboard();

  leadForm.reset();
  formStatus.textContent = "Lead opgeslagen. Deze persoon is nu zichtbaar in je lokale dashboard.";
  formStatus.style.color = "#166a5b";
});

exportJsonButton.addEventListener("click", () => {
  downloadFile(
    "noor-leads.json",
    JSON.stringify(leads, null, 2),
    "application/json"
  );
});

exportCsvButton.addEventListener("click", () => {
  const rows = [
    [
      "createdAt",
      "name",
      "email",
      "phone",
      "country",
      "persona",
      "childrenAge",
      "interests",
      "biggestProblem",
      "topOffer",
      "budget",
      "urgency",
      "willingToPay",
    ],
    ...leads.map((lead) => [
      lead.createdAt,
      lead.name,
      lead.email,
      lead.phone,
      lead.country,
      lead.persona,
      lead.childrenAge,
      lead.interests.join(" | "),
      lead.biggestProblem,
      lead.topOffer,
      lead.budget,
      lead.urgency,
      lead.willingToPay,
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  downloadFile("noor-leads.csv", csv, "text/csv;charset=utf-8;");
});

clearLeadsButton.addEventListener("click", () => {
  const shouldClear = window.confirm(
    "Weet je zeker dat je alle lokaal opgeslagen leads wilt verwijderen?"
  );

  if (!shouldClear) return;

  leads = [];
  persistLeads();
  renderDashboard();
});

function loadLeads() {
  try {
    const storedLeads = localStorage.getItem(STORAGE_KEY);
    return storedLeads ? JSON.parse(storedLeads) : [];
  } catch {
    return [];
  }
}

function persistLeads() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

function renderDashboard() {
  renderStats();
  renderInterestBreakdown();
  renderLeadTable();
}

function renderStats() {
  const hotLeads = leads.filter((lead) => lead.willingToPay === "Ja, direct");
  statTotal.textContent = String(leads.length);
  statHot.textContent = String(hotLeads.length);
  statOffer.textContent = getTopValue(leads.map((lead) => lead.topOffer));
  statBudget.textContent = getTopValue(leads.map((lead) => lead.budget));
}

function renderInterestBreakdown() {
  interestBreakdown.innerHTML = "";

  const counts = new Map();
  leads.forEach((lead) => {
    lead.interests.forEach((interest) => {
      counts.set(interest, (counts.get(interest) ?? 0) + 1);
    });
  });

  const sortedCounts = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sortedCounts.length === 0) {
    interestBreakdown.innerHTML = "<li class=\"metric-item\"><span class=\"metric-label\">Nog geen data</span><strong class=\"metric-value\">0</strong></li>";
    return;
  }

  sortedCounts.forEach(([label, value]) => {
    const item = metricTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector(".metric-label").textContent = label;
    item.querySelector(".metric-value").textContent = String(value);
    interestBreakdown.appendChild(item);
  });
}

function renderLeadTable() {
  leadTableBody.innerHTML = "";
  leadTableCount.textContent = `${leads.length} records`;

  if (leads.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = "<td colspan=\"7\">Nog geen leads opgeslagen.</td>";
    leadTableBody.appendChild(emptyRow);
    return;
  }

  leads.forEach((lead) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(lead.name)}</td>
      <td>${escapeHtml(lead.email)}</td>
      <td>${escapeHtml(lead.persona)}</td>
      <td>${escapeHtml(lead.topOffer)}</td>
      <td>${escapeHtml(lead.budget)}</td>
      <td>${escapeHtml(lead.willingToPay)}</td>
      <td>${formatDate(lead.createdAt)}</td>
    `;
    leadTableBody.appendChild(row);
  });
}

function getTopValue(values) {
  if (values.length === 0) return "-";

  const counts = new Map();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] ?? "-";
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("nl-BE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
